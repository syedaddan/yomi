import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const source = resolve('out/audio');
const destination = resolve('public/audio');

if (!existsSync(source)) {
  throw new Error(`Audio source directory was not found: ${source}`);
}

mkdirSync(resolve('public'), { recursive: true });
rmSync(destination, { recursive: true, force: true });
cpSync(source, destination, { recursive: true });
console.log('Prepared audio assets for Vite.');
