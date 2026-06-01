function safeJsonParse(value) {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function readLocalStorageJson(key, fallbackValue) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) {
            return fallbackValue;
        }

        const parsed = safeJsonParse(raw);
        return parsed === null ? fallbackValue : parsed;
    } catch {
        return fallbackValue;
    }
}

const USER_STORAGE_KEY = 'user';
const LEGACY_CART_STORAGE_KEY = 'cart';
const GUEST_CART_STORAGE_KEY = 'cart:guest';
const USER_CART_STORAGE_PREFIX = 'cart:user:';
const LEGACY_ORDERS_STORAGE_KEY = 'orders';
const GUEST_ORDERS_STORAGE_KEY = 'orders:guest';
const USER_ORDERS_STORAGE_PREFIX = 'orders:user:';
const LEGACY_PROFILE_STORAGE_KEY = 'profile_extra';
const GUEST_PROFILE_STORAGE_KEY = 'profile:guest';
const USER_PROFILE_STORAGE_PREFIX = 'profile:user:';

function normalizeCartItems(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((entry) => {
            if (!entry || typeof entry !== 'object') {
                return null;
            }

            const productId = String(entry.productId || '').trim();
            const quantity = Number(entry.quantity) || 0;

            if (!productId || quantity <= 0) {
                return null;
            }

            return { productId, quantity };
        })
        .filter(Boolean);
}

function normalizePlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    return value;
}

function getUserScopedStorageKey(user, guestKey, userPrefix) {
    const userId = user?.id;
    if (userId === null || userId === undefined || userId === '') {
        return guestKey;
    }

    return `${userPrefix}${userId}`;
}

function migrateLegacyCartStorage() {
    try {
        const legacyCart = readLocalStorageJson(LEGACY_CART_STORAGE_KEY, null);
        if (legacyCart === null) {
            return;
        }

        const guestCart = readLocalStorageJson(GUEST_CART_STORAGE_KEY, null);
        if (guestCart === null) {
            localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(normalizeCartItems(legacyCart)));
        }

        localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
    } catch {
        // Ignore storage errors.
    }
}

function removeLegacyOrdersStorage() {
    try {
        localStorage.removeItem(LEGACY_ORDERS_STORAGE_KEY);
        localStorage.removeItem(GUEST_ORDERS_STORAGE_KEY);

        const keysToRemove = [];
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (typeof key === 'string' && key.startsWith(USER_ORDERS_STORAGE_PREFIX)) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach((key) => {
            localStorage.removeItem(key);
        });
    } catch {
        // Ignore storage errors.
    }
}

function migrateLegacyProfileStorage(user) {
    try {
        const legacyProfileExtra = readLocalStorageJson(LEGACY_PROFILE_STORAGE_KEY, null);
        if (legacyProfileExtra === null) {
            return;
        }

        const targetKey = getProfileStorageKey(user);
        const existingProfileExtra = readLocalStorageJson(targetKey, null);
        if (existingProfileExtra === null) {
            localStorage.setItem(targetKey, JSON.stringify(normalizePlainObject(legacyProfileExtra)));
        }

        localStorage.removeItem(LEGACY_PROFILE_STORAGE_KEY);
    } catch {
        // Ignore storage errors.
    }
}

export function getCartStorageKey(user) {
    return getUserScopedStorageKey(user, GUEST_CART_STORAGE_KEY, USER_CART_STORAGE_PREFIX);
}

export function getProfileStorageKey(user) {
    return getUserScopedStorageKey(user, GUEST_PROFILE_STORAGE_KEY, USER_PROFILE_STORAGE_PREFIX);
}

export function readCartFromStorage(user) {
    const key = getCartStorageKey(user);
    const storedCart = readLocalStorageJson(key, []);
    return normalizeCartItems(storedCart);
}

export function writeCartToStorage(user, cart) {
    try {
        const key = getCartStorageKey(user);
        localStorage.setItem(key, JSON.stringify(normalizeCartItems(cart)));
    } catch {
        // Ignore storage errors.
    }
}

export function readProfileExtraFromStorage(user) {
    const key = getProfileStorageKey(user);
    const storedProfileExtra = readLocalStorageJson(key, {});
    return normalizePlainObject(storedProfileExtra);
}

export function writeProfileExtraToStorage(user, profileExtra) {
    try {
        const key = getProfileStorageKey(user);
        localStorage.setItem(key, JSON.stringify(normalizePlainObject(profileExtra)));
    } catch {
        // Ignore storage errors.
    }
}

export function loadCartForUser(user) {
    state.cart = readCartFromStorage(user);
    return state.cart;
}

export function persistCurrentCart() {
    writeCartToStorage(state.currentUser, state.cart);
}

function mergeCartItems(primaryCart, secondaryCart) {
    const merged = new Map();

    normalizeCartItems(primaryCart).forEach((item) => {
        merged.set(item.productId, item.quantity);
    });

    normalizeCartItems(secondaryCart).forEach((item) => {
        merged.set(item.productId, (merged.get(item.productId) || 0) + item.quantity);
    });

    return Array.from(merged.entries()).map(([productId, quantity]) => ({ productId, quantity }));
}

export function mergeGuestCartIntoUser(user) {
    if (!user) {
        return [];
    }

    const guestCart = readCartFromStorage(null);
    if (guestCart.length === 0) {
        state.cart = readCartFromStorage(user);
        return state.cart;
    }

    const userCart = readCartFromStorage(user);
    const mergedCart = mergeCartItems(userCart, guestCart);

    state.cart = mergedCart;
    writeCartToStorage(user, mergedCart);
    writeCartToStorage(null, []);

    return mergedCart;
}

const initialUser = readLocalStorageJson(USER_STORAGE_KEY, null);

migrateLegacyCartStorage();
removeLegacyOrdersStorage();
migrateLegacyProfileStorage(initialUser);

export const state = {
    products: [],
    productLoadError: '',

    currentUser: initialUser,
    cart: readCartFromStorage(initialUser),

    currentPage: 'home',

    selectedCategory: 'All',
    currentSearchQuery: '',
    currentProductsPage: 1,

    currentAuthMode: 'login',

    currentSortMode: 'relevance',

    PRODUCTS_PER_PAGE: 60,
};
