import CodeMirror from '@uiw/react-codemirror';
import { githubLight } from '@uiw/codemirror-theme-github';
import { closeBrackets } from '@codemirror/autocomplete';
import { indentWithTab } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { keymap } from '@codemirror/view';
import React from 'react';

export interface CodeEditorInputProps {
  value: string;
  onChange: (value: string) => void;
  language?: 'json';
  minRows?: number;
  maxRows?: number;
  formatOnPaste?: boolean;
  className?: string;
  id?: string;
}

const LINE_HEIGHT_PX = 24;
const DEFAULT_MIN_ROWS = 5;
const DEFAULT_MAX_ROWS = 20;

const FALLBACK_CLASSES =
  'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500';

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
}: CodeEditorInputProps) {
  const MIN_HEIGHT_PX = minRows * LINE_HEIGHT_PX;
  const MAX_HEIGHT_PX = maxRows * LINE_HEIGHT_PX;

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (!formatOnPaste) return;
    const text = event.clipboardData?.getData('text/plain') ?? '';
    try {
      const formatted = JSON.stringify(JSON.parse(text), null, 2);
      event.preventDefault();
      onChange(formatted);
    } catch {
      // not valid JSON — let CodeMirror handle the paste normally
    }
  };

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
        className={`rounded-md border border-gray-300 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 ${className ?? ''}`}
        style={{ minHeight: `${MIN_HEIGHT_PX}px`, maxHeight: `${MAX_HEIGHT_PX}px`, overflowY: 'auto' }}
        onPaste={handlePaste}
      >
        <CodeMirror
          value={value}
          onChange={onChange}
          extensions={[json(), closeBrackets(), keymap.of([indentWithTab])]}
          theme={githubLight}
          height="auto"
          id={id}
          basicSetup={{ lineNumbers: false, foldGutter: false }}
        />
      </div>
    </EditorErrorBoundary>
  );
}
