/**
 * 3DMaker - View Modes
 * Non-destructive viewing aids for inspecting the inside of models:
 *   - Cross-section: a movable clip plane that slices the scene open
 *   - X-ray: temporarily makes every shape see-through
 *   - Isolate: temporarily hides everything except the selection
 * None of these touch geometry or saved project data -- they only change
 * how the scene is drawn, and each fully restores state when turned off.
 */

let sectionActive = false;
let sectionAxis = 'z';   // 'x' | 'y' | 'z'
let sectionFlip = false;
let sectionT = 0.5;      // 0..1 position along the axis bounds
let _sectionGridWasVisible = true;

let xrayActive = false;
let _xrayBackup = [];    // restore alpha/transparency per mesh

let isolateActive = false;
let _isolateBackup = []; // restore visibility per mesh

// ---- Cross-section -----------------------------------------------------

function toggleSection() {
    sectionActive = !sectionActive;
    const panel = document.getElementById('section-panel');
    const btn = document.getElementById('section-btn');

    if (sectionActive) {
        if (btn) btn.classList.add('active');
        if (panel) panel.style.display = 'block';
        // Hide the grid/axes while slicing so the clip plane doesn't carve them up.
        _sectionGridWasVisible = workplaneVisible;
        workplaneElements.forEach(e => { e.isVisible = false; });
        _applySectionPlane();
        showToast('Section view on - drag the slider to slice');
    } else {
        if (btn) btn.classList.remove('active');
        if (panel) panel.style.display = 'none';
        scene.clipPlane = null;
        if (_sectionGridWasVisible) {
            workplaneElements.forEach(e => { e.isVisible = true; });
        }
        showToast('Section view off');
    }
}

function setSectionAxis(axis) {
    sectionAxis = axis;
    ['x', 'y', 'z'].forEach(a => {
        const b = document.getElementById('section-axis-' + a);
        if (b) b.classList.toggle('active', a === axis);
    });
    if (sectionActive) _applySectionPlane();
}

function flipSection() {
    sectionFlip = !sectionFlip;
    if (sectionActive) _applySectionPlane();
}

function onSectionSlider(value) {
    sectionT = Math.max(0, Math.min(1, value / 100));
    if (sectionActive) _applySectionPlane();
}

// Combined world-space bounds of all object meshes.
function _modelBounds() {
    let min = null, max = null;
    objects.forEach(o => {
        if (!o.mesh) return;
        o.mesh.computeWorldMatrix(true);
        const bb = o.mesh.getBoundingInfo().boundingBox;
        if (!min) { min = bb.minimumWorld.clone(); max = bb.maximumWorld.clone(); }
        else {
            min = BABYLON.Vector3.Minimize(min, bb.minimumWorld);
            max = BABYLON.Vector3.Maximize(max, bb.maximumWorld);
        }
    });
    if (!min) { min = new BABYLON.Vector3(-1, -1, -1); max = new BABYLON.Vector3(1, 1, 1); }
    return { min, max };
}

function _applySectionPlane() {
    const { min, max } = _modelBounds();
    const lo = { x: min.x, y: min.y, z: min.z }[sectionAxis];
    const hi = { x: max.x, y: max.y, z: max.z }[sectionAxis];
    // Small padding so the slider extremes fully reveal/hide the model.
    const pad = (hi - lo) * 0.02 + 1e-4;
    const pos = (lo - pad) + (hi - lo + 2 * pad) * sectionT;
    const dir = sectionFlip ? -1 : 1;
    const normal = new BABYLON.Vector3(
        sectionAxis === 'x' ? dir : 0,
        sectionAxis === 'y' ? dir : 0,
        sectionAxis === 'z' ? dir : 0
    );
    const point = new BABYLON.Vector3(
        sectionAxis === 'x' ? pos : 0,
        sectionAxis === 'y' ? pos : 0,
        sectionAxis === 'z' ? pos : 0
    );
    scene.clipPlane = BABYLON.Plane.FromPositionAndNormal(point, normal);
}

// ---- X-ray -------------------------------------------------------------

function toggleXray() {
    xrayActive = !xrayActive;
    const btn = document.getElementById('xray-btn');

    if (xrayActive) {
        if (btn) btn.classList.add('active');
        _xrayBackup = [];
        objects.forEach(o => {
            const m = o.mesh && o.mesh.material;
            if (!m) return;
            _xrayBackup.push({
                mesh: o.mesh,
                alpha: m.alpha,
                transparencyMode: m.transparencyMode,
                disableDepthWrite: m.disableDepthWrite,
                needDepthPrePass: m.needDepthPrePass,
                renderingGroupId: o.mesh.renderingGroupId
            });
            m.alpha = 0.22;
            m.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
            m.disableDepthWrite = false;
            m.needDepthPrePass = true;
            o.mesh.renderingGroupId = 1;
        });
        showToast('X-ray on');
    } else {
        if (btn) btn.classList.remove('active');
        _xrayBackup.forEach(b => {
            if (!b.mesh || b.mesh.isDisposed()) return;
            const m = b.mesh.material;
            if (m) {
                m.alpha = b.alpha;
                m.transparencyMode = b.transparencyMode;
                m.disableDepthWrite = b.disableDepthWrite;
                m.needDepthPrePass = b.needDepthPrePass;
            }
            b.mesh.renderingGroupId = b.renderingGroupId;
        });
        _xrayBackup = [];
        showToast('X-ray off');
    }
}

// ---- Isolate -----------------------------------------------------------

function toggleIsolate() {
    const btn = document.getElementById('isolate-btn');

    if (!isolateActive) {
        if (!selectedObjects || selectedObjects.length === 0) {
            showToast('Select an object first to isolate it', 'error');
            return;
        }
        isolateActive = true;
        if (btn) btn.classList.add('active');
        const keep = new Set(selectedObjects.map(o => o.mesh));
        _isolateBackup = [];
        objects.forEach(o => {
            if (!o.mesh) return;
            _isolateBackup.push({
                mesh: o.mesh,
                visible: o.mesh.isVisible,
                wireframe: o.wireframeClone || null,
                wireframeVisible: o.wireframeClone ? o.wireframeClone.isVisible : null
            });
            const show = keep.has(o.mesh);
            o.mesh.isVisible = show;
            if (o.wireframeClone) o.wireframeClone.isVisible = show;
        });
        showToast('Isolated selection - everything else hidden');
    } else {
        isolateActive = false;
        if (btn) btn.classList.remove('active');
        _isolateBackup.forEach(b => {
            if (!b.mesh || b.mesh.isDisposed()) return;
            b.mesh.isVisible = b.visible;
            if (b.wireframe && !b.wireframe.isDisposed()) b.wireframe.isVisible = b.wireframeVisible;
        });
        _isolateBackup = [];
        showToast('Isolate off');
    }
}
