import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Link } from 'react-router-dom';
import { Plus, Search, Mail, Linkedin, Globe, Briefcase, UserPlus, Edit3, Trash2, Check, X, FileText, ChevronDown } from 'lucide-react';
import ContactModal from '../components/ContactModal';

const ENTITY_PILL_STYLE: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
  backgroundColor: '#fce7f3', color: '#be185d', whiteSpace: 'nowrap'
};

const ContactsPage: React.FC = () => {
  const { data, updateContact, deleteContact, addEntity, showToast, confirm } = useStore();
  const [filterQuery, setFilterQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<any | null>(null);

  const openModal = (contact: any | null = null) => {
    setContactToEdit(contact);
    setShowModal(true);
  };

  const [sortField, setSortField] = useState<'createdAt' | 'fullName' | 'org' | 'noteCount'>('fullName');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('asc');

  const handleSort = (field: 'createdAt' | 'fullName' | 'org' | 'noteCount') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'fullName' ? 'asc' : 'desc');
    }
  };

  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('contacts_col_widths');
      return saved ? JSON.parse(saved) : { date: 100, name: 200, role: 150, entities: 300 };
    } catch {
      return { date: 100, name: 200, role: 150, entities: 300 };
    }
  });

  const handleResizeStart = (e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[colId] || 150;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(60, startWidth + (moveEvent.clientX - startX));
      setColWidths(prev => {
        const next = { ...prev, [colId]: newWidth };
        localStorage.setItem('contacts_col_widths', JSON.stringify(next));
        return next;
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Helper to safely parse linkedEntityIds from DB (could be JSON string, array, or null)
  const parseEntityIds = (raw: any): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
    }
    return [];
  };

  const contactsWithNoteCount = data.contacts.map(c => {
    const noteCount = (data.notes || []).filter(n => 
      n.contactId === c.id || (Array.isArray(n.taggedContactIds) && n.taggedContactIds.includes(c.id))
    ).length;
    return { ...c, noteCount, linkedEntityIds: parseEntityIds((c as any).linkedEntityIds) };
  });

  const filteredContacts = contactsWithNoteCount
    .filter(c => {
      const entitiesText = (c.linkedEntityIds || []).map(eid => {
        const e = data.entities.find((ent: any) => ent.id === eid);
        return e ? e.name : '';
      }).join(' ');

      return c.fullName.toLowerCase().includes(filterQuery.toLowerCase()) ||
        (c.org || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
        (c.role || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
        (c.notes || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
        entitiesText.toLowerCase().includes(filterQuery.toLowerCase());
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === 'fullName') {
        comparison = a.fullName.localeCompare(b.fullName);
      } else if (sortField === 'org') {
        comparison = (a.org || '').localeCompare(b.org || '');
      } else if (sortField === 'noteCount') {
        comparison = a.noteCount - b.noteCount;
      } else if (sortField === 'createdAt') {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        comparison = dateA - dateB;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  React.useEffect(() => {
    document.title = 'Contacts | Idea-CRM';
    return () => { document.title = 'IdeaCRM Tracker'; };
  }, []);



  const handleDelete = (contact: any) => {
    confirm({
      title: 'Delete Contact',
      message: `Are you sure you want to delete "${contact.fullName}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteContact(contact.id);
          showToast('Contact deleted', 'success');
        } catch (err) {
          showToast('Failed to delete contact', 'error');
        }
      }
    });
  };

  const renderEntityPills = (entityIds: string[]) => {
    if (!entityIds || entityIds.length === 0) return <span className="text-gray-300 text-xs">—</span>;
    return (
      <div className="flex gap-1.5 flex-wrap">
        {entityIds.map(eid => {
          const ent = data.entities.find((e: any) => e.id === eid);
          if (!ent) return null;
          return (
            <button 
              key={eid} 
              style={{ ...ENTITY_PILL_STYLE, cursor: 'pointer', border: 'none', outline: 'none' }}
              className="hover:opacity-80 transition-opacity active:scale-95"
              onClick={(e) => {
                e.stopPropagation();
                setFilterQuery(ent.name);
              }}
            >
              #{ent.name}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '100%', padding: '2rem' }} className="space-y-6">


      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Contacts</h1>
          <p className="text-gray-500">Managing your network of {data.contacts.length} collaborators</p>
        </div>
        <button
          onClick={() => openModal(null)}
          className="flex items-center justify-center gap-2 text-white px-6 py-2.5 rounded-xl font-semibold shadow-lg transition-all active:scale-95"
          style={{ backgroundColor: 'var(--primary)', boxShadow: '0 10px 15px -3px var(--primary-shadow)' }}
        >
          <UserPlus className="w-5 h-5" />
          Add New Contact
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Filter by name, role, entity, description..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm transition-all focus:outline-none focus:ring-2"
            style={{ ringColor: 'var(--primary)' }}
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-visible">
        {filteredContacts.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <UserPlus className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-sm font-medium">No contacts found</p>
          </div>
        ) : (
          <table className="w-full lg:w-3/4" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <th className="text-left px-4 py-3 cursor-pointer hover:text-gray-600 transition-colors relative group" style={{ width: colWidths.date || 100 }} onClick={() => handleSort('createdAt')}>
                  Date {sortField === 'createdAt' && (sortDirection === 'asc' ? '↑' : '↓')}
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--primary)] transition-colors z-10" onClick={e => e.stopPropagation()} onMouseDown={e => handleResizeStart(e, 'date')} />
                </th>
                <th className="text-left px-6 py-3 cursor-pointer hover:text-gray-600 transition-colors relative group" style={{ width: colWidths.name || 200 }} onClick={() => handleSort('fullName')}>
                  Name {sortField === 'fullName' && (sortDirection === 'asc' ? '↑' : '↓')}
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--primary)] transition-colors z-10" onClick={e => e.stopPropagation()} onMouseDown={e => handleResizeStart(e, 'name')} />
                </th>
                <th className="text-left px-4 py-3 cursor-pointer hover:text-gray-600 transition-colors relative group" style={{ width: colWidths.role || 150 }} onClick={() => handleSort('org')}>
                  Role {sortField === 'org' && (sortDirection === 'asc' ? '↑' : '↓')}
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--primary)] transition-colors z-10" onClick={e => e.stopPropagation()} onMouseDown={e => handleResizeStart(e, 'role')} />
                </th>
                <th className="text-left px-6 py-3 relative group" style={{ width: colWidths.entities || 300 }}>
                  Entities
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--primary)] transition-colors z-10" onClick={e => e.stopPropagation()} onMouseDown={e => handleResizeStart(e, 'entities')} />
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map(contact => (
                <tr key={contact.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      {/* Date */}
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap truncate" style={{ maxWidth: colWidths.date || 100 }}>
                        {contact.createdAt ? new Date(contact.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                      </td>
                      {/* Name with Hover Bubble */}
                      <td className="px-6 py-3 relative" style={{ maxWidth: colWidths.name || 200 }}>
                        <div className="group/name relative inline-flex w-full items-center">
                          <button onClick={() => openModal(contact)} className="flex items-center gap-2.5 cursor-pointer text-left w-full border-none bg-transparent outline-none truncate">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 transition-all group-hover/name:bg-[var(--primary)] group-hover/name:text-white"
                              style={{ backgroundColor: 'var(--primary-shadow)', color: 'var(--primary)' }}
                            >
                              {contact.fullName[0]?.toUpperCase()}
                            </div>
                            <span className="text-sm text-gray-900 group-hover/name:text-[var(--primary)] transition-colors truncate font-normal">
                              {contact.fullName}
                            </span>
                          </button>
                          
                          {/* Hover Popover */}
                          <div className="absolute left-10 top-full mt-2 w-72 bg-white border border-gray-200 shadow-xl rounded-xl p-4 z-50 opacity-0 invisible group-hover/name:opacity-100 group-hover/name:visible transition-all pointer-events-none group-hover/name:pointer-events-auto">
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">
                              <FileText className="w-3.5 h-3.5" />
                              {contact.noteCount} Notes
                            </div>
                            {contact.notes && (
                              <p className="text-xs text-gray-600 mb-3 leading-relaxed whitespace-pre-wrap line-clamp-3">
                                {contact.notes}
                              </p>
                            )}
                            <div className="flex flex-col gap-1.5 pt-2 border-t border-gray-100">
                              {contact.email ? (
                                <a href={`mailto:${contact.email}`} className="text-indigo-500 hover:underline flex items-center gap-1.5 text-xs truncate">
                                  <Mail className="w-3 h-3 shrink-0" /> {contact.email}
                                </a>
                              ) : null}
                              {contact.linkedinUrl ? (
                                <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline flex items-center gap-1.5 text-xs truncate">
                                  <Linkedin className="w-3 h-3 shrink-0" /> {contact.linkedinUrl.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '').replace(/\/$/, '')}
                                </a>
                              ) : null}
                              {!contact.email && !contact.linkedinUrl && (
                                <span className="text-gray-400 text-[10px] italic">No contact info</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      {/* Role */}
                      <td className="px-4 py-3 truncate" style={{ maxWidth: colWidths.role || 150 }}>
                        {contact.role ? (
                          <span className="text-sm font-medium text-gray-700">{contact.role}</span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      {/* Entities */}
                      <td className="px-6 py-3 truncate" style={{ maxWidth: colWidths.entities || 300 }}>
                        {renderEntityPills(contact.linkedEntityIds)}
                      </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ContactModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        contactToEdit={contactToEdit}
      />
    </div>
  );
};

export default ContactsPage;
