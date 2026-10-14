import { SELECTORS } from './config.js';
import { $ } from './dom.js';
import { appShell } from './components.js';
import { bindEvents } from './events.js';
import { getLeafletMap } from './map.js';
import { syncFleet } from './planning/fleet.js';
import { captureFleetDraft, restoreFleetDraft } from './planning/fleet-panel.js';

function render() {
  syncFleet(); // la liste des TP doit exister dès le premier rendu
  const draft = captureFleetDraft();
  const mapElement = $(SELECTORS.map);
  $(SELECTORS.app).innerHTML = appShell();
  restoreFleetDraft(draft);

  // Leaflet doit conserver le même conteneur pour ne pas perdre ses calques
  // et interrompre le chargement des tuiles à chaque rendu de panneau.
  if (mapElement) {
    $(SELECTORS.map).replaceWith(mapElement);
  }

  bindEvents({ render });
  window.requestAnimationFrame(() => getLeafletMap()?.invalidateSize(false));
}

render();