import { build } from 'esbuild'; import { readFile } from 'node:fs/promises';
const out=await build({entryPoints:['tests/stage7.ts'],bundle:true,platform:'node',format:'esm',write:false,external:['three']}); const source=new TextDecoder().decode(out.outputFiles[0].contents); const url='data:text/javascript;base64,'+Buffer.from(source).toString('base64'); await import(url);
