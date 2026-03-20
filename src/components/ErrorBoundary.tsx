import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = 'Something went wrong. Please try again later.';
      
      try {
        // Check if it's a Firestore error JSON
        if (this.state.error && this.state.error.message.startsWith('{')) {
          const errorData = JSON.parse(this.state.error.message);
          if (errorData.error.includes('insufficient permissions')) {
            errorMessage = 'You do not have permission to perform this action. Please sign in or check your account status.';
          }
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-paper p-8">
          <div className="max-w-md w-full bg-white p-12 rounded-[40px] shadow-xl border border-ink/5 text-center">
            <h2 className="serif text-3xl mb-4">An Error Occurred</h2>
            <p className="text-ink/60 mb-8">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-ink text-paper rounded-full font-medium hover:bg-ink/90 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
