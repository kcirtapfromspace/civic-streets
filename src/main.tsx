import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ConvexClientProvider } from '@/lib/api/convex-provider';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConvexClientProvider>
      <App />
    </ConvexClientProvider>
  </React.StrictMode>,
);
