import { SELECTORS } from './config.js';

export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => [...document.querySelectorAll(selector)];

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const getMapElement = () => $(SELECTORS.map);
export const getMapRect = () => getMapElement().getBoundingClientRect();
