/**
 * 3DMaker - Scene Initialization
 * Babylon.js scene setup, camera, lighting, grid, and event handlers
 */
function initScene() {
    canvas = document.getElementById('renderCanvas');
    engine = new BABYLON.Engine(canvas, true);
    scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.06, 0.06, 0.12, 1);

    // Use right-handed coordinate system with Z-up for proper 3D printing orientation
    // This gives us: X+ right, Y+ back, Z+ up
    scene.useRightHandedSystem = true;

    // Camera - positioned for Z-up view with clear gizmo visibility
    camera = new BABYLON.ArcRotateCamera(
        "camera",
        Math.PI * 0.25,   // Alpha: rotate around Z axis (front-right view)
        Math.PI / 3,      // Beta: angle from Z axis (tilt down to see platform)
        15,               // Radius: distance from target
        new BABYLON.Vector3(0, 0, 0),
        scene
    );
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 5;
    camera.upperRadiusLimit = 50;
    camera.wheelPrecision = 50;

    // Set Z axis as up (this is the key for Z-up coordinate system)
    camera.upVector = new BABYLON.Vector3(0, 0, 1);

    // Lights - adjusted for Z-up
    light = new BABYLON.HemisphericLight(
        "light",
        new BABYLON.Vector3(0, 0, 1),  // Light from above (Z-up)
        scene
    );
    light.intensity = 0.7;

    const dirLight = new BABYLON.DirectionalLight(
        "dirLight",
        new BABYLON.Vector3(-1, -1, -2),  // Adjusted for Z-up
        scene
    );
    dirLight.intensity = 0.5;

    // Build Platform / Workplane - on XY plane (Z=0) for Z-up system
    // Grid is 20x20 Babylon units = 200x200mm (each square = 10mm)
    const gridSize = 20;
    const gridSpacing = 1;

    // Create main ground plane
    const ground = BABYLON.MeshBuilder.CreatePlane(
        "ground",
        { width: gridSize, height: gridSize },
        scene
    );
    const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.2);
    groundMat.specularColor = new BABYLON.Color3(0, 0, 0);
    groundMat.backFaceCulling = false;
    groundMat.alpha = 0.9;
    ground.material = groundMat;
    ground.position.z = -0.01; // Slightly below grid lines
    ground.isPickable = false;
    ground.renderingGroupId = 0; // Render ground first, before transparent objects
    workplaneElements.push(ground); // Store for toggling

    // Create grid lines
    const gridLines = [];
    const gridColor = new BABYLON.Color3(0.3, 0.3, 0.4);
    const axisColorX = new BABYLON.Color3(0.8, 0.2, 0.2); // Red for X
    const axisColorY = new BABYLON.Color3(0.2, 0.8, 0.2); // Green for Y
    const axisColorZ = new BABYLON.Color3(0.3, 0.5, 1); // Blue for Z

    // Grid lines parallel to X axis (varying Y) - runs left/right
    for (let i = -gridSize/2; i <= gridSize/2; i += gridSpacing) {
        const isAxis = (i === 0);
        const color = isAxis ? axisColorX : gridColor; // RED for X axis (left/right)
        const points = [
            new BABYLON.Vector3(-gridSize/2, i, 0),
            new BABYLON.Vector3(gridSize/2, i, 0)
        ];
        const line = BABYLON.MeshBuilder.CreateLines(`gridX_${i}`, {points: points}, scene);
        line.color = color;
        line.isPickable = false;
        gridLines.push(line);
        workplaneElements.push(line); // Store for toggling

        // Store X axis line for toggling
        if (isAxis) {
            axisLines.push(line);
        }
    }

    // Grid lines parallel to Y axis (varying X) - runs front/back
    for (let i = -gridSize/2; i <= gridSize/2; i += gridSpacing) {
        const isAxis = (i === 0);
        const color = isAxis ? axisColorY : gridColor; // GREEN for Y axis (front/back)
        const points = [
            new BABYLON.Vector3(i, -gridSize/2, 0),
            new BABYLON.Vector3(i, gridSize/2, 0)
        ];
        const line = BABYLON.MeshBuilder.CreateLines(`gridY_${i}`, {points: points}, scene);
        line.color = color;
        line.isPickable = false;
        gridLines.push(line);
        workplaneElements.push(line); // Store for toggling

        // Store Y axis line for toggling
        if (isAxis) {
            axisLines.push(line);
        }
    }

    // Z axis line (vertical - up/down)
    const zAxisPoints = [
        new BABYLON.Vector3(0, 0, -gridSize/2),
        new BABYLON.Vector3(0, 0, gridSize/2)
    ];
    const zAxisLine = BABYLON.MeshBuilder.CreateLines('axisZ', {points: zAxisPoints}, scene);
    zAxisLine.color = axisColorZ;
    zAxisLine.isPickable = false;
    gridLines.push(zAxisLine);
    axisLines.push(zAxisLine);
    workplaneElements.push(zAxisLine); // Store for toggling

    // Add subtle edge border to build platform
    const borderPoints = [
        new BABYLON.Vector3(-gridSize/2, -gridSize/2, 0),
        new BABYLON.Vector3(gridSize/2, -gridSize/2, 0),
        new BABYLON.Vector3(gridSize/2, gridSize/2, 0),
        new BABYLON.Vector3(-gridSize/2, gridSize/2, 0),
        new BABYLON.Vector3(-gridSize/2, -gridSize/2, 0)
    ];
    const border = BABYLON.MeshBuilder.CreateLines("border", {points: borderPoints}, scene);
    border.color = new BABYLON.Color3(0.5, 0.5, 0.6);
    border.isPickable = false;
    workplaneElements.push(border); // Store for toggling

    // Create gizmo manager for transform controls
    gizmoManager = new BABYLON.GizmoManager(scene);
    gizmoManager.positionGizmoEnabled = true;
    gizmoManager.rotationGizmoEnabled = false;
    gizmoManager.scaleGizmoEnabled = false;
    gizmoManager.boundingBoxGizmoEnabled = false;
    gizmoManager.usePointerToAttachGizmos = false;

    // Customize gizmo colors and scale for clarity and ease of use
    if (gizmoManager.gizmos.positionGizmo) {
        // Scale up gizmos to make them MUCH easier to grab for younger students
        // Using 2.5x scale for very noticeable difference
        gizmoManager.gizmos.positionGizmo.scaleRatio = 2.5;

        // Also increase the thickness of the gizmo lines/arrows
        gizmoManager.gizmos.positionGizmo.xGizmo.scaleRatio = 2.5;
        gizmoManager.gizmos.positionGizmo.yGizmo.scaleRatio = 2.5;
        gizmoManager.gizmos.positionGizmo.zGizmo.scaleRatio = 2.5;

        // Customize colors
        gizmoManager.gizmos.positionGizmo.xGizmo.coloredMaterial.diffuseColor = new BABYLON.Color3(1, 0, 0);
        gizmoManager.gizmos.positionGizmo.yGizmo.coloredMaterial.diffuseColor = new BABYLON.Color3(0, 1, 0);
        gizmoManager.gizmos.positionGizmo.zGizmo.coloredMaterial.diffuseColor = new BABYLON.Color3(0, 0.5, 1);

        // Set initial snap distance if snap is enabled
        updateGizmoSnapDistance();
    }

    // Leave rotation gizmos at default - Babylon.js doesn't support making just the tube thicker
    // without breaking functionality
    if (gizmoManager.gizmos.scaleGizmo) {
        gizmoManager.gizmos.scaleGizmo.scaleRatio = 2.5;
    }

    // ===== OPTION A: BoundingBoxGizmo (CENTER-SCALING) - PRESERVED FOR FALLBACK =====
    // This approach works but scales from center (both sides move equally)
    // Uncomment this block and comment out Option B to restore center-scaling behavior
    /*
    const utilLayer = new BABYLON.UtilityLayerRenderer(scene);
    boundingBoxGizmo = new BABYLON.BoundingBoxGizmo(BABYLON.Color3.FromHexString("#667eea"), utilLayer);
    boundingBoxGizmo.attachedMesh = null;
    boundingBoxGizmo.setEnabledRotationAxis("");
    boundingBoxGizmo.fixedDragMeshScreenSize = true;
    boundingBoxGizmo.scaleDragSpeed = 1.5;

    let sizeStartDimensions = null;
    let sizeStartScale = null;
    let sizeStartPosition = null;

    boundingBoxGizmo.onScaleBoxDragObservable.add(() => {
        if (selectedObject && !sizeStartDimensions) {
            sizeStartDimensions = JSON.parse(JSON.stringify(selectedObject.dimensions));
            sizeStartScale = selectedObject.mesh.scaling.clone();
            sizeStartPosition = selectedObject.mesh.position.clone();
        }
    });

    boundingBoxGizmo.onScaleBoxDragEndObservable.add(() => {
        if (selectedObject && sizeStartDimensions && selectedObject.type === 'box') {
            const currentScale = selectedObject.mesh.scaling;
            selectedObject.dimensions.width = Math.max(1, sizeStartDimensions.width * (currentScale.x / sizeStartScale.x));
            selectedObject.dimensions.depth = Math.max(1, sizeStartDimensions.depth * (currentScale.y / sizeStartScale.y));
            selectedObject.dimensions.height = Math.max(1, sizeStartDimensions.height * (currentScale.z / sizeStartScale.z));
            boundingBoxGizmo.attachedMesh = null;
            rebuildMesh(selectedObject);
            selectedObject.mesh.position = sizeStartPosition;
            selectedObject.mesh.scaling = new BABYLON.Vector3(1, 1, 1);
            boundingBoxGizmo.attachedMesh = selectedObject.mesh;
            updateProperties();
            sizeStartDimensions = null;
            sizeStartScale = null;
            sizeStartPosition = null;
            saveState('Resize');
        }
    });
    */

    // ===== OPTION B: MANUAL ONE-SIDED RESIZING =====
    // Pointer interaction for size handles (defined in scene initialization)
    scene.onPointerObservable.add((pointerInfo) => {
        if (currentTransformMode !== 'size') return;

        if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
            const pickInfo = pointerInfo.pickInfo;
            if (pickInfo.hit && pickInfo.pickedMesh?.metadata?.isSizeHandle) {
                activeSizeHandle = pickInfo.pickedMesh;
                const obj = activeSizeHandle.metadata.parentObj;

                // Disable camera rotation during drag
                camera.detachControl();

                sizeStartState = {
                    dimensions: JSON.parse(JSON.stringify(obj.dimensions)),
                    position: obj.mesh.position.clone(),
                    mouseX: pointerInfo.event.clientX,
                    mouseY: pointerInfo.event.clientY,
                    snapIndicatorShown: false
                };
            }
        }

        if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE && activeSizeHandle && sizeStartState) {
            const obj = activeSizeHandle.metadata.parentObj;
            const axis = activeSizeHandle.metadata.axis;
            const dir = activeSizeHandle.metadata.direction;

            // Project mouse movement onto the 3D axis direction in screen space
            // This works correctly from ANY camera angle AND for rotated objects

            // Get the axis direction vector in LOCAL space
            const localAxisVector = new BABYLON.Vector3(
                axis === 'x' ? dir : 0,
                axis === 'y' ? dir : 0,
                axis === 'z' ? dir : 0
            );

            // Transform to WORLD space by applying the box's rotation
            const rotationMatrix = BABYLON.Matrix.RotationYawPitchRoll(
                obj.mesh.rotation.y,
                obj.mesh.rotation.x,
                obj.mesh.rotation.z
            );
            const axisVector = BABYLON.Vector3.TransformNormal(localAxisVector, rotationMatrix);

            // Project handle's world position to screen space
            const handleScreenPos = BABYLON.Vector3.Project(
                activeSizeHandle.position,
                BABYLON.Matrix.Identity(),
                scene.getTransformMatrix(),
                camera.viewport.toGlobal(
                    engine.getRenderWidth(),
                    engine.getRenderHeight()
                )
            );

            // Project a point 1 unit along the axis to screen space
            const axisEndWorldPos = activeSizeHandle.position.add(axisVector);
            const axisEndScreenPos = BABYLON.Vector3.Project(
                axisEndWorldPos,
                BABYLON.Matrix.Identity(),
                scene.getTransformMatrix(),
                camera.viewport.toGlobal(
                    engine.getRenderWidth(),
                    engine.getRenderHeight()
                )
            );

            // Calculate the axis direction in screen space
            const screenAxisDir = axisEndScreenPos.subtract(handleScreenPos);
            screenAxisDir.z = 0; // Ignore Z (depth)
            const screenAxisDirNormalized = screenAxisDir.normalize();

            // Calculate mouse movement in screen space
            const mouseDeltaX = pointerInfo.event.clientX - sizeStartState.mouseX;
            const mouseDeltaY = pointerInfo.event.clientY - sizeStartState.mouseY;
            const mouseMovement = new BABYLON.Vector2(mouseDeltaX, mouseDeltaY);

            // Project mouse movement onto the screen-space axis direction
            const projectedMovement = BABYLON.Vector2.Dot(
                mouseMovement,
                new BABYLON.Vector2(screenAxisDirNormalized.x, screenAxisDirNormalized.y)
            );

            // Scale to reasonable sensitivity
            const sensitivityFactor = 0.5;
            let changeMm = projectedMovement * sensitivityFactor;

            // Calculate new dimension
            const dimKey = axis === 'x' ? 'width' : axis === 'y' ? 'depth' : 'height';
            let newDim = sizeStartState.dimensions[dimKey] + changeMm;

            // SHIFT KEY: Snap to 1mm increments for precision
            if (pointerInfo.event.shiftKey) {
                newDim = Math.round(newDim);
                changeMm = newDim - sizeStartState.dimensions[dimKey];

                // Show snap mode indicator once
                if (!sizeStartState.snapIndicatorShown) {
                    showToast('Snap Mode: 1mm increments (Shift held)');
                    sizeStartState.snapIndicatorShown = true;
                }
            }

            newDim = Math.max(1, newDim);

            // Update dimension (just for visual preview, actual update happens on release)
            if (axis === 'x') obj.dimensions.width = newDim;
            else if (axis === 'y') obj.dimensions.depth = newDim;
            else if (axis === 'z') obj.dimensions.height = newDim;

            // Calculate position offset to keep opposite face fixed
            // The offset needs to be along the ROTATED axis direction
            const dimensionChange = newDim - sizeStartState.dimensions[dimKey];
            const offsetAmount = (dimensionChange / 2) * UNIT_SCALE;

            // Create offset vector along the local axis
            const localOffsetVec = new BABYLON.Vector3(
                axis === 'x' ? offsetAmount * dir : 0,
                axis === 'y' ? offsetAmount * dir : 0,
                axis === 'z' ? offsetAmount * dir : 0
            );

            // Transform to world space using the box's rotation
            const offsetVec = BABYLON.Vector3.TransformNormal(localOffsetVec, rotationMatrix);

            // Update visual feedback by scaling
            const scaleFactor = newDim / sizeStartState.dimensions[dimKey];
            if (axis === 'x') obj.mesh.scaling.x = scaleFactor;
            else if (axis === 'y') obj.mesh.scaling.y = scaleFactor;
            else if (axis === 'z') obj.mesh.scaling.z = scaleFactor;

            obj.mesh.position = sizeStartState.position.add(offsetVec);
            updateSizeHandles(obj);

            // Show dimension label near the handle
            showDimensionLabel(axis, newDim, handleScreenPos.x, handleScreenPos.y);
        }

        if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERUP) {
            if (activeSizeHandle && sizeStartState) {
                const obj = activeSizeHandle.metadata.parentObj;
                const axis = activeSizeHandle.metadata.axis;
                const dir = activeSizeHandle.metadata.direction;

                // Get the final dimensions from the object (already updated during drag)
                const finalDimensions = {
                    width: obj.dimensions.width,
                    depth: obj.dimensions.depth,
                    height: obj.dimensions.height
                };

                // Calculate final position offset using ROTATED axes
                const dimKey = axis === 'x' ? 'width' : axis === 'y' ? 'depth' : 'height';
                const dimensionChange = finalDimensions[dimKey] - sizeStartState.dimensions[dimKey];
                const offsetAmount = (dimensionChange / 2) * UNIT_SCALE;

                // Create offset in local space
                const localOffsetVec = new BABYLON.Vector3(
                    axis === 'x' ? offsetAmount * dir : 0,
                    axis === 'y' ? offsetAmount * dir : 0,
                    axis === 'z' ? offsetAmount * dir : 0
                );

                // Transform to world space using box's rotation
                const rotationMatrix = BABYLON.Matrix.RotationYawPitchRoll(
                    obj.mesh.rotation.y,
                    obj.mesh.rotation.x,
                    obj.mesh.rotation.z
                );
                const worldOffsetVec = BABYLON.Vector3.TransformNormal(localOffsetVec, rotationMatrix);

                const finalPosition = sizeStartState.position.add(worldOffsetVec);

                // Rebuild mesh with new dimensions (pass final position separately)
                rebuildMesh(obj, finalPosition);

                updateSizeHandles(obj);
                updateProperties();
                saveState('Resize');

                activeSizeHandle = null;
                sizeStartState = null;

                // Hide dimension label
                hideDimensionLabel();
            }

            // Re-enable camera rotation
            camera.attachControl(canvas, true);
        }
    });

    // Track if we're currently dragging for property updates
    let wasDragging = false;
    let sizeDragStart = null; // Track original dimensions for size mode

    // Render loop
    engine.runRenderLoop(() => {
        scene.render();

        // Update properties panel in real-time during standard gizmo dragging
        const isDragging = gizmoManager.gizmos.positionGizmo?.isDragging ||
                           gizmoManager.gizmos.rotationGizmo?.isDragging ||
                           gizmoManager.gizmos.scaleGizmo?.isDragging;

        if (isDragging && selectedObject) {
            updateProperties();
        }

        // Save state when drag ends (for standard gizmos, not size mode)
        if (wasDragging && !isDragging && currentTransformMode !== 'size') {
            saveState('Transform');
        }
        wasDragging = isDragging;
    });

    // Resize handler
    window.addEventListener('resize', () => {
        engine.resize();
    });

    // Click selection
    scene.onPointerDown = (evt, pickResult) => {
        // Ignore clicks on gizmos, grid, origin, border, and size handles
        if (pickResult.pickedMesh &&
            (pickResult.pickedMesh.name.includes('Gizmo') ||
             pickResult.pickedMesh.name.includes('grid') ||
             pickResult.pickedMesh.name.includes('sizeHandle') ||
             pickResult.pickedMesh.name === 'origin' ||
             pickResult.pickedMesh.name === 'border' ||
             pickResult.pickedMesh.name === 'ground')) {
            // Click on background - deselect if not holding Ctrl (but not on size handles)
            if (!pickResult.pickedMesh.name.includes('sizeHandle') && !evt.ctrlKey && !evt.metaKey) {
                deselectAll();
            }
            return;
        }

        if (pickResult.hit) {
            const obj = objects.find(o => o.mesh === pickResult.pickedMesh);
            if (obj) {
                if (evt.ctrlKey || evt.metaKey) {
                    toggleSelection(obj);
                } else {
                    selectObject(obj);
                }
            }
        } else if (!evt.ctrlKey && !evt.metaKey) {
            deselectAll();
        }
    };

    // Don't save initial empty state - first user action will be the first history entry
    // Expose globals for platform adapter (let declarations don't create window properties)
    window.engine = engine;
    window.camera = camera;
    window.gizmoManager = gizmoManager;
    window.workplaneElements = workplaneElements;
    window.workplaneVisible = workplaneVisible;

    sceneReady = true;
    console.log('3DMaker scene initialized successfully');
}
