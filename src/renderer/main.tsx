import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { reportError } from './diagnostics';
import './styles.css';

window.addEventListener('error', (event) =>
  reportError(event.error ?? event.message),
);
window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  reportError(event.reason);
});
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
