import { PADS, WORLD_WIDTH, WORLD_HEIGHT } from './world.js';
import type { Point, Pad } from './world.js';
import { PHYSICS, shipBody } from './engine.js';
import type { Game, Controls, GameEvent } from './engine.js';
interface Particle { x: number; y: number; vx: number; vy: number; age: number; life: number; color: string; size: number }
interface ArtManifest { background?: string; saucer?: string; buildings?: Record<string, string> }
export class Renderer {
  ctx: CanvasRenderingContext2D;
  particles: Particle[] = [];
  stars: { x: number; y: number; size: number; phase: number }[] = [];
  images = new Map<string, HTMLImageElement>();
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    let seed = 4827;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    this.stars = Array.from({ length: 145 }, () => ({ x: random() * WORLD_WIDTH, y: random() * 650, size: random() > .9 ? 1.8 : .9, phase: random() * 6.28 }));
    void this.loadArt();
  }
  async loadArt() {
    try {
      const response = await fetch('/assets/manifest.json');
      if (!response.ok) return;
      const art = await response.json() as ArtManifest;
      const entries = Object.entries({ background: art.background, saucer: art.saucer, ...art.buildings });
      for (const [key, source] of entries) {
        if (!source) continue;
        const image = new Image();
        image.onload = () => this.images.set(key, image);
        image.src = source;
      }
    } catch { /* Built-in Canvas art remains available offline. */ }
  }
  polygon(points: Point[], fill: string | CanvasGradient, stroke?: string) {
    const c = this.ctx; c.beginPath(); c.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) c.lineTo(p.x, p.y);
    c.closePath(); c.fillStyle = fill; c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); }
  }
  rect(x: number, y: number, w: number, h: number, color: string, radius = 0) {
    const c = this.ctx; c.fillStyle = color; c.beginPath(); c.roundRect(x, y, w, h, radius); c.fill();
  }
  ellipse(x: number, y: number, rx: number, ry: number, color: string | CanvasGradient) {
    const c = this.ctx; c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
  }
  text(text: string, x: number, y: number, color: string, size = 10, align: CanvasTextAlign = 'center', weight = '') {
    const c = this.ctx; c.font = `${weight} ${size}px monospace`; c.textAlign = align; c.fillStyle = color; c.fillText(text, x, y);
  }
  line(x1: number, y1: number, x2: number, y2: number, color: string, width = 1) {
    const c = this.ctx; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = color; c.lineWidth = width; c.stroke();
  }
  burst(event: GameEvent) {
    const crash = event.type === 'crash';
    if (!crash && event.type !== 'delivery' && event.type !== 'pickup') return;
    for (let i = 0; i < (crash ? 65 : 24); i++) {
      const angle = Math.random() * Math.PI * 2, speed = 25 + Math.random() * (crash ? 155 : 65);
      this.particles.push({ x: event.x, y: event.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0, life: .5 + Math.random(), color: crash ? ['#ffd297', '#ff918f', '#dabaff'][i % 3] : '#bdf77d', size: 2 + Math.random() * 3 });
    }
  }
  update(dt: number, game: Game, controls: Controls) {
    for (const p of this.particles) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 25 * dt; }
    this.particles = this.particles.filter(p => p.age < p.life);
    if (game.phase !== 'playing' || this.reducedMotion) return;
    const s = game.ship;
    if (controls.up && Math.random() < .75) this.particles.push({ x: s.x + (Math.random() - .5) * 12, y: s.y + 12, vx: s.vx * .1 + (Math.random() - .5) * 20, vy: 45 + Math.random() * 30, age: 0, life: .3, color: '#bdf77d', size: 2 });
  }
  background(time: number) {
    const c = this.ctx;
    const sky = c.createLinearGradient(0, 0, 0, WORLD_HEIGHT); sky.addColorStop(0, '#14182e'); sky.addColorStop(.5, '#27264b'); sky.addColorStop(1, '#4a3e69');
    c.fillStyle = sky; c.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    const glow = c.createRadialGradient(820, 470, 0, 820, 470, 630); glow.addColorStop(0, '#b182b119'); glow.addColorStop(1, '#715da400'); c.fillStyle = glow; c.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    for (const star of this.stars) {
      c.globalAlpha = .3 + (this.reducedMotion ? .25 : (Math.sin(time * .55 + star.phase) + 1) * .25);
      this.rect(star.x, star.y, star.size, star.size, '#d4cbea');
      if (star.size > 1) { this.line(star.x - 3, star.y + .8, star.x + 4, star.y + .8, '#cabce8', .5); this.line(star.x + .8, star.y - 3, star.x + .8, star.y + 4, '#cabce8', .5); }
    }
    c.globalAlpha = 1;
    // Distant planetary system: scenery has no collision.
    c.save(); c.translate(1018, 133); c.rotate(-.33);
    c.strokeStyle = '#b4a5d629'; c.lineWidth = 15; c.beginPath(); c.ellipse(0, 0, 152, 29, 0, 0, Math.PI * 2); c.stroke();
    const planet = c.createLinearGradient(-60, -60, 60, 60); planet.addColorStop(0, '#8b83b5'); planet.addColorStop(.5, '#655f93'); planet.addColorStop(1, '#393b65');
    this.ellipse(0, 0, 69, 69, planet);
    c.save(); c.beginPath(); c.arc(0, 0, 69, 0, Math.PI * 2); c.clip();
    for (let i = 0; i < 5; i++) this.ellipse(-18, -44 + i * 23, 95, 6 + i, '#bab2da0b');
    this.ellipse(-24, -20, 7, 5, '#b6aad118'); this.ellipse(17, 22, 11, 9, '#292e5833'); c.restore();
    c.strokeStyle = '#b4a5d652'; c.lineWidth = 5; c.beginPath(); c.ellipse(0, 0, 152, 29, 0, 0, Math.PI); c.stroke(); c.restore();
    this.ellipse(330, 110, 22, 22, '#c3bdc961'); this.ellipse(337, 106, 21, 21, '#252840');
    // Atmospheric mountain layers, intentionally behind the flight field.
    this.polygon([{ x: 0, y: 630 }, { x: 95, y: 550 }, { x: 180, y: 614 }, { x: 340, y: 485 }, { x: 466, y: 628 }, { x: 625, y: 465 }, { x: 760, y: 596 }, { x: 922, y: 504 }, { x: 1064, y: 603 }, { x: 1167, y: 484 }, { x: 1280, y: 595 }, { x: 1280, y: 760 }, { x: 0, y: 760 }], '#34365244');
    this.polygon([{ x: 0, y: 694 }, { x: 165, y: 636 }, { x: 253, y: 694 }, { x: 392, y: 604 }, { x: 518, y: 679 }, { x: 694, y: 605 }, { x: 910, y: 714 }, { x: 1080, y: 648 }, { x: 1280, y: 702 }, { x: 1280, y: 760 }, { x: 0, y: 760 }], '#33375366');
    c.setLineDash([2, 8]); this.line(17, 54, 17, 734, '#898fb013'); this.line(1263, 54, 1263, 734, '#898fb013'); c.setLineDash([]);
    this.rect(0, 748, 1280, 12, '#141c29'); this.line(0, 748, 1280, 748, '#6b788a60');
    const custom = this.images.get('background'); if (custom) c.drawImage(custom, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }
  island(pad: Pad, time: number) {
    const c = this.ctx, points = pad.island;
    const start = points[0], end = points[1];
    const rock = c.createLinearGradient(0, start.y, 0, start.y + 85); rock.addColorStop(0, '#455559'); rock.addColorStop(1, '#303348');
    this.polygon(points, rock, '#73878550');
    this.polygon([points[0], points[1], points[2], { x: start.x + (end.x - start.x) * .57, y: start.y + 33 }, { x: start.x + 25, y: start.y + 28 }], '#60736c55');
    this.polygon([{ x: start.x + 37, y: start.y + 18 }, { x: start.x + 93, y: start.y + 44 }, points[4], points[5]], '#2b38415c');
    this.polygon([{ x: end.x - 65, y: start.y + 28 }, points[2], points[3]], '#63527630');
    this.line(start.x + 11, start.y + 13, end.x - 11, start.y + 13, '#93b389', 3);
    this.line(start.x + 3, start.y + 3, end.x - 3, start.y + 3, '#a0c6a0', 4);
    this.line(start.x + 8, start.y + 6, end.x - 9, start.y + 6, '#638e78', 5);
    // Small hanging vines live within the rock silhouette.
    for (let i = 0; i < 5; i++) {
      const x = start.x + 30 + i * ((end.x - start.x - 60) / 5), length = 16 + ((i * 13 + pad.id * 7) % 22);
      this.line(x, start.y + 11, x + Math.sin(time + i) * 1.5, start.y + length, '#8ba79560', 1.5);
      this.ellipse(x + 2, start.y + length - 3, 3, 1.5, '#99caa466');
    }
    for (let i = 0; i < 9; i++) this.rect(start.x + 20 + i * 17 % (end.x - start.x - 40), start.y + 21 + i * 11 % 25, 3, 2, '#a1b7a92b');
  }
  building(pad: Pad, time: number) {
    const { x, y, width: w, height: h, kind } = pad.building;
    const c = this.ctx;
    const image = this.images.get(kind);
    if (image) { c.drawImage(image, x, y, w, h); return; }
    if (kind === 'restaurant') {
      this.rect(x, y + 29, w, h - 29, '#353e42', 2);
      this.rect(x + 5, y + 35, w - 10, 35, '#8da599');
      this.rect(x + 10, y + 40, w - 20, 26, '#1e3440');
      this.line(x + 37, y + 41, x + 37, y + 65, '#7e9e94', 2);
      this.rect(x + 6, y + 75, 18, h - 77, '#223039'); this.rect(x + 9, y + 78, 12, 18, '#82a5a1');
      this.rect(x + 33, y + 74, 32, 17, '#25323c'); this.rect(x + 37, y + 77, 24, 4, '#8ba498');
      this.rect(x - 0, y + 25, w, 8, '#bdf77d', 2);
      for (let i = 0; i < 5; i++) this.rect(x + i * 15, y + 31, 8, 5, '#e1dba0');
      this.rect(x + 4, y + 5, w - 8, 18, '#26392e', 3);
      this.text('ZETA BURGER', x + w / 2, y + 17, '#c8fc8c', 8, 'center', 'bold');
      // A burger-shaped neon sign.
      this.ellipse(x + w / 2, y + 2, 16, 5, '#c7c99a'); this.rect(x + w / 2 - 16, y - 0, 32, 3, '#719e67');
      this.text('OPEN', x + 51, y + 58, '#c3f58f', 7);
      this.alien(x + 23, y + 63, '#adc79a', .8);
    } else if (kind === 'mushroom') {
      this.rect(x + 10, y + 28, w - 19, h - 28, '#777f8d', 3);
      this.rect(x + 14, y + 37, w - 27, 12, '#dcbbeb', 2); this.rect(x + 18, y + 55, 10, h - 55, '#3b425b');
      this.rect(x, y + 9, w, 27, '#a087b4', 8); this.rect(x + 4, y + 4, w - 8, 17, '#b299c5', 9);
      this.ellipse(x + 10, y + 20, 4, 3, '#ecd0e5'); this.ellipse(x + 27, y + 12, 4, 2, '#ecd0e5'); this.ellipse(x + 34, y + 25, 3, 2, '#ecd0e5');
      this.line(x + 5, y + 32, x + w - 5, y + 32, '#d4b0e7', 2);
    } else if (kind === 'observatory') {
      this.rect(x + 3, y + 29, w - 6, h - 29, '#667f8a', 3); this.rect(x, y + 18, w, 25, '#96afba', 14);
      this.rect(x + 9, y + 36, w - 18, 11, '#304755'); this.rect(x + 15, y + 49, 13, h - 49, '#253e4a');
      this.line(x + 21, y + 18, x + 31, y + 2, '#a3ccce', 5); this.line(x + 27, y + 5, x + 37, y + 8, '#c3e0d6', 4);
      this.rect(x + 7, y + 53, 3, 3, '#baf7a0');
    } else if (kind === 'motel') {
      this.rect(x, y + 7, w, h - 7, '#646479', 4); this.rect(x + 5, y + 2, w - 10, 9, '#d1a0bb', 2);
      this.rect(x + 7, y + 17, w - 14, 13, '#353954'); this.text('MOON MOTEL', x + w / 2, y + 26, '#ffccb1', 7);
      for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) { this.rect(x + 8 + col * 18, y + 38 + row * 21, 12, 13, '#293343', 1); this.rect(x + 10 + col * 18, y + 40 + row * 21, 8, 8, (row + col) % 2 ? '#b5a4c0' : '#ffcf9a'); }
      this.rect(x + 25, y + 77, 16, h - 77, '#25333f');
    } else if (kind === 'crystal') {
      this.rect(x + 3, y + 46, w - 6, h - 46, '#4d6073', 2);
      this.polygon([{ x, y: y + 22 }, { x: x + 10, y: y + 2 }, { x: x + 16, y: y + 23 }, { x: x + 10, y: y + 51 }], '#b5a3e2', '#d9c3f2');
      this.polygon([{ x: x + 13, y: y + 26 }, { x: x + 24, y: y + 11 }, { x: x + 26, y: y + 36 }, { x: x + 17, y: y + 52 }], '#938bd1', '#c9b6e7');
      this.line(x + 10, y + 3, x + 10, y + 48, '#ead4f3', 1);
      this.ellipse(x + 12, y + 57, 5, 2, '#bdf77d');
    } else if (kind === 'outpost') {
      this.rect(x + 3, y + 12, w - 6, h - 12, '#506f7d', 4); this.rect(x, y + 7, w, 13, '#94b3be', 5);
      this.rect(x + 8, y + 28, w - 16, 13, '#b6d2c8', 3); this.line(x + 25, y + 29, x + 25, y + 40, '#496e7c', 2);
      this.rect(x + 18, y + 48, 17, h - 48, '#283c4c'); this.rect(x + 22, y + 52, 9, 6, '#a0cda9');
      this.line(x + 36, y + 9, x + 36, y, '#bad1d3', 2); this.ellipse(x + 36, y + 2, 3, 2, '#bdf77d');
    } else {
      this.rect(x, y + 10, w, h - 10, '#516c7b', 3); this.rect(x + 4, y + 15, w - 8, 15, '#98c6c5', 2);
      this.rect(x + 3, y + 34, w - 6, 5, '#263c4d'); this.rect(x + 11, y, 6, 12, '#839caa');
      this.ellipse(x + 14, y + 2, 3, 2, Math.sin(time * 2) > 0 ? '#bdf77d' : '#729c77');
    }
  }
  alien(x: number, y: number, color: string, scale = 1) {
    const c = this.ctx; c.save(); c.translate(x, y); c.scale(scale, scale);
    this.ellipse(0, -7, 7, 7, color); this.rect(-4, -2, 8, 5, color, 2);
    this.ellipse(-3, -8, 1.5, 2.5, '#293449'); this.ellipse(3, -8, 1.5, 2.5, '#293449'); c.restore();
  }
  pad(pad: Pad, active: boolean, time: number) {
    const c = this.ctx, { x, y, width: w, color } = pad;
    if (active) {
      const beam = c.createLinearGradient(0, y - 86, 0, y); beam.addColorStop(0, '#bdf77d00'); beam.addColorStop(1, '#bdf77d15');
      c.fillStyle = beam; c.fillRect(x + 4, y - 86, w - 8, 86);
      c.setLineDash([3, 6]); this.line(x + 5, y - 45, x + 5, y - 9, '#bdf77d6b'); this.line(x + w - 5, y - 45, x + w - 5, y - 9, '#bdf77d6b'); c.setLineDash([]);
      this.text('▼', x + w / 2, y - 65 + (this.reducedMotion ? 0 : Math.sin(time * 3) * 3), '#bdf77d', 12);
    }
    this.rect(x, y, w, 10, '#2b3645', 2); this.rect(x, y, w, 3, active ? '#bdf77d' : color, 1);
    this.rect(x + 5, y + 5, w - 10, 2, '#526376');
    for (let i = 0; i < 6; i++) this.rect(x + 7 + i * (w - 18) / 5, y + 6, 4, 2, active ? '#bdf77d' : color + 'a0');
    this.rect(x - 2, y - 6, 4, 6, '#435363'); this.rect(x + w - 2, y - 6, 4, 6, '#435363');
    this.ellipse(x, y - 6, 2, 2, active ? '#bdf77d' : color); this.ellipse(x + w, y - 6, 2, 2, active ? '#bdf77d' : color);
    const label = pad.id === -1 ? 'H' : String(pad.id);
    const cx = x + w / 2, ly = y + 32;
    this.rect(cx - 12, ly - 14, 24, 23, '#25343fe6', 5);
    c.strokeStyle = active ? '#bdf77d' : color + '90'; c.lineWidth = 1; c.strokeRect(cx - 11.5, ly - 13.5, 23, 22);
    this.text(label, cx, ly + 2, active ? '#bdf77d' : color, 14, 'center', 'bold');
    this.text(pad.name.toUpperCase(), cx, y + 63, '#d1cbd7b0', 8);
  }
  saucer(game: Game, controls: Controls, time: number) {
    const c = this.ctx, s = game.ship;
    if (game.phase === 'crashed' || game.phase === 'gameover') return;
    if (s.landed !== null) this.ellipse(s.x, s.y + 24, 27, 3, '#151d2955');
    if (controls.up && game.phase === 'playing') {
      const length = 15 + (this.reducedMotion ? 3 : Math.sin(time * 40) * 4);
      this.polygon([{ x: s.x - 9, y: s.y + 9 }, { x: s.x, y: s.y + length + 9 }, { x: s.x + 9, y: s.y + 9 }], '#9edbd269');
      this.polygon([{ x: s.x - 5, y: s.y + 9 }, { x: s.x, y: s.y + length + 5 }, { x: s.x + 5, y: s.y + 9 }], '#c7f59d');
    }
    if (!s.gear && game.phase === 'playing') {
      const direction = Number(controls.right) - Number(controls.left);
      if (direction) this.polygon([{ x: s.x - direction * 22, y: s.y - 3 }, { x: s.x - direction * (37 + Math.sin(time * 35) * 3), y: s.y + 1 }, { x: s.x - direction * 22, y: s.y + 5 }], '#bdf77d99');
    }
    if (s.gear) {
      for (const side of [-1, 1]) {
        this.line(s.x + side * 12, s.y + 7, s.x + side * PHYSICS.footX, s.y + PHYSICS.footY - 2, '#c7d6d0', 2.5);
        this.line(s.x + side * PHYSICS.footX - 3, s.y + PHYSICS.footY - 1, s.x + side * PHYSICS.footX + 3, s.y + PHYSICS.footY - 1, '#bdf77d', 2);
      }
    }
    const custom = this.images.get('saucer');
    if (custom) c.drawImage(custom, s.x - 24, s.y - 17, 48, 25);
    else {
      const hull = c.createLinearGradient(0, s.y - 8, 0, s.y + 8); hull.addColorStop(0, '#d7e9d7'); hull.addColorStop(.5, '#a2b5b5'); hull.addColorStop(1, '#637e94');
      this.polygon(shipBody(s), hull, '#d0dfd0');
      this.polygon([{ x: s.x - 12, y: s.y - 7 }, { x: s.x - 9, y: s.y - 17 }, { x: s.x + 9, y: s.y - 17 }, { x: s.x + 12, y: s.y - 7 }], '#6cacae', '#b9e0cf');
      this.ellipse(s.x + 2, s.y - 10, 5, 5, '#b3d7a0'); this.ellipse(s.x, s.y - 10, 1.2, 2, '#254156'); this.ellipse(s.x + 5, s.y - 10, 1.2, 2, '#254156');
      this.line(s.x - 19, s.y + 1, s.x + 19, s.y + 1, '#465f76', 1.5);
      for (let i = 0; i < 5; i++) this.ellipse(s.x - 14 + i * 7, s.y + 3, 1.5, 1.2, i === 2 ? '#ffd0a0' : '#bdf77d');
    }
    if (game.order) {
      this.rect(s.x + 16, s.y - 18, 9, 10, '#dbb382', 1); this.rect(s.x + 18, s.y - 21, 5, 3, '#d5ba94', 1); this.line(s.x + 18, s.y - 13, s.x + 23, s.y - 13, '#5f6048', 1);
      this.text(`→ ${game.order.target}`, s.x, s.y - 30, '#c8f8a0', 10, 'center', 'bold');
    }
    if (s.landed !== null && game.dwell < PHYSICS.dwell && (s.landed === 0 || s.landed === game.order?.target)) {
      this.rect(s.x - 18, s.y - 35, 36, 3, '#2d414e', 1); this.rect(s.x - 18, s.y - 35, 36 * Math.min(1, game.dwell / PHYSICS.dwell), 3, '#bdf77d', 1);
    }
  }
  draw(game: Game, controls: Controls, dt: number, visualTime: number) {
    const c = this.ctx;
    this.update(dt, game, controls); this.background(visualTime);
    for (const pad of PADS) { this.island(pad, visualTime); this.building(pad, visualTime); this.pad(pad, pad.id === game.destination.id, visualTime); }
    this.saucer(game, controls, visualTime);
    for (const p of this.particles) { c.globalAlpha = Math.max(0, 1 - p.age / p.life); this.rect(p.x, p.y, p.size, p.size, p.color, 1); }
    c.globalAlpha = 1;
    if (game.phase === 'crashed') {
      this.text('SAUCER LOST', WORLD_WIDTH / 2, 420, '#f4c2ce', 22, 'center', 'bold'); this.text('DISPATCHING A REPLACEMENT…', WORLD_WIDTH / 2, 449, '#c7b6d4', 10);
    }
  }
}
