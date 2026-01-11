
import React from 'react';
import { IdeaStatus } from './types';

export const IDEA_STATUSES: IdeaStatus[] = ['Backlog', 'Active', 'On Hold', 'Dead', 'Won'];

export const STATUS_COLORS: Record<IdeaStatus, string> = {
  'Backlog': 'bg-gray-100 text-gray-700',
  'Active': 'bg-blue-100 text-blue-700',
  'On Hold': 'bg-yellow-100 text-yellow-700',
  'Dead': 'bg-red-100 text-red-700',
  'Won': 'bg-green-100 text-green-700',
};

export const INTERACTION_TYPES = ['Email', 'Call', 'Meeting', 'WhatsApp', 'Other'];

export const NOTE_TEMPLATES = [
  { label: 'Call Notes', content: "### Call with [Name]\n**Objectives:** \n- \n**Discussion:**\n- \n**Next Steps:**\n- " },
  { label: 'Next Steps', content: "### Immediate Next Steps\n1. \n2. \n3. " },
  { label: 'Follow-up Draft', content: "Hi [Name],\n\nGreat speaking with you earlier. Following up on...\n\nBest,\n[My Name]" }
];
