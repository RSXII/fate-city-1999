import { readFileSync, writeFileSync } from 'fs';

const swPath = 'build/sw.js';
const ts = Date.now().toString();
const src = readFileSync(swPath, 'utf-8');
writeFileSync(swPath, src.replace('__BUILD_TS__', ts));
console.log(`✓ sw.js stamped → wire-${ts}`);
