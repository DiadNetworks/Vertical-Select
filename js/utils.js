/**
 * Utility functions for Vertical Text Selector
 */

/**
 * Debounce function to limit how often a function is called
 * @param {Function} func - The function to debounce
 * @param {number} wait - The debounce time in milliseconds
 * @returns {Function} - The debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

/**
 * Throttle function to limit function execution rate
 * @param {Function} func - The function to throttle
 * @param {number} limit - The throttle time in milliseconds
 * @returns {Function} - The throttled function
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Save text to a local file
 * @param {string} text - The text to save
 * @param {string} filename - The name of the file
 */
export function saveToFile(text, filename = 'selection.txt') {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    
    // Create a download link
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    
    // Append to the document temporarily
    document.body.appendChild(link);
    
    // Trigger download and clean up
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

/**
 * Check if the browser is in dark mode
 * @returns {boolean} - True if dark mode is enabled
 */
export function isDarkMode() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Generate a unique ID
 * @returns {string} - A unique ID
 */
export function generateId() {
    return '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Format a date to a readable string
 * @param {Date} date - The date to format
 * @returns {string} - Formatted date string
 */
export function formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}