import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex items-center justify-center h-full bg-gray-50">
      <div className="text-center space-y-4 px-4">
        <p className="text-6xl font-bold text-gray-300">404</p>
        <h1 className="text-2xl font-bold text-gray-900">Page Not Found</h1>
        <p className="text-gray-500 max-w-md mx-auto">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          Back to Map
        </Link>
      </div>
    </div>
  );
}
