import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Contact } from '../types';
import { X, Plus, Trash2, Edit2, Mail, Phone, Linkedin } from 'lucide-react';

const ENTITY_PILL_STYLE: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
  backgroundColor: '#fce7f3', color: '#be185d', whiteSpace: 'nowrap' as const
};

const LABEL: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: 700, color: '#9ca3af',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px'
};

const INPUT: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: '8px',
  border: '1px solid #d1d5db', fontSize: '13px', outline: 'none'
};

export interface ContactEditPanelProps {
  /** Contact to edit. If null, the panel is in "create" mode. */
  contact?: Contact | null;
  /** Called after a successful save (create or update). */
  onSaved?: () => void;
  /** Called when the user clicks cancel / close. */
  onCancel?: () => void;
  /** Optional callback when the contact's fullName changes (for TaskDetailModal text updates). */
  onNameChanged?: (oldName: string, newName: string) => void;
}

const parseEntityIds = (raw: any): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') { try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
};

const parseIds = (ids: any): string[] => {
  if (!ids) return [];
  if (Array.isArray(ids)) return ids;
  if (typeof ids === 'string') { try { const p = JSON.parse(ids); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
};

const ContactEditPanel: React.FC<ContactEditPanelProps> = ({
  contact = null, onSaved, onCancel, onNameChanged
}) => {
  const { data, addContact, updateContact, addEntity, showToast, deleteContact, confirm } = useStore();
  const entities = data.entities || [];

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [isEditing, setIsEditing] = useState(!contact);

  const [notes, setNotes] = useState('');
  const [isWhatsApp, setIsWhatsApp] = useState(false);
  const [isF2F, setIsF2F] = useState(false);
  const [isExColleague, setIsExColleague] = useState(false);
  const [isPrivateDetails, setIsPrivateDetails] = useState(false);
  const [linkedEntityIds, setLinkedEntityIds] = useState<string[]>([]);
  const [linkedIdeaIds, setLinkedIdeaIds] = useState<string[]>([]);
  const [entitySearch, setEntitySearch] = useState('');
  const [entityDropdownOpen, setEntityDropdownOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const isReadOnly = contact && contact.ownerId !== data.currentUser?.id;

  useEffect(() => {
    if (contact) {
      setFirstName(contact.firstName || '');
      setLastName(contact.lastName || '');
      setRole(contact.role || '');
      setEmail(contact.email || '');
      setPhone(contact.phone || '');
      setLinkedinUrl(contact.linkedinUrl || '');
      setNotes(contact.notes || '');
      setIsWhatsApp(!!contact.isWhatsApp);
      const tags = Array.isArray(contact.tags) ? contact.tags : [];
      setIsF2F(tags.includes('F2F contact'));
      setIsExColleague(tags.includes('ex-colleague'));
      setIsPrivateDetails(!!contact.isPrivateDetails);
      setLinkedEntityIds(parseEntityIds((contact as any).linkedEntityIds));
      setLinkedIdeaIds(parseIds(contact.linkedIdeaIds));
      setIsEditing(false);
    } else {
      setFirstName(''); setLastName(''); setRole(''); setEmail(''); setPhone(''); setLinkedinUrl(''); setNotes(''); setIsWhatsApp(false); setIsF2F(false);
      setIsExColleague(false); setLinkedEntityIds([]); setLinkedIdeaIds([]); setIsEditing(true);
    }
    setEntitySearch(''); setEntityDropdownOpen(false);
  }, [contact]);

  const handleSave = async () => {
    if (!firstName.trim()) { showToast('First name is required', 'error'); return; }
    if (saving) return;
    setSaving(true);

    const fullName = `${firstName} ${lastName}`.trim();
    const tags: string[] = [];
    if (isF2F) tags.push('F2F contact');
    if (isExColleague) tags.push('ex-colleague');

    const payload: any = {
      firstName, lastName, fullName, role, email, phone,
      linkedinUrl,
      notes, isWhatsApp, tags, 
      linkedEntityIds: JSON.stringify(linkedEntityIds),
      isPrivateDetails,
      linkedIdeaIds: JSON.stringify(linkedIdeaIds),
      org: linkedEntityIds.length > 0
        ? linkedEntityIds.map(eId => entities.find(e => e.id === eId)?.name).filter(Boolean).join(', ')
        : ''
    };

    try {
      if (contact) {
        const oldName = contact.fullName;
        await updateContact(contact.id, payload);
        if (onNameChanged && oldName !== fullName) onNameChanged(oldName, fullName);
        showToast('Contact updated', 'success');
      } else {
        await addContact(payload);
        showToast('Contact created', 'success');
      }
      onSaved?.();
    } catch (err) {
      showToast('Failed to save contact', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Entity picker helpers
  const availableEntities = entities
    .filter(e => !linkedEntityIds.includes(e.id))
    .filter(e => !entitySearch || e.name.toLowerCase().includes(entitySearch.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  const exactMatch = entities.some(e => e.name.toLowerCase() === entitySearch.trim().toLowerCase());
  const showCreate = entitySearch.trim().length >= 2 && !exactMatch;

  const toggleIdeaLink = (ideaId: string) => {
    setLinkedIdeaIds(prev => prev.includes(ideaId) ? prev.filter(id => id !== ideaId) : [...prev, ideaId]);
  };

  const row: React.CSSProperties = { display: 'flex', gap: '12px' };
  const half: React.CSSProperties = { flex: 1 };

  if (!isEditing || isReadOnly) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
               <h2 className="text-xl font-bold text-gray-900">{firstName} {lastName}</h2>
               {role && <div className="text-sm text-gray-500">{role}</div>}
            </div>
            {!isReadOnly && (
               <button onClick={() => setIsEditing(true)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors">
                 <Edit2 className="w-4 h-4" />
               </button>
            )}
         </div>

         {isReadOnly && contact?.isPrivateDetails && (
           <div style={{ padding: '12px', background: '#fef2f2', color: '#991b1b', borderRadius: '8px', fontSize: '12px', fontWeight: 500, marginBottom: '12px' }}>
             Email and phone are hidden by the contact owner.
           </div>
         )}
         
         <div className="space-y-3 text-sm">
           {email && !(isReadOnly && contact?.isPrivateDetails) && (
             <div className="flex items-center gap-2">
               <Mail className="w-4 h-4 text-gray-400" />
               <a href={`mailto:${email}`} className="text-indigo-600 hover:underline">{email}</a>
             </div>
           )}
           {phone && !(isReadOnly && contact?.isPrivateDetails) && (
             <div className="flex items-center gap-2">
               <Phone className="w-4 h-4 text-gray-400" />
               <a href={`tel:${phone}`} className="text-indigo-600 hover:underline">{phone}</a>
             </div>
           )}
           {linkedinUrl && (
             <div className="flex items-center gap-2">
               <Linkedin className="w-4 h-4 text-gray-400" />
               <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                 {linkedinUrl.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '').replace(/\/$/, '')}
               </a>
             </div>
           )}
           
           {linkedEntityIds.length > 0 && (
             <div className="flex flex-wrap gap-1.5 mt-2">
               {linkedEntityIds.map(eid => {
                 const ent = entities.find(e => e.id === eid);
                 if (!ent) return null;
                 return <span key={eid} style={ENTITY_PILL_STYLE}>#{ent.name}</span>;
               })}
             </div>
           )}

           {(isWhatsApp || isF2F || isExColleague) && !(isReadOnly && contact?.isPrivateDetails) && (
             <div className="flex gap-4 text-[10px] font-bold text-gray-500 mt-3 uppercase tracking-wider">
                {isWhatsApp && <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">WhatsApp</span>}
                {isF2F && <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">F2F</span>}
                {isExColleague && <span className="flex items-center gap-1 text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">Ex-Colleague</span>}
             </div>
           )}
         </div>
         
         {notes && (
           <div className="mt-2">
             <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Description</div>
             <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{notes}</div>
           </div>
         )}

         {onCancel && (
            <div className="mt-2 flex justify-end">
              <button onClick={onCancel} style={{ padding: '6px 16px', fontSize: '12px', fontWeight: 700, borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#6b7280' }}>
                Close
              </button>
            </div>
         )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Name */}
      <div style={row}>
        <div style={half}>
          <label style={LABEL}>First Name *</label>
          <input disabled={isReadOnly} value={firstName} onChange={e => setFirstName(e.target.value)} style={INPUT} placeholder="Jane" autoFocus={!isReadOnly} />
        </div>
        <div style={half}>
          <label style={LABEL}>Last Name</label>
          <input disabled={isReadOnly} value={lastName} onChange={e => setLastName(e.target.value)} style={INPUT} placeholder="Doe" />
        </div>
      </div>

      {(isReadOnly && contact?.isPrivateDetails) ? (
        <div style={{ padding: '12px', background: '#fef2f2', color: '#991b1b', borderRadius: '8px', fontSize: '12px', fontWeight: 500, margin: '8px 0' }}>
          This contact's details are private. Only the name and description are shared.
        </div>
      ) : (
        <>
          {/* Role + Email */}
          <div style={row}>
        <div style={half}>
          <label style={LABEL}>Role</label>
          <input disabled={isReadOnly} value={role} onChange={e => setRole(e.target.value)} style={INPUT} placeholder="Job Title" />
        </div>
        <div style={half}>
          <label style={LABEL}>Phone</label>
          <input disabled={isReadOnly} value={phone} onChange={e => setPhone(e.target.value)} style={INPUT} placeholder="+1 234 567 8900" type="tel" />
        </div>
      </div>

      <div style={row}>
        <div style={half}>
          <label style={LABEL}>Email</label>
          <input disabled={isReadOnly} value={email} onChange={e => setEmail(e.target.value)} style={INPUT} placeholder="jane@company.com" type="email" />
        </div>
        <div style={half}>
          <label style={LABEL}>LinkedIn URL</label>
          <div style={{ position: 'relative' }}>
            <input disabled={isReadOnly} value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." style={{ ...INPUT, paddingLeft: '32px' }} />
            <span style={{ position: 'absolute', left: '10px', top: '9px', fontSize: '13px' }}>🔗</span>
          </div>
        </div>
      </div>

      {/* Entities */}
      <div style={{ position: 'relative' }}>
        <label style={LABEL}>Entities</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: linkedEntityIds.length > 0 ? '8px' : '0' }}>
          {linkedEntityIds.map(eId => {
            const ent = entities.find(e => e.id === eId);
            if (!ent) return null;
            return (
              <span key={eId} style={ENTITY_PILL_STYLE}>
                #{ent.name}
                {!isReadOnly && <button onClick={() => setLinkedEntityIds(ids => ids.filter(id => id !== eId))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#be185d', fontSize: '13px', padding: '0 2px', lineHeight: 1 }}>×</button>}
              </span>
            );
          })}
        </div>
        {!isReadOnly && (
          <input
            value={entitySearch}
            onChange={e => { setEntitySearch(e.target.value); setEntityDropdownOpen(true); }}
            onFocus={() => setEntityDropdownOpen(true)}
            onBlur={() => setTimeout(() => setEntityDropdownOpen(false), 200)}
            placeholder="Search or create entity..."
            style={INPUT}
          />
        )}
        {entityDropdownOpen && (availableEntities.length > 0 || showCreate) && (
          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 70, width: '100%', background: '#fff', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb', overflow: 'hidden', marginTop: '4px', maxHeight: '200px', overflowY: 'auto' }}>
            {availableEntities.map(ent => (
              <button key={ent.id} onMouseDown={e => { e.preventDefault(); setLinkedEntityIds(ids => [...ids, ent.id]); setEntitySearch(''); setEntityDropdownOpen(false); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', border: 'none', cursor: 'pointer', textAlign: 'left', background: '#fff', transition: 'background 0.1s' }}
              >
                <span style={{ width: '24px', height: '24px', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800, background: '#fce7f3', color: '#be185d' }}>#</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>{ent.name}</span>
              </button>
            ))}
            {showCreate && (
              <button onMouseDown={async e => {
                e.preventDefault();
                const cleanName = entitySearch.trim().replace(/^#+/, '');
                setEntitySearch(''); 
                setEntityDropdownOpen(false);
                try {
                  const newEnt = await addEntity({ name: cleanName });
                  if (newEnt?.id) setLinkedEntityIds(ids => [...ids, newEnt.id]);
                  showToast(`Entity "${cleanName}" created`, 'success');
                } catch { showToast('Failed to create entity', 'error'); }
              }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', border: 'none', borderTop: '1px solid #e5e7eb', cursor: 'pointer', textAlign: 'left', background: '#f0fdf4' }}
              >
                <Plus style={{ width: '14px', height: '14px', color: '#16a34a' }} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#15803d' }}>Create "{entitySearch.trim()}"</span>
              </button>
            )}
          </div>
        )}
      </div>
        </>
      )}

      {/* Notes */}
      <div>
        <label style={LABEL}>Details / Notes</label>
        <textarea disabled={isReadOnly} value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ ...INPUT, resize: 'none' }} placeholder="Background, professional bio..." />
      </div>

      {/* Checkboxes */}
      {!(isReadOnly && contact?.isPrivateDetails) && (
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '4px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#6b7280', cursor: isReadOnly ? 'default' : 'pointer' }}>
            <input disabled={isReadOnly} type="checkbox" checked={isWhatsApp} onChange={e => setIsWhatsApp(e.target.checked)} style={{ cursor: isReadOnly ? 'default' : 'pointer' }} /> WhatsApp contact
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#6b7280', cursor: isReadOnly ? 'default' : 'pointer' }}>
            <input disabled={isReadOnly} type="checkbox" checked={isF2F} onChange={e => setIsF2F(e.target.checked)} style={{ cursor: isReadOnly ? 'default' : 'pointer' }} /> F2F contact
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#6b7280', cursor: isReadOnly ? 'default' : 'pointer' }}>
            <input disabled={isReadOnly} type="checkbox" checked={isExColleague} onChange={e => setIsExColleague(e.target.checked)} style={{ cursor: isReadOnly ? 'default' : 'pointer' }} /> ex-colleague
          </label>
        </div>
      )}

      {!isReadOnly && (
        <div style={{ marginTop: '8px', padding: '10px', background: '#fef2f2', borderRadius: '8px', border: '1px dashed #fca5a5' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#991b1b', cursor: 'pointer' }}>
            <input type="checkbox" checked={isPrivateDetails} onChange={e => setIsPrivateDetails(e.target.checked)} style={{ cursor: 'pointer' }} /> 
            Do not share contact details with project collaborators
          </label>
        </div>
      )}

      {/* Save / Cancel / Delete */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
        <div>
          {contact && !isReadOnly && (
            <button
              onClick={() => {
                confirm({
                  title: 'Delete Contact',
                  message: `Are you sure you want to delete "${contact.fullName}"? This cannot be undone.`,
                  confirmLabel: 'Delete',
                  type: 'danger',
                  onConfirm: async () => {
                    try {
                      await deleteContact(contact.id);
                      showToast('Contact deleted', 'success');
                      if (onSaved) onSaved();
                    } catch (err) {
                      showToast('Failed to delete contact', 'error');
                    }
                  }
                });
              }}
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors flex items-center justify-center"
              title="Delete Contact"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {onCancel && (
            <button onClick={onCancel} style={{ padding: '6px 16px', fontSize: '12px', fontWeight: 700, borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#6b7280' }}>
              {isReadOnly ? 'Close' : 'Cancel'}
            </button>
          )}
          {!isReadOnly && (
            <button onClick={handleSave} disabled={saving}
              style={{ padding: '6px 16px', backgroundColor: '#16a34a', color: '#fff', fontSize: '12px', fontWeight: 700, borderRadius: '6px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Saving...' : contact ? 'Save Details' : 'Create Contact'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactEditPanel;
