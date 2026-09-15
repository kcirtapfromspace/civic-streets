import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateCoverage, isProductionSource, ratchetBaseline, sourceRoots } from './coverage-policy.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const baselinePath = path.join(root, 'coverage-baseline.json');

function productionFiles(directory) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return productionFiles(relative);
    return entry.isFile() && isProductionSource(relative) ? [relative] : [];
  });
}

try {
  if (process.argv.slice(2).some((arg) => !['--ratchet', '--strict'].includes(arg))) throw new Error('Usage: node scripts/testing/check-coverage.mjs [--ratchet] [--strict]');
  const raw = JSON.parse(fs.readFileSync(path.join(root, 'coverage/coverage-summary.json'), 'utf8'));
  const summary = Object.fromEntries(Object.entries(raw).map(([file, data]) => [
    file === 'total' ? file : path.relative(root, file).split(path.sep).join('/'), data,
  ]));
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const files = sourceRoots.flatMap(productionFiles).sort();
  const failures = evaluateCoverage(summary, baseline, files, { strict: process.argv.includes('--strict') });
  if (failures.length) throw new Error(`Coverage standards failed:\n${failures.map((message) => `- ${message}`).join('\n')}`);
  if (process.argv.includes('--ratchet')) {
    fs.writeFileSync(baselinePath, `${JSON.stringify(ratchetBaseline(summary, baseline, files), null, 2)}\n`);
    console.log('Coverage debt baseline tightened. Review and commit the baseline with the tests.');
  }
  console.log(`Coverage standards passed for all ${files.length} production files (including untested files).`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
