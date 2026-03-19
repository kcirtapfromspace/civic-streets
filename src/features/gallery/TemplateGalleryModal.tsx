'use client';

import React, { useState, useMemo } from 'react';
import { useStreetStore } from '@/stores/street-store';
import type {
  TemplateDefinition,
  FunctionalClass,
} from '@/lib/types';
import { Modal, Select } from '@/components/ui';
import { TemplateCard } from './TemplateCard';
import { loadTemplates } from '@/lib/templates';

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'road-diet', label: 'Road Diet' },
  { value: 'protected-bike', label: 'Protected Bike' },
  { value: 'transit-priority', label: 'Transit Priority' },
  { value: 'complete-street', label: 'Complete Street' },
  { value: 'shared-street', label: 'Shared Street' },
];

const FUNCTIONAL_CLASS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Classes' },
  { value: 'local', label: 'Local' },
  { value: 'collector', label: 'Collector' },
  { value: 'minor-arterial', label: 'Minor Arterial' },
  { value: 'major-arterial', label: 'Major Arterial' },
];

export function TemplateGalleryModal() {
  const isOpen = useStreetStore((s) => s.isTemplateGalleryOpen);
  const closeGallery = useStreetStore((s) => s.closeTemplateGallery);
  const applyTemplate = useStreetStore((s) => s.applyTemplate);
  const currentStreet = useStreetStore((s) => s.currentStreet);

  const [categoryFilter, setCategoryFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const templates: TemplateDefinition[] = useMemo(() => loadTemplates(), []);

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (categoryFilter !== 'all' && t.category !== categoryFilter) {
        return false;
      }
      if (
        classFilter !== 'all' &&
        !t.applicableFunctionalClasses.includes(
          classFilter as FunctionalClass,
        )
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = t.name.toLowerCase().includes(q);
        const matchesDesc = t.description.toLowerCase().includes(q);
        const matchesTags = t.tags.some((tag) =>
          tag.toLowerCase().includes(q),
        );
        if (!matchesName && !matchesDesc && !matchesTags) return false;
      }
      return true;
    });
  }, [templates, categoryFilter, classFilter, searchQuery]);

  const DEFAULT_ELEMENT_COUNT = 5;

  const handleApply = (template: TemplateDefinition) => {
    // If the user has modified the design (more elements than the default),
    // confirm before replacing it.
    const elementCount = currentStreet?.elements.length ?? 0;
    if (elementCount > DEFAULT_ELEMENT_COUNT) {
      const confirmed = window.confirm(
        'Applying this template will replace your current design. ' +
          "Your current design will be saved as the 'before' view. Continue?",
      );
      if (!confirmed) return;
    }

    const rowWidth = currentStreet?.totalROWWidth ?? 66;
    applyTemplate(template, rowWidth);
  };

  return (
    <Modal isOpen={isOpen} onClose={closeGallery} title="Template Gallery">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="flex-1 min-w-[200px]">
          <label
            htmlFor="template-search"
            className="text-xs font-medium text-gray-600 block mb-1"
          >
            Search templates
          </label>
          <input
            id="template-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or tags..."
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          />
        </div>
        <Select
          label="Category"
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={CATEGORY_OPTIONS}
        />
        <Select
          label="Functional Class"
          value={classFilter}
          onChange={setClassFilter}
          options={FUNCTIONAL_CLASS_FILTER_OPTIONS}
        />
      </div>

      {/* Template grid */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          No templates match your filters. Try adjusting your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onApply={handleApply}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}
