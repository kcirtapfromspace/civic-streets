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
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={goBack}
          className="text-gray-400 hover:text-gray-600 transition-colors p-0.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
        </button>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            What would you like to do?
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Starting from: {selectedPreset?.label}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {cards.map((card) => (
          <button
            key={card.templateId}
            onClick={() => handleSelect(card)}
            className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 transition-colors text-left group"
          >
            <span className="text-lg flex-shrink-0">
              {ICON_MAP[card.icon]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 group-hover:text-blue-700 transition-colors">
                {card.label}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                {card.description}
              </div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors flex-shrink-0">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
