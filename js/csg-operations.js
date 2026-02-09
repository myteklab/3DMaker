/**
 * 3DMaker - CSG Operations
 * Union, subtract, intersect operations
 */

// Helper function to deep clone object data (without mesh references)
// Handles both live objects (with .mesh) and already-cloned data objects
function cloneObjectData(obj) {
    const hasMesh = !!obj.mesh;

    return {
        id: obj.id,
        type: obj.type,
        name: obj.name,
        color: { r: obj.color.r, g: obj.color.g, b: obj.color.b },
        opacity: obj.opacity !== undefined ? obj.opacity : 1.0,
        showEdges: obj.showEdges !== undefined ? obj.showEdges : false,
        dimensions: obj.dimensions ? { ...obj.dimensions } : null,
        position: hasMesh
            ? { x: obj.mesh.position.x, y: obj.mesh.position.y, z: obj.mesh.position.z }
            : { x: obj.position.x, y: obj.position.y, z: obj.position.z },
        rotation: hasMesh
            ? { x: obj.mesh.rotation.x, y: obj.mesh.rotation.y, z: obj.mesh.rotation.z }
            : { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
        scaling: (obj.type === 'csg' || obj.type === 'text') ? (
            hasMesh
                ? { x: obj.mesh.scaling.x, y: obj.mesh.scaling.y, z: obj.mesh.scaling.z }
                : (obj.scaling ? { x: obj.scaling.x, y: obj.scaling.y, z: obj.scaling.z } : null)
        ) : null,
        geometry: (obj.type === 'csg' || obj.type === 'text') ? (
            hasMesh
                ? {
                    positions: Array.from(obj.mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind)).map(v => parseFloat(v.toFixed(4))),
                    indices: Array.from(obj.mesh.getIndices()),
                    normals: Array.from(obj.mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind)).map(v => parseFloat(v.toFixed(4)))
                }
                : obj.geometry ? {
                    positions: Array.from(obj.geometry.positions),
                    indices: Array.from(obj.geometry.indices),
                    normals: Array.from(obj.geometry.normals)
                } : null
        ) : null,
        // For text objects, save text-specific data
        textContent: obj.textContent || null,
        fontSize: obj.fontSize || null,
        // For nested CSG, preserve child operands
        operation: obj.operation || null,
        operands: obj.operands ? obj.operands.map(op => cloneObjectData(op)) : null
    };
}

function updateCSGButtons() {
    const enabled = selectedObjects.length >= 2;
    const count = selectedObjects.length;
    const unionBtn = document.getElementById('union-btn');
    const subtractBtn = document.getElementById('subtract-btn');
    const intersectBtn = document.getElementById('intersect-btn');

    unionBtn.disabled = !enabled;
    subtractBtn.disabled = !enabled;
    intersectBtn.disabled = !enabled;

    // SVG icon templates
    const unionIcon = `<svg class="csg-icon" viewBox="0 0 48 48" stroke="currentColor" stroke-width="2.5">
        <circle cx="18" cy="24" r="10" fill="rgba(102, 126, 234, 0.3)" stroke="#667eea"/>
        <circle cx="30" cy="24" r="10" fill="rgba(102, 126, 234, 0.3)" stroke="#667eea"/>
    </svg>`;

    const subtractIcon = `<svg class="csg-icon" viewBox="0 0 48 48" stroke="currentColor" stroke-width="2.5">
        <circle cx="20" cy="24" r="12" fill="rgba(102, 126, 234, 0.3)" stroke="#667eea"/>
        <circle cx="28" cy="24" r="8" fill="none" stroke="#667eea" stroke-dasharray="3,3"/>
    </svg>`;

    const intersectIcon = `<svg class="csg-icon" viewBox="0 0 48 48" stroke="currentColor" stroke-width="2.5">
        <circle cx="18" cy="24" r="10" fill="none" stroke="#667eea" stroke-dasharray="3,3" opacity="0.4"/>
        <circle cx="30" cy="24" r="10" fill="none" stroke="#667eea" stroke-dasharray="3,3" opacity="0.4"/>
        <ellipse cx="24" cy="24" rx="4" ry="10" fill="rgba(102, 126, 234, 0.6)" stroke="#667eea"/>
    </svg>`;

    if (enabled) {
        if (count === 2) {
            unionBtn.innerHTML = `${unionIcon}<span>Union (1+2)</span>`;
            subtractBtn.innerHTML = `${subtractIcon}<span>Subtract (1−2)</span>`;
            intersectBtn.innerHTML = `${intersectIcon}<span>Intersect</span>`;
        } else {
            unionBtn.innerHTML = `${unionIcon}<span>Union (${count})</span>`;
            subtractBtn.innerHTML = `${subtractIcon}<span>Subtract (${count})</span>`;
            intersectBtn.innerHTML = `${intersectIcon}<span>Intersect (${count})</span>`;
        }
        unionBtn.title = 'Combine all selected shapes together';
        subtractBtn.title = 'Remove all other shapes from 1st shape';
        intersectBtn.title = 'Keep only overlapping parts';
    } else {
        unionBtn.innerHTML = `${unionIcon}<span>Union</span>`;
        subtractBtn.innerHTML = `${subtractIcon}<span>Subtract</span>`;
        intersectBtn.innerHTML = `${intersectIcon}<span>Intersect</span>`;
        unionBtn.title = 'Select 2+ objects to merge';
        subtractBtn.title = 'Select 2+ objects to subtract';
        intersectBtn.title = 'Select 2+ objects to intersect';
    }
}


// Create a temporary mesh from stored operand data for CSG tree rebuilding.
// Returns a bare mesh (no material) — caller must dispose when done.
function _createTempMeshForCSG(data) {
    let mesh;

    if (data.geometry) {
        mesh = new BABYLON.Mesh('csg_temp', scene);
        const vertexData = new BABYLON.VertexData();
        vertexData.positions = data.geometry.positions;
        vertexData.indices = data.geometry.indices;
        vertexData.normals = data.geometry.normals;
        vertexData.applyToMesh(mesh);
    } else {
        const dims = data.dimensions || {};
        switch (data.type) {
            case 'box': {
                mesh = BABYLON.MeshBuilder.CreateBox('csg_temp', {
                    width: (dims.width || 20) * UNIT_SCALE,
                    depth: (dims.depth || 20) * UNIT_SCALE,
                    height: (dims.height || 20) * UNIT_SCALE
                }, scene);
                break;
            }
            case 'sphere': {
                mesh = BABYLON.MeshBuilder.CreateSphere('csg_temp', {
                    diameter: (dims.radius || 10) * 2 * UNIT_SCALE,
                    segments: dims.quality || 32
                }, scene);
                break;
            }
            case 'cylinder': {
                mesh = BABYLON.MeshBuilder.CreateCylinder('csg_temp', {
                    height: (dims.height || 20) * UNIT_SCALE,
                    diameterTop: (dims.radius || 10) * 2 * UNIT_SCALE,
                    diameterBottom: (dims.radius || 10) * 2 * UNIT_SCALE,
                    tessellation: dims.quality || 32
                }, scene);
                mesh.rotation.x = Math.PI / 2;
                break;
            }
            case 'cone': {
                const coneTopR = (dims.topRadius !== undefined ? dims.topRadius : 0);
                const coneBotR = (dims.bottomRadius !== undefined ? dims.bottomRadius : (dims.radius || 10));
                mesh = BABYLON.MeshBuilder.CreateCylinder('csg_temp', {
                    height: (dims.height || 20) * UNIT_SCALE,
                    diameterTop: coneTopR * 2 * UNIT_SCALE,
                    diameterBottom: coneBotR * 2 * UNIT_SCALE,
                    tessellation: dims.quality || 32
                }, scene);
                mesh.rotation.x = Math.PI / 2;
                break;
            }
            case 'torus': {
                mesh = BABYLON.MeshBuilder.CreateTorus('csg_temp', {
                    diameter: (dims.diameter || 20) * UNIT_SCALE,
                    thickness: (dims.thickness || 4) * UNIT_SCALE,
                    tessellation: dims.quality || 32
                }, scene);
                mesh.rotation.x = Math.PI / 2;
                break;
            }
            case 'pyramid': {
                mesh = BABYLON.MeshBuilder.CreateCylinder('csg_temp', {
                    height: (dims.height || 20) * UNIT_SCALE,
                    diameterTop: 0,
                    diameterBottom: (dims.baseSize || 20) * UNIT_SCALE * 1.4142,
                    tessellation: 4
                }, scene);
                mesh.rotation.x = Math.PI / 2;
                mesh.rotation.z = Math.PI / 4;
                break;
            }
            case 'capsule': {
                mesh = BABYLON.MeshBuilder.CreateCapsule('csg_temp', {
                    radius: (dims.radius || 5) * UNIT_SCALE,
                    height: (dims.height || 20) * UNIT_SCALE,
                    tessellation: dims.quality || 16
                }, scene);
                mesh.rotation.x = Math.PI / 2;
                break;
            }
            case 'tube': {
                const outerCyl = BABYLON.MeshBuilder.CreateCylinder('csg_outer', {
                    height: (dims.height || 20) * UNIT_SCALE,
                    diameter: (dims.outerRadius || 10) * 2 * UNIT_SCALE,
                    tessellation: dims.quality || 32
                }, scene);
                const innerCyl = BABYLON.MeshBuilder.CreateCylinder('csg_inner', {
                    height: (dims.height || 20) * UNIT_SCALE * 1.1,
                    diameter: (dims.innerRadius || 6) * 2 * UNIT_SCALE,
                    tessellation: dims.quality || 32
                }, scene);
                const outerC = BABYLON.CSG.FromMesh(outerCyl);
                const innerC = BABYLON.CSG.FromMesh(innerCyl);
                const tubeC = outerC.subtract(innerC);
                mesh = tubeC.toMesh('csg_temp', null, scene);
                outerCyl.dispose();
                innerCyl.dispose();
                mesh.rotation.x = Math.PI / 2;
                break;
            }
            default: {
                mesh = BABYLON.MeshBuilder.CreateBox('csg_temp', { size: 0.1 }, scene);
                break;
            }
        }
    }

    // Apply stored transforms
    mesh.position = new BABYLON.Vector3(data.position.x, data.position.y, data.position.z);
    mesh.rotation = new BABYLON.Vector3(data.rotation.x, data.rotation.y, data.rotation.z);
    if (data.scaling && !data.geometry) {
        mesh.scaling = new BABYLON.Vector3(data.scaling.x, data.scaling.y, data.scaling.z);
    }

    return mesh;
}

// Build a BABYLON.CSG from an object. For CSG results with stored operands,
// reconstructs the CSG tree from the original primitives to avoid BSP tree
// corruption that occurs when composite meshes are round-tripped through FromMesh.
function buildCSGForObject(obj) {
    if (obj.type !== 'csg' || !obj.operands || obj.operands.length < 2 || !obj.operation) {
        return BABYLON.CSG.FromMesh(obj.mesh);
    }

    console.log('Rebuilding CSG from operand tree for:', obj.name);
    const meshWorldMatrix = obj.mesh.computeWorldMatrix(true);
    const tempMeshes = [];
    try {
        return _rebuildCSGTree(obj.operands, obj.operation, meshWorldMatrix, tempMeshes);
    } finally {
        tempMeshes.forEach(m => m.dispose());
    }
}

// Recursively rebuild a CSG operation tree from stored operands
function _rebuildCSGTree(operands, operation, parentWorldMatrix, tempMeshes) {
    let result = _operandToCSG(operands[0], parentWorldMatrix, tempMeshes);
    for (let i = 1; i < operands.length; i++) {
        const nextCSG = _operandToCSG(operands[i], parentWorldMatrix, tempMeshes);
        switch (operation) {
            case 'union': result = result.union(nextCSG); break;
            case 'subtract': result = result.subtract(nextCSG); break;
            case 'intersect': result = result.intersect(nextCSG); break;
        }
    }
    return result;
}

// Convert a single operand (data) to a BABYLON.CSG, recursing for nested CSG
function _operandToCSG(data, parentWorldMatrix, tempMeshes) {
    // Nested CSG with operands — recurse to rebuild from primitives
    if (data.type === 'csg' && data.operands && data.operands.length >= 2 && data.operation) {
        // This operand's stored position/rotation is its mesh transform at clone time.
        // Compose with parent transform so nested operands end up in correct world space.
        const pos = new BABYLON.Vector3(data.position.x, data.position.y, data.position.z);
        const rot = BABYLON.Quaternion.FromEulerAngles(data.rotation.x, data.rotation.y, data.rotation.z);
        const scl = data.scaling
            ? new BABYLON.Vector3(data.scaling.x, data.scaling.y, data.scaling.z)
            : BABYLON.Vector3.One();
        const localMatrix = BABYLON.Matrix.Compose(scl, rot, pos);
        const combinedMatrix = localMatrix.multiply(parentWorldMatrix);

        return _rebuildCSGTree(data.operands, data.operation, combinedMatrix, tempMeshes);
    }

    // Leaf operand — create temp mesh and convert to CSG
    const tempMesh = _createTempMeshForCSG(data);
    tempMeshes.push(tempMesh);

    // Bake the operand's own transform into vertices (puts them in original world space),
    // then apply the parent CSG's world matrix so FromMesh positions them correctly.
    tempMesh.computeWorldMatrix(true);
    tempMesh.bakeCurrentTransformIntoVertices();

    const scaling = new BABYLON.Vector3();
    const rotation = new BABYLON.Quaternion();
    const translation = new BABYLON.Vector3();
    parentWorldMatrix.decompose(scaling, rotation, translation);
    tempMesh.position = translation;
    tempMesh.rotationQuaternion = rotation;
    tempMesh.scaling = scaling;

    return BABYLON.CSG.FromMesh(tempMesh);
}


function performCSG(operation) {
    if (selectedObjects.length < 2) {
        showToast('Select 2 or more objects', 'error');
        return;
    }

    try {
        // Debug logging
        console.log('=== CSG Operation:', operation, '===');
        selectedObjects.forEach((obj, i) => {
            const bounds = obj.mesh.getBoundingInfo().boundingBox;
            const min = bounds.minimumWorld;
            const max = bounds.maximumWorld;
            console.log(`Object ${i} (${obj.type}):`, {
                min: `(${min.x.toFixed(2)}, ${min.y.toFixed(2)}, ${min.z.toFixed(2)})`,
                max: `(${max.x.toFixed(2)}, ${max.y.toFixed(2)}, ${max.z.toFixed(2)})`,
                size: `${(max.x - min.x).toFixed(2)} x ${(max.y - min.y).toFixed(2)} x ${(max.z - min.z).toFixed(2)}`
            });
        });

        // Start with the first object as the base.
        // Use buildCSGForObject so CSG results are rebuilt from their
        // operand tree (clean primitives) instead of re-parsing the
        // composite mesh, which avoids BSP tree corruption on nested ops.
        let result = buildCSGForObject(selectedObjects[0]);

        // Apply operation with each subsequent object
        for (let i = 1; i < selectedObjects.length; i++) {
            const nextCSG = buildCSGForObject(selectedObjects[i]);

            switch(operation) {
                case 'union':
                    result = result.union(nextCSG);
                    break;
                case 'subtract':
                    result = result.subtract(nextCSG);
                    break;
                case 'intersect':
                    result = result.intersect(nextCSG);
                    break;
            }
        }

        // Create new mesh from result
        const resultMesh = result.toMesh(`object_${objectCounter}`, selectedObjects[0].mesh.material, scene);

        // Log result
        const resultBounds = resultMesh.getBoundingInfo().boundingBox;
        const rMin = resultBounds.minimumWorld;
        const rMax = resultBounds.maximumWorld;
        console.log('Result:', {
            min: `(${rMin.x.toFixed(2)}, ${rMin.y.toFixed(2)}, ${rMin.z.toFixed(2)})`,
            max: `(${rMax.x.toFixed(2)}, ${rMax.y.toFixed(2)}, ${rMax.z.toFixed(2)})`,
            size: `${(rMax.x - rMin.x).toFixed(2)} x ${(rMax.y - rMin.y).toFixed(2)} x ${(rMax.z - rMin.z).toFixed(2)}`
        });

        // Create new object with stored operands
        const operationName = operation.charAt(0).toUpperCase() + operation.slice(1);
        const newObj = {
            id: objectCounter,
            type: 'csg',
            name: `${operationName} ${objectCounter + 1}`,
            mesh: resultMesh,
            color: selectedObjects[0].color,
            opacity: 1.0,        // Default fully opaque
            showEdges: false,    // Default no edges
            wireframeClone: null, // Wireframe overlay (created when showEdges is enabled)
            operation: operation, // Store operation type (union, subtract, intersect)
            operands: selectedObjects.map(obj => cloneObjectData(obj)), // Store original shapes
            expanded: false      // For UI: whether child list is expanded
        };

        objects.push(newObj);
        objectCounter++;

        // Save count before clearing selection
        const count = selectedObjects.length;

        // Remove original objects
        selectedObjects.forEach(obj => {
            if (obj.wireframeClone) {
                obj.wireframeClone.dispose();
            }
            obj.mesh.dispose();
            const index = objects.indexOf(obj);
            if (index > -1) objects.splice(index, 1);
        });

        deselectAll();
        updateObjectsList();
        selectObject(newObj);
        saveState('CSG ' + operation);

        showToast(`${operationName} completed with ${count} objects!`);

    } catch (error) {
        console.error('CSG Error:', error);
        showToast('CSG operation failed', 'error');
    }
}

// Reverse a CSG operation - restore original shapes
function reverseCSG(csgId, event) {
    if (event) event.stopPropagation();

    const csgObj = objects.find(o => o.id === csgId);
    if (!csgObj || !csgObj.operands) {
        showToast('Cannot reverse this operation', 'error');
        return;
    }

    try {
        // Import the loadProjectData logic for recreating meshes
        // We'll restore each operand as a real object
        const restoredObjects = [];

        csgObj.operands.forEach(objData => {
            let mesh;
            let dimensions = objData.dimensions || null;

            if (objData.geometry) {
                // Restore CSG mesh from geometry
                mesh = new BABYLON.Mesh(`object_${objData.id}`, scene);
                const vertexData = new BABYLON.VertexData();
                vertexData.positions = objData.geometry.positions;
                vertexData.indices = objData.geometry.indices;
                vertexData.normals = objData.geometry.normals;
                vertexData.applyToMesh(mesh);
            } else {
                // Recreate primitive shape
                const dims = dimensions || {};
                switch(objData.type) {
                    case 'box':
                        const w = (dims.width || 20) * UNIT_SCALE;
                        const d = (dims.depth || 20) * UNIT_SCALE;
                        const h = (dims.height || 20) * UNIT_SCALE;
                        mesh = BABYLON.MeshBuilder.CreateBox(`object_${objData.id}`, {
                            width: w, depth: d, height: h
                        }, scene);
                        break;
                    case 'sphere':
                        const r = (dims.radius || 10) * UNIT_SCALE;
                        mesh = BABYLON.MeshBuilder.CreateSphere(`object_${objData.id}`, {
                            diameter: r * 2,
                            segments: dims.quality || 32
                        }, scene);
                        break;
                    case 'cylinder':
                        const cylR = (dims.radius || 10) * UNIT_SCALE;
                        const cylH = (dims.height || 20) * UNIT_SCALE;
                        mesh = BABYLON.MeshBuilder.CreateCylinder(`object_${objData.id}`, {
                            height: cylH,
                            diameterTop: cylR * 2,
                            diameterBottom: cylR * 2,
                            tessellation: dims.quality || 32
                        }, scene);
                        mesh.rotation.x = Math.PI / 2;
                        break;
                    case 'cone':
                        const coneTopR = (dims.topRadius !== undefined ? dims.topRadius : 0);
                        const coneBotR = (dims.bottomRadius !== undefined ? dims.bottomRadius : (dims.radius || 10));
                        const coneH = (dims.height || 20);
                        mesh = BABYLON.MeshBuilder.CreateCylinder(`object_${objData.id}`, {
                            height: coneH * UNIT_SCALE,
                            diameterTop: coneTopR * 2 * UNIT_SCALE,
                            diameterBottom: coneBotR * 2 * UNIT_SCALE,
                            tessellation: dims.quality || 32
                        }, scene);
                        mesh.rotation.x = Math.PI / 2;
                        break;
                    case 'torus':
                        const torusDiam = (dims.diameter || 20) * UNIT_SCALE;
                        const torusThick = (dims.thickness || 4) * UNIT_SCALE;
                        mesh = BABYLON.MeshBuilder.CreateTorus(`object_${objData.id}`, {
                            diameter: torusDiam,
                            thickness: torusThick,
                            tessellation: dims.quality || 32
                        }, scene);
                        mesh.rotation.x = Math.PI / 2;
                        break;
                    case 'pyramid':
                        const pyrBase = (dims.baseSize || 20);
                        const pyrH = (dims.height || 20);
                        mesh = BABYLON.MeshBuilder.CreateCylinder(`object_${objData.id}`, {
                            height: pyrH * UNIT_SCALE,
                            diameterTop: 0,
                            diameterBottom: pyrBase * UNIT_SCALE * 1.4142,
                            tessellation: 4
                        }, scene);
                        mesh.rotation.x = Math.PI / 2;
                        mesh.rotation.z = Math.PI / 4;
                        break;
                    case 'capsule':
                        const capR = (dims.radius || 5) * UNIT_SCALE;
                        const capH = (dims.height || 20) * UNIT_SCALE;
                        mesh = BABYLON.MeshBuilder.CreateCapsule(`object_${objData.id}`, {
                            radius: capR,
                            height: capH,
                            tessellation: dims.quality || 16
                        }, scene);
                        mesh.rotation.x = Math.PI / 2;
                        break;
                    case 'tube':
                        const tubeOuterR = (dims.outerRadius || 10);
                        const tubeInnerR = (dims.innerRadius || 6);
                        const tubeH = (dims.height || 20);
                        const tubeQuality = (dims.quality || 32);
                        const outerCyl = BABYLON.MeshBuilder.CreateCylinder('outer', {
                            height: tubeH * UNIT_SCALE,
                            diameter: tubeOuterR * 2 * UNIT_SCALE,
                            tessellation: tubeQuality
                        }, scene);
                        const innerCyl = BABYLON.MeshBuilder.CreateCylinder('inner', {
                            height: tubeH * UNIT_SCALE * 1.1,
                            diameter: tubeInnerR * 2 * UNIT_SCALE,
                            tessellation: tubeQuality
                        }, scene);
                        const outerCSG = BABYLON.CSG.FromMesh(outerCyl);
                        const innerCSG = BABYLON.CSG.FromMesh(innerCyl);
                        const tubeCSG = outerCSG.subtract(innerCSG);
                        mesh = tubeCSG.toMesh(`object_${objData.id}`, null, scene);
                        outerCyl.dispose();
                        innerCyl.dispose();
                        mesh.rotation.x = Math.PI / 2;
                        break;
                }
            }

            // Apply transforms
            mesh.position = new BABYLON.Vector3(objData.position.x, objData.position.y, objData.position.z);
            mesh.rotation = new BABYLON.Vector3(objData.rotation.x, objData.rotation.y, objData.rotation.z);

            // Don't apply scaling if object was restored from geometry -
            // CSG bakes transformations into the geometry
            if (objData.scaling && !objData.geometry) {
                mesh.scaling = new BABYLON.Vector3(objData.scaling.x, objData.scaling.y, objData.scaling.z);
            }

            // Material
            const material = new BABYLON.StandardMaterial(`mat_${objData.id}`, scene);
            const color = new BABYLON.Color3(objData.color.r, objData.color.g, objData.color.b);
            material.diffuseColor = color;
            material.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
            mesh.material = material;

            // Apply opacity
            const opacity = objData.opacity !== undefined ? objData.opacity : 1.0;
            material.alpha = opacity;
            if (opacity < 1) {
                material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
                material.disableDepthWrite = false;
                material.needDepthPrePass = true;
                mesh.renderingGroupId = 1;
            }

            // Apply edge rendering
            let wireframeClone = null;
            if (objData.showEdges) {
                const wireframe = mesh.clone(mesh.name + '_wireframe');
                const wireMat = new BABYLON.StandardMaterial('wireMat_' + objData.id, scene);
                wireMat.wireframe = true;
                wireMat.emissiveColor = new BABYLON.Color3(0, 0, 0);
                wireMat.disableLighting = true;
                wireMat.alpha = 1.0;
                wireframe.material = wireMat;
                wireframe.parent = mesh;
                wireframe.position = new BABYLON.Vector3(0, 0, 0);
                wireframe.rotation = new BABYLON.Vector3(0, 0, 0);
                wireframe.scaling = new BABYLON.Vector3(1, 1, 1);
                wireframe.renderingGroupId = mesh.renderingGroupId || 0;
                wireframeClone = wireframe;
            }

            // Create restored object
            const restoredObj = {
                id: objData.id,
                type: objData.type,
                name: objData.name,
                mesh: mesh,
                color: color,
                dimensions: dimensions, // Dimensions in millimeters for primitives, null for CSG
                opacity: opacity,
                showEdges: objData.showEdges,
                wireframeClone: wireframeClone,
                operation: objData.operation || null,
                operands: objData.operands || null,
                textContent: objData.textContent || null,
                fontSize: objData.fontSize || null,
                expanded: false
            };

            restoredObjects.push(restoredObj);
        });

        // Remove CSG object from scene
        if (csgObj.wireframeClone) {
            csgObj.wireframeClone.dispose();
        }
        csgObj.mesh.dispose();
        const csgIndex = objects.indexOf(csgObj);
        if (csgIndex > -1) {
            objects.splice(csgIndex, 1);
        }

        // Add restored objects to the scene
        restoredObjects.forEach(obj => {
            objects.push(obj);
            // Ensure objectCounter accounts for restored IDs
            objectCounter = Math.max(objectCounter, obj.id + 1);
        });

        deselectAll();
        updateObjectsList();

        // IMPORTANT: Save state after everything is updated
        // This ensures undo/redo can properly restore the reversed state
        saveState('Reverse CSG');

        showToast(`Reversed ${csgObj.operation} - restored ${restoredObjects.length} shapes!`);

    } catch (error) {
        console.error('Reverse CSG Error:', error);
        showToast('Failed to reverse operation', 'error');
    }
}

