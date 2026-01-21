
import { useState, useEffect, useMemo } from 'react';
import { AppData, Idea, Contact, Note, User, Invitation, Interaction, Confirmation, IdeaConfig } from '../types.ts';
import { apiClient } from '../lib/api/client';

export const CURRENT_DATA_MODEL_VERSION = 1;

export interface ParseResult {
  data: AppData;
  fileVersion: number;
  orphanFields: Record<string, string[]>;
}

const EMPTY_DATA: AppData = {
  users: [], ideas: [], contacts: [], notes: [], interactions: [], invitations: [],
  globalNoteCategories: ['Competitor', 'Insight', 'Action', 'Mockup', 'AI Analysis'],
  currentUser: null,
  toast: null,
  confirmation: null
};

let globalState: AppData = { ...EMPTY_DATA };
let isHydrated = false;
const listeners = new Set<(state: AppData) => void>();

const notify = () => {
  listeners.forEach(fn => fn({ ...globalState }));
};

const hydrate = async () => {
  const token = apiClient.getToken();
  if (!token) {
    isHydrated = true;
    notify();
    return;
  }

  try {
    const user = await apiClient.get('/me');
    const allData = await apiClient.get('/data');
    globalState = {
      ...allData,
      currentUser: user,
      globalNoteCategories: (user.noteCategories && Array.isArray(user.noteCategories) && user.noteCategories.length > 0)
        ? user.noteCategories
        : globalState.globalNoteCategories,
      toast: globalState.toast,
      confirmation: globalState.confirmation
    };
  } catch (e) {
    console.error("Hydration failed", e);
    apiClient.clearToken();
    globalState = { ...EMPTY_DATA };
  } finally {
    isHydrated = true;
    notify();
  }
};

// Start initialization
hydrate();

export const useStore = () => {
  const [state, setState] = useState<AppData>(globalState);

  useEffect(() => {
    listeners.add(setState);
    return () => { listeners.delete(setState); };
  }, []);

  const myIdeas = useMemo(() => {
    if (!state.currentUser) return [];
    const userId = state.currentUser.id;
    return state.ideas.filter(i =>
      i.ownerId === userId || (i.collaboratorIds && i.collaboratorIds.includes(userId))
    );
  }, [state.ideas, state.currentUser]);

  return {
    data: state,
    isHydrated,
    myIdeas,

    login: async (email: string, password?: string) => {
      try {
        const res = await apiClient.post('/login', { email, password });
        apiClient.setToken(res.token);
        await hydrate();
        return !!globalState.currentUser;
      } catch (e) {
        return false;
      }
    },

    register: async (email: string, name: string, password?: string) => {
      try {
        const res = await apiClient.post('/register', { email, name, password });
        apiClient.setToken(res.token);
        await hydrate();
        return !!globalState.currentUser;
      } catch (e) {
        return false;
      }
    },

    googleLogin: async (idToken: string) => {
      try {
        console.log('[Frontend] Sending Google token to backend...');
        const res = await apiClient.post('/auth/google', { idToken });
        console.log('[Frontend] Google login successful, setting token');
        apiClient.setToken(res.token);
        await hydrate();
        return !!globalState.currentUser;
      } catch (e) {
        console.error('[Frontend] Google login failed:', e);
        return false;
      }
    },

    logout: () => {
      apiClient.clearToken();
      globalState = { ...EMPTY_DATA };
      notify();
    },

    addIdea: async (idea: any) => {
      const res = await apiClient.post('/ideas', idea);
      await hydrate();
      return res;
    },

    updateIdea: async (id: string, updates: Partial<Idea>) => {
      const res = await apiClient.put(`/ideas/${id}`, updates);
      await hydrate();
      return res;
    },

    deleteIdea: async (id: string) => {
      await apiClient.delete(`/ideas/${id}`);
      await hydrate();
    },

    leaveIdea: async (id: string) => {
      await apiClient.post(`/ideas/${id}/leave`, {});
      await hydrate();
    },

    shareIdea: async (ideaId: string | null, email: string, message?: string) => {
      const res = await apiClient.post('/invitations', {
        email,
        ideaId: ideaId || null,
        type: ideaId ? 'IdeaAccess' : 'SystemJoin',
        message
      });
      await hydrate();
      return res;
    },

    addNote: async (note: any) => {
      const res = await apiClient.post('/notes', note);
      await hydrate();
      return res;
    },

    updateNote: async (id: string, updates: Partial<Note>) => {
      const res = await apiClient.put(`/notes/${id}`, updates);
      await hydrate();
      return res;
    },

    togglePinNote: async (id: string) => {
      const note = globalState.notes.find(n => n.id === id);
      if (note) {
        await apiClient.put(`/notes/${id}`, { isPinned: !note.isPinned });
        await hydrate();
      }
    },

    toggleHideNote: async (id: string) => {
      const note = globalState.notes.find(n => n.id === id);
      if (note) {
        await apiClient.put(`/notes/${id}`, { isHidden: !note.isHidden });
        await hydrate();
      }
    },

    deleteNote: async (id: string) => {
      try {
        await apiClient.delete(`/notes/${id}`);
        await hydrate();
        globalState.toast = { message: 'Note deleted successfully', type: 'success', id: Math.random().toString() };
        notify();
      } catch (err: any) {
        console.error('Delete note store error:', err);
        globalState.toast = { message: err.message || 'Failed to delete note', type: 'error', id: Math.random().toString() };
        notify();
      }
    },

    addComment: async (noteId: string, body: string) => {
      try {
        await apiClient.post(`/notes/${noteId}/comments`, { body });
        await hydrate();
      } catch (err: any) {
        console.error('Add comment store error:', err);
        globalState.toast = { message: err.message || 'Failed to add comment', type: 'error', id: Math.random().toString() };
        notify();
      }
    },

    deleteComment: async (commentId: string) => {
      try {
        await apiClient.delete(`/comments/${commentId}`);
        await hydrate();
      } catch (err: any) {
        console.error('Delete comment store error:', err);
        globalState.toast = { message: err.message || 'Failed to delete comment', type: 'error', id: Math.random().toString() };
        notify();
      }
    },


    addContact: async (contact: any) => {
      const res = await apiClient.post('/contacts', contact);
      await hydrate();
      return res;
    },

    updateContact: async (id: string, updates: Partial<Contact>) => {
      const res = await apiClient.put(`/contacts/${id}`, updates);
      await hydrate();
      return res;
    },

    deleteContact: async (id: string) => {
      await apiClient.delete(`/contacts/${id}`);
      await hydrate();
    },

    addInteraction: async (interaction: any) => {
      const res = await apiClient.post('/interactions', interaction);
      await hydrate();
      return res;
    },

    handleInvitation: async (id: string, accept: boolean) => {
      const status = accept ? 'accept' : 'decline';
      await apiClient.post(`/invitations/${id}/${status}`, {});
      await hydrate();
    },

    resendInvitation: async (id: string) => {
      await apiClient.post(`/invitations/${id}/resend`, {});
    },

    uninviteCollaborator: async (ideaId: string, userId: string) => {
      await apiClient.delete(`/ideas/${ideaId}/collaborators/${userId}`);
      await hydrate();
    },

    deleteInvitation: async (id: string) => {
      await apiClient.delete(`/invitations/${id}`);
      await hydrate();
    },

    showToast: (message: string, type: 'success' | 'error' | 'info' = 'success') => {
      globalState.toast = { id: Math.random().toString(36).substring(7), message, type };
      notify();
      setTimeout(() => {
        globalState.toast = null;
        notify();
      }, 3000);
    },

    hideToast: () => {
      globalState.toast = null;
      notify();
    },

    confirm: (options: Omit<Confirmation, 'id'>) => {
      globalState.confirmation = { ...options, id: Math.random().toString(36).substring(7) };
      notify();
    },

    closeConfirmation: () => {
      globalState.confirmation = null;
      notify();
    },

    updateGlobalCategories: (categories: string[]) => {
      globalState.globalNoteCategories = categories;
      notify();
    },

    updatePersonalSettings: async (settings: Partial<User>) => {
      if (!globalState.currentUser) return;
      await apiClient.put(`/users/${globalState.currentUser.id}`, settings);
      await hydrate();
    },

    applyImport: async (importData: Partial<AppData>) => {
      await apiClient.post('/import', importData);
      await hydrate();
    }
  };
};
