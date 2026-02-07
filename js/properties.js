/**
 * 3DMaker - Properties Panel
 * Property updates and panel management
 */

// Track section expanded/collapsed states
let sectionStates = {
    transform: false, // Start collapsed
    appearance: true, // Start expanded
    advanced: false   // Start collapsed
};

function updateProperties() {
    const content = document.getElementById('properties-content');

    if (!selectedObject) {
        content.innerHTML = '<div style="text-align: center; color: #666; font-size: 12px;">Select an object to edit</div>';
        return;
    }

    // Auto-expand transform section when in position or rotation mode
    if (currentTransformMode === 'position' || currentTransformMode === 'rotation') {
        sectionStates.transform = true;
    }

    const pos = selectedObject.mesh.position;
    const rot = selectedObject.mesh.rotation;
    const scale = selectedObject.mesh.scaling;
    const color = selectedObject.color;
    const dims = selectedObject.dimensions || {};
    const hexColor = '#' +
        Math.round(color.r * 255).toString(16).padStart(2, '0') +
        Math.round(color.g * 255).toString(16).padStart(2, '0') +
        Math.round(color.b * 255).toString(16).padStart(2, '0');

    // Build dimensions HTML based on shape type
    let dimensionsHTML = '';
    if (selectedObject.type === 'box') {
        dimensionsHTML = `
            <div class="property-group">
                <div class="property-label">Dimensions (mm)</div>
                <div class="transform-inputs">
                    <div class="axis-input">
                        <span class="axis-input-label">Width</span>
                        <input type="number" class="axis-value" value="${dims.width || 20}"
                               step="1" min="0.1" onchange="updateDimension('width', this.value)">
                    </div>
                    <div class="axis-input">
                        <span class="axis-input-label">Depth</span>
                        <input type="number" class="axis-value" value="${dims.depth || 20}"
                               step="1" min="0.1" onchange="updateDimension('depth', this.value)">
                    </div>
                    <div class="axis-input">
                        <span class="axis-input-label">Height</span>
                        <input type="number" class="axis-value" value="${dims.height || 20}"
                               step="1" min="0.1" onchange="updateDimension('height', this.value)">
                    </div>
                </div>
            </div>
        `;
    } else if (selectedObject.type === 'sphere') {
        dimensionsHTML = `
            <div class="property-group">
                <div class="property-label">Dimensions (mm)</div>
                <div class="axis-input">
                    <span class="axis-input-label">Radius</span>
                    <input type="number" class="axis-value" value="${dims.radius || 10}"
                           step="1" min="0.1" onchange="updateDimension('radius', this.value)"
                           style="width: 100%;">
                </div>
            </div>
            <div class="property-group">
                <div class="property-label">Quality: <span id="quality-value">${dims.quality || 32}</span> segments</div>
                <input type="range" class="quality-slider" value="${dims.quality || 32}"
                       min="3" max="48" step="1" oninput="updateQualityDisplay(this.value); updateDimension('quality', this.value)">
            </div>
        `;
    } else if (selectedObject.type === 'cylinder') {
        dimensionsHTML = `
            <div class="property-group">
                <div class="property-label">Dimensions (mm)</div>
                <div class="transform-inputs" style="grid-template-columns: 1fr 1fr;">
                    <div class="axis-input">
                        <span class="axis-input-label">Radius</span>
                        <input type="number" class="axis-value" value="${dims.radius || 10}"
                               step="1" min="0.1" onchange="updateDimension('radius', this.value)">
                    </div>
                    <div class="axis-input">
                        <span class="axis-input-label">Height</span>
                        <input type="number" class="axis-value" value="${dims.height || 20}"
                               step="1" min="0.1" onchange="updateDimension('height', this.value)">
                    </div>
                </div>
            </div>
            <div class="property-group">
                <div class="property-label">Quality: <span id="quality-value">${dims.quality || 32}</span> sides</div>
                <input type="range" class="quality-slider" value="${dims.quality || 32}"
                       min="3" max="48" step="1" oninput="updateQualityDisplay(this.value); updateDimension('quality', this.value)">
            </div>
        `;
    } else if (selectedObject.type === 'cone') {
        dimensionsHTML = `
            <div class="property-group">
                <div class="property-label">Dimensions (mm)</div>
                <div class="transform-inputs">
                    <div class="axis-input">
                        <span class="axis-input-label">Top R</span>
                        <input type="number" class="axis-value" value="${dims.topRadius || 0}"
                               step="1" min="0" onchange="updateDimension('topRadius', this.value)">
                    </div>
                    <div class="axis-input">
                        <span class="axis-input-label">Bot R</span>
                        <input type="number" class="axis-value" value="${dims.bottomRadius || 10}"
                               step="1" min="0.1" onchange="updateDimension('bottomRadius', this.value)">
                    </div>
                    <div class="axis-input">
                        <span class="axis-input-label">Height</span>
                        <input type="number" class="axis-value" value="${dims.height || 20}"
                               step="1" min="0.1" onchange="updateDimension('height', this.value)">
                    </div>
                </div>
            </div>
            <div class="property-group">
                <div class="property-label">Quality: <span id="quality-value">${dims.quality || 32}</span> sides</div>
                <input type="range" class="quality-slider" value="${dims.quality || 32}"
                       min="3" max="48" step="1" oninput="updateQualityDisplay(this.value); updateDimension('quality', this.value)">
            </div>
        `;
    } else if (selectedObject.type === 'torus') {
        dimensionsHTML = `
            <div class="property-group">
                <div class="property-label">Dimensions (mm)</div>
                <div class="transform-inputs" style="grid-template-columns: 1fr 1fr;">
                    <div class="axis-input">
                        <span class="axis-input-label">Major R</span>
                        <input type="number" class="axis-value" value="${(dims.diameter || 20) / 2}"
                               step="1" min="1" onchange="updateDimension('diameter', this.value * 2)"
                               title="Radius from center to tube center">
                    </div>
                    <div class="axis-input">
                        <span class="axis-input-label">Tube R</span>
                        <input type="number" class="axis-value" value="${(dims.thickness || 4) / 2}"
                               step="0.5" min="0.1" onchange="updateDimension('thickness', this.value * 2)"
                               title="Radius of the tube itself">
                    </div>
                </div>
            </div>
            <div class="property-group">
                <div class="property-label">Quality: <span id="quality-value">${dims.quality || 32}</span> segments</div>
                <input type="range" class="quality-slider" value="${dims.quality || 32}"
                       min="3" max="48" step="1" oninput="updateQualityDisplay(this.value); updateDimension('quality', this.value)">
            </div>
        `;
    } else if (selectedObject.type === 'pyramid') {
        dimensionsHTML = `
            <div class="property-group">
                <div class="property-label">Dimensions (mm)</div>
                <div class="transform-inputs" style="grid-template-columns: 1fr 1fr;">
                    <div class="axis-input">
                        <span class="axis-input-label">Base</span>
                        <input type="number" class="axis-value" value="${dims.baseSize || 20}"
                               step="1" min="0.1" onchange="updateDimension('baseSize', this.value)">
                    </div>
                    <div class="axis-input">
                        <span class="axis-input-label">Height</span>
                        <input type="number" class="axis-value" value="${dims.height || 20}"
                               step="1" min="0.1" onchange="updateDimension('height', this.value)">
                    </div>
                </div>
            </div>
        `;
    } else if (selectedObject.type === 'capsule') {
        dimensionsHTML = `
            <div class="property-group">
                <div class="property-label">Dimensions (mm)</div>
                <div class="transform-inputs" style="grid-template-columns: 1fr 1fr;">
                    <div class="axis-input">
                        <span class="axis-input-label">Radius</span>
                        <input type="number" class="axis-value" value="${dims.radius || 5}"
                               step="0.5" min="0.1" onchange="updateDimension('radius', this.value)">
                    </div>
                    <div class="axis-input">
                        <span class="axis-input-label">Height</span>
                        <input type="number" class="axis-value" value="${dims.height || 20}"
                               step="1" min="0.1" onchange="updateDimension('height', this.value)">
                    </div>
                </div>
            </div>
            <div class="property-group">
                <div class="property-label">Quality: <span id="quality-value">${dims.quality || 16}</span> segments</div>
                <input type="range" class="quality-slider" value="${dims.quality || 16}"
                       min="3" max="48" step="1" oninput="updateQualityDisplay(this.value); updateDimension('quality', this.value)">
            </div>
        `;
    } else if (selectedObject.type === 'tube') {
        dimensionsHTML = `
            <div class="property-group">
                <div class="property-label">Dimensions (mm)</div>
                <div class="transform-inputs">
                    <div class="axis-input">
                        <span class="axis-input-label">Outer R</span>
                        <input type="number" class="axis-value" value="${dims.outerRadius || 10}"
                               step="0.5" min="1" onchange="updateDimension('outerRadius', this.value)">
                    </div>
                    <div class="axis-input">
                        <span class="axis-input-label">Inner R</span>
                        <input type="number" class="axis-value" value="${dims.innerRadius || 6}"
                               step="0.5" min="0.1" onchange="updateDimension('innerRadius', this.value)">
                    </div>
                    <div class="axis-input">
                        <span class="axis-input-label">Height</span>
                        <input type="number" class="axis-value" value="${dims.height || 20}"
                               step="1" min="0.1" onchange="updateDimension('height', this.value)">
                    </div>
                </div>
            </div>
            <div class="property-group">
                <div class="property-label">Quality: <span id="quality-value">${dims.quality || 32}</span> sides</div>
                <input type="range" class="quality-slider" value="${dims.quality || 32}"
                       min="3" max="48" step="1" oninput="updateQualityDisplay(this.value); updateDimension('quality', this.value)">
            </div>
        `;
    } else if (selectedObject.type === 'wedge') {
        dimensionsHTML = `
            <div class="property-group">
                <div class="property-label">Dimensions (mm)</div>
                <div class="transform-inputs">
                    <div class="axis-input">
                        <span class="axis-input-label">Width</span>
                        <input type="number" class="axis-value" value="${dims.width || 20}"
                               step="1" min="0.1" onchange="updateDimension('width', this.value)">
                    </div>
                    <div class="axis-input">
                        <span class="axis-input-label">Depth</span>
                        <input type="number" class="axis-value" value="${dims.depth || 20}"
                               step="1" min="0.1" onchange="updateDimension('depth', this.value)">
                    </div>
                    <div class="axis-input">
                        <span class="axis-input-label">Height</span>
                        <input type="number" class="axis-value" value="${dims.height || 20}"
                               step="1" min="0.1" onchange="updateDimension('height', this.value)">
                    </div>
                </div>
            </div>
        `;
    } else if (selectedObject.type === 'csg') {
        // CSG objects don't have editable dimensions - only scale
        dimensionsHTML = '';
    }

    content.innerHTML = `
        <div class="property-group">
            <div class="property-label">Name</div>
            <input type="text" class="property-input" value="${selectedObject.name}"
                   onchange="updateObjectName(this.value)">
        </div>

        <!-- Size Section (Always Open) -->
        ${dimensionsHTML}

        <!-- Appearance Section -->
        <div class="property-section">
            <div class="section-header" onclick="toggleSection('appearance')">
                <span class="section-icon" id="appearance-icon">${sectionStates.appearance ? '▼' : '▶'}</span>
                <span class="section-title">🎨 Appearance</span>
            </div>
            <div class="section-content${sectionStates.appearance ? '' : ' collapsed'}" id="appearance-content">
                <div class="property-group">
                    <div class="property-label">Color</div>
                    <input type="color" id="color-picker" value="${hexColor}"
                           oninput="updateColorPreview(this.value)"
                           onchange="updateColorFinal(this.value)"
                           style="width: 100%; height: 40px; cursor: pointer;">
                </div>

                <div class="property-group">
                    <div class="property-label">Opacity: <span id="opacity-value">${Math.round((selectedObject.opacity !== undefined ? selectedObject.opacity : 1) * 100)}%</span></div>
                    <input type="range" class="quality-slider" value="${Math.round((selectedObject.opacity !== undefined ? selectedObject.opacity : 1) * 100)}"
                           min="0" max="100" step="5" oninput="updateOpacityLive(this.value)" onchange="updateOpacity(this.value)">
                </div>

                <div class="property-group">
                    <label style="display: flex; align-items: center; cursor: pointer; user-select: none;">
                        <input type="checkbox" id="show-edges-checkbox"
                               ${selectedObject.showEdges ? 'checked' : ''}
                               onchange="toggleEdges(this.checked)"
                               style="margin-right: 8px; width: 16px; height: 16px; cursor: pointer;">
                        <span>Show Edges</span>
                    </label>
                </div>
            </div>
        </div>

        <!-- Transform Section -->
        <div class="property-section">
            <div class="section-header" onclick="toggleSection('transform')">
                <span class="section-icon" id="transform-icon">${sectionStates.transform ? '▼' : '▶'}</span>
                <span class="section-title">📐 Position & Rotation</span>
            </div>
            <div class="section-content${sectionStates.transform ? '' : ' collapsed'}" id="transform-content">
                <div class="property-group">
                    <div class="property-label">Position (mm)</div>
                    <div class="transform-inputs">
                        <div class="axis-input">
                            <span class="axis-input-label" style="color: #ff6666;">X</span>
                            <input type="number" class="axis-value" value="${(pos.x / UNIT_SCALE).toFixed(1)}"
                                   step="10" onchange="updatePosition('x', this.value)">
                        </div>
                        <div class="axis-input">
                            <span class="axis-input-label" style="color: #66ff66;">Y</span>
                            <input type="number" class="axis-value" value="${(pos.y / UNIT_SCALE).toFixed(1)}"
                                   step="10" onchange="updatePosition('y', this.value)">
                        </div>
                        <div class="axis-input">
                            <span class="axis-input-label" style="color: #6666ff;">Z</span>
                            <input type="number" class="axis-value" value="${(pos.z / UNIT_SCALE).toFixed(1)}"
                                   step="10" onchange="updatePosition('z', this.value)">
                        </div>
                    </div>
                    <button onclick="dropToWorkplane()" style="width: 100%; padding: 8px; margin-top: 8px; background: rgba(100, 149, 237, 0.2); border: 1px solid rgba(100, 149, 237, 0.5); color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        ⬇️ Drop to Workplane
                    </button>
                </div>

                <div class="property-group">
                    <div class="property-label">Rotation (deg)</div>
                    <div class="transform-inputs">
                        <div class="axis-input">
                            <span class="axis-input-label" style="color: #ff6666;">X</span>
                            <input type="number" class="axis-value" value="${(rot.x * 180 / Math.PI).toFixed(0)}"
                                   step="15" onchange="updateRotation('x', this.value)">
                        </div>
                        <div class="axis-input">
                            <span class="axis-input-label" style="color: #66ff66;">Y</span>
                            <input type="number" class="axis-value" value="${(rot.y * 180 / Math.PI).toFixed(0)}"
                                   step="15" onchange="updateRotation('y', this.value)">
                        </div>
                        <div class="axis-input">
                            <span class="axis-input-label" style="color: #6666ff;">Z</span>
                            <input type="number" class="axis-value" value="${(rot.z * 180 / Math.PI).toFixed(0)}"
                                   step="15" onchange="updateRotation('z', this.value)">
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Advanced Section -->
        <div class="property-section">
            <div class="section-header" onclick="toggleSection('advanced')">
                <span class="section-icon" id="advanced-icon">${sectionStates.advanced ? '▼' : '▶'}</span>
                <span class="section-title">⚙️ Advanced</span>
            </div>
            <div class="section-content${sectionStates.advanced ? '' : ' collapsed'}" id="advanced-content">
                <div class="property-group">
                    <div class="property-label">Scale</div>
                    <div class="transform-inputs">
                        <div class="axis-input">
                            <span class="axis-input-label">X</span>
                            <input type="number" class="axis-value" value="${scale.x.toFixed(2)}"
                                   step="0.1" min="0.1" onchange="updateScale('x', this.value)">
                        </div>
                        <div class="axis-input">
                            <span class="axis-input-label">Y</span>
                            <input type="number" class="axis-value" value="${scale.y.toFixed(2)}"
                                   step="0.1" min="0.1" onchange="updateScale('y', this.value)">
                        </div>
                        <div class="axis-input">
                            <span class="axis-input-label">Z</span>
                            <input type="number" class="axis-value" value="${scale.z.toFixed(2)}"
                                   step="0.1" min="0.1" onchange="updateScale('z', this.value)">
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Property update functions
function updateObjectName(name) {
    if (selectedObject && name.trim()) {
        selectedObject.name = name.trim();
        updateObjectsList();
        saveState('Rename');
    }
}

function updatePosition(axis, value) {
    if (!selectedObject) return;
    // Convert from mm to Babylon units (mm * 0.1 = Babylon units)
    selectedObject.mesh.position[axis] = parseFloat(value) * UNIT_SCALE;
    saveState('Position');
}

function updateRotation(axis, value) {
    if (!selectedObject) return;
    selectedObject.mesh.rotation[axis] = parseFloat(value) * Math.PI / 180;
    saveState('Rotation');
}

function updateScale(axis, value) {
    if (!selectedObject) return;
    const val = Math.max(0.1, parseFloat(value));
    selectedObject.mesh.scaling[axis] = val;
    saveState('Scale');
}

function updateDimension(dimension, value) {
    if (!selectedObject || !selectedObject.dimensions) return;

    let val = parseFloat(value);

    // Cap quality at 48 to prevent huge file sizes on export
    if (dimension === 'quality') {
        val = Math.min(48, Math.max(3, val));
    } else {
        val = Math.max(0.1, val);
    }

    selectedObject.dimensions[dimension] = val;

    // Rebuild the mesh with new dimensions
    rebuildMesh(selectedObject);
    saveState('Resize');
    // Don't call updateProperties() here - it destroys input elements during interaction
    // The display is already updated by updateQualityDisplay() or the input's onchange
}

function rebuildMesh(obj, overridePosition) {
    const oldMesh = obj.mesh;
    const pos = overridePosition ? overridePosition : oldMesh.position.clone();
    const rot = oldMesh.rotation.clone();

    let newMesh;

    switch(obj.type) {
        case 'box':
            // IMPORTANT: Babylon.js CreateBox uses Y-up parameter names
            // In our Z-up system: X=width, Y=depth, Z=height
            // So we swap depth/height parameters for CreateBox
            newMesh = BABYLON.MeshBuilder.CreateBox(oldMesh.name, {
                width: obj.dimensions.width * UNIT_SCALE,   // X axis - our width
                height: obj.dimensions.depth * UNIT_SCALE,  // Y axis - our depth
                depth: obj.dimensions.height * UNIT_SCALE   // Z axis - our height
            }, scene);
            break;
        case 'sphere':
            newMesh = BABYLON.MeshBuilder.CreateSphere(oldMesh.name, {
                diameter: obj.dimensions.radius * 2 * UNIT_SCALE,
                segments: obj.dimensions.quality || 32
            }, scene);
            break;
        case 'cylinder':
            newMesh = BABYLON.MeshBuilder.CreateCylinder(oldMesh.name, {
                height: obj.dimensions.height * UNIT_SCALE,
                diameterTop: obj.dimensions.radius * 2 * UNIT_SCALE,
                diameterBottom: obj.dimensions.radius * 2 * UNIT_SCALE,
                tessellation: obj.dimensions.quality || 32
            }, scene);
            newMesh.rotation.x = Math.PI / 2;
            break;
        case 'cone':
            newMesh = BABYLON.MeshBuilder.CreateCylinder(oldMesh.name, {
                height: obj.dimensions.height * UNIT_SCALE,
                diameterTop: obj.dimensions.topRadius * 2 * UNIT_SCALE,
                diameterBottom: obj.dimensions.bottomRadius * 2 * UNIT_SCALE,
                tessellation: obj.dimensions.quality || 32
            }, scene);
            newMesh.rotation.x = Math.PI / 2;
            break;
        case 'torus':
            newMesh = BABYLON.MeshBuilder.CreateTorus(oldMesh.name, {
                diameter: obj.dimensions.diameter * UNIT_SCALE,
                thickness: obj.dimensions.thickness * UNIT_SCALE,
                tessellation: obj.dimensions.quality || 32
            }, scene);
            newMesh.rotation.x = Math.PI / 2;
            break;
        case 'pyramid':
            newMesh = BABYLON.MeshBuilder.CreateCylinder(oldMesh.name, {
                height: obj.dimensions.height * UNIT_SCALE,
                diameterTop: 0,
                diameterBottom: obj.dimensions.baseSize * UNIT_SCALE * 1.4142,
                tessellation: 4
            }, scene);
            newMesh.rotation.x = Math.PI / 2;
            newMesh.rotation.z = Math.PI / 4;
            break;
        case 'capsule':
            newMesh = BABYLON.MeshBuilder.CreateCapsule(oldMesh.name, {
                radius: obj.dimensions.radius * UNIT_SCALE,
                height: obj.dimensions.height * UNIT_SCALE,
                tessellation: obj.dimensions.quality || 16
            }, scene);
            newMesh.rotation.x = Math.PI / 2;
            break;
        case 'tube':
            const outerCyl = BABYLON.MeshBuilder.CreateCylinder('outer', {
                height: obj.dimensions.height * UNIT_SCALE,
                diameter: obj.dimensions.outerRadius * 2 * UNIT_SCALE,
                tessellation: obj.dimensions.quality || 32
            }, scene);
            const innerCyl = BABYLON.MeshBuilder.CreateCylinder('inner', {
                height: obj.dimensions.height * UNIT_SCALE * 1.1,
                diameter: obj.dimensions.innerRadius * 2 * UNIT_SCALE,
                tessellation: obj.dimensions.quality || 32
            }, scene);
            const outerCSG = BABYLON.CSG.FromMesh(outerCyl);
            const innerCSG = BABYLON.CSG.FromMesh(innerCyl);
            const tubeCSG = outerCSG.subtract(innerCSG);
            newMesh = tubeCSG.toMesh(oldMesh.name, null, scene);
            outerCyl.dispose();
            innerCyl.dispose();
            newMesh.rotation.x = Math.PI / 2;
            break;
        case 'wedge':
            const w = obj.dimensions.width * UNIT_SCALE / 2;
            const d = obj.dimensions.depth * UNIT_SCALE / 2;
            const h = obj.dimensions.height * UNIT_SCALE;

            const positions = [
                -w, -d, 0,  w, -d, 0,  w,  d, 0, -w,  d, 0,
                -w,  d, h,  w,  d, h
            ];

            const indices = [
                0, 2, 1,  0, 3, 2,
                0, 1, 5,  0, 5, 4,
                0, 4, 3,
                1, 2, 5,
                3, 4, 5,  3, 5, 2
            ];

            const normals = [];
            BABYLON.VertexData.ComputeNormals(positions, indices, normals);

            const vertexData = new BABYLON.VertexData();
            vertexData.positions = positions;
            vertexData.indices = indices;
            vertexData.normals = normals;

            newMesh = new BABYLON.Mesh(oldMesh.name, scene);
            vertexData.applyToMesh(newMesh);
            break;
    }

    // Apply material and transforms
    newMesh.material = oldMesh.material;
    newMesh.position = pos;
    newMesh.rotation = rot;

    // Ensure wedge backface culling is disabled
    if (obj.type === 'wedge' && newMesh.material) {
        newMesh.material.backFaceCulling = false;
    }

    // Restore opacity settings
    if (obj.opacity !== undefined && obj.opacity < 1) {
        newMesh.material.alpha = obj.opacity;
        newMesh.material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
        newMesh.material.disableDepthWrite = false;
        newMesh.material.needDepthPrePass = true;
        newMesh.renderingGroupId = 1;
    }

    // Dispose old wireframe clone if it exists
    if (obj.wireframeClone) {
        obj.wireframeClone.dispose();
        obj.wireframeClone = null;
    }

    // Dispose old mesh and update reference
    oldMesh.dispose();
    obj.mesh = newMesh;

    // Restore edge rendering (wireframe overlay)
    if (obj.showEdges) {
        const wireframe = newMesh.clone(newMesh.name + '_wireframe');
        const wireMat = new BABYLON.StandardMaterial('wireMat_' + obj.id, scene);
        wireMat.wireframe = true;
        wireMat.emissiveColor = new BABYLON.Color3(0, 0, 0);
        wireMat.disableLighting = true;
        wireMat.alpha = 1.0; // Always fully opaque
        wireframe.material = wireMat;
        wireframe.parent = newMesh;
        // Reset local transform (inherits from parent)
        wireframe.position = new BABYLON.Vector3(0, 0, 0);
        wireframe.rotation = new BABYLON.Vector3(0, 0, 0);
        wireframe.scaling = new BABYLON.Vector3(1, 1, 1);
        // Match parent's rendering group
        wireframe.renderingGroupId = newMesh.renderingGroupId || 0;
        obj.wireframeClone = wireframe;
    }

    // Reattach gizmo or recreate handles if this is the selected object
    if (selectedObject === obj) {
        if (currentTransformMode === 'size') {
            createSizeHandles(obj);
        } else {
            gizmoManager.attachToMesh(newMesh);
        }
    }
}

// Live preview while dragging (no save state)
function updateColorPreview(hexColor) {
    if (!selectedObject) return;
    const r = parseInt(hexColor.substr(1, 2), 16) / 255;
    const g = parseInt(hexColor.substr(3, 2), 16) / 255;
    const b = parseInt(hexColor.substr(5, 2), 16) / 255;

    selectedObject.color = new BABYLON.Color3(r, g, b);
    selectedObject.mesh.material.diffuseColor = selectedObject.color;
    // No saveState here - prevents lag during drag
}

// Final save when color picker is closed
function updateColorFinal(hexColor) {
    if (!selectedObject) return;
    const r = parseInt(hexColor.substr(1, 2), 16) / 255;
    const g = parseInt(hexColor.substr(3, 2), 16) / 255;
    const b = parseInt(hexColor.substr(5, 2), 16) / 255;

    selectedObject.color = new BABYLON.Color3(r, g, b);
    selectedObject.mesh.material.diffuseColor = selectedObject.color;
    saveState('Color'); // Only save once when done
}

// Legacy function for backward compatibility
function updateColor(hexColor) {
    updateColorFinal(hexColor);
}

// Update quality display in real-time
function updateQualityDisplay(value) {
    const qualityLabel = document.getElementById('quality-value');
    if (qualityLabel) {
        qualityLabel.textContent = value;
    }
}

// Drop object to workplane (base touches Z=0)
function dropToWorkplane() {
    if (!selectedObject || !selectedObject.mesh) return;

    // Get bounding box to find the lowest point
    const boundingInfo = selectedObject.mesh.getBoundingInfo();
    const minZ = boundingInfo.boundingBox.minimumWorld.z;

    // Calculate how much to move up (or down if below workplane)
    const offset = -minZ;

    // Move the object
    selectedObject.mesh.position.z += offset;

    // Update size handles if in size mode
    if (currentTransformMode === 'size' && selectedObject.type === 'box') {
        updateSizeHandles(selectedObject);
    }

    // Save state and update UI
    saveState('Drop to Workplane');
    updateProperties();
    showToast('Dropped to workplane');
}

// Update opacity live (during slider drag) - no undo state saved
function updateOpacityLive(value) {
    if (!selectedObject) return;

    // Update display label
    const opacityLabel = document.getElementById('opacity-value');
    if (opacityLabel) {
        opacityLabel.textContent = value + '%';
    }

    const opacity = parseFloat(value) / 100; // Convert 0-100 to 0-1
    selectedObject.opacity = opacity;

    // Apply to material
    selectedObject.mesh.material.alpha = opacity;

    // Enable transparency mode if opacity < 1
    if (opacity < 1) {
        selectedObject.mesh.material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
        // Prevent z-fighting/flickering when rotating
        selectedObject.mesh.material.disableDepthWrite = false;
        selectedObject.mesh.material.needDepthPrePass = true;
        // Render transparent objects after ground plane (group 0)
        selectedObject.mesh.renderingGroupId = 1;
    } else {
        selectedObject.mesh.material.transparencyMode = null;
        selectedObject.mesh.material.disableDepthWrite = false;
        selectedObject.mesh.material.needDepthPrePass = false;
        selectedObject.mesh.renderingGroupId = 0;
    }

    // Update wireframe rendering group if it exists
    if (selectedObject.wireframeClone) {
        selectedObject.wireframeClone.renderingGroupId = selectedObject.mesh.renderingGroupId || 0;
    }
}

// Update object opacity (final value when slider is released) - saves undo state
function updateOpacity(value) {
    if (!selectedObject) return;

    // Apply the final opacity value
    updateOpacityLive(value);

    // Save state for undo/redo (only once when slider is released)
    saveState('Change Opacity');
}

// Toggle edge rendering using wireframe overlay
function toggleEdges(enabled) {
    if (!selectedObject) return;

    selectedObject.showEdges = enabled;

    if (enabled) {
        // Create a wireframe clone overlay for better edge visibility
        // This shows ALL edges on ALL shapes (perfect for seeing intersections)
        if (!selectedObject.wireframeClone) {
            const wireframe = selectedObject.mesh.clone(selectedObject.mesh.name + '_wireframe');

            // Create wireframe material
            const wireMat = new BABYLON.StandardMaterial('wireMat_' + selectedObject.id, scene);
            wireMat.wireframe = true;
            wireMat.emissiveColor = new BABYLON.Color3(0, 0, 0); // Black wireframe
            wireMat.disableLighting = true;
            wireMat.alpha = 1.0; // Always fully opaque, even if parent is transparent

            wireframe.material = wireMat;
            wireframe.parent = selectedObject.mesh; // Parent so it moves with the object

            // Reset local transform (inherits from parent)
            wireframe.position = new BABYLON.Vector3(0, 0, 0);
            wireframe.rotation = new BABYLON.Vector3(0, 0, 0);
            wireframe.scaling = new BABYLON.Vector3(1, 1, 1);

            // Match parent's rendering group (important for transparent objects)
            wireframe.renderingGroupId = selectedObject.mesh.renderingGroupId || 0;

            selectedObject.wireframeClone = wireframe;
        }
        selectedObject.wireframeClone.setEnabled(true);
    } else {
        // Hide wireframe overlay
        if (selectedObject.wireframeClone) {
            selectedObject.wireframeClone.setEnabled(false);
        }
    }

    saveState('Toggle Edges');
}

// Toggle collapsible sections
function toggleSection(sectionId) {
    const content = document.getElementById(sectionId + '-content');
    const icon = document.getElementById(sectionId + '-icon');

    if (content && icon) {
        const isCollapsed = content.classList.contains('collapsed');
        content.classList.toggle('collapsed');
        icon.textContent = isCollapsed ? '▼' : '▶';

        // Save the state so it persists when updateProperties() is called
        if (sectionStates.hasOwnProperty(sectionId)) {
            sectionStates[sectionId] = isCollapsed; // isCollapsed becomes the new expanded state
        }
    }
}

