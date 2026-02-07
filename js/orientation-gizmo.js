/**
 * 3DMaker - Orientation Gizmo
 * Mini 3D viewport showing current axis orientation
 */

let gizmoCanvas, gizmoEngine, gizmoScene, gizmoCamera;

function initOrientationGizmo() {
    gizmoCanvas = document.getElementById('orientation-gizmo');
    if (!gizmoCanvas) return;

    gizmoEngine = new BABYLON.Engine(gizmoCanvas, true, { preserveDrawingBuffer: true, stencil: true });
    gizmoScene = new BABYLON.Scene(gizmoEngine);
    gizmoScene.clearColor = new BABYLON.Color4(0, 0, 0, 0); // Transparent

    // Use same coordinate system as main scene
    gizmoScene.useRightHandedSystem = true;

    // Camera - fixed distance, will rotate to match main camera
    gizmoCamera = new BABYLON.ArcRotateCamera(
        "gizmoCamera",
        0,
        0,
        3.5,
        BABYLON.Vector3.Zero(),
        gizmoScene
    );
    gizmoCamera.upVector = new BABYLON.Vector3(0, 0, 1);

    // Lighting
    const light = new BABYLON.HemisphericLight(
        "gizmoLight",
        new BABYLON.Vector3(0, 0, 1),
        gizmoScene
    );
    light.intensity = 1;

    // Shorter axes to prevent overflow
    const axisLength = 0.9;
    const labelPos = 1.15;

    // Create X axis (Red)
    const xAxis = BABYLON.MeshBuilder.CreateLines("xAxis", {
        points: [
            BABYLON.Vector3.Zero(),
            new BABYLON.Vector3(axisLength, 0, 0)
        ]
    }, gizmoScene);
    xAxis.color = new BABYLON.Color3(1, 0, 0);

    // Create Y axis (Green)
    const yAxis = BABYLON.MeshBuilder.CreateLines("yAxis", {
        points: [
            BABYLON.Vector3.Zero(),
            new BABYLON.Vector3(0, axisLength, 0)
        ]
    }, gizmoScene);
    yAxis.color = new BABYLON.Color3(0, 1, 0);

    // Create Z axis (Blue)
    const zAxis = BABYLON.MeshBuilder.CreateLines("zAxis", {
        points: [
            BABYLON.Vector3.Zero(),
            new BABYLON.Vector3(0, 0, axisLength)
        ]
    }, gizmoScene);
    zAxis.color = new BABYLON.Color3(0.3, 0.5, 1);

    // Add text labels using planes with dynamic textures (bigger and closer)
    createAxisLabel("X", new BABYLON.Vector3(labelPos, 0, 0), new BABYLON.Color3(1, 0, 0));
    createAxisLabel("Y", new BABYLON.Vector3(0, labelPos, 0), new BABYLON.Color3(0, 1, 0));
    createAxisLabel("Z", new BABYLON.Vector3(0, 0, labelPos), new BABYLON.Color3(0.3, 0.5, 1));

    // Render loop
    gizmoEngine.runRenderLoop(() => {
        if (gizmoScene && gizmoCamera && camera) {
            // Sync camera rotation with main camera
            gizmoCamera.alpha = camera.alpha;
            gizmoCamera.beta = camera.beta;
            gizmoScene.render();
        }
    });

    // Handle resize
    window.addEventListener('resize', () => {
        if (gizmoEngine) {
            gizmoEngine.resize();
        }
    });
}

function createAxisLabel(text, position, color) {
    const plane = BABYLON.MeshBuilder.CreatePlane(`label${text}`, {
        width: 0.6,
        height: 0.6
    }, gizmoScene);
    plane.position = position;
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

    const material = new BABYLON.StandardMaterial(`labelMat${text}`, gizmoScene);
    const texture = new BABYLON.DynamicTexture(`labelTexture${text}`, 256, gizmoScene, true);
    texture.hasAlpha = true;

    const ctx = texture.getContext();
    ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle = `rgb(${color.r * 255}, ${color.g * 255}, ${color.b * 255})`;
    ctx.font = 'bold 180px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 128);
    texture.update();

    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.opacityTexture = texture;
    material.backFaceCulling = false;
    plane.material = material;
}
