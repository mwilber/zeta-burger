import { Game, PHYSICS } from './engine.js';
import type { Controls, Phase } from './engine.js';
import { Renderer } from './renderer.js';
import { Sound } from './audio.js';
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = get<HTMLCanvasElement>('game');
const game = new Game();
const renderer = new Renderer(canvas);
const sound = new Sound();
const overlay = get<HTMLDivElement>('overlay');
const dialog = get<HTMLDialogElement>('help-dialog');
const keys = new Set<string>();
const pointers = new Map<number, keyof Controls>();
const touchButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-control]'));
const hud = { bank: get('bank'), tip: get('tip'), deliveries: get('deliveries'), lives: get('lives'), gear: get('gear-status'), mission: get('mission'), label: get('mission-label'), pad: get('mission-pad'), velocity: get('velocity'), best: get('best'), pause: get<HTMLButtonElement>('pause') };
let best = 0;
try { best = Math.max(0, Number(localStorage.getItem('zeta-burger-best')) || 0); } catch { /* Private browsing can disable storage. */ }
let toastTimer = 0;
let pausedFrom: Phase | null = null;
let helpPaused = false;
let previousPhase: Phase = 'ready';
const money = (amount: number) => `${amount < 0 ? '−' : ''}$${Math.abs(amount).toFixed(2)}`;
function text(element: HTMLElement, value: string) { if (element.textContent !== value) element.textContent = value; }
function toast(message: string) {
  const element = get('toast'); text(element, message); element.classList.add('visible');
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => element.classList.remove('visible'), 4800);
}
function resetInputs() { keys.clear(); pointers.clear(); touchButtons.forEach(button => button.classList.remove('held')); }
function controls(): Controls {
  const held = new Set(pointers.values());
  return { left: keys.has('ArrowLeft') || keys.has('KeyA') || held.has('left'), right: keys.has('ArrowRight') || keys.has('KeyD') || held.has('right'), up: keys.has('ArrowUp') || keys.has('KeyW') || held.has('up') };
}
function start() {
  game.start(); pausedFrom = null; resetInputs(); overlay.hidden = true;
  canvas.focus({ preventScroll: true }); toast('Welcome, pilot. Thrust up, retract gear, then fly to pad 0.');
}
function pause() {
  if (game.phase === 'playing' || game.phase === 'crashed') {
    pausedFrom = game.phase; game.phase = 'paused'; resetInputs();
  } else if (game.phase === 'paused') { game.phase = pausedFrom ?? 'playing'; pausedFrom = null; resetInputs(); }
}
function toggleGear() { game.toggleGear(); }
function openHelp() {
  helpPaused = game.phase === 'playing' || game.phase === 'crashed';
  if (helpPaused) pause();
  resetInputs(); dialog.showModal();
}
get('help').addEventListener('click', openHelp);
get('close-help').addEventListener('click', () => dialog.close());
get('help-done').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { if (helpPaused && game.phase === 'paused') pause(); helpPaused = false; });
get('sound').addEventListener('click', () => {
  try {
    const enabled = sound.toggle(), button = get('sound');
    button.innerHTML = enabled ? '♫' : '♫<span class="sound-slash">/</span>';
    button.setAttribute('aria-label', enabled ? 'Mute sound' : 'Enable sound');
    button.setAttribute('aria-pressed', String(enabled)); button.title = enabled ? 'Mute sound' : 'Enable sound';
  } catch { toast('Audio is unavailable in this browser.'); sound.enabled = false; }
});
hud.gear.addEventListener('click', toggleGear);
get('touch-gear').addEventListener('click', toggleGear);
hud.pause.addEventListener('click', pause);
overlay.addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest('button');
  if (button?.id === 'start' || button?.dataset.action === 'restart') start();
  else if (button?.dataset.action === 'resume') pause();
});
const handled = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'KeyA', 'KeyD', 'KeyW', 'KeyG', 'Space', 'KeyP', 'Escape', 'Enter']);
window.addEventListener('keydown', event => {
  if (dialog.open || !handled.has(event.code)) return;
  if (event.code === 'Enter') {
    if (game.phase === 'ready' || game.phase === 'gameover') { event.preventDefault(); start(); }
    return;
  }
  event.preventDefault();
  if (event.repeat) return;
  if (event.code === 'KeyG' || event.code === 'Space') toggleGear();
  else if (event.code === 'KeyP' || event.code === 'Escape') pause();
  else keys.add(event.code);
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => { resetInputs(); if (game.phase === 'playing' || game.phase === 'crashed') pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { resetInputs(); if (game.phase === 'playing' || game.phase === 'crashed') pause(); } });
for (const button of touchButtons) {
  const control = button.dataset.control as keyof Controls;
  button.addEventListener('pointerdown', event => {
    if (game.phase !== 'playing' || button.disabled) return;
    event.preventDefault(); button.setPointerCapture(event.pointerId); pointers.set(event.pointerId, control); button.classList.add('held');
  });
  const release = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    if (!Array.from(pointers.values()).includes(control)) button.classList.remove('held');
  };
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
  button.addEventListener('contextmenu', event => event.preventDefault());
}
function updateHud() {
  text(hud.bank, money(game.bank)); text(hud.tip, game.order ? money(game.tip) : '—');
  hud.tip.parentElement!.classList.toggle('negative', !!game.order && game.tip < 0);
  text(hud.deliveries, String(game.delivered).padStart(2, '0'));
  text(hud.lives, Array.from({ length: 3 }, (_, i) => i < game.lives ? '◒' : '◌').join(' ')); hud.lives.setAttribute('aria-label', `${game.lives} lives`);
  const gearMarkup = `${game.ship.gear ? '↓ EXTENDED' : '↑ RETRACTED'} <kbd>G</kbd>`;
  if (hud.gear.innerHTML !== gearMarkup) hud.gear.innerHTML = gearMarkup;
  hud.gear.classList.toggle('retracted', !game.ship.gear); hud.gear.setAttribute('aria-pressed', String(game.ship.gear));
  for (const button of touchButtons) if (button.dataset.control !== 'up') button.disabled = game.ship.gear;
  const missionMarkup = game.order ? `${game.destination.name} <span>· Deliver your order to pad ${game.order.target}</span>` : 'Restaurant <span>· Pick up a fresh order at pad 0</span>';
  if (hud.mission.innerHTML !== missionMarkup) hud.mission.innerHTML = missionMarkup;
  text(hud.label, game.order ? 'ORDER ON BOARD' : 'NEXT STOP'); text(hud.pad, `PAD ${game.destination.id}`);
  text(hud.velocity, `${game.ship.vy < 0 ? '↑' : '↓'} ${Math.round(Math.abs(game.ship.vy))}  ·  ↔ ${Math.round(Math.abs(game.ship.vx))}`);
  hud.velocity.classList.toggle('unsafe', game.ship.vy > PHYSICS.safeVertical || Math.abs(game.ship.vx) > PHYSICS.safeHorizontal);
  if (game.bank > best) {
    best = game.bank;
    try { localStorage.setItem('zeta-burger-best', String(best)); } catch { /* Nonessential persistence. */ }
  }
  text(hud.best, `BEST SHIFT ${money(best)}`);
  hud.pause.setAttribute('aria-label', game.phase === 'paused' ? 'Resume game' : 'Pause game');
  text(hud.pause, game.phase === 'paused' ? '▷' : 'Ⅱ');
  if (game.phase !== previousPhase) {
    previousPhase = game.phase;
    overlay.hidden = game.phase !== 'ready' && game.phase !== 'paused' && game.phase !== 'gameover';
    if (game.phase === 'paused') overlay.innerHTML = '<div class="overlay-card"><div class="card-tag">TAKE A BREATHER</div><h2>Parked in orbit.</h2><p>Your shift and tip timer are paused.</p><button class="primary-button" data-action="resume">BACK TO THE SHIFT <span>→</span></button></div>';
    if (game.phase === 'gameover') {
      resetInputs();
      overlay.innerHTML = `<div class="overlay-card"><div class="card-tag">NIGHT SHIFT COMPLETE</div><h2>That’s a wrap, pilot.</h2><p>${game.delivered} deliveries · Your bank: <b>${money(game.bank)}</b><br>Best shift: ${money(best)}</p><button class="primary-button" data-action="restart">FLY ANOTHER SHIFT <span>→</span></button><small class="intro-note">Tip: cancel your sideways drift before lowering your gear.</small></div>`;
    }
  }
}
let last = performance.now(), accumulator = 0, visualTime = 0;
const fixedStep = 1 / 120;
function frame(now: number) {
  const elapsed = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
  const input = controls();
  const frozen = game.phase === 'paused' || game.phase === 'gameover';
  if (!frozen) visualTime += elapsed;
  accumulator += frozen ? 0 : elapsed;
  while (accumulator >= fixedStep) { game.step(fixedStep, input); accumulator -= fixedStep; }
  if (frozen) accumulator = 0;
  for (const event of game.events.splice(0)) { if (event.type !== 'gameover') toast(event.message); renderer.burst(event); sound.play(event); }
  renderer.draw(game, input, frozen ? 0 : elapsed, visualTime); updateHud();
  requestAnimationFrame(frame);
}
updateHud(); requestAnimationFrame(frame);
