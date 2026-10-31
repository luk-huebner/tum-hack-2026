import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { request } from 'node:https';
import { Socket } from 'node:net';

test('offline preload denies dotenv reads before opening any file', () => {
  assert.throws(() => readFileSync(new URL('../.env', import.meta.url)), /prohibit reading environment files/);
});
test('offline preload denies fetch, HTTPS and direct sockets before connection', () => {
  assert.throws(() => fetch('https://example.invalid'), /prohibit network access/);
  assert.throws(() => request('https://example.invalid'), /prohibit network access/);
  const socket = new Socket();
  try { assert.throws(() => socket.connect(1, '127.0.0.1'), /prohibit network access/); }
  finally { socket.destroy(); }
});
