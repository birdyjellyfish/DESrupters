import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),mode=process.argv[2];
if(!['dev','start'].includes(mode))throw new Error('Choose dev or start.');
try{process.loadEnvFile('.env');}catch(e){if(e.code!=='ENOENT')throw e;}
const server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),mode,'--hostname','127.0.0.1',...process.argv.slice(3)],{stdio:'inherit',windowsHide:true});
const monitor=spawn(process.execPath,['scripts/monitor-commutes.mjs'],{stdio:'inherit',windowsHide:true});
let stopping=false;
function stop(){if(stopping)return;stopping=true;server.kill();monitor.kill();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
server.on('exit',code=>{stop();process.exitCode=code || 0;});
server.on('error',()=>{stop();process.exitCode=1;});
monitor.on('error',()=>console.error('Background commute monitor could not start.'));
