// StudyFocusManager functionality (inline implementation)
const geminiApiKey = null;
let studyFocusManager = null;

// Study Teacher Configuration
const encouragingPhrases = [
  "Great question! 🤔",
  "I love your curiosity! 📚", 
  "Let's explore this together! 🔍",
  "Excellent thinking! 💡",
  "That's a thoughtful question! 🎯",
  "I can help you understand this! 🌟",
  "Let's break this down step by step! 📝",
  "Perfect topic to dive into! 🚀"
];

// Get random encouraging phrase
function getEncouragingPhrase() {
  return encouragingPhrases[Math.floor(Math.random() * encouragingPhrases.length)];
}

// Enhanced prompt with session context for Study Teacher
function buildTeacherPrompt(question) {
  const sessionContext = studySession.questionsAsked > 0 
    ? `\n\n📊 **SESSION CONTEXT:** This is question #${studySession.questionsAsked + 1} in our study session. Previous subjects covered: ${studySession.subjects.join(', ') || 'None yet'}.`
    : '\n\n🎯 **SESSION START:** Welcome to our study session!';
  
  return `You are Professor StudyBot 🎓, an experienced and caring academic tutor specializing in helping students truly understand concepts.

🎯 **YOUR MISSION:** Help students LEARN and UNDERSTAND, not just get answers.

📖 **TEACHING APPROACH BY SUBJECT:**
• **Math/Science:** Show step-by-step solutions, explain the "why" behind each step, use real-world applications
• **Literature/Writing:** Ask about themes, guide analysis, help develop critical thinking
• **History:** Connect events to causes/effects, relate to current events when relevant  
• **Programming:** Explain logic flow, suggest debugging approaches, teach best practices
• **Study Skills:** Provide proven techniques, time management, memory strategies

💡 **RESPONSE FORMULA:**
1. **Acknowledge:** Start with "${getEncouragingPhrase()}"
2. **Teach:** Break down the concept step-by-step with clear explanations
3. **Example:** Provide a relatable example or analogy when helpful
4. **Engage:** End with a thought-provoking follow-up question to deepen learning
5. **Encourage:** Remind them they're making progress

🎪 **PERSONALITY TRAITS:**
- Patient and never condescending 
- Enthusiastic about learning
- Uses analogies and real-world connections
- Asks Socratic questions to guide discovery
- Celebrates student insights and progress

⚡ **SPECIAL RULES:**
- For homework: Guide to solution, don't just give answers
- For unclear questions: Ask clarifying questions
- For off-topic questions: Gently redirect to academic topics
- Keep responses focused (2-4 paragraphs) but thorough
- Reference previous questions in the session when relevant

${sessionContext}

**Student's Question:** "${question}"

Now help them learn! 🚀`;
}

// Load Gemini API key
async function loadGeminiApiKey() {
  try {    
    // Try to load from config.json
    const response = await fetch(chrome.runtime.getURL('config.json'));
    const config = await response.json();
    
    if (config.geminiApiKey) { // && geminiApiKey.trim()) {
      geminiApiKey = config.geminiApiKey;// .trim();
      await chrome.storage.local.set({ geminiApiKey: geminiApiKey });
      console.log('API key loaded from config.json and stored in Chrome storage');
    } else {
      console.warn('No API key found in config.json - Gemini chat will not work');
    }
  } catch (error) {
    console.error('Error loading Gemini API key:', error);
  }
}

// Ask Gemini AI a question with Study Teacher persona
async function askGemini(question) {
  if (!geminiApiKey) {
    await loadGeminiApiKey();
  }
  
  if (!geminiApiKey) {
    return 'Gemini API key not configured. Please set it up first.';
  }

  console.log('🎓 Professor StudyBot is analyzing your question:', question);

  try {
    // Track study session progress
    if (!studySession.startTime) {
      studySession.startTime = Date.now();
      console.log('New study session started!');
    }
    studySession.questionsAsked++;

    const requestBody = {
      contents: [{
        parts: [{
          text: buildTeacherPrompt(question)
        }]
      }]
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('Gemini API response status:', response.status);

    const data = await response.json();
    console.log('Gemini API response received');
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const answer = data.candidates[0].content.parts[0].text;
      console.log('Professor StudyBot provided an answer!');
      return answer;
    } else {
      console.log('No valid response found');
      if (data.error) {
        console.log('API Error:', data.error);
        return `API Error: ${data.error.message || 'Unknown error'}`;
      }
      return 'Sorry, I couldn\'t generate a response.';
    }
  } catch (error) {
    console.error('Gemini API error:', error);
    return 'Error connecting to AI service. Please try again.';
  }
}

// Initialize study chat functionality
async function initializeStudyFocusManager() {
  try {
    await loadGeminiApiKey();
    studyFocusManager = true; // Just a flag to indicate it's ready
    console.log('Study Teacher functionality initialized');
  } catch (error) {
    console.error('Failed to initialize study teacher:', error);
  }
}

// Handle study question requests
async function handleStudyQuestion(question) {
  console.log('handleStudyQuestion called with:', question);
  try {
    const result = await askGemini(question);
    console.log('handleStudyQuestion returning answer');
    return result;
  } catch (error) {
    console.error('handleStudyQuestion error:', error);
    throw error;
  }
}

// Show distraction alert
async function distractionAlertMessage(tab, domain) {
  try {
    if (!validSite(tab)) return;
    console.log('Showing distraction alert for:', domain);

    // Send message to show alert
    await chrome.tabs.sendMessage(tab.id, {
      action: 'showDistractionAlert',
      domain: domain
    }, (response) =>{
      if (response) {
        console.log("Successfully shown alert")
      }
    });
  } catch (error) {
    console.error('Error showing distraction alert:', error);
  }
}

// Tab monitoring for distraction detection
async function handleTabSwitch(tabId) {
  // ============================================================================
  // TODO: 
  // - Move checking domain logic to distraction-popup.js
  // ============================================================================
  try {
    // Only monitor during work sessions
    // if (!isRunning || phase !== 'work') {
    //   return;
    // }
    const tab = await chrome.tabs.get(tabId);
    if (!validSite(tab)) return;
    const domain = getDomainFromUrl(tab.url);

    console.log('Current domain:', domain);

    chrome.storage.local.get(["workDomains"], (result) => {
      const domains = result.workDomains || [];
      
      const isAllowed = domains.includes(domain);

      if (!isAllowed) {
        console.log("Blocked!");
        distractionAlertMessage(tab, domain);
      }
    }); 
  } catch (error) {
    console.error('Error handling tab switch:', error);
  }
}

// Extract domain from URL
function getDomainFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch (error) {
    console.error('Error parsing URL:', url, error);
    return null;
  }
}



// ===========================================================================================
// Background Timer
// ===========================================================================================
async function setTimer(duration) {
  try {
    await chrome.alarms.create("pomodoroTimer", { delayInMinutes: duration});
    console.log("Set pomodor timer for duration:", duration);
  } catch(e) {
    console.error("Failed to set timer:", e);
  }
}

// When a single phase finishes -> open new tab and auto-queue the next phase
async function completeSession() {
  // isRunning = false;
  // isPaused = false;
  const result = await chrome.storage.local.get(['currentSession', 'phase']);
  let currentSession = result.currentSession;
  let phase = result.phase;
  
  // Open new tab instead of notification
  await showCompletionTab(phase);
  // updateUI();

  if (phase === 'work') {
    console.log("Starting rest.");
    phase = 'rest';
    currentSession.duration = currentSession.settings.restDuration;
    try {
      await chrome.storage.local.set({ phase: phase , currentSession: currentSession});
    } catch (error) {
      console.error('Failed to save session data:', error);
    }
    setTimer(currentSession.duration);
  } else {
    console.log("Starting work.");
    phase = 'work';
    currentSession.duration = currentSession.settings.workDuration;
    try {
      await chrome.storage.local.set({ phase: phase , currentSession: currentSession});
    } catch (error) {
      console.error('Failed to save session data:', error);
    }
    setTimer(currentSession.duration);
  }
}

// Show session completion tab
async function showCompletionTab(phase) {
  try {
    const url = chrome.runtime.getURL('./popup/pages/timer-complete.html') + `?phase=${phase}`;
    await chrome.tabs.create({ url: url });
    console.log('Completion tab created');
  } catch (error) {
    console.error('Failed to create completion tab:', error);
  }
}

// ===================
// MESSAGE HANDLERS
// ===================

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Service worker received message:', request);

  // Study chat functionality
  if (request.action === 'askStudyQuestion') {
    console.log('Handling study question:', request.question);
    handleStudyQuestion(request.question)
      .then((result) => {
        console.log('Got answer from Professor StudyBot:', result.substring(0, 100) + '...');
        sendResponse({ success: true, result });
      })
      .catch(error => {
        console.error('Study question error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Asynchronous
  }

  if (request.action === "closeTab") {
    // sender.tab.id is the ID of the tab that sent the message

    let queryOptions = { active: true, lastFocusedWindow: true };
    chrome.tabs.query(queryOptions, ([tab]) => {
      if (tab) {
        chrome.tabs.remove(tab.id);
        console.log("Distracting tab closed:", tab.url);
      }
    });
  }

  if (request.action === "START-SESSION") {
    setTimer(request.duration)
      .then((result) => {
        console.log('Successfully started session');
        sendResponse({ success: true, isRunning: true, isPaused: false });
      })
      .catch(error => {
        console.error('Session initialization error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === "SESSION_ENDED") {
    chrome.alarms.clear('pomodoroTimer')
      .then((result) => {
        console.log('Successfully stopped timer');
        sendResponse({ success: true, isRunning: false, isPaused: false, isActive: false });
      })
      .catch(error => {
        console.error('Error stopping timer:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

function validSite(tab){
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) {
    console.log('Ignoring restricted browser page:', tab.url.substring(0,19) + '...');
    return false;
  }
  return true;
}


// Initialize when service worker starts
initializeStudyFocusManager();


// Set up tab monitoring for distraction detection
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  console.log('Tab activated:', activeInfo.tabId);
  await handleTabSwitch(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    console.log('Tab updated and active:', tabId, tab.url);
    await handleTabSwitch(tabId);
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "pomodoroTimer") {
    console.log("Timer finished.");
    await completeSession();
  }
});


// ===========================
// TODO: Check alarm state on start up
// ============================
// async function checkAlarmState() {
//   const alarm = await chrome.alarms.get("my-alarm");

//   if (!alarm) {
//     await chrome.alarms.create("my-alarm", { periodInMinutes: 1 });
//   }
// }

// checkAlarmState();