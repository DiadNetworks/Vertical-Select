import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Search, 
  Replace, 
  X, 
  Settings, 
  Eye, 
  History, 
  Save, 
  Upload, 
  ChevronDown,
  ChevronUp,
  Target,
  Layers,
  BarChart3,
  Lightbulb,
  Undo2,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';
import { cn } from '../lib/utils';

interface FindReplaceProps {
  text: string;
  onTextChange: (newText: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface ReplaceOperation {
  id: string;
  find: string;
  replace: string;
  timestamp: Date;
  matchCount: number;
  options: SearchOptions;
}

interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
  replaceFirst: boolean;
  smartCase: boolean;
  lineRange?: { start: number; end: number };
  contextFilter?: string;
}

interface Match {
  index: number;
  length: number;
  text: string;
  lineNumber: number;
  context: string;
}

interface SavedPattern {
  id: string;
  name: string;
  find: string;
  replace: string;
  options: SearchOptions;
  description?: string;
}

export default function FindReplace({ text, onTextChange, isOpen, onClose }: FindReplaceProps) {
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [options, setOptions] = useState<SearchOptions>({
    caseSensitive: false,
    wholeWord: false,
    useRegex: false,
    replaceFirst: false,
    smartCase: true,
  });
  
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [history, setHistory] = useState<ReplaceOperation[]>([]);
  const [savedPatterns, setSavedPatterns] = useState<SavedPattern[]>([]);
  const [batchReplacements, setBatchReplacements] = useState('');
  const [isInteractiveMode, setIsInteractiveMode] = useState(false);
  const [selectedMatches, setSelectedMatches] = useState<Set<number>>(new Set());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [lineRangeStart, setLineRangeStart] = useState('');
  const [lineRangeEnd, setLineRangeEnd] = useState('');
  const [contextFilter, setContextFilter] = useState('');
  const [patternName, setPatternName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const findInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLTextAreaElement>(null);

  // Focus find input when opened
  useEffect(() => {
    if (isOpen && findInputRef.current) {
      findInputRef.current.focus();
    }
  }, [isOpen]);

  // Find matches whenever search parameters change
  useEffect(() => {
    if (findText) {
      findMatches();
    } else {
      setMatches([]);
      setCurrentMatchIndex(-1);
    }
  }, [findText, text, options]);

  // Generate preview when in preview mode
  useEffect(() => {
    if (isPreviewMode && findText && replaceText) {
      generatePreview();
    }
  }, [isPreviewMode, findText, replaceText, options, selectedMatches]);

  const findMatches = useCallback(() => {
    if (!findText) {
      setMatches([]);
      return;
    }

    const lines = text.split('\n');
    const foundMatches: Match[] = [];
    let searchText = text;
    let pattern: RegExp;

    try {
      if (options.useRegex) {
        const flags = options.caseSensitive ? 'g' : 'gi';
        pattern = new RegExp(findText, flags);
      } else {
        let escapedFind = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (options.wholeWord) {
          escapedFind = `\\b${escapedFind}\\b`;
        }
        const flags = options.caseSensitive ? 'g' : 'gi';
        pattern = new RegExp(escapedFind, flags);
      }

      let match;
      while ((match = pattern.exec(searchText)) !== null) {
        const lineNumber = searchText.substring(0, match.index).split('\n').length;
        const lineStart = searchText.lastIndexOf('\n', match.index) + 1;
        const lineEnd = searchText.indexOf('\n', match.index);
        const context = searchText.substring(
          Math.max(0, lineStart - 50),
          lineEnd === -1 ? Math.min(searchText.length, match.index + match[0].length + 50) : Math.min(lineEnd + 50, searchText.length)
        );

        // Apply line range filter if specified
        if (options.lineRange) {
          if (lineNumber < options.lineRange.start || lineNumber > options.lineRange.end) {
            continue;
          }
        }

        // Apply context filter if specified
        if (options.contextFilter) {
          const contextPattern = new RegExp(options.contextFilter, 'i');
          if (!contextPattern.test(context)) {
            continue;
          }
        }

        foundMatches.push({
          index: match.index,
          length: match[0].length,
          text: match[0],
          lineNumber,
          context: context.trim()
        });

        // Prevent infinite loop with zero-length matches
        if (match[0].length === 0) {
          pattern.lastIndex++;
        }
      }
    } catch (error) {
      console.error('Invalid regex pattern:', error);
      setMatches([]);
      return;
    }

    setMatches(foundMatches);
    setCurrentMatchIndex(foundMatches.length > 0 ? 0 : -1);
  }, [findText, text, options]);

  const generatePreview = useCallback(() => {
    if (!findText || matches.length === 0) {
      setPreviewText(text);
      return;
    }

    let result = text;
    const matchesToReplace = isInteractiveMode 
      ? matches.filter((_, index) => selectedMatches.has(index))
      : matches;

    if (options.replaceFirst && matchesToReplace.length > 0) {
      const match = matchesToReplace[0];
      const replacement = options.smartCase ? preserveCase(match.text, replaceText) : replaceText;
      result = text.substring(0, match.index) + replacement + text.substring(match.index + match.length);
    } else {
      // Replace from end to start to maintain indices
      const sortedMatches = [...matchesToReplace].sort((a, b) => b.index - a.index);
      for (const match of sortedMatches) {
        const replacement = options.smartCase ? preserveCase(match.text, replaceText) : replaceText;
        result = result.substring(0, match.index) + replacement + result.substring(match.index + match.length);
      }
    }

    setPreviewText(result);
  }, [findText, replaceText, matches, options, selectedMatches, isInteractiveMode, text]);

  const preserveCase = (original: string, replacement: string): string => {
    if (!options.smartCase) return replacement;
    
    if (original === original.toUpperCase()) {
      return replacement.toUpperCase();
    } else if (original === original.toLowerCase()) {
      return replacement.toLowerCase();
    } else if (original[0] === original[0].toUpperCase()) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
    }
    return replacement;
  };

  const performReplace = () => {
    if (!findText || matches.length === 0) return;

    const matchesToReplace = isInteractiveMode 
      ? matches.filter((_, index) => selectedMatches.has(index))
      : matches;

    if (matchesToReplace.length === 0) return;

    let result = text;
    
    if (options.replaceFirst && matchesToReplace.length > 0) {
      const match = matchesToReplace[0];
      const replacement = options.smartCase ? preserveCase(match.text, replaceText) : replaceText;
      result = text.substring(0, match.index) + replacement + text.substring(match.index + match.length);
    } else {
      // Replace from end to start to maintain indices
      const sortedMatches = [...matchesToReplace].sort((a, b) => b.index - a.index);
      for (const match of sortedMatches) {
        const replacement = options.smartCase ? preserveCase(match.text, replaceText) : replaceText;
        result = result.substring(0, match.index) + replacement + result.substring(match.index + match.length);
      }
    }

    // Add to history
    const operation: ReplaceOperation = {
      id: Date.now().toString(),
      find: findText,
      replace: replaceText,
      timestamp: new Date(),
      matchCount: matchesToReplace.length,
      options: { ...options }
    };
    setHistory(prev => [operation, ...prev.slice(0, 19)]); // Keep last 20 operations

    onTextChange(result);
    setSelectedMatches(new Set());
  };

  const performBatchReplace = () => {
    if (!batchReplacements.trim()) return;

    let result = text;
    const operations: ReplaceOperation[] = [];

    const lines = batchReplacements.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const parts = line.split('->').map(part => part.trim());
      if (parts.length !== 2) continue;

      const [find, replace] = parts;
      if (!find) continue;

      // Apply the replacement
      const pattern = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const matches = (result.match(pattern) || []).length;
      result = result.replace(pattern, replace);

      operations.push({
        id: Date.now().toString() + Math.random(),
        find,
        replace,
        timestamp: new Date(),
        matchCount: matches,
        options: { ...options }
      });
    }

    setHistory(prev => [...operations, ...prev.slice(0, 20 - operations.length)]);
    onTextChange(result);
    setBatchReplacements('');
  };

  const savePattern = () => {
    if (!patternName.trim() || !findText) return;

    const pattern: SavedPattern = {
      id: Date.now().toString(),
      name: patternName,
      find: findText,
      replace: replaceText,
      options: { ...options },
      description: `${matches.length} matches found`
    };

    setSavedPatterns(prev => [pattern, ...prev]);
    setPatternName('');
    setShowSaveDialog(false);
  };

  const loadPattern = (pattern: SavedPattern) => {
    setFindText(pattern.find);
    setReplaceText(pattern.replace);
    setOptions(pattern.options);
  };

  const toggleMatchSelection = (index: number) => {
    setSelectedMatches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const generateSuggestions = () => {
    const suggestions = [];
    
    // Common replacements
    if (findText.toLowerCase().includes('color')) {
      suggestions.push('colour');
    }
    if (findText.toLowerCase().includes('center')) {
      suggestions.push('centre');
    }
    
    // Smart suggestions based on context
    const words = text.toLowerCase().split(/\s+/);
    const wordFreq = words.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Suggest common words as replacements
    const commonWords = Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);

    return [...suggestions, ...commonWords].filter(s => s !== findText.toLowerCase());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Find & Replace</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Main Search Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Find
              </label>
              <div className="relative">
                <input
                  ref={findInputRef}
                  type="text"
                  value={findText}
                  onChange={(e) => setFindText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter text to find..."
                />
                <button
                  onClick={() => setIsInteractiveMode(!isInteractiveMode)}
                  className={cn(
                    "absolute right-2 top-2 p-1 rounded transition-colors",
                    isInteractiveMode ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100"
                  )}
                  title="Interactive selection mode"
                >
                  <Target size={16} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Replace with
              </label>
              <textarea
                ref={replaceInputRef}
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={2}
                placeholder="Enter replacement text..."
              />
            </div>
          </div>

          {/* Options */}
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.caseSensitive}
                onChange={(e) => setOptions(prev => ({ ...prev, caseSensitive: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Case sensitive</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.wholeWord}
                onChange={(e) => setOptions(prev => ({ ...prev, wholeWord: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Whole word</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.useRegex}
                onChange={(e) => setOptions(prev => ({ ...prev, useRegex: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Regex</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.replaceFirst}
                onChange={(e) => setOptions(prev => ({ ...prev, replaceFirst: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Replace first only</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.smartCase}
                onChange={(e) => setOptions(prev => ({ ...prev, smartCase: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Smart case</span>
            </label>
          </div>

          {/* Match Count and Navigation */}
          {matches.length > 0 && (
            <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg">
              <span className="text-sm text-blue-700">
                {matches.length} match{matches.length !== 1 ? 'es' : ''} found
                {isInteractiveMode && selectedMatches.size > 0 && (
                  <span className="ml-2">({selectedMatches.size} selected)</span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentMatchIndex(Math.max(0, currentMatchIndex - 1))}
                  disabled={currentMatchIndex <= 0}
                  className="p-1 hover:bg-blue-100 rounded disabled:opacity-50"
                >
                  <ChevronUp size={16} />
                </button>
                <span className="text-sm text-blue-700">
                  {currentMatchIndex + 1} of {matches.length}
                </span>
                <button
                  onClick={() => setCurrentMatchIndex(Math.min(matches.length - 1, currentMatchIndex + 1))}
                  disabled={currentMatchIndex >= matches.length - 1}
                  className="p-1 hover:bg-blue-100 rounded disabled:opacity-50"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Advanced Options Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
          >
            <Settings size={16} />
            Advanced Options
            {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {/* Advanced Options Panel */}
          {showAdvanced && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Line Range (optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={lineRangeStart}
                      onChange={(e) => {
                        setLineRangeStart(e.target.value);
                        if (e.target.value && lineRangeEnd) {
                          setOptions(prev => ({
                            ...prev,
                            lineRange: { start: parseInt(e.target.value), end: parseInt(lineRangeEnd) }
                          }));
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Start"
                    />
                    <input
                      type="number"
                      value={lineRangeEnd}
                      onChange={(e) => {
                        setLineRangeEnd(e.target.value);
                        if (lineRangeStart && e.target.value) {
                          setOptions(prev => ({
                            ...prev,
                            lineRange: { start: parseInt(lineRangeStart), end: parseInt(e.target.value) }
                          }));
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="End"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Context Filter (optional)
                  </label>
                  <input
                    type="text"
                    value={contextFilter}
                    onChange={(e) => {
                      setContextFilter(e.target.value);
                      setOptions(prev => ({
                        ...prev,
                        contextFilter: e.target.value || undefined
                      }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="Only in lines containing..."
                  />
                </div>
              </div>

              {/* Batch Replacements */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Batch Replacements (one per line: find -> replace)
                </label>
                <textarea
                  value={batchReplacements}
                  onChange={(e) => setBatchReplacements(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  rows={3}
                  placeholder="old text -> new text&#10;another find -> another replace"
                />
                <button
                  onClick={performBatchReplace}
                  disabled={!batchReplacements.trim()}
                  className="mt-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 text-sm"
                >
                  Apply Batch Replacements
                </button>
              </div>
            </div>
          )}

          {/* Interactive Match Selection */}
          {isInteractiveMode && matches.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">Select matches to replace:</h3>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {matches.map((match, index) => (
                  <label key={index} className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded">
                    <input
                      type="checkbox"
                      checked={selectedMatches.has(index)}
                      onChange={() => toggleMatchSelection(index)}
                      className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1 text-sm">
                      <div className="font-mono bg-yellow-100 px-1 rounded">
                        {match.text}
                      </div>
                      <div className="text-gray-500 text-xs mt-1">
                        Line {match.lineNumber}: {match.context}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                isPreviewMode 
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              <Eye size={16} />
              {isPreviewMode ? 'Exit Preview' : 'Preview'}
            </button>

            <button
              onClick={performReplace}
              disabled={!findText || matches.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm font-medium"
            >
              <Replace size={16} />
              Replace {isInteractiveMode && selectedMatches.size > 0 ? `(${selectedMatches.size})` : `All (${matches.length})`}
            </button>

            <button
              onClick={() => setShowSaveDialog(true)}
              disabled={!findText}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 text-sm font-medium"
            >
              <Save size={16} />
              Save Pattern
            </button>

            <button
              onClick={() => setShowStats(!showStats)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm font-medium"
            >
              <BarChart3 size={16} />
              Stats
            </button>

            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium"
            >
              <Lightbulb size={16} />
              Suggestions
            </button>
          </div>

          {/* Preview Panel */}
          {isPreviewMode && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">Preview:</h3>
              <div className="max-h-40 overflow-y-auto p-3 bg-gray-50 rounded-lg border">
                <pre className="text-sm font-mono whitespace-pre-wrap">{previewText}</pre>
              </div>
            </div>
          )}

          {/* Statistics Panel */}
          {showStats && (
            <div className="p-4 bg-purple-50 rounded-lg">
              <h3 className="text-sm font-medium text-purple-700 mb-3">Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-purple-600 font-medium">Total Matches</div>
                  <div className="text-2xl font-bold text-purple-800">{matches.length}</div>
                </div>
                <div>
                  <div className="text-purple-600 font-medium">Selected</div>
                  <div className="text-2xl font-bold text-purple-800">{selectedMatches.size}</div>
                </div>
                <div>
                  <div className="text-purple-600 font-medium">Operations</div>
                  <div className="text-2xl font-bold text-purple-800">{history.length}</div>
                </div>
                <div>
                  <div className="text-purple-600 font-medium">Patterns</div>
                  <div className="text-2xl font-bold text-purple-800">{savedPatterns.length}</div>
                </div>
              </div>
            </div>
          )}

          {/* Suggestions Panel */}
          {showSuggestions && (
            <div className="p-4 bg-orange-50 rounded-lg">
              <h3 className="text-sm font-medium text-orange-700 mb-3">Smart Suggestions</h3>
              <div className="flex flex-wrap gap-2">
                {generateSuggestions().map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => setReplaceText(suggestion)}
                    className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm hover:bg-orange-200"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* History Panel */}
          {history.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">Recent Operations</h3>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {history.slice(0, 5).map((op) => (
                  <div key={op.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                    <div className="flex-1">
                      <span className="font-mono bg-red-100 px-1 rounded">{op.find}</span>
                      <span className="mx-2">→</span>
                      <span className="font-mono bg-green-100 px-1 rounded">{op.replace}</span>
                      <span className="ml-2 text-gray-500">({op.matchCount} matches)</span>
                    </div>
                    <button
                      onClick={() => {
                        setFindText(op.find);
                        setReplaceText(op.replace);
                        setOptions(op.options);
                      }}
                      className="p-1 hover:bg-gray-200 rounded"
                      title="Reuse this pattern"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Saved Patterns */}
          {savedPatterns.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">Saved Patterns</h3>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {savedPatterns.map((pattern) => (
                  <div key={pattern.id} className="flex items-center justify-between p-2 bg-green-50 rounded text-sm">
                    <div className="flex-1">
                      <div className="font-medium text-green-800">{pattern.name}</div>
                      <div className="text-green-600">
                        <span className="font-mono">{pattern.find}</span>
                        <span className="mx-2">→</span>
                        <span className="font-mono">{pattern.replace}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => loadPattern(pattern)}
                      className="p-1 hover:bg-green-200 rounded"
                      title="Load this pattern"
                    >
                      <Upload size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Save Pattern Dialog */}
        {showSaveDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Save Pattern</h3>
              <input
                type="text"
                value={patternName}
                onChange={(e) => setPatternName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
                placeholder="Pattern name..."
                autoFocus
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={savePattern}
                  disabled={!patternName.trim()}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}