import React, { useState, useRef, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, getDay, addMonths, subMonths, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, User } from 'lucide-react';
import { DailyTodoData } from './DailyTodoItem';
import IdeaPickerDropdown from './IdeaPickerDropdown';
import { useStore } from '../store/useStore';
import { getInitials } from '../lib/utils';

interface TaskChevronMenuProps {
  todo: DailyTodoData;
  ideas: { id: string; title: string; status?: string }[];
  onClose: () => void;
  onOpenDetail?: (todo: DailyTodoData) => void;
  onToggleUrgent?: (todo: DailyTodoData) => void;
  onTagIdea?: (todoId: string, ideaId: string | null) => void;
  onChangeDate?: (todoId: string, dateKey: string | null) => void;
  onChangeTimeBlock?: (todoId: string, block: string) => void;
  onAssigneeChange?: (todoId: string, assigneeId: string | null) => void;
  onDuplicate?: (todoId: string) => void;
  onDelete?: (todoId: string) => void;
}

export const TaskChevronMenu: React.FC<TaskChevronMenuProps> = ({
  todo,
  ideas,
  onClose,
  onOpenDetail,
  onToggleUrgent,
  onTagIdea,
  onChangeDate,
  onChangeTimeBlock,
  onAssigneeChange,
  onDuplicate,
  onDelete
}) => {
  const [ideaSubmenu, setIdeaSubmenu] = useState(false);
  const [dateSubmenu, setDateSubmenu] = useState(false);
  const [timeSubmenu, setTimeSubmenu] = useState(false);
  const [assigneeSubmenu, setAssigneeSubmenu] = useState(false);
  const [submenuSide, setSubmenuSide] = useState<'right' | 'left'>('right');

  const menuRef = useRef<HTMLDivElement>(null);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const enterTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      if (rect.right + 260 > window.innerWidth) {
        setSubmenuSide('left');
      } else {
        setSubmenuSide('right');
      }
    }
  }, []);

  const handleMouseEnter = (menu: 'idea' | 'date' | 'time') => {
    if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    if (enterTimeoutRef.current) clearTimeout(enterTimeoutRef.current);
    enterTimeoutRef.current = setTimeout(() => {
      setIdeaSubmenu(menu === 'idea');
      setDateSubmenu(menu === 'date');
      setTimeSubmenu(menu === 'time');
      setAssigneeSubmenu(menu === 'assignee');
    }, 150); // Delay before opening to prevent accidental triggers when moving diagonally
  };

  const handleMouseLeave = () => {
    if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    if (enterTimeoutRef.current) clearTimeout(enterTimeoutRef.current);
    leaveTimeoutRef.current = setTimeout(() => {
      setIdeaSubmenu(false);
      setDateSubmenu(false);
      setTimeSubmenu(false);
      setAssigneeSubmenu(false);
    }, 250); // Generous delay to allow diagonal mouse movement
  };

  const [calMonth, setCalMonth] = useState(() => todo.date ? new Date(String(todo.date).slice(0, 10) + 'T12:00:00') : new Date());

  const monthStart = startOfMonth(calMonth);
  const monthEnd = endOfMonth(calMonth);
  const startDow = getDay(monthStart); // 0=Sun
  const daysInMonth = monthEnd.getDate();
  const calDays: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) calDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calDays.push(new Date(calMonth.getFullYear(), calMonth.getMonth(), d));
  const selectedDateKey = todo.date ? String(todo.date).slice(0, 10) : '';

  const { data } = useStore();
  let projectCollaborators: any[] = [];
  if (todo.ideaId) {
    const idea = ideas.find(i => i.id === todo.ideaId);
    if (idea && (idea as any).collaboratorIds && (idea as any).collaboratorIds.length > 0) {
      const allowed = [(idea as any).ownerId, ...(idea as any).collaboratorIds];
      projectCollaborators = data.users.filter(u => allowed.includes(u.id));
    }
  }

  return (
    <div ref={menuRef} className="wv-task-dropdown" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
      {onChangeDate && (
        <button className="wv-task-dropdown-item" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onChangeDate(todo.id, null); onClose(); }}>
          <span>📥 Move to Backburner</span>
        </button>
      )}

      {onOpenDetail && (
        <button className="wv-task-dropdown-item" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onOpenDetail(todo); onClose(); }}>
          <span>✏️ Edit task details</span>
        </button>
      )}

      {onDuplicate && (
        <button className="wv-task-dropdown-item" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onDuplicate(todo.id); onClose(); }}>
          <span>📋 Duplicate to next day</span>
        </button>
      )}

      {onToggleUrgent && (
        <button className="wv-task-dropdown-item" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onToggleUrgent(todo); onClose(); }}>
          <span>🔥 Toggle priority</span>
        </button>
      )}

      {onTagIdea && (
        <div className="wv-task-dropdown-has-sub" onMouseEnter={() => handleMouseEnter('idea')} onMouseLeave={handleMouseLeave}>
          <button className="wv-task-dropdown-item" style={{ justifyContent: 'space-between' }} onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleMouseEnter('idea'); }}>
            <span>🏷️ Tag to idea</span>
            <span style={{ color: '#9ca3af', fontSize: '1rem' }}>›</span>
          </button>
          {ideaSubmenu && (
            <div className={`wv-task-submenu wv-task-submenu--${submenuSide}`} onMouseDown={e => e.stopPropagation()} style={{ width: '260px' }}>
              <IdeaPickerDropdown
                ideas={ideas}
                selectedIdeaId={todo.ideaId}
                onSelect={(id) => { onTagIdea(todo.id, id); onClose(); setIdeaSubmenu(false); }}
                onRemove={() => { onTagIdea(todo.id, null); onClose(); setIdeaSubmenu(false); }}
                showRemove={!!todo.ideaId}
              />
            </div>
          )}
        </div>
      )}

      {onAssigneeChange && projectCollaborators.length > 0 && (
        <div className="wv-task-dropdown-has-sub" onMouseEnter={() => handleMouseEnter('assignee')} onMouseLeave={handleMouseLeave}>
          <button className="wv-task-dropdown-item" style={{ justifyContent: 'space-between' }} onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleMouseEnter('assignee'); }}>
            <span>👤 Assign to collaborator</span>
            <span style={{ color: '#9ca3af', fontSize: '1rem' }}>›</span>
          </button>
          {assigneeSubmenu && (
            <div className={`wv-task-submenu wv-task-submenu--${submenuSide}`} onMouseDown={e => e.stopPropagation()} style={{ minWidth: '180px', padding: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '8px' }}>Assign to</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <button 
                   onClick={() => { onAssigneeChange(todo.id, null); onClose(); }}
                   style={{ textAlign: 'left', padding: '6px 8px', borderRadius: '6px', fontSize: '12px', background: !todo.assigneeId ? '#f3f4f6' : 'transparent', border: 'none', cursor: 'pointer' }}
                >
                   Unassigned
                </button>
                {projectCollaborators.map(u => (
                  <button
                    key={u.id}
                    onClick={() => { onAssigneeChange(todo.id, u.id); onClose(); }}
                    style={{ textAlign: 'left', padding: '6px 8px', borderRadius: '6px', fontSize: '12px', background: todo.assigneeId === u.id ? '#f3f4f6' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: u.avatarColor || '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#fff', fontWeight: 800 }}>
                      {getInitials(u.name)}
                    </div>
                    {u.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {onChangeDate && (
        <div className="wv-task-dropdown-has-sub" onMouseEnter={() => handleMouseEnter('date')} onMouseLeave={handleMouseLeave}>
          <button className="wv-task-dropdown-item" style={{ justifyContent: 'space-between' }} onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleMouseEnter('date'); }}>
            <span>📅 Move to different date</span>
            <span style={{ color: '#9ca3af', fontSize: '1rem' }}>›</span>
          </button>
          {dateSubmenu && (
            <div className={`wv-task-submenu wv-task-submenu--${submenuSide}`} style={{ cursor: 'default', padding: '8px', minWidth: '220px' }} onMouseDown={e => e.stopPropagation()}>
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
                      onMouseDown={(e) => {
                        e.preventDefault(); e.stopPropagation();
                        onChangeDate(todo.id, dk);
                        onClose();
                      }}
                    >
                      {cd.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {onChangeTimeBlock && (
        <div className="wv-task-dropdown-has-sub" onMouseEnter={() => handleMouseEnter('time')} onMouseLeave={handleMouseLeave}>
          <button className="wv-task-dropdown-item" style={{ justifyContent: 'space-between' }} onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleMouseEnter('time'); }}>
            <span>⏰ Move to different time of day</span>
            <span style={{ color: '#9ca3af', fontSize: '1rem' }}>›</span>
          </button>
          {timeSubmenu && (
            <div className={`wv-task-submenu wv-task-submenu--${submenuSide}`} onMouseDown={e => e.stopPropagation()}>
              <div style={{ padding: '4px 8px', fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Time Block</div>
              <button className="wv-task-dropdown-item" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onChangeTimeBlock(todo.id, 'morning'); onClose(); }}>
                AM (Morning)
              </button>
              <button className="wv-task-dropdown-item" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onChangeTimeBlock(todo.id, 'afternoon'); onClose(); }}>
                PM (Afternoon)
              </button>
              <button className="wv-task-dropdown-item" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onChangeTimeBlock(todo.id, 'evening'); onClose(); }}>
                EVE (Evening)
              </button>
            </div>
          )}
        </div>
      )}

      {onDelete && (
        <>
          <div style={{ height: '1px', background: '#e5e7eb', margin: '4px 0' }} />
          <button className="wv-task-dropdown-item wv-task-dropdown-item--danger" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onDelete(todo.id); onClose(); }}>
            <span>🗑️ Delete task</span>
          </button>
        </>
      )}
    </div>
  );
};
