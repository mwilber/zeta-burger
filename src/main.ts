import { Game, PHYSICS, FUEL, START_DELAY } from './engine.js';
import type { Controls, Phase } from './engine.js';
import { LEVELS, SKILLS, nextLevel } from './levels.js';
import type { Skill } from './levels.js';
import { Renderer } from './renderer.js';
import { Sound } from './audio.js';
const get = <T extends Element = HTMLElement>(id: string) => document.querySelector<T>(`#${id}`)!;
const stage = get<SVGSVGElement>('game');
const game = new Game();
const renderer = new Renderer(stage);
const sound = new Sound();
const overlay = get<HTMLDivElement>('overlay');
const dialog = get<HTMLDialogElement>('help-dialog');
const keys = new Set<string>();
const pointers = new Map<number, keyof Controls>();
const touchButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-control]'));
const skillSelect = get<HTMLSelectElement>('skill');
const levelSelect = get<HTMLSelectElement>('level');
for (const level of LEVELS) levelSelect.add(new Option(`${level.number} · ${level.name}`, level.id));
get('level-picker').hidden = LEVELS.length === 1;
let starting = false;
let advanceFailed = false;
levelSelect.addEventListener('change', () => {
  if (game.phase !== 'ready' || starting) return;
  game.level = LEVELS.find(level => level.id === levelSelect.value)!;
  game.pads = game.level.pads; game.solids = game.level.solids; game.time = 0;
  game.ship = game.spawn();
  void renderer.setLevel(game.level);
  updateHud();
});
const orderQueue = get('order-queue');
const orderSummary = get('order-summary');
const fuelValue = get('fuel');
const fuelMeter = get<HTMLMeterElement>('fuel-meter');
const hud = { bank: get('bank'), tip: get('tip'), deliveries: get('deliveries'), lives: get('lives'), gear: get('gear-status'), mission: get('mission'), label: get('mission-label'), pad: get('mission-pad'), velocity: get('velocity'), best: get('best'), pause: get<HTMLButtonElement>('pause') };
let best = 0;
try { best = Math.max(0, Number(localStorage.getItem('zeta-burger-best')) || 0); } catch { /* Private browsing can disable storage. */ }
let toastTimer = 0;
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
  return { left: keys.has('ArrowLeft') || keys.has('KeyA') || held.has('left'), right: keys.has('ArrowRight') || keys.has('KeyD') || held.has('right'), up: keys.has('ArrowUp') || keys.has('KeyW') || held.has('up'), down: keys.has('ArrowDown') || keys.has('KeyS') || held.has('down') };
}
async function start(continuing = false) {
  if (starting) return;
  const level = LEVELS.find(level => level.id === levelSelect.value)!;
  const skill = continuing ? game.skill : skillSelect.value as Skill;
  advanceFailed = false;
  starting = true; updateHud();
  const loaded = await renderer.setLevel(level);
  starting = false;
  if (!loaded) { advanceFailed = true; toast(`Could not load ${level.name} artwork. Retry to continue.`); updateHud(); return; }
  game.start(skill, level, { carryBank: continuing }); resetInputs(); overlay.hidden = true;
  accumulator = 0; last = performance.now(); renderer.particles = [];
  toast(continuing ? `${level.name} is about to begin…` : 'Your shift is about to begin…');
  if (continuing && (document.hidden || dialog.open)) {
    game.pause(); sound.stopAll(); helpPaused = dialog.open;
  } else playStartJingle();
  stage.focus({ preventScroll: true }); updateHud();
}
function playStartJingle() {
  try { sound.startJingle(START_DELAY - game.countdownTime); }
  catch { /* The start delay still works when audio is unavailable. */ }
}
function pause() {
  game.pause(); resetInputs();
  if (game.phase === 'paused') sound.stopAll();
  else if (game.phase === 'countdown') playStartJingle();
}
function toggleGear() { game.toggleGear(); }
function openHelp() {
  helpPaused = game.phase === 'playing' || game.phase === 'countdown' || game.phase === 'crashed';
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
    if (enabled && game.phase === 'countdown') playStartJingle();
  } catch { toast('Audio is unavailable in this browser.'); sound.enabled = false; }
});
hud.gear.addEventListener('click', toggleGear);
get('touch-gear').addEventListener('click', toggleGear);
hud.pause.addEventListener('click', pause);
overlay.addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest('button');
  if (button?.id === 'start' || button?.dataset.action === 'restart') void start(advanceFailed);
  else if (button?.dataset.action === 'resume') pause();
});
const handled = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyG', 'Space', 'KeyP', 'Escape', 'Enter']);
window.addEventListener('keydown', event => {
  if (dialog.open || event.target instanceof HTMLSelectElement || !handled.has(event.code)) return;
  if (event.code === 'Enter') {
    if (game.phase === 'ready' || game.phase === 'gameover') { event.preventDefault(); void start(advanceFailed); }
    return;
  }
  event.preventDefault();
  if (event.repeat) return;
  if (event.code === 'KeyG' || event.code === 'Space') toggleGear();
  else if (event.code === 'KeyP' || event.code === 'Escape') pause();
  else if (game.phase === 'playing') keys.add(event.code);
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => { resetInputs(); if (game.phase === 'playing' || game.phase === 'countdown' || game.phase === 'crashed') pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { resetInputs(); if (game.phase === 'playing' || game.phase === 'countdown' || game.phase === 'crashed') pause(); } });
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
  skillSelect.disabled = starting || (game.phase !== 'ready' && game.phase !== 'gameover');
  levelSelect.disabled = skillSelect.disabled;
  overlay.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = starting; });
  const orderCount = game.phase === 'ready' ? SKILLS[skillSelect.value as Skill].orders : game.totalOrders;
  text(get('order-total'), String(orderCount));
  text(get('level-name'), `LEVEL ${game.level.number} · ${game.level.name.toUpperCase()}`);
  text(get('world-name'), game.level.name.toUpperCase());
  text(get('shift-world'), game.level.name.toUpperCase());
  text(get('level-theme'), game.level.theme.toUpperCase());
  text(get('fuel-pad'), `REFILL · PAD ${game.level.gasStation}`);
  const intro = document.querySelector<HTMLElement>('#intro-description');
  if (intro) text(intro, `Start above ${game.level.name}. Your first order arrives in 5 seconds. Deliver every order. Refuel at pad ${game.level.gasStation}.${game.level.blackHole ? ' The central black hole pulls harder up close. Stay on the outer rim; crossing the event horizon destroys your saucer. Land on any pad to stop the pull.' : game.level.gravity === 0 ? ' No gravity: use thrust to brake. Hold Down on a moving pad for 250 ms to clamp.' : ''}${game.level.fallingObstacleLimit ? ' Watch for falling obstacles!' : ''}${game.level.seekerCount ? ' Seekers hunt you in flight. Land on any pad for safety.' : ''}`);
  text(get('help-dwell'), String(game.serviceDelay));
  text(get('help-restaurant'), `pad ${game.level.restaurant}`);
  text(get('help-gas'), `pad ${game.level.gasStation}`);
  get('falling-obstacle-help').hidden = game.level.fallingObstacleLimit === 0;
  get('seeker-help').hidden = game.level.seekerCount === 0;
  get('zero-g-help').hidden = game.level.id !== 'zero-g';
  get('black-hole-help').hidden = !game.level.blackHole;
  text(fuelValue, `${Math.floor(game.fuel)}%`); fuelMeter.value = game.fuel;
  fuelValue.closest('.fuel-readout')!.classList.toggle('low-fuel', game.fuel <= FUEL.low);
  text(orderSummary, game.phase === 'ready' ? `${orderCount} ${orderCount === 1 ? 'order' : 'orders'} this shift` : `${game.delivered}/${game.totalOrders} delivered · ${game.waitingOrders.length} waiting · ${game.scheduledCount} incoming`);
  const activeOrders = game.orders.filter(order => order.status === 'waiting' || order.status === 'onboard');
  const queueMarkup = activeOrders.map(order => {
    const tip = game.tipFor(order);
    return `<div class="order-card ${tip < 0 ? 'negative' : ''} ${order.status === 'onboard' ? 'onboard' : ''}"><strong>${money(tip)}</strong><span class="package-icon" aria-hidden="true">▣</span><span>#${order.id} → PAD ${order.target}</span><small>${order.status === 'onboard' ? 'ON BOARD' : 'WAITING'}</small></div>`;
  }).join('') || `<span class="queue-empty">${game.phase === 'ready' ? 'Orders arrive throughout the shift. Every tip has its own timer.' : game.scheduledCount ? 'Dispatch is preparing the next order…' : 'No orders waiting.'}</span>`;
  if (orderQueue.innerHTML !== queueMarkup) orderQueue.innerHTML = queueMarkup;
  text(hud.bank, money(game.bank)); text(hud.tip, game.order ? money(game.tip) : '—');
  hud.tip.parentElement!.classList.toggle('negative', !!game.order && game.tip < 0);
  text(hud.deliveries, String(game.delivered).padStart(2, '0'));
  text(hud.lives, Array.from({ length: 3 }, (_, i) => i < game.lives ? '◒' : '◌').join(' ')); hud.lives.setAttribute('aria-label', `${game.lives} lives`);
  const gearMarkup = `${game.ship.gear ? '↓ EXTENDED' : '↑ RETRACTED'} <kbd>G</kbd>`;
  if (hud.gear.innerHTML !== gearMarkup) hud.gear.innerHTML = gearMarkup;
  hud.gear.classList.toggle('retracted', !game.ship.gear); hud.gear.setAttribute('aria-pressed', String(game.ship.gear));
  for (const button of touchButtons) button.disabled = game.phase !== 'playing' || ((button.dataset.control === 'left' || button.dataset.control === 'right') && game.ship.gear);
  const missionMarkup = game.order ? `${game.destination.name} <span>· Deliver order #${game.order.id} to pad ${game.order.target}</span>` : `${game.destination.name} <span>· ${game.waitingOrders.length ? `${game.waitingOrders.length} ${game.waitingOrders.length === 1 ? "order" : "orders"} ready at pad ${game.level.restaurant}` : `Await dispatch at pad ${game.level.restaurant}`}</span>`;
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
    const next = game.phase === 'gameover' && game.endReason === 'delivered' ? nextLevel(game.level) : undefined;
    if (next && !advanceFailed) {
      // Keep the completed field visible while its successor loads, with no result dialog.
      overlay.hidden = true;
      if (!starting) { levelSelect.value = next.id; void start(true); }
      return;
    }
    if (game.phase === 'playing' && previousPhase === 'countdown') {
      sound.stopJingle();
      toast(`${game.totalOrders} ${game.totalOrders === 1 ? 'order' : 'orders'} this shift. The first arrives at pad ${game.level.restaurant} in 5 seconds.`);
    }
    previousPhase = game.phase;
    overlay.hidden = game.phase !== 'ready' && game.phase !== 'paused' && game.phase !== 'gameover';
    if (game.phase === 'paused') overlay.innerHTML = '<div class="overlay-card"><div class="card-tag">TAKE A BREATHER</div><h2>Parked in orbit.</h2><p>Your shift, fuel, arrivals, and tip timers are paused.</p><button class="primary-button" data-action="resume">BACK TO THE SHIFT <span>→</span></button></div>';
    if (game.phase === 'gameover') {
      resetInputs();
      const reason = game.endReason === 'delivered' ? 'Every order delivered. Final level complete!' : game.endReason === 'tips' ? 'No remaining tip can keep your bank at or above $0.' : 'Your last saucer was lost.';
      overlay.innerHTML = next && advanceFailed
        ? `<div class="overlay-card"><div class="card-tag">LEVEL COULD NOT LOAD</div><h2>${next.name} is waiting.</h2><p>Its artwork could not load. Retry to continue your game.</p><button class="primary-button" data-action="restart">RETRY NEXT LEVEL <span>→</span></button></div>`
        : `<div class="overlay-card"><div class="card-tag">${game.endReason === 'delivered' ? 'GAME COMPLETE' : 'SHIFT ENDED'}</div><h2>${game.endReason === 'delivered' ? 'That’s a wrap, pilot.' : 'You’re fired!'}</h2><p>Level ${game.level.number} · ${game.level.name}<br>${reason}<br>${game.delivered}/${game.totalOrders} deliveries · Your bank: <b>${money(game.bank)}</b><br>Best shift: ${money(best)}</p><button class="primary-button" data-action="restart">REPLAY LEVEL <span>→</span></button><small class="intro-note">Choose your level and skill above for the next shift.</small></div>`;
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
  for (const event of game.events.splice(0)) {
    if (event.type === 'gameover' && event.endReason === 'delivered' && nextLevel(game.level)) continue;
    if (event.type !== 'gameover' && event.type !== 'falling-obstacle-impact') toast(event.message);
    renderer.burst(event); sound.play(event);
  }
  sound.update(game, input);
  renderer.draw(game, input, frozen ? 0 : elapsed, visualTime); updateHud();
  requestAnimationFrame(frame);
}
updateHud(); requestAnimationFrame(frame);
