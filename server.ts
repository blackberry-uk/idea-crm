// @ts-nocheck
import express from 'express';
// @ts-ignore - PrismaClient is a generated class and might not be recognized as an exported member by the compiler in all environments
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import 'dotenv/config';
import { sendInvitationEmail, sendTaskAssignmentEmail, sendNoteMentionEmail, sendInvitationAcceptedEmail } from './lib/email.js';
import prisma from './lib/prisma.js';
import { OAuth2Client } from 'google-auth-library';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'ideacrm-dev-secret';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const stripHtml = (html: string) => {
  if (!html) return '';
  let text = html.replace(/<[^>]*>?/gm, ' '); // Strip tags
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&amp;/g, '&');
  return text.replace(/\s+/g, ' ').trim(); // Collapse whitespace
};

const getCleanExcerpt = (content: string, maxLength = 150) => {
  if (!content) return '';

  // Handle Call Minute JSON
  if (content.startsWith('{') && content.includes('"template"')) {
    try {
      const data = JSON.parse(content);
      if (data.template === 'call-minute' && data.segments) {
        const topics = data.segments.map((s: any) => s.topic).filter(Boolean).join(', ');
        return `[Call Minute] ${topics}`;
      }
    } catch (e) { }
  }

  const clean = stripHtml(content);
  if (clean.length <= maxLength) return clean;
  return clean.substring(0, maxLength - 3) + '...';
};

// @ts-ignore - Argument of type 'NextHandleFunction' mismatch with Express middleware signature in certain type environments
app.use(cors());
// @ts-ignore - Middleware type mismatch for express.json middleware in certain type environments
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Debug endpoint to check environment configuration
app.get("/api/debug/config", (_req, res) => {
  res.json({
    hasGoogleClientId: !!GOOGLE_CLIENT_ID,
    googleClientIdPrefix: GOOGLE_CLIENT_ID ? GOOGLE_CLIENT_ID.substring(0, 20) + '...' : 'NOT SET',
    hasJwtSecret: !!JWT_SECRET,
    nodeEnv: process.env.NODE_ENV
  });
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
    // Log for debugging (remove in production after fixing)
    console.log('[Google Auth] Starting verification with client ID:', GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET');

    if (!GOOGLE_CLIENT_ID) {
      console.error('[Google Auth] GOOGLE_CLIENT_ID is not configured!');
      return res.status(500).json({ error: 'Server configuration error: Google Client ID not set' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) return res.status(400).json({ error: 'Invalid Google token' });

    const email = payload.email.toLowerCase().trim();
    const googleId = payload.sub;
    const name = payload.name;

    console.log('[Google Auth] Token verified for email:', email);

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
      console.log('[Google Auth] Created new user:', user.id);
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.json({ user: { id: user.id, email: user.email, name: user.name }, token });
  } catch (err) {
    console.error('[Google Auth] Error details:', {
      message: err.message,
      name: err.name,
      stack: err.stack?.split('\n').slice(0, 3).join('\n')
    });
    res.status(401).json({
      error: 'Google authentication failed',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
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
        } as any,
        include: {
          taggedContacts: true,
          taggedUsers: true,
          comments: { include: { author: true } }
        } as any
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
      taggedContactIds: (note as any).taggedContacts.map((c: any) => c.id),
      taggedUserIds: (note as any).taggedUsers.map((u: any) => u.id),
      comments: ((note as any).comments || []).map((c: any) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt.toISOString(),
        authorId: c.authorId,
        authorName: c.author?.name || 'Unknown'
      }))
    }));

    // Extract all unique users from ideas
    const users = Array.from(new Map(
      rawIdeas.flatMap(idea => [idea.owner, ...idea.collaborators])
        .filter(Boolean)
        .map(u => [u.id, u])
    ).values());

    // Map interactions to handle nulls
    const formattedInteractions = ((interactions as any[]) || []).map(int => ({
      ...int,
      date: int.date?.toISOString(),
      nextActionDate: int.nextActionDate?.toISOString(),
    }));

    res.json({ ideas, contacts, notes, interactions: formattedInteractions, invitations, users });
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

app.post('/api/ideas/:id/counsel', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;
    const idea = await prisma.idea.findUnique({
      where: { id },
      include: { owner: true }
    });

    if (!idea) return res.status(404).json({ error: 'Idea not found' });

    // Fetch all context: notes, comments, todos
    const [notes, rawIdea] = await Promise.all([
      prisma.note.findMany({
        where: { ideaId: id },
        include: { comments: true }
      }),
      prisma.idea.findUnique({ where: { id } })
    ]);

    const todos = JSON.parse(rawIdea?.todos || '[]');
    const contextLines: string[] = [];

    contextLines.push(`Idea Title: ${idea.title}`);
    contextLines.push(`Status: ${idea.status}`);
    contextLines.push(`Type: ${idea.type}`);

    contextLines.push('\n--- TODOS ---');
    todos.forEach((t: any) => {
      contextLines.push(`[${t.status || (t.completed ? 'Done' : 'Pending')}] ${t.text} (Urgent: ${t.isUrgent})`);
    });

    contextLines.push('\n--- NOTES & FEEDBACK ---');
    notes.forEach(n => {
      const cleanBody = stripHtml(n.content || '');
      contextLines.push(`- ${cleanBody} (Intent: ${n.intent || 'Info'})`);
      n.comments.forEach(c => {
        contextLines.push(`  - Comment: ${c.body}`);
      });
    });

    if (!genAI) {
      return res.json({ advice: "I noticed you haven't configured a GEMINI_API_KEY in your .env file yet. Once provided, I'll be able to analyze your " + notes.length + " notes and " + todos.length + " tasks to give you precise guidance!" });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `You are an expert business counselor and strategist. 
Review the following innovation project data and provide the SINGLE BEST NEXT STEP the user should take.
Be concise (max 3-4 sentences). Use a professional, encouraging, and highly strategic tone.
If there are many pending todos, identify the most critical one. 
If notes suggest a pivot or a specific blocker, address it.

DATA:
${contextLines.join('\n')}

BEST NEXT STEP:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.json({ advice: text });
  } catch (err: any) {
    console.error('Counseling error:', err);
    res.status(500).json({ error: 'Failed to generate AI advice', details: err.message });
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

    const fullName = `${contactData.firstName || ''} ${contactData.lastName || ''}`.trim();

    const contact = await prisma.contact.create({
      data: {
        ...contactData,
        fullName: fullName || contactData.fullName,
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

    const fullName = updates.firstName !== undefined || updates.lastName !== undefined
      ? `${updates.firstName ?? existing.firstName ?? ''} ${updates.lastName ?? existing.lastName ?? ''}`.trim()
      : undefined;

    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data: {
        ...data,
        ...(fullName !== undefined ? { fullName } : {})
      }
    });
    res.json(contact);
  } catch (err: any) {
    console.error('Update contact error:', err);
    res.status(500).json({ error: 'Failed to update contact', details: err.message });
  }
});

app.delete('/api/contacts/:id', authenticate, async (req: any, res) => {
  try {
    const contact = await prisma.contact.findUnique({ where: { id: req.params.id } });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    // Ownership check
    if ((contact as any).ownerId && (contact as any).ownerId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized to delete this contact' });
    }

    await prisma.contact.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete contact error:', err);
    res.status(500).json({ error: 'Failed to delete contact', details: err.message });
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
      const excerpt = getCleanExcerpt(body || 'a new note');

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
      const excerpt = getCleanExcerpt(body || note.content || 'a note update');

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

app.delete('/api/comments/:id', authenticate, async (req: any, res) => {
  try {
    const comment = await (prisma as any).comment.findUnique({
      where: { id: req.params.id },
      include: { note: true }
    });

    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    // Ownership check: comment author, OR note author, OR idea owner, OR contact owner
    const isAuthor = comment.authorId === req.userId;
    const isNoteAuthor = comment.note.createdById === req.userId;
    let isIdeaOwner = false;
    let isContactOwner = false;

    if (!isAuthor && !isNoteAuthor) {
      if (comment.note.ideaId) {
        const idea = await prisma.idea.findUnique({ where: { id: comment.note.ideaId } });
        isIdeaOwner = idea?.ownerId === req.userId;
      }
      if (comment.note.contactId) {
        const contact = await prisma.contact.findUnique({ where: { id: comment.note.contactId } });
        isContactOwner = (contact as any)?.ownerId === req.userId;
      }
    }

    if (!isAuthor && !isNoteAuthor && !isIdeaOwner && !isContactOwner) {
      return res.status(403).json({ error: 'Unauthorized to delete this comment' });
    }

    await (prisma as any).comment.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Comment deletion error:', err);
    res.status(500).json({ error: 'Failed to delete comment', details: err.message });
  }
});

app.post('/api/notes/:id/comments', authenticate, async (req: any, res) => {
  try {
    const { body } = req.body;
    if (!body) return res.status(400).json({ error: 'Comment body is required' });

    const comment = await (prisma as any).comment.create({
      data: {
        body,
        noteId: req.params.id,
        authorId: req.userId
      },
      include: {
        author: true
      }
    });

    res.json(comment);
  } catch (err: any) {
    console.error('Comment creation error:', err);
    res.status(500).json({ error: 'Failed to create comment', details: err.message });
  }
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
    console.log(`Successfully deleted note ${req.params.id}`);
    res.json({ success: true });
  } catch (err: any) {
    console.error('CRITICAL: Delete note error:', err);
    res.status(500).json({
      error: 'Failed to delete note',
      details: err.message,
      code: err.code,
      meta: err.meta
    });
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
    const { email, ideaId, type, message } = req.body;
    const inv = await prisma.invitation.create({
      data: {
        email: email.toLowerCase().trim(),
        ideaId: ideaId || null,
        type,
        message: message || null,
        senderId: req.userId,
        status: 'Pending'
      }
    });

    // Send email asynchronously
    const sender = await prisma.user.findUnique({ where: { id: req.userId } });
    const idea = ideaId ? await prisma.idea.findUnique({ where: { id: ideaId } }) : null;

    if (sender) {
      await sendInvitationEmail(inv.email, idea ? idea.title : null, sender.name || 'A partner', inv.id, message);
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

  const { personalEntities, ideaConfigs, noteCategories, name, theme, customTheme, themeAdjustments } = req.body;

  const updateData: any = {};
  if (personalEntities) updateData.personalEntities = personalEntities;
  if (ideaConfigs) updateData.ideaConfigs = ideaConfigs;
  if (noteCategories) updateData.noteCategories = noteCategories;
  if (name) updateData.name = name;
  if (theme) updateData.theme = theme;
  if (customTheme !== undefined) updateData.customTheme = customTheme;
  if (themeAdjustments !== undefined) updateData.themeAdjustments = themeAdjustments;

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
