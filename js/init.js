/**
 * 3DMaker - Initialization
 * Application bootstrap (save/load handled by platform adapter)
 */

// Initialize keyboard shortcuts
setupKeyboardShortcuts();

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    // Load UI preferences
    loadOverlayPreferences();
    loadSnapPreference();

    // Wait for Babylon.js to be fully loaded
    if (typeof BABYLON === 'undefined') {
        console.error('Babylon.js not loaded');
        setTimeout(() => {
            initScene();
            initOrientationGizmo();
        }, 100);
    } else {
        initScene();
        initOrientationGizmo();
    }
});
