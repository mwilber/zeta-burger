export interface ArtworkLayer { src: string; x: number; y: number; width: number; height: number }
export interface ArtworkOption {
  value: string;
  label: string;
  thumbnail: { viewBox: string; layers: ArtworkLayer[] };
}

const SVG = 'http://www.w3.org/2000/svg';
/** A single-choice artwork palette with a top-layer, scrollable thumbnail grid. */
export class ArtworkPicker extends HTMLElement {
  private items: readonly ArtworkOption[] = [];
  private selectedValue = '';
  private root = this.attachShadow({ mode: 'open' });
  private trigger: HTMLButtonElement;
  private popup: HTMLDivElement;
  private grid: HTMLDivElement;
  private buttons: HTMLButtonElement[] = [];
  private listeners?: AbortController;

  constructor() {
    super();
    this.root.innerHTML = `
      <style>
        :host { display:block; width:260px; max-width:100%; color:#e1edda; font:12px monospace; }
        * { box-sizing:border-box; }
        button { font:inherit; color:inherit; cursor:pointer; -webkit-tap-highlight-color:transparent; }
        button:focus-visible { outline:2px solid var(--lime,#bdf77d); outline-offset:2px; }
        .trigger { display:flex; gap:9px; align-items:center; width:100%; min-height:44px; padding:5px 10px 5px 5px; border:1px solid #526245; border-radius:5px; background:#26322b; text-align:left; }
        .trigger:hover { border-color:#91ae70; }
        .trigger:disabled { opacity:.4; cursor:default; }
        .trigger[aria-expanded=true] { border-color:var(--lime,#bdf77d); }
        .preview { display:block; width:42px; height:32px; flex:none; border-radius:3px; background:#10141b; overflow:hidden; }
        .label { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .arrow { color:#bdf77d; font-size:10px; }
        .popup { position:fixed; inset:auto; margin:0; width:440px; max-width:calc(100vw - 24px); max-height:420px; padding:0; color:#e1edda; background:#171e21; border:1px solid #6a8056; border-radius:10px; box-shadow:0 12px 45px #0009; }
        .popup:popover-open { display:flex; flex-direction:column; }
        .heading { flex:none; display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px 14px; border-bottom:1px solid #384438; }
        .heading strong { font-size:12px; }
        .count { color:#9ca9b0; font-size:10px; white-space:nowrap; }
        .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(100px,1fr)); gap:8px; min-height:0; overflow:auto; overscroll-behavior:contain; scrollbar-color:#71885e #10141b; padding:12px; scroll-padding:12px; }
        .option { position:relative; min-width:0; padding:6px; border:1px solid #384438; border-radius:6px; background:#10171d; text-align:left; }
        .option:hover { background:#26322b; border-color:#91ae70; }
        .option[aria-selected=true] { border-color:var(--lime,#bdf77d); background:#2a3628; }
        .option[aria-selected=true]::after { content:'✓'; position:absolute; right:8px; top:7px; color:#10141b; background:var(--lime,#bdf77d); width:18px; height:18px; border-radius:50%; text-align:center; line-height:18px; }
        .thumbnail { display:block; width:100%; height:84px; border-radius:3px; background:#10141b; }
        .caption { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; min-height:28px; margin-top:6px; font-size:10px; line-height:14px; }
        svg { display:block; width:100%; height:100%; }
      </style>
      <button type="button" class="trigger" aria-haspopup="dialog" aria-expanded="false" aria-controls="palette">
        <span class="preview" aria-hidden="true"></span><span class="label"></span><span class="arrow" aria-hidden="true">▾</span>
      </button>
      <div id="palette" class="popup" popover="auto" role="dialog" aria-labelledby="heading">
        <div class="heading"><strong id="heading"></strong><span class="count"></span></div>
        <div class="grid" role="listbox"></div>
      </div>`;
    this.trigger = this.root.querySelector<HTMLButtonElement>('.trigger')!;
    this.popup = this.root.querySelector<HTMLDivElement>('.popup')!;
    this.grid = this.root.querySelector<HTMLDivElement>('.grid')!;
    this.trigger.addEventListener('click', () => this.isOpen ? this.close() : this.open());
    this.trigger.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); this.open(); }
    });
    this.popup.addEventListener('toggle', () => this.trigger.setAttribute('aria-expanded', String(this.isOpen)));
    this.grid.addEventListener('keydown', event => this.navigate(event));
  }
  connectedCallback() {
    this.listeners = new AbortController();
    const options = { signal: this.listeners.signal };
    window.addEventListener('resize', this.reposition, options);
    window.addEventListener('scroll', this.reposition, { ...options, capture: true });
    this.updateSelection();
  }
  disconnectedCallback() { this.close(); this.listeners?.abort(); }
  get value(): string { return this.selectedValue; }
  set value(value: string) {
    this.selectedValue = this.items.some(item => item.value === value) ? value : '';
    this.updateSelection();
  }
  set options(options: readonly ArtworkOption[]) {
    this.close(); this.items = options;
    if (!options.some(item => item.value === this.selectedValue)) this.selectedValue = options[0]?.value ?? '';
    this.buttons = options.map(item => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'option'; button.setAttribute('role', 'option');
      button.setAttribute('aria-label', item.label); button.title = item.label;
      const image = this.thumbnail(item); image.classList.add('thumbnail');
      const caption = document.createElement('span'); caption.className = 'caption'; caption.textContent = item.label;
      button.append(image, caption);
      button.addEventListener('click', () => {
        const changed = this.value !== item.value;
        this.value = item.value; this.close(true);
        if (changed) this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      });
      return button;
    });
    this.grid.replaceChildren(...this.buttons);
    this.updateSelection();
  }
  close(restoreFocus = false) {
    if (this.isOpen) this.popup.hidePopover();
    this.trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) this.trigger.focus({ preventScroll: true });
  }
  private get isOpen() { return this.popup.matches(':popover-open'); }
  private open() {
    if (!this.items.length || this.isOpen) return;
    this.popup.showPopover(); this.trigger.setAttribute('aria-expanded', 'true'); this.reposition();
    this.focusOption(Math.max(0, this.items.findIndex(item => item.value === this.value)));
  }
  private reposition = () => {
    if (!this.isOpen) return;
    const bounds = this.trigger.getBoundingClientRect();
    if (!this.trigger.getClientRects().length || bounds.bottom < 0 || bounds.top > innerHeight) { this.close(); return; }
    const gap = 8, margin = 12;
    const below = Math.max(0, innerHeight - bounds.bottom - gap - margin), above = Math.max(0, bounds.top - gap - margin);
    this.popup.style.maxHeight = `${Math.min(420, Math.max(below, above))}px`;
    const popup = this.popup.getBoundingClientRect();
    const placeBelow = below >= popup.height || below >= above;
    this.popup.style.left = `${Math.max(margin, Math.min(bounds.left, innerWidth - popup.width - margin))}px`;
    this.popup.style.top = `${Math.max(margin, placeBelow ? bounds.bottom + gap : bounds.top - popup.height - gap)}px`;
  };
  private updateSelection() {
    const selected = this.items.find(item => item.value === this.value), label = this.getAttribute('label') ?? 'Artwork';
    this.trigger.disabled = !this.items.length;
    this.trigger.setAttribute('aria-label', `${label}: ${selected?.label ?? 'Choose artwork'}`);
    this.trigger.title = selected?.label ?? label;
    this.root.querySelector('.label')!.textContent = selected?.label ?? 'Choose artwork';
    this.root.querySelector('.preview')!.replaceChildren(...(selected ? [this.thumbnail(selected)] : []));
    this.root.querySelector('#heading')!.textContent = `Choose ${label.toLowerCase()}`;
    this.grid.setAttribute('aria-label', label);
    this.root.querySelector('.count')!.textContent = `${this.items.length} options`;
    this.buttons.forEach((button, index) => {
      const active = this.items[index].value === this.value;
      button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
    });
  }
  private thumbnail(item: ArtworkOption): SVGSVGElement {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', item.thumbnail.viewBox); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    for (const layer of item.thumbnail.layers) {
      const image = document.createElementNS(SVG, 'image');
      image.setAttribute('href', layer.src); image.setAttribute('preserveAspectRatio', 'none');
      for (const key of ['x', 'y', 'width', 'height'] as const) image.setAttribute(key, String(layer[key]));
      svg.append(image);
    }
    return svg;
  }
  private focusOption(index: number) {
    this.buttons.forEach((button, i) => button.tabIndex = i === index ? 0 : -1);
    this.buttons[index]?.focus({ preventScroll: true });
    this.buttons[index]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  private navigate(event: KeyboardEvent) {
    const index = this.buttons.indexOf(this.root.activeElement as HTMLButtonElement);
    const columns = getComputedStyle(this.grid).gridTemplateColumns.split(' ').length;
    const delta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
    if (event.key === 'Tab') { this.close(true); return; }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(true); return; }
    let next = index;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = this.buttons.length - 1;
    else if (event.key in delta) next = Math.max(0, Math.min(this.buttons.length - 1, index + delta[event.key]));
    else return;
    event.preventDefault(); this.focusOption(next);
  }
}
customElements.define('artwork-picker', ArtworkPicker);
