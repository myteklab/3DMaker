/**
 * 3DMaker - Alignment Tools
 * Functions for aligning objects to grid and to each other
 */

// Align selected object(s) to grid center (0,0 on X and Y, keeps Z)
function alignToCenter() {
    if (!selectedObject && selectedObjects.length === 0) {
        showToast('No object selected', 'error');
        return;
    }

    const objectsToAlign = selectedObjects.length > 0 ? selectedObjects : [selectedObject];

    objectsToAlign.forEach(obj => {
        if (obj && obj.mesh) {
            obj.mesh.position.x = 0;
            obj.mesh.position.z = 0;
        }
    });

    updateProperties();
    saveState('Align to Center');
    showToast(`Aligned ${objectsToAlign.length} object(s) to grid center`);
}

// Align selected object(s) to origin (0,0,0)
function alignToOrigin() {
    if (!selectedObject && selectedObjects.length === 0) {
        showToast('No object selected', 'error');
        return;
    }

    const objectsToAlign = selectedObjects.length > 0 ? selectedObjects : [selectedObject];

    objectsToAlign.forEach(obj => {
        if (obj && obj.mesh) {
            obj.mesh.position.x = 0;
            obj.mesh.position.y = 0;
            obj.mesh.position.z = 0;
        }
    });

    updateProperties();
    saveState('Align to Origin');
    showToast(`Aligned ${objectsToAlign.length} object(s) to origin`);
}

// World-space bounds. boundingInfo.minimum/maximum are local to the mesh, so
// they ignore where it sits and how it is turned. The scene is Z-up: Y is depth.
function getObjectBounds(obj) {
    if (!obj || !obj.mesh) return null;

    obj.mesh.computeWorldMatrix(true);
    const box = obj.mesh.getBoundingInfo().boundingBox;
    const min = box.minimumWorld;
    const max = box.maximumWorld;

    return {
        left: min.x,
        right: max.x,
        front: min.y,
        back: max.y,
        bottom: min.z,
        top: max.z,
        centerX: (min.x + max.x) / 2,
        centerY: (min.y + max.y) / 2,
        centerZ: (min.z + max.z) / 2
    };
}

const ALIGN_AXIS = {
    left: 'x', right: 'x', centerX: 'x',
    front: 'y', back: 'y', centerY: 'y',
    bottom: 'z', top: 'z', centerZ: 'z'
};

// Every other selected shape moves to match the first one picked
function alignObjects(alignType) {
    if (selectedObjects.length < 2) {
        showToast('Select at least 2 objects to align', 'error');
        return;
    }

    const axis = ALIGN_AXIS[alignType];
    const refBounds = getObjectBounds(selectedObjects[0]);
    if (!axis || !refBounds) {
        showToast('Error getting reference object bounds', 'error');
        return;
    }

    for (let i = 1; i < selectedObjects.length; i++) {
        const obj = selectedObjects[i];
        const objBounds = getObjectBounds(obj);
        if (!objBounds) continue;
        obj.mesh.position[axis] += refBounds[alignType] - objBounds[alignType];
    }

    updateSelectionLabels();
    updateProperties();
    saveState(`Align ${alignType}`);
    showToast(`Aligned ${selectedObjects.length} objects (${alignType})`);
}

// Show/hide align objects section based on selection
function updateAlignmentUI() {
    const alignObjectsSection = document.getElementById('align-objects-section');
    if (alignObjectsSection) {
        if (selectedObjects.length >= 2) {
            alignObjectsSection.style.display = 'block';
        } else {
            alignObjectsSection.style.display = 'none';
        }
    }
}
