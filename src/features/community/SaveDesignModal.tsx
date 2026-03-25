import React, { useState, useCallback, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Button, Select } from '@/components/ui';
import { useCommunityStore } from './community-store';
import { useHotspotsList } from '@/lib/api/use-hotspots';
import { getGovernmentContactHref, useBillingAccess } from '@/lib/billing/access';
import { useOrganizationContext } from '@/lib/api/organization';

// ── Types ─────────────────────────────────────────────────────────────────

interface SaveDesignData {
  title: string;
  description: string;
  address: string;
  linkedHotspotId: string;
  privacy: 'public' | 'private';
}

interface SaveDesignModalProps {
  /** Pre-filled from street name */
  initialTitle?: string;
  /** Location from map pin */
  address?: string;
  onSave?: (data: SaveDesignData) => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export function SaveDesignModal({
  initialTitle = '',
  address = '',
  onSave,
}: SaveDesignModalProps) {
  const { isSaveDesignOpen, closeSaveDesign, saveDesignData } = useCommunityStore();
  const { hotspots } = useHotspotsList();
  const navigate = useNavigate();
  const { canAccess: canUsePrivateProjects, contactHref } =
    useBillingAccess('private_projects');
  const { organization } = useOrganizationContext();

  const hotspotLinkOptions = [
    { value: '', label: 'None' },
    ...hotspots.map((h) => ({
      value: h.id,
      label: `${h.title} (${h.address.split(',')[0]})`,
    })),
  ];

  // Use saveDesignData from store if provided
  const effectiveTitle = saveDesignData?.title || initialTitle;
  const effectiveAddress = saveDesignData?.address || address;

  const [title, setTitle] = useState(effectiveTitle);
  const [description, setDescription] = useState('');
  const [linkedHotspotId, setLinkedHotspotId] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');
  const [isSaving, setIsSaving] = useState(false);

  const titleInputId = useId();
  const descId = useId();

  const handleUpgrade = useCallback(() => {
    navigate(contactHref || getGovernmentContactHref('private_projects'));
  }, [contactHref, navigate]);

  const handleSave = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim()) return;

      if (privacy === 'private' && !canUsePrivateProjects) {
        handleUpgrade();
        return;
      }

      setIsSaving(true);
      onSave?.({
        title: title.trim(),
        description: description.trim(),
        address: effectiveAddress,
        linkedHotspotId,
        privacy,
      });
      setIsSaving(false);
      closeSaveDesign();
    },
    [
      title,
      description,
      effectiveAddress,
      linkedHotspotId,
      privacy,
      onSave,
      closeSaveDesign,
      canUsePrivateProjects,
      handleUpgrade,
    ],
  );

  return (
    <Modal
      isOpen={isSaveDesignOpen}
      onClose={closeSaveDesign}
      title="Save & Share Design"
    >
      <form onSubmit={handleSave} className="space-y-4">
        {/* Title */}
        <div>
          <label
            htmlFor={titleInputId}
            className="block text-xs font-medium text-gray-600 mb-1"
          >
            Design Title
          </label>
          <input
            id={titleInputId}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Protected intersection at Oak & 5th"
            required
            maxLength={120}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          />
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor={descId}
            className="block text-xs font-medium text-gray-600 mb-1"
          >
            Description
          </label>
          <textarea
            id={descId}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your design and why it would improve this location..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 resize-none"
          />
        </div>

        {/* Location display */}
        {effectiveAddress && (
          <div>
            <span className="block text-xs font-medium text-gray-600 mb-1">
              Location
            </span>
            <div className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-400 shrink-0"
                aria-hidden="true"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {effectiveAddress}
            </div>
          </div>
        )}

        {/* Link to Hotspot */}
        <Select
          label="Link to Hotspot (optional)"
          value={linkedHotspotId}
          onChange={setLinkedHotspotId}
          options={hotspotLinkOptions}
        />

        {/* Privacy */}
        <fieldset>
          <legend className="text-xs font-medium text-gray-600 mb-2">
            Visibility
          </legend>
          <div className="flex gap-3">
            <label
              className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-md border cursor-pointer transition-colors ${
                privacy === 'public'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-700'
              }`}
            >
              <input
                type="radio"
                name="privacy"
                value="public"
                checked={privacy === 'public'}
                onChange={() => setPrivacy('public')}
                className="sr-only"
              />
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
              </svg>
              Public
            </label>
            <label
              onClick={(e) => {
                if (!canUsePrivateProjects) {
                  e.preventDefault();
                  handleUpgrade();
                }
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-md border transition-colors ${
                canUsePrivateProjects
                  ? 'cursor-pointer'
                  : 'cursor-not-allowed opacity-80'
              } ${
                privacy === 'private'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-700'
              }`}
            >
              <input
                type="radio"
                name="privacy"
                value="private"
                checked={privacy === 'private'}
                onChange={() => {
                  if (canUsePrivateProjects) {
                    setPrivacy('private');
                  } else {
                    handleUpgrade();
                  }
                }}
                disabled={!canUsePrivateProjects}
                className="sr-only"
              />
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              Private
              {!canUsePrivateProjects && (
                <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                  Gov
                </span>
              )}
            </label>
          </div>
          {privacy === 'private' && (
            <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              Saved to{' '}
              <span className="font-semibold text-slate-900">
                {organization?.workspaceName ?? 'Shared Workspace'}
              </span>{' '}
              in{' '}
              <span className="font-semibold text-slate-900">
                {organization?.name ?? 'your organization'}
              </span>
              .
            </div>
          )}
          {!canUsePrivateProjects && (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-800">
                Private designs are enabled after municipal onboarding.
              </p>
              <Button
                type="button"
                variant="ghost"
                onClick={handleUpgrade}
                className="shrink-0 text-amber-900 hover:bg-amber-100"
              >
                Contact Curbwise
              </Button>
            </div>
          )}
        </fieldset>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={closeSaveDesign}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save & Share'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
