import {readFile,readdir,access,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {submissionFiles} from './submission-files.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)).replace(/[\\/]$/,'');
process.chdir(root);
const files=await submissionFiles(root),findings=[],secrets=[];
for(const file of ['src/.env','src/.env.cloud','src/.local/push-keys.json']) {
  try {
    const text=await readFile(file,'utf8');
    if(file.endsWith('.json')){const key=JSON.parse(text).privateKey;if(key)secrets.push(key);}
    else for(const line of text.split(/\r?\n/)){const match=line.match(/^(LTA_ACCOUNT_KEY|ONEMAP_KEY|ONEMAP_API_KEY|ONEMAP_ACCESS_TOKEN|VAPID_PRIVATE_KEY)=(.+)$/);if(match && match[2].length>15)secrets.push(match[2].replace(/^['"]|['"]$/g,''));}
  }catch{}
}
const textual=f=>/\.(?:md|mjs|cjs|js|jsx|json|css|yml|yaml|ps1|sh|example|env|pem|key|txt|toml)$/.test(f)||path.basename(f).startsWith('.env')||['Dockerfile','Caddyfile','.gitignore','.dockerignore'].includes(path.basename(f));
function scan(text,label) {
  if(secrets.some(s=>text.includes(s)))findings.push(`${label}: contains a configured private credential (value redacted)`);
  if(/\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/.test(text))findings.push(`${label}: JWT-like credential; review required (redacted)`);
  if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))findings.push(`${label}: private-key material`);
}
let imports=0;
async function exactFile(target) {
  try {
    await access(target);
    let current=root;
    for(const part of path.relative(root,target).split(path.sep)){if(!(await readdir(current)).includes(part))return false;current=path.join(current,part);}
    return true;
  }catch{return false;}
}
for(const file of files.filter(textual)) {
  const text=await readFile(file,'utf8');scan(text,file);
  if(/^src\/(app|lib|scripts)\//.test(file) && /[A-Z]:[\\/]Users[\\/]/i.test(text))findings.push(`${file}: machine-specific user path`);
  if(file.endsWith('.example'))for(const line of text.split(/\r?\n/))if(/^\w+=.+/.test(line))findings.push(`${file}: example variable has a value; submission requires names only`);
  if(/\.(?:mjs|cjs|js|jsx)$/.test(file))for(const match of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"](\.[^'"]+)['"]/g)) {
    imports++;const base=path.resolve(path.dirname(path.join(root,file)),match[1]);
    if(!base.startsWith(root+path.sep)){findings.push(`${file}: relative import escapes repository`);continue;}
    const candidates=[base,...['.js','.jsx','.mjs','.json','.css','/index.js','/index.jsx'].map(ext=>base+ext)];
    if(!(await Promise.all(candidates.map(exactFile))).some(Boolean))findings.push(`${file}: unresolved or incorrectly cased import ${match[1]}`);
  }
  if(file.startsWith('src/app/components/') && /from\s*['"][^'"]*lib\/server\//.test(text))findings.push(`${file}: client component imports server-only code`);
}
const manifest=JSON.parse(await readFile('src/public/manifest.json','utf8'));
for(const icon of manifest.icons || [])if(!files.includes(`src/public${icon.src}`))findings.push(`src/public/manifest.json: missing icon ${icon.src}`);
let historyBlobs=0;
try {
  const objects=execFileSync('git',['rev-list','--objects','--all'],{encoding:'utf8',maxBuffer:20*1024*1024}).split('\n');
  for(const object of objects){const [sha,...parts]=object.split(' '),name=parts.join(' ');if(!name || !textual(name))continue;
    const size=Number(execFileSync('git',['cat-file','-s',sha],{encoding:'utf8'}));if(size>10*1024*1024)continue;
    const content=execFileSync('git',['cat-file','blob',sha],{encoding:'utf8',maxBuffer:12*1024*1024});scan(content,`history ${sha.slice(0,10)} ${name}`);historyBlobs++;
  }
}catch{findings.push('Git history scan unavailable; rerun from the original repository.');}
const report=`# Reference and credential audit\n\nChecked ${new Date().toISOString()}.\n\n- ${files.length} allowed submission files; ${imports} relative imports checked for existence and Linux-compatible casing.\n- ${historyBlobs} textual Git-history blobs checked for configured private credentials, JWT-like tokens and private keys. Binary and text blobs larger than 10 MB are outside the credential scan.\n- Source audit rejects symlinks and excludes private/runtime/build paths.\n- Environment templates and manifest asset references checked.\n\n${findings.length?'## Findings\n\n'+[...new Set(findings)].map(x=>'- '+x).join('\n'):'No findings in these checks.'}\n\nThis is a targeted path/credential audit, not a guarantee of complete application security. Live provider tokens must remain in private environment files.\n`;
await writeFile('src/docs/REFERENCE-AUDIT.md',report);
console.log(report);if(findings.length)process.exitCode=1;
