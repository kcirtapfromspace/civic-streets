interface SearchThisAreaProps {
  onSearch: () => void;
  visible: boolean;
}

export function SearchThisArea({ onSearch, visible }: SearchThisAreaProps) {
  if (!visible) return null;

  return (
    <button
      onClick={onSearch}
      className="absolute top-3 left-1/2 -translate-x-1/2 z-10 rounded-full bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-lg hover:bg-gray-50 transition-colors"
    >
      Search this area
    </button>
  );
}
