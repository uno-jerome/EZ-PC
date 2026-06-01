import {
  persistCurrentCart,
  readProfileExtraFromStorage,
  state,
  writeProfileExtraToStorage,
} from "../state.js";
import { escapeHtml, formatPrice, passesLuhn } from "../utils.js";
import { initPhilippinesAddressPicker } from "../address.js";
import { getCartItems, getCartTotal, updateCartBadge } from "./cart.js";
import { CHECKOUT_CONFIG } from "../config.js";
import { createOrderInAPI, fetchProductsFromAPI } from "../api.js";
import { showPage } from "../router.js";

const PAYMENT_METHOD_CARD = "card";
const PAYMENT_METHOD_COD = "cash_on_delivery";

let pendingCartCleanupPlan = null;

function runLuhnSelfTest() {
  console.assert(
    passesLuhn("4242 4242 4242 4242") === true,
    "Luhn test should pass for 4242 4242 4242 4242",
  );
  console.assert(
    passesLuhn("4242 4242 4242 4241") === false,
    "Luhn test should fail for 4242 4242 4242 4241",
  );
}

export function initCheckoutPage() {
  runLuhnSelfTest();
  const savedShippingDetails = getSavedShippingDetails();
  initPhilippinesAddressPicker(savedShippingDetails);
  toggleCheckoutPaymentMethod(
    savedShippingDetails.preferredPaymentMethod || PAYMENT_METHOD_CARD,
  );
}

function splitNameParts(fullName) {
  const nameParts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return {
    firstName: nameParts[0] || "",
    lastName: nameParts.slice(1).join(" "),
  };
}

function getSavedShippingDetails() {
  const profileExtra = readProfileExtraFromStorage(state.currentUser);
  const shipping =
    profileExtra.shipping && typeof profileExtra.shipping === "object"
      ? profileExtra.shipping
      : {};

  const nameParts = splitNameParts(
    shipping.fullName || state.currentUser?.name || "",
  );

  return {
    firstName: shipping.firstName || nameParts.firstName,
    lastName: shipping.lastName || nameParts.lastName,
    email: shipping.email || state.currentUser?.email || "",
    phone: shipping.phone || profileExtra.phone || "",
    addressLine: shipping.addressLine || "",
    provinceCode: shipping.provinceCode || "",
    cityMunicipalityCode: shipping.cityMunicipalityCode || "",
    barangayCode: shipping.barangayCode || "",
    preferredPaymentMethod:
      shipping.preferredPaymentMethod || PAYMENT_METHOD_CARD,
  };
}

function getPaymentMethodLabel(paymentMethod) {
  return paymentMethod === PAYMENT_METHOD_COD ? "Cash on Delivery" : "Card";
}

function getSelectedOptionLabel(selectElement) {
  if (!selectElement || selectElement.selectedIndex < 0) {
    return "";
  }

  return String(
    selectElement.options[selectElement.selectedIndex]?.text || "",
  ).trim();
}

function saveShippingDetails(form, paymentMethod) {
  const profileExtra = readProfileExtraFromStorage(state.currentUser);
  const firstName = String(form.elements.firstName?.value || "").trim();
  const lastName = String(form.elements.lastName?.value || "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const phone = String(form.elements.phone?.value || "").trim();
  const email = String(form.elements.email?.value || "").trim();
  const provinceSelect = form.elements.provinceCode;
  const cityMunicipalitySelect = form.elements.cityMunicipalityCode;
  const barangaySelect = form.elements.barangayCode;

  profileExtra.phone = phone || profileExtra.phone || "";
  profileExtra.shipping = {
    fullName,
    firstName,
    lastName,
    email,
    phone,
    addressLine: String(form.elements.addressLine?.value || "").trim(),
    provinceCode: String(provinceSelect?.value || "").trim(),
    provinceLabel: getSelectedOptionLabel(provinceSelect),
    cityMunicipalityCode: String(cityMunicipalitySelect?.value || "").trim(),
    cityMunicipalityLabel: getSelectedOptionLabel(cityMunicipalitySelect),
    barangayCode: String(barangaySelect?.value || "").trim(),
    barangayLabel: getSelectedOptionLabel(barangaySelect),
    preferredPaymentMethod: paymentMethod,
  };

  writeProfileExtraToStorage(state.currentUser, profileExtra);
}

function buildShippingSummary(form) {
  const provinceSelect = form.elements.provinceCode;
  const cityMunicipalitySelect = form.elements.cityMunicipalityCode;
  const barangaySelect = form.elements.barangayCode;

  return {
    fullName: [
      String(form.elements.firstName?.value || "").trim(),
      String(form.elements.lastName?.value || "").trim(),
    ]
      .filter(Boolean)
      .join(" "),
    email: String(form.elements.email?.value || "").trim(),
    phone: String(form.elements.phone?.value || "").trim(),
    addressLine: String(form.elements.addressLine?.value || "").trim(),
    province: getSelectedOptionLabel(provinceSelect),
    cityMunicipality: getSelectedOptionLabel(cityMunicipalitySelect),
    barangay: getSelectedOptionLabel(barangaySelect),
  };
}

function buildCartCleanupPlan(latestCartItems) {
  return latestCartItems.reduce((cleanedCart, item) => {
    const availableStock = Math.max(0, Number(item.product?.stock) || 0);

    if (!item.product || availableStock <= 0) {
      return cleanedCart;
    }

    cleanedCart.push({
      productId: item.productId,
      quantity: Math.min(item.quantity, availableStock),
    });

    return cleanedCart;
  }, []);
}

async function validateCartAgainstLatestStock() {
  pendingCartCleanupPlan = null;
  await fetchProductsFromAPI();

  if (state.productLoadError) {
    return {
      ok: false,
      title: "Could not refresh stock",
      message:
        "Unable to refresh the latest stock right now. Please try again.",
      details: [],
      items: [],
    };
  }

  const latestCartItems = getCartItems();
  if (latestCartItems.length === 0) {
    return {
      ok: false,
      title: "Cart check failed",
      message: "Your cart is empty.",
      details: [],
      items: [],
    };
  }

  const unavailableItems = latestCartItems.filter((item) => !item.product);
  if (unavailableItems.length > 0) {
    return {
      ok: false,
      title: "Some items changed",
      message: "Please review these items before placing the order.",
      details: unavailableItems.map(
        (item) => `${item.productId}: no longer available in the catalog.`,
      ),
      items: [],
    };
  }

  const stockIssues = [];
  const cleanupPlan = buildCartCleanupPlan(latestCartItems);

  for (const item of latestCartItems) {
    const availableStock = Math.max(0, Number(item.product?.stock) || 0);

    if (availableStock <= 0) {
      stockIssues.push(`${item.product.name}: now out of stock.`);
      continue;
    }

    if (item.quantity > availableStock) {
      stockIssues.push(
        `${item.product.name}: cart has ${item.quantity}, but only ${availableStock} available now.`,
      );
    }
  }

  if (stockIssues.length > 0) {
    pendingCartCleanupPlan = cleanupPlan;
    return {
      ok: false,
      title: "Stock changed before checkout",
      message: "Please update your cart for these items:",
      details: stockIssues,
      actionLabel: "Clean Up Cart Automatically",
      items: [],
    };
  }

  return {
    ok: true,
    title: "",
    message: "",
    details: [],
    items: latestCartItems,
  };
}

export function renderCheckoutPage() {
  const items = getCartItems();
  const subtotal = getCartTotal();
  const shipping =
    subtotal > CHECKOUT_CONFIG.freeShippingThreshold
      ? 0
      : CHECKOUT_CONFIG.shippingFee;
  const tax = subtotal * CHECKOUT_CONFIG.taxRate;
  const total = subtotal + shipping + tax;
  const taxPercentLabel = Math.round(CHECKOUT_CONFIG.taxRate * 100);
  const savedShippingDetails = getSavedShippingDetails();
  const paymentMethod =
    savedShippingDetails.preferredPaymentMethod === PAYMENT_METHOD_COD
      ? PAYMENT_METHOD_COD
      : PAYMENT_METHOD_CARD;

  return `
        <div class="container section">
            <h1 class="section-title">Checkout</h1>
            <div class="grid-2">
                <div>
                    <form class="checkout-form" onsubmit="handleCheckout(event)">
                        <div class="checkout-panel">
                            <div class="checkout-panel-header">
                                <h2>Shipping Information</h2>
                                <p>These details are saved to the current account for your next checkout.</p>
                            </div>
                            <div class="checkout-fields-grid">
                                <input name="firstName" type="text" placeholder="First Name" value="${escapeHtml(savedShippingDetails.firstName)}" required class="checkout-input">
                                <input name="lastName" type="text" placeholder="Last Name" value="${escapeHtml(savedShippingDetails.lastName)}" required class="checkout-input">
                                <input name="email" type="email" placeholder="Email" value="${escapeHtml(savedShippingDetails.email)}" required class="checkout-input checkout-input-full">
                                <input name="phone" type="tel" placeholder="Phone Number" value="${escapeHtml(savedShippingDetails.phone)}" required class="checkout-input checkout-input-full">
                                <div id="shippingMessage" class="hidden checkout-inline-message" role="alert"></div>
                                <select id="shippingProvince" name="provinceCode" required class="checkout-input checkout-select"></select>
                                <select id="shippingCityMunicipality" name="cityMunicipalityCode" required class="checkout-input checkout-select"></select>
                                <select id="shippingBarangay" name="barangayCode" required class="checkout-input checkout-input-full checkout-select"></select>
                                <input type="text" name="addressLine" placeholder="House No. and Street" value="${escapeHtml(savedShippingDetails.addressLine)}" required class="checkout-input checkout-input-full">
                                <input type="text" placeholder="Country" value="Philippines" readonly class="checkout-input checkout-input-muted">
                            </div>
                        </div>
                        <div class="checkout-panel">
                            <div class="checkout-panel-header">
                                <h2>Payment Method</h2>
                                <p>Choose how you want to place this school-project order. Both options save it to <strong>My Purchases</strong> under <strong>To Ship</strong>.</p>
                            </div>
                            <div class="checkout-payment-methods">
                                <label class="checkout-payment-option${paymentMethod === PAYMENT_METHOD_CARD ? " active" : ""}">
                                    <input type="radio" name="paymentMethod" value="${PAYMENT_METHOD_CARD}" ${paymentMethod === PAYMENT_METHOD_CARD ? "checked" : ""} onchange="toggleCheckoutPaymentMethod(this.value)">
                                    <span class="checkout-payment-copy">
                                        <strong>Card Payment</strong>
                                        <small>Use a test card number to place the order.</small>
                                    </span>
                                </label>
                                <label class="checkout-payment-option${paymentMethod === PAYMENT_METHOD_COD ? " active" : ""}">
                                    <input type="radio" name="paymentMethod" value="${PAYMENT_METHOD_COD}" ${paymentMethod === PAYMENT_METHOD_COD ? "checked" : ""} onchange="toggleCheckoutPaymentMethod(this.value)">
                                    <span class="checkout-payment-copy">
                                        <strong>Cash on Delivery</strong>
                                        <small>Place the order now and pay when it arrives.</small>
                                    </span>
                                </label>
                            </div>
                            <div id="checkoutCardFields" class="checkout-card-fields${paymentMethod === PAYMENT_METHOD_CARD ? "" : " hidden"}">
                                <input data-card-field type="text" name="cardholderName" placeholder="Cardholder Name" class="checkout-input" ${paymentMethod === PAYMENT_METHOD_CARD ? "required" : ""}>
                                <input data-card-field id="checkoutCardNumber" type="text" name="cardNumber" placeholder="Card Number" inputmode="numeric" autocomplete="cc-number" ${paymentMethod === PAYMENT_METHOD_CARD ? "required" : ""} oninput="clearCheckoutError()" class="checkout-input">
                                <div class="checkout-fields-grid checkout-fields-grid-tight">
                                    <input data-card-field type="text" name="cardExpiry" placeholder="MM/YY" autocomplete="cc-exp" ${paymentMethod === PAYMENT_METHOD_CARD ? "required" : ""} class="checkout-input">
                                    <input data-card-field type="text" name="cardCvv" placeholder="CVV" autocomplete="cc-csc" ${paymentMethod === PAYMENT_METHOD_CARD ? "required" : ""} class="checkout-input">
                                </div>
                            </div>
                            <div id="checkoutMessage" class="hidden checkout-inline-message" role="alert"></div>
                            <p class="checkout-security-note">For this school project, card details stay in the browser and are not sent to a real payment service.</p>
                        </div>
                        <button type="submit" class="btn btn-primary checkout-submit-btn">
                            Complete Order • ${formatPrice(total)}
                        </button>
                    </form>
                </div>
                <div class="order-summary">
                    <h2 class="checkout-summary-title">Order Summary</h2>
                    <div class="checkout-summary-items">
                        ${items
                          .map(
                            (item) => `
                            <div class="checkout-summary-item">
                                <img src="${item.product.image}" alt="${item.product.name}" class="checkout-summary-item-image">
                                <div class="checkout-summary-item-copy">
                                    <p class="checkout-summary-item-name">${item.product.name}</p>
                                    <p class="checkout-summary-item-qty">Qty: ${item.quantity}</p>
                                </div>
                                <p class="checkout-summary-item-price">${formatPrice(item.product.price * item.quantity)}</p>
                            </div>
                        `,
                          )
                          .join("")}
                    </div>
                    <div class="checkout-summary-breakdown">
                        <div class="summary-row">
                            <span>Subtotal</span>
                            <span>${formatPrice(subtotal)}</span>
                        </div>
                        <div class="summary-row">
                            <span>Shipping</span>
                            <span>${shipping === 0 ? "FREE" : formatPrice(shipping)}</span>
                        </div>
                        <div class="summary-row">
                            <span>Tax (${taxPercentLabel}%)</span>
                            <span>${formatPrice(tax)}</span>
                        </div>
                        <div class="summary-total">
                            <span>Total</span>
                            <span>${formatPrice(total)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

export async function handleCheckout(event) {
  event.preventDefault();

  const form = event.currentTarget;
  if (
    form &&
    typeof form.checkValidity === "function" &&
    !form.checkValidity()
  ) {
    if (typeof form.reportValidity === "function") {
      form.reportValidity();
    }
    return;
  }

  const paymentMethod = String(
    new FormData(form).get("paymentMethod") || PAYMENT_METHOD_CARD,
  );
  const cardNumberInput = form.querySelector('input[name="cardNumber"]');
  const cardNumber = cardNumberInput ? cardNumberInput.value : "";
  const checkoutMessage = document.getElementById("checkoutMessage");

  const showCheckoutError = (
    message,
    details = [],
    title = "",
    actionLabel = "",
  ) => {
    if (!checkoutMessage) {
      console.warn(message);
      return;
    }

    const safeTitle = String(title || "").trim();
    if (details.length > 0) {
      const safeItems = details
        .map((detail) => `<li>${escapeHtml(detail)}</li>`)
        .join("");
      const actionMarkup = actionLabel
        ? `<div class="checkout-message-actions"><button type="button" class="btn btn-outline" onclick="cleanupCheckoutCart()">${escapeHtml(actionLabel)}</button></div>`
        : "";
      checkoutMessage.innerHTML = `${safeTitle ? `<strong>${escapeHtml(safeTitle)}</strong>` : ""}<div>${escapeHtml(message)}</div><ul class="checkout-message-list">${safeItems}</ul>${actionMarkup}`;
    } else {
      checkoutMessage.textContent = message;
    }
    checkoutMessage.classList.remove("hidden");
  };

  const hideCheckoutError = () => {
    if (!checkoutMessage) {
      return;
    }

    checkoutMessage.textContent = "";
    checkoutMessage.innerHTML = "";
    checkoutMessage.classList.add("hidden");

    if (cardNumberInput) {
      cardNumberInput.style.borderColor = "#d1d5db";
      cardNumberInput.style.boxShadow = "none";
      cardNumberInput.removeAttribute("aria-invalid");
    }
  };

  const markCheckoutCardInvalid = () => {
    if (!cardNumberInput) {
      return;
    }

    cardNumberInput.style.borderColor = "#dc2626";
    cardNumberInput.style.boxShadow = "0 0 0 1px #dc2626";
    cardNumberInput.setAttribute("aria-invalid", "true");
  };

  if (paymentMethod === PAYMENT_METHOD_CARD && !passesLuhn(cardNumber)) {
    showCheckoutError("Please enter a valid card number.");
    markCheckoutCardInvalid();
    if (cardNumberInput) {
      cardNumberInput.focus();
    }
    return;
  }

  hideCheckoutError();

  if (!state.currentUser?.id) {
    showCheckoutError("Please log in before placing an order.");
    return;
  }

  const latestCartCheck = await validateCartAgainstLatestStock();
  if (!latestCartCheck.ok) {
    showCheckoutError(
      latestCartCheck.message,
      latestCartCheck.details,
      latestCartCheck.title,
      latestCartCheck.actionLabel || "",
    );
    return;
  }

  saveShippingDetails(form, paymentMethod);

  // Snapshot the cart items before clearing so we can save the order
  const orderedItems = latestCartCheck.items.map((item) => ({
    productId: item.product.id,
    name: item.product.name,
    image: item.product.image,
    price: item.product.price,
    quantity: item.quantity,
  }));

  const subtotal = orderedItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const shipping =
    subtotal > CHECKOUT_CONFIG.freeShippingThreshold
      ? 0
      : CHECKOUT_CONFIG.shippingFee;
  const tax = subtotal * CHECKOUT_CONFIG.taxRate;
  const total = subtotal + shipping + tax;

  const shippingSummary = buildShippingSummary(form);

  let createdOrder = null;
  try {
    createdOrder = await createOrderInAPI({
      customerId: state.currentUser.id,
      paymentMethod,
      phone: shippingSummary.phone,
      addressLine: shippingSummary.addressLine,
      barangay: shippingSummary.barangay,
      cityMunicipality: shippingSummary.cityMunicipality,
      province: shippingSummary.province,
      country: "Philippines",
      items: orderedItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    });
  } catch (error) {
    showCheckoutError(
      error?.message || "Unable to place your order right now.",
    );
    return;
  }

  state.cart = [];
  persistCurrentCart();
  updateCartBadge();

  const mainContent = document.getElementById("mainContent");
  if (!mainContent) {
    return;
  }

  mainContent.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">✓</div>
            <h2>Order Placed!</h2>
            <p>Your order was placed with <strong>${getPaymentMethodLabel(paymentMethod)}</strong> and saved to <strong>My Purchases</strong> under <strong>To Ship</strong>.</p>
            <p style="color: #6b7280; font-size: 0.875rem;">Order #: ${escapeHtml(createdOrder?.id || "")}</p>
            <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
                <button class="btn btn-primary" onclick="showPage('purchases', { tab: 'To Ship' })">Go to My Purchases</button>
                <button class="btn btn-outline" onclick="showPage('home')">Continue Shopping</button>
            </div>
        </div>
    `;
}

export function toggleCheckoutPaymentMethod(paymentMethod) {
  const safePaymentMethod =
    paymentMethod === PAYMENT_METHOD_COD
      ? PAYMENT_METHOD_COD
      : PAYMENT_METHOD_CARD;
  const cardFields = document.getElementById("checkoutCardFields");
  const paymentOptions = Array.from(
    document.querySelectorAll(".checkout-payment-option"),
  );
  const cardInputs = Array.from(document.querySelectorAll("[data-card-field]"));

  paymentOptions.forEach((option) => {
    const radio = option.querySelector('input[name="paymentMethod"]');
    option.classList.toggle("active", radio?.value === safePaymentMethod);
  });

  if (cardFields) {
    cardFields.classList.toggle(
      "hidden",
      safePaymentMethod !== PAYMENT_METHOD_CARD,
    );
  }

  cardInputs.forEach((input) => {
    input.disabled = safePaymentMethod !== PAYMENT_METHOD_CARD;
    if (safePaymentMethod === PAYMENT_METHOD_CARD) {
      input.setAttribute("required", "required");
    } else {
      input.removeAttribute("required");
      if (input instanceof HTMLInputElement) {
        input.setCustomValidity("");
      }
    }
  });

  if (safePaymentMethod !== PAYMENT_METHOD_CARD) {
    clearCheckoutError();
  }
}

export function cleanupCheckoutCart() {
  if (!Array.isArray(pendingCartCleanupPlan)) {
    return;
  }

  state.cart = pendingCartCleanupPlan.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
  }));
  pendingCartCleanupPlan = null;
  persistCurrentCart();
  updateCartBadge();
  showPage("cart");
}

export function clearCheckoutError() {
  const checkoutMessage = document.getElementById("checkoutMessage");
  const cardNumberInput = document.getElementById("checkoutCardNumber");

  if (checkoutMessage) {
    checkoutMessage.textContent = "";
    checkoutMessage.innerHTML = "";
    checkoutMessage.classList.add("hidden");
  }

  if (cardNumberInput) {
    cardNumberInput.style.borderColor = "#d1d5db";
    cardNumberInput.style.boxShadow = "none";
    cardNumberInput.removeAttribute("aria-invalid");
  }
}
