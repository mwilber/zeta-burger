import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export const root = fileURLToPath(new URL('../', import.meta.url));
export async function copyPublic() {
  await mkdir(path.join(root, 'dist'), { recursive: true });
  await cp(path.join(root, 'public'), path.join(root, 'dist'), { recursive: true });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { await copyPublic(); console.log('Built Zeta Burger → dist/'); }
