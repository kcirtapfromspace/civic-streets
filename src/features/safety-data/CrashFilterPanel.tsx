import { useSafetyDataStore } from './safety-data-store';
import { useMapStore } from '@/features/map/map-store';
import {
  MODE_LABELS,
  SEVERITY_LABELS,
  SEVERITY_COLORS,
  type CrashMode,
  type CrashSeverity,
} from '@/lib/types/safety-data';

const ALL_MODES: CrashMode[] = ['pedestrian', 'cyclist', 'motorist'];
const ALL_SEVERITIES: CrashSeverity[] = ['fatal', 'severe-injury', 'moderate-injury', 'minor'];

const MODE_COLORS: Record<CrashMode, string> = {
  pedestrian: '#8B5CF6',
  cyclist: '#10B981',
  motorist: '#3B82F6',
};

export function CrashFilterPanel() {
  const enabled = useSafetyDataStore((s) => s.enabled);
  const filters = useSafetyDataStore((s) => s.filters);
  const crashes = useSafetyDataStore((s) => s.crashes);
  const isLoading = useSafetyDataStore((s) => s.isLoading);
  const zoom = useMapStore((s) => s.zoom);
  const showHeatmap = useSafetyDataStore((s) => s.showHeatmap);
  const showPoints = useSafetyDataStore((s) => s.showPoints);
  const toggleMode = useSafetyDataStore((s) => s.toggleMode);
  const toggleSeverity = useSafetyDataStore((s) => s.toggleSeverity);
  const toggleHeatmap = useSafetyDataStore((s) => s.toggleHeatmap);
  const togglePoints = useSafetyDataStore((s) => s.togglePoints);

  if (!enabled) return null;

  return (
    <div className="absolute top-4 left-[420px] z-10 animate-fade-up">
      <div className="bg-gray-900/92 backdrop-blur-xl rounded-2xl shadow-[0_8px_48px_rgba(0,0,0,0.3)] ring-1 ring-white/[0.08] p-3.5 flex flex-col gap-3 min-w-[200px]">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em]">
            Crash Data
          </div>
          {isLoading && (
            <div className="w-3 h-3 border-2 border-orange-400/40 border-t-orange-400 rounded-full animate-spin" />
          )}
        </div>

        <div className="text-[10px] text-gray-500">
          {crashes.length === 0 && !isLoading && zoom < 11
            ? 'Zoom in to see crash data'
            : `${crashes.length.toLocaleString()} crashes loaded`}
        </div>

        {/* Layer toggles */}
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showHeatmap}
              onChange={toggleHeatmap}
              className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500"
            />
            <span className="text-[11px] text-gray-300">Heatmap</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showPoints}
              onChange={togglePoints}
              className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-[11px] text-gray-300">Crash Points</span>
          </label>
        </div>

        <div className="border-t border-white/[0.06] pt-2">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-2">
            Mode
          </div>
          <div className="flex flex-col gap-1.5">
            {ALL_MODES.map((mode) => (
              <label key={mode} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.modes.has(mode)}
                  onChange={() => toggleMode(mode)}
                  className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800"
                  style={{ accentColor: MODE_COLORS[mode] }}
                />
                <span className="flex items-center gap-1.5 text-[11px] text-gray-400 group-hover:text-gray-200">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: MODE_COLORS[mode] }}
                  />
                  {MODE_LABELS[mode]}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="border-t border-white/[0.06] pt-2">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-2">
            Severity
          </div>
          <div className="flex flex-col gap-1.5">
            {ALL_SEVERITIES.map((sev) => (
              <label key={sev} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.severities.has(sev)}
                  onChange={() => toggleSeverity(sev)}
                  className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800"
                  style={{ accentColor: SEVERITY_COLORS[sev] }}
                />
                <span className="flex items-center gap-1.5 text-[11px] text-gray-400 group-hover:text-gray-200">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: SEVERITY_COLORS[sev] }}
                  />
                  {SEVERITY_LABELS[sev]}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
