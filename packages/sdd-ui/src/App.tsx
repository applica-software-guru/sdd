import React from 'react';
import { getConfig } from './config.ts';
import { SpecPanel } from './panels/SpecPanel.tsx';
import { PreviewPanel } from './panels/PreviewPanel.tsx';

const config = getConfig();

export default function App() {
  return (
    <div style={{
      display: 'flex',
      height: '100%',
      background: '#000',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* Left — Spec */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, borderRight: '1px solid #2a2a2a' }}>
        <PanelHeader label="Spec Reference" dim />
        <div style={{ flex: 1, overflow: 'auto' }}>
          <SpecPanel config={config} />
        </div>
      </div>

      {/* Right — Preview */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <PanelHeader label={`Preview — ${config.componentName}`} />
        <div style={{ flex: 1, overflow: 'auto', background: '#fff' }}>
          <PreviewPanel config={config} />
        </div>
      </div>
    </div>
  );
}

function PanelHeader({ label, dim }: { label: string; dim?: boolean }) {
  return (
    <div style={{
      height: '40px',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      background: '#111',
      borderBottom: '1px solid #222',
      flexShrink: 0,
    }}>
      <span style={{
        fontSize: '12px',
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: dim ? '#555' : '#aaa',
      }}>
        {label}
      </span>
    </div>
  );
}
