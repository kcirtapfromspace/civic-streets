import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  evaluateCoverage,
  isProductionSource,
  metrics,
  ratchetBaseline,
} from './coverage-policy.mjs';

const measurement = (covered, total = 100) =>
  Object.fromEntries(metrics.map((metric) => [metric, { covered, total }]));
const baseline = () => ({
  version: 1,
  total: measurement(20),
  files: { 'src/legacy.ts': measurement(20) },
});
const report = (covered = 20) => ({
  total: measurement(covered),
  'src/legacy.ts': measurement(covered),
});

test('includes all application source, including untested UI and backend configuration', () => {
  for (const file of [
    'src/untested.tsx',
    'convex/schema.ts',
    'shared/rules.ts',
    'src/lib/types/index.ts',
    'src/new.js',
    'src/new.jsx',
    'shared/new.mts',
    'convex/new.cts',
    'src/new.mjs',
    'src/new.cjs',
  ])
    assert.equal(isProductionSource(file), true);
  for (const file of [
    '.claude/worktrees/old/src/code.ts',
    'convex/_generated/api.ts',
    'src/code.test.tsx',
    'shared/rules.spec.ts',
    'src/__tests__/helper.ts',
    'src/types.d.ts',
    'src/types.d.mts',
    'shared/a.spec.mjs',
    'node_modules/a.ts',
  ])
    assert.equal(isProductionSource(file), false);
});

test('allows unchanged legacy debt', () => {
  assert.deepEqual(evaluateCoverage(report(), baseline(), ['src/legacy.ts']), []);
});

test('strict completion check requires the full standards despite a legacy exemption', () => {
  const failures = evaluateCoverage(report(), baseline(), ['src/legacy.ts'], { strict: true });
  assert.ok(failures.some((message) => message.startsWith('All production code: lines')));
  assert.ok(failures.some((message) => message.startsWith('src/legacy.ts: lines')));
  assert.deepEqual(
    evaluateCoverage(report(90), baseline(), ['src/legacy.ts'], { strict: true }),
    [],
  );
});

test('strict standards retain the whole-app regression ceiling after debt is removed', () => {
  const completed = { version: 1, total: measurement(95), files: {} };
  assert.ok(
    evaluateCoverage(report(90), completed, ['src/legacy.ts'], { strict: true }).some((message) =>
      message.startsWith('All production code: uncovered lines increased'),
    ),
  );
  assert.deepEqual(
    evaluateCoverage(report(95), completed, ['src/legacy.ts'], { strict: true }),
    [],
  );
});

test('fails when a production file is omitted, even with a healthy global total', () => {
  const failures = evaluateCoverage(report(), baseline(), ['src/legacy.ts', 'src/unimported.tsx']);
  assert.ok(failures.some((message) => message.includes('src/unimported.tsx: missing')));
});

test('fails uncovered-code growth even when percentages improve', () => {
  const data = report();
  data['src/legacy.ts'] = measurement(100, 200);
  assert.ok(
    evaluateCoverage(data, baseline(), ['src/legacy.ts']).some((message) =>
      message.includes('uncovered lines increased'),
    ),
  );
});

test('fails percentage regression even when uncovered counts stay equal', () => {
  const data = report();
  data['src/legacy.ts'] = measurement(10, 90);
  assert.ok(
    evaluateCoverage(data, baseline(), ['src/legacy.ts']).some((message) =>
      message.includes('lines regressed'),
    ),
  );
});

test('enforces each metric independently on new modules', () => {
  const data = { ...report(), 'src/new.tsx': measurement(80) };
  data['src/new.tsx'].branches.covered = 74;
  assert.deepEqual(evaluateCoverage(data, baseline(), ['src/legacy.ts', 'src/new.tsx']), [
    'src/new.tsx: branches 74.00% < 75%.',
  ]);
  data['src/new.tsx'].branches.covered = 75;
  assert.deepEqual(evaluateCoverage(data, baseline(), ['src/legacy.ts', 'src/new.tsx']), []);
});

test('applies stronger requirements to new backend and shared modules', () => {
  for (const file of ['convex/new.ts', 'shared/new.ts']) {
    const data = { ...report(), [file]: measurement(89) };
    assert.ok(
      evaluateCoverage(data, baseline(), ['src/legacy.ts', file]).some((message) =>
        message.includes('lines 89.00% < 90%'),
      ),
    );
    data[file] = measurement(90);
    data[file].branches.covered = 85;
    assert.deepEqual(evaluateCoverage(data, baseline(), ['src/legacy.ts', file]), []);
  }
});

test('enforces the whole-app debt ceiling, even when individual files meet targets', () => {
  const data = report(19);
  data['src/legacy.ts'] = measurement(20);
  assert.ok(
    evaluateCoverage(data, baseline(), ['src/legacy.ts']).some((message) =>
      message.startsWith('All production code:'),
    ),
  );
});

test('rejects missing or malformed counts and unsupported baseline formats', () => {
  for (const invalid of [
    undefined,
    { total: 10, covered: 11 },
    { total: -1, covered: 0 },
    { total: 10, covered: NaN },
  ]) {
    const data = report();
    data['src/legacy.ts'].lines = invalid;
    assert.ok(
      evaluateCoverage(data, baseline(), ['src/legacy.ts']).some((message) =>
        message.includes('invalid lines'),
      ),
    );
  }
  assert.match(evaluateCoverage(report(), {}, ['src/legacy.ts'])[0], /baseline/);
});

test('accepts type-only files with no executable items', () => {
  const data = { ...report(), 'src/types.ts': measurement(0, 0) };
  assert.deepEqual(evaluateCoverage(data, baseline(), ['src/legacy.ts', 'src/types.ts']), []);
});

test('rejects accidental archived-worktree or test-file coverage', () => {
  const data = { ...report(), '.claude/worktrees/old/src/code.ts': measurement(100) };
  assert.ok(
    evaluateCoverage(data, baseline(), ['src/legacy.ts']).some((message) =>
      message.includes('unexpected file'),
    ),
  );
});

test('ratchet locks improvements and removes paid-off debt without adding exemptions', () => {
  const partial = ratchetBaseline(report(30), baseline(), ['src/legacy.ts']);
  assert.equal(partial.files['src/legacy.ts'].lines.covered, 30);
  assert.ok(evaluateCoverage(report(20), partial, ['src/legacy.ts']).length > 0);
  const done = ratchetBaseline(report(90), baseline(), ['src/legacy.ts']);
  assert.deepEqual(done.files, {});
  assert.throws(() => ratchetBaseline(report(10), baseline(), ['src/legacy.ts']), /Cannot ratchet/);
});

test('deleted production files can be removed from the debt register', () => {
  const next = ratchetBaseline({ total: measurement(30) }, baseline(), []);
  assert.deepEqual(next.files, {});
});
