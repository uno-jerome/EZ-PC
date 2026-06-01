import { state } from './state.js';

function resolveApiUrl() {
    const configuredBase = window?.ESTORE_API_BASE_URL;
    if (typeof configuredBase === 'string' && configuredBase.trim()) {
        return configuredBase.trim().replace(/\/+$/, '');
    }

    if (location.protocol === 'file:') {
        return 'http://localhost:8000/api';
    }

    return `${location.origin}${location.pathname.replace(/\/[^/]*$/, '')}/api`;
}

export const API_URL = resolveApiUrl();

async function requestApiJson(path, options = {}) {
    const response = await fetch(`${API_URL}/${path}`, options);
    const responseText = await response.text();

    const parsedBody = (() => {
        if (!responseText) {
            return null;
        }

        try {
            return JSON.parse(responseText);
        } catch {
            return null;
        }
    })();

    if (!response.ok) {
        const errorMessage =
            parsedBody?.details ||
            parsedBody?.error ||
            (responseText ? responseText.slice(0, 300).trim() : '') ||
            `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
    }

    return parsedBody;
}

export async function fetchProductsFromAPI() {
    try {
        const parsedBody = await requestApiJson('products.php');

        const list = Array.isArray(parsedBody)
            ? parsedBody
            : (Array.isArray(parsedBody?.products) ? parsedBody.products : []);

        state.products = list.map((product, index) => ({
            ...product,
            originalIndex: index,
        }));

        state.productLoadError = '';
    } catch (error) {
        console.error('Error loading products:', error);
        state.products = [];
        state.productLoadError = error?.message || 'Unable to load products.';
    }
}

export async function createOrderInAPI(payload) {
    const parsedBody = await requestApiJson('orders.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: 'create',
            ...payload,
        }),
    });

    return parsedBody?.order || null;
}

export async function fetchOrdersFromAPI(customerId) {
    const parsedBody = await requestApiJson(`orders.php?customerId=${encodeURIComponent(String(customerId || ''))}`);
    return Array.isArray(parsedBody?.orders) ? parsedBody.orders : [];
}

export async function updateOrderInAPI(customerId, orderId, action) {
    return requestApiJson('orders.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action,
            customerId,
            orderId,
        }),
    });
}
