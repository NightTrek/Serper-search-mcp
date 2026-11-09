// Test-only adapter: no requests leave the process, including unexpected APIs.
import axios from 'axios';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
const deny = () => { throw new Error('Unexpected network access'); };
http.request = https.request = http.get = https.get = deny;
globalThis.fetch = deny;
let completions = 0;
axios.defaults.adapter = async (config) => {
  let data;
  if (config.baseURL === 'https://google.serper.dev' && config.url === '/search') {
    assert.equal(config.headers.get('X-API-KEY'), 'dummy-serper-secret');
    data = { organic: [{ title: 'Mock result', link: 'https://example.com', snippet: 'Mock search content', position: 1 }] };
  } else if (config.baseURL === 'https://openrouter.ai/api/v1' && config.url === '/completions') {
    assert.equal(config.headers.get('Authorization'), 'Bearer dummy-router-secret');
    const answers = [JSON.stringify({subQueries: [{query: 'mock query', rationale: 'test'}]}), JSON.stringify({action: 'research_complete', rationale: 'test'}), 'Mock research answer'];
    assert.ok(completions < answers.length);
    data = {choices: [{text: answers[completions++]}]};
  } else {
    throw new Error('Unexpected API request');
  }
  return { data, status: 200, statusText: 'OK', headers: {}, config };
};
