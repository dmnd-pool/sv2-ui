import { Component, Suspense, type ReactNode } from 'react';
import { useLocation } from 'wouter';

interface BoundaryProps {
  children: ReactNode;
  resetKey: string;
}

class PageErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previousProps: BoundaryProps) {
    if (this.state.failed && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <div role="alert" className="p-6">
          <p>Couldn't load this page.</p>
          <button type="button" className="mt-3 underline" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Keep the surrounding providers and dashboard mounted while a new page downloads. */
export function PageBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return (
    <PageErrorBoundary resetKey={location}>
      <Suspense fallback={
        <div role="status" className="flex min-h-40 items-center justify-center p-6">
          <span aria-hidden="true" className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary motion-reduce:animate-none" />
          <span className="sr-only">Loading page…</span>
        </div>
      }>
        {children}
      </Suspense>
    </PageErrorBoundary>
  );
}
