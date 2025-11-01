# Lectura Lite - Chrome Extension

![Lectura Offline](https://img.shields.io/badge/Chrome-Extension-blue?style=for-the-badge&logo=google-chrome)
![Version](https://img.shields.io/badge/version-1.0.0-green?style=for-the-badge)
![Privacy](https://img.shields.io/badge/privacy-100%25%20offline-orange?style=for-the-badge)

**Lectura Lite** is an offline AI-powered Chrome Extension that uses a **sidebar interface** for summarizing, rewriting, translating, and chatting about documents using Chrome's built-in Gemini Nano AI.

Unlike cloud-based AI tools, Lectura Lite runs directly on your device with Chrome's Prompt API (Gemini Nano), providing:  

- 🔒 **Privacy**: No data ever leaves your device  
- 🌐 **Offline**: Works without internet once model is downloaded  
- ⚡ **Speed**: Instant local AI processing  
- 💬 **Chat**: Interactive AI conversations about your documents  

---

## 🧩 Key Features

### 1. **Sidebar Interface** 
Click the extension icon to open an elegant sidebar that slides in from the right. The sidebar provides:
- **Home Screen**: Quick access to Summarize, Proofread, and Translate actions
- **Chat Interface**: Full ChatGPT-like conversation experience
- **Document Context**: Automatically extracts and uses page content
- **Retry Button**: Reload document context with one click
- **PDF Support**: Works with both webpages and PDF documents
- **State Persistence**: Remembers your chat sessions

### 2. **Smart AI Chat with Document Context** (✨ NEW!)
Interactive chat powered by Chrome's Gemini Nano AI:
- 💬 Ask questions about the current document
- 🧠 AI has full context of the page content
- ⌨️ ChatGPT-like interface with typing animation
- 💾 Session persistence - resume conversations
- 🎯 Quick prompts for common tasks

### 3. **Document Summarizer**
Automatically extracts document content and creates summaries:
- 📝 Bullet points for quick review
- 📄 Paragraph format for comprehensive notes
- 🃏 Flashcard-style Q&A format
- 📑 **PDF Support**: Works with PDF documents in Chrome

### 4. **Proofreader & Grammar Checker**
AI-powered text correction:
- ✅ Grammar and spelling fixes
- ✨ Style improvements
- 📚 Multiple writing modes

### 5. **Instant Translator**
Translate content using AI:
- 🌍 Multiple language support
- 🔌 Works offline
- 🎯 Context-aware translations

---

## 🚀 Installation & Setup

### Step 1: Install Chrome Canary/Dev
You need Chrome 126+ with Prompt API support:
- Download [Chrome Canary](https://www.google.com/chrome/canary/)

### Step 2: Enable Chrome Flags
Navigate to `chrome://flags` and enable:
1. `#prompt-api-for-gemini-nano` → **Enabled**
2. `#optimization-guide-on-device-model` → **Enabled BypassPerfRequirement**

Restart Chrome.

### Step 3: Download Gemini Nano Model
Open DevTools Console (F12) and run:
```javascript
await ai.languageModel.create();
```
Wait for the ~1-2GB model to download.

### Step 4: Install Extension
1. Clone/download this repository
2. Open `chrome://extensions/`
3. Enable **Developer Mode**
4. Click **Load unpacked** → select extension folder
5. Click the extension icon to open the sidebar!

📖 **See [SETUP.md](SETUP.md) for detailed instructions**

---

## 🎯 How to Use

### Method 1: Sidebar (Main Interface)
1. **Click the extension icon** → Sidebar opens on the right
2. **Document loads automatically** from the current page
3. Choose an action:
   - Click **Summarize**, **Proofread**, or **Translate**
   - Or click **Chat with AI** for interactive conversations
4. **AI processes** with full page context
5. **View results** with copy/export options

### Method 2: Right-Click Menu
1. **Select text** on any webpage
2. **Right-click** → Lectura App Offline
3. Choose: Summarize, Proofread, Translate, or Chat
4. **Sidebar opens** with action already started

### Method 3: Keyboard Shortcuts
- `Ctrl+Shift+S` → Summarize  
- `Ctrl+Shift+P` → Proofread  
- `Ctrl+Shift+T` → Translate  
- `Ctrl+Shift+R` → Rewrite  

---

## 💬 Chat Features

The chat interface provides a complete AI assistant experience:

- **Full Document Context**: AI automatically reads the entire page
- **Typing Animation**: ChatGPT-style character-by-character response
- **Session Memory**: Chat history saved for 1 hour
- **Quick Prompts**: One-click common questions
- **State Persistence**: Resume chats after closing sidebar

**Example interactions:**
- "Summarize the main points"
- "Explain this in simple terms"
- "What are the key takeaways?"
- "Translate this to Spanish"

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript
- **Styling**: Custom CSS with gradient animations
- **Platform**: Chrome Extension (Manifest V3)  
- **AI**: Chrome Prompt API (Gemini Nano)
- **Storage**: Chrome Storage API for persistence
- **UI Pattern**: Side panel with multi-screen navigation

---

## 📁 Project Structure

```plaintext
lectura-lite/
├── manifest.json          # Extension configuration (sidebar enabled)
├── background.js          # Service worker & context menu handlers
├── sidebar.html           # Main sidebar interface
├── sidebar.js             # Sidebar logic & AI integration
├── sidebar.css            # Sidebar styling
├── contentScript.js       # Page interaction
├── exportUtils.js         # Export functionality
├── icons/                 # Extension icons
├── SETUP.md              # Detailed setup guide
├── QUICKSTART.md         # Quick start guide
├── CHANGES.md            # Change log
├── PDF-GUIDE.md          # PDF usage guide
└── README.md
```

---

## 🌍 Who It Helps

- 🎓 **Students** → Summarize readings, chat about complex topics, polish essays
- 🔬 **Researchers** → Extract key points from papers, ask questions about content
- 🏫 **Learners** → Get explanations in simple terms, translate foreign content
- 📡 **Offline Users** → Full AI capabilities without internet connection
- 🌐 **International Users** → Translate and understand content in any language

---

## 🔒 Privacy & Security

- ✅ **100% Local Processing** → All AI runs on your device
- 🚫 **Zero Data Collection** → Nothing sent to external servers
- 💾 **Private Storage** → Chat history stays on your device
- 🔐 **Secure** → No API keys or cloud connections needed
- 🔍 **Open Source** → Fully transparent and auditable

---

## 🎨 UI/UX Highlights

- **Modern Sidebar Design**: Elegant dark theme with gradient accents
- **Smooth Animations**: Slide-in transitions and typing effects
- **Responsive Layout**: Works on any screen size
- **Intuitive Navigation**: Clear home/chat/result screen structure
- **Status Indicators**: Real-time AI availability and document loading status
- **Quick Actions**: One-click prompts and action buttons

---

## 🚧 Roadmap

### v1.0 (Current) ✅
- ✅ Sidebar interface with slide-in animation
- ✅ Chrome Prompt API integration (Gemini Nano)
- ✅ Document context extraction (page-by-page)
- ✅ ChatGPT-like chat interface with typing animation
- ✅ State persistence for chat sessions
- ✅ Context menu integration

### v1.1 (Planned)
- 🔄 Streaming responses for real-time feedback
- 📊 Custom prompts and templates
- 🎨 Theme customization (dark/light modes)
- 📄 Enhanced export options (PDF, Word)
- 🔊 Text-to-speech for responses
- 📱 Better mobile/tablet support

---

## 🐛 Troubleshooting

**Issue**: AI not available  
**Solution**: Check Chrome version (126+), enable flags, download model

**Issue**: Sidebar doesn't open  
**Solution**: Reload extension, check permissions in `chrome://extensions`

**Issue**: Model download fails  
**Solution**: Check disk space (2GB needed), restart Chrome, retry download

**Issue**: PDF text extraction limited  
**Solution**: 
- Use Chrome's built-in PDF viewer (not external viewers)
- Click the retry button (🔄) to reload document context
- For scanned PDFs, select text manually and use right-click context menu
- Some encrypted PDFs may block extraction

**Issue**: Document context not loading  
**Solution**: Click the retry button (🔄) next to "Document Context"

See [SETUP.md](SETUP.md) for detailed troubleshooting.

---

## 📄 License

Licensed under the MIT License – see [LICENSE](LICENSE) for details. 

---

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Test thoroughly with Chrome Prompt API
4. Submit a pull request

---

**Made with ❤️ by Abenezer Mergia**  

*Lectura Lite brings AI-powered learning tools directly to your browser with a beautiful sidebar interface, complete document understanding, and ChatGPT-like conversations - all running locally on your device with Chrome's Gemini Nano.*
