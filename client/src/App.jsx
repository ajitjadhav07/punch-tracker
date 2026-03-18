import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const USERS = ['Ajit Jadhav', 'Kiran Khade', 'Mruda Sogale', 'Sejal Pawar', 'Sandhya Ghuge'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const LATE_HOUR = 9;
const LATE_MINUTE = 30;
const OVERTIME_HOURS = 8;

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

function formatLiveTimer(ms) {
  if (!ms || ms <= 0) return '0m 0s';
  const totalSec = Math.floor(ms / 1000);
  const hrs  = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

function isLateArrival(timeStr) {
  if (!timeStr) return false;
  try {
    const lower = timeStr.toLowerCase();
    const isPM  = lower.includes('pm');
    const isAM  = lower.includes('am');
    const clean = timeStr.replace(/[apmAMP\s]/g, '');
    const parts = clean.split(':');
    let hour    = parseInt(parts[0]);
    const min   = parseInt(parts[1]) || 0;
    if (isPM && hour !== 12) hour += 12;
    if (isAM && hour === 12) hour = 0;
    if (hour > 12) return false;
    return hour > LATE_HOUR || (hour === LATE_HOUR && min > LATE_MINUTE);
  } catch { return false; }
}

function computeAttendanceStatus(punches) {
  const todayStr     = new Date().toDateString();
  const todayPunches = punches
    .filter(p => new Date(p.createdAt).toDateString() === todayStr)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const status = {};
  USERS.forEach(u => {
    status[u] = { status: 'OUT', lastPunchIn: null, lastPunchOut: null, onBreak: false, totalMs: 0, lastInCreatedAt: null };
  });

  todayPunches.forEach(p => {
    if (!status[p.user]) return;
    if (p.label === 'Punch In') {
      status[p.user].status          = 'IN';
      status[p.user].lastPunchIn     = p.time;
      status[p.user].lastInCreatedAt = new Date(p.createdAt);
      status[p.user].onBreak         = false;
    }
    if (p.label === 'Punch Out') {
      if (status[p.user].lastInCreatedAt) {
        status[p.user].totalMs += new Date(p.createdAt) - status[p.user].lastInCreatedAt;
        status[p.user].lastInCreatedAt = null;
      }
      status[p.user].status      = 'OUT';
      status[p.user].lastPunchOut = p.time;
    }
    if (p.label === 'Start Break') status[p.user].onBreak = true;
    if (p.label === 'End Break')   status[p.user].onBreak = false;
  });
  return status;
}

function computeTodaySummary(punches) {
  const todayStr     = new Date().toDateString();
  const todayPunches = punches
    .filter(p => new Date(p.createdAt).toDateString() === todayStr)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const summary = {};
  USERS.forEach(u => {
    summary[u] = { punchIn: null, punchOut: null, totalMs: 0, lastIn: null, late: false };
  });

  todayPunches.forEach(p => {
    if (!summary[p.user]) return;
    if (p.label === 'Punch In') {
      if (!summary[p.user].punchIn) {
        summary[p.user].punchIn = p.time;
        summary[p.user].late    = isLateArrival(p.time);
      }
      summary[p.user].lastIn = new Date(p.createdAt);
    }
    if (p.label === 'Punch Out') {
      summary[p.user].punchOut = p.time;
      if (summary[p.user].lastIn) {
        summary[p.user].totalMs += new Date(p.createdAt) - summary[p.user].lastIn;
        summary[p.user].lastIn   = null;
      }
    }
  });
  return summary;
}

function computeShiftDurations(punches) {
  return punches.map(punch => {
    if (punch.label !== 'Punch Out') return { ...punch, shiftDuration: null };
    const matchingIn = punches
      .filter(p => p.label === 'Punch In' && p.user === punch.user && p.date === punch.date && new Date(p.createdAt) < new Date(punch.createdAt))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    if (!matchingIn) return { ...punch, shiftDuration: null };
    const diffMs   = new Date(punch.createdAt) - new Date(matchingIn.createdAt);
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
      summary[key].totalMs    += new Date(punch.createdAt) - summary[key].lastPunchIn;
      summary[key].lastPunchIn = null;
    }
  });
  return Object.values(summary).filter(s => s.totalMs > 0).sort((a, b) => b.date.localeCompare(a.date));
}

function Skeleton({ width = '100%', height = '16px', borderRadius = '6px', style = {} }) {
  return (
    <div style={{
      width, height, borderRadius,
      background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
      ...style,
    }} />
  );
}

function getTheme(dark) {
  return {
    app:          { minHeight: '100vh', background: dark ? '#0f172a' : '#f8fafc', padding: '24px', fontFamily: "'Segoe UI', sans-serif", transition: 'background 0.3s' },
    container:    { maxWidth: '1040px', margin: '0 auto' },
    header:       { background: '#1e293b', borderRadius: '16px', padding: '24px 28px', marginBottom: '20px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' },
    card:         { background: dark ? '#1e293b' : '#fff', border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`, borderRadius: '16px', padding: '24px', marginBottom: '20px' },
    statBox:      { flex: '1', minWidth: '130px', background: dark ? '#1e293b' : '#fff', border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`, borderRadius: '12px', padding: '16px', textAlign: 'center' },
    statNum:      { fontSize: '1.8rem', fontWeight: '700', color: dark ? '#f1f5f9' : '#1e293b' },
    statLabel:    { fontSize: '0.78rem', color: dark ? '#64748b' : '#94a3b8', marginTop: '4px' },
    sectionTitle: { fontSize: '0.78rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' },
    select:       { width: '100%', padding: '12px 14px', borderRadius: '10px', border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`, fontSize: '1rem', color: dark ? '#f1f5f9' : '#1e293b', background: dark ? '#0f172a' : '#f8fafc', marginBottom: '16px', outline: 'none' },
    input:        { flex: '1', minWidth: '140px', padding: '11px 14px', borderRadius: '10px', border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`, fontSize: '0.95rem', color: dark ? '#f1f5f9' : '#1e293b', background: dark ? '#0f172a' : '#f8fafc', outline: 'none' },
    th:           { padding: '10px 12px', textAlign: 'left', color: '#64748b', fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `2px solid ${dark ? '#334155' : '#f1f5f9'}` },
    td:           { padding: '12px', color: dark ? '#e2e8f0' : '#1e293b', fontSize: '0.9rem', borderBottom: `1px solid ${dark ? '#1e293b' : '#f1f5f9'}`, verticalAlign: 'middle' },
    trEven:       { background: dark ? '#1e293b' : '#fff' },
    trOdd:        { background: dark ? '#162032' : '#f8fafc' },
    filterSelect: { padding: '8px 12px', borderRadius: '8px', border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`, fontSize: '0.88rem', color: dark ? '#f1f5f9' : '#1e293b', background: dark ? '#0f172a' : '#f8fafc', outline: 'none' },
    checkRow:     { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: dark ? '#94a3b8' : '#64748b', fontSize: '0.875rem', cursor: 'pointer' },
    successMsg:   { background: '#dcfce7', border: '1px solid #86efac', color: '#166534', borderRadius: '10px', padding: '12px 16px', marginTop: '12px', fontSize: '0.9rem', fontWeight: '600' },
    errorMsg:     { background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: '10px', padding: '12px 16px', marginTop: '12px', fontSize: '0.9rem' },
    tabBtn: (active) => ({
      padding: '8px 20px', borderRadius: '8px', border: 'none', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer',
      background: active ? '#3b82f6' : (dark ? '#334155' : '#f1f5f9'),
      color:      active ? '#fff'    : (dark ? '#94a3b8' : '#64748b'),
    }),
    darkToggle: {
      padding: '8px 14px', borderRadius: '10px', border: `1px solid ${dark ? '#475569' : '#e2e8f0'}`,
      background: dark ? '#334155' : '#fff', color: dark ? '#f1f5f9' : '#1e293b',
      cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem',
    },
    reportSelect: {
      padding: '10px 14px', borderRadius: '10px', border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`,
      fontSize: '0.95rem', color: dark ? '#f1f5f9' : '#1e293b',
      background: dark ? '#0f172a' : '#fff', outline: 'none',
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

  // ✅ Per-user break tracking
  const [breakStarts, setBreakStarts]   = useState({});

  const [activeTab, setActiveTab]       = useState('dashboard');
  const [darkMode, setDarkMode]         = useState(false);
  const [liveTimers, setLiveTimers]     = useState({});

  const now = new Date();
  const [reportMonth, setReportMonth]   = useState(MONTHS[now.getMonth()]);
  const [reportYear, setReportYear]     = useState(String(now.getFullYear()));
  const [reportUser, setReportUser]     = useState('All');
  const [downloading, setDownloading]   = useState(false);
  const [reportMsg, setReportMsg]       = useState(null);

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

  // Live timer — updates every second
  useEffect(() => {
    const id = setInterval(() => {
      const status = computeAttendanceStatus(punches);
      const timers = {};
      USERS.forEach(user => {
        const s = status[user];
        if (s.status === 'IN' && s.lastInCreatedAt && !s.onBreak) {
          timers[user] = Date.now() - s.lastInCreatedAt.getTime() + (s.totalMs || 0);
        } else {
          timers[user] = s.totalMs || 0;
        }
      });
      setLiveTimers(timers);
    }, 1000);
    return () => clearInterval(id);
  }, [punches]);

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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false,
      });
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
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }

  function capturePhoto() {
    if (!videoRef.current) return;
    const video  = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
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

  function retakePhoto()  { setCapturedImage(null); getCameraStream(); }
  function cancelCamera() { setShowCamera(false); stopCamera(); setPendingAction(null); setCapturedImage(null); }

  function handleActionClick(actionType) {
    if (actionType === 'Punch In' || actionType === 'Punch Out') {
      setPendingAction(actionType); setShowCamera(true);
    } else {
      submitAction(actionType, null);
    }
  }

  async function confirmAndSubmit() {
    if (!capturedImage) return;
    setShowCamera(false);
    await submitAction(pendingAction, capturedImage);
    setCapturedImage(null); setPendingAction(null);
  }

  // ✅ Fixed submitAction with per-user break tracking
  async function submitAction(actionType, imageBase64) {
    setLoading(true); setMessage(null);
    try {
      let timeVal, dateVal;
      if (useManual) {
        if (!manualTime || !manualDate) {
          setMessage({ type: 'error', text: 'Please enter both date and time.' });
          setLoading(false); return;
        }
        timeVal = manualTime; dateVal = manualDate;
      } else {
        const tt = getLocalTime(); timeVal = tt.time; dateVal = tt.date;
      }

      const hour = getLocalTime().hour;
      let greetingMsg   = '';
      let breakDuration = null;

      if (actionType === 'Punch In')
        greetingMsg = `${getGreeting(hour, 'punchIn')}, ${selectedUser}!`;

      if (actionType === 'Punch Out')
        greetingMsg = `${getGreeting(hour, 'punchOut')}, ${selectedUser}! See you tomorrow.`;

      if (actionType === 'Start Break') {
        // ✅ Save break start for THIS user only
        setBreakStarts(prev => ({ ...prev, [selectedUser]: Date.now() }));
        greetingMsg = `Break started for ${selectedUser}.`;
      }

      if (actionType === 'End Break') {
        // ✅ Get break start for THIS user only
        const userBreakStart = breakStarts[selectedUser];
        const dur = userBreakStart ? formatDuration(Date.now() - userBreakStart) : '-';
        breakDuration = dur;
        greetingMsg   = `Break ended for ${selectedUser}. Duration: ${dur}`;
        // ✅ Clear break for THIS user only
        setBreakStarts(prev => {
          const updated = { ...prev };
          delete updated[selectedUser];
          return updated;
        });
      }

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
    } finally {
      setLoading(false);
    }
  }

  async function downloadMonthlyReport() {
    setDownloading(true); setReportMsg(null);
    try {
      const params   = new URLSearchParams({ month: reportMonth, year: reportYear, user: reportUser });
      const response = await fetch(`/api/report/monthly?${params}`);
      if (!response.ok) { const err = await response.json(); setReportMsg({ type: 'error', text: err.error || 'No records found.' }); return; }
      const blob = await response.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `attendance-${reportMonth}-${reportYear}${reportUser !== 'All' ? '-' + reportUser.replace(' ', '_') : ''}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setReportMsg({ type: 'success', text: `✅ Downloaded attendance-${reportMonth}-${reportYear}.csv` });
    } catch {
      setReportMsg({ type: 'error', text: 'Download failed. Please try again.' });
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this record?')) return;
    try { await axios.delete(`/api/punch/${encodeURIComponent(id)}`); fetchPunches(); }
    catch { setMessage({ type: 'error', text: 'Failed to delete.' }); }
  }

  const greeting         = getGreeting(currentTime.hour, null);
  const todayStr         = new Date().toDateString();
  const todayCount       = punches.filter(p => new Date(p.createdAt).toDateString() === todayStr).length;
  const attendanceStatus = computeAttendanceStatus(punches);
  const todaySummary     = computeTodaySummary(punches);
  const inCount          = Object.values(attendanceStatus).filter(s => s.status === 'IN').length;
  const absentUsers      = USERS.filter(u => !todaySummary[u]?.punchIn);
  const overtimeUsers    = USERS.filter(u => (liveTimers[u] || 0) > OVERTIME_HOURS * 3600 * 1000);
  const punchesWithDuration = computeShiftDurations(punches);
  const filtered = punchesWithDuration.filter(p => {
    const userMatch = filterUser === 'All' || (p.user && p.user === filterUser);
    const typeMatch = filterType === 'All' || p.label === filterType;
    return userMatch && typeMatch;
  });
  const summaryRows = computeDailySummary(punches);
  const years = [String(now.getFullYear() - 1), String(now.getFullYear()), String(now.getFullYear() + 1)];

  const badge = (type) => {
    const map = {
      'Punch In':    { bg: '#dcfce7', color: '#166534' },
      'Punch Out':   { bg: '#fee2e2', color: '#991b1b' },
      'Start Break': { bg: '#fef9c3', color: '#854d0e' },
      'End Break':   { bg: '#dbeafe', color: '#1e40af' },
    };
    const c = map[type] || { bg: '#f1f5f9', color: '#475569' };
    return { background: c.bg, color: c.color, borderRadius: '20px', padding: '3px 10px', fontSize: '0.78rem', fontWeight: '600', whiteSpace: 'nowrap' };
  };

  const btnGreen    = { padding: '13px', background: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem' };
  const btnRed      = { padding: '13px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem' };
  const btnAmber    = { padding: '13px', background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem' };
  const btnBlue     = { padding: '13px', background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem' };
  const btnDisabled = { opacity: 0.45, cursor: 'not-allowed' };

  return (
    <div style={t.app}>
      <style>{`
        @keyframes shimmer    { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes pulse      { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes timerPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.03); } }
      `}</style>

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
                ) : (!cameraError && <div style={{ color: '#475569', fontSize: '0.9rem', padding: '40px' }}>⏳ Starting camera...</div>)}
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
              {capturedImage && (
                <button style={{ padding: '13px', background: '#334155', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }} onClick={retakePhoto}>🔄 Retake Photo</button>
              )}
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
            <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>{currentTime.time} · {currentTime.date}</div>
          </div>
          <button style={t.darkToggle} onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {fetchLoading ? (
            [1,2,3,4].map(i => (
              <div key={i} style={t.statBox}>
                <Skeleton height="2rem" width="60%" style={{ margin: '0 auto 8px' }} />
                <Skeleton height="0.75rem" width="80%" style={{ margin: '0 auto' }} />
              </div>
            ))
          ) : (
            <>
              <div style={t.statBox}><div style={t.statNum}>{punches.length}</div><div style={t.statLabel}>Total Records</div></div>
              <div style={t.statBox}><div style={{ ...t.statNum, color: '#166534' }}>{todayCount}</div><div style={t.statLabel}>Today's Punches</div></div>
              <div style={t.statBox}><div style={{ ...t.statNum, color: '#3b82f6' }}>{inCount}</div><div style={t.statLabel}>Currently IN</div></div>
              <div style={t.statBox}><div style={{ ...t.statNum, color: absentUsers.length > 0 ? '#ef4444' : '#94a3b8' }}>{absentUsers.length}</div><div style={t.statLabel}>Absent Today</div></div>
            </>
          )}
        </div>

        {/* Punch Card */}
        <div style={t.card}>
          <div style={t.sectionTitle}>Record Punch</div>
          <select style={t.select} value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
            {USERS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>

          {/* ✅ Show active break indicator for selected user */}
          {breakStarts[selectedUser] && (
            <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: '10px', padding: '8px 14px', marginBottom: '12px', fontSize: '0.85rem', color: '#854d0e', fontWeight: '600' }}>
              ☕ {selectedUser} is on break — click End Break when ready
            </div>
          )}

          <label style={t.checkRow}>
            <input type="checkbox" checked={useManual} onChange={e => setUseManual(e.target.checked)} />
            Enter time manually
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
            {/* ✅ Per-user break button */}
            {!breakStarts[selectedUser]
              ? <button style={{ ...btnAmber, ...(loading ? btnDisabled : {}) }} onClick={() => handleActionClick('Start Break')} disabled={loading}>☕ Start Break</button>
              : <button style={{ ...btnBlue,  ...(loading ? btnDisabled : {}) }} onClick={() => handleActionClick('End Break')}   disabled={loading}>▶ End Break</button>
            }
          </div>
          {message && <div style={message.type === 'success' ? t.successMsg : t.errorMsg}>{message.text}</div>}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <button style={t.tabBtn(activeTab === 'dashboard')} onClick={() => setActiveTab('dashboard')}>🏠 Dashboard</button>
          <button style={t.tabBtn(activeTab === 'history')}   onClick={() => setActiveTab('history')}>📋 Shift History</button>
          <button style={t.tabBtn(activeTab === 'summary')}   onClick={() => setActiveTab('summary')}>📊 Daily Summary</button>
          <button style={t.tabBtn(activeTab === 'report')}    onClick={() => setActiveTab('report')}>📥 Monthly Report</button>
        </div>

        {/* ── DASHBOARD TAB ── */}
        {activeTab === 'dashboard' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '0' }}>

              {/* Live Work Timer */}
              <div style={t.card}>
                <div style={t.sectionTitle}>⏱ Live Work Timer</div>
                {fetchLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[1,2,3].map(i => <Skeleton key={i} height="52px" borderRadius="12px" />)}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {USERS.map(user => {
                      const s       = attendanceStatus[user] || { status: 'OUT' };
                      const isIN    = s.status === 'IN' && !s.onBreak;
                      const onBreak = s.onBreak;
                      const timerMs = liveTimers[user] || 0;
                      const isOT    = timerMs > OVERTIME_HOURS * 3600 * 1000;
                      const bg      = isOT ? (darkMode ? '#1f1200' : '#fff7ed') : isIN ? (darkMode ? '#0a1f0a' : '#f0fdf4') : onBreak ? (darkMode ? '#1c1a0a' : '#fefce8') : (darkMode ? '#162032' : '#f8fafc');
                      const color   = isOT ? '#ea580c' : isIN ? '#166534' : onBreak ? '#854d0e' : '#94a3b8';
                      const border  = isOT ? '#fed7aa' : isIN ? '#86efac' : onBreak ? '#fde047' : (darkMode ? '#334155' : '#e2e8f0');
                      return (
                        <div key={user} style={{ background: bg, border: `1px solid ${border}`, borderRadius: '12px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '0.88rem', fontWeight: '700', color: darkMode ? '#e2e8f0' : '#1e293b' }}>{user}</div>
                            <div style={{ fontSize: '0.75rem', color, fontWeight: '600', marginTop: '2px' }}>
                              {isOT ? '🔥 OVERTIME' : isIN ? '🟢 Working' : onBreak ? '☕ On Break' : '⚫ Not In'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: isIN ? '1.1rem' : '0.95rem', fontWeight: '800', color, animation: isIN ? 'timerPulse 2s infinite' : 'none', fontVariantNumeric: 'tabular-nums' }}>
                              {timerMs > 0 ? formatLiveTimer(timerMs) : '--'}
                            </div>
                            {isOT && (
                              <div style={{ fontSize: '0.7rem', color: '#ea580c', fontWeight: '700' }}>
                                +{formatDuration(timerMs - OVERTIME_HOURS * 3600 * 1000)} OT
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Absent Users */}
                <div style={t.card}>
                  <div style={t.sectionTitle}>🔴 Absent Today</div>
                  {fetchLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {[1,2].map(i => <Skeleton key={i} height="36px" borderRadius="10px" />)}
                    </div>
                  ) : absentUsers.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px', background: darkMode ? '#0a1f0a' : '#f0fdf4', borderRadius: '12px' }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🎉</div>
                      <div style={{ fontSize: '0.88rem', color: '#166534', fontWeight: '700' }}>Everyone is present!</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {absentUsers.map(user => (
                        <div key={user} style={{ background: darkMode ? '#1f0a0a' : '#fff5f5', border: '1px solid #fca5a5', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                          <div style={{ fontSize: '0.9rem', fontWeight: '600', color: darkMode ? '#fca5a5' : '#991b1b' }}>{user}</div>
                          <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#94a3b8' }}>Not punched in</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Overtime Alert */}
                <div style={t.card}>
                  <div style={t.sectionTitle}>🔥 Overtime Alert</div>
                  {fetchLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {[1].map(i => <Skeleton key={i} height="36px" borderRadius="10px" />)}
                    </div>
                  ) : overtimeUsers.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px', background: darkMode ? '#162032' : '#f8fafc', borderRadius: '12px' }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>✅</div>
                      <div style={{ fontSize: '0.88rem', color: darkMode ? '#94a3b8' : '#64748b', fontWeight: '600' }}>No overtime today</div>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>Triggers after {OVERTIME_HOURS} hours</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {overtimeUsers.map(user => {
                        const timerMs = liveTimers[user] || 0;
                        const extraMs = timerMs - OVERTIME_HOURS * 3600 * 1000;
                        return (
                          <div key={user} style={{ background: darkMode ? '#1f1200' : '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', padding: '10px 14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ fontSize: '16px' }}>🔥</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: '700', color: darkMode ? '#fed7aa' : '#9a3412' }}>{user}</div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#ea580c' }}>{formatLiveTimer(timerMs)}</div>
                                <div style={{ fontSize: '0.72rem', color: '#f97316', fontWeight: '600' }}>+{formatDuration(extraMs)} overtime</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Live Attendance Status */}
            <div style={t.card}>
              <div style={t.sectionTitle}>🟢 Live Attendance Status</div>
              {fetchLoading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
                  {USERS.map(u => (
                    <div key={u} style={{ background: darkMode ? '#162032' : '#f8fafc', borderRadius: '12px', padding: '14px' }}>
                      <Skeleton height="14px" width="70%" style={{ marginBottom: '8px' }} />
                      <Skeleton height="22px" width="50%" style={{ marginBottom: '6px' }} />
                      <Skeleton height="12px" width="80%" />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
                  {USERS.map(user => {
                    const s        = attendanceStatus[user] || { status: 'OUT' };
                    const isIN     = s.status === 'IN';
                    const onBreak  = s.onBreak;
                    const bgColor  = onBreak ? (darkMode ? '#1c1a0a' : '#fefce8') : isIN ? (darkMode ? '#0a1f0a' : '#f0fdf4') : (darkMode ? '#1f0a0a' : '#fef2f2');
                    const dotColor = onBreak ? '#f59e0b' : isIN ? '#22c55e' : '#ef4444';
                    const label    = onBreak ? 'ON BREAK' : isIN ? 'IN' : 'OUT';
                    const labelClr = onBreak ? '#854d0e' : isIN ? '#166534' : '#991b1b';
                    return (
                      <div key={user} style={{ background: bgColor, borderRadius: '12px', padding: '14px', border: `1px solid ${dotColor}30` }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: '600', color: darkMode ? '#94a3b8' : '#475569', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor, animation: isIN && !onBreak ? 'pulse 2s infinite' : 'none' }} />
                          <span style={{ fontSize: '0.88rem', fontWeight: '800', color: labelClr }}>{label}</span>
                        </div>
                        {isIN  && s.lastPunchIn  && <div style={{ fontSize: '0.75rem', color: darkMode ? '#64748b' : '#94a3b8' }}>Since {s.lastPunchIn}</div>}
                        {!isIN && s.lastPunchOut && <div style={{ fontSize: '0.75rem', color: darkMode ? '#64748b' : '#94a3b8' }}>Left {s.lastPunchOut}</div>}
                        {!isIN && !s.lastPunchOut && <div style={{ fontSize: '0.75rem', color: darkMode ? '#64748b' : '#94a3b8' }}>Not yet in</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Today's Summary */}
            <div style={t.card}>
              <div style={t.sectionTitle}>📅 Today's Summary</div>
              {fetchLoading ? (
                <div>{[1,2,3].map(i => (
                  <div key={i} style={{ display: 'flex', gap: '12px', padding: '12px 0', borderBottom: `1px solid ${darkMode ? '#1e293b' : '#f1f5f9'}` }}>
                    <Skeleton height="14px" width="120px" />
                    <Skeleton height="14px" width="80px" />
                    <Skeleton height="14px" width="80px" />
                    <Skeleton height="14px" width="80px" />
                  </div>
                ))}</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>{['User','Punch In','Punch Out','Hours Worked','Live Timer','Status'].map(h => <th key={h} style={t.th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {USERS.map((user, idx) => {
                        const s       = todaySummary[user] || {};
                        const att     = attendanceStatus[user] || { status: 'OUT' };
                        const timerMs = liveTimers[user] || 0;
                        const isOT    = timerMs > OVERTIME_HOURS * 3600 * 1000;
                        return (
                          <tr key={user} style={idx % 2 === 0 ? t.trEven : t.trOdd}>
                            <td style={{ ...t.td, fontWeight: '700' }}>
                              {user}
                              {s.late && <span style={{ marginLeft: '6px', background: '#fee2e2', color: '#991b1b', borderRadius: '10px', padding: '2px 8px', fontSize: '0.7rem', fontWeight: '700' }}>⚠️ LATE</span>}
                            </td>
                            <td style={{ ...t.td, color: s.late ? '#ef4444' : '#166534', fontWeight: '600' }}>{s.punchIn || '-'}</td>
                            <td style={{ ...t.td, color: '#94a3b8' }}>{s.punchOut || '-'}</td>
                            <td style={t.td}>
                              {s.totalMs > 0
                                ? <span style={{ background: '#dbeafe', color: '#1e40af', borderRadius: '20px', padding: '3px 10px', fontSize: '0.82rem', fontWeight: '700' }}>🕐 {formatDuration(s.totalMs)}</span>
                                : <span style={{ color: '#94a3b8' }}>-</span>}
                            </td>
                            <td style={t.td}>
                              {timerMs > 0
                                ? <span style={{ color: isOT ? '#ea580c' : att.status === 'IN' ? '#166534' : '#94a3b8', fontWeight: '700', fontSize: '0.88rem', fontVariantNumeric: 'tabular-nums' }}>
                                    {isOT ? '🔥' : att.status === 'IN' ? '⏱' : '✅'} {formatLiveTimer(timerMs)}
                                  </span>
                                : <span style={{ color: '#94a3b8' }}>-</span>}
                            </td>
                            <td style={t.td}>
                              <span style={{ background: att.status === 'IN' ? '#dcfce7' : '#fee2e2', color: att.status === 'IN' ? '#166534' : '#991b1b', borderRadius: '20px', padding: '3px 10px', fontSize: '0.78rem', fontWeight: '700' }}>
                                {att.onBreak ? '☕ Break' : att.status === 'IN' ? '🟢 IN' : '🔴 OUT'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── SHIFT HISTORY TAB ── */}
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
              <div>{[1,2,3,4,5].map(i => (
                <div key={i} style={{ display: 'flex', gap: '16px', padding: '14px 12px', borderBottom: `1px solid ${darkMode ? '#1e293b' : '#f1f5f9'}`, alignItems: 'center' }}>
                  <Skeleton height="14px" width="20px" />
                  <Skeleton height="14px" width="100px" />
                  <Skeleton height="22px" width="70px" borderRadius="20px" />
                  <Skeleton height="14px" width="80px" />
                  <Skeleton height="14px" width="120px" />
                  <Skeleton height="22px" width="80px" borderRadius="20px" />
                </div>
              ))}</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No records found.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['#','User','Type','Time','Date','Shift Duration','Break','Action'].map(h => <th key={h} style={t.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {filtered.map((punch, idx) => {
                      const late = punch.label === 'Punch In' && isLateArrival(punch.time);
                      return (
                        <tr key={punch.id} style={{ background: late ? (darkMode ? '#1f0a0a' : '#fff5f5') : idx % 2 === 0 ? t.trEven.background : t.trOdd.background }}>
                          <td style={{ ...t.td, color: '#94a3b8', fontSize: '0.82rem' }}>{idx + 1}</td>
                          <td style={{ ...t.td, fontWeight: '600' }}>
                            {punch.user || '-'}
                            {late && <span style={{ marginLeft: '6px', background: '#fee2e2', color: '#991b1b', borderRadius: '10px', padding: '2px 6px', fontSize: '0.68rem', fontWeight: '700' }}>⚠️ LATE</span>}
                          </td>
                          <td style={t.td}><span style={badge(punch.label)}>{punch.label}</span></td>
                          <td style={{ ...t.td, fontWeight: '600', color: late ? '#ef4444' : '#3b82f6' }}>{punch.time}</td>
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── DAILY SUMMARY TAB ── */}
        {activeTab === 'summary' && (
          <div style={t.card}>
            <div style={t.sectionTitle}>Daily Hours Summary</div>
            {fetchLoading ? (
              <div>{[1,2,3].map(i => (
                <div key={i} style={{ display: 'flex', gap: '16px', padding: '14px 12px', borderBottom: `1px solid ${darkMode ? '#1e293b' : '#f1f5f9'}` }}>
                  <Skeleton height="14px" width="20px" />
                  <Skeleton height="14px" width="100px" />
                  <Skeleton height="14px" width="140px" />
                  <Skeleton height="22px" width="80px" borderRadius="20px" />
                </div>
              ))}</div>
            ) : summaryRows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No completed shifts yet.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['#','User','Date','Total Hours'].map(h => <th key={h} style={t.th}>{h}</th>)}</tr></thead>
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

        {/* ── MONTHLY REPORT TAB ── */}
        {activeTab === 'report' && (
          <div style={t.card}>
            <div style={t.sectionTitle}>Monthly Report Download</div>
            <div style={{ background: darkMode ? '#162032' : '#f0f9ff', border: `1px solid ${darkMode ? '#334155' : '#bae6fd'}`, borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
              <div style={{ fontSize: '0.9rem', color: darkMode ? '#94a3b8' : '#0369a1', marginBottom: '16px', fontWeight: '600' }}>
                📥 Download attendance records as CSV — opens directly in Excel
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
                style={{ padding: '12px 24px', background: downloading ? '#94a3b8' : '#3b82f6', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '0.95rem', cursor: downloading ? 'not-allowed' : 'pointer' }}
                onClick={downloadMonthlyReport} disabled={downloading}>
                {downloading ? '⏳ Generating...' : `📥 Download ${reportMonth} ${reportYear} Report`}
              </button>
              {reportMsg && (
                <div style={{ ...(reportMsg.type === 'success' ? { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' } : { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }), borderRadius: '10px', padding: '10px 14px', marginTop: '14px', fontSize: '0.88rem', fontWeight: '600' }}>
                  {reportMsg.text}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
