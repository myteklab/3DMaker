/**
 * 3DMaker - Keyboard Shortcuts
 * Keyboard event handlers and shortcuts
 */
function setupKeyboardShortcuts() {
// Track Shift key for fine snapping
document.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') {
        isShiftHeld = true;
        updateGizmoSnapDistance();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') {
        isShiftHeld = false;
        updateGizmoSnapDistance();
    }
});

// Command shortcuts
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        undo();
    } else if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') ||
               ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
        e.preventDefault();
        redo();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveProject();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        duplicateObject();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObject && !e.target.matches('input')) {
            e.preventDefault();
            deleteObject(selectedObject.id);
        }
    } else if (e.key === 'w' || e.key === 'W') {
        if (!e.target.matches('input')) {
            e.preventDefault();
            setTransformMode('position');
        }
    } else if (e.key === 'e' || e.key === 'E') {
        if (!e.target.matches('input')) {
            e.preventDefault();
            setTransformMode('rotation');
        }
    } else if (e.key === 't' || e.key === 'T') {
        if (!e.target.matches('input')) {
            e.preventDefault();
            setTransformMode('size');
        }
    } else if (e.key === 'r' || e.key === 'R') {
        if (!e.target.matches('input')) {
            e.preventDefault();
            setTransformMode('scaling');
        }
    } else if (e.key === 'g' || e.key === 'G') {
        if (!e.target.matches('input')) {
            e.preventDefault();
            setTransformMode('grab');
        }
    } else if (e.shiftKey && (e.key === 'x' || e.key === 'X')) {
        if (!e.target.matches('input')) {
            e.preventDefault();
            mirrorObject('x');
        }
    } else if (e.shiftKey && (e.key === 'y' || e.key === 'Y')) {
        if (!e.target.matches('input')) {
            e.preventDefault();
            mirrorObject('y');
        }
    } else if (e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        if (!e.target.matches('input')) {
            e.preventDefault();
            mirrorObject('z');
        }
    } else if (e.key === 's' || e.key === 'S') {
        if (!e.target.matches('input') && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            toggleSnapToGrid();
        }
    }
});
}
