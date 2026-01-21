
import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Contact } from '../types';
import {
  X,
  Linkedin,
  Instagram,
  Twitter,
  BookOpen,
  MessageCircle,
  Tag as TagIcon,
  Lightbulb,
  Plus,
  UserPlus
} from 'lucide-react';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialIdeaIds?: string[];
  contactToEdit?: Contact | null;
}

const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose, initialIdeaIds = [], contactToEdit = null }) => {
  const { data, addContact, updateContact, showToast } = useStore();

  const [newContact, setNewContact] = useState({
    firstName: '',
    lastName: '',
    org: '',
    role: '',
    email: '',
    phone: '',
    country: '',
    linkedinUrl: '',
    instagramUrl: '',
    twitterUrl: '',
    substackUrl: '',
    isWhatsApp: false,
    notes: '',
    relationshipStrength: 3,
    linkedIdeaIds: [] as string[]
  });

  const parseIds = (ids: any): string[] => {
    if (!ids) return [];
    if (Array.isArray(ids)) return ids;
    if (typeof ids === 'string') {
      try {
        const parsed = JSON.parse(ids);
        return Array.isArray(parsed) ? parsed : [];
      } catch { return []; }
    }
    return [];
  };

  // Initialize form only when the modal opens or the target contact changes
  React.useEffect(() => {
    if (!isOpen) return;

    if (contactToEdit) {
      setNewContact({
        firstName: contactToEdit.firstName || '',
        lastName: contactToEdit.lastName || '',
        org: contactToEdit.org || '',
        role: contactToEdit.role || '',
        email: contactToEdit.email || '',
        phone: contactToEdit.phone || '',
        country: contactToEdit.country || '',
        linkedinUrl: contactToEdit.linkedinUrl || '',
        instagramUrl: contactToEdit.instagramUrl || '',
        twitterUrl: contactToEdit.twitterUrl || '',
        substackUrl: contactToEdit.substackUrl || '',
        isWhatsApp: !!contactToEdit.isWhatsApp,
        notes: contactToEdit.notes || '',
        relationshipStrength: contactToEdit.relationshipStrength || 3,
        linkedIdeaIds: parseIds(contactToEdit.linkedIdeaIds)
      });
    } else {
      setNewContact({
        firstName: '', lastName: '', org: '', role: '', email: '', phone: '', country: '',
        linkedinUrl: '', instagramUrl: '', twitterUrl: '', substackUrl: '',
        isWhatsApp: false, notes: '', relationshipStrength: 3,
        linkedIdeaIds: parseIds(initialIdeaIds)
      });
    }
  }, [isOpen, contactToEdit]);

  if (!isOpen) return null;

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.firstName.trim()) {
      showToast("First name is required.", "error");
      return;
    }

    const payload = {
      ...newContact,
      fullName: `${newContact.firstName} ${newContact.lastName}`.trim(),
      linkedIdeaIds: JSON.stringify(newContact.linkedIdeaIds)
    };

    if (contactToEdit) {
      updateContact(contactToEdit.id, payload);
      showToast("Contact updated successfully", "success");
    } else {
      addContact(payload);
      showToast("Contact added successfully", "success");
    }
    onClose();
  };

  const toggleIdeaLink = (ideaId: string) => {
    setNewContact(prev => {
      const isLinked = prev.linkedIdeaIds.includes(ideaId);
      if (isLinked) {
        return { ...prev, linkedIdeaIds: prev.linkedIdeaIds.filter(lid => lid !== ideaId) };
      } else {
        return { ...prev, linkedIdeaIds: [...prev.linkedIdeaIds, ideaId] };
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-0 animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg text-white" style={{ backgroundColor: 'var(--primary)' }}>
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Add New Contact</h2>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Expand your network</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-8 space-y-8">
          {/* Section: Basic Info */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">First Name *</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 outline-none bg-gray-50"
                style={{ ringColor: 'var(--primary)' }}
                value={newContact.firstName}
                onChange={e => setNewContact({ ...newContact, firstName: e.target.value })}
                placeholder="e.g. Jane"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Last Name</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 outline-none bg-gray-50"
                style={{ ringColor: 'var(--primary)' }}
                value={newContact.lastName}
                onChange={e => setNewContact({ ...newContact, lastName: e.target.value })}
                placeholder="e.g. Doe"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Organization *</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 outline-none bg-gray-50"
                style={{ ringColor: 'var(--primary)' }}
                value={newContact.org}
                onChange={e => setNewContact({ ...newContact, org: e.target.value })}
                placeholder="Company Name"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Role</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 outline-none bg-gray-50"
                style={{ ringColor: 'var(--primary)' }}
                value={newContact.role}
                onChange={e => setNewContact({ ...newContact, role: e.target.value })}
                placeholder="Job Title"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Email Address</label>
              <input
                type="email"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 outline-none bg-gray-50"
                style={{ ringColor: 'var(--primary)' }}
                value={newContact.email}
                onChange={e => setNewContact({ ...newContact, email: e.target.value })}
                placeholder="jane@company.com"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Phone</label>
              <input
                type="tel"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50"
                value={newContact.phone}
                onChange={e => setNewContact({ ...newContact, phone: e.target.value })}
                placeholder="+1 234 567 890"
              />
            </div>
            <div className="relative">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Country</label>
              <input
                type="text"
                list="countries"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 outline-none bg-gray-50 search-none"
                style={{ ringColor: 'var(--primary)' }}
                value={newContact.country}
                onChange={e => setNewContact({ ...newContact, country: e.target.value })}
                placeholder="Search or type country..."
              />
              <datalist id="countries">
                <option value="United States" />
                <option value="United Kingdom" />
                <option value="Germany" />
                <option value="France" />
                <option value="Spain" />
                <option value="Italy" />
                <option value="Canada" />
                <option value="Australia" />
                <option value="Netherlands" />
                <option value="Switzerland" />
                <option value="Sweden" />
                <option value="Norway" />
                <option value="Denmark" />
                <option value="Finland" />
                <option value="Ireland" />
                <option value="Austria" />
                <option value="Belgium" />
                <option value="Portugal" />
                <option value="Greece" />
                <option value="Luxembourg" />
                <option value="Singapore" />
                <option value="Japan" />
                <option value="South Korea" />
                <option value="China" />
                <option value="India" />
                <option value="Brazil" />
                <option value="Mexico" />
                <option value="Argentina" />
                <option value="Chile" />
                <option value="Colombia" />
                <option value="Peru" />
                <option value="Israel" />
                <option value="United Arab Emirates" />
                <option value="Saudi Arabia" />
                <option value="South Africa" />
                <option value="New Zealand" />
                <option value="Turkey" />
                <option value="Poland" />
                <option value="Czech Republic" />
                <option value="Hungary" />
                <option value="Romania" />
                <option value="Thailand" />
                <option value="Vietnam" />
                <option value="Indonesia" />
                <option value="Malaysia" />
                <option value="Philippines" />
                <option value="Ukraine" />
                <option value="Estonia" />
                <option value="Latvia" />
                <option value="Lithuania" />
              </datalist>
            </div>
          </div>

          {/* Section: Social Media Profiles */}
          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              Social Profiles
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600" />
                <input
                  type="url"
                  className="w-full pl-10 pr-4 py-3 text-xs border border-gray-200 rounded-xl outline-none focus:ring-2"
                  style={{ ringColor: 'var(--primary)' }}
                  value={newContact.linkedinUrl}
                  onChange={e => setNewContact({ ...newContact, linkedinUrl: e.target.value })}
                  placeholder="LinkedIn URL"
                />
              </div>
              <div className="relative">
                <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-900" />
                <input
                  type="url"
                  className="w-full pl-10 pr-4 py-3 text-xs border border-gray-200 rounded-xl outline-none focus:ring-2"
                  style={{ ringColor: 'var(--primary)' }}
                  value={newContact.twitterUrl}
                  onChange={e => setNewContact({ ...newContact, twitterUrl: e.target.value })}
                  placeholder="X (Twitter) URL"
                />
              </div>
              <div className="relative">
                <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pink-600" />
                <input
                  type="url"
                  className="w-full pl-10 pr-4 py-3 text-xs border border-gray-200 rounded-xl outline-none focus:ring-2"
                  style={{ ringColor: 'var(--primary)' }}
                  value={newContact.instagramUrl}
                  onChange={e => setNewContact({ ...newContact, instagramUrl: e.target.value })}
                  placeholder="Instagram URL"
                />
              </div>
              <div className="relative">
                <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-600" />
                <input
                  type="url"
                  className="w-full pl-10 pr-4 py-3 text-xs border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newContact.substackUrl}
                  onChange={e => setNewContact({ ...newContact, substackUrl: e.target.value })}
                  placeholder="Substack URL"
                />
              </div>
            </div>
          </div>

          {/* Section: Communications & Relationship */}
          <div className="grid grid-cols-2 gap-8 items-start">
            <div className="space-y-4">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Preferences</label>
              <label className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-100 cursor-pointer group hover:bg-green-100 transition-colors">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-green-200">
                  <MessageCircle className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-green-900">WhatsApp Contact</p>
                  <p className="text-[10px] text-green-700">Preferred channel for quick updates</p>
                </div>
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-green-300 text-green-600 focus:ring-green-500 cursor-pointer"
                  checked={newContact.isWhatsApp}
                  onChange={e => setNewContact({ ...newContact, isWhatsApp: e.target.checked })}
                />
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Contact Description</label>
              <textarea
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 outline-none bg-gray-50 min-h-[140px] resize-none text-sm"
                style={{ ringColor: 'var(--primary)' }}
                placeholder="Background, professional bio, mutual connections, or context..."
                value={newContact.notes}
                onChange={e => setNewContact({ ...newContact, notes: e.target.value })}
              />
            </div>
          </div>

          {/* Section: Idea Linking */}
          <div className="border-t border-gray-100 pt-6">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <TagIcon className="w-3 h-3" />
              Link to Ideas
            </label>

            <div className="flex flex-wrap gap-2 mb-4">
              {newContact.linkedIdeaIds.map(lid => {
                const linkedIdea = data.ideas.find(i => i.id === lid);
                return (
                  <div key={lid} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold animate-in fade-in zoom-in-90" style={{ backgroundColor: 'var(--primary-shadow)', color: 'var(--primary)', borderColor: 'var(--primary)' }}>
                    <Lightbulb className="w-3 h-3" />
                    {linkedIdea?.title || lid}
                    <button onClick={() => toggleIdeaLink(lid)} className="hover:bg-[var(--primary)]/20 rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
              {newContact.linkedIdeaIds.length === 0 && (
                <p className="text-xs text-gray-400 italic">No ideas linked. This will be a general contact.</p>
              )}
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
              {data.ideas.filter(i => !newContact.linkedIdeaIds.includes(i.id)).map(otherIdea => (
                <button
                  key={otherIdea.id}
                  onClick={() => toggleIdeaLink(otherIdea.id)}
                  className="w-full text-left p-3 hover:bg-[var(--primary)]/10 rounded-xl border border-transparent hover:border-[var(--primary)]/30 flex items-center justify-between group transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-white group-hover:text-[var(--primary)] group-hover:shadow-sm transition-all">
                      <Plus className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-semibold text-gray-600 group-hover:text-black">{otherIdea.title}</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-gray-300">{otherIdea.status}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-4 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveContact}
            className="flex-2 py-4 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 px-10"
            style={{ backgroundColor: 'var(--primary)', boxShadow: '0 10px 15px -3px var(--primary-shadow)' }}
          >
            Create Contact
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContactModal;
