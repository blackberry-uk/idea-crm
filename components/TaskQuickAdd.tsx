import React, { useState, useRef } from 'react';
import { MentionInput } from './MentionInput';
import { extractDelimitedMentions } from '../lib/taskMentions';
import { useStore } from '../store/useStore';

interface TaskQuickAddProps {
  onSubmit: (text: string) => Promise<void>;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  submitIcon?: React.ReactNode;
}

export const TaskQuickAdd: React.FC<TaskQuickAddProps> = ({ onSubmit, onCancel, placeholder, autoFocus, submitIcon }) => {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { addContact, addEntity, data, showToast } = useStore();

  const handleSubmit = async () => {
    if (!text.trim()) return;
    const final = text.trim();
    setText('');
    await onSubmit(final);

    // Auto-create logic for implicit contacts and entities
    extractDelimitedMentions(final, '@').forEach(name => {
      if (!data.contacts.find(c => (c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim()).toLowerCase() === name.toLowerCase())) {
        addContact({ fullName: name, status: 'Lead' })
          .then(() => showToast(`Contact "${name}" created automatically`, 'success'))
          .catch(console.error);
      }
    });

    extractDelimitedMentions(final, '#').forEach(name => {
      if (!data.entities.find(e => e.name.toLowerCase() === name.toLowerCase())) {
        addEntity({ name })
          .then(() => showToast(`Entity "${name}" created automatically`, 'success'))
          .catch(console.error);
      }
    });
  };

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%' }}>
      <MentionInput
        ref={inputRef}
        value={text}
        onChangeValue={setText}
        onSubmit={handleSubmit}
        onCancel={onCancel}
        placeholder={placeholder || "New task… (@ contact, # entity)"}
        style={{ flex: 1, padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.78rem', outline: 'none' }}
        autoFocus={autoFocus}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!text.trim()}
        title="Add task"
        className="transition-all active:scale-95"
        style={{
          width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: text.trim() ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          background: text.trim() ? 'var(--primary)' : '#e5e7eb',
          color: text.trim() ? '#fff' : '#9ca3af',
        }}
      >
        {submitIcon || '➕'}
      </button>
    </div>
  );
};
