import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  X, Check, Flame, Tag, Lightbulb, Calendar, CalendarDays, ArrowDownToLine,
  Clock, AlignLeft, Trash2, ChevronDown, ChevronLeft, ChevronRight, Save, User
} from 'lucide-react';
import IdeaPickerDropdown from './IdeaPickerDropdown';
import ContactEditPanel from './ContactEditPanel';
import { DailyTodoData } from './DailyTodoItem';
import { useStore } from '../store/useStore';
import { format, startOfMonth, endOfMonth, getDay, addMonths, subMonths, isToday } from 'date-fns';
import { extractDelimitedMentions, getActiveMentionQuery, replaceActiveMention } from '../lib/taskMentions';
import { getInitials, getAvatarColor } from '../lib/utils';

interface TaskDetailModalProps {
  todo: DailyTodoData;
  ideas: { id: string; title: string }[];
  onClose: () => void;
  onUpdate: (id: string, updates: Record<string, any>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleComplete: (todo: DailyTodoData) => Promise<void>;
  onToggleUrgent: (todo: DailyTodoData) => Promise<void>;
  onTagIdea: (todoId: string, ideaId: string | null) => Promise<void>;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  todo, ideas, onClose, onUpdate, onDelete, onToggleComplete, onToggleUrgent, onTagIdea
}) => {
  const [text, setText] = useState(todo.text);
  const [notes, setNotes] = useState(todo.comments || '');
  const [dueDate, setDueDate] = useState(todo.dueDate || '');
  const [showDueDate, setShowDueDate] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calMonth, setCalMonth] = useState(() => todo.date ? new Date(String(todo.date).slice(0, 10) + 'T12:00:00') : new Date());
  
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [entityEditName, setEntityEditName] = useState('');
  const [entityEditNotes, setEntityEditNotes] = useState('');
  const [entityEditWebsite, setEntityEditWebsite] = useState('');
  const [entityEditLinkedin, setEntityEditLinkedin] = useState('');

  const [editingContactId, setEditingContactId] = useState<string | null>(null);

  const backdropRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const resizeTextarea = React.useCallback(() => {
    if (titleRef.current) {
      titleRef.current.style.height = 'auto';
      titleRef.current.style.height = `${titleRef.current.scrollHeight}px`;
    }
  }, []);

  React.useEffect(() => {
    resizeTextarea();
  }, [text, resizeTextarea]);

  // # entity and @ contact mention state
  const { data, addContact, addEntity, updateEntity, showToast } = useStore();
  const entities = data.entities || [];
  const contacts = data.contacts || [];

  const [entityQuery, setEntityQuery] = useState<string | null>(null);
  const [entityCursorPos, setEntityCursorPos] = useState(0);
  const [entityIdx, setEntityIdx] = useState(0);

  const [contactQuery, setContactQuery] = useState<string | null>(null);
  const [contactCursorPos, setContactCursorPos] = useState(0);
  const [contactIdx, setContactIdx] = useState(0);



  const entityFilteredList = React.useMemo(() => {
    if (entityQuery === null) return [];
    const q = entityQuery.toLowerCase();
    return entities.filter(e => e.name.toLowerCase().includes(q)).slice(0, 6);
  }, [entityQuery, entities]);

  const contactFilteredList = React.useMemo(() => {
    if (contactQuery === null) return [];
    const q = contactQuery.toLowerCase();
    return contacts.filter(c => (c.fullName || '').toLowerCase().includes(q)).slice(0, 6);
  }, [contactQuery, contacts]);

  const showCreateEntity = entityQuery !== null && entityQuery.length >= 2 &&
    !entityFilteredList.some(e => e.name.toLowerCase() === entityQuery.toLowerCase());

  const showCreateContact = contactQuery !== null && contactQuery.trim().length >= 2 &&
    !contactFilteredList.some(c => (c.fullName || '').toLowerCase() === contactQuery.trim().toLowerCase());

  React.useEffect(() => { setEntityIdx(0); }, [entityFilteredList.length]);
  React.useEffect(() => { setContactIdx(0); }, [contactFilteredList.length]);

  const mentionedEntities = React.useMemo(() => {
    const names = extractDelimitedMentions(text, '#').map(name => name.toLowerCase());
    return entities.filter(ent => {
      return names.includes(ent.name.toLowerCase());
    });
  }, [text, entities]);

  const mentionedContacts = React.useMemo(() => {
    const names = extractDelimitedMentions(text, '@').map(name => name.toLowerCase());
    return contacts.filter(c => {
      if (!c.fullName) return false;
      return names.includes(c.fullName.toLowerCase());
    });
  }, [text, contacts]);

  const insertEntityMention = async (name: string) => {
    const newText = replaceActiveMention(text, entityCursorPos, '#', name);
    setText(newText);
    setEntityQuery(null);
    // Auto-create entity if it doesn't exist
    const existing = entities.find(e => e.name.toLowerCase() === name.toLowerCase());
    if (!existing) {
      try {
        await addEntity({ name });
        showToast(`Entity "${name}" created`, 'success');
      } catch (err) {
        console.error('Failed to create entity:', err);
      }
    }
    // Save after state update
    setTimeout(async () => {
      setSaving(true);
      await onUpdate(todo.id, { text: newText.trim() });
      setSaving(false);
    }, 50);
    titleRef.current?.focus();
  };

  const insertContactMention = async (name: string) => {
    const newText = replaceActiveMention(text, contactCursorPos, '@', name);
    setText(newText);
    setContactQuery(null);
    const existing = contacts.find(c => (c.fullName || '').toLowerCase() === name.toLowerCase());
    if (!existing) {
      const parts = name.trim().split(/\s+/);
      try {
        await addContact({
          firstName: parts[0],
          lastName: parts.slice(1).join(' ') || undefined,
          fullName: name.trim()
        });
        showToast(`Contact "${name}" created`, 'success');
      } catch (err) {
        console.error('Failed to create contact:', err);
      }
    }
    setTimeout(async () => {
      setSaving(true);
      await onUpdate(todo.id, { text: newText.trim() });
      setSaving(false);
    }, 50);
    titleRef.current?.focus();
  };
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // Auto-save notes on blur
  const saveNotes = async () => {
    if (notes !== (todo.comments || '')) {
      setSaving(true);
      await onUpdate(todo.id, { comments: notes });
      setSaving(false);
    }
  };

  const saveText = async () => {
    if (text.trim() && text.trim() !== todo.text) {
      setSaving(true);
      await onUpdate(todo.id, { text: text.trim() });
      setSaving(false);
    }
  };

  const saveDueDate = async (val: string) => {
    setDueDate(val);
    setSaving(true);
    await onUpdate(todo.id, { dueDate: val || null });
    setSaving(false);
  };

  const handleDelete = async () => {
    await onDelete(todo.id);
    onClose();
  };

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      saveNotes();
      saveText();
      onClose();
    }
  };

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        saveNotes();
        saveText();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [notes, text]);

  const createdDate = todo.createdAt ? new Date(todo.createdAt) : new Date();
  // Extract YYYY-MM-DD and parse as local to avoid UTC timezone shift
  const dateStr = todo.date ? String(todo.date).slice(0, 10) : '';
  const todoDate = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();

  return (
    <div className="tdm-backdrop" ref={backdropRef} onClick={handleBackdropClick}>
      {showDatePicker && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 250 }} onClick={(e) => { e.stopPropagation(); setShowDatePicker(false); }} onContextMenu={e => { e.preventDefault(); setShowDatePicker(false); }} />
      )}
      <div className="tdm-modal" style={{ position: 'relative', zIndex: 260 }}>
        {/* Header */}
        <div className="tdm-header">
          <div className="tdm-header-left">
            <button
              className={`tdm-check ${todo.completed ? 'tdm-check--done' : ''}`}
              onClick={() => onToggleComplete(todo)}
            >
              {todo.completed ? <Check className="w-5 h-5" /> : null}
            </button>
            <div className="tdm-header-date" style={{ cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }} onClick={() => setShowDatePicker(!showDatePicker)}>
              <span style={{ color: dateStr ? 'inherit' : '#9ca3af' }}>{dateStr ? todoDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Date not assigned'}</span>
              <CalendarDays className="w-3.5 h-3.5" style={{ opacity: 0.5 }} />
              {showDatePicker && (() => {
                const monthStart = startOfMonth(calMonth);
                const monthEnd = endOfMonth(calMonth);
                const startDow = getDay(monthStart); // 0=Sun
                const daysInMonth = monthEnd.getDate();
                const calDays: (Date | null)[] = [];
                for (let i = 0; i < startDow; i++) calDays.push(null);
                for (let d = 1; d <= daysInMonth; d++) calDays.push(new Date(calMonth.getFullYear(), calMonth.getMonth(), d));
                const selectedDateKey = todo.date ? String(todo.date).slice(0, 10) : '';
                
                return (
                  <div className="wv-task-submenu wv-task-submenu--left" style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', zIndex: 300, minWidth: '220px', padding: '8px', cursor: 'default' }} onClick={e => e.stopPropagation()}>
                    <div className="wv-cal-header">
                      <button className="wv-cal-nav" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setCalMonth(prev => subMonths(prev, 1)); }}><ChevronLeft className="w-3.5 h-3.5" /></button>
                      <span className="wv-cal-title">{format(calMonth, 'MMMM yyyy')}</span>
                      <button className="wv-cal-nav" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setCalMonth(prev => addMonths(prev, 1)); }}><ChevronRight className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="wv-cal-weekdays">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <span key={d} className="wv-cal-wd">{d}</span>)}
                    </div>
                    <div className="wv-cal-grid">
                      {calDays.map((cd, i) => {
                        if (!cd) return <span key={`e-${i}`} className="wv-cal-cell wv-cal-cell--empty" />;
                        const dk = `${cd.getFullYear()}-${String(cd.getMonth() + 1).padStart(2, '0')}-${String(cd.getDate()).padStart(2, '0')}`;
                        const isSelected = dk === selectedDateKey;
                        const isTod = isToday(cd);
                        return (
                          <button
                            key={dk}
                            className={`wv-cal-cell ${isSelected ? 'wv-cal-cell--selected' : ''} ${isTod ? 'wv-cal-cell--today' : ''}`}
                            onClick={async (e) => {
                              e.preventDefault(); e.stopPropagation();
                              setSaving(true);
                              await onUpdate(todo.id, { date: dk });
                              setSaving(false);
                              setShowDatePicker(false);
                            }}
                          >
                            {cd.getDate()}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
          <div className="tdm-header-right">
            {saving && <span className="tdm-saving">Saving…</span>}
            <button onClick={() => { saveNotes(); saveText(); onClose(); }} className="tdm-close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Task title */}
        <div className="tdm-title-section" style={{ position: 'relative' }}>
          <textarea
            ref={titleRef}
            className={`tdm-title-input ${todo.completed ? 'tdm-title-input--done' : ''}`}
            value={text}
            onChange={e => {
              const val = e.target.value;
              setText(val);
              const cursor = e.target.selectionStart || 0;
              const textBeforeCursor = val.slice(0, cursor);

              const activeContact = getActiveMentionQuery(textBeforeCursor, '@');
              const activeEntity = getActiveMentionQuery(textBeforeCursor, '#');
              const contactStart = activeContact === null ? -1 : textBeforeCursor.lastIndexOf('@');
              const entityStart = activeEntity === null ? -1 : textBeforeCursor.lastIndexOf('#');

              if (activeEntity !== null && entityStart > contactStart) {
                setEntityQuery(activeEntity);
                setEntityCursorPos(cursor);
                setContactQuery(null);
              } else if (activeContact !== null) {
                setContactQuery(activeContact);
                setContactCursorPos(cursor);
                setEntityQuery(null);
              } else {
                setEntityQuery(null);
                setContactQuery(null);
              }
            }}
            onFocus={resizeTextarea}
            onBlur={() => { 
              setTimeout(() => { setEntityQuery(null); setContactQuery(null); }, 200); 
              saveText(); resizeTextarea(); 
            }}
            onKeyDown={e => {
              if (entityQuery !== null && (entityFilteredList.length > 0 || showCreateEntity)) {
                if (e.key === 'ArrowDown') { e.preventDefault(); setEntityIdx(i => Math.min(i + 1, entityFilteredList.length + (showCreateEntity ? 0 : -1))); return; }
                if (e.key === 'ArrowUp') { e.preventDefault(); setEntityIdx(i => Math.max(i - 1, 0)); return; }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (entityIdx < entityFilteredList.length) insertEntityMention(entityFilteredList[entityIdx].name);
                  else if (showCreateEntity) insertEntityMention(entityQuery.trim());
                  return;
                }
                if (e.key === 'Escape') { setEntityQuery(null); return; }
              }
              if (contactQuery !== null && (contactFilteredList.length > 0 || showCreateContact)) {
                if (e.key === 'ArrowDown') { e.preventDefault(); setContactIdx(i => Math.min(i + 1, contactFilteredList.length + (showCreateContact ? 0 : -1))); return; }
                if (e.key === 'ArrowUp') { e.preventDefault(); setContactIdx(i => Math.max(i - 1, 0)); return; }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (contactIdx < contactFilteredList.length) insertContactMention(contactFilteredList[contactIdx].fullName);
                  else if (showCreateContact) insertContactMention(contactQuery.trim());
                  return;
                }
                if (e.key === 'Escape') { setContactQuery(null); return; }
              }
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveText(); }
            }}
            rows={1}
          />
          {/* Entity dropdown */}
          {entityQuery !== null && (entityFilteredList.length > 0 || showCreateEntity) && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 60,
              width: '260px', background: '#fff', borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb',
              overflow: 'hidden', marginTop: '4px'
            }}>
              {entityFilteredList.map((ent, i) => (
                <button
                  key={ent.id}
                  onMouseDown={e => { e.preventDefault(); insertEntityMention(ent.name); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px', border: 'none', cursor: 'pointer', textAlign: 'left',
                    background: i === entityIdx ? '#eef2ff' : '#fff', transition: 'background 0.1s'
                  }}
                >
                  <span style={{
                    width: '28px', height: '28px', borderRadius: '8px', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '11px',
                    fontWeight: 800, background: '#eef2ff', color: '#6366f1'
                  }}>#</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>{ent.name}</span>
                </button>
              ))}
              {showCreateEntity && (
                <button
                  onMouseDown={e => { e.preventDefault(); insertEntityMention(entityQuery.trim()); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px', border: 'none', cursor: 'pointer', textAlign: 'left',
                    background: entityIdx === entityFilteredList.length ? '#eef2ff' : '#fff',
                    borderTop: '1px solid #f3f4f6', transition: 'background 0.1s'
                  }}
                >
                  <span style={{
                    width: '28px', height: '28px', borderRadius: '8px', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '11px',
                    fontWeight: 800, background: '#e0e7ff', color: '#4f46e5'
                  }}>+</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#6366f1' }}>Create "{entityQuery.trim()}"</span>
                </button>
              )}
            </div>
          )}

          {/* Contact dropdown */}
          {contactQuery !== null && (contactFilteredList.length > 0 || showCreateContact) && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 60,
              width: '260px', background: '#fff', borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb',
              overflow: 'hidden', marginTop: '4px'
            }}>
              {contactFilteredList.map((contact, i) => (
                <button
                  key={contact.id}
                  onMouseDown={e => { e.preventDefault(); insertContactMention(contact.fullName); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px', border: 'none', cursor: 'pointer', textAlign: 'left',
                    background: i === contactIdx ? '#f5f3ff' : '#fff', transition: 'background 0.1s'
                  }}
                >
                  <span style={{
                    width: '28px', height: '28px', borderRadius: '8px', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '11px',
                    fontWeight: 800, background: '#f5f3ff', color: '#8b5cf6'
                  }}>@</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>{contact.fullName}</span>
                </button>
              ))}
              {showCreateContact && (
                <button
                  onMouseDown={e => { e.preventDefault(); insertContactMention(contactQuery.trim()); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px', border: 'none', cursor: 'pointer', textAlign: 'left',
                    background: contactIdx === contactFilteredList.length ? '#f5f3ff' : '#fff',
                    borderTop: '1px solid #f3f4f6', transition: 'background 0.1s'
                  }}
                >
                  <span style={{
                    width: '28px', height: '28px', borderRadius: '8px', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '11px',
                    fontWeight: 800, background: '#f5f3ff', color: '#8b5cf6'
                  }}>+</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#8b5cf6' }}>Create "{contactQuery.trim()}"</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Mentioned Entities Chips */}
        {(mentionedEntities.length > 0 || mentionedContacts.length > 0) && (
          <div className="tdm-mentioned-entities" style={{ padding: '0 24px', display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '-8px', marginBottom: '16px' }}>
            {mentionedContacts.map(c => (
              <button
                key={c.id}
                onClick={() => {
                  if (editingContactId === c.id) {
                    setEditingContactId(null);
                  } else {
                    setEditingContactId(c.id);
                    setEditingEntityId(null);
                  }
                }}
                className={`tdm-contact-chip ${editingContactId === c.id ? 'active' : ''}`}
                style={{
                  padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                  backgroundColor: editingContactId === c.id ? '#8b5cf6' : '#f5f3ff',
                  color: editingContactId === c.id ? '#fff' : '#7c3aed',
                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                  transition: 'all 0.15s'
                }}
              >
                <span>@</span> {c.fullName}
              </button>
            ))}
            {mentionedEntities.map(ent => (
              <button
                key={ent.id}
                onClick={() => {
                  if (editingEntityId === ent.id) {
                    setEditingEntityId(null);
                  } else {
                    setEditingEntityId(ent.id);
                    setEditingContactId(null);
                    setEntityEditName(ent.name);
                    setEntityEditNotes(ent.description || '');
                    setEntityEditWebsite(ent.website || '');
                    setEntityEditLinkedin(ent.linkedinUrl || '');
                  }
                }}
                className={`tdm-entity-chip ${editingEntityId === ent.id ? 'active' : ''}`}
                style={{
                  padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                  backgroundColor: editingEntityId === ent.id ? '#4f46e5' : '#eef2ff',
                  color: editingEntityId === ent.id ? '#fff' : '#6366f1',
                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                  transition: 'all 0.15s'
                }}
              >
                <span>#</span> {ent.name}
              </button>
            ))}
          </div>
        )}

        {/* Entity Editor */}
        {editingEntityId && (
          <div style={{ margin: '0 24px 20px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '11px', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Edit Person / Entity</h4>
              <button onClick={() => setEditingEntityId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X className="w-3.5 h-3.5" /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Name</label>
                <input
                  value={entityEditName}
                  onChange={e => setEntityEditName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Website</label>
                <div style={{ position: 'relative' }}>
                  <input
                    value={entityEditWebsite}
                    onChange={e => setEntityEditWebsite(e.target.value)}
                    placeholder="https://..."
                    style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', outline: 'none' }}
                  />
                  <span style={{ position: 'absolute', left: '10px', top: '9px', fontSize: '13px' }}>🌐</span>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>LinkedIn URL</label>
                <div style={{ position: 'relative' }}>
                  <input
                    value={entityEditLinkedin}
                    onChange={e => setEntityEditLinkedin(e.target.value)}
                    placeholder="https://linkedin.com/company/..."
                    style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', outline: 'none' }}
                  />
                  <span style={{ position: 'absolute', left: '10px', top: '9px', fontSize: '13px' }}>🔗</span>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Details / Notes</label>
                <textarea
                  value={entityEditNotes}
                  onChange={e => setEntityEditNotes(e.target.value)}
                  rows={3}
                  placeholder="Context, background, description..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', outline: 'none', resize: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await updateEntity(editingEntityId, { 
                        name: entityEditName, 
                        description: entityEditNotes,
                        website: entityEditWebsite,
                        linkedinUrl: entityEditLinkedin
                      });
                    
                      const oldEnt = entities.find(e => e.id === editingEntityId);
                      if (oldEnt && oldEnt.name !== entityEditName) {
                        const safeName = oldEnt.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const regex = new RegExp(`#${safeName}\\b`, 'g');
                        const newText = text.replace(regex, `#${entityEditName}`);
                        setText(newText);
                        await onUpdate(todo.id, { text: newText.trim() });
                      }

                      setEditingEntityId(null);
                    } catch (err) {
                      console.error('Failed to save entity:', err);
                      showToast('Failed to save entity', 'error');
                    } finally {
                      setSaving(false);
                    }
                  }}
                  style={{ padding: '6px 16px', backgroundColor: '#4f46e5', color: '#fff', fontSize: '12px', fontWeight: 700, borderRadius: '6px', border: 'none', cursor: 'pointer' }}
                >
                  Save Details
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Contact Editor */}
        {editingContactId && (() => {
          const editingContact = contacts.find(c => c.id === editingContactId);
          if (!editingContact) return null;
          return (
            <div style={{ margin: '0 24px 20px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '11px', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Edit Contact</h4>
                <button onClick={() => setEditingContactId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X className="w-3.5 h-3.5" /></button>
              </div>
              <ContactEditPanel
                contact={editingContact}
                compact
                onSaved={() => setEditingContactId(null)}
                onCancel={() => setEditingContactId(null)}
                onNameChanged={(oldName, newName) => {
                  const safeName = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                  const regex = new RegExp(`@${safeName}\\b`, 'g');
                  const newText = text.replace(regex, `@${newName}`);
                  setText(newText);
                  onUpdate(todo.id, { text: newText.trim() });
                }}
              />
            </div>
          );
        })()}

        {!todo.parentId ? (
          <>
            {/* Meta row: urgency, idea tag */}
            <div className="tdm-meta">
              {/* Assignee tag */}
              <div className="tdm-meta-tag-wrap">
                <button
                  className={`tdm-meta-chip ${todo.assigneeId ? 'tdm-meta-chip--idea' : ''}`}
                  onClick={() => setShowAssigneePicker(!showAssigneePicker)}
                  title={todo.assigneeId ? `Assigned to ${data.users.find(u => u.id === todo.assigneeId)?.name}` : 'Assign to'}
                  style={{ padding: '4px' }}
                >
                  {todo.assigneeId ? (() => {
                    const assigneeUser = data.users.find(u => u.id === todo.assigneeId);
                    return (
                      <div className={`min-w-[24px] h-5 px-1.5 rounded-lg ${getAvatarColor(assigneeUser?.id || '', assigneeUser?.themeAdjustments)}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#fff', fontWeight: 800 }}>
                        {assigneeUser?.avatarUrl ? assigneeUser.avatarUrl.slice(0,3) : getInitials(assigneeUser?.name || '')}
                      </div>
                    );
                  })() : <User className="w-4 h-4 text-gray-500" />}
                </button>
                {showAssigneePicker && (
                  <div className="tdm-tag-picker" style={{ padding: '8px', minWidth: '180px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '8px' }}>Assign to</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <button 
                         onClick={async () => { setSaving(true); await onUpdate(todo.id, { assigneeId: null }); setSaving(false); setShowAssigneePicker(false); }}
                         style={{ textAlign: 'left', padding: '6px 8px', borderRadius: '6px', fontSize: '12px', background: !todo.assigneeId ? '#f3f4f6' : 'transparent', border: 'none', cursor: 'pointer' }}
                      >
                         Unassigned
                      </button>
                      {(() => {
                        let options = data.users;
                        if (todo.ideaId) {
                          const idea = data.ideas?.find(i => i.id === todo.ideaId);
                          if (idea) {
                            const allowed = [idea.ownerId, ...(idea.collaboratorIds || [])];
                            options = data.users.filter(u => allowed.includes(u.id));
                          }
                        }
                        return options.map(u => (
                          <button
                            key={u.id}
                            onClick={async () => { setSaving(true); await onUpdate(todo.id, { assigneeId: u.id }); setSaving(false); setShowAssigneePicker(false); }}
                            style={{ textAlign: 'left', padding: '6px 8px', borderRadius: '6px', fontSize: '12px', background: todo.assigneeId === u.id ? '#f3f4f6' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <div className={`min-w-[20px] h-4 px-1 rounded-md ${getAvatarColor(u.id, u.themeAdjustments)}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#fff', fontWeight: 800 }}>
                              {u.avatarUrl ? u.avatarUrl.slice(0,3) : getInitials(u.name)}
                            </div>
                            {u.name}
                          </button>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Due date toggle */}
              {!showDueDate && !dueDate && (
                <button
                  className="tdm-meta-chip"
                  onClick={() => setShowDueDate(true)}
                  title="Add due date"
                >
                  <Calendar className="w-3.5 h-3.5" />
                </button>
              )}
              {dueDate && !showDueDate && (
                <button
                  className="tdm-meta-chip tdm-meta-chip--idea"
                  onClick={() => setShowDueDate(true)}
                  title="Edit due date"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(dueDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </button>
              )}

              {/* Priority */}
              <button
                className={`tdm-meta-chip ${todo.isUrgent ? 'tdm-meta-chip--urgent' : ''}`}
                onClick={() => onToggleUrgent(todo)}
              >
                <Flame className="w-3.5 h-3.5" />
                {todo.isUrgent ? 'Priority' : 'Set Priority'}
              </button>

              {/* Idea tag */}
              <div className="tdm-meta-tag-wrap">
                <button
                  className={`tdm-meta-chip ${todo.ideaId ? 'tdm-meta-chip--idea' : ''}`}
                  onClick={() => setShowTagPicker(!showTagPicker)}
                >
                  {todo.idea ? (
                    <>
                      <Lightbulb className="w-3.5 h-3.5" />
                      {todo.idea.title.length > 25 ? todo.idea.title.slice(0, 25) + '\u2026' : todo.idea.title}
                    </>
                  ) : (
                    <>
                      <Tag className="w-3.5 h-3.5" />
                      Tag to Project
                    </>
                  )}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showTagPicker && (
                  <div className="tdm-tag-picker">
                    <IdeaPickerDropdown
                      ideas={ideas}
                      selectedIdeaId={todo.ideaId}
                      onSelect={(id) => { onTagIdea(todo.id, id); setShowTagPicker(false); }}
                      onRemove={() => { onTagIdea(todo.id, null); setShowTagPicker(false); }}
                      showRemove={!!todo.ideaId}
                    />
                  </div>
                )}
              </div>

              {/* Linked idea link */}
              {todo.idea && (
                <Link
                  to={`/ideas/${todo.idea.id}`}
                  className="tdm-meta-chip tdm-meta-chip--link"
                  onClick={e => e.stopPropagation()}
                >
                  Go to Project →
                </Link>
              )}
            </div>

            {/* Time block selector */}
            <div className="tdm-field">
              <label className="tdm-field-label">
                <Clock className="w-3.5 h-3.5" />
                Block
              </label>
              <div className="tdm-block-pills">
                {(['morning', 'afternoon', 'evening'] as const).map(b => (
                  <button
                    key={b}
                    className={`tdm-block-pill tdm-block-pill--${b} ${(todo.timeBlock || 'morning') === b ? 'tdm-block-pill--active' : ''}`}
                    onClick={async () => { setSaving(true); await onUpdate(todo.id, { timeBlock: b }); setSaving(false); }}
                  >
                    <span className={`cl-block-dot cl-block-dot--${b}`}></span>
                    {b.charAt(0).toUpperCase() + b.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {(showDueDate || dueDate) && showDueDate ? (
              <div className="tdm-field">
                <label className="tdm-field-label">
                  <Calendar className="w-3.5 h-3.5" />
                  Due Date
                </label>
                <input
                  type="date"
                  className="tdm-field-date"
                  value={dueDate}
                  onChange={e => saveDueDate(e.target.value)}
                />
                {dueDate && (
                  <button className="tdm-field-clear" onClick={() => saveDueDate('')}>Clear</button>
                )}
                <button
                  onClick={() => setShowDueDate(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '11px', padding: '2px 6px' }}
                  title="Collapse"
                >✕</button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="tdm-field" style={{ display: 'flex', justifyContent: 'flex-start', margin: '0 24px 16px' }}>
            <button
              onClick={async () => {
                setSaving(true);
                // Update parentId to null to detach it, and reset date to today
                const today = new Date();
                today.setHours(12, 0, 0, 0);
                await onUpdate(todo.id, { parentId: null, date: today.toISOString() });
                setSaving(false);
                onClose();
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', background: '#eef2ff', color: '#4f46e5',
                border: '1px solid #c7d2fe', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#e0e7ff'}
              onMouseLeave={e => e.currentTarget.style.background = '#eef2ff'}
            >
              <ArrowDownToLine className="w-4 h-4" />
              Make a main task
            </button>
          </div>
        )}

        {/* Notes / Details */}
        <div className="tdm-notes-section">
          <label className="tdm-field-label">
            <AlignLeft className="w-3.5 h-3.5" />
            Notes
          </label>
          <textarea
            ref={notesRef}
            className="tdm-notes-input"
            placeholder="Add details, context, links…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={saveNotes}
            rows={4}
          />
        </div>

        {/* Subtasks preview */}
        {todo.children && todo.children.length > 0 && (
          <div className="tdm-subtasks">
            <label className="tdm-field-label">
              <Check className="w-3.5 h-3.5" />
              Subtasks ({todo.children.filter(c => c.completed).length}/{todo.children.length})
            </label>
            <div className="tdm-subtask-list">
              {todo.children.map(child => (
                <div key={child.id} className={`tdm-subtask ${child.completed ? 'tdm-subtask--done' : ''}`}>
                  <button
                    className={`tdm-subtask-check ${child.completed ? 'tdm-subtask-check--done' : ''}`}
                    onClick={() => onToggleComplete(child)}
                  >
                    {child.completed ? <Check className="w-3 h-3" /> : null}
                  </button>
                  <span className={child.completed ? 'tdm-subtask-text--done' : ''}>{child.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="tdm-footer">
          <div className="tdm-footer-info">
            <button
              onClick={handleDelete}
              title="Delete task"
              style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af',
                padding: '2px', display: 'flex', alignItems: 'center', borderRadius: '4px',
                transition: 'color 0.15s'
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
            >
              <Trash2 className="w-3 h-3" />
            </button>
            <Clock className="w-3 h-3" />
            Created {createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {todo.completedAt && (
              <> · Completed {new Date(todo.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
            )}
          </div>
          <div className="tdm-footer-actions">
            <button
              className="tdm-save-btn"
              onClick={async () => {
                setSaving(true);
                await saveText();
                await saveNotes();
                setSaving(false);
                setSaved(true);
                setTimeout(() => setSaved(false), 1500);
              }}
            >
              <Save className="w-3.5 h-3.5" />
              {saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailModal;
