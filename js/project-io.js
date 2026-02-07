/**
 * 3DMaker - Project I/O
 * Serialize/deserialize scene data, delete objects, export STL
 */
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
            // For CSG and text objects, store geometry and scaling
            // Use toFixed(4) for positions/normals to reduce file size (0.0001 units = 0.001mm precision)
            geometry: (obj.type === 'csg' || obj.type === 'text') ? {
                positions: Array.from(obj.mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind)).map(v => parseFloat(v.toFixed(4))),
                indices: Array.from(obj.mesh.getIndices()),
                normals: Array.from(obj.mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind)).map(v => parseFloat(v.toFixed(4)))
            } : null,
            scaling: (obj.type === 'csg' || obj.type === 'text') ? {
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

// Export STL (download to user's device)
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

        // Download to user's device
        const blob = new Blob([stlString], { type: 'application/sla' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'model.stl';
        a.click();
        URL.revokeObjectURL(url);

        showToast('STL exported!');
    } catch (error) {
        console.error('Export error:', error);
        showToast('Export failed: ' + error.message, 'error');
    }
}
