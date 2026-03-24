import CodeMirror from '@uiw/react-codemirror';
import { githubLight } from '@uiw/codemirror-theme-github';
import { type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { indentWithTab } from '@codemirror/commands';
import { json, jsonLanguage, jsonParseLinter } from '@codemirror/lang-json';
import { linter } from '@codemirror/lint';
import { keymap, lineNumbers, placeholder as cmPlaceholder } from '@codemirror/view';
import { AlignLeft, Check, Hash, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

export interface CodeEditorInputProps {
  value: string;
  onChange: (value: string) => void;
  language?: 'json';
  minRows?: number;
  maxRows?: number;
  formatOnPaste?: boolean;
  className?: string;
  id?: string;
  placeholder?: string;
  actionType?: string;
}

const LINE_HEIGHT_PX = 24;
const DEFAULT_MIN_ROWS = 5;
const DEFAULT_MAX_ROWS = 20;

const FALLBACK_CLASSES =
  'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500';

const ACTION_TYPE_FIELDS: Record<string, string[]> = {
  field_extractor: ['mapping'],
  payload_filter: ['field', 'operator', 'value'],
  http_enricher: ['url', 'mergeKey', 'headers'],
};

const PAYLOAD_FILTER_OPERATORS = ['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'contains'];

function createJsonCompletionSource(actionType?: string) {
  if (!actionType) return null;
  const fields = ACTION_TYPE_FIELDS[actionType] ?? [];
  if (fields.length === 0) return null;

  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/"?[\w]*/);
    if (word?.from === word?.to && !context.explicit) return null;
    const fieldOptions = fields.map((f) => ({ label: `"${f}"`, type: 'property' }));
    const operatorOptions =
      actionType === 'payload_filter'
        ? PAYLOAD_FILTER_OPERATORS.map((op) => ({ label: `"${op}"`, type: 'constant' }))
        : [];
    return {
      from: word?.from ?? context.pos,
      options: [...fieldOptions, ...operatorOptions],
    };
  };
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class EditorErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export function CodeEditorInput({
  value,
  onChange,
  minRows = DEFAULT_MIN_ROWS,
  maxRows = DEFAULT_MAX_ROWS,
  formatOnPaste = true,
  className,
  id,
  placeholder,
  actionType,
}: CodeEditorInputProps) {
  const MIN_HEIGHT_PX = minRows * LINE_HEIGHT_PX;
  const MAX_HEIGHT_PX = maxRows * LINE_HEIGHT_PX;

  const [showLineNumbers, setShowLineNumbers] = useState(false);
  const [validationState, setValidationState] = useState<'valid' | 'invalid' | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Debounced JSON validation badge
  useEffect(() => {
    if (!value.trim()) {
      setValidationState(null);
      setValidationError(null);
      return;
    }
    const timer = setTimeout(() => {
      try {
        JSON.parse(value);
        setValidationState('valid');
        setValidationError(null);
      } catch (e) {
        setValidationState('invalid');
        setValidationError(e instanceof SyntaxError ? e.message : 'Invalid JSON');
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [value]);

  const handleFormat = useCallback(() => {
    try {
      onChange(JSON.stringify(JSON.parse(value), null, 2));
    } catch {
      // invalid JSON — do nothing
    }
  }, [value, onChange]);

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (!formatOnPaste) return;
      const text = event.clipboardData?.getData('text/plain') ?? '';
      try {
        const formatted = JSON.stringify(JSON.parse(text), null, 2);
        event.preventDefault();
        onChange(formatted);
      } catch {
        // not valid JSON — let CodeMirror handle the paste normally
      }
    },
    [formatOnPaste, onChange],
  );

  const extensions = useMemo(() => {
    const completionSource = createJsonCompletionSource(actionType);
    return [
      json(),
      linter(jsonParseLinter()),
      keymap.of([
        indentWithTab,
        {
          key: 'Ctrl-Shift-f',
          mac: 'Cmd-Shift-f',
          run: (view) => {
            try {
              const raw = view.state.doc.toString();
              const formatted = JSON.stringify(JSON.parse(raw), null, 2);
              view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: formatted } });
              return true;
            } catch {
              return false;
            }
          },
        },
        {
          key: 'Ctrl-Shift-Enter',
          mac: 'Cmd-Shift-Enter',
          run: (view) => {
            const line = view.state.doc.lineAt(view.state.selection.main.head);
            view.dispatch({
              changes: { from: line.from, insert: '\n' },
              selection: { anchor: line.from },
              scrollIntoView: true,
            });
            return true;
          },
        },
      ]),
      ...(showLineNumbers ? [lineNumbers()] : []),
      ...(placeholder ? [cmPlaceholder(placeholder)] : []),
      ...(completionSource ? [jsonLanguage.data.of({ autocomplete: completionSource })] : []),
    ];
  }, [actionType, showLineNumbers, placeholder]);

  const fallback = (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={FALLBACK_CLASSES}
      rows={minRows}
      id={id}
    />
  );

  return (
    <EditorErrorBoundary fallback={fallback}>
      <div
        className={`rounded-md border border-gray-300 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 flex flex-col ${className ?? ''}`}
      >
        {/* Scrollable editor area */}
        <div
          style={{ minHeight: `${MIN_HEIGHT_PX}px`, maxHeight: `${MAX_HEIGHT_PX}px`, overflowY: 'auto' }}
          onPaste={handlePaste}
        >
          <CodeMirror
            value={value}
            onChange={onChange}
            extensions={extensions}
            theme={githubLight}
            height="auto"
            id={id}
            basicSetup={{ lineNumbers: false, foldGutter: false }}
          />
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-2 py-1 border-t border-gray-200 bg-gray-50 text-xs rounded-b-md select-none">
          {/* Validation badge */}
          <div className="min-h-[18px] flex items-center">
            {validationState === 'valid' && (
              <span className="flex items-center gap-1 text-green-600">
                <Check size={11} />
                Valid JSON
              </span>
            )}
            {validationState === 'invalid' && (
              <span
                className="flex items-center gap-1 text-red-600 cursor-help"
                title={validationError ?? undefined}
              >
                <X size={11} />
                Invalid JSON
              </span>
            )}
          </div>

          {/* Toolbar actions */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowLineNumbers((n) => !n)}
              className={`flex items-center px-1.5 py-0.5 rounded hover:bg-gray-200 transition-colors ${
                showLineNumbers ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400'
              }`}
              title="Toggle line numbers"
            >
              <Hash size={11} />
            </button>
            <button
              type="button"
              onClick={handleFormat}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors"
              title="Format JSON (Ctrl+Shift+F)"
            >
              <AlignLeft size={11} />
              <span>Format</span>
            </button>
          </div>
        </div>
      </div>
    </EditorErrorBoundary>
  );
}
