import { marked } from 'marked';
import { useMemo } from 'react';

interface MarkdownProps {
  content: string;
  className?: string;
}

export const Markdown = ({ content, className = '' }: MarkdownProps) => {
  const html = useMemo(() => {
    marked.setOptions({ async: false });
    return marked.parse(content) as string;
  }, [content]);

  return (
    <div
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
