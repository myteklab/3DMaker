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

// Get bounding box for an object
function getObjectBounds(obj) {
    if (!obj || !obj.mesh) return null;

    const boundingInfo = obj.mesh.getBoundingInfo();
    const min = boundingInfo.minimum;
    const max = boundingInfo.maximum;
    const center = obj.mesh.position;

    return {
        left: min.x,
        right: max.x,
        front: min.z,
        back: max.z,
        bottom: min.y,
        top: max.y,
        centerX: center.x,
        centerY: center.z,
        centerZ: center.y
    };
}

// Align multiple objects to each other
function alignObjects(alignType) {
    if (selectedObjects.length < 2) {
        showToast('Select at least 2 objects to align', 'error');
        return;
    }

    // Reference object is the first selected
    const refObj = selectedObjects[0];
    const refBounds = getObjectBounds(refObj);

    if (!refBounds) {
        showToast('Error getting reference object bounds', 'error');
        return;
    }

    // Align all other objects to the reference
    for (let i = 1; i < selectedObjects.length; i++) {
        const obj = selectedObjects[i];
        const objBounds = getObjectBounds(obj);

        if (!objBounds) continue;

        switch (alignType) {
            case 'left':
                // Align left edges (minimum X)
                obj.mesh.position.x += (refBounds.left - objBounds.left);
                break;
            case 'right':
                // Align right edges (maximum X)
                obj.mesh.position.x += (refBounds.right - objBounds.right);
                break;
            case 'centerX':
                // Align horizontal centers
                obj.mesh.position.x = refBounds.centerX;
                break;
            case 'front':
                // Align front edges (minimum Z)
                obj.mesh.position.z += (refBounds.front - objBounds.front);
                break;
            case 'back':
                // Align back edges (maximum Z)
                obj.mesh.position.z += (refBounds.back - objBounds.back);
                break;
            case 'centerY':
                // Align depth centers
                obj.mesh.position.z = refBounds.centerY;
                break;
            case 'bottom':
                // Align bottom edges (minimum Y)
                obj.mesh.position.y += (refBounds.bottom - objBounds.bottom);
                break;
            case 'top':
                // Align top edges (maximum Y)
                obj.mesh.position.y += (refBounds.top - objBounds.top);
                break;
            case 'centerZ':
                // Align vertical centers
                obj.mesh.position.y = refBounds.centerZ;
                break;
        }
    }

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
