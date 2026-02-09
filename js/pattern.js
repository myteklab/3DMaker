/**
 * 3DMaker - Pattern Builder
 * Create multiple shapes in patterns (row, grid, circle)
 */

// Safety limits to prevent browser crashes
const PATTERN_LIMITS = {
    MAX_TOTAL_OBJECTS: 200,        // Absolute max objects in scene
    MAX_PATTERN_SHAPES: 100,       // Max shapes in single pattern
    MAX_ROW_COUNT: 50,             // Max shapes in a row
    MAX_GRID_DIMENSION: 20,        // Max grid rows/columns
    MAX_CIRCLE_COUNT: 30,          // Max shapes in circle
    MAX_SPIRAL_COUNT: 100,         // Max shapes in spiral patterns (needs more for smooth spirals!)
    MAX_HELIX_COUNT: 100,          // Max shapes in helix patterns

    // Warning thresholds
    WARN_TOTAL_OBJECTS: 150,       // Show warning at 150 shapes
    WARN_PATTERN_SHAPES: 50        // Warn if pattern creates 50+ shapes
};

let currentPatternType = 'row';
let patternSettings = {
    row: { count: 5, spacingX: 20, spacingY: 0, spacingZ: 0 },
    grid: { rows: 3, columns: 3, spacingX: 20, spacingY: 20, plane: 'xy' },
    circle: { count: 8, radius: 50, orientation: 'xy' },
    helix: { count: 12, rotations: 3, radius: 40, height: 100, orientation: 'xy' },
    spiral: { count: 12, rotations: 3, startRadius: 0, endRadius: 80, height: 0, orientation: 'xy' }
};

// Global setting for all patterns
let autoMergePattern = false;

function openPatternBuilder() {
    if (!selectedObject) {
        showToast('Select a shape first to create a pattern', 'error');
        return;
    }

    // Show pattern panel
    document.getElementById('pattern-panel').style.display = 'block';
    updatePatternPreview();
}

function closePatternBuilder() {
    document.getElementById('pattern-panel').style.display = 'none';
}

function setPatternType(type) {
    currentPatternType = type;

    // Update UI to show correct settings
    document.querySelectorAll('.pattern-type-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`pattern-${type}-btn`).classList.add('active');

    document.querySelectorAll('.pattern-settings').forEach(panel => {
        panel.style.display = 'none';
    });
    document.getElementById(`${type}-settings`).style.display = 'block';

    updatePatternPreview();
}

function updatePatternSetting(setting, value) {
    // Non-numeric settings
    const nonNumericSettings = ['direction', 'plane', 'orientation'];

    if (currentPatternType === 'row') {
        patternSettings.row[setting] = nonNumericSettings.includes(setting) ? value : parseInt(value);
    } else if (currentPatternType === 'grid') {
        patternSettings.grid[setting] = nonNumericSettings.includes(setting) ? value : parseInt(value);
    } else if (currentPatternType === 'circle') {
        patternSettings.circle[setting] = nonNumericSettings.includes(setting) ? value : parseInt(value);
    } else if (currentPatternType === 'helix') {
        patternSettings.helix[setting] = nonNumericSettings.includes(setting) ? value : parseInt(value);
    } else if (currentPatternType === 'spiral') {
        patternSettings.spiral[setting] = nonNumericSettings.includes(setting) ? value : parseInt(value);
    }

    // Update display label (only for numeric settings)
    const labelId = `${currentPatternType}-${setting}-value`;
    const label = document.getElementById(labelId);
    if (label && !nonNumericSettings.includes(setting)) {
        let suffix = '';
        if (setting.includes('spacing') || setting.includes('Spacing') || setting.includes('radius') || setting === 'height' || setting.includes('Radius')) {
            suffix = 'mm';
        }
        label.textContent = value + suffix;
    }

    updatePatternPreview();
}

function validatePattern() {
    const settings = patternSettings[currentPatternType];
    let shapesNeeded = 0;

    // Calculate shapes needed based on pattern type
    if (currentPatternType === 'row') {
        shapesNeeded = settings.count;
    } else if (currentPatternType === 'grid') {
        shapesNeeded = settings.rows * settings.columns;
    } else if (currentPatternType === 'circle') {
        shapesNeeded = settings.count;
    } else if (currentPatternType === 'helix') {
        shapesNeeded = settings.count;
    } else if (currentPatternType === 'spiral') {
        shapesNeeded = settings.count;
    }

    const currentShapes = objects.length;
    const totalAfter = currentShapes + shapesNeeded;

    // Check 1: Pattern too large
    if (shapesNeeded > PATTERN_LIMITS.MAX_PATTERN_SHAPES) {
        return {
            valid: false,
            error: `Pattern too large! Maximum ${PATTERN_LIMITS.MAX_PATTERN_SHAPES} shapes per pattern.`,
            suggestion: `Try reducing to ${PATTERN_LIMITS.MAX_PATTERN_SHAPES} or fewer.`,
            shapesNeeded: shapesNeeded,
            totalAfter: totalAfter
        };
    }

    // Check 2: Would exceed total limit
    if (totalAfter > PATTERN_LIMITS.MAX_TOTAL_OBJECTS) {
        const needToDelete = totalAfter - PATTERN_LIMITS.MAX_TOTAL_OBJECTS;
        return {
            valid: false,
            error: `This would create ${totalAfter} total shapes (limit: ${PATTERN_LIMITS.MAX_TOTAL_OBJECTS})`,
            suggestion: `Delete ${needToDelete} shapes first, or reduce pattern size.`,
            shapesNeeded: shapesNeeded,
            totalAfter: totalAfter
        };
    }

    // Check 3: Warning zone
    if (shapesNeeded >= PATTERN_LIMITS.WARN_PATTERN_SHAPES || totalAfter >= PATTERN_LIMITS.WARN_TOTAL_OBJECTS) {
        return {
            valid: true,
            warning: true,
            message: `This will create ${shapesNeeded} shapes (${totalAfter} total)`,
            needsConfirmation: true,
            shapesNeeded: shapesNeeded,
            totalAfter: totalAfter
        };
    }

    // All good!
    return {
        valid: true,
        message: `This will create ${shapesNeeded} shapes (${totalAfter} total)`,
        shapesNeeded: shapesNeeded,
        totalAfter: totalAfter
    };
}

function updatePatternPreview() {
    const validation = validatePattern();
    const previewDiv = document.getElementById('pattern-preview-info');
    const createBtn = document.getElementById('create-pattern-btn');

    let statusColor = '#10b981'; // Green (safe)
    let statusIcon = '✓';

    if (!validation.valid) {
        statusColor = '#ef4444'; // Red (blocked)
        statusIcon = '✗';
        createBtn.disabled = true;
        createBtn.textContent = '🚫 Too Many Shapes';
    } else if (validation.warning) {
        statusColor = '#f59e0b'; // Orange (warning)
        statusIcon = '⚠️';
        createBtn.disabled = false;
        createBtn.textContent = `⚠️ Create ${validation.shapesNeeded} Shapes`;
    } else {
        createBtn.disabled = false;
        createBtn.textContent = `✨ Create ${validation.shapesNeeded} Shapes`;
    }

    previewDiv.innerHTML = `
        <div style="padding: 10px; background: rgba(255,255,255,0.05); border-radius: 4px; border-left: 3px solid ${statusColor};">
            <div style="font-size: 13px; margin-bottom: 5px;">
                <span style="color: ${statusColor}; font-weight: bold;">${statusIcon}</span>
                Will create: <strong>${validation.shapesNeeded}</strong> shapes
            </div>
            <div style="font-size: 12px; color: #888;">
                Total after: <strong>${validation.totalAfter}</strong> / ${PATTERN_LIMITS.MAX_TOTAL_OBJECTS}
            </div>
            ${!validation.valid ? `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <div style="font-size: 12px; color: ${statusColor};">${validation.error}</div>
                    <div style="font-size: 11px; color: #aaa; margin-top: 4px;">${validation.suggestion}</div>
                </div>
            ` : ''}
            ${validation.warning ? `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <div style="font-size: 11px; color: ${statusColor};">⚠️ This might slow down your computer slightly</div>
                </div>
            ` : ''}
        </div>
    `;
}

function createPatternClick() {
    if (!selectedObject) {
        showToast('No shape selected', 'error');
        return;
    }

    const validation = validatePattern();

    if (!validation.valid) {
        showToast(validation.error, 'error');
        setTimeout(() => {
            showToast(validation.suggestion, 'info');
        }, 2000);
        return;
    }

    if (validation.warning && validation.needsConfirmation) {
        showConfirmDialog(
            'Large Pattern Warning',
            `You're about to create ${validation.shapesNeeded} shapes.\n\nThis might slow down your computer a little.\n\nContinue?`,
            function() {
                executePattern();
            }
        );
        return;
    }

    executePattern();
}

function executePattern() {
    const sourceObj = selectedObject;
    const settings = patternSettings[currentPatternType];
    const createdObjects = [];

    let count = 0;
    if (currentPatternType === 'row') {
        count = settings.count;
    } else if (currentPatternType === 'grid') {
        count = settings.rows * settings.columns;
    } else if (currentPatternType === 'circle') {
        count = settings.count;
    } else if (currentPatternType === 'helix') {
        count = settings.count;
    } else if (currentPatternType === 'spiral') {
        count = settings.count;
    }

    // Create the pattern
    for (let i = 0; i < count; i++) {
        const newObj = cloneShapeForPattern(sourceObj, i);

        if (currentPatternType === 'row') {
            // Row pattern - supports multi-axis spacing for stairs, ramps, diagonals
            const offsetX = (i + 1) * settings.spacingX * UNIT_SCALE;
            const offsetY = (i + 1) * settings.spacingY * UNIT_SCALE;
            const offsetZ = (i + 1) * settings.spacingZ * UNIT_SCALE;

            newObj.mesh.position.x += offsetX;
            newObj.mesh.position.y += offsetY;
            newObj.mesh.position.z += offsetZ;
        } else if (currentPatternType === 'grid') {
            // Grid pattern
            const row = Math.floor(i / settings.columns);
            const col = i % settings.columns;
            const offsetX = (col + 1) * settings.spacingX * UNIT_SCALE;
            const offsetY = (row + 1) * settings.spacingY * UNIT_SCALE;

            // Apply based on plane selection
            if (settings.plane === 'xy') {
                // Horizontal (default)
                newObj.mesh.position.x += offsetX;
                newObj.mesh.position.y += offsetY;
            } else if (settings.plane === 'xz') {
                // Vertical wall facing forward
                newObj.mesh.position.x += offsetX;
                newObj.mesh.position.z += offsetY;
            } else if (settings.plane === 'yz') {
                // Vertical wall from side
                newObj.mesh.position.y += offsetX;
                newObj.mesh.position.z += offsetY;
            }
        } else if (currentPatternType === 'circle') {
            // Circle pattern
            const angle = ((i + 1) / count) * Math.PI * 2;
            const radius = settings.radius * UNIT_SCALE;

            // Apply based on orientation
            if (settings.orientation === 'xy') {
                // Horizontal circle (default)
                newObj.mesh.position.x += Math.cos(angle) * radius;
                newObj.mesh.position.y += Math.sin(angle) * radius;
            } else if (settings.orientation === 'xz') {
                // Vertical circle - ferris wheel style
                newObj.mesh.position.x += Math.cos(angle) * radius;
                newObj.mesh.position.z += Math.sin(angle) * radius;
            } else if (settings.orientation === 'yz') {
                // Vertical circle - side view
                newObj.mesh.position.y += Math.cos(angle) * radius;
                newObj.mesh.position.z += Math.sin(angle) * radius;
            }
        } else if (currentPatternType === 'helix') {
            // Helix/3D Spiral pattern (like a spring or spiral staircase)
            const rotations = settings.rotations;
            const radius = settings.radius * UNIT_SCALE;
            const height = settings.height * UNIT_SCALE;

            // Calculate position along the helix
            // Use i/(count-1) so first shape starts at bottom (angle 0, height 0)
            const progress = i / Math.max(count - 1, 1);
            const angle = progress * rotations * Math.PI * 2;
            const verticalPos = progress * height;

            // Apply based on orientation
            if (settings.orientation === 'xy') {
                // Spiral upward (Z-up, default)
                newObj.mesh.position.x += Math.cos(angle) * radius;
                newObj.mesh.position.y += Math.sin(angle) * radius;
                newObj.mesh.position.z += verticalPos;
            } else if (settings.orientation === 'xz') {
                // Spiral along Y-axis (depth)
                newObj.mesh.position.x += Math.cos(angle) * radius;
                newObj.mesh.position.z += Math.sin(angle) * radius;
                newObj.mesh.position.y += verticalPos;
            } else if (settings.orientation === 'yz') {
                // Spiral along X-axis (sideways)
                newObj.mesh.position.y += Math.cos(angle) * radius;
                newObj.mesh.position.z += Math.sin(angle) * radius;
                newObj.mesh.position.x += verticalPos;
            }
        } else if (currentPatternType === 'spiral') {
            // Archimedean/Flat Spiral pattern (like a nautilus shell or galaxy)
            const rotations = settings.rotations;
            const startRadius = settings.startRadius * UNIT_SCALE;
            const endRadius = settings.endRadius * UNIT_SCALE;
            const height = settings.height * UNIT_SCALE; // Height for shell/cone effect

            // TRUE Archimedean Spiral: radius grows linearly with angle
            // This creates constant spacing between each turn (not galaxy arms!)
            const spacingPerRotation = (endRadius - startRadius) / rotations;

            // Calculate total angle needed to reach endRadius
            const totalAngle = rotations * Math.PI * 2;

            // For shape i, calculate its position along the continuous spiral
            const angle = (i / Math.max(count - 1, 1)) * totalAngle;

            // Radius grows linearly with angle (Archimedean spiral formula)
            const radius = startRadius + (angle / (Math.PI * 2)) * spacingPerRotation;

            // Height rises with progress
            const progress = i / Math.max(count - 1, 1);
            const verticalPos = progress * height; // Rise as it spirals (nautilus shell effect)

            // Apply based on orientation
            if (settings.orientation === 'xy') {
                // Horizontal spiral (default) - rises along Z
                newObj.mesh.position.x += Math.cos(angle) * radius;
                newObj.mesh.position.y += Math.sin(angle) * radius;
                newObj.mesh.position.z += verticalPos; // Shell rises upward
            } else if (settings.orientation === 'xz') {
                // Vertical spiral - wall, extends along Y
                newObj.mesh.position.x += Math.cos(angle) * radius;
                newObj.mesh.position.z += Math.sin(angle) * radius;
                newObj.mesh.position.y += verticalPos; // Shell extends forward
            } else if (settings.orientation === 'yz') {
                // Vertical spiral - side wall, extends along X
                newObj.mesh.position.y += Math.cos(angle) * radius;
                newObj.mesh.position.z += Math.sin(angle) * radius;
                newObj.mesh.position.x += verticalPos; // Shell extends sideways
            }
        }

        objects.push(newObj);
        createdObjects.push(newObj);
    }

    objectCounter += count;

    // Auto-merge if enabled
    if (autoMergePattern && count > 1) {
        // Select all the newly created objects
        selectedObjects = createdObjects.slice(); // Copy array

        // Perform union to merge them all into one shape
        showToast(`Merging ${count} shapes into one...`, 'info');

        // Small delay to show the toast, then merge
        setTimeout(() => {
            performCSG('union');
            showToast(`Pattern merged into single shape!`, 'success');
        }, 100);
    } else {
        // Save state and update UI normally
        saveState(`Create ${currentPatternType} pattern`);
        updateObjectsList();
        showToast(`Created ${count} shapes in ${currentPatternType} pattern!`, 'success');
    }

    // Close panel
    closePatternBuilder();
}

function toggleAutoMerge() {
    autoMergePattern = !autoMergePattern;
    const checkbox = document.getElementById('auto-merge-checkbox');
    if (checkbox) {
        checkbox.checked = autoMergePattern;
    }
}

function cloneShapeForPattern(sourceObj, index) {
    // Clone the mesh
    const newMesh = sourceObj.mesh.clone(`object_${objectCounter + index}`);

    // Clone material
    const newMat = sourceObj.mesh.material.clone(`mat_${objectCounter + index}`);
    newMesh.material = newMat;

    // Create new object
    const newObj = {
        id: objectCounter + index,
        type: sourceObj.type,
        name: `${sourceObj.name} (${index + 1})`,
        mesh: newMesh,
        color: sourceObj.color.clone(),
        dimensions: sourceObj.dimensions ? JSON.parse(JSON.stringify(sourceObj.dimensions)) : null,
        opacity: sourceObj.opacity !== undefined ? sourceObj.opacity : 1.0,
        showEdges: sourceObj.showEdges || false,
        wireframeClone: null
    };

    // Apply opacity settings
    if (newObj.opacity < 1) {
        newMesh.material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
        newMesh.material.disableDepthWrite = false;
        newMesh.material.needDepthPrePass = true;
        newMesh.renderingGroupId = 1;
    }

    // Apply wireframe if needed
    if (sourceObj.showEdges) {
        const wireframe = newMesh.clone(newMesh.name + '_wireframe');
        const wireMat = new BABYLON.StandardMaterial('wireMat_' + newObj.id, scene);
        wireMat.wireframe = true;
        wireMat.emissiveColor = new BABYLON.Color3(0, 0, 0);
        wireMat.disableLighting = true;
        wireMat.alpha = 1.0;
        wireframe.material = wireMat;
        wireframe.parent = newMesh;
        wireframe.position = new BABYLON.Vector3(0, 0, 0);
        wireframe.rotation = new BABYLON.Vector3(0, 0, 0);
        wireframe.scaling = new BABYLON.Vector3(1, 1, 1);
        wireframe.renderingGroupId = newMesh.renderingGroupId || 0;
        newObj.wireframeClone = wireframe;
    }

    return newObj;
}

function showConfirmDialog(title, message, onConfirm) {
    const dialog = document.createElement('div');
    dialog.id = 'confirm-dialog-overlay';
    dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease;
    `;

    dialog.innerHTML = `
        <div style="
            background: #2a2a2a;
            border: 1px solid #4a4a4a;
            border-radius: 6px;
            padding: 20px;
            max-width: 400px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            animation: slideIn 0.3s ease;
        ">
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 16px; color: #f59e0b;">
                ${title}
            </div>
            <div style="font-size: 14px; color: #ccc; margin-bottom: 24px; line-height: 1.6; white-space: pre-line;">
                ${message}
            </div>
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button onclick="closeConfirmDialog()" style="
                    padding: 10px 20px;
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 4px;
                    color: #fff;
                    cursor: pointer;
                    font-size: 14px;
                ">Cancel</button>
                <button id="confirm-yes-btn" style="
                    padding: 10px 20px;
                    background: #4a9eff;
                    border: none;
                    border-radius: 4px;
                    color: #fff;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: bold;
                ">Create Pattern</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    document.getElementById('confirm-yes-btn').onclick = function() {
        closeConfirmDialog();
        onConfirm();
    };

    // Close on escape
    const escHandler = function(e) {
        if (e.key === 'Escape') {
            closeConfirmDialog();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

function closeConfirmDialog() {
    const dialog = document.getElementById('confirm-dialog-overlay');
    if (dialog) {
        dialog.remove();
    }
}
