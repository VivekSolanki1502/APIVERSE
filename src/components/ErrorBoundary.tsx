import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from './Page';

interface Props {
  children: ReactNode;
  /** When this value changes (e.g. the route), the boundary resets. */
  resetKey?: string;
}

/** Keeps one broken page from blanking the whole app. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(prev: Props) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page error:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="container-page py-12">
        <ErrorState
          title="Something went wrong on this page"
          action={
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload page
            </button>
          }
        >
          The rest of APIverse is unaffected. Reloading usually fixes it; if it keeps happening, please report it.
        </ErrorState>
      </div>
    );
  }
}
