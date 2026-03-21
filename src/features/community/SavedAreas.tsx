import { useCallback, useSyncExternalStore } from 'react';
import type { Bounds } from './explorer-store';

export interface SavedArea {
  name: string;
  bounds?: Bounds;
  polygon?: [number, number][];
}

const STORAGE_KEY = 'curbwise-saved-areas';
const MAX_AREAS = 10;

// Simple external store for localStorage so React re-renders on changes
let listeners: Array<() => void> = [];
function emitChange() {
  for (const l of listeners) l();
}

function getAreas(): SavedArea[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setAreas(areas: SavedArea[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(areas));
  emitChange();
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): SavedArea[] {
  return getAreas();
}

interface SavedAreasProps {
  onApply: (area: SavedArea) => void;
}

export function SavedAreas({ onApply }: SavedAreasProps) {
  const areas = useSyncExternalStore(subscribe, getSnapshot);

  const handleDelete = useCallback((index: number) => {
    const current = getAreas();
    current.splice(index, 1);
    setAreas(current);
  }, []);

  if (areas.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {areas.map((area, i) => (
        <button
          key={`${area.name}-${i}`}
          onClick={() => onApply(area)}
          className="group inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
        >
          {area.name}
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(i);
            }}
            className="ml-0.5 text-blue-400 hover:text-blue-700 text-xs"
          >
            ✕
          </span>
        </button>
      ))}
    </div>
  );
}

/** Save a new area to localStorage. Returns false if at max capacity. */
export function saveArea(area: SavedArea): boolean {
  const current = getAreas();
  if (current.length >= MAX_AREAS) return false;
  setAreas([...current, area]);
  return true;
}

/** Prompt the user for a name and save the area. */
export function promptAndSaveArea(opts: { bounds?: Bounds; polygon?: [number, number][] }): boolean {
  const name = window.prompt('Name this area:');
  if (!name?.trim()) return false;
  return saveArea({ name: name.trim(), ...opts });
}
