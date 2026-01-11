
export type IdeaStatus = 'Backlog' | 'Active' | 'On Hold' | 'Dead' | 'Won';
export type IdeaType = 'Consulting' | 'Product' | 'New Business';

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  isUrgent: boolean;
  date: string; // Deprecated, use createdAt
  createdAt: string;
  completedAt?: string;
  dueDate?: string;
  assigneeId?: string;
}

export interface User {
  id: string;
  email: string;
  password?: string;
  name: string;
  personalEntities: string[]; // e.g. ["Interfrontera", "Stackable"]
  avatarColor?: string;
}

export interface Idea {
  id: string;
  ownerId: string;
  collaboratorIds: string[];
  title: string;
  oneLiner?: string;
  status: IdeaStatus;
  type: IdeaType;
  entity: string; // Now a string selected from personalEntities
  tags: string[];
  priority: number; // 1-5
  problem?: string;
  solution?: string;
  targetCustomer?: string;
  businessModel?: string;
  risks?: string;
  nextSteps?: string;
  todos: Todo[];
  descriptionColor?: string;
  activityColor?: string;
  linkedContactIds?: string[];
  customNoteCategories?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Invitation {
  id: string;
  email: string;
  senderId: string;
  ideaId?: string; // Optional: share a specific idea
  status: 'Pending' | 'Accepted' | 'Declined';
  type: 'IdeaAccess' | 'JoinSystem';
  createdAt: string;
}

export interface Contact {
  id: string;
  fullName: string;
  org: string;
  role: string;
  email: string;
  phone: string;
  country: string;
  linkedinUrl: string;
  relationshipStrength: number;
  linkedIdeaIds?: string[];
  createdAt: string;
  updatedAt: string;
  // Additional social and preference fields
  isWhatsApp?: boolean;
  twitterUrl?: string;
  instagramUrl?: string;
  substackUrl?: string;
  notes?: string;
}

export interface Note {
  id: string;
  ideaId?: string;
  contactId?: string;
  body: string;
  categories: string[];
  isPinned: boolean;
  location?: string;
  taggedContactIds: string[];
  taggedUserIds: string[];
  createdAt: string;
  createdBy: string; // User Name
  createdById: string; // User ID
}

export interface Interaction {
  id: string;
  type: 'Email' | 'Call' | 'Meeting' | 'WhatsApp' | 'Other';
  date: string;
  outcome: string;
  nextAction: string;
  nextActionDate?: string;
  relatedIdeaId?: string;
  relatedContactId?: string;
  createdAt: string;
  createdById: string;
}

export interface AppData {
  users: User[];
  ideas: Idea[];
  contacts: Contact[];
  notes: Note[];
  interactions: Interaction[];
  invitations: Invitation[];
  globalNoteCategories: string[];
  currentUser: User | null;
}
