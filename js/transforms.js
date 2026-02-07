/**
 * 3DMaker - Transform Modes
 * Grab mode and transform mode switching
 */

// Snap a value to the nearest grid point
function snapToGridValue(value) {
    if (!snapToGrid) return value;
    const snapSize = isShiftHeld ? fineSnapSize : gridSize;
    return Math.round(value / snapSize) * snapSize;
}

// Snap a position vector to grid
function snapPositionToGrid(position) {
    if (!snapToGrid) return position;

    return new BABYLON.Vector3(
        snapToGridValue(position.x),
        snapToGridValue(position.y),
        snapToGridValue(position.z)
    );
}

// Update gizmo snap distance based on snapToGrid setting
function updateGizmoSnapDistance() {
    if (!gizmoManager || !gizmoManager.gizmos.positionGizmo) return;

    const posGizmo = gizmoManager.gizmos.positionGizmo;

    // Use fine snap (1mm) when Shift is held, otherwise normal snap (10mm)
    let snapDist = 0;
    if (snapToGrid) {
        snapDist = isShiftHeld ? fineSnapSize : gridSize;
    }

    // Set snap distance for each axis
    posGizmo.xGizmo.snapDistance = snapDist;
    posGizmo.yGizmo.snapDistance = snapDist;
    posGizmo.zGizmo.snapDistance = snapDist;
}

function enableGrabMode(obj) {
    if (!obj || !obj.mesh) return;

    // Remove any existing drag behavior
    removeGrabMode();

    // Create new drag behavior without plane constraint
    // This allows dragging along the camera's view plane (follows mouse in 3D)
    dragBehavior = new BABYLON.PointerDragBehavior();

    // Update position during drag
    dragBehavior.onDragObservable.add(() => {
        // Apply snap to grid if enabled
        if (snapToGrid && obj.mesh) {
            obj.mesh.position = snapPositionToGrid(obj.mesh.position);
        }
        updateProperties();
    });

    // Save state when drag ends
    dragBehavior.onDragEndObservable.add(() => {
        // Final snap on release
        if (snapToGrid && obj.mesh) {
            obj.mesh.position = snapPositionToGrid(obj.mesh.position);
        }
        saveState('Grab Move');
    });

    // Attach to mesh
    obj.mesh.addBehavior(dragBehavior);

    // Change cursor to grab
    scene.hoverCursor = 'grab';
}

// Remove grab mode behavior
function removeGrabMode() {
    if (dragBehavior && selectedObject && selectedObject.mesh) {
        selectedObject.mesh.removeBehavior(dragBehavior);
        dragBehavior = null;
    }
    // Reset cursor
    scene.hoverCursor = 'pointer';
}

// Set transform mode (move, rotate, size, scale, grab)
function setTransformMode(mode) {
    currentTransformMode = mode;

    // Update button states with active class
    const buttons = ['move-mode-btn', 'rotate-mode-btn', 'size-mode-btn', 'scale-mode-btn', 'grab-mode-btn'];
    const modes = ['position', 'rotation', 'size', 'scaling', 'grab'];

    buttons.forEach((btnId, index) => {
        const btn = document.getElementById(btnId);
        if (modes[index] === mode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Enable/disable gizmos
    if (mode === 'size') {
        // Size mode only works for boxes - spheres/cylinders/cones should use scale mode
        if (selectedObject && selectedObject.type !== 'box') {
            showToast('Size mode only works for boxes. Use Scale mode for ' + selectedObject.type + 's', 'error');
            setTransformMode('scaling');
            return;
        }

        // Size mode uses custom handles (Option B)
        gizmoManager.positionGizmoEnabled = false;
        gizmoManager.rotationGizmoEnabled = false;
        gizmoManager.scaleGizmoEnabled = false;
        gizmoManager.attachToMesh(null);
        removeGrabMode();

        // Create size handles for selected object
        if (selectedObject) {
            createSizeHandles(selectedObject);
        }
    } else if (mode === 'grab') {
        // Grab mode - free dragging on workplane
        gizmoManager.positionGizmoEnabled = false;
        gizmoManager.rotationGizmoEnabled = false;
        gizmoManager.scaleGizmoEnabled = false;
        gizmoManager.attachToMesh(null);
        removeSizeHandles();
        hideDimensionLabel();

        // Enable grab mode for selected object
        if (selectedObject) {
            enableGrabMode(selectedObject);
        }
    } else {
        // Standard gizmos - remove size handles and grab mode
        removeSizeHandles();
        removeGrabMode();
        hideDimensionLabel();  // Hide dimension label when leaving size mode
        gizmoManager.positionGizmoEnabled = (mode === 'position');
        gizmoManager.rotationGizmoEnabled = (mode === 'rotation');
        gizmoManager.scaleGizmoEnabled = (mode === 'scaling');

        // Scale up gizmos to make them easier to grab for younger students
        // (Gizmos are created lazily, so we set scale when they're enabled)
        // Using 2.5x scale for very noticeable difference
        if (mode === 'position' && gizmoManager.gizmos.positionGizmo) {
            gizmoManager.gizmos.positionGizmo.scaleRatio = 2.5;
            gizmoManager.gizmos.positionGizmo.xGizmo.scaleRatio = 2.5;
            gizmoManager.gizmos.positionGizmo.yGizmo.scaleRatio = 2.5;
            gizmoManager.gizmos.positionGizmo.zGizmo.scaleRatio = 2.5;
        }
        if (mode === 'rotation' && gizmoManager.gizmos.rotationGizmo) {
            // Leave rotation gizmos at default - Babylon.js doesn't support making just the tube thicker
            // without breaking functionality
        }
        if (mode === 'scaling' && gizmoManager.gizmos.scaleGizmo) {
            gizmoManager.gizmos.scaleGizmo.scaleRatio = 2.5;
            if (gizmoManager.gizmos.scaleGizmo.xGizmo) {
                gizmoManager.gizmos.scaleGizmo.xGizmo.scaleRatio = 2.5;
                gizmoManager.gizmos.scaleGizmo.yGizmo.scaleRatio = 2.5;
                gizmoManager.gizmos.scaleGizmo.zGizmo.scaleRatio = 2.5;
            }
        }

        // Reattach to selected object if any
        if (selectedObject) {
            gizmoManager.attachToMesh(selectedObject.mesh);
        }
    }
}

// Update CSG button states
