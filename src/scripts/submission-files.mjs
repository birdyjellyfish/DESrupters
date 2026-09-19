import {readdir,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
export const roots=['README.md','WRITEUP.md','.env.example','.gitignore','.gitattributes',...['.dockerignore','Dockerfile','package.json','package-lock.json','next.config.mjs','postcss.config.mjs','tailwind.config.js','jest.config.cjs','compose.cloud.yml','docker-compose.data.yml','docker-compose.valhalla.yml','app','lib','scripts','tests','public','docs','deploy','data/README.md','data/spatial','data/fixtures'].map(entry=>`src/${entry}`)];
export async function submissionFiles(root=process.cwd()) {
  const base=await realpath(root),files=[];
  async function walk(relative) {
    if(relative==='src/public/vendor' || relative==='src/docs/REFERENCE-AUDIT.md')return;
    const name=path.basename(relative);
    if(name.startsWith('.env') && name!=='.env.example')throw new Error(`Private environment file in submission tree: ${relative}`);
    if(['node_modules','.local','.git'].includes(name) || name.startsWith('.next'))throw new Error(`Runtime directory in submission tree: ${relative}`);
    if(/\.(pem|key|p12|pfx)$/i.test(name))throw new Error(`Private key material in submission tree: ${relative}`);
    const absolute=path.resolve(base,relative),info=await lstat(absolute);
    if(info.isSymbolicLink())throw new Error(`Submission cannot include symlink: ${relative}`);
    const resolved=await realpath(absolute);
    if(!resolved.startsWith(base+path.sep))throw new Error(`Path escaped submission root: ${relative}`);
    if(info.isDirectory()){for(const name of await readdir(absolute))await walk(`${relative}/${name}`);}
    else if(info.isFile())files.push(relative);
  }
  for(const entry of roots)await walk(entry);
  return files.sort();
}
