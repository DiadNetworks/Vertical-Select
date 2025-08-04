import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, Replace, Settings, History, Save, Load, Undo, Redo, X, ChevronDown, ChevronUp, Target, FileText, BarChart3, Lightbulb, BookOpen } from "lucide-react";

interface FindReplaceProps {
  text: string;
  onReplace: (newText: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

interface ReplacementHistory {
  id: string;
  timestamp: Date;
  findText: string;
  replaceText: string;
  options: FindReplaceOptions;
  matchCount: number;
}

interface FindReplaceOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
  replaceFirstOnly: boolean;
  preserveCase: boolean;
  lineRange: { start: number; end: number } | null;
  contextAware: boolean;
  conditionalReplace: boolean;
}

interface Match {
  start: number;
  end: number;
  text: string;
  line: number;
  context: string;
}

interface BatchReplacement {
  find: string;
  replace: string;
  enabled: boolean;
}

const FindReplace: React.FC<FindReplaceProps> = ({ text, onReplace, onClose, isOpen }) => {
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [options, setOptions] = useState<FindReplaceOptions>({
    caseSensitive: false,
    wholeWord: false,
    useRegex: false,
    replaceFirstOnly: false,
    preserveCase: false,
    lineRange: null,
    contextAware: false,
    conditionalReplace: false,
  });
  
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [history, setHistory] = useState<ReplacementHistory[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [batchReplacements, setBatchReplacements] = useState<BatchReplacement[]>([
    { find: "", replace: "", enabled: true }
  ]);
  const [savedPatterns, setSavedPatterns] = useState<Array<{name: string, pattern: BatchReplacement[]}>>([]);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewText, setPreviewText] = useState("");
  const [statistics, setStatistics] = useState({
    totalReplacements: 0,
    totalMatches: 0,
    patternsUsed: 0,
  });

  const findInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Find all matches
  const findMatches = useCallback(() => {
    if (!findText) {
      setMatches([]);
      return;
    }

    const lines = text.split("\n");
    const newMatches: Match[] = [];
    let globalIndex = 0;

    lines.forEach((line, lineIndex) => {
      if (options.lineRange && (lineIndex < options.lineRange.start || lineIndex > options.lineRange.end)) {
        globalIndex += line.length + 1;
        return;
      }

      let searchText = line;
      let searchPattern = findText;

      if (!options.caseSensitive) {
        searchText = line.toLowerCase();
        searchPattern = findText.toLowerCase();
      }

      if (options.useRegex) {
        try {
          const flags = options.caseSensitive ? "g" : "gi";
          const regex = new RegExp(searchPattern, flags);
          let match;
          
          while ((match = regex.exec(line)) !== null) {
            if (options.wholeWord) {
              const before = line[match.index - 1] || "";
              const after = line[match.index + match[0].length] || "";
              if (/[a-zA-Z0-9]/.test(before) || /[a-zA-Z0-9]/.test(after)) {
                continue;
              }
            }

            const contextStart = Math.max(0, match.index - 20);
            const contextEnd = Math.min(line.length, match.index + match[0].length + 20);
            const context = line.slice(contextStart, contextEnd);

            newMatches.push({
              start: globalIndex + match.index,
              end: globalIndex + match.index + match[0].length,
              text: match[0],
              line: lineIndex + 1,
              context: contextStart > 0 ? "..." + context : context + (contextEnd < line.length ? "..." : ""),
            });
          }
        } catch (error) {
          console.error("Invalid regex pattern:", error);
        }
      } else {
        let index = 0;
        while ((index = searchText.indexOf(searchPattern, index)) !== -1) {
          if (options.wholeWord) {
            const before = line[index - 1] || "";
            const after = line[index + searchPattern.length] || "";
            if (/[a-zA-Z0-9]/.test(before) || /[a-zA-Z0-9]/.test(after)) {
              index += 1;
              continue;
            }
          }

          const contextStart = Math.max(0, index - 20);
          const contextEnd = Math.min(line.length, index + searchPattern.length + 20);
          const context = line.slice(contextStart, contextEnd);

          newMatches.push({
            start: globalIndex + index,
            end: globalIndex + index + searchPattern.length,
            text: line.slice(index, index + searchPattern.length),
            line: lineIndex + 1,
            context: contextStart > 0 ? "..." + context : context + (contextEnd < line.length ? "..." : ""),
          });

          index += 1;
        }
      }

      globalIndex += line.length + 1;
    });

    setMatches(newMatches);
    setCurrentMatchIndex(newMatches.length > 0 ? 0 : -1);
  }, [findText, text, options]);

  // Replace text with smart case preservation
  const replaceWithCasePreservation = (original: string, replacement: string): string => {
    if (!options.preserveCase) return replacement;

    if (original === original.toUpperCase()) {
      return replacement.toUpperCase();
    } else if (original === original.toLowerCase()) {
      return replacement.toLowerCase();
    } else if (original[0] === original[0]?.toUpperCase() && original.slice(1) === original.slice(1).toLowerCase()) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
    }

    return replacement;
  };

  // Perform replacement
  const performReplace = (replaceAll: boolean = false) => {
    if (matches.length === 0) return;

    let newText = text;
    let replacements = 0;
    const replacementsToMake = replaceAll ? matches : [matches[currentMatchIndex]];

    // Sort in reverse order to maintain indices
    const sortedReplacements = [...replacementsToMake].sort((a, b) => b.start - a.start);

    sortedReplacements.forEach(match => {
      const before = newText.slice(0, match.start);
      const after = newText.slice(match.end);
      const replacement = replaceWithCasePreservation(match.text, replaceText);
      
      newText = before + replacement + after;
      replacements++;
    });

    // Update statistics
    setStatistics(prev => ({
      ...prev,
      totalReplacements: prev.totalReplacements + replacements,
      totalMatches: prev.totalMatches + matches.length,
    }));

    // Add to history
    const historyEntry: ReplacementHistory = {
      id: Date.now().toString(),
      timestamp: new Date(),
      findText,
      replaceText,
      options: { ...options },
      matchCount: matches.length,
    };
    setHistory(prev => [historyEntry, ...prev.slice(0, 9)]);

    onReplace(newText);
    setMatches([]);
    setCurrentMatchIndex(-1);
  };

  // Batch replacements
  const performBatchReplace = () => {
    let newText = text;
    let totalReplacements = 0;

    batchReplacements
      .filter(item => item.enabled && item.find)
      .forEach(item => {
        const regex = new RegExp(
          options.wholeWord ? `\\b${item.find}\\b` : item.find,
          options.caseSensitive ? "g" : "gi"
        );
        const matches = newText.match(regex);
        if (matches) {
          newText = newText.replace(regex, item.replace);
          totalReplacements += matches.length;
        }
      });

    setStatistics(prev => ({
      ...prev,
      totalReplacements: prev.totalReplacements + totalReplacements,
      patternsUsed: prev.patternsUsed + 1,
    }));

    onReplace(newText);
  };

  // Preview replacements
  const generatePreview = () => {
    if (matches.length === 0) {
      setPreviewText(text);
      return;
    }

    let preview = text;
    const sortedMatches = [...matches].sort((a, b) => b.start - a.start);

    sortedMatches.forEach(match => {
      const before = preview.slice(0, match.start);
      const after = preview.slice(match.end);
      const replacement = replaceWithCasePreservation(match.text, replaceText);
      
      preview = before + `<mark class="bg-yellow-200">${replacement}</mark>` + after;
    });

    setPreviewText(preview);
  };

  // Auto-suggestions based on text content
  const generateSuggestions = () => {
    const words = text.toLowerCase().match(/\\b\\w+\\b/g) || [];
    const wordCount = words.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const suggestions = Object.entries(wordCount)
      .filter(([word, count]) => count > 1 && word.length > 3)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);

    return suggestions;
  };

  // Effects
  useEffect(() => {
    if (isOpen && findInputRef.current) {
      findInputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    findMatches();
  }, [findMatches]);

  useEffect(() => {
    if (previewMode) {
      generatePreview();
    }
  }, [previewMode, matches, replaceText]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <Search className="text-blue-500" size={20} />
            <h2 className="text-lg font-semibold text-gray-800">Find & Replace</h2>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>{matches.length} matches found</span>
              {currentMatchIndex >= 0 && (
                <span className="text-blue-600">
                  ({currentMatchIndex + 1} of {matches.length})
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex h-[calc(90vh-80px)]">
          {/* Main Panel */}
          <div className="flex-1 p-4 overflow-y-auto">
            {/* Basic Find/Replace */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                    {findText && (
                      <button
                        onClick={() => setFindText("")}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Replace with
                  </label>
                  <input
                    ref={replaceInputRef}
                    type="text"
                    value={replaceText}
                    onChange={(e) => setReplaceText(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter replacement text..."
                  />
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => performReplace(false)}
                  disabled={matches.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Replace size={16} />
                  Replace
                </button>
                <button
                  onClick={() => performReplace(true)}
                  disabled={matches.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Replace size={16} />
                  Replace All
                </button>
                <button
                  onClick={() => setPreviewMode(!previewMode)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                >
                  <FileText size={16} />
                  {previewMode ? "Hide Preview" : "Preview"}
                </button>
              </div>

              {/* Options Toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
              >
                <Settings size={16} />
                Advanced Options
                {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {/* Advanced Options */}
              {showAdvanced && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="space-y-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={options.caseSensitive}
                        onChange={(e) => setOptions(prev => ({ ...prev, caseSensitive: e.target.checked }))}
                        className="rounded"
                      />
                      <span className="text-sm">Case sensitive</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={options.wholeWord}
                        onChange={(e) => setOptions(prev => ({ ...prev, wholeWord: e.target.checked }))}
                        className="rounded"
                      />
                      <span className="text-sm">Whole word only</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={options.useRegex}
                        onChange={(e) => setOptions(prev => ({ ...prev, useRegex: e.target.checked }))}
                        className="rounded"
                      />
                      <span className="text-sm">Use regular expressions</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={options.replaceFirstOnly}
                        onChange={(e) => setOptions(prev => ({ ...prev, replaceFirstOnly: e.target.checked }))}
                        className="rounded"
                      />
                      <span className="text-sm">Replace first only</span>
                    </label>
                  </div>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={options.preserveCase}
                        onChange={(e) => setOptions(prev => ({ ...prev, preserveCase: e.target.checked }))}
                        className="rounded"
                      />
                      <span className="text-sm">Preserve case</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={options.contextAware}
                        onChange={(e) => setOptions(prev => ({ ...prev, contextAware: e.target.checked }))}
                        className="rounded"
                      />
                      <span className="text-sm">Context aware</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={options.conditionalReplace}
                        onChange={(e) => setOptions(prev => ({ ...prev, conditionalReplace: e.target.checked }))}
                        className="rounded"
                      />
                      <span className="text-sm">Conditional replace</span>
                    </label>
                    <button
                      onClick={() => setShowBatch(!showBatch)}
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                    >
                      <Target size={16} />
                      Batch Replacements
                    </button>
                  </div>
                </div>
              )}

              {/* Batch Replacements */}
              {showBatch && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-medium text-gray-800 mb-3">Batch Replacements</h3>
                  <div className="space-y-2">
                    {batchReplacements.map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={(e) => {
                            const newBatch = [...batchReplacements];
                            newBatch[index].enabled = e.target.checked;
                            setBatchReplacements(newBatch);
                          }}
                          className="rounded"
                        />
                        <input
                          type="text"
                          value={item.find}
                          onChange={(e) => {
                            const newBatch = [...batchReplacements];
                            newBatch[index].find = e.target.value;
                            setBatchReplacements(newBatch);
                          }}
                          placeholder="Find"
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <span className="text-gray-500">→</span>
                        <input
                          type="text"
                          value={item.replace}
                          onChange={(e) => {
                            const newBatch = [...batchReplacements];
                            newBatch[index].replace = e.target.value;
                            setBatchReplacements(newBatch);
                          }}
                          placeholder="Replace"
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <button
                          onClick={() => {
                            setBatchReplacements(batchReplacements.filter((_, i) => i !== index));
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setBatchReplacements([...batchReplacements, { find: "", replace: "", enabled: true }])}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      + Add replacement
                    </button>
                    <button
                      onClick={performBatchReplace}
                      className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                    >
                      <Target size={16} />
                      Apply Batch
                    </button>
                  </div>
                </div>
              )}

              {/* Auto-suggestions */}
              {findText.length === 0 && (
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb size={16} className="text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-800">Suggestions</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {generateSuggestions().map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => setFindText(suggestion)}
                        className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm hover:bg-yellow-200"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview */}
              {previewMode && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-800 mb-2">Preview</h3>
                  <div 
                    className="p-3 bg-white border rounded-lg max-h-40 overflow-y-auto text-sm"
                    dangerouslySetInnerHTML={{ __html: previewText }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-80 border-l bg-gray-50 p-4 overflow-y-auto">
            {/* Matches List */}
            <div className="mb-6">
              <h3 className="font-medium text-gray-800 mb-3">Matches</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {matches.map((match, index) => (
                  <div
                    key={index}
                    onClick={() => setCurrentMatchIndex(index)}
                    className={`p-2 rounded cursor-pointer text-sm ${
                      index === currentMatchIndex ? "bg-blue-100 border border-blue-300" : "bg-white hover:bg-gray-100"
                    }`}
                  >
                    <div className="font-medium">Line {match.line}</div>
                    <div className="text-gray-600 truncate">{match.context}</div>
                  </div>
                ))}
                {matches.length === 0 && (
                  <div className="text-gray-500 text-sm">No matches found</div>
                )}
              </div>
            </div>

            {/* History */}
            <div className="mb-6">
              <h3 className="font-medium text-gray-800 mb-3">Recent Operations</h3>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {history.slice(0, 5).map((item) => (
                  <div key={item.id} className="p-2 bg-white rounded text-sm">
                    <div className="font-medium">{item.findText} → {item.replaceText}</div>
                    <div className="text-gray-500 text-xs">
                      {item.matchCount} matches • {item.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                ))}
                {history.length === 0 && (
                  <div className="text-gray-500 text-sm">No recent operations</div>
                )}
              </div>
            </div>

            {/* Statistics */}
            <div className="mb-6">
              <h3 className="font-medium text-gray-800 mb-3">Statistics</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total Replacements:</span>
                  <span className="font-medium">{statistics.totalReplacements}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Matches:</span>
                  <span className="font-medium">{statistics.totalMatches}</span>
                </div>
                <div className="flex justify-between">
                  <span>Patterns Used:</span>
                  <span className="font-medium">{statistics.patternsUsed}</span>
                </div>
              </div>
            </div>

            {/* Saved Patterns */}
            <div>
              <h3 className="font-medium text-gray-800 mb-3">Saved Patterns</h3>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    const name = prompt("Enter pattern name:");
                    if (name) {
                      setSavedPatterns([...savedPatterns, { name, pattern: batchReplacements }]);
                    }
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                >
                  <Save size={16} />
                  Save Current Pattern
                </button>
                {savedPatterns.map((pattern, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-white rounded">
                    <span className="text-sm">{pattern.name}</span>
                    <button
                      onClick={() => setBatchReplacements(pattern.pattern)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Load size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FindReplace;
