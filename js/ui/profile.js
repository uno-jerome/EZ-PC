import { readProfileExtraFromStorage, state, writeProfileExtraToStorage } from '../state.js';

// ── Helpers for profile extra data ───────────────────────────────────────────
// We store extra fields (phone, gender, dob, avatar) in localStorage under
// "profile_extra" because the current backend only stores name/username/email.

function loadProfileExtra() {
    return readProfileExtraFromStorage(state.currentUser);
}

function saveProfileExtra(data) {
    writeProfileExtraToStorage(state.currentUser, data);
}

// Mask a string: show only the last N chars, replace the rest with *
function maskMiddle(value, visibleEnd = 2) {
    if (!value || value.length <= visibleEnd) return value;
    const stars = '*'.repeat(Math.max(value.length - visibleEnd, 4));
    return stars + value.slice(-visibleEnd);
}

// Mask email: show first char + *** + last 2 chars of local part + @domain
function maskEmail(email) {
    if (!email) return '';
    const [local, domain] = email.split('@');
    if (!domain) return maskMiddle(email);
    const masked = local[0] + '*'.repeat(Math.max(local.length - 1, 3));
    return `${masked}@${domain}`;
}

// Mask phone: show only last 2 digits
function maskPhone(phone) {
    if (!phone) return '';
    return '*'.repeat(Math.max(phone.length - 2, 6)) + phone.slice(-2);
}

// Mask date of birth: show only the year (as **/**, the month/day hidden)
function maskDob(dob) {
    if (!dob) return '';
    const parts = dob.split('-'); // expected YYYY-MM-DD
    if (parts.length === 3) return `**/**/${parts[0]}`;
    return dob;
}

// ── Render ────────────────────────────────────────────────────────────────────

export function renderProfilePage() {
    if (!state.currentUser) {
        return `
            <div class="container section">
                <div class="empty-state">
                    <div class="empty-state-icon">👤</div>
                    <h2>You're not logged in</h2>
                    <p>Please log in to view and edit your profile.</p>
                    <button class="btn btn-primary" onclick="showPage('auth', { mode: 'login' })">Log In</button>
                </div>
            </div>
        `;
    }

    const user = state.currentUser;
    const extra = loadProfileExtra();
    const avatarSrc = extra.avatar || '';

    return `
        <div class="container section">
            <div class="myprofile-shell">
                <!-- Left: form -->
                <div class="myprofile-form-col">
                    <h1 class="myprofile-title">My Profile</h1>
                    <p class="myprofile-sub">Manage and protect your account</p>
                    <hr class="myprofile-divider" />

                    <div id="profileSaveMsg" class="profile-save-msg hidden"></div>

                    <div class="myprofile-field">
                        <label class="myprofile-label">Username</label>
                        <span class="myprofile-value">${user.username || user.name || '—'}</span>
                    </div>

                    <div class="myprofile-field">
                        <label class="myprofile-label" for="profileName">Name</label>
                        <input
                            id="profileName"
                            class="myprofile-input"
                            type="text"
                            value="${user.name || ''}"
                            placeholder="Your full name"
                            maxlength="80"
                        />
                    </div>

                    <div class="myprofile-field">
                        <label class="myprofile-label">Email</label>
                        <span class="myprofile-value">
                            ${maskEmail(user.email)}
                            <button class="myprofile-change-btn" onclick="toggleProfileField('emailField')">Change</button>
                        </span>
                        <div id="emailField" class="myprofile-inline-field hidden">
                            <input id="profileEmail" class="myprofile-input" type="email" placeholder="New email address" />
                        </div>
                    </div>

                    <div class="myprofile-field">
                        <label class="myprofile-label">Phone Number</label>
                        <span class="myprofile-value">
                            ${extra.phone ? maskPhone(extra.phone) : '<span class="myprofile-placeholder">Add a phone number</span>'}
                            <button class="myprofile-change-btn" onclick="toggleProfileField('phoneField')">Change</button>
                        </span>
                        <div id="phoneField" class="myprofile-inline-field hidden">
                            <input id="profilePhone" class="myprofile-input" type="tel" value="${extra.phone || ''}" placeholder="+63 912 345 6789" maxlength="20" />
                        </div>
                    </div>

                    <div class="myprofile-field">
                        <label class="myprofile-label">
                            Gender
                            <span class="myprofile-hint" title="This is used only for personalisation.">ⓘ</span>
                        </label>
                        <select id="profileGender" class="myprofile-select">
                            <option value="" ${!extra.gender ? 'selected' : ''}>Prefer not to say</option>
                            <option value="Male" ${extra.gender === 'Male' ? 'selected' : ''}>Male</option>
                            <option value="Female" ${extra.gender === 'Female' ? 'selected' : ''}>Female</option>
                            <option value="Non-binary" ${extra.gender === 'Non-binary' ? 'selected' : ''}>Non-binary</option>
                        </select>
                    </div>

                    <div class="myprofile-field">
                        <label class="myprofile-label">
                            Date of Birth
                            <span class="myprofile-hint" title="Your birthday is kept private.">ⓘ</span>
                        </label>
                        <span class="myprofile-value">
                            ${extra.dob ? maskDob(extra.dob) : '<span class="myprofile-placeholder">Not set</span>'}
                            <button class="myprofile-change-btn" onclick="toggleProfileField('dobField')">Change</button>
                        </span>
                        <div id="dobField" class="myprofile-inline-field hidden">
                            <input id="profileDob" class="myprofile-input" type="date" value="${extra.dob || ''}" />
                        </div>
                    </div>

                    <div class="myprofile-field myprofile-save-row">
                        <button class="btn btn-profile-save" onclick="saveProfile()">Save</button>
                    </div>
                </div>

                <!-- Right: avatar -->
                <div class="myprofile-avatar-col">
                    <div class="myprofile-avatar-wrap">
                        ${avatarSrc
                            ? `<img id="profileAvatarPreview" class="myprofile-avatar-img" src="${avatarSrc}" alt="Profile photo" />`
                            : `<div id="profileAvatarPreview" class="myprofile-avatar-placeholder">
                                   <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                       <circle cx="24" cy="18" r="9" fill="#d1d5db"/>
                                       <path d="M6 42c0-9.941 8.059-18 18-18s18 8.059 18 18" stroke="#d1d5db" stroke-width="3" fill="none"/>
                                   </svg>
                               </div>`
                        }
                    </div>
                    <label class="myprofile-select-img-btn">
                        Select Image
                        <input type="file" accept="image/jpeg,image/png" style="display:none" onchange="handleAvatarChange(event)" />
                    </label>
                    <p class="myprofile-img-hint">File size: maximum 1 MB</p>
                    <p class="myprofile-img-hint">File extension: .JPEG, .PNG</p>
                </div>
            </div>
        </div>
    `;
}

// ── Actions (exposed to window in script.js) ──────────────────────────────────

export function toggleProfileField(fieldId) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.classList.toggle('hidden');
    }
}

export function saveProfile() {
    if (!state.currentUser) return;

    const nameInput = document.getElementById('profileName');
    const emailInput = document.getElementById('profileEmail');
    const phoneInput = document.getElementById('profilePhone');
    const genderSelect = document.getElementById('profileGender');
    const dobInput = document.getElementById('profileDob');
    const msgBox = document.getElementById('profileSaveMsg');

    const showMsg = (text, isError = false) => {
        if (!msgBox) return;
        msgBox.textContent = text;
        msgBox.className = `profile-save-msg ${isError ? 'error' : 'success'}`;
    };

    // Update name on the user state
    if (nameInput && nameInput.value.trim()) {
        state.currentUser.name = nameInput.value.trim();
        try {
            localStorage.setItem('user', JSON.stringify(state.currentUser));
        } catch { /* ignore */ }
    }

    // Update email if the field was opened and filled
    if (emailInput && emailInput.value.trim()) {
        state.currentUser.email = emailInput.value.trim();
        try {
            localStorage.setItem('user', JSON.stringify(state.currentUser));
        } catch { /* ignore */ }
    }

    // Save extra fields
    const extra = loadProfileExtra();
    if (phoneInput && phoneInput.value.trim()) extra.phone = phoneInput.value.trim();
    if (genderSelect) extra.gender = genderSelect.value;
    if (dobInput && dobInput.value) extra.dob = dobInput.value;
    saveProfileExtra(extra);

    // Refresh the profile button name in the header
    const profileButtonLabel = document.getElementById('profileButtonLabel');
    if (profileButtonLabel) {
        profileButtonLabel.textContent = state.currentUser.name.split(' ')[0];
    }

    showMsg('Profile saved successfully!');

    // Re-render the page so masked values update
    setTimeout(() => {
        const mainContent = document.getElementById('mainContent');
        if (mainContent) mainContent.innerHTML = renderProfilePage();
    }, 800);
}

export function handleAvatarChange(event) {
    const file = event.target?.files?.[0];
    if (!file) return;

    // Validate size (max 1 MB) and type
    if (file.size > 1 * 1024 * 1024) {
        alert('Image is too large. Maximum file size is 1 MB.');
        return;
    }

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
        alert('Only JPEG and PNG images are allowed.');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const base64 = e.target.result;

        // Update preview immediately
        const preview = document.getElementById('profileAvatarPreview');
        if (preview) {
            const img = document.createElement('img');
            img.id = 'profileAvatarPreview';
            img.className = 'myprofile-avatar-img';
            img.src = base64;
            img.alt = 'Profile photo';
            preview.replaceWith(img);
        }

        // Persist in extra data
        const extra = loadProfileExtra();
        extra.avatar = base64;
        saveProfileExtra(extra);
    };
    reader.readAsDataURL(file);
}
