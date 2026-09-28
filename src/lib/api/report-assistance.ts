import { ConvexHttpClient } from 'convex/browser';
import { ConvexError } from 'convex/values';
import { api } from '../../../convex/_generated/api';
import { ASSISTANCE_UNAVAILABLE, type AssistanceInput, type AssistanceResult } from '../../../shared/report-assistance';

/** Explicit opt-in request. The TypeSafe key exists only in the backend. */
export async function requestReportAssistance(input: AssistanceInput): Promise<AssistanceResult> {
  const url = import.meta.env.VITE_CONVEX_URL as string | undefined;
  if (!url) throw new Error(ASSISTANCE_UNAVAILABLE);
  let sessionToken: string | null = null;
  try { sessionToken = localStorage.getItem('curbwise-session'); } catch { /* unavailable storage */ }
  if (!sessionToken) throw new Error('Your reporting session is still getting ready. Try suggestions again in a moment.');
  try {
    return await new ConvexHttpClient(url.replace(/\/+$/, '')).action(api.reportAssistance.suggest, { ...input, sessionToken });
  } catch (error) {
    throw new Error(error instanceof ConvexError && typeof error.data === 'string' ? error.data : ASSISTANCE_UNAVAILABLE);
  }
}
