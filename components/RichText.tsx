import React from 'react';

interface RichTextProps {
  text?: string | null;
  onMentionClick?: (username: string) => void;
  className?: string;
}

const SAFE_SCHEMES = /^(https?:|mailto:|tel:|\/|#)/i;

function normalizeHref(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^www\./i.test(value)) return `https://${value}`;
  if (SAFE_SCHEMES.test(value)) return value;
  return null;
}

function splitTrailingPunctuation(value: string): [string, string] {
  const match = value.match(/[),.!?;:]+$/);
  if (!match) return [value, ''];
  return [value.slice(0, -match[0].length), match[0]];
}

export const RichText: React.FC<RichTextProps> = ({ text = '', onMentionClick, className = '' }) => {
  const source = String(text ?? '');
  const tokenRegex = /(\[[^\]\n]{1,180}\]\((?:https?:\/\/|mailto:|tel:|\/|#)[^)\s]{1,2048}\)|https?:\/\/[^\s<]+|www\.[^\s<]+|@[a-zA-Z0-9_]{3,30})/gi;
  const chunks = source.split(tokenRegex);

  return (
    <span className={className}>
      {chunks.map((chunk, index) => {
        if (!chunk) return null;

        const markdown = chunk.match(/^\[([^\]\n]{1,180})\]\(([^)\s]{1,2048})\)$/);
        if (markdown) {
          const href = normalizeHref(markdown[2]);
          if (!href) return <React.Fragment key={index}>{chunk}</React.Fragment>;
          return (
            <a key={index} href={href} target={/^https?:/i.test(href) ? '_blank' : undefined} rel={/^https?:/i.test(href) ? 'noopener noreferrer' : undefined} className="underline decoration-2 underline-offset-2 font-semibold hover:opacity-70 break-words">
              {markdown[1]}
            </a>
          );
        }

        if (/^@[a-zA-Z0-9_]{3,30}$/.test(chunk) && onMentionClick) {
          const username = chunk.slice(1).toLowerCase();
          return (
            <button key={index} type="button" onClick={() => onMentionClick(username)} className="font-bold underline decoration-2 underline-offset-2 hover:opacity-70">
              {chunk}
            </button>
          );
        }

        if (/^(https?:\/\/|www\.)/i.test(chunk)) {
          const [clean, punctuation] = splitTrailingPunctuation(chunk);
          const href = normalizeHref(clean);
          if (!href) return <React.Fragment key={index}>{chunk}</React.Fragment>;
          return (
            <React.Fragment key={index}>
              <a href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-2 underline-offset-2 font-semibold break-words hover:opacity-70">{clean}</a>{punctuation}
            </React.Fragment>
          );
        }

        return <React.Fragment key={index}>{chunk}</React.Fragment>;
      })}
    </span>
  );
};
