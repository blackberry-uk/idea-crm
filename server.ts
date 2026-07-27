// @ts-nocheck
import express from 'express';
// @ts-ignore - PrismaClient is a generated class and might not be recognized as an exported member by the compiler in all environments
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';
// Note: dotenv not needed in production (Vercel injects env vars)
// In local dev, use: node --env-file=.env or load dotenv manually
import { sendInvitationEmail, sendTaskAssignmentEmail, sendNoteMentionEmail, sendInvitationAcceptedEmail } from './lib/email.js';
import prisma from './lib/prisma.js';
import { OAuth2Client } from 'google-auth-library';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { extractDelimitedMentions } from './lib/taskMentions.js';

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



// Auth Middleware
const lastActiveFlushes: Record<string, number> = {};

const authenticate = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : (req.query.token as string | null);

  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.userId = decoded.userId;

    // Flush last active time to database (max once every 15 mins per user)
    const now = Date.now();
    if (!lastActiveFlushes[req.userId] || now - lastActiveFlushes[req.userId] > 15 * 60 * 1000) {
      lastActiveFlushes[req.userId] = now;
      prisma.user.update({
        where: { id: req.userId },
        data: { lastLoginAt: new Date() }
      }).catch(e => console.error('Last active flush error:', e));
    }

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
        personalEntities: ['Personal'],
        lastLoginAt: new Date()
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
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });
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

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          googleId,
          personalEntities: ['Personal'],
          lastLoginAt: new Date()
        } as any
      });
      console.log('[Google Auth] Created new user:', user.id);
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });
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
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password, ...safeUser } = user;
    res.json(safeUser);
  } catch (err: any) {
    console.error('/api/me error:', err);
    res.status(500).json({ error: 'Failed to fetch user', details: err.message });
  }
});

app.put('/api/me', authenticate, async (req: any, res) => {
  try {
    const { name, avatarUrl, personalEntities, ideaConfigs, noteCategories, theme, customTheme, themeAdjustments } = req.body;
    
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (personalEntities !== undefined) updateData.personalEntities = personalEntities;
    if (ideaConfigs !== undefined) updateData.ideaConfigs = ideaConfigs;
    if (noteCategories !== undefined) updateData.noteCategories = noteCategories;
    if (theme !== undefined) updateData.theme = theme;
    if (customTheme !== undefined) updateData.customTheme = customTheme;
    if (themeAdjustments !== undefined) updateData.themeAdjustments = themeAdjustments;

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: updateData
    });
    const { password, ...safeUser } = updated;
    res.json(safeUser);
  } catch (err: any) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user', details: err.message });
  }
});

app.get('/api/admin/users', authenticate, async (req: any, res) => {
  try {
    const admin = await prisma.user.findUnique({ where: { id: req.userId } });
    if (admin?.email !== 'fernando.mora.uk@gmail.com') return res.status(403).json({ error: 'Forbidden' });

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: {
            ideasOwned: true,
            ideasCollaborating: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const invitations = await prisma.invitation.findMany({
      include: {
        sender: { select: { name: true, email: true } },
        idea: { select: { title: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ users, invitations });
  } catch (err: any) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Failed to fetch admin data' });
  }
});

app.delete('/api/admin/invitations/:id', authenticate, async (req: any, res) => {
  try {
    const admin = await prisma.user.findUnique({ where: { id: req.userId } });
    if (admin?.email !== 'fernando.mora.uk@gmail.com') return res.status(403).json({ error: 'Forbidden' });

    await prisma.invitation.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Admin delete invitation error:', err);
    res.status(500).json({ error: 'Failed to delete invitation' });
  }
});

app.delete('/api/admin/users/:id', authenticate, async (req: any, res) => {
  try {
    const admin = await prisma.user.findUnique({ where: { id: req.userId } });
    if (admin?.email !== 'fernando.mora.uk@gmail.com') return res.status(403).json({ error: 'Forbidden' });

    const userIdToDelete = req.params.id;
    if (userIdToDelete === req.userId) return res.status(400).json({ error: 'Cannot delete yourself' });

    // Identify owned ideas to manually cascade delete related entities without onDelete:Cascade
    const ownedIdeas = await prisma.idea.findMany({ where: { ownerId: userIdToDelete }, select: { id: true } });
    const ideaIds = ownedIdeas.map(i => i.id);

    await prisma.$transaction([
      // Clean up idea relations
      prisma.fileAttachment.deleteMany({ where: { ideaId: { in: ideaIds } } }),
      prisma.interaction.deleteMany({ where: { relatedIdeaId: { in: ideaIds } } }),
      prisma.invitation.deleteMany({ where: { ideaId: { in: ideaIds } } }),
      
      // Clean up direct user relations
      prisma.reminderImage.deleteMany({ where: { userId: userIdToDelete } }),
      prisma.comment.deleteMany({ where: { authorId: userIdToDelete } }),
      prisma.interaction.deleteMany({ where: { createdById: userIdToDelete } }),
      prisma.invitation.deleteMany({ where: { senderId: userIdToDelete } }),
      prisma.dailyTodo.deleteMany({ where: { userId: userIdToDelete } }),
      prisma.note.deleteMany({ where: { createdById: userIdToDelete } }),
      prisma.contact.deleteMany({ where: { ownerId: userIdToDelete } }),
      prisma.entity.deleteMany({ where: { ownerId: userIdToDelete } }),
      prisma.idea.deleteMany({ where: { ownerId: userIdToDelete } }),
      
      // Nullify relations where user is not the owner but is referenced
      prisma.dailyTodo.updateMany({ where: { assigneeId: userIdToDelete }, data: { assigneeId: null } }),
      prisma.dailyTodo.updateMany({ where: { completedById: userIdToDelete }, data: { completedById: null } }),
      
      // Finally delete the user
      prisma.user.delete({ where: { id: userIdToDelete } })
    ]);

    res.json({ success: true });
  } catch (err: any) {
    console.error('Admin delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// --- DATA ROUTES ---
app.get('/api/data', authenticate, async (req: any, res) => {
  const userId = req.userId;
  try {
    console.log('[API /data] Fetching data for user:', userId);

    // Queries run in 3 parallel stages by dependency instead of 7 sequential
    // round-trips: independent → (contacts, invitations) → (entities, notes).

    // Stage 1 — no dependencies.
    const [user, rawIdeas, interactions] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.idea.findMany({
        where: { OR: [{ ownerId: userId }, { collaborators: { some: { id: userId } } }] },
        include: { owner: true, collaborators: true, children: { include: { owner: true, collaborators: true } } }
      }),
      prisma.interaction.findMany({ where: { createdById: userId } }),
    ]);
    const userEmail = user?.email || '';
    const userIdeaIds = rawIdeas.map((i: any) => i.id);

    // Stage 2 — contacts depend on ideas; invitations depend on the user's email.
    const [contacts, invitations] = await Promise.all([
      prisma.contact.findMany({
        where: {
          OR: [
            { ownerId: userId },
            { associatedNotes: { some: { ideaId: { in: userIdeaIds } } } },
            { taggedInNotes: { some: { ideaId: { in: userIdeaIds } } } }
          ]
        } as any
      }),
      prisma.invitation.findMany({
        where: { OR: [{ email: userEmail }, { senderId: userId }] },
        include: { sender: true, idea: true }
      }),
    ]);

    const linkedEntityIds = new Set<string>();
    contacts.forEach((c: any) => {
      try {
        const ids = typeof c.linkedEntityIds === 'string' ? JSON.parse(c.linkedEntityIds || '[]') : c.linkedEntityIds;
        if (Array.isArray(ids)) ids.forEach(id => linkedEntityIds.add(id));
      } catch {}
    });
    const contactIds = contacts.map((c: any) => c.id);

    // Stage 3 — entities and notes both depend on contacts.
    const [entities, rawNotes] = await Promise.all([
      prisma.entity.findMany({
        where: {
          OR: [
            { ownerId: userId },
            { id: { in: Array.from(linkedEntityIds) } }
          ]
        } as any
      }),
      prisma.note.findMany({
        where: {
          OR: [
            { createdById: userId },
            { idea: { OR: [{ ownerId: userId }, { collaborators: { some: { id: userId } } }] } },
            { taggedUsers: { some: { id: userId } } },
            { contactId: { in: contactIds }, ideaId: null },
            { taggedContacts: { some: { id: { in: contactIds } } }, ideaId: null }
          ]
        } as any,
        include: {
          taggedContacts: true,
          taggedUsers: true,
          taggedEntities: true,
          comments: { include: { author: true } }
        } as any
      }),
    ]);

    // Transform ideas to match frontend types
    const ideas = rawIdeas.map(idea => ({
      ...idea,
      collaboratorIds: idea.collaborators.map(c => c.id),
      tags: JSON.parse(idea.tags || '[]'),
      todos: JSON.parse(idea.todos || '[]'),
      links: JSON.parse((idea as any).links || '[]'),
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
      taggedEntityIds: (note as any).taggedEntities?.map((e: any) => e.id) || [],
      comments: (note as any).comments?.map((comment: any) => ({
        ...comment,
        author: comment.author
      })) || []
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

    res.json({ ideas, contacts, entities, notes, interactions: formattedInteractions, invitations, users });
  } catch (err) {
    console.error('[API /data] Error fetching workspace data:', {
      message: err.message,
      name: err.name,
      code: err.code,
      userId: req.userId,
      stack: err.stack?.split('\n').slice(0, 5).join('\n')
    });
    res.status(500).json({
      error: 'Failed to fetch workspace data',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
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
      tags, todos, links, linkedContactIds, customNoteCategories,
      ownerId, collaborators, invitations, notes, owner,
      id, createdAt, updatedAt, collaboratorIds,
      children, parent,
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
    if (links !== undefined) data.links = Array.isArray(links) ? JSON.stringify(links) : links;
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

app.post('/api/ideas/:id/attachments', authenticate, async (req: any, res) => {
  try {
    const ideaId = req.params.id;
    const { title, description, fileName, fileType, fileSize, content } = req.body;

    const idea = await prisma.idea.findUnique({
      where: { id: ideaId },
      include: { collaborators: true }
    });
    if (!idea) return res.status(404).json({ error: 'Idea not found' });
    const hasAccess = idea.ownerId === req.userId || idea.collaborators.some(c => c.id === req.userId);
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    const attachment = await prisma.fileAttachment.create({
      data: { title, description: description || null, fileName, fileType, fileSize, content, ideaId }
    });

    res.json(attachment);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to upload attachment', details: err.message });
  }
});

app.post('/api/ideas/:id/attachments/chunk', authenticate, async (req: any, res) => {
  try {
    const { uploadId, chunkIndex, content } = req.body;
    await prisma.fileAttachmentChunk.create({
      data: { uploadId, chunkIndex, content }
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save chunk', details: err.message });
  }
});

app.post('/api/ideas/:id/attachments/finalize', authenticate, async (req: any, res) => {
  try {
    const ideaId = req.params.id;
    const { uploadId, title, description, fileName, fileType, fileSize } = req.body;

    const idea = await prisma.idea.findUnique({
      where: { id: ideaId },
      include: { collaborators: true }
    });
    if (!idea) return res.status(404).json({ error: 'Idea not found' });
    const hasAccess = idea.ownerId === req.userId || idea.collaborators.some(c => c.id === req.userId);
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    const chunks = await prisma.fileAttachmentChunk.findMany({
      where: { uploadId },
      orderBy: { chunkIndex: 'asc' }
    });

    const fullContent = chunks.map(c => c.content).join('');

    const attachment = await prisma.fileAttachment.create({
      data: { title, description: description || null, fileName, fileType, fileSize, content: fullContent, ideaId }
    });

    await prisma.fileAttachmentChunk.deleteMany({ where: { uploadId } });

    res.json(attachment);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to finalize upload', details: err.message });
  }
});

app.get('/api/ideas/:id/attachments', authenticate, async (req: any, res) => {
  try {
    const ideaId = req.params.id;
    const idea = await prisma.idea.findUnique({
      where: { id: ideaId },
      include: { collaborators: true }
    });
    if (!idea) return res.status(404).json({ error: 'Idea not found' });
    const hasAccess = idea.ownerId === req.userId || idea.collaborators.some(c => c.id === req.userId);
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    const attachments = await prisma.fileAttachment.findMany({
      where: { ideaId },
      select: { id: true, title: true, description: true, fileName: true, fileType: true, fileSize: true, createdAt: true, ideaId: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json(attachments);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch attachments', details: err.message });
  }
});

app.get('/api/attachments/:id/raw/:filename', authenticate, async (req: any, res) => {
  try {
    const attachment = await prisma.fileAttachment.findUnique({
      where: { id: req.params.id },
      include: { idea: { include: { collaborators: true } } }
    });
    if (!attachment) return res.status(404).send('Not found');
    
    const hasAccess = attachment.idea.ownerId === req.userId || attachment.idea.collaborators.some(c => c.id === req.userId);
    if (!hasAccess) return res.status(403).send('Access denied');

    const base64Data = attachment.content.split(';base64,').pop();
    if (!base64Data) return res.status(400).send('Invalid file format');
    
    const buffer = Buffer.from(base64Data, 'base64');
    
    res.setHeader('Content-Type', attachment.fileType);
    res.setHeader('Content-Disposition', `inline; filename="${attachment.fileName}"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).send('Error loading file');
  }
});

app.get('/api/attachments/:id/content', authenticate, async (req: any, res) => {
  try {
    const attachment = await prisma.fileAttachment.findUnique({
      where: { id: req.params.id },
      include: { idea: { include: { collaborators: true } } }
    });
    if (!attachment || !attachment.idea) return res.status(404).json({ error: 'Not found' });
    const hasAccess = attachment.idea.ownerId === req.userId || attachment.idea.collaborators.some(c => c.id === req.userId);
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    res.json({ content: attachment.content });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch attachment content', details: err.message });
  }
});

app.put('/api/attachments/:id', authenticate, async (req: any, res) => {
  try {
    const { title } = req.body;
    const attachment = await prisma.fileAttachment.findUnique({
      where: { id: req.params.id },
      include: { idea: { include: { collaborators: true } } }
    });
    if (!attachment || !attachment.idea) return res.status(404).json({ error: 'Not found' });
    const hasAccess = attachment.idea.ownerId === req.userId || attachment.idea.collaborators.some(c => c.id === req.userId);
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    const updated = await prisma.fileAttachment.update({
      where: { id: req.params.id },
      data: { title }
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update attachment' });
  }
});

app.delete('/api/attachments/:id', authenticate, async (req: any, res) => {
  try {
    const attachment = await prisma.fileAttachment.findUnique({
      where: { id: req.params.id },
      include: { idea: { include: { collaborators: true } } }
    });
    if (!attachment || !attachment.idea) return res.status(404).json({ error: 'Not found' });
    const hasAccess = attachment.idea.ownerId === req.userId || attachment.idea.collaborators.some(c => c.id === req.userId);
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    await prisma.fileAttachment.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete attachment', details: err.message });
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
    const { userQuery } = req.body;
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
    if (idea.oneLiner) contextLines.push(`Program Brief/Mission: ${idea.oneLiner}`);
    if (idea.problem) contextLines.push(`Problem: ${idea.problem}`);
    if (idea.solution) contextLines.push(`Solution: ${idea.solution}`);
    if (idea.targetCustomer) contextLines.push(`Target Customer: ${idea.targetCustomer}`);
    if (idea.businessModel) contextLines.push(`Business Model: ${idea.businessModel}`);
    if (idea.risks) contextLines.push(`Risks: ${idea.risks}`);

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

    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    const prompt = `You are an expert business counselor and strategist. 
Review the following innovation project data and provide the SINGLE BEST NEXT STEP the user should take.
${userQuery ? `\nUSER SPECIFIC FOCUS/QUESTION: "${userQuery}"\n` : ''}
Be concise (max 3-4 sentences). Use a professional, encouraging, and highly strategic tone.
If there are many pending todos, identify the most critical one. 
If notes suggest a pivot or a specific blocker, address it.
If the user provided a specific focus above, prioritize addressing that.

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

    const fullName = `${contactData.firstName || ''} ${contactData.lastName || ''} `.trim();

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
    const { id, createdAt, updatedAt, notesAssociated, taggedInNotes, associatedNotes, linkedIdeaIds, linkedEntityIds, ...updates } = req.body;

    // Ownership check
    const existing = await prisma.contact.findUnique({ where: { id: req.params.id } }) as any;
    if (existing && existing.ownerId && existing.ownerId !== req.userId) {
      return res.status(403).json({ error: 'You do not have permission to update this contact' });
    }

    const data: any = { ...updates };
    if (req.body.notes !== undefined) data.notes = req.body.notes;
    if (linkedIdeaIds !== undefined) data.linkedIdeaIds = Array.isArray(linkedIdeaIds) ? JSON.stringify(linkedIdeaIds) : linkedIdeaIds;
    if (linkedEntityIds !== undefined) data.linkedEntityIds = linkedEntityIds;

    const fullName = updates.firstName !== undefined || updates.lastName !== undefined
      ? `${updates.firstName ?? existing.firstName ?? ''} ${updates.lastName ?? existing.lastName ?? ''} `.trim()
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

// --- ENTITIES ---
app.post('/api/entities', authenticate, async (req: any, res) => {
  try {
    const { id, createdAt, updatedAt, taggedInNotes, ...entityData } = req.body;
    const entity = await (prisma.entity as any).create({
      data: {
        ...entityData,
        ownerId: req.userId
      }
    });
    res.json(entity);
  } catch (err: any) {
    console.error('Create entity error:', err);
    res.status(500).json({ error: 'Failed to create entity', details: err.message });
  }
});

app.put('/api/entities/:id', authenticate, async (req: any, res) => {
  try {
    const { id, createdAt, updatedAt, taggedInNotes, ...updates } = req.body;
    const existing = await (prisma.entity as any).findUnique({ where: { id: req.params.id } });
    if (existing && existing.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const entity = await (prisma.entity as any).update({
      where: { id: req.params.id },
      data: updates
    });
    res.json(entity);
  } catch (err: any) {
    console.error('Update entity error:', err);
    res.status(500).json({ error: 'Failed to update entity', details: err.message });
  }
});

app.delete('/api/entities/:id', authenticate, async (req: any, res) => {
  try {
    const existing = await (prisma.entity as any).findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Entity not found' });
    if (existing.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    await (prisma.entity as any).delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete entity error:', err);
    res.status(500).json({ error: 'Failed to delete entity', details: err.message });
  }
});

// --- NOTES ---
app.post('/api/notes', authenticate, async (req: any, res) => {
  try {
    const {
      taggedContactIds, taggedUserIds, taggedEntityIds, categories, body, ideaId, contactId,
      id, createdAt, updatedAt, author, idea, contact, taggedContacts, taggedUsers, taggedEntities,
      ...noteData
    } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.userId } });

    if (req.body.imageUrl) {
      console.log(`Note creation with image.Length: ${req.body.imageUrl.length} `);
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
        taggedEntities: { connect: (taggedEntityIds || []).map((id: string) => ({ id })) },
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
      details: `${err.name}: ${err.message}${err.code ? ' (Code: ' + err.code + ')' : ''} `
    });
  }
});

app.put('/api/notes/:id', authenticate, async (req: any, res) => {
  const {
    taggedContactIds, taggedUserIds, taggedEntityIds, categories, body,
    id, createdAt, updatedAt, author, idea, contact, taggedContacts, taggedUsers, taggedEntities,
    ...updates
  } = req.body;
  const data: any = { ...updates };
  if (body !== undefined) data.content = body; // Map 'body' to 'content'
  if (categories) data.categories = Array.isArray(categories) ? JSON.stringify(categories) : categories;
  if (createdAt) data.createdAt = new Date(createdAt);

  if (taggedContactIds) data.taggedContacts = { set: taggedContactIds.map((id: string) => ({ id })) };
  if (taggedUserIds) data.taggedUsers = { set: taggedUserIds.map((id: string) => ({ id })) };
  if (taggedEntityIds) data.taggedEntities = { set: taggedEntityIds.map((id: string) => ({ id })) };

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

    console.log(`Attempting to delete note ${req.params.id} by user ${req.userId} `);

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
      console.warn(`Unauthorized delete attempt on note ${note.id} by user ${req.userId} `);
      return res.status(403).json({ error: 'Unauthorized to delete this note' });
    }

    await prisma.note.delete({ where: { id: req.params.id } });
    console.log(`Successfully deleted note ${req.params.id} `);
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

// --- DAILY TODOS ---
app.get('/api/daily-todos', authenticate, async (req: any, res) => {
  try {
    const { from, to } = req.query;
    const baseWhere = {
      parentId: null,
      OR: [
        { userId: req.userId },
        { assigneeId: req.userId },
        { idea: { OR: [{ ownerId: req.userId }, { collaborators: { some: { id: req.userId } } }] } }
      ]
    };
    const where: any = { ...baseWhere };
    if (from || to) {
      // Fetch date-ranged tasks OR floating (date=null) tasks
      const dateFilter: any = {};
      if (from) dateFilter.gte = new Date(from as string);
      if (to) dateFilter.lte = new Date(to as string);
      where.AND = [
        { OR: [{ date: dateFilter }, { date: null }] }
      ];
    }
    const userSelect = { id: true, name: true, email: true, avatarUrl: true, themeAdjustments: true };
    const todos = await (prisma as any).dailyTodo.findMany({
      where,
      orderBy: [{ date: { sort: 'asc', nulls: 'last' } }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        idea: { select: { id: true, title: true } },
        assignee: { select: userSelect },
        completedBy: { select: userSelect },
        children: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: { 
            idea: { select: { id: true, title: true } },
            assignee: { select: userSelect },
            completedBy: { select: userSelect }
          }
        }
      }
    });
    res.json(todos);
  } catch (err: any) {
    console.error('Daily todos fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch daily todos', details: err.message });
  }
});

app.post('/api/daily-todos', authenticate, async (req: any, res) => {
  try {
    const { text, date, isUrgent, ideaId, parentId, timeBlock, comments } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });
    // date can be null for floating/backburner tasks
    const dateVal = date ? new Date(date + 'T12:00:00Z') : null;
    const minOrder = await (prisma as any).dailyTodo.aggregate({
      where: { userId: req.userId, date: dateVal, parentId: parentId || null },
      _min: { sortOrder: true }
    });
    const nextOrder = (minOrder._min.sortOrder ?? 0) - 1;
    const userSelect = { id: true, name: true, email: true, avatarUrl: true, themeAdjustments: true };
    const todo = await (prisma as any).dailyTodo.create({
      data: {
        text,
        date: dateVal,
        isUrgent: isUrgent || false,
        sortOrder: nextOrder,
        ideaId: ideaId || null,
        parentId: parentId || null,
        timeBlock: timeBlock || null,
        comments: comments || null,
        userId: req.userId,
        assigneeId: req.userId // Automatically assign to creator
      },
      include: {
        idea: { select: { id: true, title: true } },
        assignee: { select: userSelect },
        completedBy: { select: userSelect },
        children: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: { 
            idea: { select: { id: true, title: true } },
            assignee: { select: userSelect },
            completedBy: { select: userSelect }
          }
        }
      }
    });
    res.json(todo);
  } catch (err: any) {
    console.error('Daily todo create error:', err);
    res.status(500).json({ error: 'Failed to create daily todo', details: err.message });
  }
});

// --- Quick Capture ---------------------------------------------------------
// Frictionless single-field capture used by the iOS Shortcut and the /capture
// PWA page. Creates a to-do for today (or the supplied date) with minimal input.
const blockForHour = (h: number) => (h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening');

// Read a natural-language date directive from the start of an email subject:
//   "Monday: Send docs"      -> next Monday (incl. today)         text: "Send docs"
//   "Monday +1w: Send docs"  -> that Monday + 1 week              text: "Send docs"
//   "tomorrow +3d: call Ana" -> tomorrow + 3 days                 text: "call Ana"
//   "Buy milk"               -> today (no date word)              text: "Buy milk"
// An optional "+Nw" (weeks) / "+Nd" (days) offset is added to the resolved date.
// Dates are resolved in Europe/London so weekday math matches the user's day.
const parseInboundWhen = (subject: string): { dateKey: string; text: string } => {
  const londonToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date()); // YYYY-MM-DD
  const base = new Date(londonToday + 'T12:00:00Z');
  const toKey = (d: Date) => d.toISOString().slice(0, 10);
  const addDays = (d: Date, n: number) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
  const DAYS: Record<string, number> = {
    sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3,
    thursday: 4, thu: 4, thur: 4, thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
  };
  // <word> [ +N w|d ] <: or -> <text>
  const m = subject.match(/^\s*([A-Za-z]+)\s*(\+\s*\d+\s*[wd])?\s*[:\-]\s*(.+)$/is);
  if (m) {
    const word = m[1].toLowerCase();
    const rest = m[3].trim();
    let day: Date | null = null;
    if (word === 'today') day = base;
    else if (word === 'tomorrow' || word === 'tmrw' || word === 'tmw') day = addDays(base, 1);
    else if (word in DAYS) day = addDays(base, (DAYS[word] - base.getUTCDay() + 7) % 7); // 0 = today

    if (day) {
      const off = (m[2] || '').match(/\+\s*(\d+)\s*([wd])/i);
      if (off) day = addDays(day, off[2].toLowerCase() === 'w' ? parseInt(off[1], 10) * 7 : parseInt(off[1], 10));
      return { dateKey: toKey(day), text: rest };
    }
  }
  return { dateKey: toKey(base), text: subject.trim() };
};

// Pull bullet lines out of an email body — "-", "*", "•", "‣", "·" or "1." / "1)".
// Each becomes a subtask of the main (subject) task. Capped to avoid abuse.
const parseBullets = (body: string): string[] =>
  (body || '')
    .split('\n')
    .map(l => l.trim())
    .map(l => {
      const m = l.match(/^(?:[-*•‣▪·◦]|\d+[.)])\s+(.+)$/);
      return m ? m[1].trim() : '';
    })
    .filter(Boolean)
    .slice(0, 50);

// Forwarded-email → tasks, via Gemini. Returns an array of tasks or null on failure.
const parseLooseJson = (text: string): any => {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
};
// Split a leading user instruction from the rest of the email body. The prose the
// user writes at the very top — before a forward separator, or as a "/command" —
// becomes an explicit prompt to the AI.
const FWD_MARKERS = /(-{2,}\s*forwarded message|begin forwarded message|-{2,}\s*original message|^\s*on .+ wrote:)/im;
const splitInstruction = (raw: string): { instruction: string; content: string } => {
  const body = (raw || '').replace(/\r\n/g, '\n');
  if (/^\s*\//.test(body)) { // "/do this" command email
    const brk = body.indexOf('\n\n');
    if (brk > -1) return { instruction: body.slice(0, brk).replace(/^\s*\//, '').trim(), content: body.slice(brk + 2).trim() };
    return { instruction: body.replace(/^\s*\//, '').trim(), content: '' };
  }
  const m = body.match(FWD_MARKERS);
  if (m && (m.index ?? 0) > 0) {
    const lead = body.slice(0, m.index).trim();
    if (lead.length <= 600) return { instruction: lead, content: body.slice(m.index).trim() };
  }
  return { instruction: '', content: body };
};

const interpretForwardedEmail = async (subject: string, body: string, instruction?: string): Promise<any[] | null> => {
  if (!genAI) return null;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  const cleanSubject = (subject || '').replace(/^\s*(re|fwd?|fw)\s*:\s*/i, '').trim();
  const model = genAI.getGenerativeModel({
    model: 'gemini-flash-latest',
    generationConfig: { responseMimeType: 'application/json' } as any,
  });
  const prompt = `You convert an email into actionable to-do items for a personal task manager.
Today is ${today} (Europe/London).
${instruction ? `The user's instruction — follow it closely: """${instruction}"""` : 'If the user wrote instructions at the very top of the body, follow them.'}
Otherwise, prefer ONE task unless the content clearly contains multiple distinct action items.

Return ONLY JSON of this exact shape:
{"tasks":[{"title":"short imperative task","subtasks":["concrete step"],"note":"1-2 sentence summary/context","date":"YYYY-MM-DD or null"}]}
Rules: title concise & imperative; subtasks only concrete steps ([] if none); note brief ("" if not useful);
date only if a due date is clearly stated/implied else null; max 8 tasks, max 15 subtasks each.

SUBJECT: ${cleanSubject}
CONTENT:
${(body || '').slice(0, 8000)}`;
  try {
    const result = await model.generateContent(prompt);
    const text = (await result.response).text();
    const parsed = parseLooseJson(text);
    if (parsed && Array.isArray(parsed.tasks)) return parsed.tasks.slice(0, 8);
  } catch (e: any) {
    console.error('[inbound-email] AI interpret failed:', e?.message);
  }
  return null;
};

// --- Library (saved links/articles) helpers --------------------------------
const extractUrls = (text: string): string[] => {
  const matches = (text || '').match(/https?:\/\/[^\s<>()"']+/gi) || [];
  const junk = /(unsubscribe|list-manage|mailchi|utm_|\/track|\.(png|jpe?g|gif|svg|css|js|ico)(\?|$))/i;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of matches) {
    const u = raw.replace(/[.,;:)\]}>]+$/, '');
    if (junk.test(u) || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= 3) break;
  }
  return out;
};

const fetchPageText = async (url: string): Promise<{ title: string; text: string } | null> => {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IdeaCRM/1.0)' }, signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 6000);
    return { title, text };
  } catch {
    return null;
  }
};

const summarizeLink = async (
  url: string,
  page: { title: string; text: string } | null,
  emailContext: string
): Promise<{ title: string; summary: string }> => {
  let fallbackTitle = page?.title || url;
  try { if (!page?.title) fallbackTitle = new URL(url).hostname.replace(/^www\./, ''); } catch {}
  if (!genAI) return { title: fallbackTitle, summary: '' };
  const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest', generationConfig: { responseMimeType: 'application/json' } as any });
  const source = page?.text ? `PAGE CONTENT:\n${page.text}` : `EMAIL CONTEXT:\n${(emailContext || '').slice(0, 4000)}`;
  const prompt = `Summarize this saved link/article for a personal reading library.
Return ONLY JSON: {"title":"clean concise title","summary":"2-3 sentence summary of what it's about and why it's worth reading"}.
If the content is thin, infer sensibly from the URL and any context. Be factual, no fluff.
URL: ${url}
${source}`;
  try {
    const r = await model.generateContent(prompt);
    const j = parseLooseJson((await r.response).text());
    if (j) return {
      title: String(j.title || fallbackTitle).slice(0, 300),
      summary: String(j.summary || '').slice(0, 2000),
    };
  } catch (e: any) {
    console.error('[library] summarize failed:', e?.message);
  }
  return { title: fallbackTitle, summary: '' };
};

// Minimal vCard (.vcf) parser — pulls the fields we store on a Contact. Handles
// RFC line-folding, grouped Apple properties (item1.EMAIL), and multiple cards.
const parseVCards = (vcf: string): Array<Record<string, string | undefined>> => {
  const unfolded = vcf.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
  const cards: any[] = [];
  for (const block of unfolded.split(/BEGIN:VCARD/i).slice(1)) {
    const bodyText = block.split(/END:VCARD/i)[0] || '';
    const card: any = {};
    for (const line of bodyText.split('\n')) {
      const ci = line.indexOf(':');
      if (ci < 0) continue;
      const left = line.slice(0, ci);
      const value = line.slice(ci + 1).trim();
      if (!value) continue;
      const rawName = left.split(';')[0];
      const name = (rawName.includes('.') ? rawName.split('.').pop()! : rawName).toUpperCase();
      if (name === 'FN' && !card.fullName) card.fullName = value;
      else if (name === 'N' && !card.firstName && !card.lastName) {
        const parts = value.split(';');
        card.lastName = (parts[0] || '').trim() || undefined;
        card.firstName = (parts[1] || '').trim() || undefined;
      }
      else if (name === 'EMAIL' && !card.email) card.email = value;
      else if (name === 'TEL' && !card.phone) card.phone = value;
      else if (name === 'ORG' && !card.company) card.company = value.split(';')[0].trim();
      else if (name === 'TITLE' && !card.role) card.role = value;
      else if (name === 'URL') {
        let host = '';
        try { host = new URL(/^https?:\/\//i.test(value) ? value : 'https://' + value).host.toLowerCase().replace(/^www\./, ''); } catch {}
        if ((host === 'linkedin.com' || host.endsWith('.linkedin.com')) && !card.linkedinUrl) card.linkedinUrl = value;
        else if (host === 'instagram.com' && !card.instagramUrl) card.instagramUrl = value;
        else if ((host === 'twitter.com' || host === 'x.com') && !card.twitterUrl) card.twitterUrl = value;
        else if ((host === 'substack.com' || host.endsWith('.substack.com')) && !card.substackUrl) card.substackUrl = value;
      }
    }
    if (!card.fullName && (card.firstName || card.lastName)) card.fullName = [card.firstName, card.lastName].filter(Boolean).join(' ');
    if (card.fullName || card.email) cards.push(card);
  }
  return cards;
};

// Find-or-create a contact for this owner. Dedupes by email, else by exact full
// name. On a match it fills ONLY empty fields (so a re-sent card enriches without
// clobbering existing data) and merges the idea link. Returns the contact id.
const CONTACT_FIELDS = ['fullName', 'firstName', 'lastName', 'email', 'phone', 'company', 'role', 'linkedinUrl', 'instagramUrl', 'twitterUrl', 'substackUrl'];
const upsertContact = async (
  userId: string,
  fields: Record<string, any>,
  ideaId: string | null
): Promise<{ id: string; action: 'created' | 'updated' }> => {
  let existing: any = null;
  if (fields.email) existing = await prisma.contact.findFirst({ where: { ownerId: userId, email: { equals: fields.email, mode: 'insensitive' } as any } });
  if (!existing && fields.fullName) existing = await prisma.contact.findFirst({ where: { ownerId: userId, fullName: { equals: fields.fullName, mode: 'insensitive' } as any } });

  if (existing) {
    const data: any = {};
    for (const k of CONTACT_FIELDS) if (!existing[k] && fields[k]) data[k] = fields[k]; // fill gaps only
    let linked: string[] = [];
    try { linked = JSON.parse(existing.linkedIdeaIds || '[]'); } catch {}
    if (ideaId && !linked.includes(ideaId)) { linked.push(ideaId); data.linkedIdeaIds = JSON.stringify(linked); }
    if (Object.keys(data).length) await prisma.contact.update({ where: { id: existing.id }, data });
    return { id: existing.id, action: 'updated' };
  }
  const data: any = { ownerId: userId, linkedIdeaIds: ideaId ? JSON.stringify([ideaId]) : '[]' };
  for (const k of CONTACT_FIELDS) if (fields[k]) data[k] = fields[k];
  const created = await prisma.contact.create({ data });
  return { id: created.id, action: 'created' };
};

app.post('/api/quick-capture', authenticate, async (req: any, res) => {
  try {
    const rawInput = (req.body?.text ?? '').toString().trim();
    if (!rawInput) return res.status(400).json({ error: 'text is required' });

    // A note can be attached two ways: an explicit `note` field, or inline in the
    // text after a "//" separator (keeps a single Shortcut prompt). Explicit wins.
    // The "//" match ignores surrounding spaces but skips "://" so URLs (http://…)
    // are never split.
    let rawText = rawInput;
    let note = (req.body?.note ?? '').toString().trim();
    if (!note) {
      const m = rawInput.match(/([^:])\/\/\s*/);
      if (m && typeof m.index === 'number') {
        rawText = rawInput.slice(0, m.index + 1).trim();
        note = rawInput.slice(m.index + m[0].length).trim();
      }
    }
    if (!rawText) rawText = 'Untitled';

    // Bullets / dashes become subtasks. Two shapes are supported:
    //   • multi-line  — first line is the task, each following line a subtask
    //                   (leading bullet/number optional; e.g. the capture page)
    //   • single line — "Task - a - b - c" (spaced dash) or bullet chars split
    //                   the first chunk as the task and the rest as subtasks
    // Spaced separators are required so hyphenated words (e-commerce) never split.
    const stripBullet = (s: string) => s.replace(/^(?:[-*•‣▪·◦]|\d+[.)])\s+/, '').trim();
    let mainText = rawText;
    let subTexts: string[] = [];
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length > 1) {
      mainText = stripBullet(lines[0]);
      subTexts = lines.slice(1).map(stripBullet).filter(Boolean);
    } else {
      const parts = rawText.split(/\s+[-–—•·‣▪◦]\s+/).map(s => s.trim()).filter(Boolean);
      if (parts.length > 1) { mainText = parts[0]; subTexts = parts.slice(1); }
    }
    if (!mainText) mainText = 'Untitled';
    subTexts = subTexts.slice(0, 50);

    // Default to today (UTC) when the caller doesn't send a date (e.g. the Shortcut).
    const dateKey = (req.body?.date ? String(req.body.date) : new Date().toISOString()).slice(0, 10);
    const dateVal = new Date(dateKey + 'T12:00:00Z');
    const timeBlock = req.body?.timeBlock || blockForHour(new Date().getUTCHours());

    const minOrder = await (prisma as any).dailyTodo.aggregate({
      where: { userId: req.userId, date: dateVal, parentId: null },
      _min: { sortOrder: true }
    });
    const nextOrder = (minOrder._min.sortOrder ?? 0) - 1;

    const todo = await (prisma as any).dailyTodo.create({
      data: {
        text: mainText.slice(0, 500),
        comments: note ? note.slice(0, 2000) : null,
        date: dateVal,
        sortOrder: nextOrder,
        timeBlock,
        userId: req.userId,
        assigneeId: req.userId,
      }
    });

    // Create any subtasks under the freshly-made task.
    for (let i = 0; i < subTexts.length; i++) {
      await (prisma as any).dailyTodo.create({
        data: {
          text: subTexts[i].slice(0, 500),
          date: dateVal,
          parentId: todo.id,
          sortOrder: i,
          timeBlock,
          userId: req.userId,
          assigneeId: req.userId,
        }
      });
    }

    res.json({ ok: true, todo, subtasks: subTexts.length });
  } catch (err: any) {
    console.error('Quick capture error:', err);
    res.status(500).json({ error: 'Failed to capture', details: err.message });
  }
});

// Mint a long-lived personal capture token (JWTs here have no expiry) for use in
// the iOS Shortcut. Revoke by rotating JWT_SECRET (invalidates all sessions).
app.get('/api/capture-token', authenticate, async (req: any, res) => {
  try {
    const token = jwt.sign({ userId: req.userId, scope: 'capture' }, JWT_SECRET);
    res.json({ token });
  } catch (err: any) {
    console.error('Capture token error:', err);
    res.status(500).json({ error: 'Failed to mint capture token' });
  }
});

// --- Inbound email → task/contact (Postmark inbound webhook) ---------------
// Postmark POSTs parsed-email JSON here. Auth is a shared secret in the query
// string (only Postmark knows the URL); the sender's email must also match a
// registered user, which both identifies the owner and acts as an allow-list.
// Subject "contact: <name>" creates a contact; anything else becomes a to-do.
app.post('/api/inbound-email', async (req: any, res) => {
  try {
    const secret = (req.query.secret || req.headers['x-inbound-secret'] || '').toString();
    if (!process.env.INBOUND_EMAIL_SECRET || secret !== process.env.INBOUND_EMAIL_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body || {};
    const senderEmail = (body.FromFull?.Email || body.From || '').toString().trim().toLowerCase();
    const subject = (body.Subject || '').toString().trim();
    const textBody = (body.StrippedTextReply || body.TextBody || '').toString().trim();
    if (!senderEmail) return res.status(200).json({ ok: false, ignored: 'no sender' });

    // Resolve the owning user + target idea from the InboundRoute table (managed in
    // Settings → Email-in routing). Falls back to "sender is itself a registered user".
    const route = await (prisma as any).inboundRoute.findFirst({ where: { senderEmail } });
    let user: any = null;
    let mappedIdeaId: string | null = null;
    if (route) {
      user = await prisma.user.findFirst({ where: { id: route.userId } });
      mappedIdeaId = route.ideaId || null;
    } else {
      user = await prisma.user.findFirst({ where: { email: { equals: senderEmail, mode: 'insensitive' } as any } });
    }
    if (!user) {
      console.warn('[inbound-email] ignoring email from unknown sender:', senderEmail);
      return res.status(200).json({ ok: false, ignored: 'unknown sender' }); // 200 => Postmark won't retry
    }
    const userId = user.id;

    // Only attach the idea if it exists and belongs to the owner (else silently drop it).
    let ideaId: string | null = null;
    if (mappedIdeaId) {
      const idea = await prisma.idea.findFirst({ where: { id: mappedIdeaId, ownerId: userId } });
      ideaId = idea ? idea.id : null;
    }

    // "lib:" → save link(s)/article(s) to the Library, each summarized by AI.
    if (/^\s*lib\s*:/i.test(subject)) {
      const fullBody = (body.TextBody || textBody || '').toString();
      const urls = extractUrls(subject + '\n' + fullBody);
      if (!urls.length) return res.status(200).json({ ok: false, ignored: 'no url in lib email' });
      const sourceSubject = subject.replace(/^\s*lib\s*:\s*/i, '').trim() || null;
      const createdIds: string[] = [];
      for (const url of urls) {
        const page = await fetchPageText(url);
        const { title, summary } = await summarizeLink(url, page, fullBody);
        const item = await (prisma as any).libraryItem.create({
          data: { url, title, summary: summary || null, sourceSubject, userId, ideaId }
        });
        createdIds.push(item.id);
      }
      return res.json({ ok: true, created: 'library', count: createdIds.length });
    }

    // Highest priority: a vCard (.vcf) attachment → create contact(s), linked to the
    // sender's mapped idea. This is the common "share a contact card" flow.
    const attachments = Array.isArray(body.Attachments) ? body.Attachments : [];
    const vcfs = attachments.filter((a: any) =>
      /vcard|vcf|directory/i.test(a?.ContentType || '') || /\.vcf$/i.test(a?.Name || ''));
    if (vcfs.length) {
      const ids: string[] = [];
      let createdCount = 0, updatedCount = 0;
      for (const att of vcfs) {
        let vcfText = '';
        try { vcfText = Buffer.from(att.Content || '', 'base64').toString('utf8'); } catch {}
        for (const c of parseVCards(vcfText)) {
          const r = await upsertContact(userId, c, ideaId);
          ids.push(r.id);
          r.action === 'created' ? createdCount++ : updatedCount++;
        }
      }
      return res.json({ ok: ids.length > 0, created: 'contact', count: ids.length, createdCount, updatedCount, ids });
    }

    // Route: "contact: <name> [<email>]" → contact; otherwise → a to-do.
    const contactMatch = subject.match(/^contact:\s*(.+)$/i);
    if (contactMatch) {
      const rest = contactMatch[1].trim();
      const emailInName = rest.match(/<?([^\s<>]+@[^\s<>]+)>?/);
      const email = emailInName ? emailInName[1] : undefined;
      const fullName = rest.replace(/<?[^\s<>]+@[^\s<>]+>?/, '').trim() || rest;
      const r = await upsertContact(userId, { fullName, email }, ideaId);
      return res.json({ ok: true, created: 'contact', id: r.id, action: r.action });
    }

    // AI mode: a forwarded email (Fwd:), OR a body that starts with a "/" instruction.
    // The prose you write at the top becomes an explicit prompt for the AI.
    const fullBody = (body.TextBody || textBody || '').toString();
    // A forward — by subject (Fwd:/Fw:) OR by a "Forwarded message" marker in the body
    // (covers forwards whose subject was renamed). The prose above the marker is the prompt.
    const isForward = /^\s*(fwd?|fw)\s*:/i.test(subject)
      || /(-{2,}\s*forwarded message|begin forwarded message)/i.test(fullBody);
    const isCommand = /^\s*\//.test(fullBody);
    if (isForward || isCommand) {
      const { instruction, content } = splitInstruction(fullBody);
      const aiTasks = await interpretForwardedEmail(subject, content || fullBody, instruction || undefined);
      if (aiTasks && aiTasks.length) {
        const londonToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
        const createdIds: string[] = [];
        for (const t of aiTasks) {
          const dKey = (typeof t?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date)) ? t.date : londonToday;
          const dVal = new Date(dKey + 'T12:00:00Z');
          const minOrder = await (prisma as any).dailyTodo.aggregate({ where: { userId, date: dVal, parentId: null }, _min: { sortOrder: true } });
          const nextOrder = (minOrder._min.sortOrder ?? 0) - 1;
          const main = await (prisma as any).dailyTodo.create({
            data: {
              text: String(t?.title || 'Untitled').slice(0, 500),
              date: dVal, sortOrder: nextOrder, timeBlock: blockForHour(new Date().getUTCHours()),
              comments: t?.note ? String(t.note).slice(0, 2000) : null,
              userId, assigneeId: userId, ideaId,
            }
          });
          createdIds.push(main.id);
          const subs = Array.isArray(t?.subtasks) ? t.subtasks.slice(0, 15) : [];
          for (let i = 0; i < subs.length; i++) {
            await (prisma as any).dailyTodo.create({
              data: { text: String(subs[i]).slice(0, 500), date: dVal, parentId: main.id, sortOrder: i, userId, assigneeId: userId, ideaId }
            });
          }
        }
        return res.json({ ok: true, created: 'ai-tasks', count: createdIds.length });
      }
      // AI unavailable/failed → fall through to normal subject-as-task handling.
    }

    // Natural-language date from the subject ("Monday: ...", "tomorrow: ...").
    const when = parseInboundWhen(subject);
    // Strip any Fwd:/Fw:/Re: prefix so a fallback task is never named "Fwd: ...".
    const rawText = (when.text || textBody.split('\n')[0] || 'Untitled').replace(/^\s*(re|fwd?|fw)\s*:\s*/i, '').trim();
    const text = (rawText || 'Untitled').slice(0, 500);
    const dateVal = new Date(when.dateKey + 'T12:00:00Z');
    const minOrder = await (prisma as any).dailyTodo.aggregate({
      where: { userId, date: dateVal, parentId: null }, _min: { sortOrder: true }
    });
    const nextOrder = (minOrder._min.sortOrder ?? 0) - 1;
    const todo = await (prisma as any).dailyTodo.create({
      data: {
        text,
        date: dateVal,
        sortOrder: nextOrder,
        timeBlock: blockForHour(new Date().getUTCHours()),
        userId,
        assigneeId: userId,
        ideaId,
      }
    });

    // Bullet points in the body become subtasks of the main (subject) task.
    const bullets = parseBullets(textBody);
    for (let i = 0; i < bullets.length; i++) {
      await (prisma as any).dailyTodo.create({
        data: {
          text: bullets[i].slice(0, 500),
          date: dateVal,
          parentId: todo.id,
          sortOrder: i,
          userId,
          assigneeId: userId,
          ideaId,
        }
      });
    }

    return res.json({ ok: true, created: 'todo', id: todo.id, date: when.dateKey, ideaId, subtasks: bullets.length });
  } catch (err: any) {
    console.error('[inbound-email] error', err);
    // 200 so Postmark doesn't retry-storm on a parse error we can't recover from.
    return res.status(200).json({ ok: false, error: err.message });
  }
});

// --- Email-in routing rules (managed in Settings) --------------------------
const routeInclude = { idea: { select: { id: true, title: true } } };

app.get('/api/inbound-routes', authenticate, async (req: any, res) => {
  try {
    const routes = await (prisma as any).inboundRoute.findMany({
      where: { userId: req.userId }, include: routeInclude, orderBy: { createdAt: 'asc' }
    });
    res.json(routes);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load routes', details: err.message });
  }
});

app.post('/api/inbound-routes', authenticate, async (req: any, res) => {
  try {
    const senderEmail = (req.body?.senderEmail || '').toString().trim().toLowerCase();
    const ideaId = req.body?.ideaId || null;
    if (!senderEmail || !senderEmail.includes('@')) return res.status(400).json({ error: 'A valid sender email is required' });
    if (ideaId) {
      const idea = await prisma.idea.findFirst({ where: { id: ideaId, ownerId: req.userId } });
      if (!idea) return res.status(400).json({ error: 'Idea not found' });
    }
    const route = await (prisma as any).inboundRoute.create({
      data: { senderEmail, userId: req.userId, ideaId }, include: routeInclude
    });
    res.json(route);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'That sender is already routed' });
    res.status(500).json({ error: 'Failed to create route', details: err.message });
  }
});

app.put('/api/inbound-routes/:id', authenticate, async (req: any, res) => {
  try {
    const existing = await (prisma as any).inboundRoute.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.userId) return res.status(404).json({ error: 'Route not found' });
    const ideaId = req.body?.ideaId || null;
    if (ideaId) {
      const idea = await prisma.idea.findFirst({ where: { id: ideaId, ownerId: req.userId } });
      if (!idea) return res.status(400).json({ error: 'Idea not found' });
    }
    const route = await (prisma as any).inboundRoute.update({
      where: { id: req.params.id }, data: { ideaId }, include: routeInclude
    });
    res.json(route);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update route', details: err.message });
  }
});

app.delete('/api/inbound-routes/:id', authenticate, async (req: any, res) => {
  try {
    const existing = await (prisma as any).inboundRoute.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.userId) return res.status(404).json({ error: 'Route not found' });
    await (prisma as any).inboundRoute.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete route', details: err.message });
  }
});

// --- Library (saved links/articles) ----------------------------------------
app.get('/api/library', authenticate, async (req: any, res) => {
  try {
    const items = await (prisma as any).libraryItem.findMany({
      where: { userId: req.userId },
      include: { idea: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load library', details: err.message });
  }
});

app.post('/api/library', authenticate, async (req: any, res) => {
  try {
    const url = (req.body?.url || '').toString().trim();
    const ideaId = req.body?.ideaId || null;
    if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'A valid URL (http/https) is required' });
    if (ideaId) {
      const idea = await prisma.idea.findFirst({ where: { id: ideaId, ownerId: req.userId } });
      if (!idea) return res.status(400).json({ error: 'Idea not found' });
    }
    const page = await fetchPageText(url);
    const { title, summary } = await summarizeLink(url, page, '');
    const item = await (prisma as any).libraryItem.create({
      data: { url, title, summary: summary || null, userId: req.userId, ideaId },
      include: { idea: { select: { id: true, title: true } } },
    });
    res.json(item);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to add item', details: err.message });
  }
});

app.delete('/api/library/:id', authenticate, async (req: any, res) => {
  try {
    const existing = await (prisma as any).libraryItem.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.userId) return res.status(404).json({ error: 'Item not found' });
    await (prisma as any).libraryItem.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete item', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Project AI Overview: a dated analysis + chat thread per project, plus a
// project-scoped search across tasks, notes and library.
// ─────────────────────────────────────────────────────────────────────────────

// Owner or collaborator may view/use a project's overview.
const findAccessibleIdea = (ideaId: string, userId: string) =>
  (prisma as any).idea.findFirst({
    where: { id: ideaId, OR: [{ ownerId: userId }, { collaborators: { some: { id: userId } } }] },
  });

// Pull the project's recent activity into a compact text block the model can reason over.
const gatherProjectContext = async (ideaId: string): Promise<{ text: string; counts: any }> => {
  const [idea, todos, notes, library, attachments] = await Promise.all([
    (prisma as any).idea.findUnique({ where: { id: ideaId } }),
    (prisma as any).dailyTodo.findMany({ where: { ideaId }, orderBy: { updatedAt: 'desc' }, take: 120 }),
    (prisma as any).note.findMany({ where: { ideaId }, orderBy: { createdAt: 'desc' }, take: 60 }),
    (prisma as any).libraryItem.findMany({ where: { ideaId }, orderBy: { createdAt: 'desc' }, take: 40 }),
    (prisma as any).fileAttachment.findMany({ where: { ideaId }, select: { title: true, createdAt: true }, take: 40 }),
  ]);

  const fmtDate = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : '');
  const open = todos.filter((t: any) => !t.completed);
  const done = todos.filter((t: any) => t.completed);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = open.filter((t: any) => t.date && fmtDate(t.date) < today);

  const lines: string[] = [];
  lines.push(`PROJECT: ${idea?.title || ''}`);
  if (idea?.oneLiner) lines.push(`One-liner: ${idea.oneLiner}`);
  if (idea?.status) lines.push(`Status: ${idea.status}`);
  lines.push('');
  lines.push(`OPEN TASKS (${open.length}, of which ${overdue.length} overdue):`);
  open.slice(0, 60).forEach((t: any) => {
    const when = t.date ? ` [due ${fmtDate(t.date)}${fmtDate(t.date) < today ? ' — OVERDUE' : ''}]` : '';
    lines.push(`- ${t.text}${when}${t.isUrgent ? ' (urgent)' : ''}${t.comments ? ` — note: ${String(t.comments).slice(0, 200)}` : ''}`);
  });
  lines.push('');
  lines.push(`RECENTLY COMPLETED (${done.length}):`);
  done.slice(0, 25).forEach((t: any) => lines.push(`- ${t.text}${t.completedAt ? ` [done ${fmtDate(t.completedAt)}]` : ''}`));
  lines.push('');
  lines.push(`NOTES (${notes.length}):`);
  notes.slice(0, 40).forEach((n: any) => {
    const c = (n.content || '').toString().replace(/\s+/g, ' ').trim();
    if (c) lines.push(`- (${fmtDate(n.createdAt)}) ${c.slice(0, 400)}`);
  });
  lines.push('');
  lines.push(`LIBRARY / LINKS (${library.length}):`);
  library.slice(0, 30).forEach((l: any) => lines.push(`- ${l.title}${l.summary ? ` — ${String(l.summary).slice(0, 200)}` : ''} (${l.url})`));
  if (attachments.length) {
    lines.push('');
    lines.push(`DOCUMENTS (${attachments.length}): ${attachments.map((a: any) => a.title).join(', ')}`);
  }

  return {
    text: lines.join('\n').slice(0, 24000),
    counts: { open: open.length, overdue: overdue.length, done: done.length, notes: notes.length, library: library.length, docs: attachments.length },
  };
};

const analyzeProject = async (contextText: string, title: string): Promise<string> => {
  if (!genAI) return 'AI analysis is unavailable — the GEMINI_API_KEY is not configured on the server.';
  const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
  const prompt = `You are a sharp chief-of-staff reviewing the project "${title}". Below is everything on record — tasks, notes, saved links and documents. Write a crisp situation report in Markdown for the project owner.

Use these sections (omit any that would be empty):
### Where things stand
2-4 sentences on overall momentum and what this project is really about right now.
### Needs attention
Bullet the overdue/urgent items and anything stalled. Be specific — name the tasks.
### Recent movement
What's been done or captured lately.
### Suggested next moves
3-5 concrete, prioritised actions.

Be direct and useful, no filler. If the record is thin, say so plainly.

RECORD:
${contextText}`;
  try {
    const r = await model.generateContent(prompt);
    return (await r.response).text().trim();
  } catch (e: any) {
    console.error('[overview] analyze failed:', e?.message);
    return `The analysis could not be generated right now (${e?.message || 'unknown error'}). Please try again.`;
  }
};

const answerProjectQuestion = async (contextText: string, threadText: string, prompt: string, title: string): Promise<string> => {
  if (!genAI) return 'AI is unavailable — the GEMINI_API_KEY is not configured on the server.';
  const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
  const full = `You are a chief-of-staff for the project "${title}", answering the owner's question using the project record. Be concrete and reference specific tasks/notes where relevant. Reply in short Markdown.

PROJECT RECORD:
${contextText}

${threadText ? `EARLIER IN THIS CONVERSATION:\n${threadText}\n` : ''}
OWNER'S QUESTION:
${prompt}`;
  try {
    const r = await model.generateContent(full);
    return (await r.response).text().trim();
  } catch (e: any) {
    console.error('[overview] answer failed:', e?.message);
    return `Sorry — I couldn't answer that right now (${e?.message || 'unknown error'}).`;
  }
};

// Thread (analysis + chat), oldest first.
app.get('/api/ideas/:id/overview', authenticate, async (req: any, res) => {
  try {
    const idea = await findAccessibleIdea(req.params.id, req.userId);
    if (!idea) return res.status(404).json({ error: 'Project not found' });
    const messages = await (prisma as any).projectMessage.findMany({
      where: { ideaId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ messages, counts: (await gatherProjectContext(req.params.id)).counts });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load overview', details: err.message });
  }
});

// Generate a fresh dated analysis and append it to the thread.
app.post('/api/ideas/:id/overview/analyze', authenticate, async (req: any, res) => {
  try {
    const idea = await findAccessibleIdea(req.params.id, req.userId);
    if (!idea) return res.status(404).json({ error: 'Project not found' });
    const { text } = await gatherProjectContext(req.params.id);
    const content = await analyzeProject(text, idea.title);
    const msg = await (prisma as any).projectMessage.create({
      data: { ideaId: req.params.id, userId: req.userId, role: 'analysis', content },
    });
    res.json(msg);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to analyse', details: err.message });
  }
});

// Owner asks a follow-up; we store the prompt + the AI reply.
app.post('/api/ideas/:id/overview/message', authenticate, async (req: any, res) => {
  try {
    const idea = await findAccessibleIdea(req.params.id, req.userId);
    if (!idea) return res.status(404).json({ error: 'Project not found' });
    const prompt = (req.body?.prompt || '').toString().trim();
    if (!prompt) return res.status(400).json({ error: 'A prompt is required' });

    const prior = await (prisma as any).projectMessage.findMany({
      where: { ideaId: req.params.id }, orderBy: { createdAt: 'desc' }, take: 8,
    });
    const threadText = prior.reverse()
      .map((m: any) => `${m.role === 'user' ? 'OWNER' : m.role === 'assistant' ? 'YOU' : 'ANALYSIS'}: ${String(m.content).slice(0, 1200)}`)
      .join('\n\n');
    const { text } = await gatherProjectContext(req.params.id);
    const answer = await answerProjectQuestion(text, threadText, prompt, idea.title);

    const userMsg = await (prisma as any).projectMessage.create({
      data: { ideaId: req.params.id, userId: req.userId, role: 'user', content: prompt },
    });
    const aiMsg = await (prisma as any).projectMessage.create({
      data: { ideaId: req.params.id, userId: req.userId, role: 'assistant', content: answer },
    });
    res.json({ user: userMsg, assistant: aiMsg });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to answer', details: err.message });
  }
});

// Project-scoped search across tasks, notes and library.
app.get('/api/ideas/:id/search', authenticate, async (req: any, res) => {
  try {
    const idea = await findAccessibleIdea(req.params.id, req.userId);
    if (!idea) return res.status(404).json({ error: 'Project not found' });
    const q = (req.query.q || '').toString().trim();
    if (!q) return res.json({ todos: [], notes: [], library: [] });
    const ci = { contains: q, mode: 'insensitive' as const };
    const [todos, notes, library] = await Promise.all([
      (prisma as any).dailyTodo.findMany({
        where: { ideaId: req.params.id, OR: [{ text: ci }, { comments: ci }] },
        orderBy: { updatedAt: 'desc' }, take: 25,
        select: { id: true, text: true, completed: true, date: true, isUrgent: true },
      }),
      (prisma as any).note.findMany({
        where: { ideaId: req.params.id, content: ci },
        orderBy: { createdAt: 'desc' }, take: 25,
        select: { id: true, content: true, createdAt: true },
      }),
      (prisma as any).libraryItem.findMany({
        where: { ideaId: req.params.id, OR: [{ title: ci }, { summary: ci }, { url: ci }] },
        orderBy: { createdAt: 'desc' }, take: 25,
        select: { id: true, title: true, summary: true, url: true },
      }),
    ]);
    res.json({ todos, notes, library });
  } catch (err: any) {
    res.status(500).json({ error: 'Search failed', details: err.message });
  }
});

// Reorder daily todos
app.put('/api/daily-todos/reorder', authenticate, async (req: any, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds array required' });
    await (prisma as any).$transaction(
      orderedIds.map((id: string, index: number) =>
        (prisma as any).dailyTodo.updateMany({
          where: { id, userId: req.userId },
          data: { sortOrder: index }
        })
      )
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error('Reorder error:', err);
    res.status(500).json({ error: 'Failed to reorder', details: err.message });
  }
});

app.put('/api/daily-todos/:id', authenticate, async (req: any, res) => {
  try {
    const existing = await (prisma as any).dailyTodo.findUnique({ 
      where: { id: req.params.id },
      include: { idea: { select: { ownerId: true, collaborators: { select: { id: true } } } } }
    });
    if (!existing) return res.status(404).json({ error: 'Todo not found' });
    
    const hasProjectAccess = existing.idea && (existing.idea.ownerId === req.userId || existing.idea.collaborators.some((c: any) => c.id === req.userId));
    if (existing.userId !== req.userId && existing.assigneeId !== req.userId && !hasProjectAccess) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { text, completed, isUrgent, date, ideaId, status, dueDate, assigneeId, comments, originNoteId, timeBlock } = req.body;
    const data: any = {};
    if (text !== undefined) data.text = text;
    if (completed !== undefined) {
      data.completed = completed;
      data.completedAt = completed ? new Date() : null;
      data.completedById = completed ? req.userId : null;
    }
    if (isUrgent !== undefined) data.isUrgent = isUrgent;
    if (date !== undefined) data.date = date ? new Date(String(date).slice(0, 10) + 'T12:00:00Z') : null;
    if (ideaId !== undefined) data.ideaId = ideaId || null;
    if (status !== undefined) data.status = status;
    if (dueDate !== undefined) data.dueDate = dueDate || null;
    if (assigneeId !== undefined) data.assigneeId = assigneeId || null;
    if (comments !== undefined) data.comments = comments || null;
    if (originNoteId !== undefined) data.originNoteId = originNoteId || null;
    if (timeBlock !== undefined) data.timeBlock = timeBlock || null;

    const userSelect = { id: true, name: true, email: true, avatarUrl: true, themeAdjustments: true };
    const todo = await (prisma as any).dailyTodo.update({
      where: { id: req.params.id },
      data,
      include: {
        idea: { select: { id: true, title: true } },
        assignee: { select: userSelect },
        completedBy: { select: userSelect },
        children: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: { 
            idea: { select: { id: true, title: true } },
            assignee: { select: userSelect },
            completedBy: { select: userSelect }
          }
        }
      }
    });

    // --- Send assignment email when assignee changes to someone else ---
    if (assigneeId !== undefined && assigneeId && assigneeId !== req.userId && assigneeId !== existing.assigneeId) {
      try {
        const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
        const assigner = await prisma.user.findUnique({ where: { id: req.userId } });
        if (assignee?.email && assigner) {
          const projectTitle = todo.idea?.title || 'Personal Task';
          sendTaskAssignmentEmail(
            assignee.email,
            projectTitle,
            todo.text,
            assigner.name || 'A teammate',
            todo.idea?.id || ''
          ).catch(err => console.error('Failed to send task assignment email:', err));
        }
      } catch (emailErr) {
        console.error('Assignment email error (non-blocking):', emailErr);
      }
    }

    // --- Activity Log Sync ---
    // Only run when completion status actually changed
    const completionChanged = completed !== undefined && existing.completed !== todo.completed;
    if (completionChanged) {
    try {
      const raw = existing.activityNoteIds;
      const existingNoteIds: { ideaNoteId?: string; contactNoteIds?: Record<string, string> } = 
        raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};

      if (todo.completed) {
        const taskText = todo.text || '';
        const taskNotes = (todo.comments || '').trim();
        const taskIdeaId = todo.ideaId || null;
        const ideaTitle = todo.idea?.title || null;

        const mentionNames = extractDelimitedMentions(taskText, '@');

        // Find matching contacts
        const allContacts = await prisma.contact.findMany({ where: { ownerId: req.userId } as any });
        const mentionedContacts = mentionNames.map(name => {
          const lower = name.toLowerCase();
          return allContacts.find(c => {
            const full = (c.fullName || '').toLowerCase();
            const first = (c.firstName || '').toLowerCase();
            const last = (c.lastName || '').toLowerCase();
            return full === lower || first === lower || `${first} ${last}`.trim() === lower;
          });
        }).filter(Boolean) as typeof allContacts;

        const notesSection = taskNotes ? `\n\nNotes:\n${taskNotes}` : '';
        const user = await prisma.user.findUnique({ where: { id: req.userId } });
        const updated: { ideaNoteId?: string; contactNoteIds: Record<string, string> } = { contactNoteIds: {} };

        // --- Idea activity note ---
        if (taskIdeaId) {
          const contactNames = mentionedContacts.map(c => c.fullName || `${c.firstName} ${c.lastName}`).join(', ');
          const body = contactNames
            ? `✅ Completed task: "${taskText}"\n\nWith: ${contactNames}${notesSection}`
            : `✅ Completed task: "${taskText}"${notesSection}`;

          if (existingNoteIds.ideaNoteId) {
            try {
              await prisma.note.update({
                where: { id: existingNoteIds.ideaNoteId },
                data: {
                  content: body,
                  ideaId: taskIdeaId,
                  taggedContacts: { set: mentionedContacts.map(c => ({ id: c.id })) }
                }
              });
              updated.ideaNoteId = existingNoteIds.ideaNoteId;
            } catch {
              const note = await (prisma.note as any).create({
                data: {
                  content: body, categories: JSON.stringify(['Activity Log']),
                  createdById: req.userId, createdBy: user?.name || 'System',
                  ideaId: taskIdeaId,
                  taggedContacts: { connect: mentionedContacts.map(c => ({ id: c.id })) },
                }
              });
              updated.ideaNoteId = note.id;
            }
          } else {
            const note = await (prisma.note as any).create({
              data: {
                content: body, categories: JSON.stringify(['Activity Log']),
                createdById: req.userId, createdBy: user?.name || 'System',
                ideaId: taskIdeaId,
                taggedContacts: { connect: mentionedContacts.map(c => ({ id: c.id })) },
              }
            });
            updated.ideaNoteId = note.id;
          }
        } else if (existingNoteIds.ideaNoteId) {
          // Idea was untagged — delete the orphaned idea note
          try { await prisma.note.delete({ where: { id: existingNoteIds.ideaNoteId } }); } catch {}
        }

        // --- Contact activity notes ---
        const currentContactIds = new Set(mentionedContacts.map(c => c.id));
        const oldContactNoteIds = existingNoteIds.contactNoteIds || {};

        // Create or update notes for currently mentioned contacts
        for (const contact of mentionedContacts) {
          const ideaRef = ideaTitle ? `\n\nIdea: ${ideaTitle}` : '';
          const body = `✅ Completed task: "${taskText}"${ideaRef}${notesSection}`;

          if (oldContactNoteIds[contact.id]) {
            try {
              await prisma.note.update({
                where: { id: oldContactNoteIds[contact.id] },
                data: { content: body }
              });
              updated.contactNoteIds[contact.id] = oldContactNoteIds[contact.id];
            } catch {
              const note = await (prisma.note as any).create({
                data: {
                  content: body, categories: JSON.stringify(['Activity Log']),
                  createdById: req.userId, createdBy: user?.name || 'System',
                  contactId: contact.id,
                }
              });
              updated.contactNoteIds[contact.id] = note.id;
            }
          } else {
            const note = await (prisma.note as any).create({
              data: {
                content: body, categories: JSON.stringify(['Activity Log']),
                createdById: req.userId, createdBy: user?.name || 'System',
                contactId: contact.id,
              }
            });
            updated.contactNoteIds[contact.id] = note.id;
          }
        }

        // Delete notes for contacts that were removed from text
        for (const [oldContactId, oldNoteId] of Object.entries(oldContactNoteIds)) {
          if (!currentContactIds.has(oldContactId)) {
            try { await prisma.note.delete({ where: { id: oldNoteId } }); } catch {}
          }
        }

        // Store the keyed note IDs on the todo
        await (prisma as any).dailyTodo.update({
          where: { id: todo.id },
          data: { activityNoteIds: updated }
        });
      } else if (completed === false) {
        // Task was un-completed — remove ALL activity notes
        if (existingNoteIds.ideaNoteId) {
          try { await prisma.note.delete({ where: { id: existingNoteIds.ideaNoteId } }); } catch {}
        }
        for (const noteId of Object.values(existingNoteIds.contactNoteIds || {})) {
          try { await prisma.note.delete({ where: { id: noteId } }); } catch {}
        }
        await (prisma as any).dailyTodo.update({
          where: { id: todo.id },
          data: { activityNoteIds: {} }
        });
      }
    } catch (actErr: any) {
      console.error('Activity log sync error (non-blocking):', actErr.message);
    }
    } // end completionChanged

    res.json(todo);
  } catch (err: any) {
    console.error('Daily todo update error:', err);
    res.status(500).json({ error: 'Failed to update daily todo', details: err.message });
  }
});

app.delete('/api/daily-todos/:id', authenticate, async (req: any, res) => {
  try {
    const existing = await (prisma as any).dailyTodo.findUnique({ 
      where: { id: req.params.id },
      include: { idea: { select: { ownerId: true, collaborators: { select: { id: true } } } } }
    });
    if (!existing) return res.status(404).json({ error: 'Todo not found' });
    
    const hasProjectAccess = existing.idea && (existing.idea.ownerId === req.userId || existing.idea.collaborators.some((c: any) => c.id === req.userId));
    if (existing.userId !== req.userId && existing.assigneeId !== req.userId && !hasProjectAccess) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await (prisma as any).dailyTodo.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Daily todo delete error:', err);
    res.status(500).json({ error: 'Failed to delete daily todo', details: err.message });
  }
});

app.post('/api/daily-todos/:id/duplicate', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;
    const todo = await (prisma as any).dailyTodo.findUnique({
      where: { id, userId: req.userId },
      include: { children: true }
    });
    
    if (!todo) return res.status(404).json({ error: 'Todo not found' });
    
    let targetDate = new Date();
    if (todo.date) {
      targetDate = new Date(todo.date);
    }
    targetDate.setDate(targetDate.getDate() + 1);
    targetDate.setHours(12, 0, 0, 0);

    // Helper to get next order
    const getNextOrder = async (parentId: string | null) => {
      const minOrder = await (prisma as any).dailyTodo.aggregate({
        where: { userId: req.userId, date: targetDate, parentId: parentId || null },
        _min: { sortOrder: true }
      });
      return (minOrder._min.sortOrder ?? 0) - 1;
    };

    let newParentId: string | null = null;
    let newlyCreated = [];

    if (todo.parentId) {
      // It's a subtask. Bring the parent along.
      const parent = await (prisma as any).dailyTodo.findUnique({
        where: { id: todo.parentId }
      });
      
      if (parent) {
        // Check if parent already duplicated for tomorrow
        let existingParent = await (prisma as any).dailyTodo.findFirst({
          where: { userId: req.userId, date: targetDate, text: parent.text, parentId: null }
        });
        
        if (!existingParent) {
          existingParent = await (prisma as any).dailyTodo.create({
            data: {
              text: parent.text,
              date: targetDate,
              isUrgent: parent.isUrgent,
              sortOrder: await getNextOrder(null),
              ideaId: parent.ideaId,
              timeBlock: parent.timeBlock,
              userId: req.userId,
              assigneeId: parent.assigneeId
            }
          });
          newlyCreated.push(existingParent);
        }
        newParentId = existingParent.id;
      }
      
      // Now duplicate the subtask under the parent
      const newSubtask = await (prisma as any).dailyTodo.create({
        data: {
          text: todo.text,
          date: targetDate,
          isUrgent: todo.isUrgent,
          sortOrder: await getNextOrder(newParentId),
          ideaId: todo.ideaId,
          parentId: newParentId,
          timeBlock: todo.timeBlock,
          userId: req.userId,
          assigneeId: todo.assigneeId
        },
        include: { idea: { select: { id: true, title: true } } }
      });
      newlyCreated.push(newSubtask);
      
    } else {
      // It's a parent task. Duplicate it and its children.
      const newParent = await (prisma as any).dailyTodo.create({
        data: {
          text: todo.text,
          date: targetDate,
          isUrgent: todo.isUrgent,
          sortOrder: await getNextOrder(null),
          ideaId: todo.ideaId,
          timeBlock: todo.timeBlock,
          userId: req.userId,
          assigneeId: todo.assigneeId
        },
        include: { idea: { select: { id: true, title: true } } }
      });
      newlyCreated.push(newParent);
      
      if (todo.children && todo.children.length > 0) {
        for (const child of todo.children) {
          const newChild = await (prisma as any).dailyTodo.create({
            data: {
              text: child.text,
              date: targetDate,
              isUrgent: child.isUrgent,
              sortOrder: await getNextOrder(newParent.id),
              ideaId: child.ideaId,
              parentId: newParent.id,
              timeBlock: child.timeBlock,
              userId: req.userId,
              assigneeId: child.assigneeId
            }
          });
          newlyCreated.push(newChild);
        }
      }
    }
    
    res.json(newlyCreated);
  } catch (err: any) {
    console.error('Duplicate error:', err);
    res.status(500).json({ error: 'Failed to duplicate task', details: err.message });
  }
});

app.post('/api/daily-todos/carry-forward', authenticate, async (req: any, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all incomplete todos from before today
    const incompletePast = await (prisma as any).dailyTodo.findMany({
      where: {
        userId: req.userId,
        completed: false,
        date: { lt: today }
      }
    });

    // Create copies for today
    const created = [];
    for (const todo of incompletePast) {
      const newTodo = await (prisma as any).dailyTodo.create({
        data: {
          text: todo.text,
          isUrgent: todo.isUrgent,
          ideaId: todo.ideaId || null,
          date: today,
          userId: req.userId
        },
        include: { idea: { select: { id: true, title: true } } }
      });
      // Mark the old one as completed (carried forward)
      await (prisma as any).dailyTodo.update({
        where: { id: todo.id },
        data: { completed: true, completedAt: new Date() }
      });
      created.push(newTodo);
    }

    res.json({ carried: created.length, todos: created });
  } catch (err: any) {
    console.error('Carry forward error:', err);
    res.status(500).json({ error: 'Failed to carry forward todos', details: err.message });
  }
});

const PORT = process.env.PORT || 3001;
// ===== REMINDER IMAGES =====
app.get('/api/reminder-images', authenticate, async (req: any, res) => {
  try {
    const images = await (prisma as any).reminderImage.findMany({
      where: { userId: req.userId },
      orderBy: { sortOrder: 'asc' }
    });
    res.json(images);
  } catch (err: any) {
    console.error('Get reminder images error:', err);
    res.status(500).json({ error: 'Failed to fetch reminder images' });
  }
});

app.post('/api/reminder-images', authenticate, async (req: any, res) => {
  try {
    const { imageData, caption, fileType, fileName, fileSize } = req.body;
    if (!imageData) return res.status(400).json({ error: 'imageData is required' });
    const maxOrder = await (prisma as any).reminderImage.aggregate({
      where: { userId: req.userId },
      _max: { sortOrder: true }
    });
    const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;
    const image = await (prisma as any).reminderImage.create({
      data: { imageData, caption: caption || null, fileType, fileName, fileSize, sortOrder: nextOrder, userId: req.userId }
    });
    res.json(image);
  } catch (err: any) {
    console.error('Create reminder image error:', err);
    res.status(500).json({ error: 'Failed to create reminder image', details: err.message });
  }
});

app.post('/api/reminder-images/chunk', authenticate, async (req: any, res) => {
  try {
    const { uploadId, chunkIndex, content } = req.body;
    await prisma.fileAttachmentChunk.create({
      data: { uploadId, chunkIndex, content }
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save chunk', details: err.message });
  }
});

app.post('/api/reminder-images/finalize', authenticate, async (req: any, res) => {
  try {
    const { uploadId, caption, fileType, fileName, fileSize } = req.body;
    const chunks = await prisma.fileAttachmentChunk.findMany({
      where: { uploadId },
      orderBy: { chunkIndex: 'asc' }
    });
    const fullContent = chunks.map(c => c.content).join('');
    
    const maxOrder = await (prisma as any).reminderImage.aggregate({
      where: { userId: req.userId },
      _max: { sortOrder: true }
    });
    const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    const image = await (prisma as any).reminderImage.create({
      data: { imageData: fullContent, caption: caption || null, fileType, fileName, fileSize, sortOrder: nextOrder, userId: req.userId }
    });
    await prisma.fileAttachmentChunk.deleteMany({ where: { uploadId } });
    res.json(image);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to finalize upload', details: err.message });
  }
});

app.get('/api/reminder-images/:id/raw/:filename', authenticate, async (req: any, res) => {
  try {
    const reminder = await prisma.reminderImage.findUnique({
      where: { id: req.params.id }
    });
    if (!reminder || reminder.userId !== req.userId) return res.status(404).send('Not found');

    const base64Data = reminder.imageData.split(';base64,').pop();
    if (!base64Data) return res.status(400).send('Invalid file format');
    
    const buffer = Buffer.from(base64Data, 'base64');
    
    res.setHeader('Content-Type', reminder.fileType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${reminder.fileName || 'file'}"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).send('Error loading file');
  }
});

app.put('/api/reminder-images/:id', authenticate, async (req: any, res) => {
  try {
    const existing = await (prisma as any).reminderImage.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.userId) return res.status(404).json({ error: 'Not found' });
    const { caption, sortOrder, rotation } = req.body;
    const updated = await (prisma as any).reminderImage.update({
      where: { id: req.params.id },
      data: { ...(caption !== undefined ? { caption } : {}), ...(sortOrder !== undefined ? { sortOrder } : {}), ...(rotation !== undefined ? { rotation } : {}) }
    });
    res.json(updated);
  } catch (err: any) {
    console.error('Update reminder image error:', err);
    res.status(500).json({ error: 'Failed to update', details: err.message });
  }
});

app.put('/api/reminder-images/reorder', authenticate, async (req: any, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds required' });
    await (prisma as any).$transaction(
      orderedIds.map((id: string, index: number) =>
        (prisma as any).reminderImage.updateMany({
          where: { id, userId: req.userId },
          data: { sortOrder: index }
        })
      )
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error('Reorder reminder images error:', err);
    res.status(500).json({ error: 'Failed to reorder' });
  }
});

app.delete('/api/reminder-images/:id', authenticate, async (req: any, res) => {
  try {
    const existing = await (prisma as any).reminderImage.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.userId) return res.status(404).json({ error: 'Not found' });
    await (prisma as any).reminderImage.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete reminder image error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Backend running on port ${PORT} `));
}

export default app;
