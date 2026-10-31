// Preloaded before tests. Nothing here loads credentials or enables application services.
import fs from 'node:fs';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';

const read = fs.readFileSync;
fs.readFileSync = function (path: any, ...args: any[]) {
  const name = path instanceof URL ? fileURLToPath(path) : String(path);
  if (/(?:^|[\\/])\.env(?:\.[^\\/]*)?$/i.test(name)) {
    // engine.ts imports dotenv.config(); dotenv catches this without opening the file.
    throw new Error('Offline tests prohibit reading environment files');
  }
  return (read as any).call(fs, path, ...args);
} as typeof fs.readFileSync;
const denied = () => { throw new Error('Offline tests prohibit network access'); };
globalThis.fetch = denied as typeof fetch;
net.Socket.prototype.connect = denied as any;
http.request = denied as any;
http.get = denied as any;
https.request = denied as any;
https.get = denied as any;
syncBuiltinESMExports();
