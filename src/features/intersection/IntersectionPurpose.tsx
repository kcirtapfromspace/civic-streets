import { useIntersectionStore } from '@/stores/intersection-store';

/** Keep the same editable purpose available from map and standalone entry points. */
export function IntersectionPurpose() {
  const step = useIntersectionStore((state) => state.step);
  const context = useIntersectionStore((state) => state.briefContext);
  const setContext = useIntersectionStore((state) => state.setBriefContext);

  return (
    <details open={step === 'conditions'} className="mb-4 border-b border-[#d8dddf] pb-3">
      <summary className="min-h-11 cursor-pointer content-center text-sm font-medium">
        Purpose and request
      </summary>
      {([
        ['concern', 'What is happening here?'],
        ['desiredOutcome', 'What would you like to improve?'],
        ['requestedNextStep', 'What next step are you asking for?'],
      ] as const).map(([field, label]) => (
        <label key={field} className="mt-3 block text-xs font-medium text-[#172126]">
          {label}
          <textarea
            rows={2}
            maxLength={2000}
            className="mt-1 w-full rounded-sm border border-[#d8dddf] p-2 text-sm"
            value={context[field]}
            onChange={(event) => setContext({ [field]: event.target.value })}
          />
        </label>
      ))}
    </details>
  );
}
