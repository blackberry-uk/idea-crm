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
const authenticate = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : (req.query.token as string | null);

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

// --- DATA ROUTES ---
app.get('/api/data', authenticate, async (req: any, res) => {
  const userId = req.userId;
  try {
    console.log('[API /data] Fetching data for user:', userId);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const userEmail = user?.email || '';
    console.log('[API /data] User found:', userEmail);

    console.log('[API /data] Fetching ideas...');
    const rawIdeas = await prisma.idea.findMany({
      where: { OR: [{ ownerId: userId }, { collaborators: { some: { id: userId } } }] },
      include: { owner: true, collaborators: true, children: { include: { owner: true, collaborators: true } } }
    });
    console.log('[API /data] Ideas fetched:', rawIdeas.length);

    const userIdeaIds = rawIdeas.map((i: any) => i.id);
    console.log('[API /data] Fetching contacts...');
    const contacts = await prisma.contact.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { associatedNotes: { some: { ideaId: { in: userIdeaIds } } } },
          { taggedInNotes: { some: { ideaId: { in: userIdeaIds } } } }
        ]
      } as any
    });
    console.log('[API /data] Contacts fetched:', contacts.length);

    const linkedEntityIds = new Set<string>();
    contacts.forEach((c: any) => {
      try {
        const ids = typeof c.linkedEntityIds === 'string' ? JSON.parse(c.linkedEntityIds || '[]') : c.linkedEntityIds;
        if (Array.isArray(ids)) ids.forEach(id => linkedEntityIds.add(id));
      } catch {}
    });

    console.log('[API /data] Fetching entities...');
    const entities = await prisma.entity.findMany({
      where: { 
        OR: [
          { ownerId: userId },
          { id: { in: Array.from(linkedEntityIds) } }
        ]
      } as any
    });
    console.log('[API /data] Entities fetched:', entities.length);

    const contactIds = contacts.map((c: any) => c.id);
    console.log('[API /data] Fetching notes...');
    const rawNotes = await prisma.note.findMany({
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
    });
    console.log('[API /data] Notes fetched:', rawNotes.length);

    console.log('[API /data] Fetching interactions...');
    const interactions = await prisma.interaction.findMany({ where: { createdById: userId } });
    console.log('[API /data] Interactions fetched:', interactions.length);

    console.log('[API /data] Fetching invitations...');
    const invitations = await prisma.invitation.findMany({
      where: {
        OR: [
          { email: userEmail },
          { senderId: userId }
        ]
      },
      include: {
        sender: true,
        idea: true
      }
    });
    console.log('[API /data] Invitations fetched:', invitations.length);

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
    const userSelect = { id: true, name: true, email: true };
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
    const { text, date, isUrgent, ideaId, parentId, timeBlock } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });
    // date can be null for floating/backburner tasks
    const dateVal = date ? new Date(date + 'T12:00:00Z') : null;
    const minOrder = await (prisma as any).dailyTodo.aggregate({
      where: { userId: req.userId, date: dateVal, parentId: parentId || null },
      _min: { sortOrder: true }
    });
    const nextOrder = (minOrder._min.sortOrder ?? 0) - 1;
    const userSelect = { id: true, name: true, email: true };
    const todo = await (prisma as any).dailyTodo.create({
      data: {
        text,
        date: dateVal,
        isUrgent: isUrgent || false,
        sortOrder: nextOrder,
        ideaId: ideaId || null,
        parentId: parentId || null,
        timeBlock: timeBlock || null,
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

    const userSelect = { id: true, name: true, email: true };
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
