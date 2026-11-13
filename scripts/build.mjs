import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export const root = fileURLToPath(new URL('../', import.meta.url));
export async function copyPublic() {
  await mkdir(path.join(root, 'dist'), { recursive: true });
  await cp(path.join(root, 'public'), path.join(root, 'dist'), { recursive: true });
  const vendor = path.join(root, 'dist/src/vendor');
  await mkdir(vendor, { recursive: true });
  await cp(path.join(root, 'node_modules/sam-js/dist/samjs.esm.min.js'), path.join(vendor, 'sam-js.js'));
  await cp(path.join(root, 'node_modules/sam-js/README.md'), path.join(vendor, 'sam-js-README.md'));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { await copyPublic(); console.log('Built Zeta Burger → dist/'); }
