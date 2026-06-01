import { state } from '../state.js';
import { escapeHtml, formatPrice } from '../utils.js';
import { getAvailableStockCategories, renderProductCard } from './products.js';

export function renderHomePage() {
    const statusNotice = state.productLoadError
        ? `
            <div class="container" style="margin-top: 1.5rem;">
                <div style="background: #fff7ed; border: 1px solid #fdba74; color: #9a3412; padding: 1rem 1.25rem; border-radius: 0.75rem;">
                    <strong>Database connection issue:</strong> ${state.productLoadError}
                </div>
            </div>
        `
        : '';

    if (state.products.length === 0) {
        return `
            <div class="hero">
                <div class="container">
                    <h1>Discover Amazing Products</h1>
                    <p>${state.productLoadError ? 'Database connection failed.' : 'Loading products from database...'}</p>
                    <button class="btn btn-secondary" onclick="showPage('products')">
                        Shop Now →
                    </button>
                </div>
            </div>
            ${statusNotice}
        `;
    }

    const featuredProducts = state.products.slice(0, 6);
    const browseCategories = getAvailableStockCategories().slice(0, 12);

    // Build carousel slides from the first few products
    const heroSlides = state.products.slice(0, 4).map((product, index) => {
        const promos = [
            { headline: 'Big Deals Today', sub: 'Save big on top picks — limited time only.', cta: 'Shop Now', discount: 20 },
            { headline: 'New Arrivals', sub: 'Fresh stock just landed. Be the first to grab it.', cta: 'Explore', discount: 15 },
            { headline: 'Top Rated Items', sub: 'Loved by customers. Trusted by thousands.', cta: 'View More', discount: 10 },
            { headline: 'Clearance Sale', sub: 'Last chance deals — while supplies last.', cta: 'See Deals', discount: 25 },
        ];
        const promo = promos[index] || promos[0];
        const gridImages = state.products.slice(index * 4, index * 4 + 8);
        return { product, promo, gridImages };
    });

    const heroSlidesHtml = heroSlides.map((slide, index) => {
        const imagesHtml = slide.gridImages.map((p) =>
            `<div class="hero-grid-img-wrap" onclick="showPage('product', { productId: '${p.id}' })" title="${escapeHtml(p.name)}">
                <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy" />
            </div>`
        ).join('');

        return `
        <div class="hero-slide${index === 0 ? ' active' : ''}" data-slide="${index}">
            <div class="container hero-slide-inner">
                <div class="hero-slide-promo">
                    <h1>${escapeHtml(slide.promo.headline)}</h1>
                    <p>${escapeHtml(slide.promo.sub)}<br><em>Save up to ${slide.promo.discount}%* on select items.</em></p>
                    <button class="btn btn-hero-cta" onclick="setProductFilter('${escapeHtml(slide.product.category)}')">${escapeHtml(slide.promo.cta)} →</button>
                    <small class="hero-disclaimer">*While stocks last. Select items only.</small>
                </div>
                <div class="hero-slide-grid">
                    ${imagesHtml}
                </div>
            </div>
        </div>`;
    }).join('');

    const heroDots = heroSlides.map((_, index) =>
        `<button class="hero-dot${index === 0 ? ' active' : ''}" data-dot="${index}" onclick="heroGoTo(${index})" aria-label="Slide ${index + 1}"></button>`
    ).join('');

    const heroCarouselHtml = `
    <div class="hero-carousel" id="heroCarousel">
        ${heroSlidesHtml}
        <div class="hero-controls">
            <button class="hero-arrow hero-arrow-prev" onclick="heroMove(-1)" aria-label="Previous slide">&#8249;</button>
            <div class="hero-dots">${heroDots}</div>
            <button class="hero-arrow hero-arrow-next" onclick="heroMove(1)" aria-label="Next slide">&#8250;</button>
            <button class="hero-pause-btn" id="heroPauseBtn" onclick="heroTogglePause()" aria-label="Pause slideshow">&#10074;&#10074;</button>
        </div>
    </div>`;


    const browseRows = state.products.slice(0, 3).map((product, index) => ({
        productId: product.id,
        title: product.name,
        tags: [product.category, 'Featured', index === 0 ? 'Best Seller' : 'Top Pick'],
        note: product.description.substring(0, 80) + '...',
        discount: [20, 15, 10][index] || 10,
        badge: ['Popular', 'Trending', 'New'][index] || 'Featured',
    }));

    return `
        ${statusNotice}
        ${heroCarouselHtml}

        <div class="section">
            <div class="container">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h2>Featured Products</h2>
                    <button class="btn btn-outline" onclick="showPage('products')">View All →</button>
                </div>
                <div class="featured-products-grid">
                    ${featuredProducts.map((product) => renderProductCard(product)).join('')}
                </div>
            </div>
        </div>

        <div class="section browse-section">
            <div class="container browse-shell">
                <aside class="browse-sidebar-panel">
                    <h3>Browse Deals</h3>
                    <p>Find curated picks by vibe and category.</p>
                    <div class="browse-chip-row">
                        ${browseCategories.map((category) => `
                            <button class="browse-chip" onclick='setProductFilter(${JSON.stringify(category)})'>${escapeHtml(category)}</button>
                        `).join('')}
                    </div>
                    <div class="browse-stat-block">
                        <span class="browse-stat-label">Live stock catalog</span>
                        <span class="browse-stat-value">${state.products.length} products</span>
                    </div>
                    <div class="browse-stat-block">
                        <span class="browse-stat-label">Today highlights</span>
                        <span class="browse-stat-value">${browseRows.length} collections</span>
                    </div>
                </aside>

                <div class="browse-main-panel">
                    <div class="browse-main-header">
                        <h2>Curated Discoveries</h2>
                        <button class="btn btn-outline" onclick="showPage('products')">Explore All</button>
                    </div>

                    <div class="browse-list">
                        ${browseRows.map((row) => {
                            const product = state.products.find((p) => p.id === row.productId);
                            if (!product) {
                                return '';
                            }

                            const salePrice = product.price * (1 - row.discount / 100);

                            return `
                                <article class="browse-item" onclick="showPage('product', { productId: '${product.id}' })">
                                    <img class="browse-item-image" src="${product.image}" alt="${product.name}">
                                    <div class="browse-item-content">
                                        <h3>${row.title}</h3>
                                        <div class="browse-item-tags">
                                            ${row.tags.map((tag) => `<span>${tag}</span>`).join('')}
                                        </div>
                                        <p>${row.note}</p>
                                    </div>
                                    <div class="browse-item-pricing">
                                        <span class="browse-item-badge">${row.badge}</span>
                                        <span class="browse-item-discount">-${row.discount}%</span>
                                        <span class="browse-item-now">${formatPrice(salePrice)}</span>
                                        <span class="browse-item-old">${formatPrice(product.price)}</span>
                                    </div>
                                </article>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
}
