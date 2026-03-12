import React, { useEffect, useState, Suspense, lazy, useRef } from 'react';
import type { SddUiConfig } from '../config.ts';

interface Props {
  config: SddUiConfig;
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    padding: '24px',
    minHeight: '100%',
    background: '#fff',
    color: '#000',
  },
  error: {
    padding: '16px',
    color: '#dc2626',
    background: '#fff1f1',
    fontSize: '13px',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    borderLeft: '3px solid #dc2626',
  },
  empty: {
    padding: '16px',
    color: '#666',
    fontSize: '13px',
    fontStyle: 'italic',
    background: '#fff',
  },
};

function useComponentModule(componentPath: string) {
  const [Component, setComponent] = useState<React.ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastPath = useRef<string>('');

  useEffect(() => {
    if (!componentPath) return;
    if (componentPath === lastPath.current) return;
    lastPath.current = componentPath;

    setError(null);

    // Use Vite's /@fs/ prefix to load files from arbitrary filesystem paths
    const url = `/@fs${componentPath}`;

    import(/* @vite-ignore */ url)
      .then((mod) => {
        const Comp = mod.default ?? mod[Object.keys(mod)[0]];
        if (typeof Comp !== 'function') {
          throw new Error(`No default export found in ${componentPath}`);
        }
        setComponent(() => Comp as React.ComponentType);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
        setComponent(null);
      });
  }, [componentPath]);

  return { Component, error };
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }

  render() {
    if (this.state.error) {
      return <div style={styles.error}>Runtime error: {this.state.error}</div>;
    }
    return this.props.children;
  }
}

export function PreviewPanel({ config }: Props) {
  const { Component, error } = useComponentModule(config.componentPath);

  if (!config.componentPath) {
    return <div style={styles.empty}>No component path configured.</div>;
  }

  if (error) {
    return <div style={styles.error}>Import error: {error}</div>;
  }

  if (!Component) {
    return <div style={styles.empty}>Loading component…</div>;
  }

  return (
    <div style={styles.wrapper}>
      <ErrorBoundary>
        <Suspense fallback={<div style={styles.empty}>Rendering…</div>}>
          <Component />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
