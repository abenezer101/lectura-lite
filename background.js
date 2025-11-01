// background.js - Enhanced service worker for Lectura App Offline
class LecturaBackground {
    constructor() {
        this.init();
    }

    init() {
        this.setupContextMenus();
        this.setupMessageHandlers();
        this.setupInstallation();
    }

    setupContextMenus() {
chrome.runtime.onInstalled.addListener(() => {
            // Clear existing context menus
            chrome.contextMenus.removeAll(() => {
                // Create main context menu
                chrome.contextMenus.create({
                    id: 'lectura_main',
                    title: 'Lectura App Offline',
                    contexts: ['selection']
                });

                // Create submenu items
  chrome.contextMenus.create({
    id: 'lectura_summarize',
                    parentId: 'lectura_main',
                    title: 'Summarize Text',
                    contexts: ['selection']
                });

                chrome.contextMenus.create({
                    id: 'lectura_proofread',
                    parentId: 'lectura_main',
                    title: 'Proofread Text',
                    contexts: ['selection']
                });

                chrome.contextMenus.create({
                    id: 'lectura_translate',
                    parentId: 'lectura_main',
                    title: 'Translate Text',
                    contexts: ['selection']
                });

                chrome.contextMenus.create({
                    id: 'lectura_explain',
                    parentId: 'lectura_main',
                    title: 'Explain Text',
                    contexts: ['selection']
                });

                // Separator
                chrome.contextMenus.create({
                    id: 'lectura_separator',
                    parentId: 'lectura_main',
                    type: 'separator',
                    contexts: ['selection']
                });
});
        });
    }

    setupMessageHandlers() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('🎯 Background received message:', message.type, message);
            
            switch (message.type) {
                case 'QUICK_ACTION':
                    this.handleQuickAction(message, sender);
                    break;
                case 'OPEN_POPUP':
                    this.openExtensionPopup(message, sender);
                    break;
                case 'AI_REQUEST':
                    this.handleAIRequest(message, sender, sendResponse);
                    break;
                case 'EXPORT_REQUEST':
                    this.handleExportRequest(message, sender, sendResponse);
                    break;
                case 'CHECK_AI_AVAILABILITY':
                    this.checkAIAvailability(sendResponse);
                    break;
                case 'CHAT_REQUEST':
                    this.handleChatRequest(message, sender, sendResponse);
                    break;
                case 'OPEN_SIDEBAR_WITH_ACTION':
                    console.log('📍 Handling OPEN_SIDEBAR_WITH_ACTION');
                    this.handleOpenSidebarWithAction(message, sender, sendResponse);
                    break;
                default:
                    console.log('❓ Unknown message type:', message.type);
                    sendResponse({ status: 'error', message: 'Unknown message type' });
            }
            return true; // Keep message channel open for async responses
        });
    }

    async handleOpenSidebarWithAction(message, sender, sendResponse) {
        console.log('🔔 Background handling sidebar open request');
        
        const { action, text } = message;
        const windowId = sender.tab?.windowId;
        
        console.log('📊 Details:', { action, textLength: text?.length, windowId });
        
        if (!windowId) {
            console.error('❌ No window ID');
            sendResponse({ status: 'error', message: 'No window ID' });
            return;
        }
        
        // CRITICAL: Open sidebar FIRST (synchronously) before any await
        // This preserves the user gesture context
        console.log('🚪 Opening sidebar NOW (before async ops)...');
        chrome.sidePanel.open({ windowId })
            .then(() => {
                console.log('✅ Sidebar opened successfully!');
                
                // NOW store the data (sidebar is already opening)
                return chrome.storage.local.set({
                    pendingTooltipAction: {
                        action,
                        text,
                        timestamp: Date.now()
                    }
                });
            })
            .then(() => {
                console.log('✅ Stored in chrome.storage');
                sendResponse({ status: 'success' });
            })
            .catch(error => {
                console.error('❌ Error:', error);
                sendResponse({ status: 'error', message: error.message });
            });
    }

    setupInstallation() {
        chrome.runtime.onInstalled.addListener((details) => {
            if (details.reason === 'install') {
                // Show welcome page or notification
                this.showWelcomeNotification();
            } else if (details.reason === 'update') {
                // Show update notification
                this.showUpdateNotification(details.previousVersion);
            }
        });
        
        // Setup sidebar action
        chrome.action.onClicked.addListener((tab) => {
            chrome.sidePanel.open({ windowId: tab.windowId });
        });
    }

    handleQuickAction(message, sender) {
        const { action, text, originalAction } = message;
        
        // Store the text and action for the popup
        chrome.storage.local.set({
            lecturaText: text,
            lecturaAction: action,
            originalAction: originalAction,
            timestamp: Date.now()
        });

        // Open the extension popup
        this.openExtensionPopup({ action, text }, sender);
    }

    openExtensionPopup(message, sender) {
        // Open the extension popup
        chrome.action.openPopup();
    }

    async handleAIRequest(message, sender, sendResponse) {
        try {
            const { action, text, options } = message;
            
            // Use Chrome's built-in AI APIs
            const result = await this.processWithChromeAI(action, text, options);
            
            sendResponse({
                status: 'success',
                result: result,
                action: action
            });
        } catch (error) {
            console.error('AI request error:', error);
            sendResponse({
                status: 'error',
                message: error.message
            });
        }
    }

    checkAIAvailability(sendResponse) {
        try {
            const available = typeof chrome !== 'undefined' && chrome.ai && typeof chrome.ai.prompt === 'function';
            sendResponse({
                available: available,
                message: available ? 'Chrome AI APIs are available' : 'Chrome AI APIs are not available'
            });
        } catch (error) {
            console.error('Error checking AI availability:', error);
            sendResponse({
                available: false,
                message: 'Error checking AI availability'
            });
        }
    }

    async handleChatRequest(message, sender, sendResponse) {
        try {
            const { text, message: userMessage } = message;
            
            // Create a comprehensive prompt for the AI
            const prompt = `You are a helpful AI assistant. The user has provided the following text and wants to chat about it:

TEXT: "${text}"

USER MESSAGE: "${userMessage}"

Please respond helpfully to the user's message about the text. Be conversational and helpful. If the user asks questions about the text, answer them. If they want summaries, explanations, translations, or rewrites, provide them. Keep your response concise but informative.`;

            let result;
            
            // Try Chrome AI first
            if (chrome.ai && typeof chrome.ai.prompt === 'function') {
                try {
                    const aiResponse = await chrome.ai.prompt({
                        text: prompt,
                        options: {
                            temperature: 0.7,
                            maxTokens: 1000
                        }
                    });
                    result = aiResponse.text;
                } catch (aiError) {
                    console.error('Chrome AI error:', aiError);
                    result = this.generateFallbackResponse(userMessage, text);
                }
            } else {
                result = this.generateFallbackResponse(userMessage, text);
            }
            
            sendResponse({
                status: 'success',
                result: result
            });
        } catch (error) {
            console.error('Chat request error:', error);
            sendResponse({
                status: 'error',
                message: error.message
            });
        }
    }

    generateFallbackResponse(userMessage, text) {
        const message = userMessage.toLowerCase();
        
        if (message.includes('summarize') || message.includes('summary')) {
            return this.generateSummary(text, 'bullets');
        } else if (message.includes('explain') || message.includes('what does this mean')) {
            return `This text appears to be about: ${text.substring(0, 100)}... I can help you understand it better if you ask more specific questions.`;
        } else if (message.includes('translate') || message.includes('language')) {
            return `I can help translate this text. The text is: "${text.substring(0, 100)}..." Please specify which language you'd like me to translate it to.`;
        } else if (message.includes('key points') || message.includes('main points')) {
            const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
            const keyPoints = sentences.slice(0, 3);
            return `Key points from the text:\n${keyPoints.map((point, i) => `${i + 1}. ${point.trim()}`).join('\n')}`;
        } else if (message.includes('academic') || message.includes('formal')) {
            return `Here's a more academic version: ${text.replace(/\bgood\b/g, 'excellent').replace(/\bbad\b/g, 'inadequate').replace(/\bbig\b/g, 'substantial')}`;
        } else if (message.includes('simple') || message.includes('simplify')) {
            return `Here's a simpler version: ${text.replace(/\bexcellent\b/g, 'great').replace(/\binadequate\b/g, 'not good').replace(/\bsubstantial\b/g, 'big')}`;
        } else {
            return `I understand you want to discuss this text: "${text.substring(0, 100)}..." Could you be more specific about what you'd like to know? I can help with summaries, explanations, translations, or rewrites.`;
        }
    }

    async sendMessageToActiveTab(message) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.id) {
                // First try to ping the content script
                try {
                    await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
                } catch (pingError) {
                    // Content script not ready, inject it
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['contentScript.js']
                    });
                    // Wait for injection
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
                
                // Now send the actual message
                await chrome.tabs.sendMessage(tab.id, message);
            }
        } catch (error) {
            console.error('Error sending message to active tab:', error);
            // Fallback: open extension popup instead
            this.handleQuickAction(message);
        }
    }

    handleQuickAction(message) {
        // Store the text and action for the popup
        chrome.storage.local.set({
            lecturaText: message.text,
            lecturaAction: message.action,
            originalAction: message.originalAction
        }, () => {
            // Open the extension popup
            chrome.action.openPopup();
        });
    }

    async processWithChromeAI(action, text, options = {}) {
        // Check if Chrome AI APIs are available
        if (!chrome.ai) {
            throw new Error('Chrome AI APIs are not available. Please ensure you are using Chrome 126+ with AI features enabled.');
        }

        switch (action) {
            case 'summarize':
                return await this.summarizeWithAI(text, options.format || 'bullets');
            case 'proofread':
                return await this.proofreadWithAI(text);
            case 'translate':
                return await this.translateWithAI(text, options.fromLang, options.toLang);
            case 'rewrite':
                return await this.rewriteWithAI(text, options.style || 'academic');
            default:
                throw new Error('Unknown action');
        }
    }

    async summarizeWithAI(text, format) {
        try {
            let prompt = `Summarize the following text in ${format} format:\n\n${text}`;
            
            if (format === 'bullets') {
                prompt = `Create a bullet-point summary of the following text:\n\n${text}`;
            } else if (format === 'paragraphs') {
                prompt = `Summarize the following text in paragraph form:\n\n${text}`;
            } else if (format === 'flashcards') {
                prompt = `Create study flashcards (Q&A format) from the following text:\n\n${text}`;
            }

            const result = await chrome.ai.prompt({
                text: prompt,
                options: {
                    temperature: 0.3,
                    maxTokens: 1000
                }
            });

            return result.text;
        } catch (error) {
            console.error('AI Summarizer error:', error);
            // Fallback to basic summarization
            return this.generateSummary(text, format);
        }
    }

    async proofreadWithAI(text) {
        try {
            const prompt = `Proofread and correct the following text. Return the corrected text and list any changes made:\n\n${text}`;
            
            const result = await chrome.ai.prompt({
                text: prompt,
                options: {
                    temperature: 0.1,
                    maxTokens: 1500
                }
            });

            // Parse the AI response to extract corrected text and changes
            const correctedText = result.text.split('\n\n')[0] || result.text;
            const changes = result.text.includes('Changes:') ? 
                result.text.split('Changes:')[1]?.split('\n').filter(line => line.trim()) : [];

            return {
                corrected: correctedText,
                changes: changes,
                suggestions: []
            };
        } catch (error) {
            console.error('AI Proofreader error:', error);
            // Fallback to basic proofreading
            return this.proofreadText(text);
        }
    }

    async translateWithAI(text, fromLang, toLang) {
        try {
            const languageNames = {
                'en': 'English',
                'es': 'Spanish',
                'fr': 'French',
                'de': 'German',
                'it': 'Italian',
                'pt': 'Portuguese',
                'ru': 'Russian',
                'zh': 'Chinese',
                'ja': 'Japanese',
                'ko': 'Korean'
            };

            const fromLangName = fromLang === 'auto' ? 'the detected language' : languageNames[fromLang] || fromLang;
            const toLangName = languageNames[toLang] || toLang;

            const prompt = `Translate the following text from ${fromLangName} to ${toLangName}:\n\n${text}`;
            
            const result = await chrome.ai.prompt({
                text: prompt,
                options: {
                    temperature: 0.2,
                    maxTokens: 1000
                }
            });

            return result.text;
        } catch (error) {
            console.error('AI Translator error:', error);
            // Fallback to basic translation
            return this.translateText(text, fromLang, toLang);
        }
    }

    async rewriteWithAI(text, style) {
        try {
            const stylePrompts = {
                'academic': 'Rewrite the following text in a formal, academic style suitable for research papers and essays',
                'casual': 'Rewrite the following text in a casual, conversational style',
                'persuasive': 'Rewrite the following text in a persuasive style to convince the reader',
                'simplify': 'Rewrite the following text in simple, easy-to-understand language suitable for ESL learners and people with reading difficulties'
            };

            const prompt = `${stylePrompts[style] || stylePrompts.academic}:\n\n${text}`;
            
            const result = await chrome.ai.prompt({
                text: prompt,
                options: {
                    temperature: 0.4,
                    maxTokens: 1200
                }
            });

            return result.text;
        } catch (error) {
            console.error('AI Rewriter error:', error);
            // Fallback to basic rewriting
            return this.rewriteText(text, style);
        }
    }

    generateSummary(text, format) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
        
        switch (format) {
            case 'bullets':
                const keyPoints = sentences.slice(0, Math.min(5, Math.ceil(sentences.length / 3)));
                return keyPoints.map(point => `• ${point.trim()}`).join('\n');
            
            case 'paragraphs':
                const summary = sentences.slice(0, Math.min(3, Math.ceil(sentences.length / 4)));
                return summary.map(s => s.trim()).join('. ') + '.';
            
            case 'flashcards':
                const cards = sentences.slice(0, Math.min(3, Math.ceil(sentences.length / 5)));
                return cards.map((point, index) => {
                    const question = `What is the main point ${index + 1}?`;
                    const answer = point.trim();
                    return `Q: ${question}\nA: ${answer}`;
                }).join('\n\n');
            
            default:
                return this.generateSummary(text, 'bullets');
        }
    }

    proofreadText(text) {
        const corrections = [
            { original: /\bteh\b/g, corrected: 'the' },
            { original: /\brecieve\b/g, corrected: 'receive' },
            { original: /\bseperate\b/g, corrected: 'separate' },
            { original: /\bdefinately\b/g, corrected: 'definitely' },
            { original: /\boccured\b/g, corrected: 'occurred' },
            { original: /\bpriviledge\b/g, corrected: 'privilege' },
            { original: /\baccomodate\b/g, corrected: 'accommodate' },
            { original: /\bembarass\b/g, corrected: 'embarrass' }
        ];

        let correctedText = text;
        const changes = [];

        corrections.forEach(correction => {
            const matches = correctedText.match(correction.original);
            if (matches) {
                correctedText = correctedText.replace(correction.original, correction.corrected);
                changes.push(`Fixed "${matches[0]}" → "${correction.corrected}"`);
            }
        });

        return {
            corrected: correctedText,
            changes: changes,
            suggestions: this.generateGrammarSuggestions(text)
        };
    }

    generateGrammarSuggestions(text) {
        const suggestions = [];
        
        if (text.includes('its ') && !text.includes("it's ")) {
            suggestions.push("Consider if 'its' should be 'it's' (contraction of 'it is')");
        }
        
        if (text.includes('there ') && text.includes(' their ')) {
            suggestions.push("Check usage of 'there' vs 'their'");
        }
        
        if (text.includes('youre ') || text.includes('dont ') || text.includes('wont ')) {
            suggestions.push("Consider adding apostrophes: 'you're', 'don't', 'won't'");
        }

        return suggestions;
    }

    translateText(text, fromLang = 'auto', toLang = 'en') {
        // Simulate translation
        const translations = {
            'en-es': 'Texto traducido al español: ' + text,
            'es-en': 'Text translated to English: ' + text,
            'en-fr': 'Texte traduit en français: ' + text,
            'fr-en': 'Text translated to English: ' + text,
            'en-de': 'Text ins Deutsche übersetzt: ' + text,
            'de-en': 'Text translated to English: ' + text
        };

        const key = `${fromLang}-${toLang}`;
        return translations[key] || `Translation from ${fromLang} to ${toLang}: ${text}`;
    }

    rewriteText(text, style) {
        switch (style) {
            case 'academic':
                return `Academic rewrite:\n\n${text.replace(/\bgood\b/g, 'excellent').replace(/\bbad\b/g, 'inadequate').replace(/\bbig\b/g, 'substantial')}`;
            case 'casual':
                return `Casual rewrite:\n\n${text.replace(/\bexcellent\b/g, 'great').replace(/\binadequate\b/g, 'not great').replace(/\bsubstantial\b/g, 'big')}`;
            case 'persuasive':
                return `Persuasive rewrite:\n\nIt is important to note that ${text.toLowerCase()}. This clearly demonstrates the significance of the matter at hand.`;
            case 'simplify':
                return `Simplified version:\n\n${text.replace(/\bconsequently\b/g, 'so').replace(/\bnevertheless\b/g, 'but').replace(/\bfurthermore\b/g, 'also')}`;
            default:
                return this.rewriteText(text, 'academic');
        }
    }

    async handleExportRequest(message, sender, sendResponse) {
        try {
            const { format, content, filename } = message;
            
            switch (format) {
                case 'file':
                    this.downloadFile(content, filename);
                    break;
                case 'google_docs':
                    this.exportToGoogleDocs(content);
                    break;
                case 'notion':
                    this.exportToNotion(content);
                    break;
                default:
                    throw new Error('Unknown export format');
            }
            
            sendResponse({ status: 'success' });
        } catch (error) {
            console.error('Export error:', error);
            sendResponse({ status: 'error', message: error.message });
        }
    }

    downloadFile(content, filename) {
        // This would be handled by the popup script
        // The background script can't directly download files
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: 'DOWNLOAD_FILE',
                content: content,
                filename: filename
            });
        });
    }

    exportToGoogleDocs(content) {
        // Open Google Docs with the content
        const encodedContent = encodeURIComponent(content);
        const url = `https://docs.google.com/document/create?usp=docs_web&text=${encodedContent}`;
        chrome.tabs.create({ url: url });
    }

    exportToNotion(content) {
        // Open Notion with the content
        const encodedContent = encodeURIComponent(content);
        const url = `https://www.notion.so/new?title=Lectura%20Export&content=${encodedContent}`;
        chrome.tabs.create({ url: url });
    }

    showWelcomeNotification() {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Welcome to Lectura App Offline!',
            message: 'Right-click on any selected text to start using AI-powered study tools. Click the extension icon to open the full interface.'
        });
    }

    showUpdateNotification(previousVersion) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Lectura App Offline Updated!',
            message: `Updated from version ${previousVersion}. New features and improvements are now available.`
        });
    }
}

// Initialize the background script
console.log('🚀 Lectura Background Script Initializing...');
const lecturaBackground = new LecturaBackground();
console.log('✅ Lectura Background Script Initialized');

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const selectionText = info.selectionText || '';
    
    if (!selectionText) {
        return;
    }
    
    console.log('📋 Context menu clicked:', info.menuItemId);

    try {
        // Extract action from menu ID
        let action = info.menuItemId.replace('lectura_', '');
        
        // Map explain to chat
        if (action === 'explain') {
            action = 'chat';
        }
        
        console.log('📊 Action:', action, 'Text length:', selectionText.length);
        
        // Store the pending action (same as tooltip)
        await chrome.storage.local.set({
            pendingTooltipAction: {
                action: action,
                text: selectionText,
                timestamp: Date.now()
            }
        });
        console.log('✅ Context menu action stored');
        
        // Open sidebar (this has user gesture from context menu click)
        await chrome.sidePanel.open({ windowId: tab.windowId });
        console.log('✅ Sidebar opened from context menu');
        
    } catch (error) {
        console.error('❌ Context menu action error:', error);
    }
});
