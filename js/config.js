/**
 * 3DMaker - Configuration and Global Variables
 * Contains all global state and configuration constants
 */

// Global variables
let canvas, engine, scene, camera, light;
let objects = [];
let selectedObject = null;
let selectedObjects = [];
let objectCounter = 0;

// Project state (managed by platform adapter)
let currentProjectId = null;

// Track unsaved changes for smart auto-save
let hasUnsavedChanges = false;

// Unit scale: 1 Babylon.js unit = 10 millimeters
// Grid is 20x20 Babylon units = 200x200mm build platform
const UNIT_SCALE = 0.1;

// Transform gizmo
let gizmoManager;
let currentTransformMode = 'position';
let dragBehavior = null; // For grab mode free dragging

// Bounding box gizmo for size mode (Option A - preserved but commented)
let boundingBoxGizmo = null;

// Size handles for manual one-sided resizing (Option B - active)
let sizeHandles = [];
let activeSizeHandle = null;
let sizeStartState = null;

// Undo/Redo system
let history = [];
let historyIndex = -1;
const MAX_HISTORY = 50;

// Axis lines and workplane for toggling
let axisLines = [];
let workplaneElements = [];
let workplaneVisible = true;

// Snap to grid settings
let snapToGrid = false;
let gridSize = 1.0; // Each grid square is 1 Babylon unit = 10mm
let fineSnapSize = 0.1; // Fine snap with Shift = 0.1 Babylon unit = 1mm
let isShiftHeld = false; // Track shift key for fine snapping

// Selection order labels for CSG operations
let selectionLabels = [];

// Ready flag
let sceneReady = false;
