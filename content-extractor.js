// Content Extractor with bundled libraries
// This script includes both Readability and dom-to-semantic-markdown

// Mozilla Readability (simplified version)
const { Readability } = require('@mozilla/readability');

// dom-to-semantic-markdown
const domToSemanticMarkdown = require('dom-to-semantic-markdown');

// Make available globally for executeScript
window.BROPExtractor = {
  Readability: Readability,
  domToSemanticMarkdown: domToSemanticMarkdown,
  
  extractHTML: function(options = {}) {
    const { enableDetailedResponse = false } = options;
    
    try {
      // Clean document clone for processing
      let documentClone = document.cloneNode(true);
      documentClone.querySelectorAll('script').forEach(item => item.remove());
      documentClone.querySelectorAll('style').forEach(item => item.remove());
      documentClone.querySelectorAll('iframe').forEach(item => item.remove());
      documentClone.querySelectorAll('noscript').forEach(item => item.remove());
      
      let content, stats;
      
      if (enableDetailedResponse) {
        // Use full document content
        content = documentClone.body ? documentClone.body.innerHTML : documentClone.documentElement.innerHTML;
        stats = {
          source: 'full_document_html',
          processed: true,
          cleaned: true
        };
      } else {
        // Use Readability to extract article content
        const reader = new Readability(documentClone, {
          charThreshold: 0,
          keepClasses: true,
          nbTopCandidates: 500,
        });

        const article = reader.parse();
        
        if (!article || !article.content) {
          throw new Error('No readable content found by Readability');
        }

        content = article.content;
        stats = {
          source: 'readability_html',
          title: article.title,
          byline: article.byline,
          excerpt: article.excerpt,
          readTime: article.readTime || 0,
          textLength: article.textContent?.length || 0,
          processed: true
        };
      }
      
      return {
        html: content,
        title: document.title,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        stats: stats
      };
      
    } catch (error) {
      console.error('HTML extraction error:', error);
      return {
        error: 'HTML extraction failed: ' + error.message,
        title: document.title || 'Unknown',
        url: window.location.href || 'Unknown'
      };
    }
  },
  
  extractMarkdown: function(options = {}) {
    const { enableDetailedResponse = false } = options;
    
    try {
      let contentElement;
      
      if (enableDetailedResponse) {
        // Use full document body
        contentElement = document.body || document.documentElement;
      } else {
        // Try to find main content area
        contentElement = document.querySelector('main') || 
                       document.querySelector('article') || 
                       document.querySelector('.content') || 
                       document.querySelector('#content') || 
                       document.body || 
                       document.documentElement;
      }
      
      const markdown = domToSemanticMarkdown(contentElement, {
        extractMainContent: !enableDetailedResponse,
        includeMetadata: true,
        processCodeBlocks: true,
        processImages: true,
        processTables: true
      });
      
      return {
        markdown: markdown,
        title: document.title,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        stats: {
          source: enableDetailedResponse ? 'dom_to_semantic_markdown_full' : 'dom_to_semantic_markdown_main',
          markdownLength: markdown.length,
          processed: true
        }
      };
      
    } catch (error) {
      console.error('Markdown extraction error:', error);
      return {
        error: 'Markdown extraction failed: ' + error.message,
        title: document.title || 'Unknown',
        url: window.location.href || 'Unknown'
      };
    }
  }
};

console.log('BROP Content Extractor loaded with bundled libraries');