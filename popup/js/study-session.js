// Study Session JavaScript functionality — wall-clock based, survives popup close
// Now alternates Work ↔ Rest with random phase-complete messages
// Enforces a minimum work duration of 10 seconds
currentSession = null; // { type, startTime, endTime, duration, paused, pausedAt? }
timer = null;          // UI repaint interval only
isRunning = false;
isPaused = false;
timeRemaining = 0;     // seconds
sessionType = 'pomodoro';

// Work/Rest phase tracking
phase = 'work'; // 'work' | 'rest'

// Fun messages
workCompleteMsgs = [
  "Great job! Time to recharge.",
  "Nice focus session—grab some water!",
  "You crushed it. Stretch time!",
  "Deep breath—enjoy a short break.",
];
restCompleteMsgs = [
  "Break’s over—let’s dive back in!",
  "Refreshed? Back to it!",
  "You’ve got this—time to focus.",
  "Small steps, big wins—let’s go!",
];

settings = {
  pomodoro: 25 * 60,  // work (seconds)
  shortBreak: 5 * 60, // rest (seconds)
  longBreak: 15 * 60, // unused for now
  notifications: true
};

// NEW: minimum work duration
MIN_WORK_SECONDS = 10;

async function init() {
  try {
    await loadSettings();
    await loadSessionData();   // reconstruct state from storage
    setupEventListeners();
    // updateUI();

    // Keep UI in sync if another context changes currentSession
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.currentSession) {
        currentSession = changes.currentSession.newValue || null;
        refreshStateFromWallClock();
      }
      if (changes.phase) {
        phase = changes.phase.newValue || 'work';
        updateUI();
      }
    });
  } catch (error) {
    console.error('Failed to initialize study session manager:', error);
  }
}

async function loadSettings() {
  try {
    const data = await chrome.storage.local.get(['sessionSettings']);
    if (data.sessionSettings) {
      settings = { ...settings, ...data.sessionSettings };
    }
  } catch (error) {
    console.error('Failed to load session settings:', error);
  }
}

async function saveSettings() {
  try {
    await chrome.storage.local.set({ sessionSettings: settings });
  } catch (error) {
    console.error('Failed to save session settings:', error);
    throw error;
  }
}

async function loadSessionData() {
  try {
    const data = await chrome.storage.local.get(['currentSession', 'phase']);
    if (data.phase) phase = data.phase;

    if (data.currentSession) {
      currentSession = data.currentSession;
      sessionType = currentSession.type;
      // derive flags & remaining from wall clock
      refreshStateFromWallClock();
      if (currentSession) {
        startUITimer();
      }
    }
  } catch (error) {
    console.error('Failed to load session data:', error);
  }
}

async function persistSession() {
  try {
    await chrome.storage.local.set({ currentSession: currentSession, phase: phase });
  } catch (error) {
    console.error('Failed to save session data:', error);
  }
}

function setupEventListeners() {
  // Timer sliders
  const workSlider = document.getElementById('workRange');
  const workTime = document.getElementById('work-time');
  const restSlider = document.getElementById('restRange');
  const restTime = document.getElementById('rest-time');

  if (workSlider && workTime) {
    workTime.textContent = workSlider.value;
    workSlider.addEventListener('input', (event) => {
      workTime.textContent = event.target.value;
      settings.pomodoro = parseInt(event.target.value, 10) * 60;
      saveSettings();
    });
  }

  if (restSlider && restTime) {
    restTime.textContent = restSlider.value;
    restSlider.addEventListener('input', (event) => {
      restTime.textContent = event.target.value;
      settings.shortBreak = parseInt(event.target.value, 10) * 60;
      saveSettings();
    });
  }

  // Start button (HTML id is "startTimer")
  const startBtn = document.getElementById('startTimer');
  if (startBtn) {
    startBtn.addEventListener('click', () => startCustomSession());
  }

  // Session controls
  const pauseSessionBtn = document.getElementById('pauseSession');
  const endSessionBtn = document.getElementById('endSession');

  if (pauseSessionBtn) {
    pauseSessionBtn.addEventListener('click', () => togglePause());
  }
  if (endSessionBtn) {
    endSessionBtn.addEventListener('click', () => stopTimer());
  }
}

// --- Wall clock core -------------------------------------------------------

function refreshStateFromWallClock() {
  if (!currentSession) {
    isRunning = false;
    isPaused = false;
    timeRemaining = 0;
    updateUI();
    return;
  }

  const s = currentSession;
  sessionType = s.type;

  let remainingMs;
  if (s.paused) {
    // freeze remaining time at pause moment
    remainingMs = Math.max(0, s.endTime - (s.pausedAt || Date.now()));
    isPaused = true;
    isRunning = false;
  } else {
    remainingMs = Math.max(0, s.endTime - Date.now());
    isPaused = false;
    isRunning = remainingMs > 0;
  }

  timeRemaining = Math.ceil(remainingMs / 1000);

  if (timeRemaining <= 0) {
    completeSession(); // will chain to next phase
    return;
  }

  updateUI(); // do we need to refresh the whole UI or can we just do the timer?
}

function startUITimer() {
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    if (!isPaused) {
      refreshStateFromWallClock(); // same thing do we need to refresh the whole thing or just the timer?
    }
  }, 1000);
}

// --- Session lifecycle -----------------------------------------------------

async function startSession(type, durationSeconds) {
  // Ensure minimum duration for work/custom timers
  if (type === 'pomodoro' || type === 'custom') {
    durationSeconds = Math.max(MIN_WORK_SECONDS, durationSeconds);
  }

  // type: 'pomodoro' (work) or 'shortBreak' (rest) or 'custom'
  const now = Date.now();
  const endTime = now + durationSeconds * 1000;

  currentSession = {
    type,
    startTime: now,
    endTime,              // wall-clock end
    duration: durationSeconds,
    paused: false
  };

  isRunning = true;
  isPaused = false;

  // Keep the overall study "active" across phases
  await chrome.storage.local.set({ activeSession: true });
  await persistSession();
  startUITimer();
  updateUI();

  // (Optional) notify background
  try {
    await chrome.runtime.sendMessage({
      action: 'SESSION_STARTED',
      sessionType: type,
      duration: durationSeconds
    });
  } catch (err) { /* no-op */ }
}

// helpers for durations & phases
function getWorkDuration() {
  // Enforce minimum on read as well
  return Math.max(MIN_WORK_SECONDS, settings.pomodoro);
}

function getRestDuration() { 
  return settings.shortBreak; 
}

async function startWork() {
  phase = 'work';
  // await persistSession(); // writes phase
  await startSession('pomodoro', getWorkDuration());
}

async function startRest() {
  phase = 'rest';
  await persistSession(); // writes phase
  await startSession('shortBreak', getRestDuration());
}

function startCustomSession() {
  // start a Work phase based on the current slider, clamped to minimum
  const workSlider = document.getElementById('workRange');
  if (workSlider) {
    const minutes = parseInt(workSlider.value, 10);
    settings.pomodoro = Math.max(MIN_WORK_SECONDS, minutes * 60);
  } else {
    settings.pomodoro = Math.max(MIN_WORK_SECONDS, settings.pomodoro);
  }
  startWork();
}

async function stopTimer() {
  // terminate the whole loop
  isRunning = false;
  isPaused = false;
  if (timer) clearInterval(timer);
  timer = null;
  currentSession = null;
  timeRemaining = 0;

  await chrome.storage.local.set({ activeSession: false });
  await persistSession(); // writes null currentSession, keeps last phase value
  updateUI();

  try {
    await chrome.runtime.sendMessage({ action: 'SESSION_ENDED' });
  } catch (err) { /* no-op */ }
}

// When a single phase finishes → open new tab and auto-queue the next phase
async function completeSession() {
  if (timer) clearInterval(timer);
  timer = null;
  isRunning = false;
  isPaused = false;

  // Choose a message by phase
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  let title, msg;
  if (phase === 'work') {
    title = 'Focus Session Complete!';
    msg = pick(workCompleteMsgs);
  } else {
    title = 'Rest Complete!';
    msg = pick(restCompleteMsgs);
  }

  // Open new tab instead of notification
  try {
    await chrome.runtime.sendMessage({
      action: 'OPEN_SESSION_COMPLETE_TAB',
      phase: phase,
      message: msg,
      title: title
    });
  } catch (err) {
    console.log('Could not open session complete tab:', err);
  }

  // Clear finished session but KEEP activeSession true (we're chaining)
  currentSession = null;
  await persistSession();
  updateUI();

  // Chain to next phase immediately
  if (phase === 'work') {
    await startRest();
  } else {
    await startWork();
  }
}

// --- Pause/Resume ----------------------------------------------------------

async function pauseTimer() {
  if (!currentSession || !isRunning || isPaused) return;
  isPaused = true;
  isRunning = false;
  currentSession.paused = true;
  currentSession.pausedAt = Date.now();
  await persistSession();
  updateSessionControls();
}

async function resumeTimer() {
  if (!currentSession || isRunning || !isPaused) return;
  const delta = Date.now() - (currentSession.pausedAt || Date.now());
  currentSession.endTime += delta; // shift end time forward by pause duration
  currentSession.paused = false;
  delete currentSession.pausedAt;

  isPaused = false;
  isRunning = true;
  await persistSession();
  startUITimer();
  updateTimerDisplay();

  const pauseBtn = document.getElementById('pauseSession');
  if (pauseBtn) pauseBtn.innerHTML = '⏸️ Pause';
}

function togglePause() {
  if (isRunning && !isPaused) pauseTimer();
  else if (isPaused) resumeTimer();
}

// --- UI helpers ------------------------------------------------------------

function updateUI() {
  updateTimerDisplay(); // why is this being called during init?
  updateSessionControls(); // this is being called after so it just overwrites the previous one during init?
}

function updateTimerDisplay() {
  const timerDisplay = document.getElementById('timerDisplay');
  const sessionTypeDisplay = document.getElementById('sessionType');
  const progressFill = document.getElementById('progressFill');

  if (timerDisplay) {
    const fallback = (phase === 'rest') ? getRestDuration() : getWorkDuration();
    const time = (currentSession ? timeRemaining : fallback);
    timerDisplay.textContent = formatTime(time);
  }

  if (sessionTypeDisplay) {
    // Show explicit label by phase
    sessionTypeDisplay.textContent = (phase === 'rest')
      ? '☕ Rest Time'
      : '🍅 Focus Session';
  }

  if (progressFill && currentSession) {
    const elapsed = currentSession.duration - timeRemaining;
    const pct = (elapsed / currentSession.duration) * 100;
    progressFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  } else if (progressFill) {
    progressFill.style.width = '0%';
  }
}

function updateSessionControls() {
  const activeSection = document.getElementById('activeSessionSection');
  const starterSection = document.getElementById('sessionStarterSection');
  const pauseBtn = document.getElementById('pauseSession');

  const showActive = !!currentSession && (isRunning || isPaused);
  if (showActive) {
    if (activeSection) activeSection.style.display = 'block';
    if (starterSection) starterSection.style.display = 'none';
    if (pauseBtn) pauseBtn.innerHTML = isPaused ? '▶️ Resume' : '⏸️ Pause';
  } else {
    if (activeSection) activeSection.style.display = 'none';
    if (starterSection) starterSection.style.display = 'block';
  }
}

function showNotification(title, message) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body: message, icon: '../images/hello_extensions.png' });
  } else if ('Notification' in window && Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification(title, { body: message, icon: '../images/hello_extensions.png' });
      }
    });
  }
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// document.addEventListener('DOMContentLoaded', () => {
//   const mgr = new StudySessionManager();
//   window.studySessionManager = mgr; // expose for debugging
// });

init();