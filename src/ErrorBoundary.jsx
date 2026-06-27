import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error('ErrorBoundary caught:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, info: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleCopy = () => {
    const text = `Error: ${this.state.error?.message || 'Unknown'}\n\n${this.state.info?.componentStack || ''}`;
    navigator.clipboard?.writeText(text);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-luxury-black text-luxury-foreground p-4">
          <div className="card-luxury max-w-md w-full text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-950/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-display font-bold text-gold-400 mb-2">Something went wrong</h2>
            <p className="text-luxury-muted text-sm mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={this.handleReload}
                className="btn-gold w-full flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reload Page
              </button>
              <button
                onClick={this.handleReset}
                className="btn-outline w-full"
              >
                Try Again
              </button>
              <button
                onClick={this.handleCopy}
                className="text-xs text-luxury-muted hover:text-gold-400 transition mt-2"
              >
                Copy error details
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
