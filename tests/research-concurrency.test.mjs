import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SERPER_API_KEY = 'dummy-serper-secret';
process.env.DISABLE_METRICS = 'true';
const { MetricsService } = await import('../build/infrastructure/quality/metricsService.js');
const { ResearchOrchestrator } = await import('../build/application/orchestration/researchOrchestrator.js');

test('concurrent operations isolate enabled metrics and clean up success and failure', async () => {
  const sessions = [];
  const createMetrics = () => {
    const metrics = new MetricsService();
    const session = {events: [], shutdowns: 0};
    sessions.push(session);
    // Exercise enabled capture without constructing or contacting PostHog.
    metrics.enabled = true;
    metrics.client = {
      capture: event => session.events.push(event),
      shutdown: async timeout => {
        assert.equal(timeout, 1000);
        session.shutdowns++;
      },
    };
    return metrics;
  };
  let releaseSecond;
  const secondMayFinish = new Promise(resolve => { releaseSecond = resolve; });
  const researchService = {
    initializeState: request => ({originalQuery: request.query, status: 'complete', searchResults: [], subQueries: []}),
    synthesizeResults: async state => {
      if (state.originalQuery === 'second') await secondMayFinish;
      if (state.originalQuery === 'failed') throw new Error('Synthesis failed');
      return {answer: state.originalQuery, citations: []};
    },
  };
  const orchestrator = new ResearchOrchestrator(researchService, {}, {}, {}, createMetrics);
  const first = orchestrator.executeResearch({query: 'first'});
  const second = orchestrator.executeResearch({query: 'second'});
  assert.equal((await first).answer, 'first');
  releaseSecond();
  assert.equal((await second).answer, 'second');
  assert.equal(sessions.length, 2);
  const ids = sessions.map(session => {
    assert.deepEqual(session.events.map(event => event.event), ['research.started', 'research.synthesis_completed', 'research.completed']);
    assert.equal(new Set(session.events.map(event => event.distinctId)).size, 1);
    assert.equal(session.shutdowns, 1);
    return session.events[0].distinctId;
  });
  assert.notEqual(ids[0], ids[1]);
  await assert.rejects(orchestrator.executeResearch({query: 'failed'}), /Synthesis failed/);
  assert.equal(sessions[2].shutdowns, 1);
  assert.equal(sessions[2].events.some(event => event.event === 'research.completed'), false);
});

test('telemetry shutdown failure does not replace a research result', async () => {
  const metrics = new MetricsService();
  metrics.enabled = true;
  metrics.client = {shutdown: async () => { throw new Error('Telemetry unavailable'); }};
  await assert.doesNotReject(metrics.cleanup());
});
