import { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props { children: ReactNode }
interface State { error: Error | null }

/**
 * Catches render-time errors so a single buggy page doesn't blank the whole app.
 * The user can recover with the "حاول مرة أخرى" button (resets the boundary)
 * or hard reload.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // eslint-disable-next-line no-console
    console.error('UI error caught by boundary:', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-slate-50">
        <div className="max-w-md w-full bg-white border border-rose-200 rounded-2xl p-6 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 text-rose-600 grid place-items-center mb-3">
            <AlertTriangle size={24} />
          </div>
          <h2 className="text-lg font-bold mb-1">حدث خطأ غير متوقع</h2>
          <p className="text-xs text-slate-500 mb-4 break-words">
            {this.state.error.message}
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={this.reset}
              className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg"
            >
              حاول مرة أخرى
            </button>
            <button
              onClick={() => window.location.reload()}
              className="bg-slate-200 text-slate-700 text-sm px-4 py-2 rounded-lg"
            >
              إعادة تحميل
            </button>
          </div>
        </div>
      </div>
    );
  }
}
