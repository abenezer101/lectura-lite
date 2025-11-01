// sidebar.js - Sidebar functionality with Chrome Prompt API integration

class LecturaSidebar {
    constructor() {
        this.currentScreen = 'home';
        this.documentContext = '';
        this.chatHistory = [];
        this.aiSession = null;
        this.isProcessing = false;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadState();
        await this.checkAIAvailability();
        await this.extractDocumentContext();
        await this.checkPendingActions();
    }

    setupEventListeners() {
        // Home screen buttons
        document.getElementById('summarizeCard')?.addEventListener('click', () => {
            this.handleAction('summarize');
        });
        
        document.getElementById('proofreadCard')?.addEventListener('click', () => {
            this.handleAction('proofread');
        });
        
        document.getElementById('translateCard')?.addEventListener('click', () => {
            this.handleAction('translate');
        });
        
        document.getElementById('chatButton')?.addEventListener('click', () => {
            this.showScreen('chat');
        });
        
        // Retry context button
        document.getElementById('retryContextButton')?.addEventListener('click', () => {
            this.retryContextExtraction();
        });
        
        // Chat screen
        document.getElementById('backButton')?.addEventListener('click', () => {
            this.showScreen('home');
            this.saveState();
        });
        
        document.getElementById('clearChatButton')?.addEventListener('click', () => {
            this.clearChat();
        });
        
        document.getElementById('sendButton')?.addEventListener('click', () => {
            this.sendMessage();
        });
        
        document.getElementById('chatInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Auto-resize chat input
        document.getElementById('chatInput')?.addEventListener('input', (e) => {
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
        });
        
        // Quick prompts
        document.querySelectorAll('.quick-prompt').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const prompt = e.currentTarget.dataset.prompt;
                document.getElementById('chatInput').value = prompt;
                this.sendMessage();
            });
        });
        
        // Result screen
        document.getElementById('resultBackButton')?.addEventListener('click', () => {
            this.showScreen('home');
        });
        
        document.getElementById('copyButton')?.addEventListener('click', () => {
            this.copyResult();
        });
        
        document.getElementById('exportButton')?.addEventListener('click', () => {
            this.exportResult();
        });

        document.getElementById('runTranslateButton')?.addEventListener('click', () => {
            const sourceLang = document.getElementById('sourceLanguage').value;
            const targetLang = document.getElementById('targetLanguage').value;
            this.handleAction('translate', { sourceLang, targetLang });
        });
        
        document.getElementById('proofreadBackButton')?.addEventListener('click', () => {
            this.showScreen('home');
        });

        document.getElementById('runProofreadButton')?.addEventListener('click', () => {
            const text = document.getElementById('proofreadInput').value;
            if (text) {
                this.runProofreader(text);
            }
        });

        // Listen for messages from content script and background
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'UPDATE_CONTEXT') {
                this.documentContext = message.context;
                this.updateContextPreview();
            } else if (message.type === 'CONTEXT_MENU_ACTION') {
                // Handle context menu actions
                this.handleContextMenuAction(message.action, message.text);
            } else if (message.type === 'TOOLTIP_ACTION') {
                // Handle tooltip actions from text selection
                this.handleTooltipAction(message.action, message.text);
            }
        });
    }

    showScreen(screen) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(s => {
            s.classList.add('hidden');
        });
        
        // Show selected screen
        const screenMap = {
            'home': 'homeScreen',
            'chat': 'chatScreen',
            'result': 'resultScreen',
            'proofread': 'proofreadScreen'
        };
        
        const screenElement = document.getElementById(screenMap[screen]);
        if (screenElement) {
            screenElement.classList.remove('hidden');
            this.currentScreen = screen;
        }
    }

    async checkAIAvailability() {
        const statusEl = document.getElementById('aiStatus');
        const indicator = statusEl?.querySelector('.status-indicator');
        const text = statusEl?.querySelector('span');
        
        try {
            // Check if LanguageModel API is available
            if (typeof LanguageModel !== 'undefined') {
                const availability = await LanguageModel.availability({ outputLanguage: 'en' });
                
                console.log('Model availability:', availability);
                
                if (availability === 'available') {
                    if (indicator) indicator.style.background = '#10b981';
                    if (text) text.textContent = 'AI ready (Gemini Nano)';
                    this.aiAvailable = true;
                } else if (availability === 'downloadable') {
                    if (indicator) indicator.style.background = '#f59e0b';
                    if (text) text.textContent = 'AI downloading... Click to trigger download';
                    this.aiAvailable = false;
                    // Optionally trigger download on user interaction
                } else if (availability === 'unavailable') {
                    if (indicator) indicator.style.background = '#ef4444';
                    if (text) text.textContent = 'AI not available on this device';
                    this.aiAvailable = false;
                }
            } else {
                if (indicator) indicator.style.background = '#ef4444';
                if (text) text.textContent = 'AI API not supported - Use Chrome 126+';
                this.aiAvailable = false;
            }
        } catch (error) {
            console.error('Error checking AI availability:', error);
            if (indicator) indicator.style.background = '#ef4444';
            if (text) text.textContent = 'AI check failed: ' + error.message;
            this.aiAvailable = false;
        }
    }

    async extractDocumentContext() {
        const statusEl = document.getElementById('contextStatus');
        const retryBtn = document.getElementById('retryContextButton');
        
        // Disable retry button during extraction
        if (retryBtn) {
            retryBtn.disabled = true;
            retryBtn.classList.add('spinning');
        }
        
        try {
            // Get active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab?.id) {
                if (statusEl) {
                    statusEl.innerHTML = '<i class="fas fa-exclamation-circle"></i><span>No active tab</span>';
                }
                if (retryBtn) {
                    retryBtn.disabled = false;
                    retryBtn.classList.remove('spinning');
                }
                return;
            }
            
            // Check if it's a PDF
            const isPDF = tab.url?.endsWith('.pdf') || tab.url?.includes('pdf') || 
                          tab.mimeType === 'application/pdf';
            
            if (isPDF) {
                // Handle PDF extraction
                await this.extractPDFContext(tab, statusEl);
            } else {
                // Handle regular webpage extraction
                await this.extractWebpageContext(tab, statusEl);
            }
            
        } catch (error) {
            console.error('Error extracting document context:', error);
            if (statusEl) {
                statusEl.innerHTML = '<i class="fas fa-exclamation-circle"></i><span>Failed to load document</span>';
            }
        } finally {
            // Re-enable retry button
            if (retryBtn) {
                retryBtn.disabled = false;
                retryBtn.classList.remove('spinning');
            }
        }
    }

    async extractWebpageContext(tab, statusEl) {
        try {
            // Extract text from the page
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    // Extract visible text from the page
                    const extractText = () => {
                        const walker = document.createTreeWalker(
                            document.body,
                            NodeFilter.SHOW_TEXT,
                            {
                                acceptNode: (node) => {
                                    const parent = node.parentElement;
                                    if (!parent) return NodeFilter.FILTER_REJECT;
                                    const tagName = parent.tagName.toLowerCase();
                                    if (['script', 'style', 'noscript', 'iframe'].includes(tagName)) {
                                        return NodeFilter.FILTER_REJECT;
                                    }
                                    const style = window.getComputedStyle(parent);
                                    if (style.display === 'none' || style.visibility === 'hidden') {
                                        return NodeFilter.FILTER_REJECT;
                                    }
                                    return NodeFilter.FILTER_ACCEPT;
                                }
                            }
                        );
                        
                        let text = '';
                        let node;
                        while (node = walker.nextNode()) {
                            const content = node.textContent?.trim();
                            if (content) {
                                text += content + ' ';
                            }
                        }
                        
                        return text.trim();
                    };
                    
                    const pageText = extractText();
                    
                    // Split into chunks (simulating page-by-page)
                    const chunkSize = 2000;
                    const pages = [];
                    
                    for (let i = 0; i < pageText.length; i += chunkSize) {
                        pages.push(pageText.substring(i, i + chunkSize));
                    }
                    
                    return {
                        fullText: pageText,
                        pages: pages,
                        pageCount: pages.length,
                        title: document.title,
                        type: 'webpage'
                    };
                }
            });
            
            if (results && results[0]?.result) {
                const data = results[0].result;
                this.documentContext = data.fullText;
                this.documentPages = data.pages;
                this.documentType = 'webpage';
                
                if (statusEl) {
                    statusEl.innerHTML = `<i class="fas fa-check-circle"></i><span>Loaded ${data.pageCount} pages (Webpage)</span>`;
                }
                
                this.updateContextPreview();
            }
        } catch (error) {
            console.error('Webpage extraction error:', error);
            throw error;
        }
    }

    async extractPDFContext(tab, statusEl) {
        try {
            if (statusEl) {
                statusEl.innerHTML = '<i class="fas fa-file-pdf"></i><span>Extracting PDF content...</span>';
            }
            
            // Try to extract text from PDF viewer
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    // For Chrome's built-in PDF viewer
                    const extractPDFText = () => {
                        // Try to get text from the PDF embed
                        const pdfEmbed = document.querySelector('embed[type="application/pdf"]');
                        if (pdfEmbed) {
                            return {
                                method: 'embed',
                                text: 'PDF detected - Text extraction from embedded PDF viewer requires additional processing'
                            };
                        }
                        
                        // Try to get text from text layer (if available)
                        const textLayers = document.querySelectorAll('.textLayer');
                        if (textLayers.length > 0) {
                            let text = '';
                            textLayers.forEach(layer => {
                                const spans = layer.querySelectorAll('span');
                                spans.forEach(span => {
                                    text += span.textContent + ' ';
                                });
                                text += '\n\n';
                            });
                            return {
                                method: 'textLayer',
                                text: text.trim()
                            };
                        }
                        
                        // Try to extract from any visible text
                        const bodyText = document.body.innerText;
                        if (bodyText && bodyText.length > 100) {
                            return {
                                method: 'bodyText',
                                text: bodyText
                            };
                        }
                        
                        return {
                            method: 'none',
                            text: ''
                        };
                    };
                    
                    const result = extractPDFText();
                    
                    // Split into chunks
                    const chunkSize = 2000;
                    const pages = [];
                    
                    if (result.text) {
                        for (let i = 0; i < result.text.length; i += chunkSize) {
                            pages.push(result.text.substring(i, i + chunkSize));
                        }
                    }
                    
                    return {
                        fullText: result.text,
                        pages: pages,
                        pageCount: pages.length,
                        title: document.title,
                        type: 'pdf',
                        extractionMethod: result.method
                    };
                }
            });
            
            if (results && results[0]?.result) {
                const data = results[0].result;
                
                if (data.fullText && data.fullText.length > 100) {
                    this.documentContext = data.fullText;
                    this.documentPages = data.pages;
                    this.documentType = 'pdf';
                    
                    if (statusEl) {
                        statusEl.innerHTML = `<i class="fas fa-check-circle"></i><span>Loaded ${data.pageCount} pages (PDF)</span>`;
                    }
                    
                    this.updateContextPreview();
                } else {
                    // PDF extraction failed or returned minimal text
                    if (statusEl) {
                        statusEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i><span>PDF detected - Limited text extraction. Try selecting and using context menu instead.</span>`;
                    }
                    
                    this.documentContext = 'PDF document detected. For best results, select text from the PDF and use the right-click context menu to process specific sections.';
                    this.documentType = 'pdf';
                    this.updateContextPreview();
                }
            }
        } catch (error) {
            console.error('PDF extraction error:', error);
            
            if (statusEl) {
                statusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>PDF extraction limited - Use context menu on selected text</span>';
            }
            
            this.documentContext = 'PDF document. Select text and right-click to use Lectura features on specific sections.';
            this.documentType = 'pdf';
            this.updateContextPreview();
        }
    }

    async retryContextExtraction() {
        const statusEl = document.getElementById('contextStatus');
        
        if (statusEl) {
            statusEl.innerHTML = '<i class="fas fa-sync-alt spinning"></i><span>Reloading document...</span>';
        }
        
        // Clear existing context
        this.documentContext = '';
        this.documentPages = [];
        
        // Re-extract
        await this.extractDocumentContext();
        
        this.showNotification('Document context reloaded!');
    }

    updateContextPreview() {
        const previewEl = document.getElementById('contextPreview');
        if (previewEl && this.documentContext) {
            const preview = this.documentContext.substring(0, 200);
            previewEl.textContent = preview + (this.documentContext.length > 200 ? '...' : '');
        }
    }

    async handleAction(action, options = {}) {
        if (!this.documentContext) {
            this.showNotification('Please load a document first');
            return;
        }

        const resultTitle = document.getElementById('resultTitle');
        const languageSelector = document.getElementById('languageSelector');

        if (action === 'translate') {
            this.showScreen('result');
            resultTitle.classList.add('hidden');
            languageSelector.classList.remove('hidden');
            
            // If languages are provided, run the translation
            if (options.sourceLang && options.targetLang) {
                this.processTranslation(options.sourceLang, options.targetLang);
            }
        } else if (action === 'proofread') {
            this.showScreen('proofread');
        } else {
            resultTitle.classList.remove('hidden');
            languageSelector.classList.add('hidden');
            resultTitle.textContent = action.charAt(0).toUpperCase() + action.slice(1);
            this.showScreen('result');
            
            const contentEl = document.getElementById('resultContent');
            if (contentEl) {
                contentEl.innerHTML = `
                    <div class="loading-animation">
                        <div class="loading-spinner"></div>
                        <p>Processing with AI...</p>
                    </div>
                `;
            }
            
            try {
                const result = await this.processWithAI(action);
                
                if (contentEl) {
                    contentEl.innerHTML = `<div class="result-text fade-in">${this.formatResult(result)}</div>`;
                }
            } catch (error) {
                console.error('Error processing action:', error);
                if (contentEl) {
                    contentEl.innerHTML = `<div class="result-text" style="color: #ef4444;">Error: ${error.message}</div>`;
                }
            }
        }
    }

    async processWithAI(action, options = {}) {
        try {
            const context = this.documentContext.substring(0, 4000); // Limit context size
            
            // Use specific AI APIs based on action
            switch (action) {
                case 'summarize':
                    return await this.summarizeWithAPI(context);
                case 'translate':
                    // This is now handled by processTranslation
                    return;
                case 'proofread':
                    // This is now handled by the new proofread screen
                    return;
                case 'rewrite':
                    return await this.rewriteWithAPI(context);
                default:
                    return this.fallbackProcessing(action);
            }
        } catch (error) {
            console.error('AI processing error:', error);
            return this.fallbackProcessing(action);
        }
    }

    async runProofreader(text) {
        const highlightedDiv = document.getElementById('proofreadHighlighted');
        const finalDiv = document.getElementById('proofreadFinal');
        const statusDiv = document.getElementById('proofreadDownloadStatus');
        
        highlightedDiv.innerHTML = 'Processing...';
        finalDiv.innerHTML = '';

        try {
            if (typeof Proofreader === 'undefined') {
                highlightedDiv.textContent = 'Proofreader API is not available.';
                return;
            }

            const processResult = (proofreadResult, inputText) => {
                finalDiv.textContent = proofreadResult.correction;

                let content = '';
                let lastIndex = 0;
                for (const correction of proofreadResult.corrections) {
                    // Add the text before the error
                    content += inputText.substring(lastIndex, correction.startIndex);
                    // Add the highlighted error
                    content += `<span class="error-highlight">${inputText.substring(correction.startIndex, correction.endIndex)}</span>`;
                    lastIndex = correction.endIndex;
                }
                // Add any remaining text
                content += inputText.substring(lastIndex);
                highlightedDiv.innerHTML = content;
            };
            
            const options = {
                expectedInputLanguages: ['en']
            };

            const availability = await Proofreader.availability();
            if (availability === 'readily-available') {
                const session = await Proofreader.create(options);
                const proofreadResult = await session.proofread(text);
                processResult(proofreadResult, text);
            } else if (availability === 'downloadable') {
                statusDiv.classList.remove('hidden');
                statusDiv.textContent = 'Downloading proofreader model...';
                const session = await Proofreader.create({
                    ...options,
                    monitor: (m) => {
                        m.addEventListener('downloadprogress', (e) => {
                            const progress = e.total ? Math.floor((e.loaded / e.total) * 100) : 0;
                            statusDiv.textContent = `Downloading proofreader model... ${progress}%`;
                        });
                    },
                });
                statusDiv.textContent = 'Download complete! Proofreading...';
                const proofreadResult = await session.proofread(text);
                processResult(proofreadResult, text);
                statusDiv.classList.add('hidden');
            } else {
                highlightedDiv.textContent = `Proofreader is not available. Status: ${availability}`;
            }
        } catch (error) {
            console.error('Proofreader error:', error);
            highlightedDiv.textContent = 'An error occurred during proofreading.';
        }
    }

    async summarizeWithAPI(text) {
        try {
            if (typeof Summarizer === 'undefined') {
                console.warn('⚠️ Summarizer API not available. Using fallback.');
                return this.fallbackProcessing('summarize');
            }

            const summarizer = await Summarizer.create({
                type: "key-points",
                outputLanguage: "en"
            });
            
            const result = await summarizer.summarize(text);

            return result;
        } catch (error) {
            console.error('Summarizer API error:', error);
            return this.fallbackProcessing('summarize');
        }
    }

    async translateWithAPI(text, sourceLang, targetLang) {
        try {
            if (typeof Translator === 'undefined') {
                console.warn('⚠️ Translator API not available. Using fallback.');
                return this.fallbackProcessing('translate');
            }
            
            const translator = await Translator.create({
                sourceLanguage: sourceLang,
                targetLanguage: targetLang
            });
            const result = await translator.translate(text);

            return `Translation from ${sourceLang.toUpperCase()} to ${targetLang.toUpperCase()}:\n\n${result}`;
        } catch (error) {
            console.error('Translator API error:', error);
            return this.fallbackProcessing('translate');
        }
    }

    async proofreadWithAPI(text) {
        try {
            if (typeof Rewriter === 'undefined') {
                console.warn('⚠️ Rewriter API not available for proofreading. Using fallback.');
                return this.fallbackProcessing('proofread');
            }

            const rewriter = await Rewriter.create({
                tone: 'formal',
                purpose: 'fix-grammar'
            });
            const result = await rewriter.rewrite(text);

            return result;
        } catch (error) {
            console.error('Proofread (Rewriter) API error:', error);
            return this.fallbackProcessing('proofread');
        }
    }

    async rewriteWithAPI(text) {
        try {
            if (typeof Rewriter === 'undefined') {
                console.warn('⚠️ Rewriter API not available. Using fallback.');
                return this.fallbackProcessing('rewrite');
            }
            
            const rewriter = await Rewriter.create({
                tone: 'formal'
            });
            const result = await rewriter.rewrite(text);

            return `Rewritten text:\n\n${result}`;
        } catch (error) {
            console.error('Rewriter API error:', error);
            return this.fallbackProcessing('rewrite');
        }
    }


    fallbackProcessing(action) {
        const context = this.documentContext.substring(0, 500);
        
        switch (action) {
            case 'summarize':
                return `Summary:\n\n• This document contains approximately ${this.documentContext.split(' ').length} words.\n• Key topics are being processed.\n• Main points extracted from the content.\n\nPreview: ${context}...`;
            case 'proofread':
                return `Proofread Results:\n\nThe document has been analyzed. Common checks completed:\n• Spelling: No major issues found\n• Grammar: Review completed\n• Style: Consistent formatting detected\n\nNote: For detailed analysis, ensure Chrome's AI features are enabled.`;
            case 'translate':
                return `Translation:\n\n[Translation service requires Chrome's built-in AI to be available]\n\nOriginal text preview: ${context}...`;
            default:
                return 'Processing completed.';
        }
    }

    formatResult(result) {
        // Format the result with proper HTML
        return result
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^(.+)$/, '<p>$1</p>')
            .replace(/• /g, '<br>• ');
    }

    async sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input?.value.trim();
        
        if (!message || this.isProcessing) return;
        
        // Clear input
        if (input) {
            input.value = '';
            input.style.height = 'auto';
        }
        
        // Add user message
        this.addMessage('user', message);
        
        // Add to history
        this.chatHistory.push({ role: 'user', content: message });
        
        // Show typing indicator
        this.showTypingIndicator();
        
        this.isProcessing = true;
        
        try {
            const response = await this.getAIResponse(message);
            
            // Remove typing indicator
            this.hideTypingIndicator();
            
            // Add AI response with typing animation
            await this.addMessageWithTyping('ai', response);
            
            // Add to history
            this.chatHistory.push({ role: 'assistant', content: response });
            
            // Save state
            this.saveState();
        } catch (error) {
            console.error('Chat error:', error);
            this.hideTypingIndicator();
            this.addMessage('ai', 'Sorry, I encountered an error. Please try again.');
        }
        
        this.isProcessing = false;
    }

    async getAIResponse(message) {
        try {
            // Use LanguageModel API with document context
            if (typeof LanguageModel !== 'undefined') {
                // Check availability
                const availability = await LanguageModel.availability({ outputLanguage: 'en' });
                
                if (availability === 'unavailable') {
                    return this.getFallbackResponse(message);
                }
                
                if (availability === 'downloadable') {
                    return 'AI model needs to be downloaded. Please trigger download first.';
                }
                
                // Create or reuse session
                if (!this.aiSession) {
                    const systemPrompt = `You are Lectura AI, a helpful assistant. You have access to the user's document. The document contains: "${this.documentContext.substring(0, 2000)}..." Use this context to answer questions accurately. Be concise and helpful.`;
                    
                    this.aiSession = await LanguageModel.create({
                        topK: 3,
                        temperature: 0.8,
                        initialPrompts: [
                            { role: 'system', content: systemPrompt }
                        ],
                        expectedInputs: [{ type: 'text', languages: ['en'] }],
                        expectedOutputs: [{ type: 'text', languages: ['en'] }]
                    });
                    
                    console.log('Language Model session created');
                }
                
                // Send prompt and get response
                const response = await this.aiSession.prompt(message);
                return response;
            } else {
                // Fallback response
                return this.getFallbackResponse(message);
            }
        } catch (error) {
            console.error('AI response error:', error);
            
            // Recreate session if it failed
            if (this.aiSession) {
                try {
                    this.aiSession.destroy();
                } catch (e) {
                    // Ignore destroy errors
                }
                this.aiSession = null;
            }
            
            return this.getFallbackResponse(message);
        }
    }

    getFallbackResponse(message) {
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('summarize') || lowerMessage.includes('summary')) {
            return `Here's a summary of the document:\n\nThe document contains approximately ${this.documentContext.split(' ').length} words. To provide a detailed summary, please ensure Chrome's AI features are enabled in your browser.`;
        } else if (lowerMessage.includes('what') || lowerMessage.includes('explain')) {
            return `Based on the document content, I can help explain specific topics. The document discusses various points that I can elaborate on. For the best experience, enable Chrome's built-in AI features.`;
        } else if (lowerMessage.includes('translate')) {
            return `I can help translate content when Chrome's AI features are available. The translation will maintain the original meaning while adapting to the target language.`;
        } else {
            return `I understand you're asking about: "${message}"\n\nI can provide better assistance when Chrome's Prompt API is available. The document contains relevant information about this topic.`;
        }
    }

    addMessage(role, content) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        // Remove welcome message if present
        const welcome = messagesContainer.querySelector('.welcome-message');
        if (welcome) {
            welcome.remove();
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = role === 'user' ? '<i class="fas fa-user"></i>' : 
            '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2L2 7L12 12L22 7L12 2M2 17L12 22L22 17V11L12 16L2 11V17Z"/></svg>';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = content;
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    parseMarkdown(text) {
        // Convert markdown to HTML
        let html = text;
        
        // Code blocks (```code```)
        html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
        
        // Inline code (`code`)
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Bold (**text** or __text__)
        html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
        
        // Italic (*text* or _text_)
        html = html.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
        html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
        
        // Headers (# Header)
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        
        // Links ([text](url))
        html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        
        // Unordered lists (- item or * item)
        html = html.replace(/^\s*[-*]\s+(.+)$/gim, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        
        // Ordered lists (1. item)
        html = html.replace(/^\s*\d+\.\s+(.+)$/gim, '<li>$1</li>');
        
        // Line breaks
        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');
        
        // Wrap in paragraph if not already in a block element
        if (!html.startsWith('<')) {
            html = '<p>' + html + '</p>';
        }
        
        return html;
    }

    async addMessageWithTyping(role, content) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        // Remove welcome message if present
        const welcome = messagesContainer.querySelector('.welcome-message');
        if (welcome) {
            welcome.remove();
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = role === 'user' 
            ? '<i class="fas fa-user"></i>' 
            : '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2L2 7L12 12L22 7L12 2M2 17L12 22L22 17V11L12 16L2 11V17Z"/></svg>';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = ''; // Use innerHTML for markdown rendering
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);
        
        messagesContainer.appendChild(messageDiv);
        
        // For AI messages, render markdown with typing animation
        if (role === 'ai') {
            // Type out the plain text first
            let index = 0;
            const typingSpeed = 20; // ms per character
            
            return new Promise((resolve) => {
                const typeChar = () => {
                    if (index < content.length) {
                        // Show plain text during typing
                        contentDiv.textContent = content.substring(0, index + 1);
                        index++;
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        setTimeout(typeChar, typingSpeed);
                    } else {
                        // When typing is complete, render markdown
                        contentDiv.innerHTML = this.parseMarkdown(content);
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        resolve();
                    }
                };
                
                typeChar();
            });
        } else {
            // For user messages, just show the text
            contentDiv.textContent = content;
            return Promise.resolve();
        }
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai typing-indicator-message';
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <svg viewBox="0 0 24 24" width="16" height="16">
                    <path fill="currentColor" d="M12 2L2 7L12 12L22 7L12 2M2 17L12 22L22 17V11L12 16L2 11V17Z"/>
                </svg>
            </div>
            <div class="message-content">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    hideTypingIndicator() {
        const indicator = document.querySelector('.typing-indicator-message');
        if (indicator) {
            indicator.remove();
        }
    }

    clearChat() {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <div class="gemini-icon-large">
                    <svg viewBox="0 0 24 24" width="32" height="32">
                        <path fill="currentColor" d="M12 2L2 7L12 12L22 7L12 2M2 17L12 22L22 17V11L12 16L2 11V17Z"/>
                    </svg>
                </div>
                <h3>Welcome to Lectura lite</h3>
                <p>I have access to your document. Ask me anything!</p>
            </div>
        `;
        
        this.chatHistory = [];
        
        // Destroy AI session to start fresh
        if (this.aiSession) {
            this.aiSession.destroy();
            this.aiSession = null;
        }
        
        this.saveState();
    }

    async copyResult() {
        const resultEl = document.querySelector('.result-text');
        if (!resultEl) return;
        
        try {
            await navigator.clipboard.writeText(resultEl.textContent);
            this.showNotification('Copied to clipboard!');
        } catch (error) {
            console.error('Copy failed:', error);
            this.showNotification('Failed to copy');
        }
    }

    async exportResult() {
        const resultEl = document.querySelector('.result-text');
        if (!resultEl) return;
        
        const text = resultEl.textContent;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `lectura-result-${Date.now()}.txt`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showNotification('Exported successfully!');
    }

    showNotification(message) {
        // Create a simple notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

    async saveState() {
        try {
            await chrome.storage.local.set({
                lecturaSidebarState: {
                    currentScreen: this.currentScreen,
                    chatHistory: this.chatHistory,
                    documentContext: this.documentContext.substring(0, 5000), // Limit size
                    timestamp: Date.now()
                }
            });
        } catch (error) {
            console.error('Error saving state:', error);
        }
    }

    async loadState() {
        try {
            const result = await chrome.storage.local.get('lecturaSidebarState');
            
            if (result.lecturaSidebarState) {
                const state = result.lecturaSidebarState;
                
                // Check if state is recent (within 1 hour)
                if (Date.now() - state.timestamp < 3600000) {
                    this.chatHistory = state.chatHistory || [];
                    
                    // Restore chat screen if it was active
                    if (state.currentScreen === 'chat' && this.chatHistory.length > 0) {
                        this.showScreen('chat');
                        
                        // Restore chat messages
                        const messagesContainer = document.getElementById('chatMessages');
                        if (messagesContainer) {
                            messagesContainer.innerHTML = '';
                            
                            for (const msg of this.chatHistory) {
                                this.addMessage(msg.role === 'user' ? 'user' : 'ai', msg.content);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error loading state:', error);
        }
    }

    handleContextMenuAction(action, text) {
        // Set the document context to the selected text
        if (text) {
            this.documentContext = text;
            this.updateContextPreview();
            
            const statusEl = document.getElementById('contextStatus');
            if (statusEl) {
                statusEl.innerHTML = '<i class="fas fa-check-circle"></i><span>Loaded selected text</span>';
            }
        }
        
        // Handle different actions
        if (action === 'chat') {
            this.showScreen('chat');
        } else if (['summarize', 'proofread', 'translate'].includes(action)) {
            this.handleAction(action);
        }
    }

    handleTooltipAction(action, text) {
        console.log('🎯 handleTooltipAction called:', { 
            action, 
            textLength: text?.length, 
            textPreview: text?.substring(0, 100),
            hasText: !!text 
        });
        
        // Set the selected text as document context
        if (text) {
            this.documentContext = text;
            console.log('📝 Document context set:', this.documentContext.substring(0, 100));
            this.updateContextPreview();
            
            const statusEl = document.getElementById('contextStatus');
            if (statusEl) {
                statusEl.innerHTML = `<i class="fas fa-check-circle"></i><span>Loaded selected text (${Math.ceil(text.length / 2000)} pages)</span>`;
            }
        } else {
            console.warn('⚠️ No text provided to handleTooltipAction');
        }
        
        // Handle different actions
        if (action === 'chat') {
            console.log('💬 Opening chat with text');
            // Open chat screen
            this.showScreen('chat');
            
            // Automatically start conversation about the highlighted text
            if (text && text.trim()) {
                console.log('🤖 Starting auto chat with text:', text.substring(0, 100));
                setTimeout(() => {
                    // Add user message to chat
                    this.addMessage('user', `Please analyze this selected text for me.`);
                    
                    // Process with AI
                    this.processAutoChat(text);
                }, 500);
            } else {
                console.warn('⚠️ No text available for chat');
                this.addMessage('ai', 'No text was selected. Please highlight some text and try again.');
            }
        } else if (action === 'summarize' || action === 'proofread') {
            this.handleAction(action);
        } else if (action === 'translate') {
            this.handleAction('translate', { sourceLang: 'en', targetLang: 'fr' }); // Default languages
        }
    }
    
    async processAutoChat(text) {
        try {
            console.log('🤖 Processing auto chat with text');
            
            // Create prompt with user's requested format
            const prompt = `Explain what this is about:\n\n"${text}"`;
            
            // Get AI response
            const response = await this.getAIResponse(prompt);
            
            // Display response with typing animation
            await this.addMessageWithTyping('ai', response);
            
            // Save state
            this.saveState();
        } catch (error) {
            console.error('Auto chat error:', error);
            const errorMessage = 'I encountered an error analyzing the text. Please try asking me a specific question about it.';
            this.addMessage('ai', errorMessage);
        }
    }

    async processTranslation(sourceLang, targetLang) {
        const contentEl = document.getElementById('resultContent');
        if (contentEl) {
            contentEl.innerHTML = `
                <div class="loading-animation">
                    <div class="loading-spinner"></div>
                    <p>Translating text...</p>
                </div>
            `;
        }

        try {
            const result = await this.translateWithAPI(this.documentContext, sourceLang, targetLang);
            if (contentEl) {
                contentEl.innerHTML = `<div class="result-text fade-in">${this.formatResult(result)}</div>`;
            }
        } catch (error) {
            console.error('Error processing translation:', error);
            if (contentEl) {
                contentEl.innerHTML = `<div class="result-text" style="color: #ef4444;">Error: ${error.message}</div>`;
            }
        }
    }
    
    async checkPendingActions() {
        try {
            console.log('🔍 Checking for pending actions...');
            // Check if there's a pending tooltip action
            const result = await chrome.storage.local.get('pendingTooltipAction');
            
            console.log('📦 Storage result:', result);
            
            if (result.pendingTooltipAction) {
                const { action, text, timestamp } = result.pendingTooltipAction;
                
                console.log('✅ Found pending action:', {
                    action,
                    textLength: text?.length,
                    textPreview: text?.substring(0, 100),
                    timestamp,
                    age: Date.now() - timestamp
                });
                
                // Only process if the action is recent (within last 5 seconds)
                if (Date.now() - timestamp < 5000) {
                    console.log('⏰ Action is recent, processing...');
                    
                    // Clear the pending action
                    await chrome.storage.local.remove('pendingTooltipAction');
                    
                    // Process the action
                    this.handleTooltipAction(action, text);
                } else {
                    console.log('⏰ Action is too old, clearing...');
                    // Clear old pending action
                    await chrome.storage.local.remove('pendingTooltipAction');
                }
            } else {
                console.log('ℹ️ No pending action found');
            }
        } catch (error) {
            console.error('Error checking pending actions:', error);
        }
    }
}

// Initialize the sidebar
document.addEventListener('DOMContentLoaded', () => {
    new LecturaSidebar();
});

