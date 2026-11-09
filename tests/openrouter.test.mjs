import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
process.env.SERPER_API_KEY = 'dummy-serper-secret';
process.env.OPENROUTER_API_KEY = 'dummy-router-secret';
process.env.DISABLE_METRICS = 'true';
const { OpenRouterClient } = await import('../build/infrastructure/api/openRouterClient.js');

function clientWith(adapter) {
  const client = new OpenRouterClient();
  client.axiosInstance.defaults.adapter = adapter;
  return client;
}
function response(data) {
  return async config => ({data, status: 200, statusText: 'OK', headers: {}, config});
}
const expectError = (pattern) => error => {
  assert.ok(error instanceof McpError);
  assert.equal(error.code, ErrorCode.InternalError);
  assert.match(error.message, pattern);
  assert.doesNotMatch(error.message, /dummy|Cannot read|undefined|sensitive-prompt/);
  return true;
};

test('completion validates a successful response and preserves its text', async () => {
  assert.equal(await clientWith(response({choices: [{text: ' Answer \n'}]})).completion('test'), ' Answer \n');
});
for (const data of [undefined, null, {}, {choices: null}, {choices: {}}, {choices: []}, {choices: [null]}, {choices: [{}]}, {choices: [{text: 42}]}, {choices: [{text: ''}]}, {choices: [{text: '  '}]}]) {
  test(`reject malformed completion ${JSON.stringify(data)}`, async () => {
    await assert.rejects(clientWith(response(data)).completion('test'), expectError(/OpenRouter returned an invalid completion response/));
  });
}
test('reject a successful HTTP response containing an API error without exposing its body', async () => {
  const client = clientWith(response({error: {message: 'dummy-router-secret sensitive-prompt'}, choices: [{text: 'do not use'}]}));
  await assert.rejects(client.completion('test'), expectError(/OpenRouter returned an error response/));
});
for (const status of [401, 429, 500]) {
  test(`report HTTP ${status} safely`, async () => {
    const client = clientWith(async config => {
      throw new axios.AxiosError('dummy-router-secret', 'ERR_BAD_RESPONSE', config, {}, {status, data: {error: {message: 'sensitive-prompt'}}, headers: {}, config});
    });
    await assert.rejects(client.completion('test'), expectError(new RegExp(`OpenRouter API request failed \\(HTTP ${status}\\)`)));
  });
}
test('report timeout and network errors safely', async () => {
  for (const [code, expected] of [['ECONNABORTED', /OpenRouter API request timed out/], ['ETIMEDOUT', /OpenRouter API request timed out/], ['ENOTFOUND', /OpenRouter API request failed/]]) {
    const client = clientWith(async () => { throw new axios.AxiosError('dummy-router-secret', code); });
    await assert.rejects(client.completion('test'), expectError(expected));
  }
});
