// Study Session JavaScript functionality — wall-clock based, survives popup close
// Now alternates Work ↔ Rest with random phase-complete messages
// Enforces a minimum work duration of 10 seconds
let currentSession = null; // { type, startTime, endTime, duration, paused, pausedAt? }
let timer = null;          // UI repaint interval only
let isRunning = false;
let isPaused = false;
let isActive = false;
let timeRemaining = 0;     // seconds


// ====================================================================================================
// TODO: Move this functionality back to the service worker because this must run in the background.
// ====================================================================================================
// Work/Rest phase tracking
let phase = null; // 'work' | 'rest'

// Fun messages
const workCompleteMsgs = [
    "Great job! Time to recharge.",
    "Nice focus session—grab some water!",
    "You crushed it. Stretch time!",
    "Deep breath—enjoy a short break.",
  ];
const restCompleteMsgs = [
    "Break’s over—let’s dive back in!",
    "Refreshed? Back to it!",
    "You’ve got this—time to focus.",
    "Small steps, big wins—let’s go!",
  ];

let settings = {
    workDuration: 25,  // work (minutes)
    restDuration: 5, // rest (minutes)
    notifications: true
  };

// NEW: minimum work duration
const MIN_WORK_DURATION = 1;

async function init() {
  try {
    await loadSettings();
    await loadSessionData();   // reconstruct state from storage
    console.log(currentSession);
    setupEventListeners();
    updateUI();
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
    const data = await chrome.storage.local.get(['currentSession', 'phase', 'isRunning', 'isPaused', 'isActive']);
    if (data.phase) phase = data.phase;
    isRunning = data.isRunning;
    isPaused = data.isPaused;
    isActive = data.isActive;

    if (data.currentSession) {
      currentSession = data.currentSession;
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
      settings.restDuration = parseInt(event.target.value, 10);
      saveSettings();
    });
  }

  const startBtn = document.getElementById('startTimer');
  if (startBtn) {
    startBtn.addEventListener('click', () => startSession());
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
}

function refreshStateFromWallClock() {
  if (!currentSession) {
    isRunning = false;
    isPaused = false;
    timeRemaining = 0;
    updateUI();
    return;
  }

  const s = currentSession;

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
  // ===========================================================================================
  // TODO Send message to service worker and complete session/do both.
  // ===========================================================================================

  updateUI(); // do we need to refresh the whole UI or can we just do the timer?
}

function startUITimer() {
  console.log("UI Timer");
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    if (!isPaused) {
      refreshStateFromWallClock(); // same thing do we need to refresh the whole thing or just the timer?
    }
  }, 1000);
}

// helpers for durations & phases
function getWorkDuration() {
  // Enforce minimum on read as well
  return Math.max(MIN_WORK_DURATION, settings.workDuration);
}

function getRestDuration() { 
  return settings.restDuration; 
}

// ===========================================================================================
// TODO Send message to service worker and not start work
// ===========================================================================================
async function startSession() {
  // start a Work phase based on the current slider, clamped to minimum
  const workSlider = document.getElementById('workRange');
  if (!workSlider) {
    console.log("No slider found, using default time.")
  } else {
    const minutes = parseInt(workSlider.value, 10);
    settings.workDuration = Math.max(MIN_WORK_DURATION, minutes);
    console.log("Starting session with custom time:", settings.workDuration);
  }
  isActive = true;
  phase = 'work';
  let duration = settings.workDuration;
  const now = Date.now()
  let currentSession = {
    startTime: now,
    endTime: now + (duration * 60000),
    duration: duration,
    settings: settings
  };

  try {
    await chrome.storage.local.set({ currentSession: currentSession, phase: phase, isActive: true });
  } catch (error) {
    console.error('Failed to save session data:', error);
  }
  console
  let response = await chrome.runtime.sendMessage({
      action: 'START-SESSION',
      duration: duration
  });
  isPaused = response.isPaused;
  isRunning = response.isRunning;
  startUITimer();
  updateUI();
}

async function stopTimer() {
  // terminate the whole loop
  try {
    let response = await chrome.runtime.sendMessage({ action: 'SESSION_ENDED' });
    isRunning = response.isRunning;
    isPaused = response.isPaused;
    isActive = response.isActive;
    if (timer) clearInterval(timer);
    timer = null;
    currentSession = null;
    timeRemaining = 0;
    phase = null;
    await chrome.storage.local.set({ isActive: isActive, currentSession: currentSession, phase: phase });
    await persistSession(); // writes null currentSession, keeps last phase value
    updateUI();
  } catch (err) { /* no-op */ }
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
  const progressFill = document.getElementById('progressFill');

  if (timerDisplay) {
    const fallback = (phase === 'rest') ? getRestDuration() : getWorkDuration();
    const time = (currentSession ? timeRemaining : fallback); // look here first
    // ===========================================================
    timerDisplay.textContent = formatTime(time);
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
  const activeSection = document.getElementById('isActiveSection');
  const starterSection = document.getElementById('sessionStarterSection');
  const pauseBtn = document.getElementById('pauseSession');

  if (isActive) {
    if (activeSection) activeSection.style.display = 'block';
    if (starterSection) starterSection.style.display = 'none';
    if (pauseBtn) pauseBtn.innerHTML = isPaused ? '▶️ Resume' : '⏸️ Pause';
  } else {
    if (activeSection) activeSection.style.display = 'none';
    if (starterSection) starterSection.style.display = 'block';
  }
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

init();