import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

test('installation commands use the actual repository and matching directory', () => {
  assert.match(readme, /git clone https:\/\/github\.com\/NightTrek\/Serper-search-mcp\.git\ncd Serper-search-mcp/);
  assert.match(readme, /\/path\/to\/Serper-search-mcp\/build\/index\.js/);
  assert.doesNotMatch(readme, /github\.com\/yourusername\//);
  assert.match(readme, /\[Model Context Protocol\]\(https:\/\/modelcontextprotocol\.io\)/);
  assert.match(readme, /\[Serper\.dev\]\(https:\/\/serper\.dev\)/);
});

test('relative Markdown links in maintained user documentation resolve', () => {
  for (const name of ['README.md', 'ENV_CONFIGURATION.md', 'TELEMETRY.md']) {
    const file = new URL(`../${name}`, import.meta.url);
    const markdown = readFileSync(file, 'utf8');
    for (const [, target] of markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith('#')) continue;
      assert.ok(existsSync(new URL(target.split('#')[0], file)), `${name}: missing link target ${target}`);
    }
  }
});
