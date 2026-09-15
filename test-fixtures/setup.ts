import { afterEach, beforeEach, vi } from 'vitest';

let unexpectedFetches = 0;

beforeEach(() => {
  unexpectedFetches = 0;
  // Tests replace fetch with provider fixtures where needed. A caught network
  // error must not hide an accidental call to a real backend or public service.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      unexpectedFetches += 1;
      throw new Error('Unmocked fetch is prohibited in app tests. Supply a provider fixture.');
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (unexpectedFetches) {
    throw new Error(
      `Test attempted ${unexpectedFetches} unmocked fetch request(s). Mock the network boundary explicitly.`,
    );
  }
});
