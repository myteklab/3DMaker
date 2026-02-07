/**
 * 3DMaker - History Management (Undo/Redo)
 * Manages state history for undo/redo functionality
 */

function saveState(action) {
    const state = {
action: action,
data: JSON.parse(JSON.stringify(getSceneData())),
objectCounter: objectCounter
    };

    if (historyIndex < history.length - 1) {
history = history.slice(0, historyIndex + 1);
    }

    history.push(state);
    if (history.length > MAX_HISTORY) {
history.shift();
    } else {
historyIndex++;
    }

    // Mark project as having unsaved changes
    hasUnsavedChanges = true;
}

async function undo() {
    if (historyIndex > 0) {
historyIndex--;
const state = history[historyIndex];
await _loadSceneFromData(state.data);
objectCounter = state.objectCounter;
showToast('Undo: ' + state.action);
    } else if (history.length === 0) {
// No history at all
showToast('Nothing to undo', 'info');
    }
    // If historyIndex === 0, we're at the earliest state, silently do nothing
}

async function redo() {
    if (historyIndex < history.length - 1) {
historyIndex++;
const state = history[historyIndex];
await _loadSceneFromData(state.data);
objectCounter = state.objectCounter;
showToast('Redo: ' + state.action);
    }
}
