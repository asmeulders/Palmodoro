# Palmodoro - Your new study assistant!

## BostonHacks2025

Palmodoro is a chrome extension that utilizes the powerful technique of "Pomodoro", incented by Francesco Cirillo to help deal with pressure and maintain a _sustainable_ work effort. (https://www.pomodorotechnique.com/) Additionally, we took inspiration from the palm pilot which set out to be a handheld productivity device before the smart phone.

<img src="images/PalmPilot.jpg" width="200">

These two philosophies inspired us to make a retro themed chrome extension, along the lines of a 'dumb phone' which would help you stay on top of your work without getting distracted!

## Features

### Study Teacher (Professor StudyBot)
- **AI-Powered Learning Assistant**: Integrated Gemini AI configured as "Professor StudyBot"
- **Socratic Method Teaching**: Guides students to solutions rather than giving direct answers
- **Subject-Specific Approaches**: Tailored teaching for Math/Science, Literature, History, Programming, and Study Skills
- **Session Context Tracking**: Remembers previous questions in study sessions
- **Encouraging Feedback**: Dynamic encouraging phrases and progress recognition
<img src='https://github.com/asmeulders/BostonHacks2025/blob/main/readmeGif/AI_Assisstant.gif' />

### Pomodoro Timer System
- **Work/Break Session Management**: Customizable work and break durations
- **Persistent Timer State**: Continues running even if extension is closed
- **Session Completion Notifications**: Visual completion pages with session summaries
- **Background Processing**: Service worker maintains timer state
<img src='https://github.com/asmeulders/BostonHacks2025/blob/main/readmeGif/timer.gif' />

### Distraction Management
- **Smart Domain Detection**: Automatically identifies work-related domains
- **Distraction Alerts**: Warns users when visiting non-work sites during work sessions
- **Work Domain Persistence**: Remembers designated work sites across sessions
- **Tab Monitoring**: Real-time tracking of active tabs during study sessions
<img src='readmeGif/TabSwitch.gif' />

### Other function - Task Manager
<img src='https://github.com/asmeulders/BostonHacks2025/blob/main/readmeGif/task_manager.gif' />

## Installation

1. **Download/Clone** this repository
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer Mode** (toggle in top right)
4. **Click "Load unpacked"** and select the project folder
5. **Configure Gemini API** (see API Setup below)

## API Setup

### Gemini AI Configuration
1. **Get API Key**: Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. **Add to Config**: Rename `example-config.json` to `config.json` and insert your API key:
   ```json
   {
     "geminiApiKey": "YOUR_API_KEY_HERE"
   }
   ```
3. Uncomment/comment lines in `service-worker.js` to get the response from the API.
```js
// response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`, {
//   method: 'POST',
//   headers: {
//     'Content-Type': 'application/json'
//   },
//   body: JSON.stringify(requestBody)
// });
response = '{"candidates": [{"content": {"parts": [{ "text": "Of course, happy to help!"}]}}]}'; // test response for sessionContext. Comment this out and uncomment above when using valid API key
```
3. **Reload Extension**: Refresh the extension in Chrome

The extension automatically loads the API key from `config.json` and stores it securely in Chrome storage.

## Usage Guide

### Study Sessions
1. **Click Extension Icon** in Chrome toolbar
2. **Select Study Session** (pen and notepad - top middle icon)
3. **Set Timer** and get to work! (25 minutes default)
4. **Get distraction alerts** if you navigate to non-work sites

### Domain Management
1. **Access Domain Manager** (key icon)
2. **Add/remove work domains** manually or through distraction alerts

### Study Chats
1. **Open Study Chat** (Gemini icon)
2. **Ask study-related questions**
3. **Session context** resets each time you enter the chat

## Technical Architecture

### Core Components
- **Service Worker**: `service-worker.js` - Background processing, timer management, AI integration
- **Popup Interface**: `popup/` - Main user interface and navigation
- **Content Scripts**: `content-scripts/distraction.js` - Sends distraction alert directly to DOM.
- **AI Integration**: Inline Gemini API implementation with Professor StudyBot persona

### Key Technologies
- **Chrome Extensions API** (Manifest v3)
- **Google Gemini AI** (generativelanguage.googleapis.com)
- **Chrome Storage API** for persistence
- **Chrome Alarms API** for timer functionality
- **Chrome Tabs API** for distraction detection


### Timer Functionality
- **Customizable Durations**: Adjustable work/break periods (cycles until the session termination by user)
- **State Persistence**: Survives browser/extension restarts and continues in the background

### Distraction Detection
- **Automatic Domain Learning**: Identifies distractions upon webpage load
- **Real-time Monitoring**: Tracks tab switches during work sessions
- **Alert System**: Intrusive warnings for off-task browsing keeps you on task
- **Domain Management**: Manual override and configuration options

## Development

### Setup
```bash
git clone [repository]
cd BostonHacks2025
# Load as unpacked extension in Chrome
```

### Key Files to Modify
- **Service Worker**: `service-worker.js` - Background logic
- **UI Styles**: `popup/styles/main.css` - Global styling
- **AI Prompts**: `service-worker.js` (buildTeacherPrompt function)
- **Configuration**: `config.json` - API keys and settings

### Extension Permissions
- **tabs**: Tab monitoring for distraction detection
- **activeTab**: Current tab information access
- **storage**: Persistent timer and configuration storage
- **scripting**: Content script injection for alerts
- **alarms**: Background timer functionality
- **notifications**: Alerts for session completion

## Troubleshooting

### Debug Console
- **Extension Popup**: Right-click popup → "Inspect"
- **Service Worker**: Chrome Extensions page → "Service Worker" link
- **Content Scripts**: F12 on any webpage → Console tab

## Future Enhancements

### Potential Features
- **Study Analytics**: Session statistics and productivity metrics
- **Custom Study Plans**: Personalized learning schedules
- **Collaborative Sessions**: Multi-user study rooms
- **Advanced AI**: Subject-specific AI tutors
- **Mobile Companion**: Smartphone app integration

### Technical Improvements
- **Offline Support**: Local AI model integration
- **Enhanced Analytics**: Detailed productivity tracking
- **Custom Themes**: User-configurable color schemes
- **Plugin System**: Modular feature architecture

## License

This project is developed for BostonHacks2025 hackathon.

## Acknowledgments

- Authors: Alexander Smeulders, Andrew Cho, Ethan Cappelleri, Sohan Atluri
- **Google Gemini AI** for intelligent tutoring capabilities
- **Chrome Extensions API** for platform foundation
- **BostonHacks2025** for the hackathon opportunity