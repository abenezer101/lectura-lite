// contentScript.js - Handles page interaction and overlay functionality
class LecturaContentScript {
    constructor() {
        this.overlay = null;
        this.isOverlayVisible = false;
        this.initialized = false;
        this.isPDF = this.detectPDF();
        this.init();
    }

    detectPDF() {
        // Check if we're in a PDF viewer
        return document.contentType === 'application/pdf' ||
               window.location.href.endsWith('.pdf') ||
               document.querySelector('embed[type="application/pdf"]') !== null ||
               document.body?.classList?.contains('pdf-viewer');
    }

    init() {
        if (this.initialized) return;
        
        // Only initialize once per frame
        if (window.lecturaInitialized) return;
        window.lecturaInitialized = true;
        
        this.setupMessageListener();
        this.setupSelectionHandler();
        this.initialized = true;
        
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            // Ensure the content script is ready
            if (!this.initialized) {
                this.init();
            }
            
            switch (message.type) {
                case 'PING':
                    // Respond to ping to confirm content script is ready
                    sendResponse({ status: 'ready' });
                    break;
                case 'LECTURA_SUMMARIZE':
                    this.handleSummarizeRequest(message.text);
                    break;
                case 'SHOW_OVERLAY':
                    this.showOverlay(message.data);
                    break;
                case 'HIDE_OVERLAY':
                    this.hideOverlay();
                    break;
                case 'SHOW_SIDEBAR':
                    this.showSidebar(message.action, message.text, message.originalAction);
                    break;
            }
        });
    }

    setupSelectionHandler() {
        document.addEventListener('mouseup', (event) => {
            // Don't interfere with tooltip buttons
            if (event.target.closest('.lectura-tooltip')) {
                return;
            }

            // Small delay to ensure selection is complete
            setTimeout(() => {
                const selection = window.getSelection();
                const selectedText = selection.toString().trim();
                
                // Show tooltip when text is selected (more than 5 characters)
                if (selectedText.length > 5) {
                    this.showSelectionTooltip(selectedText);
                } else {
                    this.hideSelectionTooltip();
                }
            }, 50);
        });

        // Hide tooltip when clicking elsewhere or starting a new selection
        document.addEventListener('mousedown', (event) => {
            if (!event.target.closest('.lectura-tooltip')) {
                this.hideSelectionTooltip();
            }
        });

        // Hide tooltip when scrolling
        document.addEventListener('scroll', () => {
            this.hideSelectionTooltip();
        }, true);

        // Hide tooltip when pressing Escape
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.hideSelectionTooltip();
            }
        });
    }


    showSelectionTooltip(selectedText) {
        this.hideSelectionTooltip(); // Remove any existing tooltip

        const tooltip = document.createElement('div');
        tooltip.className = 'lectura-tooltip';
        tooltip.innerHTML = `
            <div class="lectura-tooltip-content">
                <button class="lectura-tooltip-btn summarize-btn" data-action="summarize" title="Summarize">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>Summarize</span>
                </button>
                <button class="lectura-tooltip-btn translate-btn" data-action="translate" title="Translate">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <span>Translate</span>
                </button>
                <button class="lectura-tooltip-btn proofread-btn" data-action="proofread" title="Proofread">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M14 2v6h6M9 15l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>Proofread</span>
                </button>
                <button class="lectura-tooltip-btn ai-btn" data-action="chat" title="Chat with AI">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" opacity="0.3"/>
                        <path d="M19 3l.75 2.25L22 6l-2.25.75L19 9l-.75-2.25L16 6l2.25-.75L19 3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" opacity="0.5"/>
                    </svg>
                    <span>AI</span>
                </button>
            </div>
        `;

        // Get selection position for better tooltip placement
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        tooltip.style.cssText = `
            position: fixed;
            top: ${rect.top - 38}px;
            left: ${rect.left + (rect.width / 2) - 100}px;
            z-index: 10001;
            background: rgba(17, 24, 39, 0.98);
            backdrop-filter: blur(12px);
            border-radius: 6px;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(75, 85, 99, 0.4);
            padding: 3px;
            display: flex;
            gap: 3px;
            animation: slideInUp 0.15s ease-out;
            border: 1px solid rgba(55, 65, 81, 0.5);
        `;

        // Add CSS for tooltip only (scoped to prevent page interference)
        if (!document.getElementById('lectura-tooltip-styles')) {
            const style = document.createElement('style');
            style.id = 'lectura-tooltip-styles';
            style.textContent = `
                .lectura-tooltip {
                    position: fixed !important;
                    z-index: 10001 !important;
                    pointer-events: auto !important;
                }
                .lectura-tooltip-content {
                    display: flex !important;
                    gap: 3px !important;
                    align-items: center !important;
                }
                .lectura-tooltip-btn {
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
                    justify-content: center !important;
                    gap: 2px !important;
                    padding: 4px 6px !important;
                    border: none !important;
                    border-radius: 4px !important;
                    cursor: pointer !important;
                    font-size: 8px !important;
                    font-weight: 500 !important;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                    color: #e5e7eb !important;
                    transition: all 0.15s ease !important;
                    position: relative !important;
                    overflow: hidden !important;
                    min-width: 42px !important;
                    backdrop-filter: blur(8px) !important;
                }
                .lectura-tooltip-btn span {
                    position: relative !important;
                    z-index: 1 !important;
                    font-size: 8px !important;
                    letter-spacing: 0.1px !important;
                }
                .lectura-tooltip-btn svg {
                    position: relative !important;
                    z-index: 1 !important;
                    width: 12px !important;
                    height: 12px !important;
                    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.2)) !important;
                }
                .lectura-tooltip-btn::before {
                    content: '' !important;
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0)) !important;
                    opacity: 0 !important;
                    transition: opacity 0.15s !important;
                }
                .lectura-tooltip-btn:hover::before {
                    opacity: 1 !important;
                }
                .lectura-tooltip-btn:hover {
                    transform: translateY(-2px) scale(1.03) !important;
                }
                .lectura-tooltip-btn:active {
                    transform: translateY(0) scale(0.98) !important;
                }
                
                /* Individual button colors - lighter with better glow */
                .summarize-btn {
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
                    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4), 0 0 0 1px rgba(59, 130, 246, 0.1) !important;
                }
                .summarize-btn:hover {
                    background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%) !important;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.6), 0 0 20px rgba(59, 130, 246, 0.3) !important;
                }
                
                .translate-btn {
                    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%) !important;
                    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.4), 0 0 0 1px rgba(139, 92, 246, 0.1) !important;
                }
                .translate-btn:hover {
                    background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%) !important;
                    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.6), 0 0 20px rgba(139, 92, 246, 0.3) !important;
                }
                
                .proofread-btn {
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
                    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4), 0 0 0 1px rgba(16, 185, 129, 0.1) !important;
                }
                .proofread-btn:hover {
                    background: linear-gradient(135deg, #34d399 0%, #10b981 100%) !important;
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.6), 0 0 20px rgba(16, 185, 129, 0.3) !important;
                }
                
                .ai-btn {
                    background: linear-gradient(135deg, #ec4899 0%, #db2777 100%) !important;
                    box-shadow: 0 2px 8px rgba(236, 72, 153, 0.4), 0 0 0 1px rgba(236, 72, 153, 0.1) !important;
                }
                .ai-btn:hover {
                    background: linear-gradient(135deg, #f472b6 0%, #ec4899 100%) !important;
                    box-shadow: 0 4px 12px rgba(236, 72, 153, 0.6), 0 0 20px rgba(236, 72, 153, 0.3) !important;
                }
                
                @keyframes slideInUp {
                    from { 
                        opacity: 0; 
                        transform: translateY(8px) scale(0.96); 
                    }
                    to { 
                        opacity: 1; 
                        transform: translateY(0) scale(1); 
                    }
                }
            `;
            document.head.appendChild(style);
        }

        // Add event listeners to tooltip buttons
        tooltip.querySelectorAll('.lectura-tooltip-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                const action = btn.dataset.action;
                
                // Add visual feedback
                btn.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    btn.style.transform = '';
                }, 100);
                
                // Hide tooltip
                this.hideSelectionTooltip();
                
                // Send message to background synchronously (maintains user gesture)
                chrome.runtime.sendMessage({
                    type: 'OPEN_SIDEBAR_WITH_ACTION',
                    action: action,
                    text: selectedText,
                    userGesture: true
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('❌ Message error:', chrome.runtime.lastError);
                    } else {
                    }
                });
            });
        });

        document.body.appendChild(tooltip);
        
        // Store selected text for later use
        this.currentSelectedText = selectedText;
    }

    hideSelectionTooltip() {
        const existingTooltip = document.querySelector('.lectura-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }
    }

    showSidebar(action, text, originalAction) {
        // Hide any existing sidebar
        this.hideSidebar();
        
        // Create sidebar
        const sidebar = document.createElement('div');
        sidebar.id = 'lectura-sidebar';
        sidebar.innerHTML = `
            <div class="lectura-sidebar-header">
                <div class="lectura-sidebar-title">
                    <i class="fas fa-robot"></i>
                    <span>Lectura AI Assistant</span>
                </div>
                <button class="lectura-sidebar-close" id="lectura-sidebar-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="lectura-sidebar-content">
                <div class="lectura-sidebar-text">
                    <h4>Selected Text:</h4>
                    <div class="lectura-text-preview">${text.substring(0, 200)}${text.length > 200 ? '...' : ''}</div>
                </div>
                <div class="lectura-sidebar-actions">
                    <button class="lectura-sidebar-btn" data-action="summarize">
                        <i class="fas fa-list-ul"></i> Summarize
                    </button>
                    <button class="lectura-sidebar-btn" data-action="explain">
                        <i class="fas fa-question-circle"></i> Explain
                    </button>
                    <button class="lectura-sidebar-btn" data-action="translate">
                        <i class="fas fa-language"></i> Translate
                    </button>
                    <button class="lectura-sidebar-btn" data-action="rewrite">
                        <i class="fas fa-edit"></i> Rewrite
                    </button>
                    <button class="lectura-sidebar-btn" data-action="chat">
                        <i class="fas fa-comments"></i> Chat
                    </button>
                </div>
                <div class="lectura-sidebar-result" id="lectura-sidebar-result">
                    <div class="lectura-loading">
                        <div class="lectura-spinner"></div>
                        <span>Processing with AI...</span>
                    </div>
                </div>
            </div>
        `;

        // Add sidebar styles
        this.addSidebarStyles();
        
        // Add to page
        document.body.appendChild(sidebar);
        
        // Add event listeners
        this.setupSidebarEvents(sidebar, text, action, originalAction);
        
        // Auto-execute the action
        setTimeout(() => {
            this.executeSidebarAction(action, text, originalAction);
        }, 100);
    }

    hideSidebar() {
        const existingSidebar = document.getElementById('lectura-sidebar');
        if (existingSidebar) {
            existingSidebar.remove();
        }
    }

    addSidebarStyles() {
        if (document.getElementById('lectura-sidebar-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'lectura-sidebar-styles';
        style.textContent = `
            #lectura-sidebar {
                position: fixed !important;
                top: 0 !important;
                right: 0 !important;
                width: 400px !important;
                height: 100vh !important;
                background: linear-gradient(135deg, #1f2937 0%, #111827 100%) !important;
                border-left: 1px solid rgba(255, 255, 255, 0.1) !important;
                box-shadow: -10px 0 30px rgba(0, 0, 0, 0.3) !important;
                z-index: 10000 !important;
                display: flex !important;
                flex-direction: column !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                color: #e5e7eb !important;
                animation: slideInRight 0.3s ease-out !important;
            }
            
            .lectura-sidebar-header {
                padding: 20px !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%) !important;
            }
            
            .lectura-sidebar-title {
                display: flex !important;
                align-items: center !important;
                gap: 10px !important;
                font-weight: 600 !important;
                font-size: 16px !important;
                color: white !important;
            }
            
            .lectura-sidebar-close {
                background: rgba(255, 255, 255, 0.2) !important;
                border: none !important;
                color: white !important;
                width: 32px !important;
                height: 32px !important;
                border-radius: 50% !important;
                cursor: pointer !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                transition: all 0.2s ease !important;
            }
            
            .lectura-sidebar-close:hover {
                background: rgba(255, 255, 255, 0.3) !important;
                transform: scale(1.1) !important;
            }
            
            .lectura-sidebar-content {
                flex: 1 !important;
                padding: 20px !important;
                overflow-y: auto !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 20px !important;
            }
            
            .lectura-sidebar-text h4 {
                margin: 0 0 10px 0 !important;
                color: #9ca3af !important;
                font-size: 14px !important;
                font-weight: 500 !important;
            }
            
            .lectura-text-preview {
                background: rgba(31, 41, 55, 0.8) !important;
                padding: 15px !important;
                border-radius: 8px !important;
                border: 1px solid rgba(255, 255, 255, 0.1) !important;
                font-size: 14px !important;
                line-height: 1.5 !important;
                color: #e5e7eb !important;
                max-height: 120px !important;
                overflow-y: auto !important;
            }
            
            .lectura-sidebar-actions {
                display: grid !important;
                grid-template-columns: 1fr 1fr !important;
                gap: 10px !important;
            }
            
            .lectura-sidebar-btn {
                background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%) !important;
                border: none !important;
                color: white !important;
                padding: 12px 16px !important;
                border-radius: 8px !important;
                cursor: pointer !important;
                font-size: 13px !important;
                font-weight: 500 !important;
                display: flex !important;
                align-items: center !important;
                gap: 8px !important;
                transition: all 0.2s ease !important;
                box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3) !important;
            }
            
            .lectura-sidebar-btn:hover {
                transform: translateY(-2px) !important;
                box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4) !important;
            }
            
            .lectura-sidebar-btn:active {
                transform: translateY(0) !important;
            }
            
            .lectura-sidebar-result {
                flex: 1 !important;
                background: rgba(31, 41, 55, 0.8) !important;
                border-radius: 8px !important;
                padding: 20px !important;
                border: 1px solid rgba(255, 255, 255, 0.1) !important;
                overflow-y: auto !important;
            }
            
            .lectura-loading {
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 15px !important;
                color: #9ca3af !important;
                font-size: 14px !important;
            }
            
            .lectura-spinner {
                width: 32px !important;
                height: 32px !important;
                border: 3px solid rgba(59, 130, 246, 0.3) !important;
                border-top: 3px solid #3b82f6 !important;
                border-radius: 50% !important;
                animation: spin 1s linear infinite !important;
            }
            
            .lectura-result-content {
                color: #e5e7eb !important;
                line-height: 1.6 !important;
                white-space: pre-wrap !important;
            }
            
            @keyframes slideInRight {
                from {
                    transform: translateX(100%) !important;
                    opacity: 0 !important;
                }
                to {
                    transform: translateX(0) !important;
                    opacity: 1 !important;
                }
            }
            
            @keyframes spin {
                from { transform: rotate(0deg) !important; }
                to { transform: rotate(360deg) !important; }
            }
            
            /* Responsive */
            @media (max-width: 768px) {
                #lectura-sidebar {
                    width: 100vw !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    setupSidebarEvents(sidebar, text, action, originalAction) {
        // Close button
        sidebar.querySelector('#lectura-sidebar-close').addEventListener('click', () => {
            this.hideSidebar();
        });
        
        // Action buttons
        sidebar.querySelectorAll('.lectura-sidebar-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const newAction = e.target.getAttribute('data-action');
                this.executeSidebarAction(newAction, text, originalAction);
            });
        });
        
        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!sidebar.contains(e.target) && !e.target.closest('.lectura-tooltip')) {
                this.hideSidebar();
            }
        });
        
        // Prevent sidebar clicks from closing
        sidebar.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    async executeSidebarAction(action, text, originalAction) {
        // Special handling for chat - open extension popup
        if (action === 'chat') {
            this.hideSidebar();
            chrome.runtime.sendMessage({
                type: 'QUICK_ACTION',
                action: 'chat',
                text: text,
                originalAction: 'chat'
            });
            return;
        }
        
        const resultDiv = document.getElementById('lectura-sidebar-result');
        if (!resultDiv) return;
        
        // Show loading
        resultDiv.innerHTML = `
            <div class="lectura-loading">
                <div class="lectura-spinner"></div>
                <span>Processing with AI...</span>
            </div>
        `;
        
        try {
            // Send request to background script
            const response = await chrome.runtime.sendMessage({
                type: 'AI_REQUEST',
                action: action,
                text: text,
                options: this.getActionOptions(action, originalAction)
            });
            
            if (response.status === 'success') {
                resultDiv.innerHTML = `
                    <div class="lectura-result-content">${response.result}</div>
                `;
            } else {
                resultDiv.innerHTML = `
                    <div class="lectura-result-content" style="color: #ef4444;">
                        Error: ${response.message}
                    </div>
                `;
            }
        } catch (error) {
            console.error('Sidebar action error:', error);
            resultDiv.innerHTML = `
                <div class="lectura-result-content" style="color: #ef4444;">
                    Error: ${error.message}
                </div>
            `;
        }
    }

    getActionOptions(action, originalAction) {
        const options = {};
        
        if (action === 'summarize') {
            if (originalAction === 'flashcards') {
                options.format = 'flashcards';
            } else {
                options.format = 'bullets';
            }
        } else if (action === 'translate') {
            options.fromLang = 'auto';
            options.toLang = 'en';
        } else if (action === 'rewrite') {
            if (originalAction === 'explain') {
                options.style = 'simplify';
            } else {
                options.style = 'academic';
            }
        }
        
        return options;
    }

    handleQuickAction(action, text) {
        // Map the new actions to existing functionality
        let mappedAction = action;
        if (action === 'flashcards') {
            mappedAction = 'summarize'; // Use summarize with flashcards format
        } else if (action === 'explain') {
            mappedAction = 'explain'; // Use dedicated explain action
        } else if (action === 'chat') {
            mappedAction = 'chat'; // Direct chat action
        }
        
        // Show sidebar instead of opening popup
        this.showSidebar(mappedAction, text, action);
    }

    handleSummarizeRequest(text) {
        this.showOverlay({
            type: 'summarize',
            text: text,
            title: 'Summarize with Lectura'
        });
    }

    showOverlay(data) {
        this.hideOverlay(); // Remove any existing overlay

        const overlay = document.createElement('div');
        overlay.id = 'lectura-overlay';
        overlay.innerHTML = `
            <div class="lectura-overlay-backdrop"></div>
            <div class="lectura-overlay-content">
                <div class="lectura-overlay-header">
                    <h3>${data.title || 'Lectura App Offline'}</h3>
                    <button class="lectura-overlay-close">&times;</button>
                </div>
                <div class="lectura-overlay-body">
                    <div class="lectura-text-preview">
                        <h4>Selected Text:</h4>
                        <div class="lectura-text-content">${data.text}</div>
                    </div>
                    <div class="lectura-actions">
                        <button class="lectura-action-btn" data-action="summarize">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M9 12L11 14L15 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2"/>
                            </svg>
                            Summarize
                        </button>
                        <button class="lectura-action-btn" data-action="proofread">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M9 12L11 14L15 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2"/>
                            </svg>
                            Proofread
                        </button>
                        <button class="lectura-action-btn" data-action="translate">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M12.87 15.07L10.33 12.53L7.93 15.07L6.53 13.67L8.93 11.27L6.53 8.87L7.93 7.47L10.33 9.87L12.87 7.33L14.27 8.73L11.73 11.27L14.27 13.81L12.87 15.07Z" fill="currentColor"/>
                            </svg>
                            Translate
                        </button>
                        <button class="lectura-action-btn" data-action="rewrite">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M11 4H4C2.89543 4 2 4.89543 2 6V18C2 19.1046 2.89543 20 4 20H16C17.1046 20 18 19.1046 18 18V11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M18.5 2.5C18.8978 2.10218 19.4374 1.87868 20 1.87868C20.5626 1.87868 21.1022 2.10218 21.5 2.5C21.8978 2.89782 22.1213 3.43739 22.1213 4C22.1213 4.56261 21.8978 5.10218 21.5 5.5L12 15L8 11L18.5 2.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            Rewrite
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add overlay styles
        const style = document.createElement('style');
        style.textContent = `
            #lectura-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .lectura-overlay-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(2px);
            }
            .lectura-overlay-content {
                position: relative;
                background: white;
                border-radius: 12px;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow: hidden;
                animation: slideIn 0.3s ease;
            }
            @keyframes slideIn {
                from { opacity: 0; transform: scale(0.9) translateY(20px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
            .lectura-overlay-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px;
                border-bottom: 1px solid #e5e7eb;
            }
            .lectura-overlay-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
                color: #111827;
            }
            .lectura-overlay-close {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #6b7280;
                padding: 0;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 6px;
                transition: all 0.2s ease;
            }
            .lectura-overlay-close:hover {
                background: #f3f4f6;
                color: #374151;
            }
            .lectura-overlay-body {
                padding: 20px;
            }
            .lectura-text-preview {
                margin-bottom: 20px;
            }
            .lectura-text-preview h4 {
                margin: 0 0 10px 0;
                font-size: 14px;
                font-weight: 600;
                color: #374151;
            }
            .lectura-text-content {
                background: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 12px;
                font-size: 14px;
                line-height: 1.5;
                color: #374151;
                max-height: 150px;
                overflow-y: auto;
            }
            .lectura-actions {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 12px;
            }
            .lectura-action-btn {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 12px 16px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s ease;
                background: #f8f9fa;
                color: #495057;
            }
            .lectura-action-btn:hover {
                background: #e9ecef;
                transform: translateY(-1px);
            }
            .lectura-action-btn[data-action="summarize"] {
                background: #dbeafe;
                color: #1e40af;
            }
            .lectura-action-btn[data-action="proofread"] {
                background: #dcfce7;
                color: #166534;
            }
            .lectura-action-btn[data-action="translate"] {
                background: #f3e8ff;
                color: #7c3aed;
            }
            .lectura-action-btn[data-action="rewrite"] {
                background: #fed7aa;
                color: #ea580c;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(overlay);

        // Add event listeners
        overlay.querySelector('.lectura-overlay-close').addEventListener('click', () => {
            this.hideOverlay();
        });

        overlay.querySelector('.lectura-overlay-backdrop').addEventListener('click', () => {
            this.hideOverlay();
        });

        overlay.querySelectorAll('.lectura-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.openExtensionPopup(action, data.text);
                this.hideOverlay();
            });
        });

        this.overlay = overlay;
        this.isOverlayVisible = true;
    }

    hideOverlay() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
            this.isOverlayVisible = false;
        }
    }

    openExtensionPopup(action = null, text = null) {
        // Open the extension popup
        chrome.runtime.sendMessage({
            type: 'OPEN_POPUP',
            action: action,
            text: text
        });
    }
}

// Initialize the content script
const lecturaContentScript = new LecturaContentScript();
