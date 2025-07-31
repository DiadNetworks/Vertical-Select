import { useState, useRef, useEffect } from 'react';
import { Copy, Trash2, Info, Search } from 'lucide-react';
import { cn } from './lib/utils';
import FindReplace from './components/FindReplace';

interface Position {
  row: number;
  col: number;
}

interface SelectionState {
  active: boolean;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  justFinishedDragging: boolean;
}

const DEMO_TEXT = `User ID,Name,Email,Sign-up Date,Status,Plan
1001,John Smith,john.smith@example.com,2023-01-15,Active,Pro
1002,Emily Johnson,emily.j@example.com,2023-02-20,Active,Basic
1003,Michael Brown,mbrown@example.com,2023-01-30,Inactive,Basic
1004,Sarah Davis,sarah.davis@example.com,2023-03-05,Active,Premium
1005,David Wilson,dwilson@example.com,2023-02-10,Active,Pro`;

export default function App() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('Ready. Paste text and drag to select columns.');
  const [selection, setSelection] = useState<SelectionState>({
    active: false,
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    justFinishedDragging: false,
  });
  const [selectionInfo, setSelectionInfo] = useState('No selection');
  const [showCopied, setShowCopied] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    updateOverlay();
  }, [text]);

  const updateOverlay = () => {
    if (!overlayRef.current) return;

    const lines = text.split('\n');
    overlayRef.current.innerHTML = '';

    lines.forEach((line, row) => {
      const lineDiv = document.createElement('div');
      if (line === '') {
        lineDiv.innerHTML = '<span> </span>';
      } else {
        lineDiv.innerHTML = line
          .split('')
          .map(
            (char, col) =>
              `<span data-row="${row}" data-col="${col}">${
                char === ' ' ? ' ' : char.replace(/</g, '&lt;').replace(/>/g, '&gt;')
              }</span>`
          )
          .join('');
      }
      overlayRef.current?.appendChild(lineDiv);
    });
  };

  const getPosition = (event: React.MouseEvent): Position | null => {
    if (!textAreaRef.current) return null;

    const style = window.getComputedStyle(textAreaRef.current);
    const charWidth = measureCharWidth(style);
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
    const rect = textAreaRef.current.getBoundingClientRect();
    const paddingLeft = parseFloat(style.paddingLeft);
    const paddingTop = parseFloat(style.paddingTop);

    const x = event.clientX - rect.left - paddingLeft + textAreaRef.current.scrollLeft;
    const y = event.clientY - rect.top - paddingTop + textAreaRef.current.scrollTop;

    const col = Math.max(0, Math.floor(x / charWidth));
    const row = Math.max(0, Math.floor(y / lineHeight));

    const lines = text.split('\n');
    if (row >= lines.length && lines.length > 0) {
      return null;
    }

    return { row, col };
  };

  const measureCharWidth = (style: CSSStyleDeclaration): number => {
    const tempSpan = document.createElement('span');
    tempSpan.style.font = style.font;
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.position = 'absolute';
    tempSpan.textContent = 'M';
    document.body.appendChild(tempSpan);
    const width = tempSpan.getBoundingClientRect().width;
    document.body.removeChild(tempSpan);
    return width > 0 ? width : parseFloat(style.fontSize) * 0.6;
  };

  const clearSelection = () => {
    const selectedSpans = overlayRef.current?.querySelectorAll('.selected-column');
    selectedSpans?.forEach(span => span.classList.remove('selected-column', 'active'));
  };

  const highlightColumns = () => {
    const { startX, startY, endX, endY } = selection;
    const minRow = Math.min(startY, endY);
    const maxRow = Math.max(startY, endY);
    const minCol = Math.min(startX, endX);
    const maxCol = Math.max(startX, endX);

    const lines = text.split('\n');

    for (let r = minRow; r <= maxRow; r++) {
      if (r >= lines.length) continue;

      const lineDiv = overlayRef.current?.children[r];
      if (!lineDiv) continue;

      const spans = lineDiv.children;
      for (let c = minCol; c <= maxCol; c++) {
        if (c < spans.length) {
          spans[c].classList.add('selected-column');
          setTimeout(() => {
            spans[c].classList.add('active');
          }, c * 5 + (r - minRow) * 20);
        }
      }
    }
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    const pos = getPosition(event);
    if (!pos) return;

    setSelection(prev => ({
      ...prev,
      startX: pos.col,
      startY: pos.row,
      endX: pos.col,
      endY: pos.row,
      active: true,
    }));

    if (!event.ctrlKey && !event.metaKey) {
      clearSelection();
    }

    setStatus('Selection started. Drag to select columns.');
    event.preventDefault();
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!selection.active) return;

    const pos = getPosition(event);
    if (!pos) return;

    setSelection(prev => ({
      ...prev,
      endX: pos.col,
      endY: pos.row,
    }));

    clearSelection();
    highlightColumns();
    updateSelectionInfo();
    event.preventDefault();
  };

  const handleMouseUp = (event: React.MouseEvent) => {
    if (!selection.active) return;

    const pos = getPosition(event);
    if (pos) {
      setSelection(prev => ({
        ...prev,
        endX: pos.col,
        endY: pos.row,
      }));
      clearSelection();
      highlightColumns();
    }

    finishSelection();
    event.preventDefault();
  };

  const finishSelection = () => {
    setSelection(prev => ({
      ...prev,
      active: false,
      justFinishedDragging: true,
    }));

    updateSelectionInfo();

    const hasSelection = overlayRef.current?.querySelector('.selected-column');
    if (hasSelection) {
      setStatus('Selection complete. Click "Copy Selection" to copy to clipboard.');
    }
  };

  const updateSelectionInfo = () => {
    const { startX, startY, endX, endY } = selection;
    const minCol = Math.min(startX, endX);
    const maxCol = Math.max(startX, endX);
    const minRow = Math.min(startY, endY);
    const maxRow = Math.max(startY, endY);

    const colCount = maxCol - minCol + 1;
    const rowCount = maxRow - minRow + 1;

    setSelectionInfo(
      `Columns ${minCol + 1}-${maxCol + 1} (${colCount} chars wide), Rows ${minRow + 1}-${maxRow + 1} (${rowCount} rows)`
    );
  };

  const handleCopy = async () => {
    if (!overlayRef.current?.querySelector('.selected-column')) {
      setStatus('No text selected. Please drag to select first.');
      return;
    }

    const selectedText = getSelectedText();
    if (selectedText.trim() === '') {
      setStatus('No valid text in selection to copy.');
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedText);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
      setStatus('Text copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      setStatus('Failed to copy. Please try selecting and copying manually.');
    }
  };

  const getSelectedText = () => {
    const { startX, startY, endX, endY } = selection;
    const minRow = Math.min(startY, endY);
    const maxRow = Math.max(startY, endY);
    const minCol = Math.min(startX, endX);
    const maxCol = Math.max(startX, endX);

    const lines = text.split('\n');
    const selectedLines = [];

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
      } else {
        selectedLines.push('');
      }
    }

    return selectedLines.join('\n');
  };

  const handleClear = () => {
    setText('');
    clearSelection();
    setSelectionInfo('No selection');
    setStatus('Text cleared. Paste new text to continue.');
    if (textAreaRef.current) {
      textAreaRef.current.focus();
    }
  };

  const loadDemoText = () => {
    setText(DEMO_TEXT);
    setStatus('Demo text loaded. Drag to select columns.');
    setSelectionInfo('No selection');
    if (textAreaRef.current) {
      textAreaRef.current.focus();
    }
  };

  const handleScroll = () => {
    if (textAreaRef.current && overlayRef.current) {
      overlayRef.current.style.transform = `translate(-${textAreaRef.current.scrollLeft}px, -${textAreaRef.current.scrollTop}px)`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-4xl flex flex-col h-[calc(100vh-2rem)] md:h-[calc(100vh-3rem)]">
        <header className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 md:text-3xl">
            Vertical Text Selector
          </h1>
          <p className="mt-2 text-gray-600">Select columns of text with precision</p>
        </header>

        <div className="mb-6 overflow-hidden rounded-xl bg-white shadow-lg flex-1 flex flex-col">
          <div className="flex justify-end border-b border-gray-100 p-3">
            <button
              onClick={() => setShowFindReplace(true)}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 mr-3"
            >
              <Search size={16} />
              Find & Replace
            </button>
            <button
              onClick={loadDemoText}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              <Info size={16} />
              Demo Text
            </button>
          </div>

          <div className="relative flex-1 min-h-0">
            <textarea
              ref={textAreaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onScroll={handleScroll}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className="absolute inset-0 h-full w-full resize-none bg-transparent p-4 font-mono text-sm text-transparent caret-blue-500 outline-none"
              spellCheck={false}
              placeholder="Paste your text here then click and drag to select columns..."
            />
            <div
              ref={overlayRef}
              className="absolute inset-0 whitespace-pre font-mono text-sm leading-[1.5] p-4 pointer-events-none"
            />
          </div>

          <div className="border-t border-gray-100 p-3">
            <div
              className={cn(
                'inline-flex items-center rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-600',
                selectionInfo !== 'No selection' && 'bg-blue-100 text-blue-700'
              )}
            >
              {selectionInfo}
            </div>
          </div>
        </div>

        <div className="mb-6 flex justify-end gap-3">
          <button
            onClick={handleClear}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:text-red-600 hover:border-red-200 active:scale-95"
          >
            <Trash2 size={16} />
            Clear
          </button>
          <button
            onClick={handleCopy}
            className={cn(
              'flex items-center gap-2 rounded-lg border border-transparent bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-600 active:scale-95',
              showCopied && 'bg-green-500 hover:bg-green-600'
            )}
          >
            <Copy size={16} />
            {showCopied ? 'Copied!' : 'Copy Selection'}
          </button>
        </div>

        <div className="flex items-center gap-3 rounded-lg bg-white p-4 text-sm text-gray-600 shadow">
          <Info size={16} className="text-blue-500" />
          <p>{status}</p>
        </div>

        <FindReplace
          text={text}
          onTextChange={setText}
          isOpen={showFindReplace}
          onClose={() => setShowFindReplace(false)}
        />
      </div>
    </div>
  );
}