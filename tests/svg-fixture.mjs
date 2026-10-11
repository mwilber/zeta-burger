import { Renderer } from '../dist/src/renderer.js';
import { readFileSync } from 'node:fs';
// Small SVG node stand-in for the existing flight/effect regression tests.
// Browser visual QA covers actual SVG parsing, loading, and layout.
function node() {
  const attributes = new Map(), descendants = new Map();
  return {
    style: {}, children: [], textContent: '',
    setAttribute(key, value) { attributes.set(key, String(value)); },
    getAttribute(key) { return attributes.get(key) ?? null; },
    querySelector(selector) {
      if (!descendants.has(selector)) descendants.set(selector, node());
      return descendants.get(selector);
    },
    append(...children) { children.forEach(child => { child.parentElement = this; this.children.push(child); }); }
  };
}
export function svgRendererFixture() {
  const renderer = Object.create(Renderer.prototype);
  for (const name of ['ship', 'gear', 'shadow', 'vertical', 'horizontal', 'carried', 'service']) renderer[name] = node();
  renderer.ship.append(renderer.gear, node());
  renderer.verticalWaves = Array.from({ length: 4 }, node);
  renderer.horizontalWaves = Array.from({ length: 3 }, node);
  renderer.particles = []; renderer.reducedMotion = false;
  const effects = readFileSync(new URL('../public/assets/effects.svg', import.meta.url), 'utf8');
  renderer.templates = new Map([['particle', { getAttribute: name => effects.match(new RegExp(`${name}="([^"]+)"`))?.[1] ?? null }]]);
  return renderer;
}
