import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const USERS = ['Ajit Jadhav', 'Kiran Khade', 'Mruda Sogale', 'Sejal Pawar', 'Sandhya Ghuge'];

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
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

const s = {
  app: { minHeight: '100vh', background: '#f8fafc', padding: '24px', fontFamily: "'Segoe UI', sans-serif" },
  container: { maxWidth: '960px', margin: '0 auto' },
  header: { background: '#1e293b', borderRadius: '16px', padding: '24px 28px', marginBottom: '20px', color: '#fff' },
  greeting: { fontSize: '1.6rem', fontWeight: '700', marginBottom: '4px' },
  subtext: { fontSize: '0.9rem', color: '#94a3b8' },
  statsRow: { display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' },
  statBox: { flex: '1', minWidth: '130px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', textAlign: 'center' },
  statNum: { fontSize: '1.8rem', fontWeight: '700', color: '#1e293b' },
  statLabel: { fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px' },
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', marginBottom: '20px' },
  sectionTitle: { fontSize: '0.78rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' },
  select: { width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '1rem', color: '#1e293b', background: '#f8fafc', marginBottom: '16px', outline: 'none' },
  btnRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' },
  btnGreen: { padding: '13px', background: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem' },
  btnRed: { padding: '13px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem' },
  btnAmber: { padding: '13px', background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem' },
  btnBlue: { padding: '13px', background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem' },
  btnDisabled: { opacity: 0.45, cursor: 'not-allowed' },
  checkRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#64748b', fontSize: '0.875rem', cursor: 'pointer' },
  manualRow: { display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' },
  input: { flex: '1', minWidth: '140px', padding: '11px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.95rem', color: '#1e293b', background: '#f8fafc', outline: 'none' },
  successMsg: { background: '#dcfce7', border: '1px solid #86efac', color: '#166534', borderRadius: '10px', padding: '12px 16px', marginTop: '12px', fontSize: '0.9rem', fontWeight: '600' },
  errorMsg: { background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: '10px', padding: '12px 16px', marginTop: '12px', fontSize: '0.9rem' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 12px', textAlign: 'left', color: '#64748b', fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #f1f5f9' },
  td: { padding: '12px', color: '#1e293b', fontSize: '0.9rem', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
  filterRow: { display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' },
  filterSelect: { padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.88rem', color: '#1e293b', background: '#f8fafc', outline: 'none' },
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.88)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  badge: (type) => {
    const map = {
      'Punch In':    { bg: '#dcfce7', color: '#166534' },
      'Punch Out':   { bg: '#fee2e2', color: '#991b1b' },
      'Start Break': { bg: '#fef9c3', color: '#854d0e' },
      'End Break':   { bg: '#dbeafe', color: '#1e40af' },
    };
    const c = map[type] || { bg: '#f1f5f9', color: '#475569' };
    return { background: c.bg, color: c.color, borderRadius: '20px', padding: '3px 10px', fontSize: '0.78rem', fontWeight: '600', whiteSpace: 'nowrap' };
  },
};

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

  // Camera
  const [showCamera, setShowCamera]       = useState(false);
  const [cameraActive, setCameraActive]   = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraError, setCameraError]     = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [countdown, setCountdown]         = useState(null);

  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const countdownRef = useRef(null);

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(getLocalTime()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch records on load
  useEffect(() => { fetchPunches(); }, []);

  // Step 1: when showCamera becomes true → get stream
  useEffect(() => {
    if (showCamera) {
      getCameraStream();
    } else {
      stopCamera();
    }
  }, [showCamera]);

  // Step 2: when cameraActive becomes true → attach stream to video element
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(err => console.error('Video play error:', err));
    }
  }, [cameraActive]);

  async function getCameraStream() {
    setCameraError(null);
    setCapturedImage(null);
    setCameraActive(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true); // triggers useEffect above to attach to video
    } catch (err) {
      console.error('Camera access error:', err.name, err.message);
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera permission denied. Please allow camera access in your browser and try again.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found on this device.');
      } else {
        setCameraError('Camera not available. You can still punch in without a photo.');
      }
    }
  }

  function stopCamera() {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }

  function capturePhoto() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(imageBase64);
    stopCamera();
  }

  function startCountdown() {
    setCountdown(3);
    let count = 3;
    countdownRef.current = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(countdownRef.current);
        setCountdown(null);
        capturePhoto();
      } else {
        setCountdown(count);
      }
    }, 1000);
  }

  function retakePhoto() {
    setCapturedImage(null);
    getCameraStream();
  }

  // Punch In / Punch Out → open camera first
  function handleActionClick(actionType) {
    if (actionType === 'Punch In' || actionType === 'Punch Out') {
      setPendingAction(actionType);
      setShowCamera(true);
    } else {
      submitAction(actionType, null);
    }
  }

  async function confirmAndSubmit() {
    setShowCamera(false);
    await submitAction(pendingAction, capturedImage);
    setCapturedImage(null);
    setPendingAction(null);
  }

  async function skipPhotoAndSubmit() {
    setShowCamera(false);
    stopCamera();
    await submitAction(pendingAction, null);
    setCapturedImage(null);
    setPendingAction(null);
  }

  function cancelCamera() {
    setShowCamera(false);
    stopCamera();
    setPendingAction(null);
    setCapturedImage(null);
  }

  async function submitAction(actionType, imageBase64) {
    setLoading(true);
    setMessage(null);
    try {
      let timeVal, dateVal;
      if (useManual) {
        if (!manualTime || !manualDate) {
          setMessage({ type: 'error', text: 'Please enter both date and time.' });
          setLoading(false);
          return;
        }
        timeVal = manualTime;
        dateVal = manualDate;
      } else {
        const t = getLocalTime();
        timeVal = t.time;
        dateVal = t.date;
      }

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

      const breakDuration = (actionType === 'End Break' && breakStart)
        ? formatDuration(Date.now() - breakStart) : null;

      await axios.post('/api/punch', {
        time: timeVal,
        date: dateVal,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        source: useManual ? 'manual' : 'auto',
        label: actionType,
        user: selectedUser,
        breakDuration,
        imageBase64: imageBase64 || null,
      });

      setMessage({ type: 'success', text: `✅ ${greetingMsg}${imageBase64 ? ' 📸 Photo saved!' : ''}` });
      setManualTime('');
      setManualDate('');
      fetchPunches();
    } catch {
      setMessage({ type: 'error', text: 'Failed to save. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

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

  async function handleDelete(id) {
    if (!window.confirm('Delete this record?')) return;
    try {
      await axios.delete(`/api/punch/${encodeURIComponent(id)}`);
      fetchPunches();
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete.' });
    }
  }

  const greeting  = getGreeting(currentTime.hour, null);
  const todayStr  = new Date().toDateString();
  const todayCount = punches.filter(p => new Date(p.createdAt).toDateString() === todayStr).length;
  const totalBreaks = punches.filter(p => p.label === 'End Break' && p.breakDuration && p.breakDuration !== '-').length;
  const filtered = punches.filter(p => {
    const userMatch = filterUser === 'All' || (p.user && p.user === filterUser);
    const typeMatch = filterType === 'All' || p.label === filterType;
    return userMatch && typeMatch;
  });

  return (
    <div style={s.app}>

      {/* ── CAMERA MODAL ── */}
      {showCamera && (
        <div style={s.overlay}>
          <div style={{ background: '#1e293b', borderRadius: '20px', padding: '24px', width: '100%', maxWidth: '500px' }}>

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ color: '#fff', fontSize: '1.15rem', fontWeight: '700' }}>
                {pendingAction === 'Punch In' ? '👊 Punch In' : '🚪 Punch Out'} — Take a Selfie
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '4px' }}>{selectedUser}</div>
            </div>

            {/* Camera error message */}
            {cameraError && (
              <div style={{ background: '#fef9c3', color: '#854d0e', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '0.85rem', textAlign: 'center' }}>
                ⚠️ {cameraError}
              </div>
            )}

            {/* Live video feed */}
            {!capturedImage && (
              <div style={{ borderRadius: '14px', overflow: 'hidden', marginBottom: '14px', background: '#0f172a', minHeight: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {cameraActive ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{ width: '100%', display: 'block', borderRadius: '14px', transform: 'scaleX(-1)' }}
                    />
                    {/* Countdown overlay */}
                    {countdown !== null && (
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', borderRadius: '14px' }}>
                        <div style={{ fontSize: '5rem', fontWeight: '900', color: '#fff' }}>{countdown}</div>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ color: '#475569', fontSize: '0.9rem', textAlign: 'center', padding: '40px' }}>
                    {cameraError ? '📷 No camera available' : '⏳ Starting camera...'}
                  </div>
                )}
              </div>
            )}

            {/* Captured photo preview */}
            {capturedImage && (
              <div style={{ borderRadius: '14px', overflow: 'hidden', marginBottom: '14px', position: 'relative' }}>
                <img src={capturedImage} alt="selfie" style={{ width: '100%', display: 'block', borderRadius: '14px', transform: 'scaleX(-1)' }} />
                <div style={{ position: 'absolute', top: '10px', right: '10px', background: '#dcfce7', color: '#166534', borderRadius: '20px', padding: '4px 14px', fontSize: '0.78rem', fontWeight: '700' }}>
                  ✅ Photo Ready
                </div>
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

              {/* Capture / Countdown — show only when live */}
              {cameraActive && !capturedImage && countdown === null && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    style={{ padding: '13px', background: '#38bdf8', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer' }}
                    onClick={capturePhoto}
                  >
                    📸 Capture Now
                  </button>
                  <button
                    style={{ padding: '13px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer' }}
                    onClick={startCountdown}
                  >
                    ⏱ Timer (3s)
                  </button>
                </div>
              )}

              {/* Retake */}
              {capturedImage && (
                <button
                  style={{ padding: '13px', background: '#334155', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer' }}
                  onClick={retakePhoto}
                >
                  🔄 Retake Photo
                </button>
              )}

              {/* Confirm submit */}
              {capturedImage && (
                <button
                  style={{ padding: '14px', background: pendingAction === 'Punch In' ? '#166534' : '#991b1b', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '1rem', cursor: 'pointer' }}
                  onClick={confirmAndSubmit}
                >
                  {pendingAction === 'Punch In' ? '👊 Confirm Punch In' : '🚪 Confirm Punch Out'}
                </button>
              )}

              {/* Skip photo */}
              <button
                style={{ padding: '12px', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: '12px', fontWeight: '600', fontSize: '0.88rem', cursor: 'pointer' }}
                onClick={skipPhotoAndSubmit}
              >
                Skip Photo & {pendingAction}
              </button>

              {/* Cancel */}
              <button
                style={{ padding: '10px', background: 'transparent', color: '#64748b', border: 'none', borderRadius: '12px', fontSize: '0.85rem', cursor: 'pointer' }}
                onClick={cancelCamera}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN APP ── */}
      <div style={s.container}>

        {/* Header */}
        <div style={s.header}>
          <div style={s.greeting}>{greeting}, {selectedUser}! 👋</div>
          <div style={s.subtext}>{currentTime.time} · {currentTime.date} · {currentTime.timezone}</div>
        </div>

        {/* Stats */}
        <div style={s.statsRow}>
          <div style={s.statBox}><div style={s.statNum}>{punches.length}</div><div style={s.statLabel}>Total Records</div></div>
          <div style={s.statBox}><div style={{ ...s.statNum, color: '#166534' }}>{todayCount}</div><div style={s.statLabel}>Today's Punches</div></div>
          <div style={s.statBox}><div style={{ ...s.statNum, color: '#854d0e' }}>{totalBreaks}</div><div style={s.statLabel}>Breaks Taken</div></div>
          <div style={s.statBox}><div style={{ ...s.statNum, color: '#1e40af' }}>{USERS.length}</div><div style={s.statLabel}>Total Users</div></div>
        </div>

        {/* Punch Card */}
        <div style={s.card}>
          <div style={s.sectionTitle}>Record Punch</div>

          <select style={s.select} value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
            {USERS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>

          <label style={s.checkRow}>
            <input type="checkbox" checked={useManual} onChange={e => setUseManual(e.target.checked)} />
            Enter time manually (if auto-detect fails)
          </label>

          {useManual && (
            <div style={s.manualRow}>
              <input type="date" style={s.input} value={manualDate} onChange={e => setManualDate(e.target.value)} />
              <input type="time" step="1" style={s.input} value={manualTime} onChange={e => setManualTime(e.target.value)} />
            </div>
          )}

          <div style={s.btnRow}>
            <button style={{ ...s.btnGreen, ...(loading ? s.btnDisabled : {}) }} onClick={() => handleActionClick('Punch In')} disabled={loading}>
              👊 Punch In
            </button>
            <button style={{ ...s.btnRed, ...(loading ? s.btnDisabled : {}) }} onClick={() => handleActionClick('Punch Out')} disabled={loading}>
              🚪 Punch Out
            </button>
            {!breakStart ? (
              <button style={{ ...s.btnAmber, ...(loading ? s.btnDisabled : {}) }} onClick={() => handleActionClick('Start Break')} disabled={loading}>
                ☕ Start Break
              </button>
            ) : (
              <button style={{ ...s.btnBlue, ...(loading ? s.btnDisabled : {}) }} onClick={() => handleActionClick('End Break')} disabled={loading}>
                ▶ End Break
              </button>
            )}
          </div>

          {message && (
            <div style={message.type === 'success' ? s.successMsg : s.errorMsg}>
              {message.text}
            </div>
          )}
        </div>

        {/* Shift History */}
        <div style={s.card}>
          <div style={s.sectionTitle}>Shift History</div>

          <div style={s.filterRow}>
            <select style={s.filterSelect} value={filterUser} onChange={e => setFilterUser(e.target.value)}>
              <option value="All">All Users</option>
              {USERS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <select style={s.filterSelect} value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="All">All Types</option>
              <option>Punch In</option>
              <option>Punch Out</option>
              <option>Start Break</option>
              <option>End Break</option>
            </select>
          </div>

          {fetchLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading records...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No records found.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>#</th>
                    <th style={s.th}>Photo</th>
                    <th style={s.th}>User</th>
                    <th style={s.th}>Type</th>
                    <th style={s.th}>Time</th>
                    <th style={s.th}>Date</th>
                    <th style={s.th}>Break</th>
                    <th style={s.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((punch, idx) => (
                    <tr key={punch.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={{ ...s.td, color: '#94a3b8', fontSize: '0.82rem' }}>{idx + 1}</td>
                      <td style={s.td}>
                        {punch.imageUrl ? (
                          <img
                            src={punch.imageUrl}
                            alt="punch"
                            style={{ width: '46px', height: '46px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0', cursor: 'pointer' }}
                            onClick={() => window.open(punch.imageUrl, '_blank')}
                            title="Click to view full photo"
                          />
                        ) : (
                          <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: '#f1f5f9', border: '2px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                            👤
                          </div>
                        )}
                      </td>
                      <td style={{ ...s.td, fontWeight: '600' }}>{punch.user || '-'}</td>
                      <td style={s.td}><span style={s.badge(punch.label)}>{punch.label || 'Punch In'}</span></td>
                      <td style={{ ...s.td, fontWeight: '600', color: '#1e40af' }}>{punch.time}</td>
                      <td style={{ ...s.td, fontSize: '0.82rem', color: '#64748b' }}>{punch.date}</td>
                      <td style={{ ...s.td, color: '#854d0e' }}>{punch.breakDuration || '-'}</td>
                      <td style={s.td}>
                        <button
                          style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: '8px', padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600' }}
                          onClick={() => handleDelete(punch.id)}
                        >
                          Delete
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
