import { Component } from 'react';
import type { ReactNode } from 'react';
import { reportError } from './diagnostics';

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    reportError(error, 'boundary');
  }
  render() {
    if (this.state.failed)
      return (
        <main className="fatal">
          <h1>Unable to display this screen</h1>
          <p>
            Please reload the companion to recover the last committed campaign.
            Unsaved draft edits may be lost.
          </p>
          <button onClick={() => window.location.reload()}>
            Reload application
          </button>
        </main>
      );
    return this.props.children;
  }
}
