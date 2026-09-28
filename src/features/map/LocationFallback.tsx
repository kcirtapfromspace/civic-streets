import { useState } from 'react';
import { useProposalStore } from '@/stores/proposal-store';
import { useIntersectionStore } from '@/stores/intersection-store';
import { useWorkspaceStore } from '@/stores/workspace-store';

/** A described place is enough to begin; never invent map coordinates. */
export function LocationFallback({ error, onClose }: { error: string | null; onClose: () => void }) {
  const [description, setDescription] = useState('');
  const [saveFailed, setSaveFailed] = useState(false);
  return <section aria-label="Continue without the map" className="absolute inset-0 z-20 overflow-auto bg-civic-paper p-5 sm:p-8">
    <div className="mx-auto max-w-md space-y-4 text-civic-ink">
      <h2 className="text-xl font-semibold">{error ? 'The map is unavailable' : 'Describe the place'}</h2>
      {error && <p role="alert" className="text-sm leading-6 text-civic-muted">{error}</p>}
      <p className="text-sm leading-6 text-civic-muted">You can still prepare a private concern and a brief. Describe an address, intersection, or landmark. This will not place a verified pin or publish an observation.</p>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (!description.trim()) return;
        if (!useProposalStore.getState().saveWork() || !useIntersectionStore.getState().saveWork()) { setSaveFailed(true); return; }
        useProposalStore.getState().initConcern(description.trim());
        useWorkspaceStore.setState({ mode: 'propose', designLocation: null });
        onClose();
      }}>
        <label className="block text-sm font-medium">Location description
          <input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={300} required placeholder="For example, the library entrance on Grant Street" className="mt-2 min-h-11 w-full rounded-sm border border-civic-line px-3 text-sm" />
        </label>
        {saveFailed && <p role="alert" className="mt-3 text-sm text-red-800">Your current work could not be saved. Open My work to retry before starting another concern.</p>}
        <button type="submit" disabled={!description.trim()} className="mt-4 min-h-11 rounded-sm bg-civic-ink px-4 text-sm font-medium text-white disabled:opacity-50">Start a private concern</button>
      </form>
      <button type="button" onClick={onClose} className="min-h-11 text-sm underline">Return to workspace</button>
    </div>
  </section>;
}
