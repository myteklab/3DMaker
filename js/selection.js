/**
 * 3DMaker - Selection Management
 * Object selection and multi-select
 */

// Toggle expand/collapse for CSG operations
function toggleCSGExpand(csgId, event) {
    if (event) event.stopPropagation();

    const csgObj = objects.find(o => o.id === csgId);
    if (csgObj) {
        csgObj.expanded = !csgObj.expanded;
        updateObjectsList();
    }
}

function updateObjectsList() {
    const list = document.getElementById('objects-list');

    if (objects.length === 0) {
        list.innerHTML = '<div style="text-align: center; color: #666; font-size: 12px; margin-top: 20px;">Add shapes from the right panel</div>';
        return;
    }

    // Add clear selection button at the top if multiple objects selected
    let headerHtml = '';
    if (selectedObjects.length > 1) {
        headerHtml = `
            <div style="padding: 8px; background: #1a1a2e; border-bottom: 1px solid #2a2a4e; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; color: #888;">${selectedObjects.length} shapes selected</span>
                <button onclick="deselectAll()" style="background: #667eea; border: none; color: white; padding: 4px 12px; border-radius: 3px; cursor: pointer; font-size: 11px;">Clear Selection</button>
            </div>
        `;
    }

    const itemsHtml = objects.map(obj => {
        const selectionIndex = selectedObjects.indexOf(obj);
        const isSelected = selectionIndex > -1;
        const colors = ['#667eea', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];
        const badgeColor = isSelected ? colors[selectionIndex % colors.length] : '';

        // Multi-select checkbox
        const multiSelectBtn = `
            <button class="multi-select-btn ${isSelected ? 'selected' : ''}"
                    onclick="toggleSelection(objects.find(o => o.id === ${obj.id})); event.stopPropagation();"
                    title="${isSelected ? 'Remove from selection' : 'Add to selection'}"
                    style="${isSelected ? `background: ${badgeColor}; color: white;` : ''}">
                ${isSelected ? (selectionIndex + 1) : '+'}
            </button>
        `;

        // Check if this is a CSG operation with operands
        const isCsgWithOperands = obj.type === 'csg' && obj.operands && obj.operands.length > 0;
        const expandIcon = isCsgWithOperands ? (obj.expanded ? '▼' : '▶') : '';
        const operationIcon = obj.operation === 'union' ? '➕' : obj.operation === 'subtract' ? '➖' : obj.operation === 'intersect' ? '⊗' : '';

        let html = `
            <div class="object-item ${isSelected ? 'selected' : ''} ${isCsgWithOperands ? 'csg-parent' : ''}"
                 onclick="selectObject(objects.find(o => o.id === ${obj.id}), event)">
                ${multiSelectBtn}
                ${isCsgWithOperands ? `<span class="expand-icon" onclick="toggleCSGExpand(${obj.id}, event)">${expandIcon}</span>` : ''}
                <span class="object-name">
                    ${isCsgWithOperands ? operationIcon : getShapeIcon(obj.type)} ${obj.name}
                </span>
                <div class="object-actions">
                    ${isCsgWithOperands ? `<button class="reverse-btn" onclick="reverseCSG(${obj.id}, event)" title="Reverse operation">↶</button>` : ''}
                    <button class="delete-btn" onclick="deleteObject(${obj.id}, event)">🗑️</button>
                </div>
            </div>
        `;

        // Add child operands if expanded
        if (isCsgWithOperands && obj.expanded) {
            const childrenHtml = obj.operands.map((operand, idx) => {
                const childIcon = getShapeIcon(operand.type);
                return `
                    <div class="object-item child-item" title="Original shape (read-only)">
                        <span class="object-name child-name">
                            ${childIcon} ${operand.name}
                        </span>
                    </div>
                `;
            }).join('');
            html += childrenHtml;
        }

        return html;
    }).join('');

    list.innerHTML = headerHtml + itemsHtml;
}

function selectObject(obj, event) {
    if (event && (event.ctrlKey || event.metaKey)) {
        event.stopPropagation();
        toggleSelection(obj);
        return;
    }

    if (event) event.stopPropagation();

    deselectAll();
    selectedObject = obj;
    selectedObjects = [obj];

    // Check if size mode is incompatible with selected object type
    if (currentTransformMode === 'size' && obj.type !== 'box') {
        showToast('Size mode only works for boxes. Use Scale mode for ' + obj.type + 's', 'error');
        setTransformMode('scaling');
        return;
    }

    // Attach appropriate gizmo or handles
    if (currentTransformMode === 'size' && obj.type === 'box') {
        createSizeHandles(obj);
        gizmoManager.attachToMesh(null);
        removeGrabMode();
    } else if (currentTransformMode === 'grab') {
        removeSizeHandles();
        gizmoManager.attachToMesh(null);
        enableGrabMode(obj);
    } else {
        removeSizeHandles();
        removeGrabMode();
        gizmoManager.attachToMesh(obj.mesh);
    }

    updateObjectsList();
    updateProperties();
    updateCSGButtons();
    updateSelectionLabels();
    updateAlignmentUI();
}

function toggleSelection(obj) {
    const index = selectedObjects.indexOf(obj);
    if (index > -1) {
        selectedObjects.splice(index, 1);
    } else {
        selectedObjects.push(obj);
    }

    selectedObject = selectedObjects[selectedObjects.length - 1] || null;
    updateObjectsList();
    updateProperties();
    updateCSGButtons();
    updateSelectionLabels();
    updateAlignmentUI();
}

function updateSelectionLabels() {
    // Remove old labels
    selectionLabels.forEach(label => label.dispose());
    selectionLabels = [];

    // Show labels when 2+ objects are selected
    if (selectedObjects.length >= 2) {
        const colors = [
            { bg: '#667eea', text: '#ffffff' }, // Purple
            { bg: '#f59e0b', text: '#ffffff' }, // Orange
            { bg: '#10b981', text: '#ffffff' }, // Green
            { bg: '#ef4444', text: '#ffffff' }, // Red
            { bg: '#8b5cf6', text: '#ffffff' }  // Violet
        ];

        selectedObjects.forEach((obj, index) => {
            // Create a plane above the object for visibility
            const label = BABYLON.MeshBuilder.CreatePlane(`label_${index}`, {
                width: 1.5,  // Compact but still easy to see
                height: 1.5
            }, scene);

            // Position above the object
            label.position = obj.mesh.position.clone();
            label.position.z += obj.mesh.getBoundingInfo().boundingBox.extendSize.z + 1;

            // Make it always face the camera
            label.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

            // Create material with text texture (higher resolution)
            const labelMat = new BABYLON.StandardMaterial(`labelMat_${index}`, scene);
            const texture = new BABYLON.DynamicTexture(`labelTexture_${index}`, 512, scene, true);
            texture.hasAlpha = true;

            const ctx = texture.getContext();

            // Draw circular background
            const centerX = 256;
            const centerY = 256;
            const radius = 200;

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.fillStyle = colors[index % colors.length].bg;
            ctx.fill();

            // Add white border for extra visibility
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 20;
            ctx.stroke();

            // Draw the number (simple and large)
            ctx.fillStyle = colors[index % colors.length].text;
            ctx.font = 'bold 280px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText((index + 1).toString(), centerX, centerY);

            texture.update();

            labelMat.diffuseTexture = texture;
            labelMat.emissiveTexture = texture;
            labelMat.opacityTexture = texture;
            labelMat.backFaceCulling = false;
            labelMat.disableLighting = true; // Always bright and visible
            label.material = labelMat;
            label.isPickable = false;
            label.renderingGroupId = 2; // Render on top of everything

            selectionLabels.push(label);
        });
    }
}

function deselectAll() {
    selectedObject = null;
    selectedObjects = [];

    // Detach gizmos, remove size handles, and remove grab mode
    gizmoManager.attachToMesh(null);
    removeSizeHandles();
    removeGrabMode();

    updateObjectsList();
    updateProperties();
    updateCSGButtons();
    updateSelectionLabels();
    updateAlignmentUI();
}
