import React from "react";

interface State {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, State> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error("ErrorBoundary caught", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="m-8 p-6 rounded bg-red-100 text-red-800 dark:bg-red-900">
          <h2 className="text-lg font-semibold">Κάτι πήγε στραβά</h2>
          <p>{this.state.error?.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}
