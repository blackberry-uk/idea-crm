
export type IdeaStatus = string;
export type IdeaType = string;

export interface IdeaConfig {
  type: string;
  stages: string[];
}

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
  status?: 'Not Started' | 'Working' | 'Done' | 'Archived';
  originNoteId?: string;
  comments?: string;
}

export type ThemePalette = 'default' | 'shire' | 'cata' | 'sabas';

export interface User {
  id: string;
  email: string;
  password?: string;
  name: string;
  personalEntities: string[]; // e.g. ["Interfrontera", "Stackable"]
  ideaConfigs?: IdeaConfig[];
  avatarColor?: string;
  theme?: ThemePalette;
  customTheme?: any;
  themeAdjustments?: Record<string, { base?: string, h: number, l: number, s: number }>;
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
  type: 'IdeaAccess' | 'SystemJoin';
  message?: string;
  createdAt: string;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
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

export type NoteIntent = 'follow_up' | 'acted_upon' | 'reflection' | 'memoir';

export interface Note {
  id: string;
  ideaId?: string;
  contactId?: string;
  body: string;
  categories: string[];
  isPinned: boolean;
  isHidden: boolean;
  location?: string;
  taggedContactIds: string[];
  taggedUserIds: string[];
  createdAt: string;
  createdBy: string; // User Name
  createdById: string; // User ID
  imageUrl?: string;
  intent?: NoteIntent;
  comments: Comment[];
}

export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorName?: string;
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

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface Confirmation {
  id: string;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel?: () => void;
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
  toast: Toast | null;
  confirmation: Confirmation | null;
}
