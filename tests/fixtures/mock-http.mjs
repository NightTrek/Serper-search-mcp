// Test-only adapter: no requests leave the process, including unexpected APIs.
import axios from 'axios';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
const deny = () => { throw new Error('Unexpected network access'); };
http.request = https.request = http.get = https.get = deny;
globalThis.fetch = deny;
let overlapCount = 0;
let releaseOverlap;
const overlapStarted = new Promise(resolve => { releaseOverlap = resolve; });
axios.defaults.adapter = async (config) => {
  let data;
  if (config.baseURL === 'https://google.serper.dev' && config.url === '/search') {
    assert.equal(config.headers.get('X-API-KEY'), 'dummy-serper-secret');
    data = { organic: [{ title: 'Mock result', link: 'https://example.com', snippet: 'Mock search content', position: 1 }] };
  } else if (config.baseURL === 'https://openrouter.ai/api/v1' && config.url === '/completions') {
    assert.equal(config.headers.get('Authorization'), 'Bearer dummy-router-secret');
    const { prompt } = JSON.parse(config.data);
    const query = prompt.match(/(?:Research Query|Original Query): (.+)/)?.[1];
    assert.ok(query, 'Mock must recognize the research query');
    let answer;
    if (prompt.includes('Research Query:') && !prompt.includes('Original Research Query:')) {
      if (query === 'fail') throw new Error('Mock research failure');
      if (query.startsWith('overlap-')) {
        overlapCount++;
        if (overlapCount === 2) releaseOverlap();
        await overlapStarted;
      }
      answer = JSON.stringify({subQueries: [{query, rationale: 'test'}]});
    } else if (prompt.includes('Current Research State:')) {
      answer = JSON.stringify({action: 'research_complete', rationale: 'test'});
    } else {
      // Force A to complete and reset its metrics while B is still synthesizing.
      if (query === 'overlap-b') await new Promise(resolve => setTimeout(resolve, 100));
      answer = `Mock research answer for ${query}`;
    }
    data = {choices: [{text: answer}]};
  } else {
    throw new Error('Unexpected API request');
  }
  return { data, status: 200, statusText: 'OK', headers: {}, config };
};
