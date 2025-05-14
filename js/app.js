// DOM Elements
const textArea = document.getElementById('text-area');
const textOverlay = document.getElementById('text-overlay');
const statusBar = document.getElementById('status-bar');
const statusMessage = document.querySelector('.status-message');
const copyButton = document.getElementById('copyButton');
const clearButton = document.getElementById('clearButton');
const demoButton = document.getElementById('demoButton');
const selectionInfo = document.getElementById('selection-info');

// Selection state
let selectionState = {
    active: false,
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    justFinishedDragging: false
};

// Demo text for the "Demo" button
const demoText = `User ID,Name,Email,Sign-up Date,Status,Plan
1001,John Smith,john.smith@example.com,2023-01-15,Active,Pro
1002,Emily Johnson,emily.j@example.com,2023-02-20,Active,Basic
1003,Michael Brown,mbrown@example.com,2023-01-30,Inactive,Basic
1004,Sarah Davis,sarah.davis@example.com,2023-03-05,Active,Premium
1005,David Wilson,dwilson@example.com,2023-02-10,Active,Pro
1006,Jennifer Taylor,jtaylor@example.com,2023-03-15,Pending,Basic
1007,Robert Anderson,robert.a@example.com,2023-01-22,Active,Premium
1008,Lisa Thomas,lthomas@example.com,2023-02-28,Active,Basic
1009,James Martin,jmartin@example.com,2023-03-10,Inactive,Pro
1010,Laura Garcia,lgarcia@example.com,2023-01-18,Active,Premium`;

// Initialize the application
function init() {
    // Set up event listeners
    textArea.addEventListener('input', handleInput);
    textArea.addEventListener('scroll', handleScroll);
    textArea.addEventListener('click', handleClick);
    textArea.addEventListener('mousedown', handleMouseDown);
    textArea.addEventListener('mousemove', handleMouseMove);
    textArea.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mouseup', handleWindowMouseUp); // Capture mouse up outside textarea
    
    copyButton.addEventListener('click', handleCopy);
    clearButton.addEventListener('click', handleClear);
    demoButton.addEventListener('click', loadDemoText);
    
    // Focus the textarea to start
    textArea.focus();
    
    // Initialize the overlay
    updateOverlay();
}

// Handle text input - update the overlay with new text
function handleInput() {
    try {
        // Attempt basic encoding normalization
        const encoder = new TextEncoder();
        const decoder = new TextDecoder('utf-8', { fatal: true });
        const encoded = encoder.encode(textArea.value);
        textArea.value = decoder.decode(encoded);
    } catch (err) {
        console.warn('Encoding normalization encountered issues:', err);
    }
    
    updateOverlay();
    updateStatus('Text updated. Drag to select columns.');
    clearSelection();
}

// Synchronize overlay with textarea when scrolling
function handleScroll() {
    // Use transform for smoother scrolling
    textOverlay.style.transform = `translate(-${textArea.scrollLeft}px, -${textArea.scrollTop}px)`;
}

// Clear selection when clicking outside a current selection
function handleClick(event) {
    if (selectionState.justFinishedDragging) {
        selectionState.justFinishedDragging = false;
        return;
    }
    
    if (document.querySelector('.selected-column')) {
        clearSelection();
        updateStatus('Selection cleared. Drag to select columns.');
        selectionInfo.classList.remove('active');
        selectionInfo.textContent = 'No selection';
        event.preventDefault();
    }
}

// Start column selection on mouse down
function handleMouseDown(event) {
    // Only proceed for textarea
    if (event.target !== textArea) return;
    
    const pos = getPositionFromEvent(event);
    if (!pos) return;
    
    selectionState.startX = pos.col;
    selectionState.startY = pos.row;
    selectionState.endX = pos.col; // Initialize end to same as start
    selectionState.endY = pos.row;
    selectionState.active = true;
    
    // Clear previous selection unless extending with modifier key
    if (!event.ctrlKey && !event.metaKey) {
        clearSelection();
    }
    
    updateStatus('Selection started. Drag to select columns.', 'selecting');
    event.preventDefault();
}

// Update selection while dragging
function handleMouseMove(event) {
    if (!selectionState.active) return;
    
    const pos = getPositionFromEvent(event);
    if (!pos) return;
    
    selectionState.endX = pos.col;
    selectionState.endY = pos.row;
    
    // Clear and reapply selection for visual update
    clearSelection();
    highlightColumns();
    
    // Update selection info
    updateSelectionInfo();
    
    event.preventDefault();
}

// Finalize selection on mouse up
function handleMouseUp(event) {
    if (!selectionState.active) return;
    
    // Final position update
    const pos = getPositionFromEvent(event);
    if (pos) {
        selectionState.endX = pos.col;
        selectionState.endY = pos.row;
        clearSelection();
        highlightColumns();
    }
    
    finishSelection();
    event.preventDefault();
}

// Handle mouse up that occurs outside the textarea
function handleWindowMouseUp() {
    if (selectionState.active) {
        finishSelection();
    }
}

// Complete the selection process
function finishSelection() {
    selectionState.active = false;
    selectionState.justFinishedDragging = true;
    
    // Update status and selection info
    updateSelectionInfo();
    
    const hasSelection = document.querySelector('.selected-column');
    if (hasSelection) {
        updateStatus('Selection complete. Click "Copy Selection" to copy to clipboard.', 'ready');
    }
}

// Update selection info display
function updateSelectionInfo() {
    const minCol = Math.min(selectionState.startX, selectionState.endX);
    const maxCol = Math.max(selectionState.startX, selectionState.endX);
    const minRow = Math.min(selectionState.startY, selectionState.endY);
    const maxRow = Math.max(selectionState.startY, selectionState.endY);
    
    const colCount = maxCol - minCol + 1;
    const rowCount = maxRow - minRow + 1;
    
    selectionInfo.textContent = `Columns ${minCol + 1}-${maxCol + 1} (${colCount} chars wide), Rows ${minRow + 1}-${maxRow + 1} (${rowCount} rows)`;
    selectionInfo.classList.add('active');
}

// Copy selected text to clipboard
function handleCopy() {
    if (!document.querySelector('.selected-column')) {
        updateStatus('No text selected. Please drag to select first.', 'warning');
        return;
    }
    
    const selectedText = getSelectedText();
    if (selectedText.trim() === '') {
        updateStatus('No valid text in selection to copy.', 'warning');
        return;
    }
    
    copyToClipboard(selectedText);
}

// Get the text from the selected columns
function getSelectedText() {
    const minRow = Math.min(selectionState.startY, selectionState.endY);
    const maxRow = Math.max(selectionState.startY, selectionState.endY);
    const minCol = Math.min(selectionState.startX, selectionState.endX);
    const maxCol = Math.max(selectionState.startX, selectionState.endX);
    
    const lines = textArea.value.split('\n');
    const selectedLines = [];
    let validSelections = 0;
    
    for (let r = minRow; r <= maxRow; r++) {
        if (r >= lines.length) {
            selectedLines.push('');
            continue;
        }
        
        const line = lines[r];
        const startCol = Math.min(minCol, line.length);
        const endCol = Math.min(maxCol + 1, line.length);
        
        if (endCol > startCol) {
            selectedLines.push(line.slice(startCol, endCol));
            validSelections++;
        } else {
            selectedLines.push(''); // Add empty string for consistency
        }
    }
    
    return selectedLines.join('\n');
}

// Copy text to clipboard with fallback
function copyToClipboard(text) {
    // Modern clipboard API with fallback
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
        navigator.clipboard.writeText(text)
            .then(() => {
                showCopySuccess();
            })
            .catch(err => {
                console.error('Clipboard API failed:', err);
                fallbackCopy(text);
            });
    } else {
        fallbackCopy(text);
    }
}

// Fallback copy method using document.execCommand
function fallbackCopy(text) {
    const tempInput = document.createElement('textarea');
    tempInput.value = text;
    tempInput.style.position = 'fixed';
    tempInput.style.left = '-9999px';
    tempInput.style.opacity = '0';
    document.body.appendChild(tempInput);
    
    try {
        tempInput.focus();
        tempInput.select();
        const successful = document.execCommand('copy');
        
        if (successful) {
            showCopySuccess();
        } else {
            updateStatus('Copy failed. Please try selecting and copying manually.', 'error');
        }
    } catch (err) {
        console.error('Fallback copy failed:', err);
        updateStatus('Copy failed due to browser restrictions. Please select and copy manually.', 'error');
    } finally {
        document.body.removeChild(tempInput);
    }
}

// Show success notification after copying
function showCopySuccess() {
    updateStatus('Text copied to clipboard!', 'success');
    
    // Button animation
    copyButton.classList.add('success');
    copyButton.innerHTML = `
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
        </svg>
        Copied!
    `;
    
    // Restore button after delay
    setTimeout(() => {
        copyButton.classList.remove('success');
        copyButton.innerHTML = `
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                <path d="M9.5 1a.5.5 0 0 1 .5.5v1h4a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5h4v-1a.5.5 0 0 1 .5-.5z"/>
            </svg>
            Copy Selection
        `;
    }, 2000);
    
    // Show toast notification
    showToast('Copied to clipboard!', 'success');
}

// Show toast notification
function showToast(message, type = 'info') {
    // Remove any existing notifications
    const existingToast = document.querySelector('.copy-notification');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Create new notification
    const toast = document.createElement('div');
    toast.className = 'copy-notification';
    
    // Icon based on type
    let icon = '';
    if (type === 'success') {
        icon = `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
        </svg>`;
    } else {
        icon = `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
        </svg>`;
    }
    
    toast.innerHTML = `${icon} ${message}`;
    document.body.appendChild(toast);
    
    // Remove after animation completes
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 2500);
}

// Clear all text and reset
function handleClear() {
    textArea.value = '';
    clearSelection();
    updateOverlay();
    
    // Reset overlay position
    textOverlay.style.transform = 'translate(0px, 0px)';
    
    // Reset selection info
    selectionInfo.textContent = 'No selection';
    selectionInfo.classList.remove('active');
    
    updateStatus('Text cleared. Paste new text to continue.');
    
    // Focus the textarea
    textArea.focus();
}

// Load demo text
function loadDemoText() {
    textArea.value = demoText;
    updateOverlay();
    updateStatus('Demo text loaded. Drag to select columns.');
    
    // Reset selection info
    selectionInfo.textContent = 'No selection';
    selectionInfo.classList.remove('active');
    
    // Focus the textarea
    textArea.focus();
    
    // Add a subtle animation to show new content is loaded
    textArea.classList.add('pulse');
    setTimeout(() => {
        textArea.classList.remove('pulse');
    }, 500);
}

// Update the text overlay to match the textarea content
function updateOverlay() {
    const text = textArea.value;
    const lines = text.split('\n');
    
    textOverlay.innerHTML = ''; // Clear previous content
    
    lines.forEach((line, row) => {
        const lineDiv = document.createElement('div');
        
        if (line === '') {
            // Ensure empty lines still take up space
            lineDiv.innerHTML = '<span> </span>';
        } else {
            // Create spans for each character for selection highlighting
            lineDiv.innerHTML = line.split('').map((char, col) => {
                // Escape HTML characters
                const safeChar = char === ' ' ? ' ' : char
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                
                return `<span data-row="${row}" data-col="${col}">${safeChar}</span>`;
            }).join('');
        }
        
        textOverlay.appendChild(lineDiv);
    });
}

// Highlight selected columns
function highlightColumns() {
    const minRow = Math.min(selectionState.startY, selectionState.endY);
    const maxRow = Math.max(selectionState.startY, selectionState.endY);
    const minCol = Math.min(selectionState.startX, selectionState.endX);
    const maxCol = Math.max(selectionState.startX, selectionState.endX);
    
    const lines = textArea.value.split('\n');
    
    // Apply highlighting to each character in selection
    for (let r = minRow; r <= maxRow; r++) {
        if (r >= textOverlay.children.length) continue;
        
        const lineDiv = textOverlay.children[r];
        const spans = lineDiv.children;
        
        for (let c = minCol; c <= maxCol; c++) {
            if (c < spans.length) {
                spans[c].classList.add('selected-column');
                
                // Add animation effect on first highlight
                setTimeout(() => {
                    spans[c].classList.add('active');
                }, c * 5 + (r - minRow) * 20); // Stagger the animation
            }
        }
    }
}

// Clear all column selections
function clearSelection() {
    const selectedSpans = textOverlay.querySelectorAll('.selected-column');
    selectedSpans.forEach(span => {
        span.classList.remove('selected-column');
        span.classList.remove('active');
    });
}

// Calculate character position from mouse coordinates
function getPositionFromEvent(event) {
    const style = window.getComputedStyle(textArea);
    
    // Measure character dimensions
    const charWidth = measureCharWidth(style);
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
    
    // Get textarea coordinates and adjust for padding and scroll
    const rect = textArea.getBoundingClientRect();
    const paddingLeft = parseFloat(style.paddingLeft);
    const paddingTop = parseFloat(style.paddingTop);
    
    // Calculate position relative to content area
    const x = event.clientX - rect.left - paddingLeft + textArea.scrollLeft;
    const y = event.clientY - rect.top - paddingTop + textArea.scrollTop;
    
    // Convert to row/column
    const col = Math.max(0, Math.floor(x / charWidth));
    const row = Math.max(0, Math.floor(y / lineHeight));
    
    // Validate against actual text content
    const lines = textArea.value.split('\n');
    if (row >= lines.length && lines.length > 0) {
        // Beyond last line, clamp to last line
        return null;
    }
    
    return { row, col };
}

// Measure accurate character width for monospace font
function measureCharWidth(style) {
    // Create a temporary span to measure character width
    const tempSpan = document.createElement('span');
    tempSpan.style.font = style.font;
    tempSpan.style.position = 'absolute';
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.whiteSpace = 'pre';
    
    // Using a wide character ('M') for more accurate measurement
    tempSpan.textContent = 'M';
    document.body.appendChild(tempSpan);
    
    const width = tempSpan.getBoundingClientRect().width;
    document.body.removeChild(tempSpan);
    
    // Return measured width or fallback to font size estimate
    return width > 0 ? width : parseFloat(style.fontSize) * 0.6;
}

// Update the status bar with message and optional type
function updateStatus(message, type = 'info') {
    statusMessage.textContent = message;
    
    // Update status icon based on type
    const statusIcon = statusBar.querySelector('.status-icon');
    
    let iconSvg = '';
    switch (type) {
        case 'success':
            statusBar.style.color = 'var(--color-success)';
            iconSvg = `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
            </svg>`;
            break;
        case 'warning':
            statusBar.style.color = 'var(--color-warning)';
            iconSvg = `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
            </svg>`;
            break;
        case 'error':
            statusBar.style.color = 'var(--color-error)';
            iconSvg = `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
            </svg>`;
            break;
        case 'selecting':
            statusBar.style.color = 'var(--color-primary)';
            iconSvg = `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M3.5 2.5A.5.5 0 0 1 4 3h8a.5.5 0 0 1 0 1H4a.5.5 0 0 1-.5-.5zm0 5A.5.5 0 0 1 4 8h8a.5.5 0 0 1 0 1H4a.5.5 0 0 1-.5-.5zm0 5A.5.5 0 0 1 4 13h8a.5.5 0 0 1 0 1H4a.5.5 0 0 1-.5-.5z"/>
            </svg>`;
            break;
        default:
            statusBar.style.color = 'var(--color-text-secondary)';
            iconSvg = `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
            </svg>`;
    }
    
    statusIcon.innerHTML = iconSvg;
    
    // Add subtle animation
    statusBar.style.transform = 'translateY(2px)';
    setTimeout(() => {
        statusBar.style.transform = 'translateY(0)';
    }, 100);
}

// Initialize the application
init();