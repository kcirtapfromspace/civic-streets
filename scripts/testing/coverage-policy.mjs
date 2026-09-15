// Policy shared by Vitest, the coverage gate and the standards document.
export const metrics = ['lines', 'statements', 'functions', 'branches'];
export const sourceRoots = ['src', 'convex', 'shared'];
export const sourceInclude = sourceRoots.map((root) => `${root}/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}`);
export const sourceExclude = [
  '**/*.{test,spec}.{ts,tsx,mts,cts,js,jsx,mjs,cjs}', '**/__tests__/**', '**/*.d.{ts,mts,cts}', 'convex/_generated/**',
];
export const standard = { lines: 80, statements: 80, functions: 80, branches: 75 };
export const criticalStandard = { lines: 90, statements: 90, functions: 90, branches: 85 };

// Critical client contracts are explicit. targetFor also applies the stronger
// standard to every backend and shared module, including new files.
export const criticalFiles = new Set([
  'convex/users.ts', 'convex/reports.ts', 'convex/hotspots.ts',
  'convex/rateLimit.ts', 'convex/storage.ts', 'convex/geocoding.ts',
  'shared/reporting-areas.ts', 'shared/photo-upload.ts', 'shared/geocoding.ts',
  'src/lib/api/auth.ts', 'src/lib/api/geocoding.ts',
  'src/lib/api/billing.ts', 'src/lib/api/organization.ts',
  'src/lib/api/use-hotspots.ts', 'src/lib/billing/access.ts',
  'src/lib/api/civic-report.ts', 'src/lib/api/civic/open311.ts',
  'src/lib/api/civic/seeclickfix.ts',
  'src/lib/api/use-submitted-place-search.ts',
  'src/features/report/official-contacts.ts',
  'src/features/safety-data/safety-data-store.ts',
  'src/features/safety-data/api/cache.ts',
  'src/features/safety-data/api/index.ts',
  'src/features/safety-data/api/chicago-crashes.ts',
  'src/features/safety-data/api/denver-crashes.ts',
  'src/features/safety-data/api/nyc-crashes.ts',
  'src/features/safety-data/api/nhtsa-fars.ts',
  'src/features/safety-data/api/validation.ts',
  'src/lib/standards/validator.ts', 'src/lib/standards/constraint-solver.ts',
]);

export function isProductionSource(file) {
  return sourceRoots.some((root) => file.startsWith(`${root}/`)) &&
    /\.(?:[cm]?[jt]s|[jt]sx)$/.test(file) && !/\.(test|spec)\.(?:[cm]?[jt]s|[jt]sx)$/.test(file) &&
    !/\.d\.(?:[cm]?ts)$/.test(file) && !file.split('/').includes('__tests__') &&
    !file.startsWith('convex/_generated/');
}

export function percent(metric) {
  return metric.total === 0 ? 100 : metric.covered / metric.total * 100;
}

export function targetFor(file) {
  return file.startsWith('convex/') || file.startsWith('shared/') || criticalFiles.has(file)
    ? criticalStandard : standard;
}

function validMetric(metric) {
  return metric && Number.isSafeInteger(metric.total) && Number.isSafeInteger(metric.covered) &&
    metric.total >= 0 && metric.covered >= 0 && metric.covered <= metric.total;
}

export function meetsStandard(file, data) {
  const target = targetFor(file);
  return metrics.every((metric) => validMetric(data?.[metric]) && percent(data[metric]) >= target[metric]);
}

/** Counts AND percentages prevent debt growth or dilution with untested code. */
export function evaluateCoverage(summary, baseline, expectedFiles, { strict = false } = {}) {
  const failures = [];
  if (baseline?.version !== 1 || !baseline.files || !baseline.total) {
    return ['Coverage debt baseline is missing or has an unsupported format.'];
  }
  const inspect = (name, current, previous, target) => {
    for (const metric of metrics) {
      const now = current?.[metric];
      if (!validMetric(now)) {
        failures.push(`${name}: missing or invalid ${metric} measurement.`);
        continue;
      }
      if (!previous) {
        if (percent(now) < target[metric]) failures.push(`${name}: ${metric} ${percent(now).toFixed(2)}% < ${target[metric]}%.`);
        continue;
      }
      const before = previous[metric];
      if (!validMetric(before)) {
        failures.push(`${name}: invalid baseline ${metric}.`);
        continue;
      }
      if (now.total - now.covered > before.total - before.covered) {
        failures.push(`${name}: uncovered ${metric} increased from ${before.total - before.covered} to ${now.total - now.covered}.`);
      }
      // Use counts rather than the reporter's rounded percentage.
      if (percent(now) + 1e-9 < percent(before)) {
        failures.push(`${name}: ${metric} regressed from ${percent(before).toFixed(2)}% to ${percent(now).toFixed(2)}%.`);
      }
    }
  };
  inspect('All production code', summary.total, baseline.total, standard);
  if (strict) inspect('All production code', summary.total, undefined, standard);
  for (const file of expectedFiles) {
    inspect(file, summary[file], baseline.files[file], targetFor(file));
    if (strict && baseline.files[file]) inspect(file, summary[file], undefined, targetFor(file));
  }
  for (const file of Object.keys(summary)) {
    if (file !== 'total' && !expectedFiles.includes(file)) failures.push(`${file}: unexpected file in coverage report; check source scope.`);
  }
  return failures;
}

/** Called only AFTER the gate passes: can tighten or remove debt, never add it. */
export function ratchetBaseline(summary, baseline, expectedFiles) {
  const failures = evaluateCoverage(summary, baseline, expectedFiles);
  if (failures.length) throw new Error(`Cannot ratchet a failing report:\n${failures.join('\n')}`);
  const counts = (data) => Object.fromEntries(metrics.map((metric) => [metric, {
    total: data[metric].total, covered: data[metric].covered,
  }]));
  return {
    version: 1,
    total: counts(summary.total),
    files: Object.fromEntries(Object.keys(baseline.files).sort()
      .filter((file) => expectedFiles.includes(file) && !meetsStandard(file, summary[file]))
      .map((file) => [file, counts(summary[file])])),
  };
}
