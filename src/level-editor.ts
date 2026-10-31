import { LEVEL_CONFIG } from './level-config.js';
import { createLevel } from './levels.js';
import type { Level } from './levels.js';
import { EditorDraft, PLATFORM_ASSETS } from './editor-config.js';
import { ArtworkPicker } from './artwork-picker.js';
import { BACKGROUND_ARTWORK, PLATFORM_ARTWORK, BARRIER_ARTWORK } from './artwork-options.js';

const get = <T extends HTMLElement>(id: string) => document.getElementById(`editor-${id}`) as T;
interface EditorCallbacks {
  preview(level: Level): Promise<boolean>;
  select(id: string, name: string, number: number): void;
  close(): void;
}
export class LevelEditor {
  active = false;
  readonly drafts = new Map<string, EditorDraft>();
  private draft!: EditorDraft;
  private selected = '';
  private drag?: { pointer: number; key: string; dx: number; dy: number };
  private version = 0;
  private toolbar = get('toolbar');
  private picker = get<HTMLSelectElement>('level');
  private selection = get<HTMLSelectElement>('selection');
  private exportDialog = get<HTMLDialogElement>('export-dialog');
  private button = document.getElementById('editor')!;
  constructor(private stage: SVGSVGElement, private callbacks: EditorCallbacks) {
    for (const level of LEVEL_CONFIG) this.picker.add(new Option(`${level.number} · ${level.name}`, level.id));
    get<ArtworkPicker>('background').options = BACKGROUND_ARTWORK;
    get<ArtworkPicker>('platform-asset').options = PLATFORM_ARTWORK;
    get<ArtworkPicker>('platform-asset').value = '1:0';
    get<ArtworkPicker>('barrier-asset').options = BARRIER_ARTWORK;
    this.picker.addEventListener('change', () => this.open(this.picker.value));
    get('new').addEventListener('click', () => {
      const number = Math.max(...LEVEL_CONFIG.map(level => level.number), ...Array.from(this.drafts.values(), draft => draft.config.number)) + 1;
      const draft = new EditorDraft(undefined, number);
      this.drafts.set(draft.config.id, draft);
      this.picker.add(new Option(`${number} · ${draft.config.name}`, draft.config.id));
      this.open(draft.config.id);
    });
    get('done').addEventListener('click', () => this.close());
    get('count').addEventListener('change', () => this.change(() => this.draft.setPlatformCount(get<HTMLInputElement>('count').valueAsNumber)));
    get('fuel').addEventListener('change', () => this.change(() => this.draft.setFuel(get<HTMLInputElement>('fuel').checked)));
    get('name').addEventListener('change', () => this.change(() => {
      this.draft.config.name = get<HTMLInputElement>('name').value.trim() || `Custom level ${this.draft.config.number}`;
      this.picker.selectedOptions[0].textContent = `${this.draft.config.number} · ${this.draft.config.name}`;
    }));
    get('background').addEventListener('change', () => this.change(() => this.draft.setBackground(Number(get<ArtworkPicker>('background').value))));
    for (const [id, field] of [['gravity', 'gravity'], ['thrust', 'thrustScale']] as const) {
      get(id).addEventListener('change', () => this.change(() => {
        const input = get<HTMLInputElement>(id);
        if (!input.validity.valid || !Number.isFinite(input.valueAsNumber)) throw new Error('Enter a valid nonnegative value.');
        this.draft.config[field] = input.valueAsNumber;
      }));
    }
    get('platform-asset').addEventListener('artwork-pick', () => this.change(() => {
      if (this.draft.config.pads.length >= 30) throw new Error('Use at most 30 platforms.');
      const asset = PLATFORM_ASSETS.find(asset => asset.key === get<ArtworkPicker>('platform-asset').value)!;
      this.selected = `pad:${this.draft.addPlatform(asset).id}`;
    }));
    get('barrier-asset').addEventListener('artwork-pick', () => this.change(() => {
      this.selected = `structure:${this.draft.addBarrier(get<ArtworkPicker>('barrier-asset').value).id}`;
    }));
    get('meteors').addEventListener('change', () => this.change(() => {
      this.draft.config.fallingObstacleLimit = get<HTMLInputElement>('meteors').checked ? 4 : 0;
      (this.draft.config.assets ??= {})['falling-obstacle'] = 'falling-obstacle-2';
    }));
    get('black-hole').addEventListener('change', () => this.change(() => {
      if (get<HTMLInputElement>('black-hole').checked) {
        this.draft.config.blackHole = structuredClone(LEVEL_CONFIG.find(level => level.blackHole)!.blackHole);
        (this.draft.config.assets ??= {})['black-hole'] = 'black-hole-6';
      } else delete this.draft.config.blackHole;
    }));
    get('seekers').addEventListener('change', () => this.change(() => {
      const number = Number(get<HTMLSelectElement>('seekers').value);
      this.draft.config.seekerCount = number ? 4 : 0;
      if (number) (this.draft.config.assets ??= {}).seeker = `seeker-${number}`;
    }));
    get('current').addEventListener('change', () => this.change(() => {
      if (get<HTMLInputElement>('current').checked) this.draft.config.current = structuredClone(LEVEL_CONFIG.find(level => level.current)!.current);
      else delete this.draft.config.current;
    }));
    this.selection.addEventListener('change', () => { this.selected = this.selection.value; this.refreshSelection(); });
    for (const axis of ['x', 'y'] as const) get(axis).addEventListener('change', () => this.change(() => {
      const position = this.position();
      if (!position) return;
      this.move(this.selected, axis === 'x' ? get<HTMLInputElement>('x').valueAsNumber : position.x,
        axis === 'y' ? get<HTMLInputElement>('y').valueAsNumber : position.y);
    }));
    get('remove').addEventListener('click', () => this.change(() => {
      if (this.selected.startsWith('pad:')) {
        if (!this.draft.removePlatform(Number(this.selected.slice(4)))) throw new Error('Keep the restaurant and at least one delivery platform. Toggle Fuel station to remove it.');
      } else if (this.draft.isNew) this.draft.config.structures = this.draft.config.structures?.filter(structure => `structure:${structure.id}` !== this.selected);
      this.selected = '';
    }));
    get('export').addEventListener('click', () => {
      try {
        get<HTMLTextAreaElement>('code').value = this.draft.exportJavaScript();
        get('export-instructions').textContent = this.draft.isNew
          ? 'Prepend this object inside LEVEL_CONFIG in src/level-config.ts. Existing artwork is referenced in assets; no new SVG files are needed.'
          : `Replace the existing ${this.draft.config.name} object in LEVEL_CONFIG in src/level-config.ts. Keep its number, ID, and array position.`;
        get('copy-status').textContent = '';
        this.exportDialog.showModal();
      } catch (error) { this.error(error); }
    });
    get('export-close').addEventListener('click', () => this.exportDialog.close());
    get('copy').addEventListener('click', () => { void this.copyExport(); });
    this.stage.addEventListener('pointerdown', event => this.pointerDown(event));
    this.stage.addEventListener('pointermove', event => {
      if (!this.drag || event.pointerId !== this.drag.pointer) return;
      const point = this.point(event);
      if (!point) return;
      this.move(this.drag.key, point.x - this.drag.dx, point.y - this.drag.dy);
      this.refreshSelection(); void this.preview();
    });
    const release = (event: PointerEvent) => {
      if (this.drag?.pointer !== event.pointerId) return;
      this.drag = undefined; this.stage.classList.remove('dragging');
      if (this.stage.hasPointerCapture(event.pointerId)) this.stage.releasePointerCapture(event.pointerId);
    };
    this.stage.addEventListener('pointerup', release);
    this.stage.addEventListener('pointercancel', release);
    this.stage.addEventListener('lostpointercapture', release);
  }
  open(id: string) {
    let draft = this.drafts.get(id);
    if (!draft) {
      const config = LEVEL_CONFIG.find(level => level.id === id);
      if (!config) return;
      draft = new EditorDraft(config); this.drafts.set(id, draft);
    }
    this.closeArtworkPickers();
    this.draft = draft; this.active = true; this.selected = '';
    this.picker.value = id; this.toolbar.hidden = false;
    this.button.setAttribute('aria-expanded', 'true');
    document.body.classList.add('editor-active'); this.stage.classList.add('editing');
    get('status').textContent = '';
    this.refresh(); void this.preview();
  }
  private closeArtworkPickers() {
    for (const picker of this.toolbar.querySelectorAll<ArtworkPicker>('artwork-picker')) picker.close();
  }
  close() {
    this.closeArtworkPickers();
    this.active = false; this.version++; this.drag = undefined;
    this.toolbar.hidden = true; this.button.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('editor-active'); this.stage.classList.remove('editing', 'dragging');
    this.callbacks.close();
  }
  levelForPlay(id: string): Level | undefined {
    const draft = this.drafts.get(id);
    return draft ? createLevel(structuredClone(draft.config)) : undefined;
  }
  private change(action: () => void) {
    try { action(); get('status').textContent = ''; this.refresh(); void this.preview(); }
    catch (error) { this.refresh(); this.error(error); }
  }
  private error(error: unknown) {
    get('status').textContent = error instanceof Error ? error.message : 'The level could not be updated.';
  }
  private refresh() {
    const config = this.draft.config;
    get<HTMLInputElement>('count').value = String(config.pads.length);
    get<HTMLInputElement>('count').min = String(this.draft.minimumPlatforms);
    get<HTMLInputElement>('fuel').checked = config.gasStation !== null;
    get('new-options').hidden = !this.draft.isNew;
    get<HTMLInputElement>('name').value = config.name;
    get<ArtworkPicker>('background').value = config.assets?.background?.match(/-(\d+)$/)?.[1] ?? '1';
    get<HTMLInputElement>('gravity').value = String(config.gravity);
    get<HTMLInputElement>('thrust').value = String(config.thrustScale ?? 1);
    get<HTMLInputElement>('meteors').checked = config.fallingObstacleLimit > 0;
    get<HTMLInputElement>('black-hole').checked = !!config.blackHole;
    get<HTMLSelectElement>('seekers').value = config.seekerCount ? config.assets?.seeker?.match(/-(\d+)$/)?.[1] ?? '3' : '0';
    get<HTMLInputElement>('current').checked = !!config.current;
    this.selection.replaceChildren(new Option('Choose a platform or barrier', ''));
    for (const pad of config.pads) this.selection.add(new Option(`Pad ${pad.id} · ${pad.id === config.restaurant ? 'Restaurant' : pad.id === config.gasStation ? 'Fuel station' : pad.name}`, `pad:${pad.id}`));
    if (this.draft.isNew) for (const structure of config.structures ?? []) this.selection.add(new Option(`Barrier · ${structure.kind} (${structure.id})`, `structure:${structure.id}`));
    this.selection.value = this.selected;
    if (!this.selection.value) this.selected = '';
    this.refreshSelection();
    this.callbacks.select(config.id, config.name, config.number);
  }
  private position() {
    if (this.selected.startsWith('pad:')) return this.draft.config.pads.find(pad => pad.id === Number(this.selected.slice(4)));
    return this.draft.config.structures?.find(structure => `structure:${structure.id}` === this.selected);
  }
  private refreshSelection() {
    const position = this.position();
    this.selection.value = this.selected;
    for (const axis of ['x', 'y'] as const) {
      const input = get<HTMLInputElement>(axis); input.disabled = !position;
      input.value = position ? String(position[axis]) : '';
    }
    const config = this.draft.config;
    get<HTMLButtonElement>('remove').disabled = !position || (!this.draft.isNew && (!this.selected.startsWith('pad:')
      || Number(this.selected.slice(4)) === config.restaurant || Number(this.selected.slice(4)) === config.gasStation
      || config.pads.length <= this.draft.minimumPlatforms));
    for (const node of this.stage.querySelectorAll('[data-editor-selected]')) node.removeAttribute('data-editor-selected');
    if (position) {
      const selector = this.selected.startsWith('pad:') ? `[data-editor-pad="${this.selected.slice(4)}"]` : `[data-structure="${this.selected.slice(10)}"]`;
      this.stage.querySelector(selector)?.setAttribute('data-editor-selected', '');
    }
  }
  private async preview() {
    const version = ++this.version;
    try {
      const loaded = await this.callbacks.preview(this.draft.preview());
      if (version !== this.version || !this.active) return;
      if (!loaded) throw new Error('Artwork could not load. Your draft is still available; try changing the level again.');
      this.refreshSelection();
    } catch (error) { if (version === this.version && this.active) this.error(error); }
  }
  private point(event: PointerEvent) {
    const matrix = this.stage.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : undefined;
  }
  private pointerDown(event: PointerEvent) {
    if (!this.active || event.button !== 0 || this.drag) return;
    const element = event.target instanceof Element ? event.target.closest('[data-editor-pad], [data-structure]') : null;
    if (!element) return;
    const pad = element.getAttribute('data-editor-pad'), structure = element.getAttribute('data-structure');
    if (pad === null && !this.draft.isNew) return;
    this.selected = pad !== null ? `pad:${pad}` : `structure:${structure}`;
    const position = this.position(), point = this.point(event);
    if (!position || !point) return;
    event.preventDefault(); this.stage.setPointerCapture(event.pointerId);
    this.drag = { pointer: event.pointerId, key: this.selected, dx: point.x - position.x, dy: point.y - position.y };
    this.stage.classList.add('dragging'); this.refreshSelection();
  }
  private move(key: string, x: number, y: number) {
    if (key.startsWith('pad:')) this.draft.movePlatform(Number(key.slice(4)), x, y);
    else this.draft.moveBarrier(key.slice(10), x, y);
  }
  private async copyExport() {
    const code = get<HTMLTextAreaElement>('code');
    try { await navigator.clipboard.writeText(code.value); get('copy-status').textContent = 'Copied.'; }
    catch { code.focus(); code.select(); get('copy-status').textContent = 'Text selected. Press Ctrl+C or ⌘C to copy.'; }
  }
}
