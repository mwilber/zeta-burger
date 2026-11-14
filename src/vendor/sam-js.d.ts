// The browser ESM build of sam-js is copied here by scripts/build.mjs.
export interface SamVoice { speed: number; pitch: number; throat: number; mouth: number }
export default class SamJs {
  constructor(options: SamVoice);
  buf32(text: string): Float32Array | false;
}
