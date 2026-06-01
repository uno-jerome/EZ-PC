import { state } from '../state.js';
import { escapeHtml, formatPrice } from '../utils.js';
import { showPage } from '../router.js';
import { CHECKOUT_CONFIG } from '../config.js';

const SEARCH_STOP_WORDS = new Set([
    'a',
    'an',
    'and',
    'are',
    'as',
    'at',
    'be',
    'by',
    'for',
    'from',
    'in',
    'is',
    'it',
    'of',
    'on',
    'or',
    'that',
    'the',
    'this',
    'to',
    'with',
]);

const SEARCH_SYNONYMS = new Map([
    ['cpu', ['processor']],
    ['processor', ['cpu']],
]);

function normalizeSearchText(value) {
    return String(value ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenizeSearchQuery(query) {
    const normalized = normalizeSearchText(query);
    if (!normalized) {
        return [];
    }

    return normalized
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token.length >= 2)
        .filter((token) => !SEARCH_STOP_WORDS.has(token));
}

function buildSearchTokenGroups(tokens) {
    return tokens.map((token) => {
        const synonyms = SEARCH_SYNONYMS.get(token) || [];
        return [token, ...synonyms];
    });
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getProductSearchHaystack(product) {
    const parts = [
        product?.name,
        product?.description,
        product?.brand,
        product?.subcategory,
        product?.category,
        product?.category_value,
        product?.type,
        product?.model,
        product?.sku,
        product?.id,
    ].filter(Boolean);

    return normalizeSearchText(parts.join(' '));
}

function getProductCategorySearchText(product) {
    const parts = [
        product?.subcategory,
        product?.category,
        product?.category_value,
    ].filter(Boolean);

    return normalizeSearchText(parts.join(' '));
}

function computeSearchScore(product, tokenGroups, normalizedQuery) {
    const haystack = getProductSearchHaystack(product);
    if (!haystack) {
        return 0;
    }

    const normalizedName = normalizeSearchText(product?.name);
    const normalizedDescription = normalizeSearchText(product?.description);
    const normalizedCategory = getProductCategorySearchText(product);
    const boundaryCache = new Map();

    let matchedTokens = 0;
    let score = 0;
    let hasStrongMatch = false;

    for (const group of tokenGroups) {
        const primaryToken = group[0];
        const synonyms = group.slice(1);

        const matchedVariant = (() => {
            if (primaryToken && haystack.includes(primaryToken)) {
                return primaryToken;
            }

            if (!normalizedCategory || synonyms.length === 0) {
                return '';
            }

            return synonyms.find((variant) => normalizedCategory.includes(variant)) || '';
        })();

        if (!matchedVariant) {
            continue;
        }

        matchedTokens += 1;

        const lengthBoost = Math.min(matchedVariant.length, 10);
        score += 6 + lengthBoost;

        if (normalizedName.includes(matchedVariant)) {
            score += 12;
            hasStrongMatch = true;

            if (!boundaryCache.has(matchedVariant)) {
                boundaryCache.set(matchedVariant, new RegExp(`\\b${escapeRegExp(matchedVariant)}`));
            }

            if (boundaryCache.get(matchedVariant).test(normalizedName)) {
                score += 4;
            }
        }

        if (normalizedCategory.includes(matchedVariant)) {
            score += 6;
            hasStrongMatch = true;
        }

        if (normalizedDescription.includes(matchedVariant)) {
            score += 3;
        }
    }

    if (matchedTokens === 0) {
        return 0;
    }

    if (tokenGroups.length > 1 && !hasStrongMatch) {
        return 0;
    }

    if (normalizedQuery && haystack.includes(normalizedQuery)) {
        score += 10;
    }

    if (tokenGroups.length > 1) {
        const coverage = matchedTokens / tokenGroups.length;
        score += Math.round(coverage * 20);
        if (matchedTokens === tokenGroups.length) {
            score += 30;
        }
    }

    return score;
}

function getProductCategoryValue(product) {
    return String(product.category || product.subcategory || product.category_value || 'Uncategorized').trim() || 'Uncategorized';
}

export function getAvailableStockCategories() {
    const categorySet = new Set();

    (state.products || []).forEach((product) => {
        const categoryValue = getProductCategoryValue(product);
        if (categoryValue && categoryValue !== 'Uncategorized') {
            categorySet.add(categoryValue);
        }
    });

    return Array.from(categorySet).sort((a, b) => String(a).localeCompare(String(b)));
}

function matchesCategory(product, category) {
    const selection = String(category || '').trim();
    if (!selection || selection === 'All') {
        return true;
    }

    return getProductCategoryValue(product).toLowerCase() === selection.toLowerCase();
}

export function renderHeaderCategories() {
    const nav = document.getElementById('headerCategoryNav');
    if (!nav) {
        return;
    }

    const categories = ['All', ...getAvailableStockCategories()];
    const activeCategory = categories.includes(state.selectedCategory) ? state.selectedCategory : 'All';

    nav.innerHTML = categories
        .map((category) => {
            const isActive = category === activeCategory;
            return `<button
                class="header-cat-link${isActive ? ' active' : ''}"
                onclick="setProductFilter('${escapeHtml(category)}')"
                aria-current="${isActive ? 'page' : 'false'}"
            >${escapeHtml(category)}</button>`;
        })
        .join('');
}

export function updateHeaderCategoryHighlight() {
    renderHeaderCategories();
}

export function setProductFilter(category) {
    state.selectedCategory = String(category || 'All');
    state.currentProductsPage = 1;
    updateHeaderCategoryHighlight();

    showPage('products');
}

function parseProductDateValue(product) {
    const dateValue = product?.date || product?.createdAt || product?.created_at;
    if (!dateValue) {
        return null;
    }

    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed.getTime();
}

function parseProductIdNumber(product) {
    const rawId = String(product?.id ?? '').trim();
    const numeric = Number(rawId);
    if (Number.isFinite(numeric)) {
        return numeric;
    }

    const extracted = Number(rawId.replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(extracted) ? extracted : 0;
}

function sortProducts(list, options = {}) {
    const productsList = Array.isArray(list) ? list.slice() : [];
    const sortMode = String(state.currentSortMode || 'relevance');

    if (sortMode === 'relevance') {
        const searchQuery = String(options.searchQuery || '').trim();
        const searchScores = options.searchScores;

        if (searchQuery && searchScores) {
            return productsList.sort((a, b) => {
                const aScore = Number(searchScores.get(a) ?? 0);
                const bScore = Number(searchScores.get(b) ?? 0);

                if (aScore !== bScore) {
                    return bScore - aScore;
                }

                return (a.originalIndex ?? 0) - (b.originalIndex ?? 0);
            });
        }

        return productsList.sort((a, b) => (a.originalIndex ?? 0) - (b.originalIndex ?? 0));
    }

    if (sortMode === 'latest') {
        return productsList.sort((a, b) => {
            const aTime = parseProductDateValue(a);
            const bTime = parseProductDateValue(b);
            if (aTime !== null || bTime !== null) {
                return (bTime ?? 0) - (aTime ?? 0);
            }

            return parseProductIdNumber(b) - parseProductIdNumber(a);
        });
    }

    if (sortMode === 'topSales') {
        return productsList.sort((a, b) => {
            const aScore = Number(a?.rating ?? 0);
            const bScore = Number(b?.rating ?? 0);
            return bScore - aScore;
        });
    }

    if (sortMode === 'priceAsc' || sortMode === 'priceDesc') {
        const direction = sortMode === 'priceAsc' ? 1 : -1;
        return productsList.sort((a, b) => {
            const aPrice = Number(a?.price ?? 0);
            const bPrice = Number(b?.price ?? 0);
            return direction * (aPrice - bPrice);
        });
    }

    return productsList;
}

function getFilteredProducts(searchQuery = '') {
    const categoryFiltered = state.selectedCategory === 'All'
        ? state.products
        : state.products.filter((product) => matchesCategory(product, state.selectedCategory));

    const tokens = tokenizeSearchQuery(searchQuery);
    const tokenGroups = buildSearchTokenGroups(tokens);
    const normalizedQuery = normalizeSearchText(searchQuery);

    if (tokens.length === 0) {
        return sortProducts(categoryFiltered);
    }

    const searchScores = new WeakMap();
    const searched = categoryFiltered.filter((product) => {
        const score = computeSearchScore(product, tokenGroups, normalizedQuery);
        if (score <= 0) {
            return false;
        }

        searchScores.set(product, score);
        return true;
    });

    return sortProducts(searched, { searchQuery: normalizedQuery, searchScores });
}

export function setSortMode(mode) {
    state.currentSortMode = String(mode || 'relevance');
    state.currentProductsPage = 1;
    renderProducts(state.currentSearchQuery);
}

export function setPriceSort(order) {
    const normalized = String(order || '');
    if (normalized === 'asc') {
        setSortMode('priceAsc');
        return;
    }

    if (normalized === 'desc') {
        setSortMode('priceDesc');
        return;
    }

    setSortMode('relevance');
}

export function changeProductsPage(delta) {
    state.currentProductsPage = Math.max(1, state.currentProductsPage + delta);
    renderProducts(state.currentSearchQuery);
}

function getCartQuantityForProduct(productId) {
    return (state.cart || []).reduce((sum, item) => {
        return item.productId === productId ? sum + (Number(item.quantity) || 0) : sum;
    }, 0);
}

function getAvailableStock(product) {
    return Math.max(0, Number(product?.stock) || 0);
}

function getRemainingStock(product) {
    return Math.max(0, getAvailableStock(product) - getCartQuantityForProduct(product.id));
}

function getStockLabel(product) {
    const availableStock = getAvailableStock(product);
    const remainingStock = getRemainingStock(product);

    if (availableStock <= 0) {
        return {
            badgeClass: 'is-out-of-stock',
            text: 'Out of stock',
            addLabel: 'Out of Stock',
            buyLabel: 'Unavailable',
            disabled: true,
        };
    }

    if (remainingStock <= 0) {
        return {
            badgeClass: 'is-low-stock',
            text: `All ${availableStock} item${availableStock === 1 ? '' : 's'} already in cart`,
            addLabel: 'Max in Cart',
            buyLabel: 'Max in Cart',
            disabled: true,
        };
    }

    return {
        badgeClass: 'is-in-stock',
        text: `${availableStock} in stock`,
        addLabel: 'Add to Cart',
        buyLabel: 'Buy Now',
        disabled: false,
    };
}

export function renderProductCard(product) {
    const stockState = getStockLabel(product);
    const template = document.getElementById('product-card-template');
    if (!template) {
        return `
            <div class="product-card" onclick="showPage('product', { productId: '${product.id}' })">
                <img src="${product.image}" alt="${product.name}" class="product-image">
                <div class="product-info">
                    <h3 class="product-name">${product.name}</h3>
                    <div class="product-meta-row">
                        <div class="product-rating">
                            <span class="star">★</span>
                            <span>${product.rating}</span>
                        </div>
                        <span class="product-card-price">${formatPrice(product.price)}</span>
                    </div>
                    <div class="product-stock-row">
                        <span class="product-stock-badge ${stockState.badgeClass}">${stockState.text}</span>
                    </div>
                    <div class="product-footer">
                        <button class="btn btn-primary" ${stockState.disabled ? 'disabled' : ''} onclick="event.stopPropagation(); addToCart('${product.id}')">
                            ${stockState.addLabel}
                        </button>
                        <button class="btn btn-outline" ${stockState.disabled ? 'disabled' : ''} onclick="event.stopPropagation(); addToCart('${product.id}'); showPage('cart')">
                            ${stockState.buyLabel}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    return template.innerHTML
        .replaceAll('{{id}}', escapeHtml(product.id))
        .replaceAll('{{image}}', escapeHtml(product.image))
        .replaceAll('{{name}}', escapeHtml(product.name))
        .replaceAll('{{rating}}', escapeHtml(product.rating))
        .replaceAll('{{price}}', escapeHtml(formatPrice(product.price)))
        .replaceAll('{{stockBadgeClass}}', escapeHtml(stockState.badgeClass))
        .replaceAll('{{stockLabel}}', escapeHtml(stockState.text))
        .replaceAll('{{addButtonDisabled}}', stockState.disabled ? 'disabled' : '')
        .replaceAll('{{addButtonLabel}}', escapeHtml(stockState.addLabel))
        .replaceAll('{{buyButtonDisabled}}', stockState.disabled ? 'disabled' : '')
        .replaceAll('{{buyButtonLabel}}', escapeHtml(stockState.buyLabel));
}

export function renderProductDetailPage(productId) {
    const product = state.products.find((p) => p.id === productId);

    if (!product) {
        return `
            <div class="container section">
                <button class="btn btn-outline" onclick="showPage('products')" style="margin-bottom: 2rem;">
                    ← Back
                </button>
                <p style="color: #6b7280;">Product not found.</p>
            </div>
        `;
    }

    const stockState = getStockLabel(product);

    return `
        <div class="container section">
            <button class="btn btn-outline" onclick="showPage('products')" style="margin-bottom: 2rem;">
                ← Back
            </button>
            <div class="product-detail">
                <img src="${product.image}" alt="${product.name}" class="product-detail-image">
                <div class="product-detail-info">
                    <h1>${product.name}</h1>
                    <div class="product-rating">
                        <span class="star">★</span>
                        <span>${product.rating}</span>
                        <span style="color: #9ca3af; margin-left: 0.5rem;">•</span>
                        <span class="product-stock-badge ${stockState.badgeClass}">${stockState.text}</span>
                    </div>
                    <div class="product-detail-price">${formatPrice(product.price)}</div>
                    <p class="product-detail-description">${product.description}</p>
                    <div style="display: flex; gap: 1rem;">
                        <button class="btn btn-primary" style="flex: 1;" ${stockState.disabled ? 'disabled' : ''} onclick="addToCart('${product.id}')">
                            ${stockState.addLabel}
                        </button>
                        <button class="btn btn-outline" ${stockState.disabled ? 'disabled' : ''} onclick="addToCart('${product.id}'); showPage('cart')">
                            ${stockState.buyLabel}
                        </button>
                    </div>
                    <div style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid #e5e7eb;">
                        <h3 style="margin-bottom: 1rem;">Product Features</h3>
                        <ul style="list-style: none; color: #6b7280;">
                            <li style="margin-bottom: 0.5rem;">✓ Free shipping on orders over ${formatPrice(CHECKOUT_CONFIG.freeShippingThreshold)}</li>
                            <li style="margin-bottom: 0.5rem;">✓ 30-day return policy</li>
                            <li style="margin-bottom: 0.5rem;">✓ Secure checkout</li>
                            <li style="margin-bottom: 0.5rem;">✓ 1-year warranty included</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    `;
}

export function renderProductsPage() {
    const filterCountLabel = state.selectedCategory === 'All' ? 'All stocks' : state.selectedCategory;
    const availableCategories = getAvailableStockCategories();

    return `
        <div class="container section">
            ${state.productLoadError ? `
                <div style="background: #fff7ed; border: 1px solid #fdba74; color: #9a3412; padding: 1rem 1.25rem; border-radius: 0.75rem; margin-bottom: 1rem;">
                    <strong>Products not loading:</strong> ${state.productLoadError}
                </div>
            ` : ''}
            <h1 class="section-title">All Products</h1>
            <div class="grid-2 products-layout">
                <aside class="filters-sidebar">
                    <h2 style="margin-bottom: 1.5rem;">Filters</h2>
                    <div class="filter-group">
                        <h3>Category</h3>
                        <button class="filter-btn ${state.selectedCategory === 'All' ? 'active' : ''}" onclick="setProductFilter('All')">All</button>
                        ${availableCategories.map((category) => `
                            <button class="filter-btn ${state.selectedCategory === category ? 'active' : ''}" onclick='setProductFilter(${JSON.stringify(category)})' type="button">
                                ${escapeHtml(category)}
                            </button>
                        `).join('')}
                    </div>
                    <div style="margin-top: 1.5rem; color: #6b7280; font-size: 0.875rem;">
                        Showing: <strong>${filterCountLabel}</strong>
                    </div>
                </aside>
                <div id="productsContainer">
                    ${renderProducts(state.currentSearchQuery)}
                </div>
            </div>
        </div>
    `;
}

export function renderProducts(searchQuery = '') {
    state.currentSearchQuery = String(searchQuery || '');

    const filtered = getFilteredProducts(state.currentSearchQuery);
    const totalPages = Math.max(1, Math.ceil(filtered.length / state.PRODUCTS_PER_PAGE));
    state.currentProductsPage = Math.min(state.currentProductsPage, totalPages);
    const startIndex = (state.currentProductsPage - 1) * state.PRODUCTS_PER_PAGE;
    const visibleProducts = filtered.slice(startIndex, startIndex + state.PRODUCTS_PER_PAGE);

    const priceSortValue = state.currentSortMode === 'priceAsc'
        ? 'asc'
        : (state.currentSortMode === 'priceDesc' ? 'desc' : '');

    const toolbar = `
        <div class="products-toolbar">
            <span class="products-toolbar-label">Sort by</span>
            <div class="products-toolbar-pills">
                <button class="sort-pill ${state.currentSortMode === 'relevance' ? 'active' : ''}" onclick="setSortMode('relevance')" type="button">Relevance</button>
                <button class="sort-pill ${state.currentSortMode === 'latest' ? 'active' : ''}" onclick="setSortMode('latest')" type="button">Latest</button>
                <button class="sort-pill ${state.currentSortMode === 'topSales' ? 'active' : ''}" onclick="setSortMode('topSales')" type="button">Top Sales</button>
            </div>
            <div class="products-toolbar-spacer"></div>
            <select class="products-toolbar-select" onchange="setPriceSort(this.value)" aria-label="Sort by price">
                <option value="">Price</option>
                <option value="asc" ${priceSortValue === 'asc' ? 'selected' : ''}>Price: Low to High</option>
                <option value="desc" ${priceSortValue === 'desc' ? 'selected' : ''}>Price: High to Low</option>
            </select>
        </div>
    `;

    const pagination = filtered.length > state.PRODUCTS_PER_PAGE ? `
        <div class="products-pagination">
            <button class="btn btn-outline" ${state.currentProductsPage === 1 ? 'disabled' : ''} onclick="changeProductsPage(-1)">Previous</button>
            <span class="products-pagination-status">Page ${state.currentProductsPage} of ${totalPages} • Showing ${visibleProducts.length} of ${filtered.length}</span>
            <button class="btn btn-outline" ${state.currentProductsPage === totalPages ? 'disabled' : ''} onclick="changeProductsPage(1)">Next</button>
        </div>
    ` : '';

    const html = `
        ${toolbar}
        <p style="color: #6b7280; margin-bottom: 1.5rem;">Showing ${filtered.length} ${state.selectedCategory === 'All' ? 'stocks' : 'products'}</p>
        <div class="products-grid products-grid-catalog">
            ${visibleProducts.map((product) => renderProductCard(product)).join('')}
        </div>
        ${pagination}
    `;

    const container = document.getElementById('productsContainer');
    if (container) {
        container.innerHTML = html;
    }

    return html;
}
