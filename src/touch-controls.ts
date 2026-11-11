import type { Controls } from './engine.js';

const DEAD_ZONE = 8;
const JOYSTICK_RADIUS = 52;
const neutral = (): Controls => ({ left: 0, right: 0, up: 0, down: 0 });

// Interpolate by angle between neighboring cardinal directions. Distance only
// determines whether the thumb has left the neutral zone, not thrust power.
export function swipeThrust(dx: number, dy: number): Controls {
  if (Math.hypot(dx, dy) <= DEAD_ZONE) return neutral();
  const vertical = Math.atan2(Math.abs(dy), Math.abs(dx)) / (Math.PI / 2);
  const horizontal = 1 - vertical;
  return { left: dx < 0 ? horizontal : 0, right: dx > 0 ? horizontal : 0,
    up: dy < 0 ? vertical : 0, down: dy > 0 ? vertical : 0 };
}

export class TouchControls {
  private active = false;
  private flying = false;
  private pointer: number | null = null;
  private fuelPointer: number | null = null;
  private origin = { x: 0, y: 0 };
  private thrust = neutral();

  constructor(private surface: HTMLElement, private joystick: HTMLElement, knob: HTMLElement, toggleGear: () => void, private fuelButton: HTMLButtonElement) {
    fuelButton.addEventListener('pointerdown', event => {
      event.preventDefault(); event.stopPropagation();
      if (!this.active || !this.flying || fuelButton.hidden || this.fuelPointer !== null) return;
      this.fuelPointer = event.pointerId;
      fuelButton.setPointerCapture(event.pointerId);
      fuelButton.setAttribute('aria-pressed', 'true');
    });
    const releaseFuel = (event: PointerEvent) => {
      event.preventDefault(); event.stopPropagation();
      if (event.pointerId === this.fuelPointer) this.resetFuel();
    };
    fuelButton.addEventListener('pointerup', releaseFuel);
    fuelButton.addEventListener('pointercancel', releaseFuel);
    fuelButton.addEventListener('lostpointercapture', releaseFuel);
    fuelButton.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); });
    surface.addEventListener('pointerdown', event => {
      if (!this.active) return;
      event.preventDefault();
      if (!this.flying || event.pointerType !== 'touch') return;
      surface.setPointerCapture(event.pointerId);
      // A finger keeps its original role even if it crosses the screen midpoint.
      if (event.clientX >= surface.getBoundingClientRect().width / 2) {
        toggleGear();
      } else if (this.pointer === null) {
        this.pointer = event.pointerId;
        this.origin = { x: event.clientX, y: event.clientY };
        this.thrust = neutral();
        joystick.style.left = `${this.origin.x}px`;
        joystick.style.top = `${this.origin.y}px`;
        knob.style.transform = 'translate(0px, 0px)';
        joystick.hidden = false;
      }
    });
    surface.addEventListener('pointermove', event => {
      if (!this.active) return;
      event.preventDefault();
      if (event.pointerId !== this.pointer) return;
      const dx = event.clientX - this.origin.x, dy = event.clientY - this.origin.y;
      this.thrust = swipeThrust(dx, dy);
      const scale = Math.min(1, JOYSTICK_RADIUS / Math.max(1, Math.hypot(dx, dy)));
      knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
    });
    const release = (event: PointerEvent) => {
      if (this.active) event.preventDefault();
      if (event.pointerId === this.pointer) this.resetThrust();
    };
    surface.addEventListener('pointerup', release);
    surface.addEventListener('pointercancel', release);
    surface.addEventListener('lostpointercapture', release);
    surface.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); });
    surface.addEventListener('contextmenu', event => event.preventDefault());
  }

  setActive(active: boolean, flying: boolean, atRestaurant = false) {
    if (active !== this.active || flying !== this.flying) this.reset();
    this.active = active;
    this.flying = flying;
    this.surface.hidden = !active;
    this.fuelButton.hidden = !active || !flying || !atRestaurant;
    if (this.fuelButton.hidden) this.resetFuel();
  }

  controls(): Controls { return { ...this.thrust, ...(this.fuelPointer !== null ? { refuel: true } : {}) }; }

  reset() {
    this.resetThrust();
    this.resetFuel();
  }

  private resetFuel() {
    const pointer = this.fuelPointer;
    this.fuelPointer = null;
    this.fuelButton.setAttribute('aria-pressed', 'false');
    if (pointer !== null && this.fuelButton.hasPointerCapture(pointer)) this.fuelButton.releasePointerCapture(pointer);
  }

  private resetThrust() {
    const pointer = this.pointer;
    this.pointer = null;
    this.thrust = neutral();
    this.joystick.hidden = true;
    if (pointer !== null && this.surface.hasPointerCapture(pointer)) this.surface.releasePointerCapture(pointer);
  }
}
