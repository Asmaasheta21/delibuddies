import { build } from 'esbuild'; import { rm } from 'node:fs/promises';
await build({entryPoints:['tests/stage5.ts'],outfile:'.qa/stage5.mjs',bundle:true,platform:'node',format:'esm',packages:'external'});
try { await import('../.qa/stage5.mjs'); } finally { await rm('.qa/stage5.mjs',{force:true}); }
