import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Contact, Note } from '../types';
import { format } from 'date-fns';
import { StickyNote, Clock, CheckCircle2, RotateCcw, CheckCheck, Microscope, Mountain } from 'lucide-react';
import NoteComposer from './NoteComposer';

interface ContactActivityPanelProps {
  contact: Contact;
}

const INTENT_CONFIG: Record<string, { icon: any, label: string, color: string, bgColor: string, borderColor: string }> = {
  follow_up: { icon: RotateCcw, label: 'Follow up', color: 'text-green-600', bgColor: 'var(--follow-up)', borderColor: 'var(--follow-up-border)' },
  acted_upon: { icon: CheckCheck, label: 'Acted upon', color: 'text-emerald-500', bgColor: '#ecfdf5', borderColor: '#a7f3d0' },
  reflection: { icon: Microscope, label: 'Reflection', color: 'text-gray-400', bgColor: '#f9fafb', borderColor: '#e5e7eb' },
  memoir: { icon: Mountain, label: 'Memoir', color: 'text-amber-600', bgColor: 'var(--note-bg)', borderColor: 'var(--note-border)' },
};

const ContactActivityPanel: React.FC<ContactActivityPanelProps> = ({ contact }) => {
  const { data } = useStore();
  const [showComposer, setShowComposer] = useState(false);

  // Find all notes linked to this contact (either directly via contactId or tagged)
  const contactNotes = data.notes
    .filter(n => n.contactId === contact.id || n.taggedContactIds?.includes(contact.id))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const renderNote = (note: Note) => {
    const isStructured = note.body.startsWith('{') && note.body.includes('"template"');
    const intent = note.intent || 'memoir';
    const config = INTENT_CONFIG[intent] || INTENT_CONFIG.memoir;
    const Icon = config.icon;
    
    // Simple render for body to avoid bringing in the full IdeaDetail complex parser
    let bodyText = note.body;
    if (isStructured) {
      try {
        const parsed = JSON.parse(note.body);
        bodyText = parsed.data || parsed.segments?.map((s:any) => s.comments).join('\n') || 'Structured note';
      } catch (e) {
        bodyText = 'Structured Note';
      }
    }

    return (
      <div key={note.id} className="p-4 rounded-xl border mb-3 text-sm flex gap-3" style={{ backgroundColor: config.bgColor, borderColor: config.borderColor }}>
        <div className={`mt-1 ${config.color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-bold text-gray-700 text-xs">{note.createdBy || 'Unknown'}</span>
            <span className="text-gray-400 text-[10px]">{format(new Date(note.createdAt), "MMM d, yyyy h:mm a")}</span>
            {note.isPinned && <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Pinned</span>}
          </div>
          <div className="text-gray-600 leading-relaxed text-xs overflow-hidden" dangerouslySetInnerHTML={{ __html: isStructured ? bodyText : bodyText.replace(/\n/g, '<br>') }} />
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Activity Log</h3>
        <button 
          onClick={() => setShowComposer(!showComposer)}
          className="text-xs font-bold text-[var(--primary)] hover:underline"
        >
          {showComposer ? 'Cancel' : '+ Add Note'}
        </button>
      </div>

      {showComposer && (
        <div className="mb-4">
          <NoteComposer 
            defaultContactId={contact.id} 
            onComplete={() => setShowComposer(false)}
            onCancel={() => setShowComposer(false)}
            flat
          />
        </div>
      )}

      <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">
        {contactNotes.length > 0 ? (
          contactNotes.map(renderNote)
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-xs font-medium">No activity logged yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactActivityPanel;
