import { SELECTORS } from './config.js';
import { $ } from './dom.js';
import { appShell } from './components.js';
import { bindEvents } from './events.js';

function render() {
  $(SELECTORS.app).innerHTML = appShell();
  bindEvents({ render });
}

render();
