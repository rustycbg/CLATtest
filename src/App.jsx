import { useState } from 'react';
import ClatModel from './pages/ClatModel';
import FamilyLLCModeler from './pages/FamilyLLCModeler';

const tabs = [
  { id: 'clat', label: 'CLAT Model' },
  { id: 'llc',  label: 'LLC Installment Sale' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('clat');

  return (
    <>
      {/* ── Persistent tab navigation ── */}
      <nav style={{
        background: '#152d4a',
        display: 'flex',
        alignItems: 'stretch',
        padding: '0 40px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id
                ? '3px solid #4a9eff'
                : '3px solid transparent',
              color: activeTab === tab.id
                ? 'white'
                : 'rgba(255,255,255,0.5)',
              padding: '13px 20px',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '0.03em',
              transition: 'color 0.15s, border-bottom-color 0.15s',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              textTransform: 'uppercase',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* ── Tab content ── */}
      {activeTab === 'clat' && <ClatModel />}
      {activeTab === 'llc'  && <FamilyLLCModeler />}
    </>
  );
}
