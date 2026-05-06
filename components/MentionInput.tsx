import React, { useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import { getActiveMentionQuery, replaceActiveMention } from '../lib/taskMentions';

interface MentionInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onSubmit'> {
  value: string;
  onChangeValue: (val: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  containerStyle?: React.CSSProperties;
}

export const MentionInput = React.forwardRef<HTMLInputElement, MentionInputProps>(({ 
  value, 
  onChangeValue, 
  onSubmit, 
  onCancel, 
  containerStyle,
  style, 
  ...props 
}, forwardedRef) => {
  const { data } = useStore();
  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = (forwardedRef as React.RefObject<HTMLInputElement>) || internalRef;
  
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [entityQuery, setEntityQuery] = useState<string | null>(null);
  const [mentionCursorPos, setMentionCursorPos] = useState(0);
  const [entityCursorPos, setEntityCursorPos] = useState(0);
  const [mentionIdx, setMentionIdx] = useState(0);
  const [entityIdx, setEntityIdx] = useState(0);

  const contacts = data.contacts || [];
  const entities = data.entities || [];

  const mentionFilteredContacts = mentionQuery === null ? [] : contacts.filter(c => {
    const q = mentionQuery.toLowerCase();
    const full = (c.fullName || '').toLowerCase();
    const first = (c.firstName || '').toLowerCase();
    const last = (c.lastName || '').toLowerCase();
    return full.includes(q) || first.includes(q) || last.includes(q);
  }).slice(0, 5);

  const entityFilteredList = entityQuery === null ? [] : entities.filter(e => e.name.toLowerCase().includes(entityQuery.toLowerCase())).slice(0, 5);

  const showCreateMention = mentionQuery !== null && mentionQuery.trim().length >= 2 &&
    !mentionFilteredContacts.some(c => {
      const name = (c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim()).toLowerCase();
      return name === mentionQuery.trim().toLowerCase();
    });

  const showCreateEntity = entityQuery !== null && entityQuery.trim().length >= 2 &&
    !entityFilteredList.some(e => e.name.toLowerCase() === entityQuery.trim().toLowerCase());

  const insertMention = (contact: { fullName?: string; firstName?: string; lastName?: string }) => {
    const name = contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
    onChangeValue(replaceActiveMention(value, mentionCursorPos, '@', name));
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const insertEntityMention = (ent: { name: string }) => {
    onChangeValue(replaceActiveMention(value, entityCursorPos, '#', ent.name));
    setEntityQuery(null);
    inputRef.current?.focus();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChangeValue(val);
    const cursor = e.target.selectionStart || 0;
    const textBeforeCursor = val.slice(0, cursor);

    const activeMention = getActiveMentionQuery(textBeforeCursor, '@');
    const activeEntity = getActiveMentionQuery(textBeforeCursor, '#');
    const mentionStart = activeMention === null ? -1 : textBeforeCursor.lastIndexOf('@');
    const entityStart = activeEntity === null ? -1 : textBeforeCursor.lastIndexOf('#');

    if (activeMention !== null && mentionStart > entityStart) {
      setMentionQuery(activeMention);
      setMentionCursorPos(cursor);
      setEntityQuery(null);
      setMentionIdx(0);
    } else if (activeEntity !== null) {
      setEntityQuery(activeEntity);
      setEntityCursorPos(cursor);
      setMentionQuery(null);
      setEntityIdx(0);
    } else {
      setMentionQuery(null);
      setEntityQuery(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionQuery !== null) {
      if (mentionFilteredContacts.length > 0) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, mentionFilteredContacts.length - 1)); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); return; }
        if (e.key === 'Enter') {
          e.preventDefault();
          if (mentionIdx < mentionFilteredContacts.length) insertMention(mentionFilteredContacts[mentionIdx]);
          return;
        }
      }
      if (e.key === 'Escape') { setMentionQuery(null); return; }
    }
    
    if (entityQuery !== null) {
      if (entityFilteredList.length > 0) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setEntityIdx(i => Math.min(i + 1, entityFilteredList.length - 1)); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); setEntityIdx(i => Math.max(i - 1, 0)); return; }
        if (e.key === 'Enter') {
          e.preventDefault();
          if (entityIdx < entityFilteredList.length) insertEntityMention(entityFilteredList[entityIdx]);
          return;
        }
      }
      if (e.key === 'Escape') { setEntityQuery(null); return; }
    }
    
    if (e.key === 'Enter' && value.trim()) { 
      e.preventDefault(); 
      onSubmit(); 
    }
    if (e.key === 'Escape') { 
      setMentionQuery(null); 
      setEntityQuery(null); 
      if (onCancel) onCancel(); 
    }
  };

  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex', width: '100%', ...containerStyle }}>
      <input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        style={{ width: '100%', ...style }}
        {...props}
      />
      
      {mentionQuery !== null && (
        <div className="cl-mention-dropdown" style={{ position: 'absolute', left: 0, top: '100%', zIndex: 100 }}>
          {mentionFilteredContacts.map((c, i) => (
              <button key={c.id} className={`cl-mention-option ${i === mentionIdx ? 'cl-mention-option--active' : ''}`}
                onMouseDown={e => { e.preventDefault(); insertMention(c); }}>
                <span className="cl-mention-avatar">{(c.firstName || c.fullName || '?')[0].toUpperCase()}</span>
                <span className="cl-mention-name">{c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim()}</span>
                {c.company && <span className="cl-mention-company">{c.company}</span>}
              </button>
          ))}
          {showCreateMention && (
            <div className="cl-mention-option" style={{ cursor: 'default', opacity: 0.7 }}>
              <span className="cl-mention-avatar" style={{ background: 'transparent', color: '#9ca3af' }}>+</span>
              <span className="cl-mention-name">{mentionQuery.trim()} will be added to contacts</span>
            </div>
          )}
        </div>
      )}
      {entityQuery !== null && (
        <div className="cl-mention-dropdown" style={{ position: 'absolute', left: 0, top: '100%', zIndex: 100 }}>
          {entityFilteredList.map((ent, i) => (
            <button key={ent.id} className={`cl-mention-option ${i === entityIdx ? 'cl-mention-option--active' : ''}`}
              onMouseDown={e => { e.preventDefault(); insertEntityMention(ent); }}>
              <span className="cl-mention-avatar" style={{ backgroundColor: '#eef2ff', color: '#6366f1' }}>#</span>
              <span className="cl-mention-name">{ent.name}</span>
            </button>
          ))}
          {showCreateEntity && (
            <div className="cl-mention-option" style={{ cursor: 'default', opacity: 0.7 }}>
              <span className="cl-mention-avatar" style={{ background: 'transparent', color: '#9ca3af' }}>+</span>
              <span className="cl-mention-name">{entityQuery.trim()} will be added to entities</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
