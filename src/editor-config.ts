import { LEVEL_CONFIG } from './level-config.js';
import type { LevelConfig, PadConfig, StructureConfig } from './level-config.js';
import { createLevel, levelAssetNames } from './levels.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from './world.js';

export interface PlatformAsset { key: string; label: string; level: LevelConfig; pad: PadConfig }
export const PLATFORM_ASSETS: PlatformAsset[] = LEVEL_CONFIG.flatMap(level => level.pads.map(pad => ({
  key: `${level.number}:${pad.id}`, label: `${level.name} · ${pad.name}`, level, pad
})));
export const BARRIER_ASSETS = LEVEL_CONFIG.flatMap(level => (level.structures ?? []).map(structure => ({
  key: `${level.number}:${structure.id}`, label: `${level.name} · ${structure.kind}`, level, structure
})));
const source = (level: LevelConfig, name: string) => level.assets?.[name] ?? `${name}-${level.number}`;
const assetKeys = (id: number) => [`pad-${id}`, `pad-${id}-active`, `island-${id}`, `building-${id}`];
const clone = <T>(value: T): T => structuredClone(value);

export class EditorDraft {
  config: LevelConfig;
  readonly isNew: boolean;
  private fuel?: { level: LevelConfig; pad: PadConfig };
  constructor(config?: LevelConfig, number = Math.max(...LEVEL_CONFIG.map(level => level.number)) + 1) {
    this.isNew = !config;
    this.config = config ? clone(config) : {
      number, id: `custom-${number}`, name: `Custom level ${number}`, theme: 'A new delivery route.',
      gravity: 100, thrustScale: 1, start: { x: 640, y: 80 }, restaurant: 0, gasStation: null,
      fallingObstacleLimit: 0, seekerCount: 0, structures: [], pads: [],
      assets: { background: 'background-1', saucer: 'saucer-1', effects: 'effects-1' }
    };
    const pad = config?.pads.find(pad => pad.id === config.gasStation);
    if (config && pad) this.fuel = { level: clone(config), pad: clone(pad) };
  }
  get minimumPlatforms(): number { return this.isNew ? 0 : this.config.gasStation === null ? 2 : 3; }
  private nextId(): number {
    let id = 0;
    while (this.config.pads.some(pad => pad.id === id) || id === this.config.restaurant) id++;
    return id;
  }
  private mapPlatform(level: LevelConfig, pad: PadConfig, id: number) {
    const assets = this.config.assets ??= {};
    assets[`pad-${id}`] = source(level, `pad-${pad.id}`);
    assets[`pad-${id}-active`] = source(level, `pad-${pad.id}-active`);
    if (pad.island) assets[`island-${id}`] = source(level, `island-${pad.id}`);
    assets[`building-${id}`] = source(level, level.assets?.[`building-${pad.id}`] ? `building-${pad.id}` : pad.building.kind);
  }
  addPlatform(asset = PLATFORM_ASSETS.find(asset => asset.level.number === 1 && asset.pad.id === 0)!): PadConfig {
    const config = this.config;
    const id = config.pads.some(pad => pad.id === config.restaurant) ? this.nextId() : config.restaurant;
    const pad = clone(asset.pad);
    pad.id = id;
    // Newly placed stations start stationary; existing stations retain their motion.
    delete pad.motion;
    const index = config.pads.length;
    pad.x = 140 + index % 4 * 280; pad.y = 260 + Math.floor(index / 4) % 3 * 160;
    this.mapPlatform(asset.level, asset.pad, id);
    config.pads.push(pad); this.movePlatform(id, pad.x, pad.y);
    return pad;
  }
  removePlatform(id: number): boolean {
    const config = this.config;
    const pad = config.pads.find(pad => pad.id === id);
    if (!pad) return false;
    if (!this.isNew && (id === config.restaurant || id === config.gasStation || config.pads.length <= this.minimumPlatforms)) return false;
    config.pads = config.pads.filter(pad => pad.id !== id);
    if (id === config.gasStation) config.gasStation = null;
    if (id === config.restaurant) config.restaurant = config.pads.find(pad => pad.id !== config.gasStation)?.id ?? 0;
    for (const key of assetKeys(id)) delete config.assets?.[key];
    return true;
  }
  setPlatformCount(count: number) {
    if (!Number.isInteger(count) || count < this.minimumPlatforms || count > 30) throw new Error(`Choose ${this.minimumPlatforms}–30 platforms.`);
    while (this.config.pads.length > count) {
      const removable = [...this.config.pads].reverse().find(pad => this.isNew || (pad.id !== this.config.restaurant && pad.id !== this.config.gasStation));
      if (!removable || !this.removePlatform(removable.id)) break;
    }
    const original = LEVEL_CONFIG.find(level => level.id === this.config.id);
    const template = PLATFORM_ASSETS.find(asset => asset.level === original && asset.pad.id !== original.restaurant && asset.pad.id !== original.gasStation)
      ?? PLATFORM_ASSETS.find(asset => asset.level.number === 1 && asset.pad.id === 1)!;
    while (this.config.pads.length < count) this.addPlatform(this.config.pads.length ? template : undefined);
  }
  setFuel(enabled: boolean) {
    const config = this.config;
    if (enabled === (config.gasStation !== null)) return;
    if (!enabled) {
      const pad = config.pads.find(pad => pad.id === config.gasStation)!;
      this.fuel = { level: clone(config), pad: clone(pad) };
      config.pads = config.pads.filter(candidate => candidate.id !== pad.id);
      for (const key of assetKeys(pad.id)) delete config.assets?.[key];
      config.gasStation = null;
    } else {
      if (config.pads.length >= 30) throw new Error('Remove a platform before adding a fuel station (30 maximum).');
      const template = this.fuel ?? PLATFORM_ASSETS.find(asset => asset.level.number === 1 && asset.pad.id === 6)!;
      const pad = clone(template.pad);
      if (config.pads.some(candidate => candidate.id === pad.id) || pad.id === config.restaurant) pad.id = this.nextId();
      this.mapPlatform(template.level, template.pad, pad.id);
      config.pads.push(pad); config.gasStation = pad.id;
    }
  }
  movePlatform(id: number, x: number, y: number) {
    if (![x, y].every(Number.isFinite)) throw new Error('Positions must be finite numbers.');
    const pad = this.config.pads.find(pad => pad.id === id)!;
    const left = Math.min(0, pad.island?.x ?? 0, pad.building.x);
    const right = Math.max(pad.width, (pad.island?.x ?? 0) + (pad.island?.width ?? 0), pad.building.x + pad.building.width);
    pad.x = Math.round(Math.max(-left, Math.min(WORLD_WIDTH - right, x)));
    pad.y = Math.round(Math.max(pad.building.height + 12, Math.min(WORLD_HEIGHT - (pad.island ? 93 : 70), y)));
  }
  addBarrier(key: string): StructureConfig {
    if (!this.isNew) throw new Error('Barriers can only be added to new levels.');
    const asset = BARRIER_ASSETS.find(asset => asset.key === key)!;
    const structure = clone(asset.structure);
    let suffix = 1;
    while (this.config.structures?.some(candidate => candidate.id === `barrier-${suffix}`)) suffix++;
    structure.id = `barrier-${suffix}`;
    (this.config.structures ??= []).push(structure);
    (this.config.assets ??= {})[structure.kind] = source(asset.level, structure.kind);
    return structure;
  }
  moveBarrier(id: string, x: number, y: number) {
    if (!this.isNew) throw new Error('Barriers can only be moved in new levels.');
    if (![x, y].every(Number.isFinite)) throw new Error('Positions must be finite numbers.');
    const structure = this.config.structures!.find(structure => structure.id === id)!;
    structure.x = Math.round(Math.max(0, Math.min(WORLD_WIDTH - structure.width, x)));
    structure.y = Math.round(Math.max(0, Math.min(WORLD_HEIGHT - structure.height, y)));
  }
  setBackground(number: number) {
    if (!this.isNew) throw new Error('Backgrounds can only be changed in new levels.');
    const level = LEVEL_CONFIG.find(level => level.number === number)!;
    // Choose scenery only; physics and hazards remain explicit editor choices.
    (this.config.assets ??= {}).background = source(level, 'background');
  }
  preview() { return createLevel(clone(this.config), { editing: true }); }
  exportJavaScript(): string {
    createLevel(this.config);
    // Export only currently required assets, removing stale slots from deleted objects/hazards.
    const config = clone(this.config), level = createLevel(config);
    if (config.assets) {
      const required = new Set(levelAssetNames(level));
      for (const key of Object.keys(config.assets)) if (!required.has(key)) delete config.assets[key];
    }
    return `${JSON.stringify(config, null, 2)},`;
  }
}
