const PESO_FORMATTER = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

export function formatPrice(price) {
    const numericValue = Number(price) || 0;
    return PESO_FORMATTER.format(numericValue);
}

export function escapeHtml(text) {
    const value = String(text ?? '');
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function passwordMeetsPolicy(password) {
    return /^(?=.*[A-Za-z])(?=.*[^A-Za-z0-9]).{8,}$/.test(password);
}

export function normalizeCardNumber(cardNumber) {
    return String(cardNumber || '').replace(/\D/g, '');
}

export function passesLuhn(cardNumber) {
    const normalized = normalizeCardNumber(cardNumber);

    if (normalized.length < 13 || normalized.length > 19) {
        return false;
    }

    let sum = 0;
    let shouldDouble = false;

    for (let index = normalized.length - 1; index >= 0; index -= 1) {
        let digit = Number(normalized[index]);

        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }

        sum += digit;
        shouldDouble = !shouldDouble;
    }

    return sum % 10 === 0;
}
