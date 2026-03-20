import { useEffect, useState } from 'react';
import { useProposalStore } from '@/stores/proposal-store';
import { getTransformationsForPreset, type TransformationCard } from '@/lib/presets/transformation-cards';
import type { TemplateDefinition } from '@/lib/types';

const ICON_MAP: Record<TransformationCard['icon'], string> = {
  bike: '🚲',
  diet: '🍃',
  complete: '🌳',
  transit: '🚌',
  shared: '🤝',
};

export function TransformationPicker() {
  const selectedPreset = useProposalStore((s) => s.selectedPreset);
  const applyTransformation = useProposalStore((s) => s.applyTransformation);
  const goBack = useProposalStore((s) => s.goBack);

  const [templates, setTemplates] = useState<Map<string, TemplateDefinition>>(new Map());
  const [loading, setLoading] = useState(true);

  const cards = selectedPreset
    ? getTransformationsForPreset(selectedPreset.suggestedTransformations)
    : [];

  // Load template JSON files
  useEffect(() => {
    if (cards.length === 0) return;

    const templateModules = import.meta.glob('/data/templates/*.json', { eager: true });
    const loaded = new Map<string, TemplateDefinition>();

    for (const [path, mod] of Object.entries(templateModules)) {
      const template = (mod as { default: TemplateDefinition }).default ?? mod as TemplateDefinition;
      if (template.id) {
        loaded.set(template.id, template);
      }
    }

    setTemplates(loaded);
    setLoading(false);
  }, []);

  const handleSelect = (card: TransformationCard) => {
    const template = templates.get(card.templateId);
    if (template) {
      applyTransformation(template);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-blue-100 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <button
          onClick={goBack}
          className="text-gray-300 hover:text-gray-500 transition-all duration-300 ease-spring p-1 rounded-full hover:bg-gray-100/80"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
        </button>
        <div>
          <h3 className="text-sm font-bold text-gray-900 tracking-tight">
            What would you like to do?
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Starting from: {selectedPreset?.label}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {cards.map((card, i) => (
          <button
            key={card.templateId}
            onClick={() => handleSelect(card)}
            className={`flex items-center gap-3.5 p-4 rounded-2xl ring-1 ring-gray-100 bg-gray-50/50 hover:ring-blue-200 hover:bg-blue-50/40 transition-all duration-300 ease-spring text-left group active:scale-[0.98] animate-fade-up stagger-${i + 1}`}
          >
            <span className="text-lg flex-shrink-0">
              {ICON_MAP[card.icon]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-gray-900 group-hover:text-blue-700 transition-all duration-300 ease-spring">
                {card.label}
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                {card.description}
              </div>
            </div>
            {/* Trailing icon in its own circle */}
            <div className="w-7 h-7 rounded-full bg-gray-100/80 group-hover:bg-blue-100 flex items-center justify-center flex-shrink-0 transition-all duration-300 ease-spring group-hover:translate-x-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 transition-all duration-300 ease-spring">
                <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
