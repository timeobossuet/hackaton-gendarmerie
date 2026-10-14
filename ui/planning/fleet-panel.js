import { persistMissions, state } from '../state.js';
import {
  addPilot, changePilotDrone, removePilot, getPilot, setPilotRadius, updatePilotIdentity,
  formatRadius, hasCustomRadius
} from './fleet.js';
import {
  removeRadiusEditorEntry, renameRadiusEditorEntry, syncCircleRadii, updateRadiusEditorLabel
} from './radius-editor.js';

const query = (selector) => document.querySelector(selector);

function focusEditor() {
  const input = query('#pilot-name-input');
  input?.focus();
  input?.select();
}

// render() remplace tout le HTML : on sauvegarde le texte en cours de saisie
// (nom / ID non validés) pour ne pas le perdre quand on touche au curseur.
export function captureFleetDraft() {
  const editor = query('[data-pilot-editor]');
  if (!editor) return null;
  return {
    pilotId: editor.dataset.pilotEditor,
    name: query('#pilot-name-input')?.value ?? '',
    id: query('#pilot-id-input')?.value ?? ''
  };
}

export function restoreFleetDraft(draft) {
  if (!draft || draft.pilotId !== state.selectedPilotId) return;
  const name = query('#pilot-name-input');
  const id = query('#pilot-id-input');
  if (name) name.value = draft.name;
  if (id) id.value = draft.id;
}

export function bindFleetPanel({ render }) {
  document.querySelectorAll('.add-pilot').forEach((button) => {
    button.addEventListener('click', () => {
      const pilot = addPilot(button.dataset.addPilot);
      if (!pilot) {
        state.planning.fleetError = 'Aucun drone disponible pour cette affectation.';
        render();
        return;
      }
      state.planning.fleetError = null;
      persistMissions();
      state.selectedPilotId = pilot.id; // ouvre directement l'édition du nouveau TP
      render();
      focusEditor();
    });
  });

  document.querySelectorAll('.pilot-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.pilotToggle;
      state.selectedPilotId = state.selectedPilotId === id ? null : id;
      render();
      if (state.selectedPilotId) focusEditor();
    });
  });

  document.querySelectorAll('.pilot-remove').forEach((button) => {
    button.addEventListener('click', () => {
      const pilot = getPilot(button.dataset.removePilot);
      if (!pilot || !window.confirm(`Supprimer ${pilot.name} (${pilot.id}) ?`)) return;
      removePilot(pilot.id);
      removeRadiusEditorEntry(pilot.id);
      persistMissions();
      if (state.selectedPilotId === pilot.id) state.selectedPilotId = null;
      render();
    });
  });

  bindPilotEditor(render);
}

function bindPilotEditor(render) {
  const pilotId = state.selectedPilotId;
  const nameInput = query('#pilot-name-input');
  const idInput = query('#pilot-id-input');
  const slider = query('#pilot-radius-slider');
  if (!pilotId || !nameInput || !idInput || !slider) return;
  const modelInput = query('#pilot-model-input');

  const close = () => {
    state.selectedPilotId = null;
    render();
  };

  const save = () => {
    const result = updatePilotIdentity(pilotId, { id: idInput.value, name: nameInput.value });
    if (!result.ok) {
      const error = query('#pilot-error');
      error.textContent = result.error;
      error.classList.remove('hidden');
      return;
    }
    if (result.pilot.id !== pilotId) renameRadiusEditorEntry(pilotId, result.pilot.id);
    updateRadiusEditorLabel(result.pilot.id);
    persistMissions();
    close();
  };

  [nameInput, idInput].forEach((input) => {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        save();
      } else if (event.key === 'Escape') {
        close(); // abandonne la saisie non validée
      }
    });
  });
  query('#pilot-save').addEventListener('click', save);
  query('#pilot-cancel').addEventListener('click', close);
  modelInput?.addEventListener('change', () => {
    const result = changePilotDrone(pilotId, modelInput.value);
    if (!result.ok) {
      const error = query('#pilot-error');
      error.textContent = result.error;
      error.classList.remove('hidden');
      modelInput.value = result.pilot?.droneModelId ?? getPilot(pilotId)?.droneModelId ?? '';
      return;
    }
    syncCircleRadii();
    updateRadiusEditorLabel(result.pilot.id);
    persistMissions();
    render();
  });

  // Aperçu en direct sur la carte pendant qu'on glisse le curseur.
  slider.addEventListener('input', () => {
    const pilot = setPilotRadius(pilotId, slider.value);
    if (!pilot) return;
    syncCircleRadii();
    query('#pilot-radius-value').textContent = formatRadius(pilot.radius);
    const label = query(`[data-pilot-radius-label="${CSS.escape(pilot.id)}"]`);
    if (label) {
      const custom = hasCustomRadius(pilot);
      label.textContent = formatRadius(pilot.radius);
      label.classList.toggle('font-semibold', custom);
      label.classList.toggle('text-aeris', custom);
      label.classList.toggle('text-notion-500', !custom);
    }
  });
  // Au relâchement : re-rendu pour mettre à jour l'avertissement "recalculez" et le bouton "Rayons par défaut".
  slider.addEventListener('change', () => {
    persistMissions();
    render();
  });
}