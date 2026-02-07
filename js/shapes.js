/**
 * 3DMaker - Shape Management
 * Shape creation and mesh rebuilding
 */
function addShape(type) {
    if (!sceneReady || !scene) {
        console.error('Scene not initialized yet');
        showToast('Please wait, loading 3D engine...', 'error');
        return;
    }

    let mesh;
    let dimensions;
    const color = new BABYLON.Color3(
        0.4 + Math.random() * 0.6,
        0.4 + Math.random() * 0.6,
        0.4 + Math.random() * 0.6
    );

    switch(type) {
        case 'box':
            dimensions = { width: 20, depth: 20, height: 20 }; // mm
            // IMPORTANT: Babylon.js CreateBox uses Y-up parameter names
            // In our Z-up system: X=width, Y=depth, Z=height
            // So we swap depth/height parameters for CreateBox
            mesh = BABYLON.MeshBuilder.CreateBox(`object_${objectCounter}`, {
                width: dimensions.width * UNIT_SCALE,   // X axis - our width
                height: dimensions.depth * UNIT_SCALE,  // Y axis - our depth
                depth: dimensions.height * UNIT_SCALE   // Z axis - our height
            }, scene);
            // Position so base sits on workplane (Z=0)
            mesh.position.z = dimensions.height * UNIT_SCALE / 2;
            break;
        case 'sphere':
            dimensions = { radius: 10, quality: 32 }; // mm
            mesh = BABYLON.MeshBuilder.CreateSphere(`object_${objectCounter}`, {
                diameter: dimensions.radius * 2 * UNIT_SCALE,
                segments: dimensions.quality
            }, scene);
            break;
        case 'cylinder':
            dimensions = { radius: 10, height: 20, quality: 32 }; // mm
            mesh = BABYLON.MeshBuilder.CreateCylinder(`object_${objectCounter}`, {
                height: dimensions.height * UNIT_SCALE,
                diameterTop: dimensions.radius * 2 * UNIT_SCALE,
                diameterBottom: dimensions.radius * 2 * UNIT_SCALE,
                tessellation: dimensions.quality
            }, scene);
            // Rotate to stand upright along Z axis (default is along Y)
            mesh.rotation.x = Math.PI / 2;
            // Position so base sits on workplane (Z=0)
            mesh.position.z = dimensions.height * UNIT_SCALE / 2;
            break;
        case 'cone':
            dimensions = { topRadius: 0, bottomRadius: 10, height: 20, quality: 32 }; // mm
            mesh = BABYLON.MeshBuilder.CreateCylinder(`object_${objectCounter}`, {
                height: dimensions.height * UNIT_SCALE,
                diameterTop: dimensions.topRadius * 2 * UNIT_SCALE,
                diameterBottom: dimensions.bottomRadius * 2 * UNIT_SCALE,
                tessellation: dimensions.quality
            }, scene);
            // Rotate to stand upright along Z axis (default is along Y)
            mesh.rotation.x = Math.PI / 2;
            // Position so base sits on workplane (Z=0)
            mesh.position.z = dimensions.height * UNIT_SCALE / 2;
            break;
        case 'torus':
            dimensions = { diameter: 20, thickness: 4, quality: 32 }; // mm (outer diameter and tube thickness)
            mesh = BABYLON.MeshBuilder.CreateTorus(`object_${objectCounter}`, {
                diameter: dimensions.diameter * UNIT_SCALE,
                thickness: dimensions.thickness * UNIT_SCALE,
                tessellation: dimensions.quality
            }, scene);
            // Rotate to lie flat on Z plane (default is on Y plane)
            mesh.rotation.x = Math.PI / 2;
            // Position so bottom sits on workplane (Z=0)
            mesh.position.z = dimensions.thickness * UNIT_SCALE / 2;
            break;
        case 'pyramid':
            dimensions = { baseSize: 20, height: 20 }; // mm (square base)
            mesh = BABYLON.MeshBuilder.CreateCylinder(`object_${objectCounter}`, {
                height: dimensions.height * UNIT_SCALE,
                diameterTop: 0,
                diameterBottom: dimensions.baseSize * UNIT_SCALE, // Actual base size
                tessellation: 4 // 4 sides = square base
            }, scene);
            // Rotate to stand upright along Z axis (default is along Y)
            mesh.rotation.x = Math.PI / 2;
            // Position so base sits on workplane (Z=0)
            mesh.position.z = dimensions.height * UNIT_SCALE / 2;
            break;
        case 'capsule':
            dimensions = { radius: 5, height: 20, quality: 16 }; // mm (radius and total height including caps)
            mesh = BABYLON.MeshBuilder.CreateCapsule(`object_${objectCounter}`, {
                radius: dimensions.radius * UNIT_SCALE,
                height: dimensions.height * UNIT_SCALE,
                tessellation: dimensions.quality
            }, scene);
            // Rotate to stand upright along Z axis (default is along Y)
            mesh.rotation.x = Math.PI / 2;
            // Position so base sits on workplane (Z=0)
            mesh.position.z = dimensions.height * UNIT_SCALE / 2;
            break;
        case 'tube':
            dimensions = { outerRadius: 10, innerRadius: 6, height: 20, quality: 32 }; // mm
            // Create tube using CSG: outer cylinder - inner cylinder
            const outerCyl = BABYLON.MeshBuilder.CreateCylinder('outer', {
                height: dimensions.height * UNIT_SCALE,
                diameter: dimensions.outerRadius * 2 * UNIT_SCALE,
                tessellation: dimensions.quality
            }, scene);
            const innerCyl = BABYLON.MeshBuilder.CreateCylinder('inner', {
                height: dimensions.height * UNIT_SCALE * 1.1,
                diameter: dimensions.innerRadius * 2 * UNIT_SCALE,
                tessellation: dimensions.quality
            }, scene);
            // Perform CSG subtraction
            const outerCSG = BABYLON.CSG.FromMesh(outerCyl);
            const innerCSG = BABYLON.CSG.FromMesh(innerCyl);
            const tubeCSG = outerCSG.subtract(innerCSG);
            mesh = tubeCSG.toMesh(`object_${objectCounter}`, null, scene);
            // Clean up temporary meshes
            outerCyl.dispose();
            innerCyl.dispose();
            // Rotate to stand upright along Z axis
            mesh.rotation.x = Math.PI / 2;
            // Position so base sits on workplane
            mesh.position.z = dimensions.height * UNIT_SCALE / 2;
            break;
        /* WEDGE SHAPE DISABLED - Issues with transparency and CSG operations
        case 'wedge':
            dimensions = { width: 20, depth: 20, height: 20 }; // mm
            // Create wedge using custom vertices (triangular prism/ramp)
            const w = dimensions.width * UNIT_SCALE / 2;
            const d = dimensions.depth * UNIT_SCALE / 2;
            const h = dimensions.height * UNIT_SCALE;

            const positions = [
                // Bottom face (rectangle)
                -w, -d, 0,  // 0
                 w, -d, 0,  // 1
                 w,  d, 0,  // 2
                -w,  d, 0,  // 3
                // Top edge (line at back)
                -w,  d, h,  // 4
                 w,  d, h   // 5
            ];

            const indices = [
                // Bottom
                0, 2, 1,  0, 3, 2,
                // Front slope
                0, 1, 5,  0, 5, 4,
                // Left side
                0, 4, 3,
                // Right side
                1, 2, 5,
                // Back face
                3, 4, 5,  3, 5, 2
            ];

            const normals = [];
            BABYLON.VertexData.ComputeNormals(positions, indices, normals);

            const vertexData = new BABYLON.VertexData();
            vertexData.positions = positions;
            vertexData.indices = indices;
            vertexData.normals = normals;

            mesh = new BABYLON.Mesh(`object_${objectCounter}`, scene);
            vertexData.applyToMesh(mesh);

            // Position so base sits on workplane
            mesh.position.z = 0;
            break;
        */
    }

    // Material
    const material = new BABYLON.StandardMaterial(`mat_${objectCounter}`, scene);
    material.diffuseColor = color;
    material.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);

    /* WEDGE BACKFACE CULLING DISABLED - No longer needed
    // Disable backface culling for custom geometry shapes
    if (type === 'wedge') {
        material.backFaceCulling = false;
    }
    */

    mesh.material = material;

    // Store object with dimensions
    const obj = {
        id: objectCounter,
        type: type,
        name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${objectCounter + 1}`,
        mesh: mesh,
        color: color,
        dimensions: dimensions,
        opacity: 1.0,        // Default fully opaque
        showEdges: false,    // Default no edges
        wireframeClone: null // Wireframe overlay (created when showEdges is enabled)
    };

    objects.push(obj);
    objectCounter++;

    updateObjectsList();
    selectObject(obj);
    saveState('Add ' + obj.name);
    showToast(`Added ${obj.name}`);
}


function duplicateObject() {
    if (!selectedObject && selectedObjects.length === 0) {
        showToast('Select an object to duplicate', 'error');
        return;
    }

    // Get objects to duplicate
    const objectsToDuplicate = selectedObjects.length > 0 ? selectedObjects : [selectedObject];
    const duplicates = [];

    objectsToDuplicate.forEach(obj => {
        // Clone the mesh
        const newMesh = obj.mesh.clone(`object_${objectCounter}`);

        // Clone the material
        const newMat = obj.mesh.material.clone(`mat_${objectCounter}`);
        newMesh.material = newMat;

        // Duplicate at exact same position (professional behavior)

        // Determine copy name
        let baseName = obj.name;
        let copyNum = 1;

        // Check if name already ends with (Copy X)
        const copyMatch = baseName.match(/^(.*?)(?: \(Copy(?: (\d+))?\))?$/);
        if (copyMatch) {
            baseName = copyMatch[1];
            copyNum = copyMatch[2] ? parseInt(copyMatch[2]) + 1 : 1;
        }

        // Generate unique copy name
        let newName = copyNum === 1 ? `${baseName} (Copy)` : `${baseName} (Copy ${copyNum})`;

        // Ensure name is unique
        while (objects.some(o => o.name === newName)) {
            copyNum++;
            newName = `${baseName} (Copy ${copyNum})`;
        }

        // Create new object
        const newObj = {
            id: objectCounter,
            type: obj.type,
            name: newName,
            mesh: newMesh,
            color: obj.color.clone(),
            dimensions: obj.dimensions ? JSON.parse(JSON.stringify(obj.dimensions)) : null,
            opacity: obj.opacity !== undefined ? obj.opacity : 1.0,
            showEdges: obj.showEdges || false,
            wireframeClone: null
        };

        // For text objects, copy text-specific properties
        if (obj.type === 'text') {
            newObj.textContent = obj.textContent;
            newObj.fontSize = obj.fontSize;
            newObj.fontFile = obj.fontFile;
        }

        // For CSG objects, copy the geometry and operands
        if (obj.type === 'csg' && obj.geometry) {
            newObj.geometry = JSON.parse(JSON.stringify(obj.geometry));
            newObj.operation = obj.operation;
            if (obj.operands) {
                newObj.operands = JSON.parse(JSON.stringify(obj.operands));
            }
        }

        // Apply opacity settings to material
        if (newObj.opacity < 1) {
            newMesh.material.alpha = newObj.opacity;
            newMesh.material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
            newMesh.material.disableDepthWrite = false;
            newMesh.material.needDepthPrePass = true;
            newMesh.renderingGroupId = 1;
        }

        // Apply wireframe if needed
        if (obj.showEdges) {
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

        objects.push(newObj);
        duplicates.push(newObj);
        objectCounter++;
    });

    // Update UI
    updateObjectsList();

    // Select the duplicated object(s)
    if (duplicates.length === 1) {
        selectObject(duplicates[0]);
        saveState('Duplicate ' + duplicates[0].name);
        showToast(`Duplicated: ${duplicates[0].name}`);
    } else {
        deselectAll();
        duplicates.forEach(dup => toggleSelection(dup));
        saveState(`Duplicate ${duplicates.length} objects`);
        showToast(`Duplicated ${duplicates.length} objects`);
    }
}


function mirrorObject(axis) {
    if (!selectedObject && selectedObjects.length === 0) {
        showToast('Select an object to mirror', 'error');
        return;
    }

    // Close mirror modal if open
    const modal = document.getElementById('mirror-modal');
    if (modal) modal.style.display = 'none';

    // Get objects to mirror
    const objectsToMirror = selectedObjects.length > 0 ? selectedObjects : [selectedObject];
    const mirrors = [];

    objectsToMirror.forEach(obj => {
        // Clone the mesh
        const newMesh = obj.mesh.clone(`object_${objectCounter}`);

        // Clone the material
        const newMat = obj.mesh.material.clone(`mat_${objectCounter}`);
        newMesh.material = newMat;

        // Apply mirror by scaling negatively on the chosen axis
        // AND mirror the position across the origin (coordinate plane)
        if (axis === 'x') {
            newMesh.scaling.x *= -1;
            newMesh.position.x = -obj.mesh.position.x;  // Mirror position across origin
            newMesh.position.y = obj.mesh.position.y;   // Keep same Y
            newMesh.position.z = obj.mesh.position.z;   // Keep same Z
        } else if (axis === 'y') {
            newMesh.scaling.y *= -1;
            newMesh.position.x = obj.mesh.position.x;   // Keep same X
            newMesh.position.y = -obj.mesh.position.y;  // Mirror position across origin
            newMesh.position.z = obj.mesh.position.z;   // Keep same Z
        } else if (axis === 'z') {
            newMesh.scaling.z *= -1;
            newMesh.position.x = obj.mesh.position.x;   // Keep same X
            newMesh.position.y = obj.mesh.position.y;   // Keep same Y
            newMesh.position.z = -obj.mesh.position.z;  // Mirror position across origin
        }

        // Determine mirror name
        let baseName = obj.name;
        let mirrorNum = 1;

        // Check if name already ends with (Mirror X)
        const mirrorMatch = baseName.match(/^(.*?)(?: \(Mirror [XYZ](?: (\d+))?\))?$/);
        if (mirrorMatch) {
            baseName = mirrorMatch[1];
            mirrorNum = mirrorMatch[2] ? parseInt(mirrorMatch[2]) + 1 : 1;
        }

        // Generate unique mirror name
        const axisUpper = axis.toUpperCase();
        let newName = mirrorNum === 1 ? `${baseName} (Mirror ${axisUpper})` : `${baseName} (Mirror ${axisUpper} ${mirrorNum})`;

        // Ensure name is unique
        while (objects.some(o => o.name === newName)) {
            mirrorNum++;
            newName = `${baseName} (Mirror ${axisUpper} ${mirrorNum})`;
        }

        // Create new object
        const newObj = {
            id: objectCounter,
            type: obj.type,
            name: newName,
            mesh: newMesh,
            color: obj.color.clone(),
            dimensions: obj.dimensions ? JSON.parse(JSON.stringify(obj.dimensions)) : null,
            opacity: obj.opacity !== undefined ? obj.opacity : 1.0,
            showEdges: obj.showEdges || false,
            wireframeClone: null
        };

        // For CSG objects, copy the geometry and operands
        if (obj.type === 'csg' && obj.geometry) {
            newObj.geometry = JSON.parse(JSON.stringify(obj.geometry));
            newObj.operation = obj.operation;
            if (obj.operands) {
                newObj.operands = JSON.parse(JSON.stringify(obj.operands));
            }
        }

        // Apply opacity settings to material
        if (newObj.opacity < 1) {
            newMesh.material.alpha = newObj.opacity;
            newMesh.material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
            newMesh.material.disableDepthWrite = false;
            newMesh.material.needDepthPrePass = true;
            newMesh.renderingGroupId = 1;
        }

        // Apply wireframe if needed
        if (obj.showEdges) {
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

        objects.push(newObj);
        mirrors.push(newObj);
        objectCounter++;
    });

    // Update UI
    updateObjectsList();

    // Select the mirrored object(s)
    if (mirrors.length === 1) {
        selectObject(mirrors[0]);
        saveState('Mirror ' + mirrors[0].name);
        showToast(`Mirrored across ${axis.toUpperCase()}-axis: ${mirrors[0].name}`);
    } else {
        deselectAll();
        mirrors.forEach(mir => toggleSelection(mir));
        saveState(`Mirror ${mirrors.length} objects across ${axis.toUpperCase()}-axis`);
        showToast(`Mirrored ${mirrors.length} objects across ${axis.toUpperCase()}-axis`);
    }
}

function openMirrorModal() {
    if (!selectedObject && selectedObjects.length === 0) {
        showToast('Select an object to mirror', 'error');
        return;
    }
    document.getElementById('mirror-modal').style.display = 'flex';
}

function closeMirrorModal() {
    document.getElementById('mirror-modal').style.display = 'none';
}

function openTextModal() {
    document.getElementById('text-modal').style.display = 'flex';
    // Load custom fonts
    loadCustomFonts();
    // Focus on text input
    setTimeout(() => {
        document.getElementById('text-input').focus();
        document.getElementById('text-input').select();
    }, 100);
}

function closeTextModal() {
    document.getElementById('text-modal').style.display = 'none';
}

function createTextShape() {
    const textInput = document.getElementById('text-input').value.trim();
    const fontSize = parseInt(document.getElementById('text-size').value);
    const depth = parseInt(document.getElementById('text-depth').value);
    const fontFile = document.getElementById('text-font').value;

    if (!textInput) {
        showToast('Please enter some text', 'error');
        return;
    }

    // Close modal
    closeTextModal();

    // Create text mesh using selected font
    createSimpleText(textInput, fontSize, depth, fontFile);
}

async function createSimpleText(text, fontSize, depth, fontFile = 'Roboto-Regular.ttf') {
    if (!sceneReady || !scene) {
        console.error('Scene not initialized yet');
        showToast('Please wait, loading 3D engine...', 'error');
        return;
    }

    // Validate text - only allow alphanumeric and basic punctuation
    const allowedChars = /^[a-zA-Z0-9\s.,\-_]+$/;
    if (!allowedChars.test(text)) {
        showToast('Only letters (a-z), numbers (0-9), and basic punctuation (. , - _) are supported', 'error');
        return;
    }

    showToast('Creating 3D text...', 'info');

    try {
        // Create 3D text using Babylon.js text mesh (async for font loading)
        const textMesh = await createBabylonText(text, fontSize, depth, fontFile);

        if (!textMesh) {
            throw new Error('Failed to create text mesh');
        }

        // Text is already positioned correctly (front face at Z=0, extruding upward)
        // No Z position adjustment needed

        // Material
        const color = new BABYLON.Color3(
            0.4 + Math.random() * 0.6,
            0.4 + Math.random() * 0.6,
            0.4 + Math.random() * 0.6
        );
        const material = new BABYLON.StandardMaterial(`mat_${objectCounter}`, scene);
        material.diffuseColor = color;
        material.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        textMesh.material = material;

        // Calculate approximate dimensions
        const textWidth = text.length * fontSize * 0.7;
        const textHeight = fontSize;

        // Store object with dimensions and text metadata
        const obj = {
            id: objectCounter,
            type: 'text',
            name: `Text: "${text.substring(0, 10)}${text.length > 10 ? '...' : ''}"`,
            mesh: textMesh,
            color: color,
            dimensions: { width: textWidth, height: textHeight, depth: depth },
            textContent: text,
            fontSize: fontSize,
            fontFile: fontFile,
            opacity: 1.0,
            showEdges: false,
            wireframeClone: null
        };

        objects.push(obj);
        objectCounter++;

        updateObjectsList();
        selectObject(obj);
        saveState('Add ' + obj.name);
        showToast(`Added text: "${text}"`);

    } catch (error) {
        console.error('Error creating text:', error);
        showToast('Error creating text. Please try again.', 'error');
    }
}

// Global font variable
// Font cache - stores loaded fonts by filename
let loadedFonts = new Map();

async function createBabylonText(text, size, depth, fontFile = 'Roboto-Regular.ttf') {
    // Create real 3D extruded text using opentype.js and earcut.js

    console.log('createBabylonText called with:', text, size, depth, fontFile);
    console.log('opentype available?', typeof opentype !== 'undefined');
    console.log('earcut available?', typeof earcut !== 'undefined');

    try {
        // Check if libraries are loaded
        if (typeof opentype === 'undefined') {
            throw new Error('opentype.js not loaded');
        }
        if (typeof earcut === 'undefined') {
            throw new Error('earcut.js not loaded');
        }

        // Load font if not already cached
        let loadedFont = loadedFonts.get(fontFile);
        if (!loadedFont) {
            console.log('Loading font:', fontFile);

            // Determine if fontFile is a URL or local file
            const isUrl = fontFile.startsWith('http://') || fontFile.startsWith('https://');
            const fontPath = isUrl ? fontFile : ('fonts/' + fontFile);

            // Get font display name for user feedback
            let fontName;
            if (isUrl) {
                // Extract name from URL
                const urlParts = fontFile.split('/');
                const filename = urlParts[urlParts.length - 1];
                fontName = filename.replace('.ttf', '').replace(/[_-]/g, ' ');
            } else {
                fontName = fontFile.replace('.ttf', '').replace('DejaVu', 'DejaVu ').replace('-', ' ');
            }
            showToast(`Loading ${fontName}...`, 'info');

            // Load font from URL or local file
            try {
                loadedFont = await opentype.load(fontPath);
                console.log('Font loaded successfully:', fontFile, loadedFont);
                // Cache the loaded font
                loadedFonts.set(fontFile, loadedFont);
            } catch (fontError) {
                console.error('Font load error:', fontError);
                throw new Error('Failed to load font: ' + fontName);
            }
        } else {
            console.log('Using cached font:', fontFile);
        }

        if (!loadedFont) {
            throw new Error('Font not loaded after attempt');
        }

        console.log('Creating font-based text...');
        // Create text mesh using font
        const result = createFontBasedText(text, size, depth, loadedFont);
        console.log('Font-based text result:', result);
        return result;

    } catch (e) {
        console.error('Font-based text creation error:', e);
        showToast('Using simple block letters (font system unavailable)', 'warning');
        // Fallback to block letters
        console.log('Falling back to block letters');
        return createBlockLetterText(text, size, depth);
    }
}

function createFontBasedText(text, size, depth, font) {
    // Convert font glyphs to 3D extruded meshes

    const fontSize = size; // Use size directly (in mm)
    const parent = new BABYLON.TransformNode(`text_parent_${objectCounter}`, scene);
    let offsetX = 0;

    // Process each character
    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (char === ' ') {
            // Add space
            const spaceWidth = font.charToGlyph(' ').advanceWidth * fontSize / font.unitsPerEm;
            offsetX += spaceWidth * UNIT_SCALE;
            continue;
        }

        const glyph = font.charToGlyph(char);
        if (!glyph || !glyph.path) continue;

        // Get path commands from the glyph
        const path = glyph.path;
        const pathData = path.toPathData();

        if (!pathData || pathData.length === 0) continue;

        // Create mesh for this character
        const charMesh = createExtrudedGlyphMesh(pathData, fontSize, depth, font.unitsPerEm);

        if (charMesh) {
            charMesh.position.x = offsetX;
            charMesh.parent = parent;
        }

        // Move offset for next character (even if mesh creation failed)
        offsetX += (glyph.advanceWidth * fontSize / font.unitsPerEm) * UNIT_SCALE;
    }

    // Merge all character meshes into one
    const children = parent.getChildMeshes();
    if (children.length > 0) {
        const merged = BABYLON.Mesh.MergeMeshes(children, true, true, undefined, false, true);
        if (merged) {
            merged.name = `text_${objectCounter}`;
            // Fix mirroring - scale by -1 on Y axis to flip text right-side up
            merged.scaling.y = -1;

            // Center the text mesh so gizmos appear in the middle
            merged.bakeCurrentTransformIntoVertices(); // Bake the Y-flip into vertices
            const bounds = merged.getBoundingInfo().boundingBox;
            const center = bounds.center;

            // Shift vertices so mesh is centered at origin
            const positions = merged.getVerticesData(BABYLON.VertexBuffer.PositionKind);
            for (let i = 0; i < positions.length; i += 3) {
                positions[i] -= center.x;     // Center X
                positions[i + 1] -= center.y; // Center Y (already accounts for Y-flip)
            }
            merged.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
            merged.refreshBoundingInfo();

            parent.dispose();
            return merged;
        }
    }

    parent.dispose();
    return null;
}

function createExtrudedGlyphMesh(pathData, fontSize, depth, unitsPerEm) {
    // Parse SVG path data and create extruded 3D mesh

    try {
        // Parse the path data into polygon points
        const polygons = parseSVGPath(pathData, fontSize, unitsPerEm);

        if (!polygons || polygons.length === 0) return null;

        // Triangulate the polygon using earcut
        const triangles = triangulatePath(polygons);

        if (!triangles || triangles.positions.length === 0) return null;

        // Create extruded mesh with front, back, and sides
        return createExtrudedMeshFromTriangles(triangles, depth);

    } catch (e) {
        console.error('Error creating glyph mesh:', e);
        return null;
    }
}

function parseSVGPath(pathData, fontSize, unitsPerEm) {
    // Convert SVG path data to polygon points

    const scale = fontSize / unitsPerEm;
    const paths = [];
    let currentPath = [];
    let currentX = 0, currentY = 0;
    let startX = 0, startY = 0;

    // Simple path parser for M, L, Q, C, Z commands
    const commands = pathData.match(/[MLQCZmlqcz][^MLQCZmlqcz]*/g);

    if (!commands) return [];

    commands.forEach(cmd => {
        const type = cmd[0];
        // Split on spaces, commas, and handle concatenated negative numbers (e.g., "369-20" -> "369", "-20")
        const argsStr = cmd.slice(1).trim().replace(/(-)/g, ' $1'); // Add space before negative signs
        const args = argsStr.split(/[\s,]+/).filter(s => s).map(Number);

        switch (type.toUpperCase()) {
            case 'M': // Move to
                if (currentPath.length > 0) {
                    paths.push(currentPath);
                }
                currentPath = [];
                currentX = args[0] * scale;
                currentY = -args[1] * scale; // Flip Y
                startX = currentX;
                startY = currentY;
                currentPath.push([currentX, currentY]);
                break;

            case 'L': // Line to
                currentX = args[0] * scale;
                currentY = -args[1] * scale;
                currentPath.push([currentX, currentY]);
                break;

            case 'Q': // Quadratic curve
                // Approximate with line segments
                const steps = 10;
                const x0 = currentX, y0 = currentY;
                const cx = args[0] * scale, cy = -args[1] * scale;
                const x1 = args[2] * scale, y1 = -args[3] * scale;

                for (let t = 1; t <= steps; t++) {
                    const ratio = t / steps;
                    const r = 1 - ratio;
                    const x = r * r * x0 + 2 * r * ratio * cx + ratio * ratio * x1;
                    const y = r * r * y0 + 2 * r * ratio * cy + ratio * ratio * y1;
                    currentPath.push([x, y]);
                }
                currentX = x1;
                currentY = y1;
                break;

            case 'C': // Cubic curve
                // Approximate with line segments
                const cSteps = 10;
                const cx0 = currentX, cy0 = currentY;
                const cx1 = args[0] * scale, cy1 = -args[1] * scale;
                const cx2 = args[2] * scale, cy2 = -args[3] * scale;
                const cx3 = args[4] * scale, cy3 = -args[5] * scale;

                for (let t = 1; t <= cSteps; t++) {
                    const ratio = t / cSteps;
                    const r = 1 - ratio;
                    const x = r * r * r * cx0 + 3 * r * r * ratio * cx1 + 3 * r * ratio * ratio * cx2 + ratio * ratio * ratio * cx3;
                    const y = r * r * r * cy0 + 3 * r * r * ratio * cy1 + 3 * r * ratio * ratio * cy2 + ratio * ratio * ratio * cy3;
                    currentPath.push([x, y]);
                }
                currentX = cx3;
                currentY = cy3;
                break;

            case 'Z': // Close path
                if (currentPath.length > 0 && (currentX !== startX || currentY !== startY)) {
                    currentPath.push([startX, startY]);
                }
                // Push the closed path to paths array
                if (currentPath.length > 0) {
                    paths.push(currentPath);
                    currentPath = [];
                }
                break;
        }
    });

    // Push any remaining path
    if (currentPath.length > 0) {
        paths.push(currentPath);
    }

    return paths;
}

function triangulatePath(paths) {
    // Use earcut to triangulate the polygon

    try {
        if (paths.length === 0) return null;

        // Calculate signed area for each path to determine winding order
        // Positive area = counter-clockwise (outer contour)
        // Negative area = clockwise (hole)
        const calculateArea = (path) => {
            let area = 0;
            for (let i = 0; i < path.length; i++) {
                const j = (i + 1) % path.length;
                area += path[i][0] * path[j][1];
                area -= path[j][0] * path[i][1];
            }
            return area / 2;
        };

        // Sort paths: largest absolute area first (outer contour), then holes
        const pathsWithArea = paths.map(path => ({
            path,
            area: calculateArea(path)
        }));

        const validPaths = pathsWithArea.filter(p => !isNaN(p.area) && Math.abs(p.area) > 0.001); // Filter out invalid/tiny paths

        if (validPaths.length === 0) {
            return null;
        }

        // Sort by absolute area (descending) to get outer contour first
        validPaths.sort((a, b) => Math.abs(b.area) - Math.abs(a.area));

        // Flatten all paths into a single vertex array
        const vertices = [];
        const holes = [];
        let vertexCount = 0;

        validPaths.forEach((pathData, idx) => {
            let path = pathData.path;
            const area = pathData.area;

            // Ensure proper winding order:
            // First path (outer) should be CCW (positive area)
            // Other paths (holes) should be CW (negative area)
            if (idx === 0 && area < 0) {
                // Outer contour is clockwise, reverse it
                path = [...path].reverse();
            } else if (idx > 0 && area > 0) {
                // Hole is counter-clockwise, reverse it
                path = [...path].reverse();
            }

            if (idx > 0) {
                // Mark start of hole
                holes.push(vertexCount);
            }

            path.forEach(point => {
                vertices.push(point[0], point[1]);
                vertexCount++;
            });
        });

        if (vertices.length < 6) return null; // Need at least 3 points

        // Triangulate using earcut
        const indices = earcut(vertices, holes.length > 0 ? holes : null, 2);

        if (!indices || indices.length === 0) {
            return null;
        }

        // Convert flat vertices array to 3D positions
        const positions = [];
        for (let i = 0; i < vertices.length; i += 2) {
            positions.push(vertices[i] * UNIT_SCALE, vertices[i + 1] * UNIT_SCALE, 0);
        }

        return { positions, indices };

    } catch (e) {
        console.error('Triangulation error:', e);
        return null;
    }
}

function createExtrudedMeshFromTriangles(triangleData, depth) {
    // Create a 3D mesh with front, back, and extruded sides

    const { positions, indices } = triangleData;

    const depthScaled = depth * UNIT_SCALE;

    // Create front and back faces
    // Back face at Z=0, front face extrudes upward (positive Z)
    const backPositions = [...positions];
    const frontPositions = positions.map((val, idx) => {
        return idx % 3 === 2 ? val + depthScaled : val; // Offset Z for front face (positive = upward)
    });

    // Find outline edges (edges that appear only once in the triangulation)
    const edgeMap = new Map();

    for (let i = 0; i < indices.length; i += 3) {
        const edges = [
            [indices[i], indices[i + 1]],
            [indices[i + 1], indices[i + 2]],
            [indices[i + 2], indices[i]]
        ];

        edges.forEach(edge => {
            const key = edge[0] < edge[1] ? `${edge[0]}_${edge[1]}` : `${edge[1]}_${edge[0]}`;
            edgeMap.set(key, (edgeMap.get(key) || 0) + 1);
        });
    }

    // Get outline edges (edges with count of 1)
    const outlineEdges = [];
    for (let i = 0; i < indices.length; i += 3) {
        const edges = [
            [indices[i], indices[i + 1]],
            [indices[i + 1], indices[i + 2]],
            [indices[i + 2], indices[i]]
        ];

        edges.forEach(edge => {
            const key = edge[0] < edge[1] ? `${edge[0]}_${edge[1]}` : `${edge[1]}_${edge[0]}`;
            if (edgeMap.get(key) === 1) {
                outlineEdges.push(edge);
            }
        });
    }

    // Create vertex data
    const vertexData = new BABYLON.VertexData();

    // Combine positions (front + back + sides)
    const allPositions = [];
    const allIndices = [];
    const allNormals = [];

    // Front face (reversed winding for outward normal)
    allPositions.push(...frontPositions);
    indices.forEach((idx, i) => {
        if (i % 3 === 0) {
            allIndices.push(indices[i + 2]);
            allIndices.push(indices[i + 1]);
            allIndices.push(indices[i]);
        }
    });

    // Back face (original winding for outward normal)
    const backIndexOffset = frontPositions.length / 3;
    allPositions.push(...backPositions);
    allIndices.push(...indices.map(idx => idx + backIndexOffset));

    // Add side faces for each outline edge
    const sideIndexOffset = allPositions.length / 3;

    outlineEdges.forEach(edge => {
        const v1 = edge[0];
        const v2 = edge[1];

        // Get front vertices
        const x1Front = frontPositions[v1 * 3];
        const y1Front = frontPositions[v1 * 3 + 1];
        const z1Front = frontPositions[v1 * 3 + 2];

        const x2Front = frontPositions[v2 * 3];
        const y2Front = frontPositions[v2 * 3 + 1];
        const z2Front = frontPositions[v2 * 3 + 2];

        // Get back vertices
        const x1Back = backPositions[v1 * 3];
        const y1Back = backPositions[v1 * 3 + 1];
        const z1Back = backPositions[v1 * 3 + 2];

        const x2Back = backPositions[v2 * 3];
        const y2Back = backPositions[v2 * 3 + 1];
        const z2Back = backPositions[v2 * 3 + 2];

        // Add 4 vertices for this quad (front v1, front v2, back v2, back v1)
        const baseIdx = allPositions.length / 3;

        allPositions.push(x1Front, y1Front, z1Front);
        allPositions.push(x2Front, y2Front, z2Front);
        allPositions.push(x2Back, y2Back, z2Back);
        allPositions.push(x1Back, y1Back, z1Back);

        // Add two triangles to form the quad
        allIndices.push(baseIdx, baseIdx + 1, baseIdx + 2);
        allIndices.push(baseIdx, baseIdx + 2, baseIdx + 3);
    });

    // Compute normals
    BABYLON.VertexData.ComputeNormals(allPositions, allIndices, allNormals);

    vertexData.positions = allPositions;
    vertexData.indices = allIndices;
    vertexData.normals = allNormals;

    // Create mesh
    const mesh = new BABYLON.Mesh(`glyph_${objectCounter}`, scene);
    vertexData.applyToMesh(mesh);

    return mesh;
}

function createBlockLetterText(text, size, depth) {
    // Create simple block-style 3D text perfect for 3D printing
    // Each letter is made from rectangular blocks

    const letterSpacing = size * 0.2;
    const segmentWidth = size * 0.15;  // Width of each segment
    const segmentHeight = size * 0.15;  // Height of each segment

    const parent = new BABYLON.TransformNode(`text_parent_${objectCounter}`, scene);
    let currentX = 0;

    // Define simple 7-segment-style letter shapes
    // Each letter defined as an array of box positions
    const letters = get7SegmentLetters();

    for (let i = 0; i < text.length; i++) {
        const char = text[i].toUpperCase();

        if (char === ' ') {
            currentX += size * 0.5;
            continue;
        }

        const segments = letters[char] || letters['?'];

        // Create letter from segments
        for (let j = 0; j < segments.length; j++) {
            const seg = segments[j];
            const box = BABYLON.MeshBuilder.CreateBox(`letter_${i}_seg_${j}`, {
                width: seg.width * size * UNIT_SCALE,
                height: seg.height * size * UNIT_SCALE,
                depth: depth * UNIT_SCALE
            }, scene);

            box.position.x = (currentX + seg.x * size) * UNIT_SCALE;
            box.position.y = seg.y * size * UNIT_SCALE;
            box.parent = parent;
        }

        currentX += size * 0.9 + letterSpacing;
    }

    // Merge all child meshes into one
    const children = parent.getChildMeshes();
    if (children.length > 0) {
        const merged = BABYLON.Mesh.MergeMeshes(children, true, true, undefined, false, true);
        merged.name = `text_${objectCounter}`;
        parent.dispose();
        return merged;
    }

    parent.dispose();
    return null;
}

function get7SegmentLetters() {
    // Simple block-style letters using rectangular segments
    // Returns objects with {x, y, width, height} for each segment

    const w = 1;  // Full width
    const h = 1;  // Full height
    const t = 0.15;  // Thickness

    return {
        'A': [
            {x: 0, y: 0, width: t, height: h},  // Left vertical
            {x: w-t, y: 0, width: t, height: h},  // Right vertical
            {x: 0, y: h-t, width: w, height: t},  // Top horizontal
            {x: 0, y: h/2-t/2, width: w, height: t}  // Middle horizontal
        ],
        'B': [
            {x: 0, y: 0, width: t, height: h},  // Left vertical
            {x: 0, y: h-t, width: w, height: t},  // Top
            {x: 0, y: h/2-t/2, width: w, height: t},  // Middle
            {x: 0, y: 0, width: w, height: t},  // Bottom
            {x: w-t, y: h/2, width: t, height: h/2},  // Top right
            {x: w-t, y: 0, width: t, height: h/2}  // Bottom right
        ],
        'C': [
            {x: 0, y: 0, width: t, height: h},  // Left vertical
            {x: 0, y: h-t, width: w, height: t},  // Top
            {x: 0, y: 0, width: w, height: t}  // Bottom
        ],
        'D': [
            {x: 0, y: 0, width: t, height: h},  // Left vertical
            {x: 0, y: h-t, width: w-t, height: t},  // Top
            {x: 0, y: 0, width: w-t, height: t},  // Bottom
            {x: w-t, y: t, width: t, height: h-2*t}  // Right vertical (shorter)
        ],
        'E': [
            {x: 0, y: 0, width: t, height: h},  // Left vertical
            {x: 0, y: h-t, width: w, height: t},  // Top
            {x: 0, y: h/2-t/2, width: w*0.7, height: t},  // Middle
            {x: 0, y: 0, width: w, height: t}  // Bottom
        ],
        'F': [
            {x: 0, y: 0, width: t, height: h},  // Left vertical
            {x: 0, y: h-t, width: w, height: t},  // Top
            {x: 0, y: h/2-t/2, width: w*0.7, height: t}  // Middle
        ],
        'G': [
            {x: 0, y: 0, width: t, height: h},  // Left vertical
            {x: 0, y: h-t, width: w, height: t},  // Top
            {x: 0, y: 0, width: w, height: t},  // Bottom
            {x: w-t, y: 0, width: t, height: h/2},  // Bottom right
            {x: w/2, y: h/2-t/2, width: w/2, height: t}  // Middle right
        ],
        'H': [
            {x: 0, y: 0, width: t, height: h},  // Left vertical
            {x: w-t, y: 0, width: t, height: h},  // Right vertical
            {x: 0, y: h/2-t/2, width: w, height: t}  // Middle
        ],
        'I': [
            {x: w/2-t/2, y: 0, width: t, height: h},  // Center vertical
            {x: 0, y: h-t, width: w, height: t},  // Top
            {x: 0, y: 0, width: w, height: t}  // Bottom
        ],
        'J': [
            {x: w-t, y: t, width: t, height: h-t},  // Right vertical
            {x: 0, y: 0, width: w, height: t},  // Bottom
            {x: 0, y: 0, width: t, height: h/3}  // Bottom left
        ],
        'K': [
            {x: 0, y: 0, width: t, height: h},  // Left vertical
            {x: w-t, y: h/2, width: t, height: h/2},  // Top right diagonal approx
            {x: w-t, y: 0, width: t, height: h/2},  // Bottom right diagonal approx
            {x: t, y: h/2-t/2, width: w/2, height: t}  // Middle connector
        ],
        'L': [
            {x: 0, y: 0, width: t, height: h},  // Left vertical
            {x: 0, y: 0, width: w, height: t}  // Bottom
        ],
        'M': [
            {x: 0, y: 0, width: t, height: h},  // Left vertical
            {x: w-t, y: 0, width: t, height: h},  // Right vertical
            {x: t, y: h-t, width: w/2-t, height: t},  // Left top diagonal
            {x: w/2, y: h-t, width: w/2-t, height: t}  // Right top diagonal
        ],
        'N': [
            {x: 0, y: 0, width: t, height: h},  // Left vertical
            {x: w-t, y: 0, width: t, height: h},  // Right vertical
            {x: t, y: h/2, width: w-2*t, height: t}  // Diagonal approximation
        ],
        'O': [
            {x: 0, y: 0, width: t, height: h},  // Left vertical
            {x: w-t, y: 0, width: t, height: h},  // Right vertical
            {x: 0, y: h-t, width: w, height: t},  // Top
            {x: 0, y: 0, width: w, height: t}  // Bottom
        ],
        'P': [
            {x: 0, y: 0, width: t, height: h},  // Left vertical
            {x: 0, y: h-t, width: w, height: t},  // Top
            {x: 0, y: h/2-t/2, width: w, height: t},  // Middle
            {x: w-t, y: h/2, width: t, height: h/2}  // Top right
        ],
        'Q': [
            {x: 0, y: 0, width: t, height: h},  // Left vertical
            {x: w-t, y: t, width: t, height: h-t},  // Right vertical
            {x: 0, y: h-t, width: w, height: t},  // Top
            {x: 0, y: 0, width: w*0.7, height: t},  // Bottom
            {x: w*0.6, y: 0, width: w*0.4, height: t*1.5}  // Tail
        ],
        'R': [
            {x: 0, y: 0, width: t, height: h},  // Left vertical
            {x: 0, y: h-t, width: w, height: t},  // Top
            {x: 0, y: h/2-t/2, width: w, height: t},  // Middle
            {x: w-t, y: h/2, width: t, height: h/2},  // Top right
            {x: w-t, y: 0, width: t, height: h/2}  // Bottom right
        ],
        'S': [
            {x: 0, y: h-t, width: w, height: t},  // Top
            {x: 0, y: h/2, width: t, height: h/2},  // Top left
            {x: 0, y: h/2-t/2, width: w, height: t},  // Middle
            {x: w-t, y: 0, width: t, height: h/2},  // Bottom right
            {x: 0, y: 0, width: w, height: t}  // Bottom
        ],
        'T': [
            {x: w/2-t/2, y: 0, width: t, height: h},  // Center vertical
            {x: 0, y: h-t, width: w, height: t}  // Top
        ],
        'U': [
            {x: 0, y: 0, width: t, height: h},  // Left vertical
            {x: w-t, y: 0, width: t, height: h},  // Right vertical
            {x: 0, y: 0, width: w, height: t}  // Bottom
        ],
        'V': [
            {x: 0, y: h/3, width: t, height: h*2/3},  // Left vertical (shorter)
            {x: w-t, y: h/3, width: t, height: h*2/3},  // Right vertical (shorter)
            {x: t, y: 0, width: w-2*t, height: t*2}  // Bottom V-shape approx
        ],
        'W': [
            {x: 0, y: 0, width: t, height: h},  // Left vertical
            {x: w-t, y: 0, width: t, height: h},  // Right vertical
            {x: w/2-t/2, y: 0, width: t, height: h*2/3}  // Middle vertical
        ],
        'X': [
            {x: 0, y: h/2, width: t, height: h/2},  // Top left
            {x: 0, y: 0, width: t, height: h/2},  // Bottom left
            {x: w-t, y: h/2, width: t, height: h/2},  // Top right
            {x: w-t, y: 0, width: t, height: h/2},  // Bottom right
            {x: t, y: h/2-t/2, width: w-2*t, height: t}  // Middle
        ],
        'Y': [
            {x: w/2-t/2, y: 0, width: t, height: h/2},  // Bottom center
            {x: 0, y: h/2, width: t, height: h/2},  // Top left
            {x: w-t, y: h/2, width: t, height: h/2},  // Top right
            {x: t, y: h/2-t/2, width: w/2-t, height: t},  // Left diagonal
            {x: w/2, y: h/2-t/2, width: w/2-t, height: t}  // Right diagonal
        ],
        'Z': [
            {x: 0, y: h-t, width: w, height: t},  // Top
            {x: 0, y: 0, width: w, height: t},  // Bottom
            {x: t, y: t, width: w-2*t, height: h-2*t}  // Diagonal (approximation)
        ],
        '0': [
            {x: 0, y: 0, width: t, height: h},
            {x: w-t, y: 0, width: t, height: h},
            {x: 0, y: h-t, width: w, height: t},
            {x: 0, y: 0, width: w, height: t}
        ],
        '1': [
            {x: w/2-t/2, y: 0, width: t, height: h}
        ],
        '2': [
            {x: 0, y: h-t, width: w, height: t},
            {x: w-t, y: h/2, width: t, height: h/2},
            {x: 0, y: h/2-t/2, width: w, height: t},
            {x: 0, y: 0, width: t, height: h/2},
            {x: 0, y: 0, width: w, height: t}
        ],
        '3': [
            {x: 0, y: h-t, width: w, height: t},
            {x: 0, y: h/2-t/2, width: w, height: t},
            {x: 0, y: 0, width: w, height: t},
            {x: w-t, y: 0, width: t, height: h}
        ],
        '4': [
            {x: 0, y: h/2, width: t, height: h/2},
            {x: 0, y: h/2-t/2, width: w, height: t},
            {x: w-t, y: 0, width: t, height: h}
        ],
        '5': [
            {x: 0, y: h-t, width: w, height: t},
            {x: 0, y: h/2, width: t, height: h/2},
            {x: 0, y: h/2-t/2, width: w, height: t},
            {x: w-t, y: 0, width: t, height: h/2},
            {x: 0, y: 0, width: w, height: t}
        ],
        '6': [
            {x: 0, y: 0, width: t, height: h},
            {x: 0, y: h-t, width: w, height: t},
            {x: 0, y: h/2-t/2, width: w, height: t},
            {x: w-t, y: 0, width: t, height: h/2},
            {x: 0, y: 0, width: w, height: t}
        ],
        '7': [
            {x: 0, y: h-t, width: w, height: t},
            {x: w-t, y: 0, width: t, height: h}
        ],
        '8': [
            {x: 0, y: 0, width: t, height: h},
            {x: w-t, y: 0, width: t, height: h},
            {x: 0, y: h-t, width: w, height: t},
            {x: 0, y: h/2-t/2, width: w, height: t},
            {x: 0, y: 0, width: w, height: t}
        ],
        '9': [
            {x: 0, y: h/2, width: t, height: h/2},
            {x: w-t, y: 0, width: t, height: h},
            {x: 0, y: h-t, width: w, height: t},
            {x: 0, y: h/2-t/2, width: w, height: t},
            {x: 0, y: 0, width: w, height: t}
        ],
        '?': [
            {x: w/2-t/2, y: 0, width: t, height: h}  // Simple vertical line for unknown chars
        ]
    };
}


function getShapeIcon(type) {
    const icons = {
        'box': '⬛',
        'sphere': '⚪',
        'cylinder': '⬜',
        'cone': '🔺',
        'csg': '✨',
        'text': '✏️'
    };
    return icons[type] || '📦';
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
                diameterBottom: obj.dimensions.baseSize * UNIT_SCALE,
                tessellation: 4
            }, scene);
            newMesh.rotation.x = Math.PI / 2;
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
            const outerCyl2 = BABYLON.MeshBuilder.CreateCylinder('outer', {
                height: obj.dimensions.height * UNIT_SCALE,
                diameter: obj.dimensions.outerRadius * 2 * UNIT_SCALE,
                tessellation: obj.dimensions.quality || 32
            }, scene);
            const innerCyl2 = BABYLON.MeshBuilder.CreateCylinder('inner', {
                height: obj.dimensions.height * UNIT_SCALE * 1.1,
                diameter: obj.dimensions.innerRadius * 2 * UNIT_SCALE,
                tessellation: obj.dimensions.quality || 32
            }, scene);
            const outerCSG2 = BABYLON.CSG.FromMesh(outerCyl2);
            const innerCSG2 = BABYLON.CSG.FromMesh(innerCyl2);
            const tubeCSG2 = outerCSG2.subtract(innerCSG2);
            newMesh = tubeCSG2.toMesh(oldMesh.name, null, scene);
            outerCyl2.dispose();
            innerCyl2.dispose();
            newMesh.rotation.x = Math.PI / 2;
            break;
        case 'text':
            // Rebuild text as a box placeholder
            const textWidth = obj.textContent.length * obj.fontSize * 0.6;
            const textHeight = obj.fontSize;
            newMesh = BABYLON.MeshBuilder.CreateBox(oldMesh.name, {
                width: textWidth * UNIT_SCALE,
                height: textHeight * UNIT_SCALE,
                depth: obj.dimensions.depth * UNIT_SCALE
            }, scene);
            break;
        /* WEDGE SHAPE DISABLED - Issues with transparency and CSG operations
        case 'wedge':
            const w2 = obj.dimensions.width * UNIT_SCALE / 2;
            const d2 = obj.dimensions.depth * UNIT_SCALE / 2;
            const h2 = obj.dimensions.height * UNIT_SCALE;

            const positions2 = [
                -w2, -d2, 0,  w2, -d2, 0,  w2,  d2, 0, -w2,  d2, 0,
                -w2,  d2, h2,  w2,  d2, h2
            ];

            const indices2 = [
                0, 2, 1,  0, 3, 2,
                0, 1, 5,  0, 5, 4,
                0, 4, 3,
                1, 2, 5,
                3, 4, 5,  3, 5, 2
            ];

            const normals2 = [];
            BABYLON.VertexData.ComputeNormals(positions2, indices2, normals2);

            const vertexData2 = new BABYLON.VertexData();
            vertexData2.positions = positions2;
            vertexData2.indices = indices2;
            vertexData2.normals = normals2;

            newMesh = new BABYLON.Mesh(oldMesh.name, scene);
            vertexData2.applyToMesh(newMesh);
            break;
        */
    }

    // Apply material and transforms
    newMesh.material = oldMesh.material;
    newMesh.position = pos;
    newMesh.rotation = rot;

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

// ============================================================================
// CUSTOM FONT FUNCTIONS (URL-based)
// ============================================================================

/**
 * Get custom fonts from localStorage
 */
function getCustomFonts() {
    const stored = localStorage.getItem('3dmaker_custom_fonts');
    return stored ? JSON.parse(stored) : [];
}

/**
 * Save custom fonts to localStorage
 */
function saveCustomFonts(fonts) {
    localStorage.setItem('3dmaker_custom_fonts', JSON.stringify(fonts));
}

/**
 * Load and populate custom fonts dropdown and list
 */
function loadCustomFonts() {
    const fonts = getCustomFonts();
    const customGroup = document.getElementById('custom-fonts-group');
    const customFontsList = document.getElementById('custom-fonts-list');
    const customFontsItems = document.getElementById('custom-fonts-items');

    if (fonts.length > 0) {
        // Show custom fonts in dropdown
        customGroup.style.display = 'block';
        customGroup.innerHTML = '<!-- Custom fonts -->';

        // Show custom fonts list
        customFontsList.style.display = 'block';
        customFontsItems.innerHTML = '';

        // Add each custom font to both dropdown and list
        fonts.forEach((font, index) => {
            // Add to dropdown
            const option = document.createElement('option');
            option.value = font.url;
            option.textContent = font.name;
            option.style.background = '#2a2a3e';
            option.style.color = 'white';
            customGroup.appendChild(option);

            // Add to list with delete button
            const fontItem = document.createElement('div');
            fontItem.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 4px 8px;
                margin-bottom: 4px;
                background: rgba(102, 126, 234, 0.1);
                border: 1px solid rgba(102, 126, 234, 0.3);
                border-radius: 4px;
                font-size: 12px;
                color: #fff;
            `;

            const fontNameSpan = document.createElement('span');
            fontNameSpan.textContent = font.name;
            fontNameSpan.style.flex = '1';
            fontNameSpan.style.overflow = 'hidden';
            fontNameSpan.style.textOverflow = 'ellipsis';
            fontNameSpan.style.whiteSpace = 'nowrap';

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '×';
            deleteBtn.style.cssText = `
                background: #ff6b6b;
                border: none;
                border-radius: 4px;
                color: white;
                font-size: 16px;
                font-weight: bold;
                width: 24px;
                height: 24px;
                cursor: pointer;
                transition: all 0.2s;
                margin-left: 8px;
                flex-shrink: 0;
            `;
            deleteBtn.onmouseover = () => {
                deleteBtn.style.background = '#ff5252';
                deleteBtn.style.transform = 'scale(1.1)';
            };
            deleteBtn.onmouseout = () => {
                deleteBtn.style.background = '#ff6b6b';
                deleteBtn.style.transform = 'scale(1)';
            };
            deleteBtn.onclick = () => deleteCustomFont(index);
            deleteBtn.title = 'Remove this font';

            fontItem.appendChild(fontNameSpan);
            fontItem.appendChild(deleteBtn);
            customFontsItems.appendChild(fontItem);
        });
    } else {
        // Hide both if no custom fonts
        customGroup.style.display = 'none';
        customFontsList.style.display = 'none';
    }
}

/**
 * Add custom font from URL
 */
async function addCustomFont() {
    const urlInput = document.getElementById('custom-font-url');
    const url = urlInput.value.trim();

    if (!url) {
        showToast('Please enter a font URL', 'error');
        return;
    }

    // Validate URL format
    try {
        new URL(url);
    } catch (e) {
        showToast('Invalid URL format', 'error');
        return;
    }

    // Validate .ttf extension
    if (!url.toLowerCase().endsWith('.ttf')) {
        showToast('URL must point to a .ttf font file', 'error');
        return;
    }

    // Get existing fonts
    const fonts = getCustomFonts();

    // Check if URL already exists
    if (fonts.some(f => f.url === url)) {
        showToast('This font URL is already added', 'warning');
        return;
    }

    // Show loading message
    showToast('Loading font to verify...', 'info');

    // Load the font to get its real name and validate it works
    let fontName;
    try {
        // Check if opentype.js is available
        if (typeof opentype === 'undefined') {
            throw new Error('Font library not loaded');
        }

        // Load the font
        const font = await opentype.load(url);

        // Extract the real font family name from font metadata
        // Try different name properties in order of preference
        fontName = font.names.fontFamily?.en ||
                   font.names.fullName?.en ||
                   font.names.postScriptName?.en;

        // If no name found in metadata, fall back to filename
        if (!fontName) {
            const urlParts = url.split('/');
            const filename = urlParts[urlParts.length - 1];
            fontName = filename.replace('.ttf', '').replace(/[_-]/g, ' ');
        }

        // Also get subfamily (e.g., "Bold", "Italic") if available
        const subfamily = font.names.fontSubfamily?.en;
        if (subfamily && subfamily !== 'Regular' && !fontName.includes(subfamily)) {
            fontName += ' ' + subfamily;
        }

        console.log('Font loaded successfully:', fontName, font);

        // Cache the font for immediate use
        loadedFonts.set(url, font);

    } catch (error) {
        console.error('Failed to load font:', error);
        showToast('Failed to load font from URL. Please check the URL is correct and publicly accessible.', 'error');
        return;
    }

    // Add new font
    fonts.push({ name: fontName, url: url });
    saveCustomFonts(fonts);

    // Reload dropdown
    loadCustomFonts();

    // Clear input
    urlInput.value = '';

    // Select the new font
    const fontSelect = document.getElementById('text-font');
    fontSelect.value = url;

    showToast(`Added font: ${fontName}`, 'success');
}

/**
 * Delete custom font
 */
function deleteCustomFont(index) {
    const fonts = getCustomFonts();
    const deletedFont = fonts[index];

    // Remove from cache if loaded
    if (loadedFonts.has(deletedFont.url)) {
        loadedFonts.delete(deletedFont.url);
    }

    // Remove from stored fonts
    fonts.splice(index, 1);
    saveCustomFonts(fonts);

    // Reload the fonts list
    loadCustomFonts();

    // Reset dropdown to default if deleted font was selected
    const fontSelect = document.getElementById('text-font');
    if (fontSelect.value === deletedFont.url) {
        fontSelect.value = 'Roboto-Regular.ttf';
    }

    showToast(`Removed font: ${deletedFont.name}`, 'success');
}
