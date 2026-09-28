import { useMemo } from 'react';
import { useProposalStore } from '@/stores/proposal-store';
import { getTransformationsForPreset, type TransformationCard } from '@/lib/presets/transformation-cards';
import { loadTemplates } from '@/lib/templates';

export function TransformationPicker() {
  const selectedPreset = useProposalStore((s) => s.selectedPreset);
  const applyTransformation = useProposalStore((s) => s.applyTransformation);
  const goBack = useProposalStore((s) => s.goBack);

  const templates = useMemo(
    () => new Map(loadTemplates().map((template) => [template.id, template])),
    [],
  );

  const cards = selectedPreset
    ? getTransformationsForPreset(selectedPreset.suggestedTransformations)
    : [];
  const handleSelect = (card: TransformationCard) => {
    const template = templates.get(card.templateId);
    if (template) {
      applyTransformation(template);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <button
          onClick={goBack}
          aria-label="Back to street layout"
          className="min-h-11 min-w-11 flex items-center justify-center text-[#59646a] hover:text-[#172126] transition-colors rounded-sm hover:bg-[#f3f5f5]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
        </button>
        <div>
          <h3 className="text-sm font-bold text-gray-900 tracking-tight">
            What would you like to do?
          </h3>
          <p className="text-xs text-[#59646a] mt-0.5">
            Starting from: {selectedPreset?.label}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {cards.map((card, i) => (
          <button
            key={card.templateId}
            onClick={() => handleSelect(card)}
            className={`flex items-center gap-3.5 p-4 rounded-sm border border-[#d8dddf] bg-white hover:border-[#172126] hover:bg-[#f3f5f5] transition-colors duration-150 text-left group active:scale-[0.98] animate-fade-up stagger-${i + 1}`}
          >
            <span aria-hidden="true" className="text-sm tabular-nums text-[#59646a]">{String(i + 1).padStart(2, '0')}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-gray-900 group-hover:text-[#172126] transition-colors">
                {card.label}
              </div>
              <div className="text-[11px] text-[#59646a] mt-0.5 leading-snug">
                {card.description}
              </div>
            </div>
            {/* Trailing icon in its own circle */}
            <div className="w-7 h-7 rounded-full bg-gray-100/80 group-hover:bg-[#e8ebed] flex items-center justify-center flex-shrink-0 transition-colors duration-150">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-[#59646a] group-hover:text-[#172126] transition-colors duration-150">
                <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
