import { build } from 'esbuild'; import { rm } from 'node:fs/promises';
await build({entryPoints:['tests/stage6.ts'],outfile:'.qa/stage6.mjs',bundle:true,platform:'node',format:'esm',packages:'external'});
try { await import('../.qa/stage6.mjs'); } finally { await rm('.qa/stage6.mjs',{force:true}); }
