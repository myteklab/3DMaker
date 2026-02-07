/**
 * 3DMaker - UI Helper Functions
 * Toast notifications, dimension labels, and workplane toggle
 */

// Toggle workplane and axes visibility
function toggleWorkplane() {
    workplaneVisible = !workplaneVisible;

    // Hide/show all workplane elements (grid, ground, origin, border)
    workplaneElements.forEach(element => {
element.isVisible = workplaneVisible;
    });

    const btn = document.getElementById('toggle-workplane-btn');
    if (workplaneVisible) {
btn.style.background = 'rgba(255,255,255,0.2)';
showToast('Grid & axes shown');
    } else {
btn.style.background = 'rgba(255,255,255,0.1)';
btn.style.opacity = '0.6';
showToast('Grid & axes hidden');
    }
}

// Toggle snap to grid
function toggleSnapToGrid() {
    snapToGrid = !snapToGrid;

    const btn = document.getElementById('snap-to-grid-btn');
    if (snapToGrid) {
        btn.style.background = 'rgba(255,255,255,0.4)';
        btn.style.border = '2px solid rgba(255,255,255,0.6)';
        btn.style.boxShadow = '0 0 15px rgba(102, 126, 234, 0.5)';
        btn.classList.add('active');
        showToast('🧲 Snap to Grid enabled (10mm, or hold Shift for 1mm)');
    } else {
        btn.style.background = 'rgba(255,255,255,0.2)';
        btn.style.border = 'none';
        btn.style.boxShadow = 'none';
        btn.classList.remove('active');
        showToast('Snap to Grid disabled');
    }

    // Update gizmo snap distance in real-time
    updateGizmoSnapDistance();

    // Save preference
    localStorage.setItem('3dmaker_snap_to_grid', snapToGrid);
}

// Toast notifications
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    if (type === 'error') {
toast.style.background = '#e74c3c';
    }
    document.body.appendChild(toast);

    setTimeout(() => {
toast.remove();
    }, 3000);
}

// Dimension label - Real-time feedback during resize
function showDimensionLabel(axis, value, screenX, screenY) {
    const label = document.getElementById('dimension-label');
    const axisName = axis === 'x' ? 'Width' : axis === 'y' ? 'Depth' : 'Height';

    label.innerHTML = `
<span class="dim-axis">${axisName}:</span>
<span class="dim-value">${value.toFixed(1)}mm</span>
    `;

    // Position near the handle, offset slightly so it doesn't obscure
    label.style.left = (screenX + 20) + 'px';
    label.style.top = (screenY - 40) + 'px';
    label.style.display = 'block';
}

function hideDimensionLabel() {
    const label = document.getElementById('dimension-label');
    label.style.display = 'none';
}

// Toggle viewport info overlays (controls help and orientation gizmo)
let overlaysVisible = true;

function toggleOverlays() {
    overlaysVisible = !overlaysVisible;

    const viewportInfo = document.getElementById('viewport-info');
    const orientationGizmo = document.getElementById('orientation-gizmo');
    const btn = document.getElementById('toggle-overlays-btn');

    if (overlaysVisible) {
        viewportInfo.style.display = 'block';
        orientationGizmo.style.display = 'block';
        btn.style.background = 'rgba(255,255,255,0.2)';
        btn.style.opacity = '1';
        showToast('Info overlays shown');
    } else {
        viewportInfo.style.display = 'none';
        orientationGizmo.style.display = 'none';
        btn.style.background = 'rgba(255,255,255,0.1)';
        btn.style.opacity = '0.6';
        showToast('Info overlays hidden');
    }

    // Save preference to localStorage
    localStorage.setItem('3dmaker_overlays_visible', overlaysVisible);
}

// Load snap to grid preference on page load
function loadSnapPreference() {
    const saved = localStorage.getItem('3dmaker_snap_to_grid');
    if (saved !== null) {
        snapToGrid = saved === 'true';
        const btn = document.getElementById('snap-to-grid-btn');
        if (btn && snapToGrid) {
            // Apply active state without showing toast
            btn.style.background = 'rgba(255,255,255,0.4)';
            btn.style.border = '2px solid rgba(255,255,255,0.6)';
            btn.style.boxShadow = '0 0 15px rgba(102, 126, 234, 0.5)';
            btn.classList.add('active');
        }
        // Update gizmo snap distance if scene is ready
        if (typeof updateGizmoSnapDistance === 'function') {
            updateGizmoSnapDistance();
        }
    }
}

// Load overlay visibility preference on page load
function loadOverlayPreferences() {
    const saved = localStorage.getItem('3dmaker_overlays_visible');
    if (saved !== null) {
        overlaysVisible = saved === 'true';
        if (!overlaysVisible) {
            // Apply hidden state without showing toast
            const viewportInfo = document.getElementById('viewport-info');
            const orientationGizmo = document.getElementById('orientation-gizmo');
            const btn = document.getElementById('toggle-overlays-btn');

            if (viewportInfo) viewportInfo.style.display = 'none';
            if (orientationGizmo) orientationGizmo.style.display = 'none';
            if (btn) {
                btn.style.background = 'rgba(255,255,255,0.1)';
                btn.style.opacity = '0.6';
            }
        }
    }
}
