import { useEffect, useRef } from 'react';
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';

hljs.registerLanguage('json', json);

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = 'json' }: CodeBlockProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = code;
      ref.current.className = `language-${language}`;
      hljs.highlightElement(ref.current);
    }
  }, [code, language]);

  return (
    <pre className="rounded-lg overflow-x-auto text-[13px] border border-gray-200 bg-[#f6f8fa]">
      <code ref={ref} />
    </pre>
  );
}
