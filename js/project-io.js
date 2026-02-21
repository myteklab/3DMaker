/**
 * 3DMaker - Project I/O
 * Serialize/deserialize scene data, delete objects, import/export (STL, GLTF/GLB)
 */

// Dropdown menu toggle
function toggleDropdown(id) {
    const menu = document.getElementById(id);
    const wasOpen = menu.classList.contains('open');
    // Close all dropdowns first
    document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('open'));
    if (!wasOpen) menu.classList.add('open');
}

// Close dropdowns when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('.menu-dropdown')) {
        document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('open'));
    }
});

function deleteObject(id, event) {
    if (event) event.stopPropagation();

    const index = objects.findIndex(o => o.id === id);
    if (index > -1) {
        const obj = objects[index];

        // Dispose wireframe clone if it exists
        if (obj.wireframeClone) {
            obj.wireframeClone.dispose();
        }

        obj.mesh.dispose();
        objects.splice(index, 1);

        if (selectedObject === obj) {
            deselectAll();
        }

        updateObjectsList();
        saveState('Delete');
        showToast('Object deleted');
    }
}


function getSceneData() {
    return {
        version: '1.0',
        camera: {
            alpha: camera.alpha,
            beta: camera.beta,
            radius: camera.radius,
            target: {
                x: camera.target.x,
                y: camera.target.y,
                z: camera.target.z
            }
        },
        objects: objects.map(obj => ({
            id: obj.id,
            type: obj.type,
            name: obj.name,
            position: {
                x: obj.mesh.position.x,
                y: obj.mesh.position.y,
                z: obj.mesh.position.z
            },
            rotation: {
                x: obj.mesh.rotation.x,
                y: obj.mesh.rotation.y,
                z: obj.mesh.rotation.z
            },
            dimensions: obj.dimensions || null,
            color: {
                r: obj.color.r,
                g: obj.color.g,
                b: obj.color.b
            },
            opacity: obj.opacity !== undefined ? obj.opacity : 1.0,
            showEdges: obj.showEdges !== undefined ? obj.showEdges : false,
            // For text objects, store text content, font size, and font file
            textContent: obj.textContent || null,
            fontSize: obj.fontSize || null,
            fontFile: obj.fontFile || null,
            // For CSG, text, and imported objects, store geometry and scaling
            // Use toFixed(4) for positions/normals to reduce file size (0.0001 units = 0.001mm precision)
            geometry: (obj.type === 'csg' || obj.type === 'text' || obj.type === 'imported') ? {
                positions: Array.from(obj.mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind)).map(v => parseFloat(v.toFixed(4))),
                indices: Array.from(obj.mesh.getIndices()),
                normals: Array.from(obj.mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind)).map(v => parseFloat(v.toFixed(4)))
            } : null,
            scaling: (obj.type === 'csg' || obj.type === 'text' || obj.type === 'imported') ? {
                x: obj.mesh.scaling.x,
                y: obj.mesh.scaling.y,
                z: obj.mesh.scaling.z
            } : null,
            // For CSG objects, store operation type and original shapes
            operation: obj.operation || null,
            operands: obj.operands || null
        }))
    };
}

// Platform-compatible serialize
window.serializeProjectData = function() {
    return JSON.stringify(getSceneData());
};

// Platform-compatible load
window.loadProjectData = async function(data) {
    if (typeof data === 'string') {
        data = JSON.parse(data);
    }
    await _loadSceneFromData(data);
    hasUnsavedChanges = false;
};

async function _loadSceneFromData(data) {
    if (typeof data === 'string') {
        data = JSON.parse(data);
    }

    // Clear existing objects
    objects.forEach(obj => {
        if (obj.wireframeClone) {
            obj.wireframeClone.dispose();
        }
        obj.mesh.dispose();
    });
    objects = [];
    objectCounter = 0;

    // Restore camera
    if (data.camera) {
        camera.alpha = data.camera.alpha;
        camera.beta = data.camera.beta;
        camera.radius = data.camera.radius;
        camera.target = new BABYLON.Vector3(
            data.camera.target.x,
            data.camera.target.y,
            data.camera.target.z
        );
        // Force camera to update its position based on new values
        camera.rebuildAnglesAndRadius();
    }

    // Restore objects
    for (const objData of data.objects) {
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
            // Create primitive shape with dimensions
            const dims = dimensions || {};
            switch(objData.type) {
                case 'box':
                    const w = (dims.width || 20) * UNIT_SCALE;
                    const d = (dims.depth || 20) * UNIT_SCALE;
                    const h = (dims.height || 20) * UNIT_SCALE;
                    mesh = BABYLON.MeshBuilder.CreateBox(`object_${objData.id}`, {
                        width: w, depth: d, height: h
                    }, scene);
                    if (!dimensions) dimensions = { width: w, depth: d, height: h };
                    break;
                case 'sphere':
                    const r = (dims.radius || 10) * UNIT_SCALE;
                    const sphereQuality = (dims.quality || 32);
                    mesh = BABYLON.MeshBuilder.CreateSphere(`object_${objData.id}`, {
                        diameter: r * 2,
                        segments: sphereQuality
                    }, scene);
                    if (!dimensions) dimensions = { radius: r, quality: sphereQuality };
                    break;
                case 'cylinder':
                    const cylR = (dims.radius || 10) * UNIT_SCALE;
                    const cylH = (dims.height || 20) * UNIT_SCALE;
                    const cylQuality = (dims.quality || 32);
                    mesh = BABYLON.MeshBuilder.CreateCylinder(`object_${objData.id}`, {
                        height: cylH,
                        diameterTop: cylR * 2,
                        diameterBottom: cylR * 2,
                        tessellation: cylQuality
                    }, scene);
                    mesh.rotation.x = Math.PI / 2;
                    if (!dimensions) dimensions = { radius: cylR, height: cylH, quality: cylQuality };
                    break;
                case 'cone':
                    const coneTopR = (dims.topRadius !== undefined ? dims.topRadius : 0);
                    const coneBotR = (dims.bottomRadius !== undefined ? dims.bottomRadius : (dims.radius || 10));
                    const coneH = (dims.height || 20);
                    const coneQuality = (dims.quality || 32);
                    mesh = BABYLON.MeshBuilder.CreateCylinder(`object_${objData.id}`, {
                        height: coneH * UNIT_SCALE,
                        diameterTop: coneTopR * 2 * UNIT_SCALE,
                        diameterBottom: coneBotR * 2 * UNIT_SCALE,
                        tessellation: coneQuality
                    }, scene);
                    mesh.rotation.x = Math.PI / 2;
                    if (!dimensions) dimensions = { topRadius: coneTopR, bottomRadius: coneBotR, height: coneH, quality: coneQuality };
                    // Backward compatibility: convert old 'radius' to 'bottomRadius'
                    if (dimensions.radius && !dimensions.bottomRadius) {
                        dimensions.bottomRadius = dimensions.radius;
                        dimensions.topRadius = 0;
                        delete dimensions.radius;
                    }
                    break;
                case 'torus':
                    const torusDiam = (dims.diameter || 20) * UNIT_SCALE;
                    const torusThick = (dims.thickness || 4) * UNIT_SCALE;
                    const torusQuality = (dims.quality || 32);
                    mesh = BABYLON.MeshBuilder.CreateTorus(`object_${objData.id}`, {
                        diameter: torusDiam,
                        thickness: torusThick,
                        tessellation: torusQuality
                    }, scene);
                    mesh.rotation.x = Math.PI / 2;
                    if (!dimensions) dimensions = { diameter: torusDiam / UNIT_SCALE, thickness: torusThick / UNIT_SCALE, quality: torusQuality };
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
                    if (!dimensions) dimensions = { baseSize: pyrBase, height: pyrH };
                    break;
                case 'capsule':
                    const capR = (dims.radius || 5) * UNIT_SCALE;
                    const capH = (dims.height || 20) * UNIT_SCALE;
                    const capQuality = (dims.quality || 16);
                    mesh = BABYLON.MeshBuilder.CreateCapsule(`object_${objData.id}`, {
                        radius: capR,
                        height: capH,
                        tessellation: capQuality
                    }, scene);
                    mesh.rotation.x = Math.PI / 2;
                    if (!dimensions) dimensions = { radius: capR / UNIT_SCALE, height: capH / UNIT_SCALE, quality: capQuality };
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
                    if (!dimensions) dimensions = { outerRadius: tubeOuterR, innerRadius: tubeInnerR, height: tubeH, quality: tubeQuality };
                    break;
                case 'text':
                    // Recreate text mesh from saved data
                    const textContent = objData.textContent || 'Text';
                    const textDepth = (dims.depth || 5);
                    const textSize = objData.fontSize || 10;
                    const textFont = objData.fontFile || 'Roboto-Regular.ttf';

                    mesh = await createBabylonText(textContent, textSize, textDepth, textFont);
                    if (!mesh) {
                        console.error('Failed to recreate text mesh for:', textContent);
                        continue; // Skip this object if mesh creation failed
                    }
                    if (!dimensions) dimensions = { width: dims.width, height: dims.height, depth: textDepth };
                    break;
            }
        }

        // Apply transforms
        mesh.position = new BABYLON.Vector3(objData.position.x, objData.position.y, objData.position.z);
        mesh.rotation = new BABYLON.Vector3(objData.rotation.x, objData.rotation.y, objData.rotation.z);

        // Apply scaling only for CSG objects (they don't have dimensions)
        if (objData.scaling) {
            mesh.scaling = new BABYLON.Vector3(objData.scaling.x, objData.scaling.y, objData.scaling.z);
        }

        // Material
        const material = new BABYLON.StandardMaterial(`mat_${objData.id}`, scene);
        const color = new BABYLON.Color3(objData.color.r, objData.color.g, objData.color.b);
        material.diffuseColor = color;
        material.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);

        // Imported STL meshes need double-sided rendering
        if (objData.type === 'imported') {
            material.backFaceCulling = false;
        }

        mesh.material = material;

        // Apply opacity if saved (default to 1.0 for backward compatibility)
        const opacity = objData.opacity !== undefined ? objData.opacity : 1.0;
        material.alpha = opacity;
        if (opacity < 1) {
            material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
            material.disableDepthWrite = false;
            material.needDepthPrePass = true;
            mesh.renderingGroupId = 1;
        }

        // Apply edge rendering if saved (default to false for backward compatibility)
        const showEdges = objData.showEdges !== undefined ? objData.showEdges : false;
        let wireframeClone = null;
        if (showEdges) {
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

        // Store object with dimensions
        const obj = {
            id: objData.id,
            type: objData.type,
            name: objData.name,
            mesh: mesh,
            color: color,
            dimensions: dimensions,
            opacity: opacity,
            showEdges: showEdges,
            wireframeClone: wireframeClone,
            operation: objData.operation || null,
            operands: objData.operands || null,
            textContent: objData.textContent || null,
            fontSize: objData.fontSize || null,
            expanded: false
        };

        objects.push(obj);
        objectCounter = Math.max(objectCounter, objData.id + 1);
    }

    updateObjectsList();
    deselectAll();
}

// Export STL to user's files
async function exportSTL() {
    if (objects.length === 0) {
        showToast('Add some objects first!', 'error');
        return;
    }

    try {
        showToast('Generating STL...');

        let stlString = 'solid model\n';

        objects.forEach(obj => {
            const positions = obj.mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
            const indices = obj.mesh.getIndices();
            const worldMatrix = obj.mesh.getWorldMatrix();

            for (let i = 0; i < indices.length; i += 3) {
                const v1 = BABYLON.Vector3.TransformCoordinates(
                    new BABYLON.Vector3(positions[indices[i] * 3], positions[indices[i] * 3 + 1], positions[indices[i] * 3 + 2]),
                    worldMatrix
                );
                const v2 = BABYLON.Vector3.TransformCoordinates(
                    new BABYLON.Vector3(positions[indices[i + 1] * 3], positions[indices[i + 1] * 3 + 1], positions[indices[i + 1] * 3 + 2]),
                    worldMatrix
                );
                const v3 = BABYLON.Vector3.TransformCoordinates(
                    new BABYLON.Vector3(positions[indices[i + 2] * 3], positions[indices[i + 2] * 3 + 1], positions[indices[i + 2] * 3 + 2]),
                    worldMatrix
                );

                const normal = BABYLON.Vector3.Cross(
                    v2.subtract(v1),
                    v3.subtract(v1)
                ).normalize();

                stlString += `  facet normal ${normal.x.toFixed(6)} ${normal.y.toFixed(6)} ${normal.z.toFixed(6)}\n`;
                stlString += `    outer loop\n`;
                stlString += `      vertex ${v1.x.toFixed(6)} ${v1.y.toFixed(6)} ${v1.z.toFixed(6)}\n`;
                stlString += `      vertex ${v2.x.toFixed(6)} ${v2.y.toFixed(6)} ${v2.z.toFixed(6)}\n`;
                stlString += `      vertex ${v3.x.toFixed(6)} ${v3.y.toFixed(6)} ${v3.z.toFixed(6)}\n`;
                stlString += `    endloop\n`;
                stlString += `  endfacet\n`;
            }
        });

        stlString += 'endsolid model\n';

        // Upload to user's files via platform
        const blob = new Blob([stlString], { type: 'application/sla' });
        const reader = new FileReader();
        reader.onload = async function() {
            try {
                const result = await Platform.uploadAsset(reader.result, 'model.stl', 'application/sla');
                if (result && result.success) {
                    showToast('STL saved to your files!');
                } else {
                    showToast('Export failed', 'error');
                }
            } catch (err) {
                console.error('Upload error:', err);
                showToast('Export failed: ' + err.message, 'error');
            }
        };
        reader.readAsDataURL(blob);
    } catch (error) {
        console.error('Export error:', error);
        showToast('Export failed: ' + error.message, 'error');
    }
}

// Unified import: opens file picker for the chosen format
function importFile(format) {
    document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('open'));

    if (!sceneReady || !scene) {
        showToast('Please wait, loading 3D engine...', 'error');
        return;
    }

    const input = document.createElement('input');
    input.type = 'file';

    if (format === 'stl') {
        input.accept = '.stl';
        input.onchange = function(e) {
            const file = e.target.files[0];
            if (!file) return;
            _processSTLFile(file, file.name.replace(/\.stl$/i, ''));
        };
    } else if (format === 'gltf') {
        input.accept = '.gltf,.glb';
        input.onchange = function(e) {
            const file = e.target.files[0];
            if (!file) return;
            _processGLTFFile(file, file.name.replace(/\.(gltf|glb)$/i, ''));
        };
    }

    input.click();
}

// Process an STL file (File or Blob) into a scene object
function _processSTLFile(file, name) {
    showToast('Importing STL...');

    const reader = new FileReader();
    reader.onload = function() {
        try {
            const data = reader.result;
            const positions = [];
            const indices = [];
            const normals = [];

            // Detect binary vs ASCII STL
            const header = new Uint8Array(data, 0, 80);
            const isBinary = _isBinarySTL(data);

            if (isBinary) {
                _parseBinarySTL(data, positions, indices, normals);
            } else {
                const text = new TextDecoder().decode(data);
                _parseAsciiSTL(text, positions, indices, normals);
            }

            if (positions.length === 0) {
                showToast('STL file is empty or invalid', 'error');
                return;
            }

            // Scale from mm to Babylon units and swap Y/Z for Z-up
            // STL files are typically in mm. Our scene uses UNIT_SCALE (0.1 = 10mm per unit).
            for (let i = 0; i < positions.length; i += 3) {
                const x = positions[i] * UNIT_SCALE;
                const y = positions[i + 1] * UNIT_SCALE;
                const z = positions[i + 2] * UNIT_SCALE;
                positions[i] = x;
                positions[i + 1] = y;
                positions[i + 2] = z;
            }
            // Scale normals Y/Z swap not needed since they're direction vectors
            // but we do need to swap if the coordinate system differs
            // STL is typically Z-up which matches our scene, so no swap needed

            // Create mesh from parsed data
            const mesh = new BABYLON.Mesh(`object_${objectCounter}`, scene);
            const vertexData = new BABYLON.VertexData();
            vertexData.positions = new Float32Array(positions);
            vertexData.indices = new Uint32Array(indices);

            // Recompute normals for consistent lighting
            BABYLON.VertexData.ComputeNormals(vertexData.positions, vertexData.indices, normals);
            vertexData.normals = new Float32Array(normals);

            vertexData.applyToMesh(mesh);

            // Center the mesh on the workplane
            mesh.refreshBoundingInfo();
            const bounds = mesh.getBoundingInfo().boundingBox;
            const centerX = (bounds.minimumWorld.x + bounds.maximumWorld.x) / 2;
            const centerY = (bounds.minimumWorld.y + bounds.maximumWorld.y) / 2;
            const minZ = bounds.minimumWorld.z;

            mesh.position.x = -centerX;
            mesh.position.y = -centerY;
            mesh.position.z = -minZ; // Sit on workplane (Z=0)

            // Bake the centering into the vertices so position reads as (0,0,offset)
            mesh.bakeCurrentTransformIntoVertices();
            mesh.refreshBoundingInfo();
            const newBounds = mesh.getBoundingInfo().boundingBox;
            mesh.position.z = newBounds.minimumWorld.z >= 0 ? 0 : -newBounds.minimumWorld.z;

            // Material
            const color = new BABYLON.Color3(
                0.4 + Math.random() * 0.6,
                0.4 + Math.random() * 0.6,
                0.4 + Math.random() * 0.6
            );
            const material = new BABYLON.StandardMaterial(`mat_${objectCounter}`, scene);
            material.diffuseColor = color;
            material.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
            material.backFaceCulling = false;
            mesh.material = material;

            const displayName = name || ('Import ' + (objectCounter + 1));

            const obj = {
                id: objectCounter,
                type: 'imported',
                name: displayName,
                mesh: mesh,
                color: color,
                dimensions: null,
                opacity: 1.0,
                showEdges: false,
                wireframeClone: null
            };

            objects.push(obj);
            objectCounter++;

            updateObjectsList();
            selectObject(obj);
            saveState('Import ' + displayName);
            showToast('Imported ' + displayName);
        } catch (err) {
            console.error('STL import error:', err);
            showToast('Import failed: ' + err.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

function _isBinarySTL(buffer) {
    // Binary STL: 80-byte header + 4-byte triangle count + 50 bytes per triangle
    if (buffer.byteLength < 84) return false;
    const view = new DataView(buffer);
    const triCount = view.getUint32(80, true);
    const expectedSize = 84 + (triCount * 50);
    // If size matches binary format, it's binary (unless it starts with "solid")
    if (Math.abs(buffer.byteLength - expectedSize) < 10) return true;
    // Check if it starts with "solid" (ASCII indicator)
    const header = new TextDecoder().decode(new Uint8Array(buffer, 0, 5));
    return header !== 'solid';
}

function _parseBinarySTL(buffer, positions, indices, normals) {
    const view = new DataView(buffer);
    const triCount = view.getUint32(80, true);
    let offset = 84;
    let vertIndex = 0;

    for (let i = 0; i < triCount; i++) {
        // Normal (skip, we'll recompute)
        offset += 12;

        // 3 vertices
        for (let v = 0; v < 3; v++) {
            positions.push(view.getFloat32(offset, true));      // X
            positions.push(view.getFloat32(offset + 4, true));  // Y
            positions.push(view.getFloat32(offset + 8, true));  // Z
            indices.push(vertIndex++);
            offset += 12;
        }

        // Attribute byte count
        offset += 2;
    }
}

function _parseAsciiSTL(text, positions, indices, normals) {
    const lines = text.split('\n');
    let vertIndex = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('vertex')) {
            const parts = line.split(/\s+/);
            positions.push(parseFloat(parts[1]));  // X
            positions.push(parseFloat(parts[2]));  // Y
            positions.push(parseFloat(parts[3]));  // Z
            indices.push(vertIndex++);
        }
    }
}

// Process a GLTF/GLB file into scene objects
function _processGLTFFile(file, name) {
    showToast('Importing GLTF...');

    const url = URL.createObjectURL(file);
    const extension = file.name.toLowerCase().endsWith('.glb') ? '.glb' : '.gltf';

    BABYLON.SceneLoader.ImportMesh('', '', url, scene, function(meshes) {
        URL.revokeObjectURL(url);

        if (!meshes || meshes.length === 0) {
            showToast('No meshes found in file', 'error');
            return;
        }

        // Filter to meshes that have geometry (skip empty root nodes)
        const validMeshes = meshes.filter(m =>
            m.getTotalVertices() > 0 && m.getIndices() && m.getIndices().length > 0
        );

        if (validMeshes.length === 0) {
            showToast('No geometry found in file', 'error');
            meshes.forEach(m => m.dispose());
            return;
        }

        // If multiple meshes, merge them into one
        let finalMesh;
        if (validMeshes.length === 1) {
            finalMesh = validMeshes[0];
            // Detach from any parent so transforms are world-space
            finalMesh.parent = null;
        } else {
            // Bake world transforms into each mesh before merging
            validMeshes.forEach(m => {
                m.parent = null;
                m.bakeCurrentTransformIntoVertices();
            });
            finalMesh = BABYLON.Mesh.MergeMeshes(validMeshes, true, true, undefined, false, true);
        }

        // Dispose any leftover non-geometry nodes
        meshes.forEach(m => {
            if (m !== finalMesh && !m.isDisposed()) m.dispose();
        });

        if (!finalMesh) {
            showToast('Failed to process GLTF meshes', 'error');
            return;
        }

        finalMesh.name = `object_${objectCounter}`;

        // GLTF uses Y-up, our scene uses Z-up. Rotate -90 degrees around X.
        // Bake the rotation so vertex data is in our coordinate system.
        finalMesh.rotation.x = -Math.PI / 2;
        finalMesh.bakeCurrentTransformIntoVertices();
        finalMesh.rotation = new BABYLON.Vector3(0, 0, 0);

        // Scale: GLTF is in meters, we need mm * UNIT_SCALE
        // 1 meter = 1000mm, UNIT_SCALE = 0.1, so multiply by 1000 * 0.1 = 100
        finalMesh.scaling = new BABYLON.Vector3(100, 100, 100);
        finalMesh.bakeCurrentTransformIntoVertices();
        finalMesh.scaling = new BABYLON.Vector3(1, 1, 1);

        // Center on workplane
        finalMesh.refreshBoundingInfo();
        const bounds = finalMesh.getBoundingInfo().boundingBox;
        const centerX = (bounds.minimumWorld.x + bounds.maximumWorld.x) / 2;
        const centerY = (bounds.minimumWorld.y + bounds.maximumWorld.y) / 2;
        const minZ = bounds.minimumWorld.z;

        finalMesh.position.x = -centerX;
        finalMesh.position.y = -centerY;
        finalMesh.position.z = -minZ;

        finalMesh.bakeCurrentTransformIntoVertices();
        finalMesh.refreshBoundingInfo();
        const newBounds = finalMesh.getBoundingInfo().boundingBox;
        finalMesh.position = new BABYLON.Vector3(0, 0, 0);
        finalMesh.position.z = newBounds.minimumWorld.z >= 0 ? 0 : -newBounds.minimumWorld.z;

        // Recompute normals
        const positions = finalMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        const indices = finalMesh.getIndices();
        const normals = [];
        BABYLON.VertexData.ComputeNormals(positions, indices, normals);
        finalMesh.setVerticesData(BABYLON.VertexBuffer.NormalKind, normals);

        // Material
        const color = new BABYLON.Color3(
            0.4 + Math.random() * 0.6,
            0.4 + Math.random() * 0.6,
            0.4 + Math.random() * 0.6
        );
        const material = new BABYLON.StandardMaterial(`mat_${objectCounter}`, scene);
        material.diffuseColor = color;
        material.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        material.backFaceCulling = false;
        finalMesh.material = material;

        const displayName = name || ('Import ' + (objectCounter + 1));

        const obj = {
            id: objectCounter,
            type: 'imported',
            name: displayName,
            mesh: finalMesh,
            color: color,
            dimensions: null,
            opacity: 1.0,
            showEdges: false,
            wireframeClone: null
        };

        objects.push(obj);
        objectCounter++;

        updateObjectsList();
        selectObject(obj);
        saveState('Import ' + displayName);
        showToast('Imported ' + displayName);
    }, null, function(scene, message, exception) {
        URL.revokeObjectURL(url);
        console.error('GLTF import error:', message, exception);
        showToast('Import failed: ' + message, 'error');
    }, extension);
}

// Export all objects as GLB
async function exportGLB() {
    document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('open'));

    if (objects.length === 0) {
        showToast('Add some objects first!', 'error');
        return;
    }

    try {
        showToast('Generating GLB...');

        // Create a temporary scene for export with Y-up (GLTF standard)
        const exportScene = new BABYLON.Scene(engine);

        objects.forEach(obj => {
            // Clone the mesh into the export scene
            const clone = obj.mesh.clone('export_' + obj.id, null);

            // Transfer to export scene
            exportScene.addMesh(clone);

            // Copy material
            const mat = new BABYLON.StandardMaterial('exportMat_' + obj.id, exportScene);
            mat.diffuseColor = obj.color.clone();
            mat.backFaceCulling = false;
            clone.material = mat;

            // Bake current transforms
            clone.bakeCurrentTransformIntoVertices();

            // Convert from Z-up to Y-up for GLTF: rotate 90 degrees around X
            clone.rotation.x = Math.PI / 2;
            clone.bakeCurrentTransformIntoVertices();
            clone.rotation = new BABYLON.Vector3(0, 0, 0);

            // Scale from Babylon units back to meters (GLTF standard)
            // Our units: 1 unit = 10mm = 0.01m
            clone.scaling = new BABYLON.Vector3(0.01, 0.01, 0.01);
            clone.bakeCurrentTransformIntoVertices();
            clone.scaling = new BABYLON.Vector3(1, 1, 1);
        });

        const glb = await BABYLON.GLTF2Export.GLBAsync(exportScene, 'model');
        exportScene.dispose();

        // Upload to user's files via platform
        const blob = glb.glTFFiles['model.glb'];
        const reader = new FileReader();
        reader.onload = async function() {
            try {
                const result = await Platform.uploadAsset(reader.result, 'model.glb', 'model/gltf-binary');
                if (result && result.success) {
                    showToast('GLB saved to your files!');
                } else {
                    showToast('Export failed', 'error');
                }
            } catch (err) {
                console.error('Upload error:', err);
                showToast('Export failed: ' + err.message, 'error');
            }
        };
        reader.readAsDataURL(blob);
    } catch (error) {
        console.error('GLB export error:', error);
        showToast('Export failed: ' + error.message, 'error');
    }
}
