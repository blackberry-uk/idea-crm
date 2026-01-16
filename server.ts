import express from 'express';
// @ts-ignore - PrismaClient is a generated class and might not be recognized as an exported member by the compiler in all environments
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import 'dotenv/config';
import { sendInvitationEmail, sendTaskAssignmentEmail, sendNoteMentionEmail, sendInvitationAcceptedEmail } from './lib/email.js';
import prisma from './lib/prisma.js';
import { OAuth2Client } from 'google-auth-library';

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'ideacrm-dev-secret';
const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// @ts-ignore - Argument of type 'NextHandleFunction' mismatch with Express middleware signature in certain type environments
app.use(cors());
// @ts-ignore - Middleware type mismatch for express.json middleware in certain type environments
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});


// Auth Middleware
const authenticate = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// --- AUTH ROUTES ---
app.post('/api/register', async (req, res) => {
  const { email, name, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name,
        password: hashedPassword,
        personalEntities: ['Personal']
      }
    });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.json({ user: { id: user.id, email: user.email, name: user.name }, token });
  } catch (e) {
    res.status(400).json({ error: 'User registration failed. Email might already be taken.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ userId: user.id }, JWT_SECRET);
  res.json({ user: { id: user.id, email: user.email, name: user.name }, token });
});

app.post('/api/auth/google', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'ID Token required' });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) return res.status(400).json({ error: 'Invalid Google token' });

    const email = payload.email.toLowerCase().trim();
    const googleId = payload.sub;
    const name = payload.name;

    // 1. Find user by googleId
    let user = await prisma.user.findUnique({ where: { googleId } as any });

    // 2. If not found, find user by email and link googleId
    if (!user) {
      user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId } as any
        });
      }
    }

    // 3. If still not found, create new user
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          googleId,
          personalEntities: ['Personal']
        } as any
      });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.json({ user: { id: user.id, email: user.email, name: user.name }, token });
  } catch (err) {
    console.error('Google Auth Error:', err);
    res.status(401).json({ error: 'Google authentication failed' });
  }
});

app.get('/api/me', authenticate, async (req: any, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password, ...safeUser } = user;
  res.json(safeUser);
});

// --- DATA ROUTES ---
app.get('/api/data', authenticate, async (req: any, res) => {
  const userId = req.userId;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const userEmail = user?.email || '';

    const [rawIdeas, contacts, rawNotes, interactions, invitations] = await Promise.all([
      prisma.idea.findMany({
        where: { OR: [{ ownerId: userId }, { collaborators: { some: { id: userId } } }] },
        include: { owner: true, collaborators: true }
      }),
      prisma.contact.findMany({
        where: {
          ownerId: userId
        } as any
      }),
      prisma.note.findMany({
        where: {
          OR: [
            { createdById: userId },
            { idea: { OR: [{ ownerId: userId }, { collaborators: { some: { id: userId } } }] } },
            { taggedUsers: { some: { id: userId } } }
          ]
        },
        include: { taggedContacts: true, taggedUsers: true }
      }),
      prisma.interaction.findMany({ where: { createdById: userId } }),
      prisma.invitation.findMany({
        where: {
          OR: [
            { email: userEmail },
            { senderId: userId }
          ]
        }
      })
    ]);

    // Transform ideas to match frontend types
    const ideas = rawIdeas.map(idea => ({
      ...idea,
      collaboratorIds: idea.collaborators.map(c => c.id),
      tags: JSON.parse(idea.tags || '[]'),
      todos: JSON.parse(idea.todos || '[]'),
      linkedContactIds: JSON.parse(idea.linkedContactIds || '[]'),
      customNoteCategories: JSON.parse(idea.customNoteCategories || '[]'),
    }));

    // Transform notes to match frontend types
    const notes = rawNotes.map(note => ({
      ...note,
      body: note.content || '', // Map 'content' from schema to 'body' for frontend
      categories: JSON.parse(note.categories || '[]'),
      taggedContactIds: note.taggedContacts.map(c => c.id),
      taggedUserIds: note.taggedUsers.map(u => u.id),
    }));

    // Extract all unique users from ideas
    const users = Array.from(new Map(
      rawIdeas.flatMap(idea => [idea.owner, ...idea.collaborators])
        .filter(Boolean)
        .map(u => [u.id, u])
    ).values());

    res.json({ ideas, contacts, notes, interactions, invitations, users });
  } catch (err) {
    console.error('Data fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch workspace data' });
  }
});

// --- IDEAS ---
app.post('/api/ideas', authenticate, async (req: any, res) => {
  const { tags, todos, linkedContactIds, ...ideaData } = req.body;
  const idea = await prisma.idea.create({
    data: {
      ...ideaData,
      tags: tags ? (Array.isArray(tags) ? JSON.stringify(tags) : tags) : '[]',
      todos: todos ? (Array.isArray(todos) ? JSON.stringify(todos) : todos) : '[]',
      linkedContactIds: linkedContactIds ? (Array.isArray(linkedContactIds) ? JSON.stringify(linkedContactIds) : linkedContactIds) : '[]',
      ownerId: req.userId
    }
  });
  res.json(idea);
});

app.put('/api/ideas/:id', authenticate, async (req: any, res) => {
  try {
    const {
      tags, todos, linkedContactIds, customNoteCategories,
      ownerId, collaborators, invitations, notes, owner,
      id, createdAt, updatedAt, collaboratorIds,
      ...updates
    } = req.body;

    const currentIdea = await prisma.idea.findUnique({
      where: { id: req.params.id },
      include: { owner: true }
    });

    if (!currentIdea) return res.status(404).json({ error: 'Idea not found' });

    const data: any = { ...updates };

    if (tags !== undefined) data.tags = Array.isArray(tags) ? JSON.stringify(tags) : tags;
    if (todos !== undefined) data.todos = Array.isArray(todos) ? JSON.stringify(todos) : todos;
    if (linkedContactIds !== undefined) data.linkedContactIds = Array.isArray(linkedContactIds) ? JSON.stringify(linkedContactIds) : linkedContactIds;
    if (customNoteCategories !== undefined) data.customNoteCategories = Array.isArray(customNoteCategories) ? JSON.stringify(customNoteCategories) : customNoteCategories;

    const updatedIdea = await prisma.idea.update({
      where: { id: req.params.id },
      data
    });

    // Detect new task assignments
    if (todos !== undefined && Array.isArray(todos)) {
      const oldTodos = JSON.parse(currentIdea.todos || '[]');
      const newTodos = todos;

      const currentUserId = req.userId;
      const currentUser = await prisma.user.findUnique({ where: { id: currentUserId } });

      for (const newTodo of newTodos) {
        if (newTodo.assigneeId && newTodo.assigneeId !== currentUserId) {
          const oldTodo = oldTodos.find((t: any) => t.id === newTodo.id);
          const isNewlyAssigned = !oldTodo || oldTodo.assigneeId !== newTodo.assigneeId;

          if (isNewlyAssigned) {
            const assignee = await prisma.user.findUnique({ where: { id: newTodo.assigneeId } });
            if (assignee && assignee.email) {
              sendTaskAssignmentEmail(
                assignee.email,
                updatedIdea.title,
                newTodo.text,
                currentUser?.name || 'Someone',
                updatedIdea.id
              ).catch(err => console.error('Failed to send task assignment email:', err));
            }
          }
        }
      }
    }

    res.json(updatedIdea);
  } catch (err: any) {
    console.error('Update idea error:', err);
    res.status(500).json({ error: 'Failed to update idea', details: err.message });
  }
});

app.delete('/api/ideas/:id', authenticate, async (req: any, res) => {
  try {
    const idea = await prisma.idea.findUnique({
      where: { id: req.params.id }
    });
    if (!idea) return res.status(404).json({ error: 'Idea not found' });
    if (idea.ownerId !== req.userId) return res.status(403).json({ error: 'Only the owner can delete this idea' });

    await prisma.idea.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete idea', details: err.message });
  }
});

app.post('/api/ideas/:id/leave', authenticate, async (req: any, res) => {
  try {
    await prisma.idea.update({
      where: { id: req.params.id },
      data: {
        collaborators: {
          disconnect: { id: req.userId }
        }
      }
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to leave project', details: err.message });
  }
});

// --- CONTACTS ---
app.post('/api/contacts', authenticate, async (req: any, res) => {
  try {
    if (!req.userId) {
      console.error('Missing userId in request for contact creation');
      return res.status(401).json({ error: 'User context missing' });
    }

    const { id, createdAt, updatedAt, notesAssociated, taggedInNotes, associatedNotes, linkedIdeaIds, ...contactData } = req.body;

    console.log(`Creating contact for user ${req.userId}`);

    const contact = await prisma.contact.create({
      data: {
        ...contactData,
        notes: req.body.notes,
        linkedIdeaIds: linkedIdeaIds ? (Array.isArray(linkedIdeaIds) ? JSON.stringify(linkedIdeaIds) : linkedIdeaIds) : '[]',
        ownerId: req.userId
      }
    });
    res.json(contact);
  } catch (err: any) {
    console.error('Create contact error:', err);
    res.status(500).json({ error: 'Failed to create contact', details: err.message });
  }
});

app.put('/api/contacts/:id', authenticate, async (req: any, res) => {
  try {
    const { id, createdAt, updatedAt, notesAssociated, taggedInNotes, associatedNotes, linkedIdeaIds, ...updates } = req.body;

    // Ownership check
    const existing = await prisma.contact.findUnique({ where: { id: req.params.id } }) as any;
    if (existing && existing.ownerId && existing.ownerId !== req.userId) {
      return res.status(403).json({ error: 'You do not have permission to update this contact' });
    }

    const data: any = { ...updates };
    if (req.body.notes !== undefined) data.notes = req.body.notes;
    if (linkedIdeaIds !== undefined) data.linkedIdeaIds = Array.isArray(linkedIdeaIds) ? JSON.stringify(linkedIdeaIds) : linkedIdeaIds;

    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data
    });
    res.json(contact);
  } catch (err: any) {
    console.error('Update contact error:', err);
    res.status(500).json({ error: 'Failed to update contact', details: err.message });
  }
});

// --- NOTES ---
app.post('/api/notes', authenticate, async (req: any, res) => {
  try {
    const {
      taggedContactIds, taggedUserIds, categories, body, ideaId, contactId,
      id, createdAt, updatedAt, author, idea, contact, taggedContacts, taggedUsers,
      ...noteData
    } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.userId } });

    if (req.body.imageUrl) {
      console.log(`Note creation with image. Length: ${req.body.imageUrl.length}`);
    }

    const note = await (prisma.note as any).create({
      data: {
        content: body || '',
        imageUrl: req.body.imageUrl || null,
        location: req.body.location || null,
        isPinned: req.body.isPinned || false,
        categories: categories ? (Array.isArray(categories) ? JSON.stringify(categories) : categories) : '[]',
        createdAt: createdAt ? new Date(createdAt) : undefined,
        createdById: req.userId,
        createdBy: user?.name || 'System',
        ideaId: ideaId || null,
        contactId: contactId || null,
        taggedContacts: { connect: (taggedContactIds || []).map((id: string) => ({ id })) },
        taggedUsers: { connect: (taggedUserIds || []).map((id: string) => ({ id })) },
        intent: req.body.intent || null
      }
    });

    // Send emails to tagged users
    if (taggedUserIds && Array.isArray(taggedUserIds) && taggedUserIds.length > 0) {
      const idea = ideaId ? await prisma.idea.findUnique({ where: { id: ideaId } }) : null;
      const mentionersName = user?.name || 'A teammate';
      const excerpt = body ? (body.length > 100 ? body.substring(0, 97) + '...' : body) : 'a new note';

      taggedUserIds.forEach(async (uId: string) => {
        try {
          const taggedUser = await prisma.user.findUnique({ where: { id: uId } });
          if (taggedUser && taggedUser.email) {
            sendNoteMentionEmail(
              taggedUser.email,
              idea?.title || 'a project',
              excerpt,
              mentionersName,
              ideaId || ''
            ).catch(err => console.error('Failed to send mention email:', err));
          }
        } catch (err) {
          console.error('Error in mention notification loop:', err);
        }
      });
    }

    res.json(note);
  } catch (err: any) {
    console.error('Create note error details:', err);
    res.status(500).json({
      error: 'Failed to create note',
      details: `${err.name}: ${err.message}${err.code ? ' (Code: ' + err.code + ')' : ''}`
    });
  }
});

app.put('/api/notes/:id', authenticate, async (req: any, res) => {
  const {
    taggedContactIds, taggedUserIds, categories, body,
    id, createdAt, updatedAt, author, idea, contact, taggedContacts, taggedUsers,
    ...updates
  } = req.body;
  const data: any = { ...updates };
  if (body !== undefined) data.content = body; // Map 'body' to 'content'
  if (categories) data.categories = Array.isArray(categories) ? JSON.stringify(categories) : categories;
  if (createdAt) data.createdAt = new Date(createdAt);

  if (taggedContactIds) data.taggedContacts = { set: taggedContactIds.map((id: string) => ({ id })) };
  if (taggedUserIds) data.taggedUsers = { set: taggedUserIds.map((id: string) => ({ id })) };

  if (updates.imageUrl !== undefined) data.imageUrl = updates.imageUrl;
  if (updates.location !== undefined) data.location = updates.location;
  if (updates.isPinned !== undefined) data.isPinned = updates.isPinned;
  if (updates.intent !== undefined) data.intent = updates.intent;

  const oldNote = await prisma.note.findUnique({
    where: { id: req.params.id },
    include: { taggedUsers: true, idea: true }
  });

  const note = await prisma.note.update({
    where: { id: req.params.id },
    data
  });

  // Detect new mentions in PUT
  if (taggedUserIds && Array.isArray(taggedUserIds) && oldNote) {
    const oldUserIds = oldNote.taggedUsers.map(u => u.id);
    const newUserIds = taggedUserIds.filter(id => !oldUserIds.includes(id));

    if (newUserIds.length > 0) {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      const mentionersName = user?.name || 'A teammate';
      const excerpt = body ? (body.length > 100 ? body.substring(0, 97) + '...' : body) : (note.content || 'a note update');

      newUserIds.forEach(async (uId: string) => {
        try {
          const taggedUser = await prisma.user.findUnique({ where: { id: uId } });
          if (taggedUser && taggedUser.email) {
            sendNoteMentionEmail(
              taggedUser.email,
              oldNote.idea?.title || 'a project',
              excerpt,
              mentionersName,
              oldNote.ideaId || ''
            ).catch(err => console.error('Failed to send mention email (PUT):', err));
          }
        } catch (err) {
          console.error('Error in mention notification loop (PUT):', err);
        }
      });
    }
  }

  res.json(note);
});

app.delete('/api/notes/:id', authenticate, async (req: any, res) => {
  try {
    const note = await prisma.note.findUnique({ where: { id: req.params.id } });
    if (!note) return res.status(404).json({ error: 'Note not found' });

    console.log(`Attempting to delete note ${req.params.id} by user ${req.userId}`);

    // Ownership check: author, idea owner, OR contact owner
    const isAuthor = note.createdById === req.userId;
    let isIdeaOwner = false;
    let isContactOwner = false;

    if (!isAuthor) {
      if (note.ideaId) {
        const idea = await prisma.idea.findUnique({ where: { id: note.ideaId } });
        isIdeaOwner = idea?.ownerId === req.userId;
      }
      if (note.contactId) {
        const contact = await prisma.contact.findUnique({ where: { id: note.contactId } });
        isContactOwner = (contact as any)?.ownerId === req.userId;
      }
    }

    if (!isAuthor && !isIdeaOwner && !isContactOwner) {
      console.warn(`Unauthorized delete attempt on note ${note.id} by user ${req.userId}`);
      return res.status(403).json({ error: 'Unauthorized to delete this note' });
    }

    await prisma.note.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete note error:', err);
    res.status(500).json({ error: 'Failed to delete note', details: err.message });
  }
});

// --- INTERACTIONS ---
app.post('/api/interactions', authenticate, async (req: any, res) => {
  const interaction = await prisma.interaction.create({
    data: { ...req.body, createdById: req.userId }
  });
  res.json(interaction);
});

app.put('/api/interactions/:id', authenticate, async (req: any, res) => {
  const interaction = await prisma.interaction.update({
    where: { id: req.params.id },
    data: req.body
  });
  res.json(interaction);
});

// --- INVITATIONS ---
app.post('/api/invitations', authenticate, async (req: any, res) => {
  try {
    const { email, ideaId, type } = req.body;
    const inv = await prisma.invitation.create({
      data: {
        email: email.toLowerCase().trim(),
        ideaId: ideaId || null,
        type,
        senderId: req.userId,
        status: 'Pending'
      }
    });

    // Send email asynchronously
    const sender = await prisma.user.findUnique({ where: { id: req.userId } });
    const idea = ideaId ? await prisma.idea.findUnique({ where: { id: ideaId } }) : null;

    if (sender && idea) {
      sendInvitationEmail(inv.email, idea.title, sender.name || 'A partner', inv.id)
        .catch(err => console.error('Failed to send invitation email:', err));
    }

    res.json(inv);
  } catch (err: any) {
    console.error('Create invitation error:', err);
    res.status(500).json({ error: 'Failed to create invitation', details: err.message });
  }
});

app.post('/api/invitations/:id/:action', authenticate, async (req: any, res) => {
  const { id, action } = req.params;
  const status = action === 'accept' ? 'Accepted' : 'Declined';

  const invitation = await prisma.invitation.update({
    where: { id },
    data: { status },
    include: { idea: true, sender: true }
  });

  if (status === 'Accepted' && invitation.ideaId) {
    // 1. Link collaborator to idea
    await prisma.idea.update({
      where: { id: invitation.ideaId },
      data: { collaborators: { connect: { id: req.userId } } }
    });

    // 2. Notify the owner
    const accepter = await prisma.user.findUnique({ where: { id: req.userId } });
    if (invitation.sender?.email && invitation.idea && accepter) {
      sendInvitationAcceptedEmail(
        invitation.sender.email,
        invitation.idea.title,
        accepter.name || 'A user',
        invitation.ideaId
      ).catch(err => console.error('Failed to notify owner of acceptance:', err));
    }
  }

  res.json(invitation);
});

app.post('/api/invitations/:id/resend', authenticate, async (req: any, res) => {
  try {
    const inv = await prisma.invitation.findUnique({
      where: { id: req.params.id },
      include: { idea: true, sender: true }
    });

    if (!inv || inv.status !== 'Pending') {
      return res.status(400).json({ error: 'Invitation not found or already accepted/declined' });
    }

    if (inv.senderId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (inv.sender && inv.idea) {
      await sendInvitationEmail(inv.email, inv.idea.title, inv.sender.name || 'A partner', inv.id);
    }

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/invitations/:id', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;
    const inv = await prisma.invitation.findUnique({ where: { id } });

    if (!inv) return res.status(404).json({ error: 'Invitation not found' });
    if (inv.senderId !== req.userId) return res.status(403).json({ error: 'Forbidden' });

    await prisma.invitation.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/ideas/:ideaId/collaborators/:userId', authenticate, async (req: any, res) => {
  try {
    const { ideaId, userId } = req.params;
    const idea = await prisma.idea.findUnique({ where: { id: ideaId } });

    if (!idea) return res.status(404).json({ error: 'Idea not found' });
    if (idea.ownerId !== req.userId) return res.status(403).json({ error: 'Only owners can remove collaborators' });

    await prisma.idea.update({
      where: { id: ideaId },
      data: { collaborators: { disconnect: { id: userId } } }
    });

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- USER SETTINGS ---
app.put('/api/users/:id', authenticate, async (req: any, res) => {
  if (req.params.id !== req.userId) return res.status(403).json({ error: 'Forbidden' });

  const { personalEntities, ideaConfigs, name } = req.body;

  const updateData: any = {};
  if (personalEntities) updateData.personalEntities = personalEntities;
  if (ideaConfigs) updateData.ideaConfigs = ideaConfigs;
  if (name) updateData.name = name;

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: updateData
  });
  res.json(user);
});

// --- BULK IMPORT ---
app.post('/api/import', authenticate, async (req: any, res) => {
  const { ideas, contacts, notes } = req.body;
  // Use transaction to ensure data integrity during import
  try {
    await prisma.$transaction(async (tx: any) => {
      if (ideas) {
        for (const i of ideas) {
          await tx.idea.create({ data: { ...i, ownerId: req.userId } });
        }
      }
      if (contacts) {
        for (const c of contacts) {
          await tx.contact.create({ data: c });
        }
      }
      if (notes) {
        for (const n of notes) {
          await tx.note.create({ data: { ...n, createdById: req.userId } });
        }
      }
    });
    res.json({ message: 'Import successful' });
  } catch (e) {
    res.status(500).json({ error: 'Bulk import failed' });
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', cloud: true }));

const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
}

export default app;
