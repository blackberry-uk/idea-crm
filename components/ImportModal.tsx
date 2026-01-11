
import React, { useState, useMemo } from 'react';
import { useStore, CURRENT_DATA_MODEL_VERSION, ParseResult } from '../store/useStore';
import { 
  X, 
  Check, 
  AlertCircle, 
  Database, 
  Lightbulb, 
  Users, 
  MessageSquare, 
  Calendar,
  CheckSquare,
  Square,
  ShieldAlert,
  HelpCircle
} from 'lucide-react';
import { AppData, Idea, Contact, Note, Interaction } from '../types';

interface ImportModalProps {
  parsedResult: ParseResult;
  onClose: () => void;
}

const ImportModal: React.FC<ImportModalProps> = ({ parsedResult, onClose }) => {
  const { parsedData, fileVersion, orphanFields } = {
    parsedData: parsedResult.data,
    fileVersion: parsedResult.fileVersion,
    orphanFields: parsedResult.orphanFields
  };
  
  const { applyImport, data: currentStoreData } = useStore();
  const [step, setStep] = useState<'selection' | 'success'>('selection');
  
  // Selection state
  const [selectedIdeas, setSelectedIdeas] = useState<Set<string>>(new Set(parsedData.ideas.map(i => i.id)));
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set(parsedData.contacts.map(c => c.id)));
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set(parsedData.notes.map(n => n.id)));
  const [selectedInteractions, setSelectedInteractions] = useState<Set<string>>(new Set(parsedData.interactions.map(i => i.id)));

  const totalOrphans = Object.values(orphanFields).flat().length;
  const hasVersionMismatch = fileVersion !== 0 && fileVersion < CURRENT_DATA_MODEL_VERSION;

  const handleToggle = (type: 'ideas' | 'contacts' | 'notes' | 'interactions', id: string) => {
    const setters = {
      ideas: [selectedIdeas, setSelectedIdeas],
      contacts: [selectedContacts, setSelectedContacts],
      notes: [selectedNotes, setSelectedNotes],
      interactions: [selectedInteractions, setSelectedInteractions]
    } as const;

    const [currentSet, setter] = setters[type];
    const newSet = new Set(currentSet);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setter(newSet as any);
  };

  const handleSelectAll = (type: 'ideas' | 'contacts' | 'notes' | 'interactions', select: boolean) => {
    const list = parsedData[type];
    const setter = {
      ideas: setSelectedIdeas,
      contacts: setSelectedContacts,
      notes: setSelectedNotes,
      interactions: setSelectedInteractions
    }[type];

    if (select) {
      setter(new Set(list.map(item => item.id)) as any);
    } else {
      setter(new Set() as any);
    }
  };

  const handleCommit = () => {
    const selection: Partial<AppData> = {
      ideas: parsedData.ideas.filter(i => selectedIdeas.has(i.id)),
      contacts: parsedData.contacts.filter(c => selectedContacts.has(c.id)),
      notes: parsedData.notes.filter(n => selectedNotes.has(n.id)),
      interactions: parsedData.interactions.filter(i => selectedInteractions.has(i.id))
    };

    applyImport(selection);
    setStep('success');
  };

  const isDuplicate = (type: 'ideas' | 'contacts' | 'notes' | 'interactions', id: string) => {
    return currentStoreData[type].some(item => item.id === id);
  };

  if (step === 'success') {
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200 text-center">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Import Successful!</h2>
          <p className="text-gray-500 mb-8">
            Your selected records have been integrated. Current Data Model: v{CURRENT_DATA_MODEL_VERSION}.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <span className="block font-bold text-gray-900">{selectedIdeas.size}</span>
              <span className="text-gray-400">Ideas</span>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <span className="block font-bold text-gray-900">{selectedContacts.size}</span>
              <span className="text-gray-400">Contacts</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-full py-4 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-all shadow-xl shadow-gray-200"
          >
            Back to App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Review Import</h2>
              <p className="text-sm text-gray-500">
                Data Model: <span className="font-bold">{fileVersion === 0 ? 'Unknown' : `v${fileVersion}`}</span> 
                {hasVersionMismatch && <span className="text-orange-600 ml-2 font-bold"> (Old Version)</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Schema Health Banner */}
        {(totalOrphans > 0 || hasVersionMismatch) && (
          <div className="bg-orange-50 border-b border-orange-100 p-6 flex items-start gap-4">
            <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-orange-900">Schema Compatibility Notice</h4>
              <p className="text-xs text-orange-700 mt-1 leading-relaxed">
                {hasVersionMismatch 
                  ? `This file was exported from an older version of IdeaCRM (v${fileVersion}). We will attempt to migrate it automatically, but some newer fields may remain empty.`
                  : "The imported file contains columns that are not recognized by the current version of the app."}
              </p>
              {totalOrphans > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-[10px] font-black uppercase text-orange-400 block w-full mb-1">Orphan fields (Will be lost):</span>
                  {Object.entries(orphanFields).map(([section, fields]) => 
                    (fields as string[]).map(f => (
                      <span key={`${section}-${f}`} className="px-2 py-0.5 bg-white border border-orange-200 text-orange-600 text-[10px] font-bold rounded flex items-center gap-1">
                        <HelpCircle className="w-3 h-3" />
                        {section}: {f}
                      </span>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
          {/* Section: Ideas */}
          {parsedData.ideas.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-bold text-gray-900">
                  <Lightbulb className="w-5 h-5 text-indigo-500" />
                  Ideas ({parsedData.ideas.length})
                </h3>
                <div className="flex gap-4">
                  <button onClick={() => handleSelectAll('ideas', true)} className="text-xs font-bold text-indigo-600 hover:underline">Select All</button>
                  <button onClick={() => handleSelectAll('ideas', false)} className="text-xs font-bold text-gray-400 hover:underline">Deselect All</button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {parsedData.ideas.map(idea => (
                  <button 
                    key={idea.id}
                    onClick={() => handleToggle('ideas', idea.id)}
                    className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group ${
                      selectedIdeas.has(idea.id) 
                        ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                        : 'bg-white border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className={selectedIdeas.has(idea.id) ? 'text-indigo-600' : 'text-gray-300'}>
                      {selectedIdeas.has(idea.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-gray-900 truncate">{idea.title}</span>
                        {isDuplicate('ideas', idea.id) && (
                          <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[8px] font-black rounded uppercase">Override</span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{idea.status} · {idea.type}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Section: Contacts */}
          {parsedData.contacts.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-bold text-gray-900">
                  <Users className="w-5 h-5 text-green-500" />
                  Contacts ({parsedData.contacts.length})
                </h3>
                <div className="flex gap-4">
                  <button onClick={() => handleSelectAll('contacts', true)} className="text-xs font-bold text-indigo-600 hover:underline">Select All</button>
                  <button onClick={() => handleSelectAll('contacts', false)} className="text-xs font-bold text-gray-400 hover:underline">Deselect All</button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {parsedData.contacts.map(contact => (
                  <button 
                    key={contact.id}
                    onClick={() => handleToggle('contacts', contact.id)}
                    className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group ${
                      selectedContacts.has(contact.id) 
                        ? 'bg-green-50 border-green-200 shadow-sm' 
                        : 'bg-white border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className={selectedContacts.has(contact.id) ? 'text-green-600' : 'text-gray-300'}>
                      {selectedContacts.has(contact.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-gray-900 truncate">{contact.fullName}</span>
                        {isDuplicate('contacts', contact.id) && (
                          <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[8px] font-black rounded uppercase">Override</span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{contact.org}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Section: Notes */}
          {parsedData.notes.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-bold text-gray-900">
                  <MessageSquare className="w-5 h-5 text-blue-500" />
                  Notes ({parsedData.notes.length})
                </h3>
                <div className="flex gap-4">
                  <button onClick={() => handleSelectAll('notes', true)} className="text-xs font-bold text-indigo-600 hover:underline">Select All</button>
                  <button onClick={() => handleSelectAll('notes', false)} className="text-xs font-bold text-gray-400 hover:underline">Deselect All</button>
                </div>
              </div>
              <div className="space-y-2">
                {parsedData.notes.map(note => (
                  <button 
                    key={note.id}
                    onClick={() => handleToggle('notes', note.id)}
                    className={`flex items-start gap-4 p-4 rounded-2xl border transition-all text-left w-full ${
                      selectedNotes.has(note.id) 
                        ? 'bg-blue-50 border-blue-200 shadow-sm' 
                        : 'bg-white border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className={`mt-0.5 ${selectedNotes.has(note.id) ? 'text-blue-600' : 'text-gray-300'}`}>
                      {selectedNotes.has(note.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{note.createdAt}</span>
                        {isDuplicate('notes', note.id) && (
                          <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[8px] font-black rounded uppercase">Override</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2">{note.body}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {parsedData.ideas.length === 0 && parsedData.contacts.length === 0 && (
             <div className="py-20 text-center space-y-4">
                <AlertCircle className="w-12 h-12 text-orange-400 mx-auto" />
                <p className="text-gray-500 font-medium">No recognizable records found in this file.</p>
             </div>
          )}
        </div>

        <div className="p-8 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row gap-4">
          <button 
            onClick={onClose}
            className="flex-1 py-4 text-gray-600 font-bold hover:bg-gray-100 rounded-2xl transition-all"
          >
            Cancel Import
          </button>
          <button 
            disabled={selectedIdeas.size === 0 && selectedContacts.size === 0 && selectedNotes.size === 0 && selectedInteractions.size === 0}
            onClick={handleCommit}
            className="flex-2 py-4 bg-gray-900 text-white font-bold rounded-2xl shadow-xl shadow-gray-200 hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed px-12"
          >
            Import Selected Records
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
