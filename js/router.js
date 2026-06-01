import { state } from './state.js';

const pageRegistry = new Map();
let beforeRenderHook = null;

export function registerBeforeRenderHook(hook) {
    beforeRenderHook = typeof hook === 'function' ? hook : null;
}

export function registerPages(pageDefinitions) {
    pageRegistry.clear();

    Object.entries(pageDefinitions || {}).forEach(([pageKey, definition]) => {
        if (!definition || typeof definition.render !== 'function') {
            return;
        }

        pageRegistry.set(pageKey, definition);
    });
}

export function showPage(page, data = {}) {
    state.currentPage = String(page || 'home');

    const mainContent = document.getElementById('mainContent');
    if (!mainContent) {
        return;
    }

    if (beforeRenderHook) {
        beforeRenderHook(state.currentPage, data);
    }

    const definition = pageRegistry.get(state.currentPage);
    if (!definition) {
        mainContent.innerHTML = '<div class="container section"><p>Page not found.</p></div>';
        return;
    }

    const html = definition.render(data);
    mainContent.innerHTML = String(html ?? '');

    if (typeof definition.afterRender === 'function') {
        definition.afterRender(data);
    }
}
