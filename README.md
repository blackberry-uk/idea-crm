<div align="center">
<img width="1200" height="475" alt="IdeaCRM Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# 💡 Idea-CRM
### Turn fleeting thoughts into focused execution. 🚀
</div>

---

**Idea-CRM** is a high-performance workspace designed for founders and teams to capture, refine, and execute on business opportunities. Far beyond a simple note-taking app, it integrates networking with project management, featuring a smart dashboard, collaborative timelines, and privacy-first access control.

## ✨ Premium Features

### 📊 Intelligent Dashboard
- **Most Active Ideas**: Automatically ranks your projects by engagement (Notes + Pending Tasks).
- **Recent Activity Feed**: Real-time timeline of updates across your entire workspace, filtered by your permissions.

### 📝 Smart Timeline & Documentation
- **@Mentions**: Tag collaborators or contacts directly in notes to link data.
- **Auto-Location Tagging**: Every entry captures where inspiration struck using GPS and IP-based geocoding.
- **Rich Media**: Automated link unfurling and Markdown-ready content blocks.

### ⚡ Collaborative Execution
- **Task Assignments**: Assign checklist items to team members with one click.
- **Automated Notifications**: Integrated email service (Resend) notifies partners of mentions and new task assignments.
- **Invitation System**: Securely share specific ideas or invite partners to jump into the entire system.

### 🔒 Enterprise-Grade Security
- **JWT Authentication**: Secure, session-based access.
- **Prisma + Supabase**: Robust data handling with Relational Mapping and Connection Pooling.
- **Privacy-First**: Rigorous server-side filtering ensures you only see what you own or collaborate on.

---

## 🛠 Tech Stack

- **Frontend**: [React 18](https://reactjs.org/) + [Vite](https://vitejs.dev/) + [Lucide Icons](https://lucide.dev/)
- **Backend**: [Express](https://expressjs.com/) + [TypeScript](https://www.typescriptlang.org/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Database**: [Supabase PostgreSQL](https://supabase.com/)
- **Deployment**: [Vercel](https://vercel.com/) (Serverless Architecture)
- **Emails**: [Resend](https://resend.com/)

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18 or higher)
- A **PostgreSQL** database (Supabase recommended)

### 2. Installation
```bash
git clone <repository-url>
cd idea-crm
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory:
```env
# Database
DATABASE_URL="your-supabase-connection-string"
DIRECT_URL="your-supabase-direct-url"

# Auth
JWT_SECRET="your-secure-secret"

# Email
RESEND_API_KEY="your-resend-key"

# AI & Browser
GEMINI_API_KEY="your-gemini-key"
```

### 4. Database Initialization
```bash
npx prisma generate
npx prisma db push
```

### 5. Running Locally
Run both the frontend and backend simultaneously:
```bash
# Terminal 1: Frontend (Vite)
npm run dev

# Terminal 2: Backend (Server)
npm run server
```
The app will be available at `http://localhost:3000`.

---

## 📦 Deployment

Idea-CRM is optimized for **Vercel**. The included `vercel.json` provides a single-entry-point architecture for seamless serverless execution:

1. Connect your repo to Vercel.
2. Add your environment variables in the Vercel Dashboard.
3. Deploy!

---

<div align="center">
Built with ❤️ for innovators and visionaries.
</div>
