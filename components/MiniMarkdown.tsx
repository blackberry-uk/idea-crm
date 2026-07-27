import React from 'react';

// Tiny, dependency-free Markdown renderer for AI output. Handles headings,
// bullet lists, bold (**), inline code (`) and paragraphs — parsed into React
// nodes (no dangerouslySetInnerHTML, so it's XSS-safe by construction).

const renderInline = (text: string, keyBase: string): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  // Split on **bold** and `code`, keeping the delimiters' content.
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  parts.forEach((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) {
      nodes.push(<strong key={`${keyBase}-b${i}`} className="font-bold text-gray-900">{p.slice(2, -2)}</strong>);
    } else if (/^`[^`]+`$/.test(p)) {
      nodes.push(<code key={`${keyBase}-c${i}`} className="bg-gray-100 text-gray-800 rounded px-1 py-0.5 text-[0.85em]">{p.slice(1, -1)}</code>);
    } else {
      nodes.push(<React.Fragment key={`${keyBase}-t${i}`}>{p}</React.Fragment>);
    }
  });
  return nodes;
};

const MiniMarkdown: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const lines = (text || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  let key = 0;

  const flushList = () => {
    if (!list.length) return;
    const items = [...list];
    blocks.push(
      <ul key={`ul-${key++}`} className="list-disc pl-5 space-y-1 my-2">
        {items.map((li, i) => <li key={i} className="text-gray-700 leading-relaxed">{renderInline(li, `li-${key}-${i}`)}</li>)}
      </ul>
    );
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*[-*]\s+/.test(line)) {
      list.push(line.replace(/^\s*[-*]\s+/, ''));
      continue;
    }
    flushList();
    if (!line.trim()) continue;
    if (/^###\s+/.test(line)) {
      blocks.push(<h4 key={`h-${key++}`} className="text-sm font-black uppercase tracking-wider text-gray-500 mt-4 mb-1">{renderInline(line.replace(/^###\s+/, ''), `h${key}`)}</h4>);
    } else if (/^##\s+/.test(line)) {
      blocks.push(<h3 key={`h-${key++}`} className="text-base font-extrabold text-gray-900 mt-4 mb-1">{renderInline(line.replace(/^##\s+/, ''), `h${key}`)}</h3>);
    } else if (/^#\s+/.test(line)) {
      blocks.push(<h2 key={`h-${key++}`} className="text-lg font-extrabold text-gray-900 mt-4 mb-1">{renderInline(line.replace(/^#\s+/, ''), `h${key}`)}</h2>);
    } else {
      blocks.push(<p key={`p-${key++}`} className="text-gray-700 leading-relaxed my-1.5">{renderInline(line, `p${key}`)}</p>);
    }
  }
  flushList();

  return <div className={className}>{blocks}</div>;
};

export default MiniMarkdown;
