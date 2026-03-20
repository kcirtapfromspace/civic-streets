
import React, { useState } from 'react';
import { useStreetStore } from '@/stores/street-store';
import { COMMON_ROW_WIDTHS, UNITS } from '@/lib/constants';
import { Button, Select } from '@/components/ui';
import type { FunctionalClass, StreetDirection } from '@/lib/types';
import { loadHeroes, type HeroExample } from '@/lib/heroes';

const FUNCTIONAL_CLASS_OPTIONS = [
  { value: 'local', label: 'Local' },
  { value: 'collector', label: 'Collector' },
  { value: 'minor-arterial', label: 'Minor Arterial' },
  { value: 'major-arterial', label: 'Major Arterial' },
];

const DIRECTION_OPTIONS = [
  { value: 'two-way', label: 'Two-Way' },
  { value: 'one-way', label: 'One-Way' },
];

const ROW_WIDTH_OPTIONS = COMMON_ROW_WIDTHS.map((w) => ({
  value: String(w),
  label: `${w} ${UNITS.label}`,
}));

const HERO_ICONS: Record<string, string> = {
  'hero-road-diet': 'Road Diet',
  'hero-protected-bike': 'Bike Infra',
  'hero-transit-priority': 'Transit',
};

const HERO_COLORS: Record<string, string> = {
  'hero-road-diet': 'border-amber-400 bg-amber-50',
  'hero-protected-bike': 'border-green-400 bg-green-50',
  'hero-transit-priority': 'border-blue-400 bg-blue-50',
};

const HERO_TAG_COLORS: Record<string, string> = {
  'hero-road-diet': 'bg-amber-100 text-amber-800',
  'hero-protected-bike': 'bg-green-100 text-green-800',
  'hero-transit-priority': 'bg-blue-100 text-blue-800',
};

function HeroCard({
  hero,
  onSelect,
}: {
  hero: HeroExample;
  onSelect: (hero: HeroExample) => void;
}) {
  const id = hero.segment.id;
  return (
    <button
      type="button"
      onClick={() => onSelect(hero)}
      aria-label={`Start from example: ${hero.segment.name}`}
      className={`w-full text-left border-2 rounded-lg p-4 transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${HERO_COLORS[id] ?? 'border-gray-300 bg-gray-50'}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${HERO_TAG_COLORS[id] ?? 'bg-gray-200 text-gray-700'}`}
        >
          {HERO_ICONS[id] ?? 'Example'}
        </span>
        <span className="text-xs text-gray-500">
          {hero.segment.totalROWWidth} ft ROW
        </span>
      </div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">
        {hero.segment.name}
      </h3>
      <p className="text-xs text-gray-600 mb-2 line-clamp-2">
        {hero.description}
      </p>
      <ul className="space-y-0.5">
        {hero.highlights.slice(0, 3).map((h, i) => (
          <li key={i} className="text-xs text-gray-500 flex items-start gap-1">
            <span className="text-gray-500 mt-px shrink-0" aria-hidden="true">--</span>
            <span>{h}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}

export function NewStreetForm() {
  const setStreet = useStreetStore((s) => s.setStreet);
  const setBeforeStreet = useStreetStore((s) => s.setBeforeStreet);
  const createNewStreet = useStreetStore((s) => s.createNewStreet);

  const [name, setName] = useState('Main Street');
  const [rowWidth, setRowWidth] = useState('66');
  const [functionalClass, setFunctionalClass] =
    useState<FunctionalClass>('collector');
  const [direction, setDirection] = useState<StreetDirection>('two-way');

  const heroes = loadHeroes();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createNewStreet(name.trim(), Number(rowWidth), functionalClass, direction);
  };

  const handleHeroSelect = (hero: HeroExample) => {
    setStreet(hero.segment);
    setBeforeStreet(hero.before);
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Street Copilot</h1>
          <p className="text-gray-500 mt-2">
            Design standards-compliant cross-sections with NACTO and PROWAG
            guidance built in.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold text-gray-800">
            New Street Design
          </h2>

          <div>
            <label
              htmlFor="new-street-name"
              className="text-sm font-medium text-gray-700 block mb-1"
            >
              Street Name
            </label>
            <input
              id="new-street-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Main Street"
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>

          <Select
            label="Right-of-Way Width"
            value={rowWidth}
            onChange={setRowWidth}
            options={ROW_WIDTH_OPTIONS}
          />

          <Select
            label="Functional Classification"
            value={functionalClass}
            onChange={(v) => setFunctionalClass(v as FunctionalClass)}
            options={FUNCTIONAL_CLASS_OPTIONS}
          />

          <Select
            label="Direction"
            value={direction}
            onChange={(v) => setDirection(v as StreetDirection)}
            options={DIRECTION_OPTIONS}
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full py-2.5"
          >
            Create Street
          </Button>
        </form>

        {/* ── Start from Example ──────────────────────────────────── */}
        <div className="mt-6" role="region" aria-label="Example street designs">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-gray-200" aria-hidden="true" />
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              or start from an example
            </h2>
            <div className="h-px flex-1 bg-gray-200" aria-hidden="true" />
          </div>

          <div className="grid gap-3">
            {heroes.map((hero) => (
              <HeroCard
                key={hero.segment.id}
                hero={hero}
                onSelect={handleHeroSelect}
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
