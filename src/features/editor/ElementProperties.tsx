'use client';

import React from 'react';
import { useStreetStore } from '@/stores/street-store';
import { ELEMENT_COLORS, UNITS } from '@/lib/constants';
import { NumberInput } from '@/components/ui';

export function ElementProperties() {
  const currentStreet = useStreetStore((s) => s.currentStreet);
  const selectedElementId = useStreetStore((s) => s.selectedElementId);
  const updateElement = useStreetStore((s) => s.updateElement);

  if (!currentStreet || !selectedElementId) {
    return (
      <div className="p-4">
        <h2 className="sr-only">Element Properties</h2>
        <p className="text-sm text-gray-500 italic">
          Select an element to view its properties.
        </p>
      </div>
    );
  }

  const element = currentStreet.elements.find(
    (el) => el.id === selectedElementId,
  );
  if (!element) return null;

  const color = ELEMENT_COLORS[element.type];
  const c = element.constraints;

  return (
    <div className="p-4 space-y-4" role="region" aria-label={`Properties for ${element.label || color.label}`}>
      <h2 className="sr-only">Element Properties</h2>
      <div className="flex items-center gap-2">
        <span
          className="w-4 h-4 rounded border"
          style={{ backgroundColor: color.fill, borderColor: color.stroke }}
          aria-hidden="true"
        />
        <h3 className="text-sm font-semibold text-gray-800">
          {element.label || color.label}
        </h3>
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-500">Type</dt>
          <dd className="text-gray-800 font-medium">{color.label}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">Side</dt>
          <dd className="text-gray-800 font-medium capitalize">
            {element.side}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">Locked</dt>
          <dd className="text-gray-800 font-medium">
            {element.locked ? 'Yes' : 'No'}
          </dd>
        </div>
      </dl>

      <div className="border-t border-gray-200 pt-3">
        <NumberInput
          label={`Width (${UNITS.primary})`}
          value={element.width}
          onChange={(w) => updateElement(element.id, { width: w })}
          min={c.absoluteMin}
          max={c.absoluteMax}
          step={0.5}
          suffix={UNITS.primary}
        />

        {/* Width slider */}
        <div className="mt-3">
          <label
            htmlFor={`slider-${element.id}`}
            className="text-xs font-medium text-gray-600 block mb-1"
          >
            Adjust width
          </label>
          <input
            id={`slider-${element.id}`}
            type="range"
            min={c.absoluteMin}
            max={c.absoluteMax}
            step={0.5}
            value={element.width}
            onChange={(e) =>
              updateElement(element.id, {
                width: parseFloat(e.target.value),
              })
            }
            className="w-full accent-blue-600"
            aria-valuemin={c.absoluteMin}
            aria-valuemax={c.absoluteMax}
            aria-valuenow={element.width}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-0.5">
            <span>{c.absoluteMin} {UNITS.primary}</span>
            <span>{c.absoluteMax} {UNITS.primary}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-3">
        <h4 className="text-xs font-semibold text-gray-600 mb-2">
          Constraint Ranges
        </h4>
        <dl className="space-y-1.5 text-xs">
          {c.prowagRequired && (
            <div className="flex justify-between">
              <dt className="text-red-600 font-medium">PROWAG min</dt>
              <dd className="text-gray-800">{c.absoluteMin} {UNITS.primary}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-gray-500">Absolute min</dt>
            <dd className="text-gray-800">{c.absoluteMin} {UNITS.primary}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">NACTO rec. min</dt>
            <dd className="text-gray-800">
              {c.recommendedMin} {UNITS.primary}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">NACTO recommended</dt>
            <dd className="text-gray-800">{c.recommended} {UNITS.primary}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Absolute max</dt>
            <dd className="text-gray-800">{c.absoluteMax} {UNITS.primary}</dd>
          </div>
        </dl>
        <p className="text-xs text-gray-500 mt-2 italic">
          Source: {c.source}
        </p>
      </div>
    </div>
  );
}
