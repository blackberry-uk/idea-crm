
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore.ts';
import { Link } from 'react-router-dom';
import { Plus, Lightbulb, MessageSquare, ShieldCheck, ArrowUpDown, Archive, ChevronRight, ChevronDown } from 'lucide-react';
import IdeaModal from '../components/IdeaModal';
import QuickNoteModal from '../components/QuickNoteModal';
import { apiClient } from '../lib/api/client';
import { format } from 'date-fns';
import { getInitials, getAvatarColor } from '../lib/utils';

type SortCol = 'title' | 'lastUpdate' | 'notes' | 'todos';
type SortDir = 'asc' | 'desc';

const IdeasPage: React.FC = () => {
  const { data, myIdeas, deleteIdea, leaveIdea, updateIdea, confirm, showToast, shareIdea, resendInvitation } = useStore();
  const [inviteIdeaId, setInviteIdeaId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeEntity, setActiveEntity] = useState('All');
  const [quickNoteIdea, setQuickNoteIdea] = useState<{ id: string, title: string } | null>(() => {
    const saved = localStorage.getItem('active_quick_note_idea');
    return saved ? JSON.parse(saved) : null;
  });

  // Sub-idea creation state
  const [subIdeaParent, setSubIdeaParent] = useState<{ id: string; title: string; type: string; entity: string } | null>(null);

  // Action menu state
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [actionSubmenu, setActionSubmenu] = useState<'move-parent' | null>(null);
  const submenuTimer = useRef<number | null>(null);
  const openSubmenu = (menu: 'move-parent') => {
    if (submenuTimer.current) window.clearTimeout(submenuTimer.current);
    submenuTimer.current = window.setTimeout(() => setActionSubmenu(menu), 150);
  };
  const cancelSubmenuTimer = () => {
    if (submenuTimer.current) window.clearTimeout(submenuTimer.current);
  };

  // Expanded parent IDs
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('ideas_expanded');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem('ideas_expanded', JSON.stringify([...next]));
      return next;
    });
  };

  const handleSetQuickNoteIdea = (idea: { id: string, title: string } | null) => {
    setQuickNoteIdea(idea);
    if (idea) {
      localStorage.setItem('active_quick_note_idea', JSON.stringify(idea));
    } else {
      localStorage.removeItem('active_quick_note_idea');
    }
  };

  const [sortCol, setSortCol] = useState<SortCol>(
    (localStorage.getItem('ideas_sort_col') as SortCol) || 'lastUpdate'
  );
  const [sortDir, setSortDir] = useState<SortDir>(
    (localStorage.getItem('ideas_sort_dir') as SortDir) || 'desc'
  );

  const handleSort = (col: SortCol) => {
    const newDir = sortCol === col && sortDir === 'asc' ? 'desc' : sortCol === col && sortDir === 'desc' ? 'asc' : col === 'title' ? 'asc' : 'desc';
    setSortCol(col);
    setSortDir(newDir);
    localStorage.setItem('ideas_sort_col', col);
    localStorage.setItem('ideas_sort_dir', newDir);
  };

  // Fetch daily todos to include in counts
  const [dailyTodoCounts, setDailyTodoCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    const fetchDailyTodos = async () => {
      try {
        const from = new Date(); from.setFullYear(from.getFullYear() - 1);
        const to = new Date(); to.setFullYear(to.getFullYear() + 1);
        const all = await apiClient.get(`/daily-todos?from=${from.toISOString()}&to=${to.toISOString()}`) as any[];
        // Count pending daily todos per ideaId
        const counts: Record<string, number> = {};
        for (const t of all) {
          if (t.ideaId && !t.completed) {
            counts[t.ideaId] = (counts[t.ideaId] || 0) + 1;
          }
          // Also count children
          for (const c of (t.children || [])) {
            if (c.ideaId && !c.completed) {
              counts[c.ideaId] = (counts[c.ideaId] || 0) + 1;
            }
          }
        }
        setDailyTodoCounts(counts);
      } catch (err) {
        console.error('Failed to fetch daily todo counts:', err);
      }
    };
    fetchDailyTodos();
  }, []);

  const processIdea = (idea: any) => {
    if (!idea || !idea.id) return null;
    try {
      const ideaNotes = (data.notes || []).filter(n => n.ideaId === idea.id);
      const pendingIdeaTodos = Array.isArray(idea.todos) ? idea.todos.filter((t: any) => !t.completed) : [];
      const pendingDailyTodos = dailyTodoCounts[idea.id] || 0;
      const lastNoteDate = ideaNotes.length > 0
        ? Math.max(...ideaNotes.map(n => new Date(n.createdAt).getTime()))
        : 0;
      const updatedTime = idea.updatedAt ? new Date(idea.updatedAt).getTime() : 0;
      const lastActivityDate = Math.max(isNaN(updatedTime) ? 0 : updatedTime, lastNoteDate);
      return {
        ...idea,
        noteCount: ideaNotes.length,
        todoCount: pendingIdeaTodos.length + pendingDailyTodos,
        lastActivityDate: lastActivityDate || Date.now(),
        children: Array.isArray(idea.children) ? idea.children.map(processIdea).filter(Boolean) : []
      };
    } catch (err) {
      console.error('processIdea error for', idea.id, err);
      return { ...idea, noteCount: 0, todoCount: 0, lastActivityDate: Date.now(), children: [] };
    }
  };

  const processedIdeas = myIdeas.map(processIdea).filter(Boolean);

  // Only show top-level ideas (no parentId) in the main list
  const topLevelIdeas = processedIdeas.filter(i => !i.parentId);

  const entities = ['All', ...(data.currentUser?.personalEntities || [])];
  const [showArchived, setShowArchived] = useState(false);

  const sortedIdeas = topLevelIdeas
    .filter(idea => activeEntity === 'All' || idea.entity === activeEntity)
    .filter(idea => showArchived ? idea.status === 'Archived' : idea.status !== 'Archived')
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortCol) {
        case 'title': return dir * a.title.localeCompare(b.title);
        case 'lastUpdate': return dir * (a.lastActivityDate - b.lastActivityDate);
        case 'notes': return dir * (a.noteCount - b.noteCount);
        case 'todos': return dir * (a.todoCount - b.todoCount);
        default: return 0;
      }
    });

  React.useEffect(() => {
    document.title = 'Project Pipeline | Idea-CRM';
    return () => { document.title = 'IdeaCRM Tracker'; };
  }, []);

  const SortIcon = ({ col }: { col: SortCol }) => (
    <span className={`ideas-sort-icon ${sortCol === col ? 'ideas-sort-icon--active' : ''}`}>
      {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : <ArrowUpDown className="w-3 h-3" />}
    </span>
  );

  const archivedCount = processedIdeas.filter(i => i.status === 'Archived' && !i.parentId).length;

  // Get all top-level, non-archived ideas for the "Move under" submenu
  const moveTargets = processedIdeas.filter(i => !i.parentId && i.status !== 'Archived');

  const statusClass = (s: string) =>
    ['Ideation', 'Scoping', 'Backlog'].includes(s) ? 'ideas-status--amber' :
    ['Research'].includes(s) ? 'ideas-status--blue' :
    ['Prototype', 'Proposal', 'Business Plan'].includes(s) ? 'ideas-status--primary' :
    ['Testing', 'Approval', 'Capital Raise'].includes(s) ? 'ideas-status--purple' :
    ['Launched', 'Execution', 'Active', 'Done'].includes(s) ? 'ideas-status--green' :
    s === 'Dead' || s === 'Archived' ? 'ideas-status--red' : 'ideas-status--gray';

  // Action menu renderer (shared by parent and child rows)
  const renderActionMenu = (idea: any, depth: number, isOwner: boolean) => (
    <div className="wv-task-dropdown" style={{ right: 0, top: '100%', minWidth: '200px' }}>
      <button className="wv-task-dropdown-item" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleSetQuickNoteIdea({ id: idea.id, title: idea.title }); setActionMenuId(null); }}>
        📝 Quick note
      </button>
      <button className="wv-task-dropdown-item" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setSubIdeaParent({ id: idea.id, title: idea.title, type: idea.type, entity: idea.entity }); setActionMenuId(null); }}>
        📂 Add sub-idea
      </button>
      <button className="wv-task-dropdown-item" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setInviteIdeaId(idea.id); setInviteEmail(''); setInviteMsg(''); setActionMenuId(null); }}>
        👥 Invite collaborator
      </button>
      {depth === 0 && <div className="wv-task-dropdown-has-sub" onMouseEnter={() => openSubmenu('move-parent')} onMouseLeave={cancelSubmenuTimer}>
        <button className="wv-task-dropdown-item" style={{ justifyContent: 'space-between' }} onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setActionSubmenu(actionSubmenu === 'move-parent' ? null : 'move-parent'); }}>
          <span>📎 Move under idea</span><span style={{ color: '#9ca3af', fontSize: '1rem' }}>›</span>
        </button>
        {actionSubmenu === 'move-parent' && (
          <div className="wv-task-submenu wv-task-submenu--left" onMouseDown={e => e.stopPropagation()} style={{ maxHeight: '280px', overflowY: 'auto' }}>
            <div style={{ padding: '4px 8px', fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Select parent idea</div>
            {idea.parentId && (
              <button className="wv-task-dropdown-item" style={{ color: 'var(--primary)', fontWeight: 600 }} onMouseDown={async e => { e.preventDefault(); e.stopPropagation(); try { await updateIdea(idea.id, { parentId: null } as any); showToast(`"${idea.title}" is now independent`, 'success'); } catch (err: any) { showToast(err.message || 'Failed', 'error'); } setActionMenuId(null); setActionSubmenu(null); }}>
                🔓 Make independent
              </button>
            )}
            {moveTargets.filter(t => t.id !== idea.id).sort((a, b) => a.title.localeCompare(b.title)).map(target => (
              <button key={target.id} className="wv-task-dropdown-item" onMouseDown={async e => { e.preventDefault(); e.stopPropagation(); try { await updateIdea(idea.id, { parentId: target.id } as any); showToast(`"${idea.title}" moved under "${target.title}"`, 'success'); } catch (err: any) { showToast(err.message || 'Failed', 'error'); } setActionMenuId(null); setActionSubmenu(null); }}>
                💡 {target.title}
              </button>
            ))}
          </div>
        )}
      </div>}
      {/* Make independent — for child ideas */}
      {depth > 0 && idea.parentId && (
        <button className="wv-task-dropdown-item" style={{ color: 'var(--primary)', fontWeight: 600 }} onMouseDown={async e => { e.preventDefault(); e.stopPropagation(); try { await updateIdea(idea.id, { parentId: null } as any); showToast(`"${idea.title}" is now independent`, 'success'); } catch (err: any) { showToast(err.message || 'Failed', 'error'); } setActionMenuId(null); }}>
          🔓 Make independent
        </button>
      )}
      <div style={{ height: '1px', background: '#e5e7eb', margin: '4px 0' }} />
      <button className="wv-task-dropdown-item" onMouseDown={async e => { e.preventDefault(); e.stopPropagation(); const newStatus = idea.status === 'Archived' ? (idea._prevStatus || 'Ideation') : 'Archived'; try { await updateIdea(idea.id, { status: newStatus }); showToast(newStatus === 'Archived' ? `"${idea.title}" archived` : `"${idea.title}" reactivated`, 'success'); } catch (err: any) { showToast(err.message || 'Failed', 'error'); } setActionMenuId(null); }}>
        {idea.status === 'Archived' ? '↩️ Reactivate' : '📦 Archive'}
      </button>
      <button className="wv-task-dropdown-item wv-task-dropdown-item--danger" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setActionMenuId(null); if (isOwner) { confirm({ title: 'Delete Idea', message: `Permanently delete "${idea.title}"?`, confirmLabel: 'Delete', type: 'danger', onConfirm: async () => { try { await deleteIdea(idea.id); showToast('Idea deleted', 'success'); } catch (err: any) { showToast(err.message || 'Failed', 'error'); } } }); } else { confirm({ title: 'Leave Project', message: `Stop collaborating on "${idea.title}"?`, confirmLabel: 'Leave', type: 'danger', onConfirm: async () => { try { await leaveIdea(idea.id); showToast('Left project', 'info'); } catch (err: any) { showToast(err.message || 'Failed', 'error'); } } }); } }}>
        {isOwner ? '🗑️ Delete' : '🚪 Leave project'}
      </button>
    </div>
  );

  // Renders a single idea row (parent or child)
  const renderIdeaRow = (idea: any, depth: number = 0) => {
    const isOwner = idea.ownerId === data.currentUser?.id;
    const hasChildren = idea.children && idea.children.length > 0;
    const isExpanded = expandedIds.has(idea.id);
    const activeChildren = (idea.children || []).filter((c: any) => c.status !== 'Archived');
    const isMenuOpen = actionMenuId === idea.id;
    const acceptedCollabs = (data.users || []).filter(u => idea.collaboratorIds?.includes(u.id));
    const pendingInvites = (data.invitations || []).filter(inv => inv.ideaId === idea.id && inv.status === 'Pending');

    return (
      <React.Fragment key={idea.id}>
        <tr className={`ideas-row ${idea.status === 'Archived' ? 'ideas-row--archived' : ''} ${depth > 0 ? 'ideas-row--child' : ''}`}>
          <td className="ideas-td" style={depth > 0 ? { paddingLeft: `${depth * 2}rem` } : undefined}>
            <div className="ideas-title-cell" style={{ position: 'relative' }}>
              {depth > 0 && <span className="ideas-tree-connector">└</span>}
              {depth === 0 && hasChildren ? (
                <button className="ideas-expand-btn" onClick={() => toggleExpanded(idea.id)}>
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              ) : depth === 0 ? <span className="ideas-expand-placeholder" /> : null}
              <span className="ideas-title-hover-wrap">
                <Link to={`/ideas/${idea.id}`} className="ideas-title-link">{idea.title}</Link>
                <div className="ideas-title-tooltip">
                  <span className={`ideas-status-badge ${statusClass(idea.status)}`} style={{ marginBottom: '6px', display: 'inline-block' }}>{idea.status}</span>
                  {idea.oneLiner ? <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.5 }}>{idea.oneLiner}</p> : <p style={{ margin: 0, fontSize: '0.7rem', color: '#9ca3af', fontStyle: 'italic' }}>No description</p>}
                </div>
              </span>
              {hasChildren && <span className="ideas-child-count">{activeChildren.length}</span>}
            </div>
          </td>
          <td className="ideas-td ideas-td--hide-mobile"><span className="ideas-entity-badge">{idea.entity}</span></td>
          <td className="ideas-td ideas-td--center ideas-td--muted">{format(new Date(idea.lastActivityDate), 'MMM d')}</td>
          <td className="ideas-td ideas-td--center"><span className="ideas-count" style={{ color: 'var(--primary)' }}><MessageSquare className="w-3 h-3" />{idea.noteCount}</span></td>
          <td className="ideas-td ideas-td--center"><span className="ideas-count ideas-count--amber"><ShieldCheck className="w-3 h-3" />{idea.todoCount}</span></td>
          <td className="ideas-td ideas-td--hide-mobile" style={{ maxWidth: '220px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '220px' }}>
              {acceptedCollabs.map(u => (
                <span key={u.id} title={`${u.name} (collaborator)`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700, color: '#166534', backgroundColor: '#dcfce7', border: '1px solid #bbf7d0', whiteSpace: 'nowrap' }}>✓ {u.name}</span>
              ))}
              {pendingInvites.map(inv => (
                <span key={inv.id} title={`${inv.email} (pending — click to resend)`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700, color: '#92400e', backgroundColor: '#fef3c7', border: '1px solid #fde68a', whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={async () => { try { await resendInvitation(inv.id); showToast(`Invitation resent to ${inv.email}`, 'success'); } catch (err: any) { showToast(err.message || 'Failed', 'error'); } }}>⏳ {inv.email}</span>
              ))}
            </div>
          </td>
          <td className="ideas-td ideas-td--center">
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button className="ideas-action-btn" onClick={e => { e.stopPropagation(); if (isMenuOpen) { setActionMenuId(null); setActionSubmenu(null); } else { setActionMenuId(idea.id); setActionSubmenu(null); } }} style={{ padding: '4px 6px' }}>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>
              {isMenuOpen && renderActionMenu(idea, depth, isOwner)}
            </div>
          </td>
        </tr>
        {isExpanded && hasChildren && (idea.children || [])
          .filter((c: any) => showArchived ? c.status === 'Archived' : c.status !== 'Archived')
          .map((child: any) => renderIdeaRow(child, depth + 1))
        }
      </React.Fragment>
    );
  };

  return (
    <div style={{ maxWidth: '100%', padding: '2rem 2rem 2rem 2rem' }} className="space-y-5">
      {/* Click-away backdrop for action menu */}
      {actionMenuId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => { setActionMenuId(null); setActionSubmenu(null); }} />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Project Pipeline</h1>
          <p className="text-sm text-gray-400">{sortedIdeas.length} Projects</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center justify-center gap-2 text-white px-5 py-2 rounded-xl font-semibold shadow-lg transition-all active:scale-95 text-sm"
          style={{ backgroundColor: 'var(--primary)', boxShadow: '0 10px 15px -3px var(--primary-shadow)' }}
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Entity Filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {entities.map(entity => (
          <button
            key={entity}
            onClick={() => { setActiveEntity(entity); setShowArchived(false); }}
            className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all border shadow-sm ${activeEntity === entity && !showArchived
              ? 'text-white'
              : 'bg-white border-gray-100 text-gray-400 hover:border-[var(--primary)]'
            }`}
            style={activeEntity === entity && !showArchived ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' } : {}}
          >
            {entity}
          </button>
        ))}
        <span className="mx-1 text-gray-200">|</span>
        <button
          onClick={() => setShowArchived(!showArchived)}
          className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all border shadow-sm flex items-center gap-1.5 ${showArchived
            ? 'bg-gray-700 border-gray-700 text-white'
            : 'bg-white border-gray-100 text-gray-400 hover:border-gray-300'
          }`}
        >
          <Archive className="w-3 h-3" />
          Archived ({archivedCount})
        </button>
      </div>

      {/* Sortable Ideas Table */}
      <section className="overflow-visible">
        <table className="ideas-table">
          <thead>
            <tr>
              <th className="ideas-th ideas-th--sortable" onClick={() => handleSort('title')}>
                Project <SortIcon col="title" />
              </th>
              <th className="ideas-th ideas-th--hide-mobile">Entity</th>
              <th className="ideas-th ideas-th--sortable ideas-th--center" onClick={() => handleSort('lastUpdate')}>
                Updated <SortIcon col="lastUpdate" />
              </th>
              <th className="ideas-th ideas-th--sortable ideas-th--center" onClick={() => handleSort('notes')}>
                Notes <SortIcon col="notes" />
              </th>
              <th className="ideas-th ideas-th--sortable ideas-th--center" onClick={() => handleSort('todos')}>
                Todos <SortIcon col="todos" />
              </th>
              <th className="ideas-th ideas-th--hide-mobile">People</th>
              <th className="ideas-th" style={{ width: '3rem' }}></th>
            </tr>
          </thead>
          <tbody>
            {sortedIdeas.map(idea => renderIdeaRow(idea, 0))}
          </tbody>
        </table>
        {sortedIdeas.length === 0 && (
          <div className="py-16 text-center">
            <Lightbulb className="w-8 h-8 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No ideas found</p>
          </div>
        )}
      </section>

      {/* New Idea Modal (top-level) */}
      <IdeaModal isOpen={showAddForm} onClose={() => setShowAddForm(false)} />

      {/* New Sub-Idea Modal */}
      <IdeaModal
        isOpen={!!subIdeaParent}
        onClose={() => setSubIdeaParent(null)}
        parentId={subIdeaParent?.id}
        parentTitle={subIdeaParent?.title}
        parentType={subIdeaParent?.type}
        parentEntity={subIdeaParent?.entity}
      />

      <QuickNoteModal
        isOpen={!!quickNoteIdea}
        onClose={() => handleSetQuickNoteIdea(null)}
        ideaId={quickNoteIdea?.id || ''}
        ideaTitle={quickNoteIdea?.title || ''}
      />

      {/* Invite Collaborator Modal */}
      {inviteIdeaId && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }} onClick={() => setInviteIdeaId(null)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 210, background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700 }}>👥 Invite Collaborator</h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.75rem', color: '#9ca3af' }}>
              to "{processedIdeas.find(i => i.id === inviteIdeaId)?.title}"
            </p>
            <form onSubmit={async e => {
              e.preventDefault();
              if (!inviteEmail.trim()) return;
              try {
                await shareIdea(inviteIdeaId, inviteEmail.trim(), inviteMsg || undefined);
                showToast(`Invitation sent to ${inviteEmail.trim()}`, 'success');
                setInviteIdeaId(null); setInviteEmail(''); setInviteMsg('');
              } catch (err: any) { showToast(err.message || 'Failed to invite', 'error'); }
            }}>
              <input type="email" placeholder="Email address" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '0.85rem', marginBottom: '10px', outline: 'none', boxSizing: 'border-box' }} />
              <textarea placeholder="Personal message (optional)" value={inviteMsg} onChange={e => setInviteMsg(e.target.value)} rows={2} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '0.8rem', marginBottom: '16px', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setInviteIdeaId(null)} style={{ padding: '8px 16px', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 16px', borderRadius: '10px', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Send Invitation</button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
};

export default IdeasPage;
