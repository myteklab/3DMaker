/**
 * 3DMaker - Print Check
 * Finds what a slicer would surprise a student with: parts in mid-air, a design that
 * floats or sinks, gaps in the surface, walls too thin to print, overhangs, and a design
 * too big for the printer. Ideas and messages adapted from DabbleCAD's print check
 * (github.com/DJMcNewgent/DabbleCAD, Apache-2.0). DabbleCAD fuses shapes with a solid
 * kernel first; this app has none, so shapes stay separate and overlaps are handled
 * with inside tests instead.
 */

const PRINT_BED_MM = { x: 200, y: 200, z: 200 };
const PRINT_MIN_WALL_MM = 0.8; // two passes of a 0.4 mm nozzle
const PRINT_TOUCH_MM = 0.05;

let _printCheckOverlay = null;
let _printCheckTimer = null;
let _printCheckLast = null;

// World-space triangles in mm, oriented so normals point out.
function _printGeometry(obj) {
    const mesh = obj.mesh;
    const pos = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    if (!pos || !pos.length) return null;
    let idx = mesh.getIndices();
    if (!idx || !idx.length) idx = Array.from({ length: pos.length / 3 }, (_, i) => i);
    mesh.computeWorldMatrix(true);
    const m = mesh.getWorldMatrix().m;
    const s = 1 / UNIT_SCALE;
    const vc = pos.length / 3;
    const w = new Float64Array(vc * 3);
    for (let i = 0; i < vc; i++) {
        const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
        w[i * 3] = (x * m[0] + y * m[4] + z * m[8] + m[12]) * s;
        w[i * 3 + 1] = (x * m[1] + y * m[5] + z * m[9] + m[13]) * s;
        w[i * 3 + 2] = (x * m[2] + y * m[6] + z * m[10] + m[14]) * s;
    }

    // Babylon primitives split vertices at seams for normals and UVs, so weld by position
    // before asking whether the surface is closed or connected.
    const weld = new Map();
    const vid = new Int32Array(vc);
    const vpos = [];
    for (let i = 0; i < vc; i++) {
        const k = Math.round(w[i * 3] * 1000) + ',' + Math.round(w[i * 3 + 1] * 1000) + ',' + Math.round(w[i * 3 + 2] * 1000);
        let id = weld.get(k);
        if (id === undefined) { id = weld.size; weld.set(k, id); vpos.push(w[i * 3], w[i * 3 + 1], w[i * 3 + 2]); }
        vid[i] = id;
    }

    const tc = Math.floor(idx.length / 3);
    const tri = new Float64Array(tc * 9);
    const tv = new Int32Array(tc * 3);
    let vol = 0;
    for (let t = 0; t < tc; t++) {
        for (let c = 0; c < 3; c++) {
            const v = idx[t * 3 + c];
            tri[t * 9 + c * 3] = w[v * 3];
            tri[t * 9 + c * 3 + 1] = w[v * 3 + 1];
            tri[t * 9 + c * 3 + 2] = w[v * 3 + 2];
            tv[t * 3 + c] = vid[v];
        }
        const o = t * 9;
        vol += (tri[o] * (tri[o + 4] * tri[o + 8] - tri[o + 5] * tri[o + 7])
              - tri[o + 1] * (tri[o + 3] * tri[o + 8] - tri[o + 5] * tri[o + 6])
              + tri[o + 2] * (tri[o + 3] * tri[o + 7] - tri[o + 4] * tri[o + 6])) / 6;
    }
    // Mirroring and some imports leave the winding inside out. One flip for the whole
    // shape, not per piece, so a hollow's inner wall keeps facing into the hollow.
    if (vol < 0) {
        for (let t = 0; t < tc; t++) {
            const o = t * 9;
            for (let k = 0; k < 3; k++) { const a = tri[o + 3 + k]; tri[o + 3 + k] = tri[o + 6 + k]; tri[o + 6 + k] = a; }
            const a = tv[t * 3 + 1]; tv[t * 3 + 1] = tv[t * 3 + 2]; tv[t * 3 + 2] = a;
        }
        vol = -vol;
    }

    let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < tri.length; i += 3) {
        for (let k = 0; k < 3; k++) {
            if (tri[i + k] < min[k]) min[k] = tri[i + k];
            if (tri[i + k] > max[k]) max[k] = tri[i + k];
        }
    }
    const g = { obj, tri, tv, vpos, count: tc, volume: vol, min, max };
    g.bvh = _printBuildBVH(g);
    return g;
}

// Flat bounding-volume tree so a ray tests the few triangles near it, not all of them.
// Without it a 32-segment sphere took over a second.
function _printBuildBVH(g) {
    const n = g.count, tri = g.tri;
    const order = new Int32Array(n);
    const cen = new Float64Array(n * 3);
    for (let t = 0; t < n; t++) {
        order[t] = t;
        for (let k = 0; k < 3; k++) cen[t * 3 + k] = (tri[t * 9 + k] + tri[t * 9 + 3 + k] + tri[t * 9 + 6 + k]) / 3;
    }
    const box = [], left = [], start = [], cnt = [];
    const build = (lo, hi) => {
        const id = start.length;
        const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
        for (let i = lo; i < hi; i++) {
            const o = order[i] * 9;
            for (let c = 0; c < 9; c++) {
                const k = c % 3, v = tri[o + c];
                if (v < b[k]) b[k] = v;
                if (v > b[k + 3]) b[k + 3] = v;
            }
        }
        box.push(...b); start.push(lo); cnt.push(hi - lo); left.push(-1);
        if (hi - lo <= 8) return id;
        const ax = (b[3] - b[0] >= b[4] - b[1] && b[3] - b[0] >= b[5] - b[2]) ? 0 : (b[4] - b[1] >= b[5] - b[2] ? 1 : 2);
        const part = Array.from(order.subarray(lo, hi)).sort((a, c) => cen[a * 3 + ax] - cen[c * 3 + ax]);
        order.set(part, lo);
        const mid = (lo + hi) >> 1;
        build(lo, mid);
        // left child is always id + 1; this slot holds the right one
        left[id] = build(mid, hi);
        cnt[id] = 0;
        return id;
    };
    build(0, n);
    return { order, box: Float64Array.from(box), left: Int32Array.from(left), start: Int32Array.from(start), cnt: Int32Array.from(cnt) };
}

function _printRayBox(b, i, ox, oy, oz, ix, iy, iz, far) {
    let t0 = 0, t1 = far;
    let a = (b[i * 6] - ox) * ix, c = (b[i * 6 + 3] - ox) * ix;
    if (a > c) { const s = a; a = c; c = s; }
    if (a > t0) t0 = a; if (c < t1) t1 = c;
    a = (b[i * 6 + 1] - oy) * iy; c = (b[i * 6 + 4] - oy) * iy;
    if (a > c) { const s = a; a = c; c = s; }
    if (a > t0) t0 = a; if (c < t1) t1 = c;
    a = (b[i * 6 + 2] - oz) * iz; c = (b[i * 6 + 5] - oz) * iz;
    if (a > c) { const s = a; a = c; c = s; }
    if (a > t0) t0 = a; if (c < t1) t1 = c;
    return t0 <= t1 + 1e-9;
}

// Nearest hit distance (all = false) or number of hits (all = true) along a ray.
function _printCast(g, ox, oy, oz, dx, dy, dz, skip, all) {
    const h = g.bvh;
    const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
    let best = Infinity, hits = 0;
    const stack = [0];
    while (stack.length) {
        const nd = stack.pop();
        if (!_printRayBox(h.box, nd, ox, oy, oz, ix, iy, iz, all ? Infinity : best)) continue;
        if (h.left[nd] < 0) {
            for (let i = h.start[nd], e = i + h.cnt[nd]; i < e; i++) {
                const t = h.order[i];
                if (t === skip) continue;
                const d = _printRayHit(g.tri, t, ox, oy, oz, dx, dy, dz);
                if (d > 0) { hits++; if (d < best) best = d; }
            }
        } else {
            stack.push(nd + 1, h.left[nd]);
        }
    }
    return all ? hits : best;
}

// Each edge used an even number of times = no gaps for a slicer to fall through.
// Babylon's CSG leaves T-junctions (a long edge on one side meets two short ones on the
// other), so split open edges at any open vertex lying on them before deciding.
function _printOpenEdges(g) {
    const edges = new Map();
    const key = (a, b) => a < b ? a * 4194304 + b : b * 4194304 + a;
    for (let t = 0; t < g.count; t++) {
        const a = g.tv[t * 3], b = g.tv[t * 3 + 1], c = g.tv[t * 3 + 2];
        // pole triangles collapse to a line once welded
        if (a === b || b === c || a === c) continue;
        for (const [p, q] of [[a, b], [b, c], [c, a]]) {
            const k = key(p, q);
            edges.set(k, (edges.get(k) || 0) + 1);
        }
    }
    const open = [];
    edges.forEach((n, k) => { if (n & 1) open.push(k); });
    if (!open.length) return 0;

    const P = g.vpos;
    const verts = new Set();
    open.forEach(k => { verts.add(Math.floor(k / 4194304)); verts.add(k % 4194304); });
    const vlist = Array.from(verts);
    const sub = new Map();
    for (const k of open) {
        const a = Math.floor(k / 4194304), b = k % 4194304;
        const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
        const dx = P[b * 3] - ax, dy = P[b * 3 + 1] - ay, dz = P[b * 3 + 2] - az;
        const L2 = dx * dx + dy * dy + dz * dz;
        const cuts = [];
        for (const v of vlist) {
            if (v === a || v === b) continue;
            const px = P[v * 3] - ax, py = P[v * 3 + 1] - ay, pz = P[v * 3 + 2] - az;
            const s = (px * dx + py * dy + pz * dz) / L2;
            if (s <= 1e-6 || s >= 1 - 1e-6) continue;
            const ex = px - s * dx, ey = py - s * dy, ez = pz - s * dz;
            if (ex * ex + ey * ey + ez * ez < 1e-6) cuts.push([s, v]);
        }
        cuts.sort((m, n) => m[0] - n[0]);
        let prev = a;
        for (const [, v] of cuts) { const sk = key(prev, v); sub.set(sk, (sub.get(sk) || 0) + 1); prev = v; }
        const sk = key(prev, b); sub.set(sk, (sub.get(sk) || 0) + 1);
    }
    let gaps = 0;
    sub.forEach(n => { if (n & 1) gaps++; });
    return gaps;
}

// Connected pieces of one shape, each with its own box. A subtract can leave pieces apart.
function _printPieces(g) {
    const parent = new Int32Array(g.count);
    for (let i = 0; i < g.count; i++) parent[i] = i;
    const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    const firstTri = new Map();
    for (let t = 0; t < g.count; t++) {
        for (let c = 0; c < 3; c++) {
            const v = g.tv[t * 3 + c];
            const f = firstTri.get(v);
            if (f === undefined) firstTri.set(v, t);
            else { const a = find(f), b = find(t); if (a !== b) parent[a] = b; }
        }
    }
    const pieces = new Map();
    for (let t = 0; t < g.count; t++) {
        const r = find(t);
        let p = pieces.get(r);
        if (!p) { p = { g, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }; pieces.set(r, p); }
        for (let c = 0; c < 3; c++) {
            for (let k = 0; k < 3; k++) {
                const v = g.tri[t * 9 + c * 3 + k];
                if (v < p.min[k]) p.min[k] = v;
                if (v > p.max[k]) p.max[k] = v;
            }
        }
    }
    return Array.from(pieces.values());
}

function _printRayHit(tri, t, ox, oy, oz, dx, dy, dz) {
    const o = t * 9;
    const e1x = tri[o + 3] - tri[o], e1y = tri[o + 4] - tri[o + 1], e1z = tri[o + 5] - tri[o + 2];
    const e2x = tri[o + 6] - tri[o], e2y = tri[o + 7] - tri[o + 1], e2z = tri[o + 8] - tri[o + 2];
    const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (det > -1e-12 && det < 1e-12) return -1;
    const inv = 1 / det;
    const sx = ox - tri[o], sy = oy - tri[o + 1], sz = oz - tri[o + 2];
    const u = (sx * px + sy * py + sz * pz) * inv;
    if (u < 0 || u > 1) return -1;
    const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
    const v = (dx * qx + dy * qy + dz * qz) * inv;
    if (v < 0 || u + v > 1) return -1;
    const d = (e2x * qx + e2y * qy + e2z * qz) * inv;
    return d > 0 ? d : -1;
}

// Odd number of crossings = inside. The ray leans off vertical so it does not run
// straight down the edges of grid-aligned boxes and count a crossing twice.
function _printInside(g, x, y, z) {
    if (x < g.min[0] || y < g.min[1] || z < g.min[2] || x > g.max[0] || y > g.max[1] || z > g.max[2]) return false;
    return (_printCast(g, x, y, z, 0.0123, 0.0071, 0.99990, -1, true) & 1) === 1;
}

function _printInsideAnother(geos, self, x, y, z) {
    for (const g of geos) {
        if (g !== self && _printInside(g, x, y, z)) return true;
    }
    return false;
}

// Wall thickness from rays fired straight in from sampled faces, and downward faces with
// nothing under them. A face buried inside another shape is not on the print, so skip it.
function _printSurvey(geos, minWall) {
    const total = geos.reduce((n, g) => n + g.count, 0);
    const stride = Math.max(1, Math.floor(total / 2000));
    const thinTris = [], overTris = [];
    let thinnest = Infinity, thinArea = 0, sampledArea = 0, overArea = 0, surface = 0;
    let seen = 0;
    for (const g of geos) {
        const tri = g.tri;
        for (let t = 0; t < g.count; t++) {
            const o = t * 9;
            const e1x = tri[o + 3] - tri[o], e1y = tri[o + 4] - tri[o + 1], e1z = tri[o + 5] - tri[o + 2];
            const e2x = tri[o + 6] - tri[o], e2y = tri[o + 7] - tri[o + 1], e2z = tri[o + 8] - tri[o + 2];
            let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
            const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (len < 1e-9) continue;
            const area = len / 2;
            nx /= len; ny /= len; nz /= len;
            const cx = (tri[o] + tri[o + 3] + tri[o + 6]) / 3;
            const cy = (tri[o + 1] + tri[o + 4] + tri[o + 7]) / 3;
            const cz = (tri[o + 2] + tri[o + 5] + tri[o + 8]) / 3;
            surface += area;

            // Steeper than 45 degrees from upright, facing down, above the plate.
            if (nz < -0.7072 && cz > 0.15) {
                // Probe just outside the face: if another shape fills that spot, it holds this
                // face up. A big face can sit half on a post, so spread probes across it.
                const k = Math.min(6, Math.ceil(Math.sqrt(area / 4)));
                let probes = 0, loose = 0;
                for (let i = 0; i < k; i++) {
                    for (let j = 0; j < k - i; j++) {
                        const u = (i + 1 / 3) / k, v = (j + 1 / 3) / k, w0 = 1 - u - v;
                        const px = w0 * tri[o] + u * tri[o + 3] + v * tri[o + 6] + nx * PRINT_TOUCH_MM;
                        const py = w0 * tri[o + 1] + u * tri[o + 4] + v * tri[o + 7] + ny * PRINT_TOUCH_MM;
                        const pz = w0 * tri[o + 2] + u * tri[o + 5] + v * tri[o + 8] + nz * PRINT_TOUCH_MM;
                        probes++;
                        if (!_printInsideAnother(geos, g, px, py, pz)) loose++;
                    }
                }
                if (loose) {
                    overArea += area * loose / probes;
                    overTris.push(g, t);
                }
            }

            if ((seen++) % stride) continue;
            if (_printInsideAnother(geos, g, cx, cy, cz)) continue;
            const ox = cx - nx * 1e-3, oy = cy - ny * 1e-3, oz = cz - nz * 1e-3;
            let d = _printCast(g, ox, oy, oz, -nx, -ny, -nz, t, false);
            if (!isFinite(d)) continue;
            d += 1e-3;
            sampledArea += area;
            if (d < thinnest) thinnest = d;
            if (d < minWall) { thinArea += area; thinTris.push(g, t); }
        }
    }
    return {
        thinnest: isFinite(thinnest) ? thinnest : null,
        thinShare: sampledArea ? thinArea / sampledArea : 0,
        overArea, surface, thinTris, overTris
    };
}

function _printFmt(n) { return n.toFixed(Math.abs(n) < 10 ? 1 : 0); }

/**
 * Returns { items: [{ level: 'ok'|'warn'|'error', title, detail, fix?, show? }], size }.
 * `fix` is 'drop' (rest the whole design on the plate). `show` names triangles or
 * shapes to paint in the viewport.
 */
function analyzePrint(list, bed = PRINT_BED_MM, minWall = PRINT_MIN_WALL_MM) {
    const geos = list.map(_printGeometry).filter(Boolean);
    if (!geos.length) {
        return { items: [{ level: 'error', title: 'Nothing to print', detail: 'Add a shape to the design first.' }], size: null };
    }
    const items = [];
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    geos.forEach(g => { for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], g.min[k]); max[k] = Math.max(max[k], g.max[k]); } });
    const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];

    if (min[2] > PRINT_TOUCH_MM) {
        items.push({ level: 'error', title: `The design floats ${_printFmt(min[2])} mm above the plate`, detail: 'Nothing would touch the printer bed for the first layers, so the print fails at the start.', fix: 'drop' });
    } else if (min[2] < -PRINT_TOUCH_MM) {
        items.push({ level: 'warn', title: `The design sinks ${_printFmt(-min[2])} mm below the plate`, detail: 'The slicer will cut off whatever is below the plate, or lift the whole design.', fix: 'drop' });
    } else {
        items.push({ level: 'ok', title: 'The design rests on the plate', detail: '' });
    }

    // Pieces whose boxes touch count as joined. That can call two pieces joined when they
    // only share a box (a ball inside a ring), so this check misses some problems
    // rather than inventing them.
    const pieces = geos.flatMap(_printPieces);
    const parent = pieces.map((_, i) => i);
    const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    const T = PRINT_TOUCH_MM;
    for (let i = 0; i < pieces.length; i++) {
        for (let j = i + 1; j < pieces.length; j++) {
            const a = pieces[i], b = pieces[j];
            if (a.min[0] <= b.max[0] + T && b.min[0] <= a.max[0] + T && a.min[1] <= b.max[1] + T && b.min[1] <= a.max[1] + T && a.min[2] <= b.max[2] + T && b.min[2] <= a.max[2] + T) {
                const ra = find(i), rb = find(j);
                if (ra !== rb) parent[ra] = rb;
            }
        }
    }
    const groups = new Map();
    pieces.forEach((p, i) => {
        const r = find(i);
        let gr = groups.get(r);
        if (!gr) { gr = { minZ: Infinity, objs: new Set() }; groups.set(r, gr); }
        gr.minZ = Math.min(gr.minZ, p.min[2]);
        gr.objs.add(p.g.obj);
    });
    const floating = Array.from(groups.values()).filter(gr => gr.minZ > T);
    if (floating.length && min[2] <= T) {
        const objs = floating.flatMap(gr => Array.from(gr.objs));
        const names = objs.slice(0, 4).map(o => o.name).join(', ') + (objs.length > 4 ? ', ...' : '');
        items.push({ level: 'error', title: `${floating.length} part${floating.length > 1 ? 's' : ''} in mid-air`, detail: `${names}. Nothing is under ${floating.length > 1 ? 'them' : 'it'}, so the printer would lay plastic on thin air. Move ${floating.length > 1 ? 'them' : 'it'} down, or join ${floating.length > 1 ? 'them' : 'it'} to the rest.`, show: { objs } });
    } else if (groups.size > 1) {
        items.push({ level: 'ok', title: `${groups.size} separate parts, all on the plate`, detail: 'They print as loose pieces.' });
    }

    const open = geos.filter(g => _printOpenEdges(g) > 0).map(g => g.obj);
    if (open.length) {
        const names = open.slice(0, 4).map(o => o.name).join(', ') + (open.length > 4 ? ', ...' : '');
        items.push({ level: 'warn', title: `${open.length} shape${open.length > 1 ? 's have' : ' has'} gaps in the surface`, detail: `${names}. Most slicers repair small gaps, but a big one can leave holes or missing layers. Imported models are the usual cause; rebuilding that part from shapes fixes it.`, show: { objs: open } });
    } else {
        items.push({ level: 'ok', title: 'Every shape is sealed', detail: 'No gaps, so the slicer can tell inside from outside.' });
    }

    const survey = _printSurvey(geos, minWall);
    if (survey.thinnest !== null && survey.thinnest < minWall) {
        items.push({ level: 'warn', title: `Thin walls: as little as ${survey.thinnest.toFixed(2)} mm`, detail: `About ${Math.max(1, Math.round(survey.thinShare * 100))}% of the surface is thinner than ${minWall} mm, two passes of a normal nozzle. Thin spots may not print, or may snap.`, show: { tris: survey.thinTris, color: [0.95, 0.25, 0.25] } });
    } else if (survey.thinnest !== null) {
        items.push({ level: 'ok', title: `Walls are at least ${_printFmt(Math.min(survey.thinnest, 99))} mm thick`, detail: '' });
    }
    const share = survey.surface ? survey.overArea / survey.surface : 0;
    if (survey.overArea > 20 && share > 0.02) {
        items.push({ level: 'warn', title: `Overhangs: about ${(survey.overArea / 100).toFixed(1)} cm² needs support`, detail: 'These faces point down more steeply than 45°, so each layer has little under it and will droop. Turn on supports in the slicer, or turn the design so a flat side sits on the plate.', show: { tris: survey.overTris, color: [1.0, 0.6, 0.1] } });
    } else {
        items.push({ level: 'ok', title: 'No big overhangs', detail: '' });
    }

    const eps = 0.01;
    const fits = size[0] <= bed.x + eps && size[1] <= bed.y + eps && size[2] <= bed.z + eps;
    const fitsTurned = size[1] <= bed.x + eps && size[0] <= bed.y + eps && size[2] <= bed.z + eps;
    const dims = `${_printFmt(size[0])} × ${_printFmt(size[1])} × ${_printFmt(size[2])} mm`;
    if (fits) items.push({ level: 'ok', title: `Fits the printer (${dims})`, detail: '' });
    else if (fitsTurned) items.push({ level: 'warn', title: `Fits only when turned a quarter turn (${dims})`, detail: `The printer is ${bed.x} × ${bed.y} × ${bed.z} mm.` });
    else items.push({ level: 'error', title: `Too big for the printer (${dims})`, detail: `The printer is ${bed.x} × ${bed.y} × ${bed.z} mm. Scale the design down or print it in pieces.` });

    return { items, size };
}

function _printClearOverlay() {
    if (_printCheckOverlay) {
        _printCheckOverlay.forEach(m => { if (m.material) m.material.dispose(); m.dispose(); });
        _printCheckOverlay = null;
    }
}

// Paint flagged faces a hair outside the surface so they read through the shape's own color.
function _printShow(show) {
    _printClearOverlay();
    if (!show) return;
    _printCheckOverlay = [];
    if (show.objs) {
        show.objs.forEach(obj => {
            const hl = obj.mesh.clone('printcheck_hl', null, true);
            hl.makeGeometryUnique();
            hl.isPickable = false;
            const mat = new BABYLON.StandardMaterial('printcheck_hl_mat', scene);
            mat.emissiveColor = new BABYLON.Color3(0.95, 0.25, 0.25);
            mat.diffuseColor = BABYLON.Color3.Black();
            mat.wireframe = true;
            mat.disableLighting = true;
            hl.material = mat;
            _printCheckOverlay.push(hl);
        });
    }
    if (show.tris && show.tris.length) {
        const positions = [], indices = [];
        const lift = 0.15; // mm
        for (let i = 0; i < show.tris.length; i += 2) {
            const g = show.tris[i], o = show.tris[i + 1] * 9, tri = g.tri;
            const e1x = tri[o + 3] - tri[o], e1y = tri[o + 4] - tri[o + 1], e1z = tri[o + 5] - tri[o + 2];
            const e2x = tri[o + 6] - tri[o], e2y = tri[o + 7] - tri[o + 1], e2z = tri[o + 8] - tri[o + 2];
            let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
            const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
            nx *= lift / len; ny *= lift / len; nz *= lift / len;
            const base = positions.length / 3;
            for (let c = 0; c < 3; c++) {
                positions.push((tri[o + c * 3] + nx) * UNIT_SCALE, (tri[o + c * 3 + 1] + ny) * UNIT_SCALE, (tri[o + c * 3 + 2] + nz) * UNIT_SCALE);
            }
            indices.push(base, base + 1, base + 2);
        }
        const mesh = new BABYLON.Mesh('printcheck_tris', scene);
        const vd = new BABYLON.VertexData();
        vd.positions = positions;
        vd.indices = indices;
        vd.applyToMesh(mesh);
        mesh.isPickable = false;
        const mat = new BABYLON.StandardMaterial('printcheck_tris_mat', scene);
        const c = show.color || [0.95, 0.25, 0.25];
        mat.emissiveColor = new BABYLON.Color3(c[0], c[1], c[2]);
        mat.diffuseColor = BABYLON.Color3.Black();
        mat.disableLighting = true;
        mat.backFaceCulling = false;
        mat.zOffset = -2;
        mesh.material = mat;
        _printCheckOverlay.push(mesh);
    }
}

function _printDropDesign() {
    let minZ = Infinity;
    objects.forEach(o => {
        o.mesh.computeWorldMatrix(true);
        o.mesh.refreshBoundingInfo();
        minZ = Math.min(minZ, o.mesh.getBoundingInfo().boundingBox.minimumWorld.z);
    });
    if (!isFinite(minZ)) return;
    objects.forEach(o => { o.mesh.position.z -= minZ; });
    if (typeof updateSizeHandles === 'function' && selectedObject && currentTransformMode === 'size' && selectedObject.type === 'box') {
        updateSizeHandles(selectedObject);
    }
    saveState('Rest on Plate');
    if (typeof updateProperties === 'function') updateProperties();
    showToast('The design now rests on the plate');
}

function _printRender(result) {
    const listEl = document.getElementById('print-check-list');
    listEl.innerHTML = '';
    result.items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'pc-item pc-' + item.level;
        const dot = document.createElement('span');
        dot.className = 'pc-dot';
        const body = document.createElement('div');
        body.className = 'pc-body';
        const title = document.createElement('div');
        title.className = 'pc-title';
        title.textContent = item.title;
        body.appendChild(title);
        if (item.detail) {
            const d = document.createElement('div');
            d.className = 'pc-detail';
            d.textContent = item.detail;
            body.appendChild(d);
        }
        const actions = document.createElement('div');
        actions.className = 'pc-actions';
        if (item.show) {
            const b = document.createElement('button');
            b.className = 'menu-btn';
            b.textContent = 'Show me';
            b.onclick = () => {
                const on = b.classList.toggle('active');
                listEl.querySelectorAll('.pc-actions .menu-btn.active').forEach(o => { if (o !== b) o.classList.remove('active'); });
                _printShow(on ? item.show : null);
            };
            actions.appendChild(b);
        }
        if (item.fix === 'drop') {
            const b = document.createElement('button');
            b.className = 'menu-btn';
            b.textContent = 'Rest it on the plate';
            b.onclick = _printDropDesign;
            actions.appendChild(b);
        }
        if (actions.childNodes.length) body.appendChild(actions);
        row.append(dot, body);
        listEl.appendChild(row);
    });
    const problems = result.items.filter(i => i.level !== 'ok').length;
    document.getElementById('print-check-summary').textContent = problems
        ? `${problems} thing${problems > 1 ? 's' : ''} to look at before printing`
        : 'Ready to print';
}

function runPrintCheck() {
    _printClearOverlay();
    let result;
    try {
        result = analyzePrint(objects);
    } catch (err) {
        console.error('Print check failed', err);
        result = { items: [{ level: 'warn', title: 'The check could not finish', detail: 'Something in this design tripped it up. You can still export.' }] };
    }
    _printCheckLast = result;
    _printRender(result);
}

function togglePrintCheck() {
    const panel = document.getElementById('print-check-panel');
    const btn = document.getElementById('print-check-btn');
    const open = panel.style.display === 'none';
    panel.style.display = open ? 'block' : 'none';
    btn.classList.toggle('active', open);
    if (open) runPrintCheck();
    else { _printClearOverlay(); _printCheckLast = null; }
}

// Called by history after every change, undo and redo. Rerunning on each change keeps
// painted faces from sitting where a shape used to be.
function printCheckDesignChanged() {
    const panel = document.getElementById('print-check-panel');
    if (!panel || panel.style.display === 'none') return;
    _printClearOverlay();
    clearTimeout(_printCheckTimer);
    _printCheckTimer = setTimeout(runPrintCheck, 400);
}
