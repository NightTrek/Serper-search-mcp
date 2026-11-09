import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SERPER_API_KEY = 'dummy-serper-secret';
process.env.DISABLE_METRICS = ' TrUe ';
const { resolvePostHogConfig } = await import('../build/infrastructure/config/posthogConfig.js');
const { MetricsService } = await import('../build/infrastructure/quality/metricsService.js');
const { TelemetryService } = await import('../build/infrastructure/telemetry/telemetryService.js');

test('metrics opt-out disables both PostHog clients before initialization', async () => {
  assert.equal(resolvePostHogConfig().enabled, false);
  const metrics = new MetricsService();
  const telemetry = new TelemetryService();
  assert.equal(metrics.client, undefined);
  assert.equal(telemetry.client, undefined);
  await metrics.cleanup();
  await telemetry.shutdown();
});
