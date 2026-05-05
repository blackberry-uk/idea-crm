export type MentionTrigger = '@' | '#';

const LEGACY_NAME = "[A-Za-zÀ-ÖØ-öø-ÿ0-9][A-Za-zÀ-ÖØ-öø-ÿ0-9'’.-]*";

const cleanName = (name: string | undefined) => (name || '').replace(/\s+/g, ' ').trim();

const uniqueNames = (names: string[]) => {
  const seen = new Set<string>();
  return names.filter(name => {
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const extractDelimitedMentions = (text: string, trigger: MentionTrigger): string[] => {
  const escaped = trigger === '@' ? '@' : '#';
  const regex = new RegExp(
    `${escaped}([^${escaped}\\n\\r]+)${escaped}|${escaped}\\[([^\\]]+)\\]|${escaped}"([^"]+)"|${escaped}(${LEGACY_NAME})`,
    'g'
  );
  const names: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    names.push(cleanName(match[1] || match[2] || match[3] || match[4]));
  }

  return uniqueNames(names);
};

export const getActiveMentionQuery = (textBeforeCursor: string, trigger: MentionTrigger): string | null => {
  const start = textBeforeCursor.lastIndexOf(trigger);
  if (start === -1) return null;

  const beforeTrigger = textBeforeCursor[start - 1] || '';
  if (beforeTrigger && !/[\s([{]/.test(beforeTrigger)) return null;

  const query = textBeforeCursor.slice(start + 1);
  if (query.includes(trigger) || /[\n\r]/.test(query)) return null;

  return query;
};

export const replaceActiveMention = (
  text: string,
  cursorPos: number,
  trigger: MentionTrigger,
  name: string
) => {
  const textBeforeCursor = text.slice(0, cursorPos);
  const start = textBeforeCursor.lastIndexOf(trigger);
  if (start === -1) return text;

  const before = text.slice(0, start);
  const after = text.slice(cursorPos);
  const trimmed = cleanName(name);
  const suffix = after.startsWith(' ') ? '' : ' ';

  return `${before}${trigger}${trimmed}${trigger}${after}${suffix}`;
};

export const mentionVariantsForName = (trigger: MentionTrigger, name: string) => [
  `${trigger}${name}${trigger}`,
  `${trigger}[${name}]`,
  `${trigger}"${name}"`,
  `${trigger}${name}`,
];

