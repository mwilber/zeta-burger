import { WORLD_WIDTH, WORLD_HEIGHT } from './world.js';
import type { Pad } from './world.js';
import { PHYSICS, CRASH_DURATION, verticalThrustDirection } from './engine.js';
import type { Game, Controls, GameEvent } from './engine.js';

const SVG = 'http://www.w3.org/2000/svg';
interface Particle { x: number; y: number; vx: number; vy: number; age: number; life: number; color: string; size: number; node?: SVGGElement }
interface ArtManifest { background?: string; saucer?: string; buildings?: Record<string, string> }
interface StationArt { pad: Pad; root: SVGGElement; island: SVGGElement; vines: SVGPathElement[]; idle: SVGGElement; active: SVGGElement; beacon: SVGTextElement }
const attr = (node: Element, values: Record<string, string | number>) => {
  for (const [key, value] of Object.entries(values)) node.setAttribute(key, String(value));
};
const visible = (node: SVGElement, show: boolean) => { node.style.display = show ? '' : 'none'; };
const move = (node: SVGElement, x: number, y: number) => node.setAttribute('transform', `translate(${x} ${y})`);
const find = <T extends SVGElement>(node: Element, selector: string) => node.querySelector<T>(selector)!;
const setText = (node: SVGElement, text: string) => { if (node.textContent !== text) node.textContent = text; };

/** SVG files own the artwork. This class only assembles and animates the scene. */
export class Renderer {
  particles: Particle[] = [];
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  readonly ready: Promise<void>;
  private templates = new Map<string, Element>();
  private images = new Map<string, SVGImageElement[]>();
  private scene = this.group();
  private stationLayer = this.group();
  private particleLayer = this.group();
  private stations: StationArt[] = [];
  private pads?: Pad[];
  private stars: { node: SVGGElement; phase: number }[] = [];
  private shadow!: SVGGElement;
  private vertical!: SVGGElement;
  private horizontal!: SVGGElement;
  private verticalWaves: SVGEllipseElement[] = [];
  private horizontalWaves: SVGEllipseElement[] = [];
  private ship!: SVGGElement;
  private gear!: SVGGElement;
  private carried!: SVGGElement;
  private waiting!: SVGGElement;
  private service!: SVGGElement;
  private crash!: SVGGElement;
  private loaded = false;
  private serial = 0;

  constructor(stage: SVGSVGElement) {
    attr(stage, { viewBox: `0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}` });
    stage.replaceChildren(this.scene);
    this.ready = this.loadArt();
  }
  private group(): SVGGElement { return document.createElementNS(SVG, 'g'); }
  private asset(name: string): SVGGElement {
    const source = this.templates.get(name);
    if (!source) throw new Error(`Missing SVG artwork: ${name}`);
    const group = this.group();
    if (source.localName === 'g') for (const attribute of Array.from(source.attributes)) {
      if (attribute.name !== 'id') group.setAttribute(attribute.name, attribute.value);
    }
    group.append(...Array.from(source.childNodes, node => node.cloneNode(true)));
    // Each clone gets its own gradient/clip IDs, including copies of a station.
    const prefix = `art-${this.serial++}-`;
    const ids = new Map<string, string>();
    for (const node of group.querySelectorAll('[id]')) { const id = node.id; ids.set(id, prefix + id); node.id = prefix + id; }
    for (const node of group.querySelectorAll('*')) for (const attribute of Array.from(node.attributes)) {
      let value = attribute.value;
      for (const [id, replacement] of ids) value = value.replaceAll(`url(#${id})`, `url(#${replacement})`);
      if (value !== attribute.value) node.setAttribute(attribute.name, value);
    }
    return group;
  }
  private image(key: string, fallback: SVGGElement, x: number, y: number, width: number, height: number): SVGGElement {
    const group = this.group(), image = document.createElementNS(SVG, 'image');
    attr(image, { x, y, width, height, preserveAspectRatio: 'none' });
    visible(image, false); group.append(fallback, image);
    const instances = this.images.get(key) ?? []; instances.push(image); this.images.set(key, instances);
    return group;
  }
  private async loadArt() {
    const names = ['background', 'saucer', 'restaurant', 'gas', 'mushroom', 'observatory', 'motel', 'crystal', 'outpost', 'effects',
      ...Array.from({ length: 7 }, (_, id) => [`island-${id}`, `pad-${id}`, `pad-${id}-active`]).flat()];
    try {
      await Promise.all(names.map(async name => {
        const response = await fetch(`./assets/${name}.svg`);
        if (!response.ok) throw new Error(`Could not load ${name}.svg`);
        const document = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
        if (document.querySelector('parsererror')) throw new Error(`Invalid SVG: ${name}.svg`);
        this.templates.set(name, document.documentElement);
      }));
      const effects = this.templates.get('effects')!;
      this.scene.append(effects.querySelector('defs')!.cloneNode(true), effects.querySelector('style')!.cloneNode(true));
      for (const template of effects.querySelectorAll(':scope > g[id]')) this.templates.set(template.id, template);
      const background = this.asset('background');
      this.scene.append(find(background, '[data-sky]'));
      let seed = 4827;
      const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      // Keep the original star positions and twinkle phases.
      for (let i = 0; i < 145; i++) {
        const x = random() * WORLD_WIDTH, y = random() * 650, large = random() > .9, phase = random() * 6.28;
        const node = this.asset(large ? 'star-large' : 'star-small'); move(node, x, y);
        this.stars.push({ node, phase }); this.scene.append(node);
      }
      this.scene.append(this.image('background', background, 0, 0, WORLD_WIDTH, WORLD_HEIGHT));
      this.scene.append(this.stationLayer);
      this.waiting = this.asset('waiting-order'); this.shadow = this.asset('ship-shadow');
      this.vertical = this.asset('vertical-thrust'); this.horizontal = this.asset('horizontal-thrust');
      this.verticalWaves = Array.from(this.vertical.querySelectorAll('[data-wave]'));
      this.horizontalWaves = Array.from(this.horizontal.querySelectorAll('[data-wave]'));
      this.ship = this.group(); this.gear = this.asset('gear');
      this.ship.append(this.gear, this.image('saucer', this.asset('saucer'), -24, -17, 48, 25));
      this.carried = this.asset('carried-order'); this.service = this.asset('service'); this.crash = this.asset('crash-message');
      this.scene.append(this.waiting, this.shadow, this.vertical, this.horizontal, this.ship, this.carried, this.service, this.particleLayer, this.crash);
      this.loaded = true;
      void this.loadOverrides();
    } catch (error) {
      console.error(error);
      const message = document.createElementNS(SVG, 'text');
      attr(message, { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, fill: 'white', 'text-anchor': 'middle' });
      message.textContent = 'Artwork could not load. Refresh to try again.'; this.scene.append(message);
    }
  }
  private overrides = new Map<string, string>();
  private async loadOverrides() {
    try {
      const response = await fetch('./assets/manifest.json');
      if (!response.ok) return;
      const art = await response.json() as ArtManifest;
      await Promise.all(Object.entries({ background: art.background, saucer: art.saucer, ...art.buildings }).map(async ([key, source]) => {
        if (typeof source !== 'string' || !source) return;
        const image = new Image();
        image.src = source;
        try { await image.decode(); } catch { return; }
        this.overrides.set(key, source); this.applyOverride(key);
      }));
    } catch { /* Optional manifest: the SVG defaults remain visible. */ }
  }
  private applyOverride(key: string) {
    const source = this.overrides.get(key);
    if (!source) return;
    for (const image of this.images.get(key) ?? []) {
      image.setAttribute('href', source);
      // Transparent background overrides retain the default scenery underneath.
      if (key !== 'background') visible(image.previousElementSibling as SVGElement, false);
      visible(image, true);
    }
  }
  private buildStations(pads: Pad[]) {
    this.pads = pads; this.images.forEach((_, key) => { if (key !== 'background' && key !== 'saucer') this.images.delete(key); });
    this.stationLayer.replaceChildren();
    this.stations = pads.map(pad => {
      const root = this.group(), base = pad.island[0];
      const island = this.asset(`island-${pad.id}`); move(island, base.x, base.y);
      const building = this.image(pad.building.kind, this.asset(pad.building.kind), 0, 0, pad.building.width, pad.building.height);
      move(building, pad.building.x, pad.building.y);
      const idle = this.asset(`pad-${pad.id}`), active = this.asset(`pad-${pad.id}-active`);
      move(idle, pad.x, pad.y); move(active, pad.x, pad.y); root.append(island, building, idle, active); this.stationLayer.append(root);
      this.applyOverride(pad.building.kind);
      return { pad, root, island, vines: Array.from(island.querySelectorAll<SVGPathElement>('[data-vine]')), idle, active, beacon: find<SVGTextElement>(active, '[data-beacon]') };
    });
  }
  burst(event: GameEvent) {
    const crash = event.type === 'crash';
    if (!crash && event.type !== 'delivery' && event.type !== 'pickup') return;
    const template = this.templates.get('particle');
    const colors = (template?.getAttribute('data-crash-colors') ?? '').split(',');
    const serviceColor = template?.getAttribute('data-service-color') ?? '';
    for (let i = 0; i < (crash ? 65 : 24); i++) {
      const angle = Math.random() * Math.PI * 2, speed = 25 + Math.random() * (crash ? 155 : 65);
      this.particles.push({ x: event.x, y: event.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0, life: .5 + Math.random() * (CRASH_DURATION - .5), color: crash ? colors[i % colors.length] : serviceColor, size: 2 + Math.random() * 3 });
    }
  }
  update(dt: number) {
    for (const p of this.particles) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 25 * dt; }
    this.particles = this.particles.filter(p => p.age < p.life);
  }
  private renderParticles() {
    const living = new Set<SVGElement>();
    for (const p of this.particles) {
      if (!p.node) { p.node = this.asset('particle'); this.particleLayer.append(p.node); }
      const rect = find<SVGRectElement>(p.node, 'rect');
      attr(rect, { width: p.size, height: p.size, rx: 1, fill: p.color });
      move(p.node, p.x, p.y); attr(p.node, { opacity: Math.max(0, 1 - p.age / p.life) }); living.add(p.node);
    }
    for (const node of Array.from(this.particleLayer.children)) if (!living.has(node as SVGElement)) node.remove();
  }
  private tip(node: Element, amount: number) {
    const text = find<SVGTextElement>(node, '[data-tip]');
    setText(text, `${amount < 0 ? '−' : ''}$${Math.abs(amount).toFixed(2)}`);
    text.setAttribute('data-negative', String(amount < 0));
  }
  draw(game: Game, controls: Controls, dt: number, time: number) {
    if (!this.loaded) return;
    if (this.pads !== game.level.pads) this.buildStations(game.level.pads);
    for (const star of this.stars) attr(star.node, { opacity: .3 + (this.reducedMotion ? .25 : (Math.sin(time * .55 + star.phase) + 1) * .25) });
    for (const station of this.stations) {
      const active = station.pad.id === game.destination.id || (game.fuel <= 25 && station.pad.id === game.level.gasStation);
      visible(station.idle, !active); visible(station.active, active);
      station.beacon.setAttribute('transform', `translate(0 ${this.reducedMotion ? 0 : Math.sin(time * 3) * 3})`);
      for (const vine of station.vines) { const { x, y1, y2, vine: index } = vine.dataset; vine.setAttribute('d', `M${x} ${y1}L${Number(x) + Math.sin(time + Number(index)) * 1.5} ${y2}`); }
    }
    const waiting = game.waitingOrders[0]; visible(this.waiting, !!waiting);
    if (waiting) {
      const restaurant = game.level.pads.find(pad => pad.id === game.level.restaurant)!;
      move(this.waiting, restaurant.building.x + restaurant.building.width / 2, restaurant.building.y - 28);
      this.tip(this.waiting, game.tipFor(waiting)); setText(find(this.waiting, '[data-count]'), `${game.waitingOrders.length} READY`);
    }
    this.saucer(game, controls, time);
    this.update(dt); this.renderParticles(); visible(this.crash, game.phase === 'crashed');
    setText(find(this.crash, '[data-message]'), game.lives > 0 ? 'DISPATCHING A REPLACEMENT…' : 'NO SAUCERS REMAINING');
  }
  saucer(game: Game, controls: Controls, time: number) {
    const s = game.ship, showShip = game.phase !== 'crashed' && game.phase !== 'gameover';
    visible(this.ship, showShip); visible(this.shadow, showShip && s.landed !== null); move(this.shadow, s.x, s.y);
    const vertical = verticalThrustDirection(controls);
    visible(this.vertical, showShip && vertical !== 0 && game.fuel > 0 && game.phase === 'playing' && (vertical > 0 || s.landed === null));
    const side = vertical > 0 ? 1 : -1;
    this.vertical.setAttribute('transform', `translate(${s.x} ${s.y}) scale(1 ${side})`);
    this.verticalWaves.forEach((wave, i) => {
      const progress = this.reducedMotion ? (i + .5) / 4 : (time * 2 + i / 4) % 1;
      attr(wave, { cy: 12 + progress * 36, rx: 12 + progress * 25, ry: 3 + progress * 5, opacity: (1 - progress) * .8, 'stroke-width': 2 - progress });
    });
    const direction = Number(controls.right) - Number(controls.left);
    visible(this.horizontal, showShip && !s.gear && game.fuel > 0 && game.phase === 'playing' && direction !== 0);
    move(this.horizontal, s.x, s.y);
    this.horizontalWaves.forEach((wave, i) => {
      const progress = this.reducedMotion ? (i + .5) / 3 : (time * 3 + i / 3) % 1;
      attr(wave, { cx: -direction * (25 + progress * 18), cy: 1, rx: 2 + progress * 3, ry: 5 + progress * 5, opacity: (1 - progress) * .7 });
    });
    this.ship.setAttribute('transform', `translate(${s.x} ${s.y + game.landingBounceOffset}) rotate(${game.tilt * 180 / Math.PI})`);
    visible(this.gear, s.gear); move(this.carried, s.x, s.y); visible(this.carried, showShip && !!game.order);
    if (game.order) { this.tip(this.carried, game.tip); setText(find(this.carried, '[data-destination]'), `→ PAD ${game.order.target}`); }
    move(this.service, s.x, s.y); visible(this.service, showShip);
    const dwell = s.landed !== null && game.dwell < PHYSICS.dwell && (s.landed === game.level.restaurant || s.landed === game.order?.target);
    visible(find(this.service, '[data-dwell]'), dwell);
    attr(find(this.service, '[data-progress]'), { width: 36 * Math.min(1, game.dwell / PHYSICS.dwell) });
    const refuel = find<SVGTextElement>(this.service, '[data-refuel]'); visible(refuel, s.landed === game.level.gasStation);
    setText(refuel, game.fuel < 100 ? `REFUELING ${Math.floor(game.fuel)}%` : 'TANK FULL');
  }
}
