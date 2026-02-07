/**
 * 3DMaker - Size Handle Management
 * Custom handles for one-sided box resizing
 */

function createSizeHandles(obj) {
    if (!scene) return;

    // Remove old handles
    sizeHandles.forEach(h => h.dispose());
    sizeHandles = [];

    if (!obj || obj.type !== 'box') return;

    const dims = obj.dimensions;
    const w = dims.width / 10; // Convert mm to Babylon units
    const d = dims.depth / 10;
    const h = dims.height / 10;
    const handleSize = 0.6; // Larger handles for easier clicking (was 0.3)
    const handleOffset = 0.5; // Push handles out from the face for easier grabbing

    // Get the box's rotation matrix to transform local positions to world positions
    const rotationMatrix = BABYLON.Matrix.RotationYawPitchRoll(
obj.mesh.rotation.y,
obj.mesh.rotation.x,
obj.mesh.rotation.z
    );

    // Define 6 face handles in local space: +X, -X, +Y, -Y, +Z, -Z
    // Position them offset from the face for easier clicking
    const faces = [
{ axis: 'x', dir: 1, localPos: new BABYLON.Vector3(w/2 + handleOffset, 0, 0), color: new BABYLON.Color3(1, 0.3, 0.3) },
{ axis: 'x', dir: -1, localPos: new BABYLON.Vector3(-w/2 - handleOffset, 0, 0), color: new BABYLON.Color3(0.7, 0.2, 0.2) },
{ axis: 'y', dir: 1, localPos: new BABYLON.Vector3(0, d/2 + handleOffset, 0), color: new BABYLON.Color3(0.3, 1, 0.3) },
{ axis: 'y', dir: -1, localPos: new BABYLON.Vector3(0, -d/2 - handleOffset, 0), color: new BABYLON.Color3(0.2, 0.7, 0.2) },
{ axis: 'z', dir: 1, localPos: new BABYLON.Vector3(0, 0, h/2 + handleOffset), color: new BABYLON.Color3(0.3, 0.6, 1) },
{ axis: 'z', dir: -1, localPos: new BABYLON.Vector3(0, 0, -h/2 - handleOffset), color: new BABYLON.Color3(0.2, 0.4, 0.7) }
    ];

    faces.forEach(face => {
const handle = BABYLON.MeshBuilder.CreateBox('sizeHandle', { size: handleSize }, scene);

// Transform local position by rotation matrix, then add mesh position
const worldPos = BABYLON.Vector3.TransformCoordinates(face.localPos, rotationMatrix);
handle.position = worldPos.add(obj.mesh.position);

// Rotate the handle to match the box's rotation
handle.rotation = obj.mesh.rotation.clone();

handle.isPickable = true;
handle.enablePointerMoveEvents = true; // Enable all pointer events

const mat = new BABYLON.StandardMaterial('handleMat', scene);
mat.diffuseColor = face.color;
mat.emissiveColor = face.color.scale(0.7); // Brighter for visibility
mat.alpha = 0.95; // More opaque for visibility
mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
mat.backFaceCulling = false; // Always visible from all angles
handle.material = mat;

// Ensure handles are always fully visible regardless of parent transparency
// Use rendering group 2 to render after transparent objects but stay opaque
handle.renderingGroupId = 2;

// Change cursor on hover for better UX
scene.hoverCursor = 'pointer';

handle.metadata = {
    isSizeHandle: true,
    axis: face.axis,
    direction: face.dir,
    parentObj: obj,
    localPosition: face.localPos.clone() // Store local position for updates
};

sizeHandles.push(handle);
    });
}

function updateSizeHandles(obj) {
    if (!scene || !obj || obj.type !== 'box' || sizeHandles.length === 0) return;

    const dims = obj.dimensions;
    const w = dims.width / 10;
    const d = dims.depth / 10;
    const h = dims.height / 10;
    const pos = obj.mesh.position;
    const handleOffset = 0.5; // Same offset as creation

    // Get rotation matrix for transforming local to world space
    const rotationMatrix = BABYLON.Matrix.RotationYawPitchRoll(
obj.mesh.rotation.y,
obj.mesh.rotation.x,
obj.mesh.rotation.z
    );

    const localPositions = [
new BABYLON.Vector3(w/2 + handleOffset, 0, 0),  // +X
new BABYLON.Vector3(-w/2 - handleOffset, 0, 0), // -X
new BABYLON.Vector3(0, d/2 + handleOffset, 0),  // +Y
new BABYLON.Vector3(0, -d/2 - handleOffset, 0), // -Y
new BABYLON.Vector3(0, 0, h/2 + handleOffset),  // +Z
new BABYLON.Vector3(0, 0, -h/2 - handleOffset)  // -Z
    ];

    sizeHandles.forEach((handle, i) => {
if (i < localPositions.length) {
    // Transform local position by rotation, then add world position
    const worldPos = BABYLON.Vector3.TransformCoordinates(localPositions[i], rotationMatrix);
    handle.position = worldPos.add(pos);
    handle.rotation = obj.mesh.rotation.clone();
}
    });
}

function removeSizeHandles() {
    sizeHandles.forEach(h => h.dispose());
    sizeHandles = [];
}
