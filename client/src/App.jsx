import React, { useState, useEffect } from 'react';
import axios from 'axios';

const styles = {
  app: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    padding: '24px',
    fontFamily: "'Segoe UI', sans-serif",
  },
  container: {
    maxWidth: '860px',
    margin: '0 auto',
  },
  header: {
    textAlign: 'center',
    marginBottom: '36px',
  },
  title: {
    fontSize: '2.4rem',
    fontWeight: '800',
    background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: '8px',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: '1rem',
  },
  card: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '20px',
    padding: '32px',
    marginBottom: '28px',
    backdropFilter: 'blur(10px)',
  },
  sectionTitle: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: '#38bdf8',
    marginBottom: '20px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  timeDisplay: {
    background: 'rgba(56,189,248,0.08)',
    border: '2px solid rgba(56,189,248,0.3)',
    borderRadius: '14px',
    padding: '20px 24px',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
  },
  timeValue: {
    fontSize: '2rem',
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: '0.05em',
  },
  timeMeta: {
    color: '#94a3b8',
    fontSize: '0.85rem',
    marginTop: '4px',
  },
  badge: {
    background: 'rgba(56,189,248,0.15)',
    color: '#38bdf8',
    border: '1px solid rgba(56,189,248,0.3)',
    borderRadius: '20px',
    padding: '4px 14px',
    fontSize: '0.78rem',
    fontWeight: '600',
  },
  manualSection: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    color: '#94a3b8',
    fontSize: '0.875rem',
    marginBottom: '8px',
    fontWeight: '600',
  },
  inputRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  input: {
    flex: '1',
    minWidth: '160px',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '10px',
    padding: '12px 16px',
    color: '#e2e8f0',
    fontSize: '1rem',
    outline: 'none',
  },
  inputLabel: {
    flex: '2',
    minWidth: '200px',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '10px',
    padding: '12px 16px',
    color: '#e2e8f0',
    fontSize: '1rem',
    outline: 'none',
  },
  btnPrimary: {
    width: '100%',
    padding: '16px',
    background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '1.1rem',
    fontWeight: '800',
    cursor: 'pointer',
    letterSpacing: '0.05em',
    transition: 'opacity 0.2s',
    marginTop: '8px',
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  successMsg: {
    background: 'rgba(34,197,94,0.12)',
    border: '1px solid rgba(34,197,94,0.3)',
    color: '#4ade80',
    borderRadius: '10px',
    padding: '12px 16px',
    marginTop: '14px',
    fontSize: '0.9rem',
    fontWeight: '600',
  },
  errorMsg: {
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#f87171',
    borderRadius: '10px',
    padding: '12px 16px',
    marginTop: '14px',
    fontSize: '0.9rem',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    color: '#38bdf8',
    fontSize: '0.8rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderBottom: '2px solid rgba(255,255,255,0.08)',
  },
  td: {
    padding: '14px 16px',
    color: '#e2e8f0',
    fontSize: '0.95rem',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    verticalAlign: 'middle',
  },
  deleteBtn: {
    background: 'rgba(239,68,68,0.15)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#f87171',
    borderRadius: '8px',
    padding: '6px 14px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: '600',
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px 24px',
    color: '#475569',
  },
  emptyIcon: {
    fontSize: '3rem',
    marginBottom: '12px',
  },
  statsRow: {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px',
    flexWrap: 'wrap',
  },
  statBox: {
    flex: '1',
    minWidth: '140px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    padding: '18px',
    textAlign: 'center',
  },
  statNum: {
    fontSize: '2rem',
    fontWeight: '800',
    color: '#818cf8',
  },
  statLabel: {
    color: '#64748b',
    fontSize: '0.8rem',
    marginTop: '4px',
  },
};

function getLocalTime() {
  const now = new Date();
  return {
    time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    date: now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    iso: now.toISOString(),
  };
}

export default function App() {
  const [currentTime, setCurrentTime] = useState(getLocalTime());
  const [manualTime, setManualTime] = useState('');
  const [manualDate, setManualDate] = useState('');
  const [label, setLabel] = useState('');
  const [useManual, setUseManual] = useState(false);
  const [punches, setPunches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // Live clock update
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(getLocalTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch all punches on load
  useEffect(() => {
    fetchPunches();
  }, []);

  async function fetchPunches() {
    try {
      setFetchLoading(true);
      const res = await axios.get('/api/punches');
      setPunches(res.data.punches || []);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load punch records. Check your connection.' });
    } finally {
      setFetchLoading(false);
    }
  }

  async function handlePunchIn() {
    setLoading(true);
    setMessage(null);

    try {
      let payload;
      if (useManual) {
        if (!manualTime || !manualDate) {
          setMessage({ type: 'error', text: 'Please enter both date and time for manual entry.' });
          setLoading(false);
          return;
        }
        payload = {
          time: manualTime,
          date: manualDate,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          source: 'manual',
          label: label || 'Punch In',
        };
      } else {
        const t = getLocalTime();
        payload = {
          time: t.time,
          date: t.date,
          timezone: t.timezone,
          source: 'auto',
          label: label || 'Punch In',
        };
      }

      await axios.post('/api/punch', payload);
      setMessage({ type: 'success', text: `✅ Punched in at ${payload.time} on ${payload.date}` });
      setLabel('');
      setManualTime('');
      setManualDate('');
      fetchPunches();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save punch. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this punch record?')) return;
    try {
      await axios.delete(`/api/punch/${encodeURIComponent(id)}`);
      fetchPunches();
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete record.' });
    }
  }

  const todayCount = punches.filter(p => {
    const today = new Date().toDateString();
    return new Date(p.createdAt).toDateString() === today;
  }).length;

  return (
    <div style={styles.app}>
      <div style={styles.container}>

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.title}>⏱ Punch Tracker</div>
          <div style={styles.subtitle}>Track your punch-in times with ease</div>
        </div>

        {/* Stats */}
        <div style={styles.statsRow}>
          <div style={styles.statBox}>
            <div style={styles.statNum}>{punches.length}</div>
            <div style={styles.statLabel}>Total Records</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statNum}>{todayCount}</div>
            <div style={styles.statLabel}>Today's Punches</div>
          </div>
          <div style={styles.statBox}>
            <div style={{ ...styles.statNum, color: '#38bdf8' }}>
              {currentTime.timezone?.split('/')[1]?.replace('_', ' ') || 'Local'}
            </div>
            <div style={styles.statLabel}>Your Timezone</div>
          </div>
        </div>

        {/* Punch In Card */}
        <div style={styles.card}>
          <div style={styles.sectionTitle}>🕐 Record Punch In</div>

          {/* Live Clock */}
          {!useManual && (
            <div style={styles.timeDisplay}>
              <div>
                <div style={styles.timeValue}>{currentTime.time}</div>
                <div style={styles.timeMeta}>{currentTime.date}</div>
                <div style={styles.timeMeta}>{currentTime.timezone}</div>
              </div>
              <div style={styles.badge}>🟢 Auto-Detected</div>
            </div>
          )}

          {/* Manual Entry */}
          {useManual && (
            <div style={styles.manualSection}>
              <label style={styles.label}>Enter Date & Time Manually</label>
              <div style={styles.inputRow}>
                <input
                  type="date"
                  style={styles.input}
                  value={manualDate}
                  onChange={e => setManualDate(e.target.value)}
                />
                <input
                  type="time"
                  step="1"
                  style={styles.input}
                  value={manualTime}
                  onChange={e => setManualTime(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Toggle Manual */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ color: '#94a3b8', fontSize: '0.875rem', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={useManual}
                onChange={e => setUseManual(e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              Enter time manually (if auto-detect fails)
            </label>
          </div>

          {/* Label */}
          <div style={{ marginBottom: '16px' }}>
            <label style={styles.label}>Label (optional)</label>
            <input
              type="text"
              placeholder="e.g. Morning Shift, Project Meeting..."
              style={{ ...styles.input, width: '100%' }}
              value={label}
              onChange={e => setLabel(e.target.value)}
            />
          </div>

          <button
            style={{ ...styles.btnPrimary, ...(loading ? styles.btnDisabled : {}) }}
            onClick={handlePunchIn}
            disabled={loading}
          >
            {loading ? '⏳ Saving...' : '👊 PUNCH IN NOW'}
          </button>

          {message && (
            <div style={message.type === 'success' ? styles.successMsg : styles.errorMsg}>
              {message.text}
            </div>
          )}
        </div>

        {/* Records Card */}
        <div style={styles.card}>
          <div style={styles.sectionTitle}>📋 All Punch Records</div>

          {fetchLoading ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>
              ⏳ Loading records...
            </div>
          ) : punches.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>📭</div>
              <div>No punch records yet. Hit "Punch In" to get started!</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>#</th>
                    <th style={styles.th}>Time</th>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Label</th>
                    <th style={styles.th}>Timezone</th>
                    <th style={styles.th}>Source</th>
                    <th style={styles.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {punches.map((punch, idx) => (
                    <tr key={punch.id} style={idx % 2 === 0 ? { background: 'rgba(255,255,255,0.02)' } : {}}>
                      <td style={styles.td}>{idx + 1}</td>
                      <td style={{ ...styles.td, fontWeight: '700', color: '#38bdf8' }}>{punch.time}</td>
                      <td style={styles.td}>{punch.date}</td>
                      <td style={styles.td}>{punch.label || 'Punch In'}</td>
                      <td style={{ ...styles.td, color: '#94a3b8', fontSize: '0.82rem' }}>{punch.timezone}</td>
                      <td style={styles.td}>
                        <span style={{
                          background: punch.source === 'auto' ? 'rgba(34,197,94,0.15)' : 'rgba(251,191,36,0.15)',
                          color: punch.source === 'auto' ? '#4ade80' : '#fbbf24',
                          border: `1px solid ${punch.source === 'auto' ? 'rgba(34,197,94,0.3)' : 'rgba(251,191,36,0.3)'}`,
                          borderRadius: '20px',
                          padding: '3px 12px',
                          fontSize: '0.78rem',
                          fontWeight: '600',
                        }}>
                          {punch.source === 'auto' ? '🟢 Auto' : '✏️ Manual'}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <button style={styles.deleteBtn} onClick={() => handleDelete(punch.id)}>
                          🗑 Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
