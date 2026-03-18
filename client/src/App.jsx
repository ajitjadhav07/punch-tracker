import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const USERS = ['Ajit Jadhav', 'Kiran Khade', 'Mruda Sogale', 'Sejal Pawar', 'Sandhya Ghuge'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getLocalTime() {
  const now = new Date();
  return {
    time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    date: now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    hour: now.getHours(),
  };
}

function getGreeting(hour, type) {
  if (type === 'punchIn') {
    if (hour >= 0 && hour < 12) return 'Good Morning';
    if (hour >= 12 && hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }
  if (type === 'punchOut') {
    if (hour >= 17 && hour < 21) return 'Good Evening';
    return 'Good Night';
  }
  if (hour >= 0 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  if (hour >= 17 && hour < 21) return 'Good Evening';
  return 'Good Night';
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return '-';
  const totalSec = Math.floor(ms / 1000);
  const hrs  = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0)  return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function computeShiftDurations(punches) {
  return punches.map(punch => {
    if (punch.label !== 'Punch Out') return { ...punch, shiftDuration: null };
    const matchingIn = punches
      .filter(p => p.label === 'Punch In' && p.user === punch.user && p.date === punch.date && new Date(p.createdAt) < new Date(punch.createdAt))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    if (!matchingIn) return { ...punch, shiftDuration: null };
    const diffMs = new Date(punch.createdAt) - new Date(matchingIn.createdAt);
    const totalSec = Math.floor(diffMs / 1000);
    const hrs  = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    let shiftDuration = '';
    if (hrs > 0)       shiftDuration = `${hrs}h ${mins}m`;
    else if (mins > 0) shiftDuration = `${mins}m ${secs}s`;
    else               shiftDuration = `${secs}s`;
    return { ...punch, shiftDuration };
  });
}

function computeDailySummary(punches) {
  const summary = {};
  const sorted  = [...punches].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  sorted.forEach(punch => {
    const key = `${punch.user}__${punch.date}`;
    if (!summary[key]) summary[key] = { user: punch.user, date: punch.date, totalMs: 0, lastPunchIn: null };
    if (punch.label === 'Punch In')  summary[key].lastPunchIn = new Date(punch.createdAt);
    if (punch.label === 'Punch Out' && summary[key].lastPunchIn) {
      summary[key].totalMs += new Date(punch.createdAt) - summary[key].lastPunchIn;
      summary[key].lastPunchIn = null;
    }
  });
  return Object.values(summary).filter(s => s.totalMs > 0).sort((a, b) => b.date.localeCompare(a.date));
}

// Dark / Light theme tokens
function getTheme(dark) {
  return {
    app:        { minHeight: '100vh', background: dark ? '#0f172a' : '#f8fafc', padding: '24px', fontFamily: "'Segoe UI', sans-serif", transition: 'background 0.3s' },
    container:  { maxWidth: '1000px', margin: '0 auto' },
    header:     { background: dark ? '#1e293b' : '#1e293b', borderRadius: '16px', padding: '24px 28px', marginBottom: '20px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' },
    card:       { background: dark ? '#1e293b' : '#fff', border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`, borderRadius: '16px', padding: '24px', marginBottom: '20px', transition: 'background 0.3s' },
    statBox:    { flex: '1', minWidth: '130px', background: dark ? '#1e293b' : '#fff', border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`, borderRadius: '12px', padding: '16px', textAlign: 'center' },
    statNum:    { fontSize: '1.8rem', fontWeight: '700', color: dark ? '#f1f5f9' : '#1e293b' },
    statLabel:  { fontSize: '0.78rem', color: dark ? '#64748b' : '#94a3b8', marginTop: '4px' },
    sectionTitle: { fontSize: '0.78rem', fontWeight: '700', color: dark ? '#64748b' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' },
    select:     { width: '100%', padding: '12px 14px', borderRadius: '10px', border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`, fontSize: '1rem', color: dark ? '#f1f5f9' : '#1e293b', background: dark ? '#0f172a' : '#f8fafc', marginBottom: '16px', outline: 'none' },
    input:      { flex: '1', minWidth: '140px', padding: '11px 14px', borderRadius: '10px', border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`, fontSize: '0.95rem', color: dark ? '#f1f5f9' : '#1e293b', background: dark ? '#0f172a' : '#f8fafc', outline: 'none' },
    th:         { padding: '10px 12px', textAlign: 'left', color: dark ? '#64748b' : '#64748b', fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `2px solid ${dark ? '#334155' : '#f1f5f9'}` },
    td:         { padding: '12px', color: dark ? '#e2e8f0' : '#1e293b', fontSize: '0.9rem', borderBottom: `1px solid ${dark ? '#1e293b' : '#f1f5f9'}`, verticalAlign: 'middle' },
    trEven:     { background: dark ? '#1e293b' : '#fff' },
    trOdd:      { background: dark ? '#162032' : '#f8fafc' },
    filterSelect: { padding: '8px 12px', borderRadius: '8px', border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`, fontSize: '0.88rem', color: dark ? '#f1f5f9' : '#1e293b', background: dark ? '#0f172a' : '#f8fafc', outline: 'none' },
    checkRow:   { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: dark ? '#94a3b8' : '#64748b', fontSize: '0.875rem', cursor: 'pointer' },
    successMsg: { background: '#dcfce7', border: '1px solid #86efac', color: '#166534', borderRadius: '10px', padding: '12px 16px', marginTop: '12px', fontSize: '0.9rem', fontWeight: '600' },
    errorMsg:   { background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: '10px', padding: '12px 16px', marginTop: '12px', fontSize: '0.9rem' },
    tabBtn: (active) => ({
      padding: '8px 20px', borderRadius: '8px', border: 'none', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer',
      background: active ? '#3b82f6' : (dark ? '#334155' : '#f1f5f9'),
      color:      active ? '#fff'     : (dark ? '#94a3b8' : '#64748b'),
    }),
    darkToggle: {
      padding: '8px 14px', borderRadius: '10px', border: `1px solid ${dark ? '#475569' : '#e2e8f0'}`,
      background: dark ? '#334155' : '#fff', color: dark ? '#f1f5f9' : '#1e293b',
      cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem',
    },
    reportCard: {
      background: dark ? '#162032' : '#f0f9ff',
      border: `1px solid ${dark ? '#334155' : '#bae6fd'}`,
      borderRadius: '14px', padding: '20px', marginBottom: '16px',
    },
    reportSelect: {
      padding: '10px 14px', borderRadius: '10px',
      border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`,
      fontSize: '0.95rem', color: dark ? '#f1f5f9' : '#1e293b',
      background: dark ? '#0f172a' : '#fff', outline: 'none',
    },
    downloadBtn: {
      padding: '12px 24px', background: '#3b82f6', color: '#fff',
      border: 'none', borderRadius: '10px', fontWeight: '700',
      fontSize: '0.95rem', cursor: 'pointer',
    },
  };
}

export default function App() {
  const [currentTime, setCurrentTime]   = useState(getLocalTime());
  const [selectedUser, setSelectedUser] = useState(USERS[0]);
  const [useManual, setUseManual]       = useState(false);
  const [manualTime, setManualTime]     = useState('');
  const [manualDate, setManualDate]     = useState('');
  const [punches, setPunches]           = useState([]);
  const [loading, setLoading]           = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [message, setMessage]           = useState(null);
  const [filterUser, setFilterUser]     = useState('All');
  const [filterType, setFilterType]     = useState('All');
  const [breakStart, setBreakStart]     = useState(null);
  const [activeTab, setActiveTab]       = useState('history');
  const [darkMode, setDarkMode]         = useState(false);

  // Report state
  const now = new Date();
  const [reportMonth, setReportMonth] = useState(MONTHS[now.getMonth()]);
  const [reportYear, setReportYear]   = useState(String(now.getFullYear()));
  const [reportUser, setReportUser]   = useState('All');
  const [downloading, setDownloading] = useState(false);
  const [reportMsg, setReportMsg]     = useState(null);

  // Camera
  const [showCamera, setShowCamera]       = useState(false);
  const [cameraActive, setCameraActive]   = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraError, setCameraError]     = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [countdown, setCountdown]         = useState(null);

  const videoRef     = useRef(null);
  const streamRef    = useRef(null);
  const countdownRef = useRef(null);

  const t = getTheme(darkMode);

  useEffect(() => {
    const id = setInterval(() => setCurrentTime(getLocalTime()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { fetchPunches(); }, []);

  useEffect(() => {
    if (showCamera) getCameraStream();
    else stopCamera();
  }, [showCamera]);

  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(console.error);
    }
  }, [cameraActive]);

  async function fetchPunches() {
    try {
      setFetchLoading(true);
      const res = await axios.get('/api/punches');
      setPunches(res.data.punches || []);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load records.' });
    } finally {
      setFetchLoading(false);
    }
  }

  async function getCameraStream() {
    setCameraError(null); setCapturedImage(null); setCameraActive(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      if (err.name === 'NotAllowedError') setCameraError('Camera permission denied. Allow camera in browser settings.');
      else if (err.name === 'NotFoundError') setCameraError('No camera found on this device.');
      else setCameraError('Camera unavailable. Please check and try again.');
    }
  }

  function stopCamera() {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(null);
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setCameraActive(false);
  }

  function capturePhoto() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    setCapturedImage(canvas.toDataURL('image/jpeg', 0.85));
    stopCamera();
  }

  function startCountdown() {
    setCountdown(3); let count = 3;
    countdownRef.current = setInterval(() => {
      count -= 1;
      if (count <= 0) { clearInterval(countdownRef.current); setCountdown(null); capturePhoto(); }
      else setCountdown(count);
    }, 1000);
  }

  function retakePhoto() { setCapturedImage(null); getCameraStream(); }

  function cancelCamera() {
    setShowCamera(false); stopCamera();
    setPendingAction(null); setCapturedImage(null);
  }

  function handleActionClick(actionType) {
    if (actionType === 'Punch In' || actionType === 'Punch Out') {
      setPendingAction(actionType); setShowCamera(true);
    } else { submitAction(actionType, null); }
  }

  async function confirmAndSubmit() {
    if (!capturedImage) return;
    setShowCamera(false);
    await submitAction(pendingAction, capturedImage);
    setCapturedImage(null); setPendingAction(null);
  }

  async function submitAction(actionType, imageBase64) {
    setLoading(true); setMessage(null);
    try {
      let timeVal, dateVal;
      if (useManual) {
        if (!manualTime || !manualDate) { setMessage({ type: 'error', text: 'Please enter both date and time.' }); setLoading(false); return; }
        timeVal = manualTime; dateVal = manualDate;
      } else { const t = getLocalTime(); timeVal = t.time; dateVal = t.date; }

      const hour = getLocalTime().hour;
      let greetingMsg = '';
      if (actionType === 'Punch In')    greetingMsg = `${getGreeting(hour, 'punchIn')}, ${selectedUser}!`;
      if (actionType === 'Punch Out')   greetingMsg = `${getGreeting(hour, 'punchOut')}, ${selectedUser}! See you tomorrow.`;
      if (actionType === 'Start Break') { setBreakStart(Date.now()); greetingMsg = `Break started for ${selectedUser}.`; }
      if (actionType === 'End Break') {
        const dur = breakStart ? formatDuration(Date.now() - breakStart) : '-';
        greetingMsg = `Break ended for ${selectedUser}. Duration: ${dur}`;
        setBreakStart(null);
      }
      const breakDuration = (actionType === 'End Break' && breakStart) ? formatDuration(Date.now() - breakStart) : null;

      await axios.post('/api/punch', {
        time: timeVal, date: dateVal,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        source: useManual ? 'manual' : 'auto',
        label: actionType, user: selectedUser,
        breakDuration, imageBase64: imageBase64 || null,
      });

      setMessage({ type: 'success', text: `✅ ${greetingMsg}${imageBase64 ? ' 📸 Photo saved!' : ''}` });
      setManualTime(''); setManualDate('');
      fetchPunches();
    } catch {
      setMessage({ type: 'error', text: 'Failed to save. Please try again.' });
    } finally { setLoading(false); }
  }

  async function downloadMonthlyReport() {
    setDownloading(true); setReportMsg(null);
    try {
      const params = new URLSearchParams({ month: reportMonth, year: reportYear, user: reportUser });
      const response = await fetch(`/api/report/monthly?${params}`);

      if (!response.ok) {
        const err = await response.json();
        setReportMsg({ type: 'error', text: err.error || 'No records found for this period.' });
        return;
      }

      // Trigger CSV download
      const blob     = await response.blob();
      const url      = window.URL.createObjectURL(blob);
      const a        = document.createElement('a');
      a.href         = url;
      a.download     = `attendance-${reportMonth}-${reportYear}${reportUser !== 'All' ? '-' + reportUser.replace(' ', '_') : ''}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setReportMsg({ type: 'success', text: `✅ Downloaded attendance-${reportMonth}-${reportYear}.csv` });
    } catch {
      setReportMsg({ type: 'error', text: 'Download failed. Please try again.' });
    } finally { setDownloading(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this record?')) return;
    try { await axios.delete(`/api/punch/${encodeURIComponent(id)}`); fetchPunches(); }
    catch { setMessage({ type: 'error', text: 'Failed to delete.' }); }
  }

  const greeting    = getGreeting(currentTime.hour, null);
  const todayStr    = new Date().toDateString();
  const todayCount  = punches.filter(p => new Date(p.createdAt).toDateString() === todayStr).length;
  const totalBreaks = punches.filter(p => p.label === 'End Break' && p.breakDuration && p.breakDuration !== '-').length;
  const punchesWithDuration = computeShiftDurations(punches);
  const filtered = punchesWithDuration.filter(p => {
    const userMatch = filterUser === 'All' || (p.user && p.user === filterUser);
    const typeMatch = filterType === 'All' || p.label === filterType;
    return userMatch && typeMatch;
  });
  const summaryRows = computeDailySummary(punches);
  const years = [String(now.getFullYear() - 1), String(now.getFullYear()), String(now.getFullYear() + 1)];

  const badge = (type) => {
    const map = { 'Punch In': { bg: '#dcfce7', color: '#166534' }, 'Punch Out': { bg: '#fee2e2', color: '#991b1b' }, 'Start Break': { bg: '#fef9c3', color: '#854d0e' }, 'End Break': { bg: '#dbeafe', color: '#1e40af' } };
    const c = map[type] || { bg: '#f1f5f9', color: '#475569' };
    return { background: c.bg, color: c.color, borderRadius: '20px', padding: '3px 10px', fontSize: '0.78rem', fontWeight: '600', whiteSpace: 'nowrap' };
  };

  const btnGreen   = { padding: '13px', background: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem' };
  const btnRed     = { padding: '13px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem' };
  const btnAmber   = { padding: '13px', background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem' };
  const btnBlue    = { padding: '13px', background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem' };
  const btnDisabled = { opacity: 0.45, cursor: 'not-allowed' };

  return (
    <div style={t.app}>

      {/* ── CAMERA MODAL ── */}
      {showCamera && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.88)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#1e293b', borderRadius: '20px', padding: '24px', width: '100%', maxWidth: '500px' }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ color: '#fff', fontSize: '1.15rem', fontWeight: '700' }}>
                {pendingAction === 'Punch In' ? '👊 Punch In' : '🚪 Punch Out'} — Take a Selfie
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '4px' }}>{selectedUser}</div>
            </div>

            {cameraError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: '12px', padding: '14px', marginBottom: '14px', textAlign: 'center', fontSize: '0.85rem' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>📷</div>
                <div style={{ fontWeight: '700', marginBottom: '4px' }}>Camera Required</div>
                <div>{cameraError}</div>
              </div>
            )}

            {!capturedImage && (
              <div style={{ borderRadius: '14px', overflow: 'hidden', marginBottom: '14px', background: '#0f172a', minHeight: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {cameraActive ? (
                  <>
                    <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block', borderRadius: '14px', transform: 'scaleX(-1)' }} />
                    {countdown !== null && (
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', borderRadius: '14px' }}>
                        <div style={{ fontSize: '5rem', fontWeight: '900', color: '#fff' }}>{countdown}</div>
                      </div>
                    )}
                  </>
                ) : (
                  !cameraError && <div style={{ color: '#475569', fontSize: '0.9rem', padding: '40px' }}>⏳ Starting camera...</div>
                )}
              </div>
            )}

            {capturedImage && (
              <div style={{ borderRadius: '14px', overflow: 'hidden', marginBottom: '14px', position: 'relative' }}>
                <img src={capturedImage} alt="selfie" style={{ width: '100%', display: 'block', borderRadius: '14px', transform: 'scaleX(-1)' }} />
                <div style={{ position: 'absolute', top: '10px', right: '10px', background: '#dcfce7', color: '#166534', borderRadius: '20px', padding: '4px 14px', fontSize: '0.78rem', fontWeight: '700' }}>✅ Photo Ready</div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {cameraActive && !capturedImage && countdown === null && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button style={{ padding: '13px', background: '#38bdf8', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }} onClick={capturePhoto}>📸 Capture Now</button>
                  <button style={{ padding: '13px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }} onClick={startCountdown}>⏱ Timer (3s)</button>
                </div>
              )}
              {capturedImage && <button style={{ padding: '13px', background: '#334155', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }} onClick={retakePhoto}>🔄 Retake Photo</button>}
              {capturedImage && (
                <button style={{ padding: '14px', background: pendingAction === 'Punch In' ? '#166534' : '#991b1b', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '1rem', cursor: 'pointer' }} onClick={confirmAndSubmit}>
                  {pendingAction === 'Punch In' ? '👊 Confirm Punch In' : '🚪 Confirm Punch Out'}
                </button>
              )}
              <button style={{ padding: '11px', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: '12px', fontWeight: '600', fontSize: '0.88rem', cursor: 'pointer' }} onClick={cancelCamera}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN APP ── */}
      <div style={t.container}>

        {/* Header */}
        <div style={t.header}>
          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: '700', marginBottom: '4px' }}>{greeting}, {selectedUser}! 👋</div>
            <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>{currentTime.time} · {currentTime.date} · {currentTime.timezone}</div>
          </div>
          <button style={t.darkToggle} onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div style={t.statBox}><div style={t.statNum}>{punches.length}</div><div style={t.statLabel}>Total Records</div></div>
          <div style={t.statBox}><div style={{ ...t.statNum, color: '#166534' }}>{todayCount}</div><div style={t.statLabel}>Today's Punches</div></div>
          <div style={t.statBox}><div style={{ ...t.statNum, color: '#854d0e' }}>{totalBreaks}</div><div style={t.statLabel}>Breaks Taken</div></div>
          <div style={t.statBox}><div style={{ ...t.statNum, color: '#3b82f6' }}>{USERS.length}</div><div style={t.statLabel}>Total Users</div></div>
        </div>

        {/* Punch Card */}
        <div style={t.card}>
          <div style={t.sectionTitle}>Record Punch</div>
          <select style={t.select} value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
            {USERS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <label style={t.checkRow}>
            <input type="checkbox" checked={useManual} onChange={e => setUseManual(e.target.checked)} />
            Enter time manually (if auto-detect fails)
          </label>
          {useManual && (
            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <input type="date" style={t.input} value={manualDate} onChange={e => setManualDate(e.target.value)} />
              <input type="time" step="1" style={t.input} value={manualTime} onChange={e => setManualTime(e.target.value)} />
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <button style={{ ...btnGreen,  ...(loading ? btnDisabled : {}) }} onClick={() => handleActionClick('Punch In')}    disabled={loading}>👊 Punch In</button>
            <button style={{ ...btnRed,    ...(loading ? btnDisabled : {}) }} onClick={() => handleActionClick('Punch Out')}   disabled={loading}>🚪 Punch Out</button>
            {!breakStart
              ? <button style={{ ...btnAmber, ...(loading ? btnDisabled : {}) }} onClick={() => handleActionClick('Start Break')} disabled={loading}>☕ Start Break</button>
              : <button style={{ ...btnBlue,  ...(loading ? btnDisabled : {}) }} onClick={() => handleActionClick('End Break')}   disabled={loading}>▶ End Break</button>
            }
          </div>
          {message && <div style={message.type === 'success' ? t.successMsg : t.errorMsg}>{message.text}</div>}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <button style={t.tabBtn(activeTab === 'history')}  onClick={() => setActiveTab('history')}>📋 Shift History</button>
          <button style={t.tabBtn(activeTab === 'summary')}  onClick={() => setActiveTab('summary')}>📊 Daily Summary</button>
          <button style={t.tabBtn(activeTab === 'report')}   onClick={() => setActiveTab('report')}>📥 Monthly Report</button>
        </div>

        {/* ── SHIFT HISTORY ── */}
        {activeTab === 'history' && (
          <div style={t.card}>
            <div style={t.sectionTitle}>Shift History</div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <select style={t.filterSelect} value={filterUser} onChange={e => setFilterUser(e.target.value)}>
                <option value="All">All Users</option>
                {USERS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <select style={t.filterSelect} value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="All">All Types</option>
                <option>Punch In</option><option>Punch Out</option>
                <option>Start Break</option><option>End Break</option>
              </select>
            </div>
            {fetchLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading records...</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No records found.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['#','User','Type','Time','Date','Shift Duration','Break','Action'].map(h => (
                        <th key={h} style={t.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((punch, idx) => (
                      <tr key={punch.id} style={idx % 2 === 0 ? t.trEven : t.trOdd}>
                        <td style={{ ...t.td, color: '#94a3b8', fontSize: '0.82rem' }}>{idx + 1}</td>
                        <td style={{ ...t.td, fontWeight: '600' }}>{punch.user || '-'}</td>
                        <td style={t.td}><span style={badge(punch.label)}>{punch.label || 'Punch In'}</span></td>
                        <td style={{ ...t.td, fontWeight: '600', color: '#3b82f6' }}>{punch.time}</td>
                        <td style={{ ...t.td, fontSize: '0.82rem', color: '#64748b' }}>{punch.date}</td>
                        <td style={t.td}>
                          {punch.shiftDuration
                            ? <span style={{ background: '#dcfce7', color: '#166534', borderRadius: '20px', padding: '3px 12px', fontSize: '0.82rem', fontWeight: '700' }}>⏱ {punch.shiftDuration}</span>
                            : <span style={{ color: '#94a3b8' }}>-</span>}
                        </td>
                        <td style={{ ...t.td, color: '#854d0e' }}>{punch.breakDuration || '-'}</td>
                        <td style={t.td}>
                          <button style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: '8px', padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600' }}
                            onClick={() => handleDelete(punch.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── DAILY SUMMARY ── */}
        {activeTab === 'summary' && (
          <div style={t.card}>
            <div style={t.sectionTitle}>Daily Hours Summary</div>
            {summaryRows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No completed shifts yet.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['#','User','Date','Total Hours Worked'].map(h => <th key={h} style={t.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {summaryRows.map((row, idx) => (
                      <tr key={`${row.user}__${row.date}`} style={idx % 2 === 0 ? t.trEven : t.trOdd}>
                        <td style={{ ...t.td, color: '#94a3b8' }}>{idx + 1}</td>
                        <td style={{ ...t.td, fontWeight: '700' }}>{row.user}</td>
                        <td style={{ ...t.td, color: '#64748b' }}>{row.date}</td>
                        <td style={t.td}>
                          <span style={{ background: '#dbeafe', color: '#1e40af', borderRadius: '20px', padding: '4px 14px', fontWeight: '700', fontSize: '0.88rem' }}>
                            🕐 {formatDuration(row.totalMs)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── MONTHLY REPORT ── */}
        {activeTab === 'report' && (
          <div style={t.card}>
            <div style={t.sectionTitle}>Monthly Report Download</div>
            <div style={t.reportCard}>
              <div style={{ fontSize: '0.9rem', color: darkMode ? '#94a3b8' : '#0369a1', marginBottom: '16px', fontWeight: '600' }}>
                📥 Download attendance records as CSV file — opens directly in Excel
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '600' }}>Month</label>
                  <select style={t.reportSelect} value={reportMonth} onChange={e => setReportMonth(e.target.value)}>
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '600' }}>Year</label>
                  <select style={t.reportSelect} value={reportYear} onChange={e => setReportYear(e.target.value)}>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '600' }}>User</label>
                  <select style={t.reportSelect} value={reportUser} onChange={e => setReportUser(e.target.value)}>
                    <option value="All">All Users</option>
                    {USERS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <button
                style={{ ...t.downloadBtn, ...(downloading ? btnDisabled : {}) }}
                onClick={downloadMonthlyReport}
                disabled={downloading}
              >
                {downloading ? '⏳ Generating...' : `📥 Download ${reportMonth} ${reportYear} Report`}
              </button>

              {reportMsg && (
                <div style={{ ...(reportMsg.type === 'success' ? { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' } : { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }), borderRadius: '10px', padding: '10px 14px', marginTop: '14px', fontSize: '0.88rem', fontWeight: '600' }}>
                  {reportMsg.text}
                </div>
              )}
            </div>

            <div style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: '1.6' }}>
              <div style={{ fontWeight: '700', marginBottom: '6px', color: darkMode ? '#94a3b8' : '#475569' }}>CSV file contains:</div>
              <div>PunchId · User · Type · Time · Date · Timezone · Source · Break Duration · Image URL · Timestamp</div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
