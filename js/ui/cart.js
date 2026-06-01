import { persistCurrentCart, state } from "../state.js";
import { formatPrice } from "../utils.js";
import { showPage } from "../router.js";
import { CHECKOUT_CONFIG } from "../config.js";

const CART_FEEDBACK_TOAST_ID = "cartFeedbackToast";

let cartFeedbackTimerId = null;

function showCartFeedback(message) {
  if (!document.body) {
    return;
  }

  let toast = document.getElementById(CART_FEEDBACK_TOAST_ID);
  if (!toast) {
    toast = document.createElement("div");
    toast.id = CART_FEEDBACK_TOAST_ID;
    toast.className = "cart-feedback-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.remove("is-visible");
  void toast.offsetWidth;
  toast.classList.add("is-visible");

  if (cartFeedbackTimerId) {
    clearTimeout(cartFeedbackTimerId);
  }

  cartFeedbackTimerId = window.setTimeout(() => {
    const currentToast = document.getElementById(CART_FEEDBACK_TOAST_ID);
    currentToast?.classList.remove("is-visible");
  }, 1800);
}

export function updateCartBadge() {
  const badge = document.getElementById("cartBadge");
  if (!badge) {
    return;
  }

  const count = (state.cart || []).reduce(
    (sum, item) => sum + (Number(item?.quantity) || 0),
    0,
  );

  badge.textContent = String(count);
}

export function addToCart(productId) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) {
    return;
  }

  const availableStock = Math.max(0, Number(product.stock) || 0);
  if (availableStock <= 0) {
    showCartFeedback("This item is out of stock.");
    return;
  }

  const existingItem = state.cart.find((item) => item.productId === productId);
  const currentQuantity = Number(existingItem?.quantity) || 0;

  if (currentQuantity >= availableStock) {
    showCartFeedback(
      `Only ${availableStock} item${availableStock === 1 ? "" : "s"} available.`,
    );
    return;
  }

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    state.cart.push({ productId, quantity: 1 });
  }

  persistCurrentCart();
  updateCartBadge();
  showCartFeedback("Product added to cart.");
}

export function removeFromCart(productId) {
  state.cart = state.cart.filter((item) => item.productId !== productId);
  persistCurrentCart();
  updateCartBadge();
  showPage("cart");
}

export function updateQuantity(productId, change) {
  const item = state.cart.find((entry) => entry.productId === productId);
  if (!item) {
    return;
  }

  if (change > 0) {
    const product = state.products.find((entry) => entry.id === productId);
    const availableStock = Math.max(0, Number(product?.stock) || 0);
    if (item.quantity >= availableStock) {
      showCartFeedback(
        `Only ${availableStock} item${availableStock === 1 ? "" : "s"} available.`,
      );
      return;
    }
  }

  item.quantity += change;
  if (item.quantity <= 0) {
    removeFromCart(productId);
    return;
  }

  persistCurrentCart();
  showPage("cart");
}

export function getCartItems() {
  return state.cart.map((item) => ({
    ...item,
    product: state.products.find((p) => p.id === item.productId),
  }));
}

export function getCartTotal() {
  const items = getCartItems();
  return items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );
}

export function renderCartPage() {
  const items = getCartItems();

  if (items.length === 0) {
    return `
            <div class="empty-state">
                <div class="empty-state-icon">🛒</div>
                <h2>Your cart is empty</h2>
                <p>Add some products to get started!</p>
                <button class="btn btn-primary" onclick="showPage('products')">Continue Shopping</button>
            </div>
        `;
  }

  const totalWithVat = getCartTotal();
  const shipping =
    totalWithVat > CHECKOUT_CONFIG.freeShippingThreshold
      ? 0
      : CHECKOUT_CONFIG.shippingFee;

  // Reverse-calculate subtotal (ex-VAT) and VAT amount
  const subtotal =
    Math.round((totalWithVat / (1 + CHECKOUT_CONFIG.vatRate)) * 100) / 100;
  const vat = Math.round((totalWithVat - subtotal) * 100) / 100;
  const total = Math.round((totalWithVat + shipping) * 100) / 100;
  const vatPercentLabel = Math.round(CHECKOUT_CONFIG.vatRate * 100);

  return `
        <div class="container section">
            <h1 class="section-title">Shopping Cart</h1>
            <div class="grid-2">
                <div>
                    ${items
                      .map(
                        (item) => `
                        <div class="cart-item">
                            <img src="${item.product.image}" alt="${item.product.name}" class="cart-item-image">
                            <div class="cart-item-info">
                                <h3>${item.product.name}</h3>
                                <p style="color: #6b7280; font-size: 0.875rem; margin-bottom: 0.75rem;">${item.product.category}</p>
                                <div style="display: flex; gap: 1rem; align-items: center;">
                                    <div class="quantity-controls">
                                        <button onclick="updateQuantity('${item.productId}', -1)">−</button>
                                        <span>${item.quantity}</span>
                                        <button onclick="updateQuantity('${item.productId}', 1)">+</button>
                                    </div>
                                    <button class="btn" style="color: #ef4444;" onclick="removeFromCart('${item.productId}')">
                                        Remove
                                    </button>
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <p style="font-weight: 600; font-size: 1.125rem;">${formatPrice(item.product.price * item.quantity)}</p>
                                <p style="color: #6b7280; font-size: 0.875rem;">${formatPrice(item.product.price)} each</p>
                            </div>
                        </div>
                    `,
                      )
                      .join("")}
                </div>
                <div class="order-summary">
                    <h2 style="margin-bottom: 1.5rem;">Order Summary</h2>
                    <div class="summary-row">
                        <span>Subtotal</span>
                        <span>${formatPrice(subtotal)}</span>
                    </div>
                    <div class="summary-row">
                        <span>Shipping</span>
                        <span>${shipping === 0 ? "FREE" : formatPrice(shipping)}</span>
                    </div>
                    <div class="summary-row">
                      <span>VAT (${vatPercentLabel}%)</span>
                      <span>${formatPrice(vat)}</span>
                    </div>
                    <div class="summary-total">
                        <span>Total</span>
                        <span>${formatPrice(total)}</span>
                    </div>
                    ${
                      totalWithVat < CHECKOUT_CONFIG.freeShippingThreshold
                        ? `
                      <div style="background: #dbeafe; color: #1e40af; padding: 0.75rem; border-radius: 0.375rem; font-size: 0.875rem; margin: 1rem 0;">
                        Add ${formatPrice(CHECKOUT_CONFIG.freeShippingThreshold - totalWithVat)} more for free shipping!
                      </div>
                    `
                        : ""
                    }
                    <button class="btn btn-primary" style="width: 100%; margin-top: 1rem;" onclick="showPage('checkout')">
                        Proceed to Checkout
                    </button>
                    <button class="btn btn-outline" style="width: 100%; margin-top: 0.5rem;" onclick="showPage('products')">
                        Continue Shopping
                    </button>
                </div>
            </div>
        </div>
    `;
}
