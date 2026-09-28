import type { DiscussionBriefContext } from '@/lib/types';

export interface BriefPhoto {
  source: string;
  image?: Blob;
}

const PHOTO_LIMIT = 3;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const PHOTO_TIMEOUT_MS = 4000;

async function loadPhoto(source: string): Promise<BriefPhoto> {
  // Only user-visible image URLs are eligible; never resolve local filesystem paths.
  if (!/^(https?:\/\/|blob:|data:image\/(png|jpeg);base64,)/i.test(source)) return { source };
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout>;
  try {
    const image = await Promise.race([
      (async () => {
        const response = await fetch(source, {
          signal: controller.signal,
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        });
        if (!response.ok || Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) {
          throw new Error('Photo unavailable');
        }
        const blob = await response.blob();
        if (blob.size > MAX_IMAGE_BYTES || !['image/png', 'image/jpeg'].includes(blob.type)) {
          throw new Error('Unsupported photo');
        }
        return blob;
      })(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error('Photo timed out'));
        }, PHOTO_TIMEOUT_MS);
      }),
    ]);
    return { source, image };
  } catch {
    return { source };
  } finally {
    clearTimeout(timeout!);
  }
}

/** Prefetch a small evidence set so one missing photo cannot block the PDF renderer. */
export async function loadBriefPhotos(context?: DiscussionBriefContext): Promise<BriefPhoto[]> {
  return Promise.all((context?.observation?.photoUrls ?? []).slice(0, PHOTO_LIMIT).map(loadPhoto));
}
