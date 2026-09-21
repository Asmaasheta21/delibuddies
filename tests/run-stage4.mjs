import { build } from 'esbuild';
import { mkdir, rm } from 'node:fs/promises';
await mkdir('.qa', { recursive: true });
await build({entryPoints:['tests/stage4.ts'],outfile:'.qa/stage4.mjs',bundle:true,platform:'node',format:'esm',packages:'external'});
try { await import('../.qa/stage4.mjs'); } finally { await rm('.qa/stage4.mjs', {force:true}); }
