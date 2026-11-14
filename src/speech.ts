import SamJs from './vendor/sam-js.js';
import type { SamVoice } from './vendor/sam-js.js';
export const DISPATCH_VOICE: SamVoice = { speed: 64, pitch: 94, throat: 158, mouth: 185 };
// Delivery presets from https://discordier.github.io/sam/ (speed, pitch, throat, mouth).
export const THANKS_VOICES: readonly SamVoice[] = [
  { speed: 72, pitch: 64, throat: 128, mouth: 128 }, // SAM
  { speed: 72, pitch: 64, throat: 110, mouth: 160 }, // Elf
  { speed: 92, pitch: 60, throat: 190, mouth: 190 }, // Little Robot
  { speed: 82, pitch: 32, throat: 145, mouth: 145 }, // Little Old Lady
  { speed: 100, pitch: 64, throat: 150, mouth: 200 } // Extra-Terrestrial
];
export const SPEECH_SAMPLE_RATE = 22050;
export function synthesizeSpeech(text: string, voice: SamVoice): Float32Array | false {
  return new SamJs(voice).buf32(text);
}
