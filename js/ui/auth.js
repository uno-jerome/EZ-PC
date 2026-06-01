import { state } from '../state.js';
import { passwordMeetsPolicy } from '../utils.js';
import { API_URL } from '../api.js';
import { showPage } from '../router.js';

function getProfileDisplayName() {
    if (!state.currentUser || !state.currentUser.name) {
        return 'Profile';
    }

    return String(state.currentUser.name).split(' ')[0];
}

export function refreshProfileUI() {
    const profileButtonLabel = document.getElementById('profileButtonLabel');
    const profileMenu = document.getElementById('profileMenu');

    if (profileButtonLabel) {
        profileButtonLabel.textContent = getProfileDisplayName();
    }

    if (!profileMenu) {
        return;
    }

    if (state.currentUser) {
        profileMenu.innerHTML = `
            <div class="profile-menu-header">
                <div class="profile-menu-name">${state.currentUser.name}</div>
                <div class="profile-menu-email">${state.currentUser.email}</div>
            </div>
            <div class="profile-menu-divider"></div>
            <button class="profile-menu-item" onclick="closeProfileMenu(); showPage('profile')">
                <span>My Profile</span>
                <span>›</span>
            </button>
            <button class="profile-menu-item" onclick="closeProfileMenu(); showPage('purchases')">
                <span>My Purchases</span>
                <span>›</span>
            </button>
            <div class="profile-menu-divider"></div>
            <button class="profile-menu-item danger" onclick="handleSignOut()">
                <span>Sign out</span>
                <span>↗</span>
            </button>
        `;
    } else {
        profileMenu.innerHTML = `
            <button class="profile-menu-item" onclick="showPage('auth', { mode: 'signup' }); closeProfileMenu();">
                <span>Sign up</span>
                <span>›</span>
            </button>
            <button class="profile-menu-item" onclick="showPage('auth', { mode: 'login' }); closeProfileMenu();">
                <span>Log in</span>
                <span>›</span>
            </button>
        `;
    }
}

export function toggleProfileMenu(event) {
    event?.stopPropagation?.();

    const menu = document.getElementById('profileMenu');
    if (!menu) {
        return;
    }

    menu.classList.toggle('hidden');
    refreshProfileUI();
}

export function closeProfileMenu() {
    const menu = document.getElementById('profileMenu');
    if (menu) {
        menu.classList.add('hidden');
    }
}

export function handleProfileAuth(mode) {
    closeProfileMenu();
    showPage('auth', { mode });
}

export function handleSignOut() {
    state.currentUser = null;
    localStorage.removeItem('user');
    refreshProfileUI();
    closeProfileMenu();
}

export function setAuthMode(mode) {
    state.currentAuthMode = String(mode || 'login');

    if (state.currentPage === 'auth') {
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            mainContent.innerHTML = renderAuthPage(state.currentAuthMode);
        }
    }
}

export function renderAuthPage(mode = 'login') {
    const isSignup = mode === 'signup';

    return `
        <div class="container section">
            <div class="auth-shell">
                <div class="auth-panel auth-panel-intro">
                    <p class="auth-kicker">Estore account</p>
                    <h1>${isSignup ? 'Create your account' : 'Welcome back'}</h1>
                    <p>Use the login/signup screen to continue to cart and checkout, save your details, and manage your profile.</p>
                    <div class="auth-points">
                        <div>Fast checkout</div>
                        <div>Saved profile details</div>
                        <div>Access to cart and orders</div>
                    </div>
                </div>

                <div class="auth-panel auth-panel-form">
                    <div class="auth-tabs">
                        <button class="auth-tab ${!isSignup ? 'active' : ''}" onclick="setAuthMode('login')" type="button">Log In</button>
                        <button class="auth-tab ${isSignup ? 'active' : ''}" onclick="setAuthMode('signup')" type="button">Sign Up</button>
                    </div>

                    <div id="authMessage" class="auth-message hidden"></div>

                    <form class="auth-form" onsubmit="handleAuthSubmit(event, '${mode}')">
                        ${isSignup ? `
                            <label>
                                <span>Name</span>
                                <input name="name" type="text" placeholder="Your name" required>
                            </label>
                            <label>
                                <span>Username</span>
                                <input name="username" type="text" placeholder="Choose a username" required>
                            </label>
                        ` : ''}
                        <label>
                            <span>${isSignup ? 'Email' : 'Email or Username'}</span>
                            <input name="${isSignup ? 'email' : 'identifier'}" type="${isSignup ? 'email' : 'text'}" placeholder="${isSignup ? 'you@example.com' : 'you@example.com or username'}" required>
                        </label>
                        <label>
                            <span>Password</span>
                            <input name="password" type="password" placeholder="••••••••" minlength="8" pattern="(?=.*[A-Za-z])(?=.*[^A-Za-z0-9]).{8,}" title="At least 8 characters, include letters and at least 1 symbol." required>
                        </label>
                        ${isSignup ? `
                            <label>
                                <span>Confirm Password</span>
                                <input name="confirmPassword" type="password" placeholder="••••••••" minlength="8" required>
                            </label>
                        ` : ''}
                        <p style="font-size: 0.85rem; color: #6b7280; margin-top: -0.25rem;">
                            Password must be at least 8 characters and include letters plus 1 symbol.
                        </p>
                        <button class="btn btn-primary" type="submit">${isSignup ? 'Create Account' : 'Log In'}</button>
                    </form>
                </div>
            </div>
        </div>
    `;
}

export async function handleAuthSubmit(event, mode) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const name = String(formData.get('name') || '').trim();
    const username = String(formData.get('username') || '').trim();
    const identifier = String(formData.get('identifier') || formData.get('email') || '').trim();
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '').trim();
    const confirmPassword = String(formData.get('confirmPassword') || '').trim();
    const messageBox = document.getElementById('authMessage');

    const showMessage = (message, isError = true) => {
        if (!messageBox) {
            alert(message);
            return;
        }

        messageBox.textContent = message;
        messageBox.classList.toggle('error', isError);
        messageBox.classList.toggle('success', !isError);
        messageBox.classList.remove('hidden');
    };

    if ((mode === 'login' && !identifier) || !password || (mode === 'signup' && (!name || !username || !email))) {
        showMessage('Please fill in all required fields.');
        return;
    }

    if (mode === 'signup') {
        if (password !== confirmPassword) {
            showMessage('Passwords do not match.');
            return;
        }

        if (!passwordMeetsPolicy(password)) {
            showMessage('Password must be at least 8 characters and include letters plus 1 symbol.');
            return;
        }
    }

    const payload = {
        action: mode,
        name,
        username,
        email,
        identifier,
        password,
        confirmPassword,
    };

    try {
        const response = await fetch(`${API_URL}/auth.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data?.details || data?.error || 'Authentication failed.');
        }

        state.currentUser = data.user;
        localStorage.setItem('user', JSON.stringify(state.currentUser));
        refreshProfileUI();
        closeProfileMenu();
        showMessage(data.message || 'Success.', false);

        setTimeout(() => {
            showPage('home');
        }, 250);
    } catch (error) {
        showMessage(error.message || 'Authentication failed.');
    }
}
