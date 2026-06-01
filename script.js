import { state } from './js/state.js';
import { fetchProductsFromAPI } from './js/api.js';
import { registerBeforeRenderHook, registerPages, showPage } from './js/router.js';
import { UI_CONFIG } from './js/config.js';

import {
    changeProductsPage,
    renderHeaderCategories,
    renderProductDetailPage,
    renderProducts,
    renderProductsPage,
    setPriceSort,
    setProductFilter,
    setSortMode,
    updateHeaderCategoryHighlight,
} from './js/ui/products.js';

import { renderHomePage } from './js/ui/home.js';

import {
    handleAvatarChange,
    renderProfilePage,
    saveProfile,
    toggleProfileField,
} from './js/ui/profile.js';

import {
    cancelOrder,
    confirmOrderReceived,
    initPurchasesPage,
    payOrder,
    renderPurchasesPage,
    requestReturnRefund,
    searchPurchases,
    setPurchasesTab,
} from './js/ui/purchases.js';

import {
    addToCart,
    removeFromCart,
    renderCartPage,
    updateCartBadge,
    updateQuantity,
} from './js/ui/cart.js';

import {
    closeProfileMenu,
    handleSignOut,
    handleAuthSubmit,
    refreshProfileUI,
    renderAuthPage,
    setAuthMode,
    toggleProfileMenu,
} from './js/ui/auth.js';

import {
    cleanupCheckoutCart,
    clearCheckoutError,
    handleCheckout,
    initCheckoutPage,
    renderCheckoutPage,
    toggleCheckoutPaymentMethod,
} from './js/ui/checkout.js';

registerBeforeRenderHook(() => {
    updateHeaderCategoryHighlight();
});

registerPages({
    home: {
        render: () => renderHomePage(),
        afterRender: () => _heroInit(),
    },
    products: {
        render: () => renderProductsPage(),
    },
    product: {
        render: (data) => renderProductDetailPage(data?.productId),
    },
    cart: {
        render: () => renderCartPage(),
    },
    checkout: {
        render: () => renderCheckoutPage(),
        afterRender: () => initCheckoutPage(),
    },
    purchases: {
        render: (data) => renderPurchasesPage(data),
        afterRender: () => initPurchasesPage(),
    },
    profile: {
        render: () => renderProfilePage(),
    },
    auth: {
        render: (data) => {
            if (data?.mode) {
                state.currentAuthMode = String(data.mode);
            }
            return renderAuthPage(state.currentAuthMode);
        },
    },
});

Object.assign(window, {
    // Router
    showPage,

    // Header / categories
    setProductFilter,

    // Cart
    addToCart,
    removeFromCart,
    updateQuantity,

    // Sorting / pagination
    setSortMode,
    setPriceSort,
    changeProductsPage,

    // Auth / profile
    toggleProfileMenu,
    closeProfileMenu,
    handleSignOut,
    handleAuthSubmit,
    setAuthMode,

    // Checkout
    handleCheckout,
    cleanupCheckoutCart,
    clearCheckoutError,
    toggleCheckoutPaymentMethod,

    // Profile page
    saveProfile,
    toggleProfileField,
    handleAvatarChange,

    // Purchases
    setPurchasesTab,
    searchPurchases,
    confirmOrderReceived,
    cancelOrder,
    requestReturnRefund,
    payOrder,

    // Hero carousel
    heroMove,
    heroGoTo,
    heroTogglePause,

    // Theme
    toggleTheme,
});

const THEME_STORAGE_KEY = 'theme';
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';

function getStoredTheme() {
    try {
        const savedTheme = String(localStorage.getItem(THEME_STORAGE_KEY) || '').toLowerCase();
        if (savedTheme === THEME_DARK || savedTheme === THEME_LIGHT) {
            return savedTheme;
        }
    } catch {
        // Ignore storage errors.
    }

    return THEME_LIGHT;
}

function setStoredTheme(theme) {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
        // Ignore storage errors.
    }
}

function updateThemeToggleButton(theme) {
    const themeButton = document.getElementById('themeToggleBtn');
    if (!themeButton) {
        return;
    }

    themeButton.textContent = theme === THEME_DARK ? 'Dark mode' : 'Light mode';
    themeButton.setAttribute('aria-pressed', theme === THEME_DARK ? 'true' : 'false');
}

function applyTheme(theme) {
    const safeTheme = theme === THEME_DARK ? THEME_DARK : THEME_LIGHT;
    document.documentElement.dataset.theme = safeTheme;
    updateThemeToggleButton(safeTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.dataset.theme || getStoredTheme();
    const nextTheme = currentTheme === THEME_DARK ? THEME_LIGHT : THEME_DARK;
    setStoredTheme(nextTheme);
    applyTheme(nextTheme);
}

// ── Hero Carousel ──────────────────────────────────────────────
// Think of this like a TV remote: heroMove(1) clicks "next channel",
// heroMove(-1) clicks "previous channel", and heroGoTo(n) jumps to a specific channel.

let _heroCurrentSlide = 0;
let _heroPaused = false;
let _heroTimer = null;
const HERO_INTERVAL_MS = 5000; // Auto-advance every 5 seconds

function _heroGetSlides() {
    return Array.from(document.querySelectorAll('.hero-slide'));
}

function _heroGetDots() {
    return Array.from(document.querySelectorAll('.hero-dot'));
}

function _heroActivate(index) {
    const slides = _heroGetSlides();
    const dots = _heroGetDots();
    if (slides.length === 0) return;

    // Wrap around (like a carousel: after the last slide, go back to the first)
    _heroCurrentSlide = ((index % slides.length) + slides.length) % slides.length;

    slides.forEach((slide, i) => slide.classList.toggle('active', i === _heroCurrentSlide));
    dots.forEach((dot, i) => dot.classList.toggle('active', i === _heroCurrentSlide));
}

function _heroStartTimer() {
    clearInterval(_heroTimer);
    if (!_heroPaused) {
        _heroTimer = setInterval(() => _heroActivate(_heroCurrentSlide + 1), HERO_INTERVAL_MS);
    }
}

function heroMove(direction) {
    _heroActivate(_heroCurrentSlide + direction);
    _heroStartTimer();
}

function heroGoTo(index) {
    _heroActivate(index);
    _heroStartTimer();
}

function heroTogglePause() {
    _heroPaused = !_heroPaused;
    const btn = document.getElementById('heroPauseBtn');
    if (btn) btn.innerHTML = _heroPaused ? '&#9654;' : '&#10074;&#10074;';
    _heroStartTimer();
}

// Start the carousel timer whenever the home page is rendered
function _heroInit() {
    _heroCurrentSlide = 0;
    _heroPaused = false;
    _heroStartTimer();
}


document.addEventListener('DOMContentLoaded', async () => {
    applyTheme(getStoredTheme());

    try {
        localStorage.removeItem('currency');
    } catch {
        // Ignore storage errors.
    }

    updateCartBadge();
    refreshProfileUI();
    updateHeaderCategoryHighlight();

    await fetchProductsFromAPI();
    renderHeaderCategories();

    showPage('home');

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        let pendingSearchTimer = null;

        searchInput.addEventListener('input', (event) => {
            const nextQuery = String(event.target?.value || '');
            if (nextQuery === state.currentSearchQuery) {
                return;
            }

            state.currentSearchQuery = nextQuery;
            state.currentProductsPage = 1;

            if (pendingSearchTimer) {
                clearTimeout(pendingSearchTimer);
            }

            if (state.currentPage !== 'products') {
                return;
            }

            pendingSearchTimer = setTimeout(() => {
                if (state.currentPage === 'products') {
                    renderProducts(state.currentSearchQuery);
                }
            }, UI_CONFIG.searchDebounceMs);
        });
    }

    document.addEventListener('click', (event) => {
        const profileWrapper = document.querySelector('.profile-menu-wrapper');
        if (profileWrapper && !profileWrapper.contains(event.target)) {
            closeProfileMenu();
        }
    });
});
