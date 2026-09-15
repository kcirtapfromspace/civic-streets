import { vi } from 'vitest';

/**
 * The installed convex-test 0.0.54 omits Blob.type from _storage metadata, unlike
 * Convex (https://docs.convex.dev/file-storage/file-metadata). Fill that one
 * missing platform field from the actual stored Blob, without changing server
 * validation. Install after convexTest(); restore with vi.restoreAllMocks().
 */
export function installStorageMetadataShim(): void {
  type Runtime = {
    // These are getters installed by convex-test, not writable methods.
    jsSyscall: unknown;
    asyncSyscall: unknown;
  };
  const runtime = (globalThis as unknown as { Convex: Runtime }).Convex;
  const jsGetter = Object.getOwnPropertyDescriptor(runtime, 'jsSyscall')!.get!;
  const asyncGetter = Object.getOwnPropertyDescriptor(runtime, 'asyncSyscall')!.get!;
  const contentTypes = new Map<string, string>();

  vi.spyOn(runtime, 'jsSyscall', 'get').mockImplementation(() => {
    const invoke = jsGetter.call(runtime) as (
      op: string,
      args: { blob?: Blob },
    ) => Promise<unknown>;
    return async (op: string, args: { blob?: Blob }) => {
      const result = await invoke(op, args);
      if (op === 'storage/storeBlob' && typeof result === 'string' && args.blob) {
        contentTypes.set(result, args.blob.type);
      }
      return result;
    };
  });

  function restoreContentType(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(restoreContentType);
    if (!value || typeof value !== 'object') return value;
    const doc = value as Record<string, unknown>;
    const result = Object.fromEntries(
      Object.entries(doc).map(([key, item]) => [key, restoreContentType(item)]),
    );
    if (typeof doc._id === 'string' && doc.contentType === undefined && contentTypes.has(doc._id)) {
      result.contentType = contentTypes.get(doc._id);
    }
    return result;
  }

  vi.spyOn(runtime, 'asyncSyscall', 'get').mockImplementation(() => {
    const invoke = asyncGetter.call(runtime) as (op: string, args: string) => Promise<string>;
    return async (op: string, args: string) => {
      const result = await invoke(op, args);
      return ['1.0/get', '1.0/queryStreamNext', '1.0/queryPage'].includes(op)
        ? JSON.stringify(restoreContentType(JSON.parse(result)))
        : result;
    };
  });
}
