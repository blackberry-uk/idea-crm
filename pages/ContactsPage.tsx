
import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Link } from 'react-router-dom';
import { Plus, Search, Mail, Linkedin, Globe, Briefcase, Star, UserPlus } from 'lucide-react';
import ContactModal from '../components/ContactModal';

const ContactsPage: React.FC = () => {
  const { data } = useStore();
  const [filterQuery, setFilterQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const filteredContacts = data.contacts.filter(c =>
    c.fullName.toLowerCase().includes(filterQuery.toLowerCase()) ||
    c.org.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Contacts</h1>
          <p className="text-gray-500">Managing your network of {data.contacts.length} collaborators</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold shadow-indigo-200 shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
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
            placeholder="Filter by name, organization..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredContacts.map(contact => (
          <Link key={contact.id} to={`/contacts/${contact.id}`} className="group block">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all h-full flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-700 text-xl font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  {contact.fullName[0]}
                </div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star
                      key={s}
                      className={`w-3 h-3 ${s <= contact.relationshipStrength ? 'text-yellow-400 fill-yellow-400' : 'text-gray-100'}`}
                    />
                  ))}
                </div>
              </div>

              <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors">
                {contact.fullName}
              </h3>
              <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-4">
                <Briefcase className="w-3.5 h-3.5" />
                {contact.role} @ {contact.org}
              </p>

              <div className="mt-auto pt-4 border-t border-gray-50 space-y-2">
                {contact.email && (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Mail className="w-3.5 h-3.5" />
                    {contact.email}
                  </div>
                )}
                {contact.country && (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Globe className="w-3.5 h-3.5" />
                    {contact.country}
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Shared Contact Modal */}
      <ContactModal
        isOpen={showAddForm}
        onClose={() => setShowAddForm(false)}
        initialIdeaIds={[]}
      />
    </div>
  );
};

export default ContactsPage;
