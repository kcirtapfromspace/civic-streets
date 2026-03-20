// Rep Lookup — finds local government representatives by address
// Uses Google Civic Information API; falls back to mock data in demo mode

import React, { useState, useCallback } from 'react';
import type { RepInfo } from '@/lib/types';
import { Button, Badge } from '@/components/ui';
import { RepCard } from './RepCard';
import { MOCK_REPS } from './mock-reps';

interface RepLookupProps {
  initialAddress?: string;
  selectedReps: RepInfo[];
  onSelectRep: (rep: RepInfo) => void;
  onDeselectRep: (repName: string) => void;
}

interface CivicApiOfficial {
  name: string;
  party?: string;
  phones?: string[];
  emails?: string[];
  photoUrl?: string;
  urls?: string[];
}

interface CivicApiOffice {
  name: string;
  divisionId: string;
  officialIndices: number[];
}

interface CivicApiResponse {
  offices: CivicApiOffice[];
  officials: CivicApiOfficial[];
}

function parseApiResponse(data: CivicApiResponse): RepInfo[] {
  const reps: RepInfo[] = [];

  for (const office of data.offices) {
    for (const idx of office.officialIndices) {
      const official = data.officials[idx];
      if (!official) continue;

      reps.push({
        name: official.name,
        title: office.name,
        email: official.emails?.[0],
        phone: official.phones?.[0],
        photoUrl: official.photoUrl,
        office: office.name,
      });
    }
  }

  return reps;
}

export function RepLookup({
  initialAddress = '',
  selectedReps,
  onSelectRep,
  onDeselectRep,
}: RepLookupProps) {
  const [address, setAddress] = useState(initialAddress);
  const [reps, setReps] = useState<RepInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    const trimmed = address.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setDemoMode(false);
    setSearched(true);

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      setReps(MOCK_REPS);
      setDemoMode(true);
      setLoading(false);
      return;
    }

    try {
      const url = `https://www.googleapis.com/civicinfo/v2/representatives?key=${encodeURIComponent(apiKey)}&address=${encodeURIComponent(trimmed)}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      const data: CivicApiResponse = await res.json();
      const parsed = parseApiResponse(data);

      if (parsed.length === 0) {
        throw new Error('No representatives found for this address.');
      }

      setReps(parsed);
    } catch (err) {
      console.warn('[RepLookup] Civic API failed, using demo data:', err);
      setReps(MOCK_REPS);
      setDemoMode(true);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to look up representatives.',
      );
    } finally {
      setLoading(false);
    }
  }, [address]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleToggle = (rep: RepInfo) => {
    if (selectedReps.some((r) => r.name === rep.name)) {
      onDeselectRep(rep.name);
    } else {
      onSelectRep(rep);
    }
  };

  return (
    <div className="space-y-4">
      {/* Address input */}
      <div>
        <label
          htmlFor="rep-address"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Address
        </label>
        <div className="flex gap-2">
          <input
            id="rep-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter a street address..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          />
          <Button
            variant="primary"
            onClick={handleSearch}
            disabled={loading || !address.trim()}
          >
            {loading ? 'Searching...' : 'Find My Reps'}
          </Button>
        </div>
      </div>

      {/* Demo mode banner */}
      {demoMode && (
        <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
          <Badge variant="warning">Demo Mode</Badge>
          <p className="text-xs text-amber-800">
            Showing sample representatives. Set <code className="font-mono">VITE_GOOGLE_MAPS_API_KEY</code> to look up real officials.
          </p>
        </div>
      )}

      {/* Error (non-demo) */}
      {error && !demoMode && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {/* Results */}
      {reps.length > 0 && (
        <div>
          <p className="text-sm text-gray-600 mb-2">
            {reps.length} representative{reps.length === 1 ? '' : 's'} found
            {selectedReps.length > 0 && (
              <span className="ml-1 font-medium text-blue-600">
                — {selectedReps.length} selected
              </span>
            )}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {reps.map((rep) => (
              <RepCard
                key={rep.name}
                rep={rep}
                selected={selectedReps.some((r) => r.name === rep.name)}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {searched && !loading && reps.length === 0 && !error && (
        <p className="text-sm text-gray-500 text-center py-4">
          No representatives found. Try a different address.
        </p>
      )}
    </div>
  );
}
