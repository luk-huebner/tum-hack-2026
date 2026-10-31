import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inputHash, resultHash, makeMps, masumiRoutes, USDM, type MasumiDeps, type Mps, type Outcome } from '../src/masumi-agent.js';

const M = 60_000;
const NOW = 1_800_000_000_000;
const POLICY = `${'a'.repeat(64)}#0`;
const NONCE = '0123456789abcdef';
const registration = { agentIdentifier: 'synthetic-agent', sellerVKey: 'synthetic-public-id', supportedPaymentSourceIndex: 0 };
const digest = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

// Call the real Express route handlers in memory: no listening sockets, HTTP clients,
// MPS instance, registrations, keys, payment payload signatures, or chain access.
// Express's JSON middleware / HTTP transport are intentionally outside this harness.
async function request(agent: ReturnType<typeof masumiRoutes>, method: 'get' | 'post', path: string, body: unknown = {}, query: Record<string, unknown> = {}) {
  const layer = (agent.router as any).stack.find((x: any) => x.route?.path === path && x.route.methods[method]);
  assert.ok(layer, `registered ${method} ${path}`);
  let status = 200;
  let result: any;
  const response = { status(code: number) { status = code; return this; }, json(value: unknown) { result = value; return this; } };
  await layer.route.stack[0].handle({ body, query }, response);
  assert.notEqual(result, undefined, 'handler answered');
  return { status, body: result };
}
const start = (agent: ReturnType<typeof masumiRoutes>, nonce = NONCE, policy = POLICY) => request(agent, 'post', '/start_job', { identifier_from_purchaser: nonce, input_data: { policy } });
const status = (agent: ReturnType<typeof masumiRoutes>, id: string) => request(agent, 'get', '/status', {}, { job_id: id });
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
async function until(predicate: () => boolean | Promise<boolean>) {
  const stop = Date.now() + 2000;
  while (Date.now() < stop) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail('in-memory job did not reach expected state within 2 seconds');
}
function fixture(patch: Partial<MasumiDeps> = {}) {
  let clock = NOW;
  let state = 'WaitingForExternalAction';
  let confirmation = true;
  let result: string | undefined;
  let outcome: Outcome = { state: 'open' };
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  const mps: Mps = async (path, body) => {
    calls.push({ path, body });
    if (path === '/payment') return { blockchainIdentifier: `synthetic-${calls.filter((c) => c.path === '/payment').length}` };
    if (path === '/payment/submit-result') { result = String(body.submitResultHash); state = 'ResultSubmitted'; return {}; }
    if (path === '/payment/resolve-blockchain-identifier') return {
      onChainState: state, resultHash: result,
      CurrentTransaction: { status: confirmation ? 'Confirmed' : 'Pending', newOnChainState: state }, TransactionHistory: [],
    };
    throw new Error('unexpected injected path');
  };
  const agent = masumiRoutes({ mps, registration, now: () => clock, pollMs: 5,
    checkPolicy: async () => ({ ok: true, deadlineMs: NOW + 2 * 60 * M, rule: 'synthetic rule' }),
    outcomeOf: async () => outcome, ...patch });
  return { agent, calls, clock: (value: number) => { clock = value; }, state: (value: string) => { state = value; },
    confirm: (value: boolean) => { confirmation = value; }, outcome: (value: Outcome) => { outcome = value; } };
}

test('inputHash/resultHash preserve UTF-8, nonce ordering, canonical policy projection and empty values', () => {
  for (const nonce of ['', NONCE, '☃;é']) for (const policy of ['', POLICY, '👩🏽‍💻']) {
    assert.equal(inputHash({ policy }, nonce), digest(`${nonce};${JSON.stringify({ policy })}`));
    assert.equal(resultHash(policy, nonce), digest(`${nonce};${policy}`));
    assert.equal(inputHash({ policy, ignored: 'extra' } as any, nonce), inputHash({ policy }, nonce));
  }
  assert.notEqual(resultHash('x', 'a'), resultHash('x', 'b'));
  assert.notEqual(inputHash({ policy: 'x' }, NONCE), inputHash({ policy: 'y' }, NONCE));
});
test('makeMps uses injected fetch only, normalizes URL, serializes body and rejects bad answers', async () => {
  const seen: any[] = [];
  const fake = async (url: any, init: any) => { seen.push({ url, init }); return new Response(JSON.stringify({ status: 'success', data: { ok: true } })); };
  // Empty token is deliberate: no credential is needed or supplied to the fake fetch.
  assert.deepEqual(await makeMps('https://example.invalid/', '', fake as typeof fetch)('/payment', { text: '☃' }), { ok: true });
  assert.equal(seen[0].url, 'https://example.invalid/api/v1/payment');
  assert.equal(seen[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(seen[0].init.body), { text: '☃' });
  assert.ok(seen[0].init.signal instanceof AbortSignal);
  for (const [code, text] of [[500, '{}'], [200, '{"status":"error"}'], [200, 'broken json']] as const) {
    await assert.rejects(makeMps('https://example.invalid', '', (async () => new Response(text, { status: code })) as typeof fetch)('/payment', {}), /MPS.*HTTP/);
  }
});
test('availability and input_schema expose configuration without starting a job', async (t) => {
  const f = fixture(); t.after(f.agent.stop);
  assert.deepEqual((await request(f.agent, 'get', '/availability')).body, { status: 'available', type: 'masumi-agent', message: undefined });
  const schema = (await request(f.agent, 'get', '/input_schema')).body.input_data;
  assert.equal(schema.length, 1); assert.equal(schema[0].id, 'policy'); assert.equal(schema[0].type, 'string');
  assert.equal(f.calls.length, 0);
});
test('missing MPS or registration refuses valid jobs with 503 and reports unavailable', async (t) => {
  for (const patch of [{ mps: undefined }, { registration: undefined }]) {
    const f = fixture(patch); t.after(f.agent.stop);
    assert.equal((await start(f.agent)).status, 503);
    assert.equal((await request(f.agent, 'get', '/availability')).body.status, 'unavailable');
    assert.equal(f.calls.length, 0);
  }
});
test('start_job refuses every nonce boundary and malformed input without asking for payment', async (t) => {
  const f = fixture(); t.after(f.agent.stop);
  for (const nonce of ['', 'a'.repeat(13), 'a'.repeat(27), 'g'.repeat(14), '☃', -1, null]) {
    assert.equal((await request(f.agent, 'post', '/start_job', { identifier_from_purchaser: nonce, input_data: { policy: POLICY } })).status, 400);
  }
  for (const input of [{}, { policy: '' }, { policy: 'a'.repeat(64) }, { policy: `${'a'.repeat(64)}#10000` },
    { policy: `${'A'.repeat(64)}#0` }, { policy: `${'a'.repeat(64)}#-1` }, { policy: POLICY, extra: 0 }, [], '☃', 0]) {
    assert.equal((await request(f.agent, 'post', '/start_job', { identifier_from_purchaser: NONCE, input_data: input })).status, 400);
  }
  assert.equal(f.calls.length, 0);
});
test('policy refusal, thrown check and short deadline never request payment', async (t) => {
  for (const [checkPolicy, code] of [
    [async () => ({ ok: false, reason: 'not served' }), 400],
    [async () => { throw new Error('synthetic failure'); }, 500],
    [async () => ({ ok: true, deadlineMs: NOW + 30 * M - 1, rule: '' }), 400],
  ] as const) {
    const f = fixture({ checkPolicy: checkPolicy as MasumiDeps['checkPolicy'] }); t.after(f.agent.stop);
    assert.equal((await start(f.agent)).status, code);
    assert.equal(f.calls.length, 0);
  }
});
test('accepted nonce/ref boundaries, camelCase alias, deadline cap and payment fields', async (t) => {
  for (const nonce of ['A'.repeat(14), 'f'.repeat(26)]) {
    const f = fixture({ checkPolicy: async () => ({ ok: true, deadlineMs: NOW + 20 * 24 * 60 * M, rule: '' }) }); t.after(f.agent.stop);
    const reply = await request(f.agent, 'post', '/start_job', { identifierFromPurchaser: nonce, input_data: { policy: `${'a'.repeat(64)}#9999` } });
    assert.equal(reply.status, 200);
    assert.equal(reply.body.payByTime, NOW + 10 * M);
    assert.equal(reply.body.submitResultTime, NOW + 8 * 24 * 60 * M);
    assert.equal(reply.body.unlockTime, reply.body.submitResultTime + 16 * M);
    assert.equal(reply.body.externalDisputeUnlockTime, reply.body.unlockTime + 16 * M);
    const p = f.calls[0].body;
    assert.equal(p.network, 'Preprod'); assert.equal(p.paymentSourceType, 'Web3CardanoV2');
    assert.deepEqual(p.RequestedFunds, [{ unit: USDM, amount: '1000000' }]);
    assert.equal(p.inputHash, inputHash({ policy: `${'a'.repeat(64)}#9999` }, nonce));
  }
  const edge = fixture({ checkPolicy: async () => ({ ok: true, deadlineMs: NOW + 30 * M, rule: '' }) }); t.after(edge.agent.stop);
  assert.equal((await start(edge.agent)).status, 200);
});
test('sequential nonce retries are idempotent and conflicting input is 409', async (t) => {
  const f = fixture(); t.after(f.agent.stop);
  const first = await start(f.agent);
  assert.deepEqual(await start(f.agent), first);
  assert.equal((await start(f.agent, NONCE, `${'b'.repeat(64)}#0`)).status, 409);
  assert.equal(f.calls.filter((c) => c.path === '/payment').length, 1);
});
test('uncertain payment failure is not retried for the same nonce', async (t) => {
  let requests = 0;
  const f = fixture({ mps: async () => { requests++; throw new Error('synthetic lost response'); } }); t.after(f.agent.stop);
  assert.equal((await start(f.agent)).status, 502);
  assert.equal((await start(f.agent)).status, 409);
  assert.equal(requests, 1);
  const job = [...f.agent.jobs.values()][0];
  assert.equal((await status(f.agent, job.id)).body.status, 'failed');
});
test('status rejects invalid/unknown ids and omits results until completion', async (t) => {
  const f = fixture(); t.after(f.agent.stop);
  for (const id of ['', '☃', 'a'.repeat(35), 'g'.repeat(36)]) assert.equal((await status(f.agent, id)).status, 400);
  assert.equal((await status(f.agent, '00000000-0000-0000-0000-000000000000')).status, 404);
  const reply = await start(f.agent);
  const waiting = await status(f.agent, reply.body.id);
  assert.equal(waiting.body.status, 'awaiting_payment');
  assert.equal('result' in waiting.body, false);
});
for (const finalOutcome of [{ state: 'released', tx: 'ab'.repeat(32) }, { state: 'gone' }, { state: 'open' }] as Outcome[]) {
  test(`job lifecycle: confirmed funds -> ${finalOutcome.state} -> confirmed result hash`, async (t) => {
    const f = fixture(); t.after(f.agent.stop);
    const reply = await start(f.agent);
    f.confirm(false); f.state('FundsLocked');
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal((await status(f.agent, reply.body.id)).body.status, 'awaiting_payment');
    f.confirm(true);
    await until(() => f.agent.jobs.get(reply.body.id)?.status === 'running');
    f.outcome(finalOutcome);
    if (finalOutcome.state === 'open') f.clock(reply.body.submitResultTime - 2 * M);
    await until(() => f.agent.jobs.get(reply.body.id)?.status === 'completed');
    const complete = (await status(f.agent, reply.body.id)).body;
    const result = JSON.parse(complete.result);
    assert.equal(result.policy, POLICY);
    if (finalOutcome.state === 'released') { assert.equal(result.outcome, 'released'); assert.equal(result.transaction, finalOutcome.tx); }
    if (finalOutcome.state === 'gone') assert.match(result.outcome, /spent by someone else/);
    if (finalOutcome.state === 'open') assert.match(result.outcome, /not released/);
    const submission = f.calls.find((c) => c.path === '/payment/submit-result');
    assert.equal(submission?.body.submitResultHash, resultHash(complete.result, NONCE));
    assert.deepEqual([...new Set(f.calls.map((c) => c.path))].sort(), ['/payment', '/payment/resolve-blockchain-identifier', '/payment/submit-result']);
  });
}
test('unpaid and late-paid jobs fail with distinct reasons', async (t) => {
  for (const paid of [false, true]) {
    const f = fixture(); t.after(f.agent.stop);
    const reply = await start(f.agent);
    if (paid) f.state('FundsLocked');
    f.clock(paid ? reply.body.submitResultTime - M : NOW + 15 * M + 1);
    await until(() => f.agent.jobs.get(reply.body.id)?.status === 'failed');
    assert.match((await status(f.agent, reply.body.id)).body.message, paid ? /too late/ : /no payment/);
    assert.equal(f.calls.some((c) => c.path === '/payment/submit-result'), false);
  }
});
test('BUG M1: rejected duplicate must not release the original inflight nonce lock', async (t) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let checks = 0;
  const f = fixture({ checkPolicy: async () => { checks++; await gate; return { ok: true, deadlineMs: NOW + 2 * 60 * M, rule: '' }; } });
  t.after(f.agent.stop);
  const first = start(f.agent);
  await flush();
  const second = await start(f.agent);
  const third = start(f.agent);
  await flush();
  release();
  const [a, c] = await Promise.all([first, third]);
  assert.deepEqual({ statuses: [a.status, second.status, c.status], checks, payments: f.calls.filter((c) => c.path === '/payment').length },
    { statuses: [200, 409, 409], checks: 1, payments: 1 });
});
