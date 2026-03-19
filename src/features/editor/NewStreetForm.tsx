'use client';

import React, { useState } from 'react';
import { useStreetStore } from '@/stores/street-store';
import { COMMON_ROW_WIDTHS, UNITS } from '@/lib/constants';
import { Button, Select } from '@/components/ui';
import type { FunctionalClass, StreetDirection } from '@/lib/types';

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

export function NewStreetForm() {
  const createNewStreet = useStreetStore((s) => s.createNewStreet);

  const [name, setName] = useState('Main Street');
  const [rowWidth, setRowWidth] = useState('66');
  const [functionalClass, setFunctionalClass] =
    useState<FunctionalClass>('collector');
  const [direction, setDirection] = useState<StreetDirection>('two-way');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createNewStreet(name.trim(), Number(rowWidth), functionalClass, direction);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
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
      </div>
    </div>
  );
}
