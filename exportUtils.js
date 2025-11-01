// exportUtils.js - Export functionality for Lectura App Offline
class LecturaExport {
    constructor() {
        this.supportedFormats = ['txt', 'md', 'docx', 'pdf'];
        this.exportProviders = ['file', 'google_docs', 'notion', 'clipboard'];
    }

    /**
     * Export content to various formats and platforms
     * @param {string} content - The content to export
     * @param {string} format - Export format (txt, md, docx, pdf)
     * @param {string} provider - Export provider (file, google_docs, notion, clipboard)
     * @param {Object} options - Additional options
     */
    async exportContent(content, format = 'txt', provider = 'file', options = {}) {
        const filename = options.filename || this.generateFilename(format);
        
        switch (provider) {
            case 'file':
                return this.exportToFile(content, filename, format);
            case 'google_docs':
                return this.exportToGoogleDocs(content, options);
            case 'notion':
                return this.exportToNotion(content, options);
            case 'clipboard':
                return this.exportToClipboard(content);
            default:
                throw new Error(`Unsupported export provider: ${provider}`);
        }
    }

    /**
     * Export content to a downloadable file
     */
    async exportToFile(content, filename, format) {
        try {
            let mimeType, fileExtension;
            
            switch (format) {
                case 'txt':
                    mimeType = 'text/plain';
                    fileExtension = 'txt';
                    break;
                case 'md':
                    mimeType = 'text/markdown';
                    fileExtension = 'md';
                    break;
                case 'docx':
                    // For DOCX, we'll create a simple text file
                    // In a real implementation, you'd use a library like docx
                    mimeType = 'text/plain';
                    fileExtension = 'txt';
                    content = this.formatAsDocument(content);
                    break;
                case 'pdf':
                    // For PDF, we'll create a simple text file
                    // In a real implementation, you'd use a library like jsPDF
                    mimeType = 'text/plain';
                    fileExtension = 'txt';
                    content = this.formatAsDocument(content);
                    break;
                default:
                    mimeType = 'text/plain';
                    fileExtension = 'txt';
            }

            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}.${fileExtension}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            return { success: true, message: 'File downloaded successfully' };
        } catch (error) {
            console.error('File export error:', error);
            throw new Error('Failed to export file');
        }
    }

    /**
     * Export content to Google Docs
     */
    async exportToGoogleDocs(content, options = {}) {
        try {
            const title = options.title || 'Lectura Export';
            const encodedContent = encodeURIComponent(content);
            const encodedTitle = encodeURIComponent(title);
            
            // Create a new Google Doc with the content
            const url = `https://docs.google.com/document/create?usp=docs_web&title=${encodedTitle}&text=${encodedContent}`;
            
            // Open in new tab
            chrome.tabs.create({ url: url });
            
            return { success: true, message: 'Opening Google Docs...' };
        } catch (error) {
            console.error('Google Docs export error:', error);
            throw new Error('Failed to export to Google Docs');
        }
    }

    /**
     * Export content to Notion
     */
    async exportToNotion(content, options = {}) {
        try {
            const title = options.title || 'Lectura Export';
            const encodedContent = encodeURIComponent(content);
            const encodedTitle = encodeURIComponent(title);
            
            // Create a new Notion page with the content
            const url = `https://www.notion.so/new?title=${encodedTitle}&content=${encodedContent}`;
            
            // Open in new tab
            chrome.tabs.create({ url: url });
            
            return { success: true, message: 'Opening Notion...' };
        } catch (error) {
            console.error('Notion export error:', error);
            throw new Error('Failed to export to Notion');
        }
    }

    /**
     * Export content to clipboard
     */
    async exportToClipboard(content) {
        try {
            await navigator.clipboard.writeText(content);
            return { success: true, message: 'Content copied to clipboard' };
        } catch (error) {
            console.error('Clipboard export error:', error);
            throw new Error('Failed to copy to clipboard');
        }
    }

    /**
     * Generate a filename based on current timestamp and format
     */
    generateFilename(format) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        return `lectura-export-${timestamp}`;
    }

    /**
     * Format content as a document with proper structure
     */
    formatAsDocument(content) {
        const timestamp = new Date().toLocaleString();
        return `Lectura App Offline - Export
Generated on: ${timestamp}

${'='.repeat(50)}

${content}

${'='.repeat(50)}

This document was generated by Lectura App Offline Chrome Extension.
For more information, visit: https://github.com/lectura-app/offline-extension
`;
    }

    /**
     * Format content as Markdown
     */
    formatAsMarkdown(content, title = 'Lectura Export') {
        const timestamp = new Date().toLocaleString();
        return `# ${title}

*Generated on: ${timestamp}*

---

${content}

---

*This document was generated by [Lectura App Offline](https://github.com/lectura-app/offline-extension) Chrome Extension.*
`;
    }

    /**
     * Get available export formats
     */
    getAvailableFormats() {
        return this.supportedFormats;
    }

    /**
     * Get available export providers
     */
    getAvailableProviders() {
        return this.exportProviders;
    }

    /**
     * Validate export options
     */
    validateOptions(format, provider) {
        if (!this.supportedFormats.includes(format)) {
            throw new Error(`Unsupported format: ${format}`);
        }
        if (!this.exportProviders.includes(provider)) {
            throw new Error(`Unsupported provider: ${provider}`);
        }
        return true;
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LecturaExport;
} else if (typeof window !== 'undefined') {
    window.LecturaExport = LecturaExport;
}
