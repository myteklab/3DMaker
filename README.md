# 3DMaker

A browser-based 3D modeling tool built with [Babylon.js](https://www.babylonjs.com/). Create, transform, and combine 3D shapes, then export your models as STL files for 3D printing.

## Features

### Shapes
- **Primitives** — Box, Sphere, Cylinder, Cone, Torus, Pyramid, Capsule, Tube
- **3D Text** — Extruded text with font selection (experimental)
- **Pattern Builder** — Generate rows, grids, circles, or spirals of any shape

### Transform Tools
- **Move** (W) — Position objects along X/Y/Z axes
- **Rotate** (E) — Rotate objects with gizmo handles
- **Size** (T) — Resize dimensions in mm by dragging face handles
- **Scale** (R) — Scale proportionally
- **Grab** (G) — Free drag on the workplane

### Boolean / CSG Operations
- **Union** — Merge two shapes into one
- **Subtract** — Cut one shape out of another
- **Intersect** — Keep only the overlapping volume

### Editing
- **Duplicate** (Ctrl+D) — Copy selected objects
- **Mirror** (Shift+X/Y/Z) — Mirror across an axis
- **Align** — Snap objects to each other or the workplane
- **Multi-select** (Ctrl+Click) — Select and transform multiple objects
- **Undo / Redo** (Ctrl+Z / Ctrl+Y)

### Properties
- Per-object color picker
- Precise numeric input for position, rotation, and dimensions
- Snap-to-grid (10mm grid, hold Shift for 1mm fine snapping)

### Viewport
- Orientation gizmo for quick camera alignment
- Toggle grid, axes, and info overlays
- Keyboard shortcuts for all major actions

### Export
- **STL export** — Download models for 3D printing or use in other software

## Getting Started

Open `index.html` in a browser. No build step or server required — everything runs client-side.

## Dependencies

All loaded via CDN (no install needed):

- [Babylon.js](https://www.babylonjs.com/) — 3D engine and CSG operations
- [opentype.js](https://opentype.js.org/) — Font parsing for 3D text
- [Earcut](https://github.com/mapbox/earcut) — Polygon triangulation

Bundled fonts (DejaVu Sans, DejaVu Sans Mono, DejaVu Serif, Roboto) are included in `fonts/`.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| W | Move mode |
| E | Rotate mode |
| T | Size mode |
| R | Scale mode |
| G | Grab mode |
| S | Toggle snap-to-grid |
| Delete | Delete selected |
| Ctrl+D | Duplicate |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Shift+X/Y/Z | Mirror on axis |

## License

This project is licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE) for details.
