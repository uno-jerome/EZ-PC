import { state } from '../state.js';
import { formatPrice } from '../utils.js';
import { fetchOrdersFromAPI, updateOrderInAPI } from '../api.js';

// The tabs shown at the top, matching Shopee-style order statuses
const PURCHASE_TABS = ['All', 'To Pay', 'To Ship', 'To Receive', 'Completed', 'Cancelled', 'Return Refund'];

let _backendOrders = [];
let _backendOrdersLoading = false;
let _backendOrdersError = '';
let _loadedCustomerId = null;

function loadOrders() {
    return _backendOrders;
}

export async function initPurchasesPage() {
    if (!state.currentUser?.id) {
        _backendOrders = [];
        _backendOrdersLoading = false;
        _backendOrdersError = '';
        _loadedCustomerId = null;
        _rerender();
        return;
    }

    _backendOrdersLoading = true;
    _backendOrdersError = '';
    _rerender();

    try {
        _backendOrders = await fetchOrdersFromAPI(state.currentUser.id);
        _loadedCustomerId = state.currentUser.id;
    } catch (error) {
        _backendOrders = [];
        _backendOrdersError = error?.message || 'Unable to load purchases right now.';
    } finally {
        _backendOrdersLoading = false;
        _rerender();
    }
}

// Current active tab — stored in module scope so tab clicks can re-render
let _activeTab = 'All';
// Current search query
let _searchQuery = '';

export function renderPurchasesPage(data) {
    // Allow navigating directly to a specific tab: showPage('purchases', { tab: 'To Ship' })
    if (data?.tab && PURCHASE_TABS.includes(data.tab)) {
        _activeTab = data.tab;
    }
    _searchQuery = '';

    if (_loadedCustomerId !== state.currentUser?.id) {
        _backendOrders = [];
        _backendOrdersLoading = Boolean(state.currentUser?.id);
        _backendOrdersError = '';
    }

    return _buildPurchasesHtml();
}

// Called by tab button clicks (exposed to window in script.js)
export function setPurchasesTab(tab) {
    _activeTab = tab;
    _rerender();
}

// Called by the search input
export function searchPurchases(query) {
    _searchQuery = String(query || '').trim().toLowerCase();
    _rerender();
}

export async function payOrder(orderId) {
    if (!state.currentUser?.id) {
        _backendOrdersError = 'Please log in to update your purchases.';
        _rerender();
        return;
    }

    try {
        await updateOrderInAPI(state.currentUser.id, orderId, 'pay');
        await initPurchasesPage();
    } catch (error) {
        _backendOrdersError = error?.message || 'Unable to update the order.';
        _rerender();
    }
}

export async function confirmOrderReceived(orderId) {
    if (!state.currentUser?.id) {
        _backendOrdersError = 'Please log in to update your purchases.';
        _rerender();
        return;
    }

    try {
        await updateOrderInAPI(state.currentUser.id, orderId, 'confirm_received');
        await initPurchasesPage();
    } catch (error) {
        _backendOrdersError = error?.message || 'Unable to update the order.';
        _rerender();
    }
}

export async function cancelOrder(orderId) {
    if (!state.currentUser?.id) {
        _backendOrdersError = 'Please log in to update your purchases.';
        _rerender();
        return;
    }

    try {
        await updateOrderInAPI(state.currentUser.id, orderId, 'cancel');
        await initPurchasesPage();
    } catch (error) {
        _backendOrdersError = error?.message || 'Unable to update the order.';
        _rerender();
    }
}

export async function requestReturnRefund(orderId) {
    if (!state.currentUser?.id) {
        _backendOrdersError = 'Please log in to update your purchases.';
        _rerender();
        return;
    }

    try {
        await updateOrderInAPI(state.currentUser.id, orderId, 'return_refund');
        await initPurchasesPage();
    } catch (error) {
        _backendOrdersError = error?.message || 'Unable to update the order.';
        _rerender();
    }
}

function _rerender() {
    const mainContent = document.getElementById('mainContent');
    if (mainContent) {
        mainContent.innerHTML = _buildPurchasesHtml();
    }
}

function _buildPurchasesHtml() {
    if (!state.currentUser?.id) {
        return `
            <div class="purchases-page">
                <div class="container">
                    <h1 class="purchases-title">My Purchases</h1>
                    <div class="purchase-empty">
                        <div class="purchase-empty-icon">🔐</div>
                        <p>Please log in to view your purchases from the database.</p>
                        <button class="btn btn-primary" onclick="showPage('auth', { mode: 'login' })">Log In</button>
                    </div>
                </div>
            </div>
        `;
    }

    const allOrders = loadOrders();

    if (_backendOrdersLoading && allOrders.length === 0) {
        return `
            <div class="purchases-page">
                <div class="container">
                    <h1 class="purchases-title">My Purchases</h1>
                    <div class="purchase-empty">
                        <div class="purchase-empty-icon">⏳</div>
                        <p>Loading your purchases from the database...</p>
                    </div>
                </div>
            </div>
        `;
    }

    if (_backendOrdersError && allOrders.length === 0) {
        return `
            <div class="purchases-page">
                <div class="container">
                    <h1 class="purchases-title">My Purchases</h1>
                    <div class="purchase-empty">
                        <div class="purchase-empty-icon">⚠️</div>
                        <p>${_backendOrdersError}</p>
                    </div>
                </div>
            </div>
        `;
    }

    const tabFiltered = _activeTab === 'All'
        ? allOrders
        : allOrders.filter((order) => order.status === _activeTab);

    const visibleOrders = _searchQuery
        ? tabFiltered.filter((order) =>
            order.id.toLowerCase().includes(_searchQuery) ||
            order.items.some((item) => item.name.toLowerCase().includes(_searchQuery))
        )
        : tabFiltered;

    const tabsHtml = PURCHASE_TABS.map((tab) => {
        const count = tab === 'All' ? allOrders.length : allOrders.filter((o) => o.status === tab).length;
        const isActive = tab === _activeTab;
        const badgeHtml = count > 0 && tab !== 'All'
            ? `<span class="purchase-tab-badge">${count}</span>`
            : '';
        return `
            <button
                class="purchase-tab${isActive ? ' active' : ''}"
                onclick="setPurchasesTab('${tab.replace(/'/g, "&#39;")}')"
            >${tab}${badgeHtml}</button>`;
    }).join('');

    const ordersHtml = visibleOrders.length === 0
        ? `<div class="purchase-empty">
               <div class="purchase-empty-icon">📦</div>
               <p>No orders found${_searchQuery ? ' for your search' : ''}.</p>
               <button class="btn btn-primary" onclick="showPage('products')">Start Shopping</button>
           </div>`
        : visibleOrders.map((order) => _buildOrderCard(order)).join('');

    return `
        <div class="purchases-page">
            <div class="container">
                <h1 class="purchases-title">My Purchases</h1>

                <div class="purchase-tabs-bar">
                    ${tabsHtml}
                </div>

                <div class="purchase-search-wrap">
                    <span class="purchase-search-icon">🔍</span>
                    <input
                        class="purchase-search-input"
                        type="search"
                        placeholder="You can search by Order ID or Product name"
                        value="${_searchQuery}"
                        oninput="searchPurchases(this.value)"
                    />
                </div>

                <div class="purchase-order-list">
                    ${ordersHtml}
                </div>
            </div>
        </div>
    `;
}

function _buildOrderCard(order) {
    const dateLabel = new Date(order.date).toLocaleDateString('en-PH', {
        year: 'numeric', month: 'short', day: 'numeric',
    });

    const statusClass = {
        'To Pay':       'status-topay',
        'To Ship':      'status-toship',
        'To Receive':   'status-toreceive',
        'Completed':    'status-completed',
        'Cancelled':    'status-cancelled',
        'Return Refund':'status-refund',
    }[order.status] || '';

    const itemsHtml = order.items.map((item) => `
        <div class="purchase-item-row">
            <img class="purchase-item-img" src="${item.image}" alt="${item.name}" />
            <div class="purchase-item-info">
                <p class="purchase-item-name">${item.name}</p>
                <p class="purchase-item-qty">x${item.quantity}</p>
            </div>
            <p class="purchase-item-price">${formatPrice(item.price * item.quantity)}</p>
        </div>
    `).join('');

    const paymentSummary = order.status === 'To Pay'
        ? 'Payment: Waiting for checkout'
        : `Payment: ${order.paymentMethod || 'Card'}`;

    let actionsHtml = '';
    if (order.status === 'To Pay') {
        actionsHtml = `
            <button class="btn btn-primary purchase-action-btn" onclick="payOrder('${order.id}')">Pay Now</button>
            <button class="btn btn-outline purchase-action-btn" onclick="cancelOrder('${order.id}')">Cancel Order</button>
        `;
    } else if (order.status === 'To Ship') {
        actionsHtml = `
            <div class="purchase-status-note">Only the seller or admin should move this order to the shipping stages.</div>
        `;
    } else if (order.status === 'To Receive') {
        actionsHtml = `
            <button class="btn btn-primary purchase-action-btn" onclick="confirmOrderReceived('${order.id}')">Order Received</button>
        `;
    } else if (order.status === 'Completed') {
        actionsHtml = `
            <button class="btn btn-outline purchase-action-btn" onclick="requestReturnRefund('${order.id}')">Return / Refund</button>
        `;
    }

    return `
        <div class="purchase-order-card">
            <div class="purchase-order-header">
                <div class="purchase-order-meta">
                    <span class="purchase-order-id">Order #${order.id}</span>
                    <span class="purchase-order-date">${dateLabel}</span>
                </div>
                <span class="purchase-order-status ${statusClass}">${order.status}</span>
            </div>
            <div class="purchase-order-submeta">
                <span>${paymentSummary}</span>
            </div>
            <div class="purchase-items">
                ${itemsHtml}
            </div>
            <div class="purchase-order-footer">
                <div class="purchase-order-total">
                    Order Total: <strong>${formatPrice(order.total)}</strong>
                </div>
                <div class="purchase-order-actions">
                    ${actionsHtml}
                </div>
            </div>
        </div>
    `;
}
