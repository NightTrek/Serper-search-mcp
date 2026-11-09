import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

function launch(t, openRouterKey) {
  const child = spawn(process.execPath, ['--import', './tests/fixtures/mock-http.mjs', 'build/index.js'], {
    cwd: new URL('../', import.meta.url),
    env: { PATH: process.env.PATH, SERPER_API_KEY: 'dummy-serper-secret', OPENROUTER_API_KEY: openRouterKey ?? '', DISABLE_METRICS: 'true' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '', stderr = '', buffer = '', nextId = 0;
  const pending = new Map();
  child.stdout.setEncoding('utf8').on('data', chunk => {
    stdout += chunk;
    buffer += chunk;
    while (buffer.includes('\n')) {
      const newline = buffer.indexOf('\n');
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      try {
        const message = JSON.parse(line);
        pending.get(message.id)?.(message);
        pending.delete(message.id);
      } catch { /* Assert the entire stdout stream during cleanup. */ }
    }
  });
  child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      await exited;
    }
    for (const line of stdout.trim().split('\n').filter(Boolean)) {
      assert.equal(JSON.parse(line).jsonrpc, '2.0', 'stdout must contain only MCP JSON-RPC');
    }
    assert.doesNotMatch(stdout + stderr, /dummy|OpenRouter API Key|Deep Research request|Research iteration/);
    assert.doesNotMatch(stderr, /Unexpected network access/);
  });
  const request = (method, params = {}) => {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timed out: ${method}; ${stderr}`)), 3000);
      pending.set(id, response => { clearTimeout(timeout); resolve(response); });
      child.stdin.write(JSON.stringify({jsonrpc: '2.0', id, method, params}) + '\n');
    });
  };
  return {request, notify: (method) => child.stdin.write(JSON.stringify({jsonrpc: '2.0', method}) + '\n')};
}

for (const key of [undefined, '   ', 'dummy-router-secret']) {
  test(`stdio search and optional research (${key === 'dummy-router-secret' ? 'enabled' : key ? 'blank key' : 'no key'})`, { timeout: 10000 }, async t => {
    const {request, notify} = launch(t, key);
    const init = await request('initialize', {protocolVersion: '2024-11-05', capabilities: {}, clientInfo: {name: 'regression-test', version: '1.0.0'}});
    assert.ok(init.result.serverInfo);
    notify('notifications/initialized');
    const list = await request('tools/list');
    assert.deepEqual(list.result.tools.map(tool => tool.name), key === 'dummy-router-secret' ? ['serper-google-search', 'deep-research'] : ['serper-google-search']);
    const search = await request('tools/call', {name: 'serper-google-search', arguments: {query: 'test'}});
    assert.equal(JSON.parse(search.result.content[0].text).organic[0].title, 'Mock result');
    const research = await request('tools/call', {name: 'deep-research', arguments: {query: 'test', depth: 'basic'}});
    if (key === 'dummy-router-secret') {
      assert.equal(research.error, undefined);
      assert.match(research.result.content[0].text, /Mock research answer/);
    } else {
      assert.equal(research.result.isError, true);
      assert.match(research.result.content[0].text, /OPENROUTER_API_KEY/);
      const after = await request('tools/call', {name: 'serper-google-search', arguments: {query: 'still works'}});
      assert.ok(after.result.content);
    }
    const invalid = await request('tools/call', {name: 'serper-google-search', arguments: {query: ''}});
    assert.equal(invalid.error.code, -32602);
    const unknown = await request('tools/call', {name: 'unknown', arguments: {}});
    assert.equal(unknown.error.code, -32601);
  });
}


test('concurrent research calls keep independent metrics and survive a peer failure', {timeout: 10000}, async t => {
  const {request, notify} = launch(t, 'dummy-router-secret');
  await request('initialize', {protocolVersion: '2024-11-05', capabilities: {}, clientInfo: {name: 'concurrency-test', version: '1.0.0'}});
  notify('notifications/initialized');
  const research = query => request('tools/call', {name: 'deep-research', arguments: {query, depth: 'basic'}});
  const [first, second] = await Promise.all([research('overlap-a'), research('overlap-b')]);
  assert.equal(first.error, undefined);
  assert.equal(second.error, undefined);
  assert.match(first.result.content[0].text, /Mock research answer for overlap-a/);
  assert.match(second.result.content[0].text, /Mock research answer for overlap-b/);
  const [failed, healthy] = await Promise.all([research('fail'), research('healthy')]);
  assert.match(failed.error.message, /Unexpected error while requesting an OpenRouter completion/);
  assert.equal(healthy.error, undefined);
  assert.match(healthy.result.content[0].text, /Mock research answer for healthy/);
  const next = await research('next');
  assert.equal(next.error, undefined);
  const search = await request('tools/call', {name: 'serper-google-search', arguments: {query: 'still works'}});
  assert.ok(search.result.content);
});


test('malformed and failed OpenRouter responses stay structured and leave search usable', {timeout: 10000}, async t => {
  const {request, notify} = launch(t, 'dummy-router-secret');
  await request('initialize', {protocolVersion: '2024-11-05', capabilities: {}, clientInfo: {name: 'error-test', version: '1.0.0'}});
  notify('notifications/initialized');
  for (const query of ['empty-choices', 'missing-text', 'provider-error', 'http-error', 'timeout-error']) {
    const result = await request('tools/call', {name: 'deep-research', arguments: {query, depth: 'basic'}});
    assert.equal(result.error.code, -32603);
    assert.match(result.error.message, /OpenRouter/);
    assert.doesNotMatch(result.error.message, /Cannot read|undefined|sensitive-prompt/);
    const search = await request('tools/call', {name: 'serper-google-search', arguments: {query: 'still works'}});
    assert.ok(search.result.content);
  }
  const healthy = await request('tools/call', {name: 'deep-research', arguments: {query: 'healthy', depth: 'basic'}});
  assert.equal(healthy.error, undefined);
});
