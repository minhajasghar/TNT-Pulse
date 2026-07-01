# TNT Pulse

> Internal project & subscription management system with escalating deadline alerts — built for TNT Innovations.

![License](https://img.shields.io/badge/license-Private-red)
![Node](https://img.shields.io/badge/Node.js-18+-green)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![MySQL](https://img.shields.io/badge/MySQL-8.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)

---

## 📌 Overview

**TNT Pulse** is the internal operations tool of **TNT Innovations** — a centralized platform for managing projects, tasks, team members, subscriptions, and deadlines. It replaces scattered spreadsheets and manual tracking with a structured, role-based system that automatically escalates alerts as deadlines approach.

Built entirely in-house by the TNT Innovations development team.

---

## ✨ Features

### 🗂️ Project Management
- Create and manage projects with deadlines, priorities, and status tracking
- Assign team members with project-specific roles (Lead Developer, UI/UX Designer, etc.)
- Track progress via task completion percentage with visual progress bars
- Milestones, requirements, and document attachments per project
- Recycle bin for safe deletion with full restore support
- Double confirmation (type project name) before deletion

### ✅ Task Management
- Create tasks within projects and assign to specific team members
- Kanban-style status flow: `Todo → In Progress → Blocked → Done`
- Overdue detection with automatic alerts
- Per-task comment threads and time tracking (start/stop timer)
- "My Tasks" personal view across all projects

### 👥 Team Management
- Role-based access control: `Super Admin → Manager → Developer → Designer → Viewer`
- Granular module-level permissions per user (view, create, edit, delete)
- Suspend / Reactivate accounts without deletion
- Super Admin transfer system with "TRANSFER" confirmation safeguard
- View member profile with workload stats and current projects

### 🔔 Escalating Alert System
- Multi-stage alert escalation rules fully configurable by admin
- Two trigger types:
  - **Percentage**: fire when X% of total duration has elapsed (e.g. 50%)
  - **Fixed Days**: fire when X days remain (e.g. 7 days, 3 days, 1 day)
- Two frequency modes:
  - **Once**: early warnings (e.g. halfway point)
  - **Daily**: urgent reminders (e.g. final week)
- Applies globally to both projects and subscriptions
- Duplicate prevention — same rule never fires twice in one day
- Email + in-app notifications

### 🔁 Subscription Tracking
- Track domains, hosting, APIs, SSL certificates, software licenses, databases
- Add subscriptions directly from project creation or project detail page
- Link subscriptions to one or more projects
- **By Project view** — see all subscriptions grouped under their project
- Cost tracking with billing cycle (monthly / quarterly / yearly / one-time)
- Currency support (USD, PKR, EUR, GBP)
- Auto-renew indicator with appropriate alert tone
- Expiry alerts sent to admins and linked project members
- Unlinked subscriptions highlighted separately

### 📊 Dashboard & Reports
- Real-time KPIs: active projects, overdue tasks, team workload
- Charts: projects by status (pie), projects by priority (bar)
- Upcoming deadlines widget with color-coded urgency
- Subscription expiry widget — expiring this week / this month
- Reports section (admin/manager only):
  - Project report with completion stats
  - Team performance report with on-time rate
  - Task analytics with priority/status breakdown
  - Export all reports to CSV

### 📢 Announcements
- Company-wide announcements with priority levels: Normal / Important / Urgent
- Email notification sent to all active team members on creation
- Urgent announcements have pulsing red indicator
- Pin important announcements to top
- Only managers and admins can post

### 📁 Documents
- Upload project-related files (PDF, Word, Excel, images, ZIP)
- Max 10MB per file with type validation
- Filter by project or file type
- Download directly from the platform
- Drag and drop upload with progress indicator

### ⏱️ Time Tracking
- Start/stop timer directly on tasks
- Live running timer with seconds counter
- Daily time log per team member
- Total time spent per task
- Prevents duplicate active timers

### ⚙️ Settings
- Alert escalation rules management (Super Admin only)
- Add, edit, enable/disable, delete escalation rules
- Notification preferences per user (email, in-app, alert threshold)
- Super Admin transfer system
- Profile update (name, email, password)
- Activity log export

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript |
| Styling | Tailwind CSS |
| State Management | Zustand (with localStorage persistence) |
| Data Fetching | TanStack React Query v5 |
| Charts | Recharts |
| Form Handling | React Hook Form + Zod |
| Backend | Node.js 18+, Express.js |
| Database | MySQL 8.0 |
| Authentication | JWT + bcrypt |
| Email | Nodemailer + Gmail SMTP |
| Scheduling | node-cron |
| File Upload | Multer |

---

## 📁 Project Structure

```
tnt-pulse/
├── backend/
│   ├── config/
│   │   ├── db.js                  # MySQL connection pool
│   │   └── multer.js              # File upload config
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── projectController.js
│   │   ├── taskController.js
│   │   ├── dashboardController.js
│   │   ├── alertController.js
│   │   ├── announcementController.js
│   │   ├── documentController.js
│   │   ├── reportController.js
│   │   ├── subscriptionController.js
│   │   ├── escalationRuleController.js
│   │   ├── milestoneController.js
│   │   ├── requirementController.js
│   │   ├── activityController.js
│   │   └── timeController.js
│   ├── middleware/
│   │   └── authMiddleware.js      # JWT + role + permission checks
│   ├── routes/                    # Express route definitions
│   ├── utils/
│   │   ├── cronJobs.js            # Scheduled jobs (tasks, unified escalation)
│   │   ├── escalationEngine.js    # Core escalation evaluation logic
│   │   └── emailService.js        # All email templates (HTML, inline CSS)
│   ├── uploads/                   # Uploaded files (gitignored)
│   └── server.js
├── frontend/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/             # Login page
│   │   └── (authenticated)/
│   │       ├── dashboard/
│   │       ├── projects/
│   │       │   └── [id]/          # Project detail
│   │       ├── tasks/
│   │       ├── team/
│   │       ├── documents/
│   │       ├── announcements/
│   │       ├── subscriptions/
│   │       ├── reports/
│   │       ├── activity/
│   │       └── settings/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── Navbar.tsx
│   │   ├── projects/
│   │   │   └── CreateProjectModal.tsx
│   │   ├── subscriptions/
│   │   │   └── SubscriptionModal.tsx
│   │   ├── settings/
│   │   │   └── EscalationRuleModal.tsx
│   │   ├── tasks/
│   │   │   └── TaskDetailModal.tsx
│   │   └── ui/
│   │       ├── RoleSelector.tsx
│   │       ├── StatsCard.tsx
│   │       ├── Badge.tsx
│   │       ├── Toast.tsx
│   │       └── LoadingSkeleton.tsx
│   └── lib/
│       ├── store.ts               # Zustand store with permissions
│       ├── api.ts                 # Axios instance with interceptors
│       └── utils.ts               # Formatting, color helpers
└── database/
    ├── schema.sql                 # Full initial schema
    └── migrations/
        ├── 001_add_phone.sql
        ├── 002_add_announcements.sql
        ├── 003_add_documents.sql
        ├── 004_add_time_tracking.sql
        ├── 005_project_recycle.sql
        ├── 006_project_member_roles.sql
        ├── 007_subscriptions.sql
        └── 008_alert_escalation_rules.sql
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- MySQL 8.0
- Gmail account with 2-Step Verification and App Password enabled

---

### 1. Clone the repository

```bash
git clone https://github.com/minhajasghar/tnt-pulse.git
cd tnt-pulse
```

---

### 2. Database Setup

Create the database:

```sql
CREATE DATABASE tnt_pulse;
```

Run the base schema:

```bash
mysql -u root -p tnt_pulse < database/schema.sql
```

Run all migrations in order:

```bash
mysql -u root -p tnt_pulse < database/migrations/001_add_phone.sql
mysql -u root -p tnt_pulse < database/migrations/002_add_announcements.sql
mysql -u root -p tnt_pulse < database/migrations/003_add_documents.sql
mysql -u root -p tnt_pulse < database/migrations/004_add_time_tracking.sql
mysql -u root -p tnt_pulse < database/migrations/005_project_recycle.sql
mysql -u root -p tnt_pulse < database/migrations/006_project_member_roles.sql
mysql -u root -p tnt_pulse < database/migrations/007_subscriptions.sql
mysql -u root -p tnt_pulse < database/migrations/008_alert_escalation_rules.sql
```

> Migration 008 also inserts 5 default escalation rules automatically.

---

### 3. Backend Setup

```bash
cd backend
npm install
```

Create `.env` (use `.env.example` as reference):

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASS=your_mysql_password
DB_NAME=tnt_pulse
DB_PORT=3306

JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d

FRONTEND_URL=http://localhost:3000

EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_16_digit_gmail_app_password
EMAIL_FROM=TNT Innovations <your_email@gmail.com>
```

Start backend:

```bash
npm run dev
# Running on http://localhost:5000
# Health check: http://localhost:5000/api/health
```

---

### 4. Frontend Setup

```bash
cd frontend
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

Start frontend:

```bash
npm run dev
# Running on http://localhost:3000
```

---

### 5. Create First Super Admin

Insert directly into the database:

```sql
INSERT INTO users (name, email, password_hash, role, status)
VALUES (
  'Super Admin',
  'admin@tntinnovations.com',
  '$2b$12$HASH_HERE',
  'super_admin',
  'active'
);
```

To generate the bcrypt hash, run this in Node.js:

```js
import bcrypt from 'bcrypt'
const hash = await bcrypt.hash('yourpassword', 12)
console.log(hash)
```

Also insert notification preferences:

```sql
INSERT INTO notification_preferences 
(user_id, email_enabled, in_app_enabled, alert_days_before_deadline)
VALUES (1, 1, 1, 3);
```

---

## 🔐 Role Permissions

| Feature | Super Admin | Manager | Developer | Designer | Viewer |
|---|:---:|:---:|:---:|:---:|:---:|
| Manage users | ✅ | ❌ | ❌ | ❌ | ❌ |
| Set permissions | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create projects | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage tasks | ✅ | ✅ | Own | Own | ❌ |
| Post announcements | ✅ | ✅ | ❌ | ❌ | ❌ |
| View reports | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage subscriptions | ✅ | ✅ | ❌ | ❌ | ❌ |
| Escalation rules | ✅ | ❌ | ❌ | ❌ | ❌ |
| Transfer admin | ✅ | ❌ | ❌ | ❌ | ❌ |

> Module-level permissions are fully customizable per user by Super Admin from the Team section.

---

## 🔔 Alert Escalation System

TNT Pulse uses a configurable multi-stage escalation engine that runs daily at 8:00 AM:

| Rule | Trigger | Frequency | Applies To |
|---|---|---|---|
| Halfway Point | 50% of time elapsed | Once | Both |
| One Week Remaining | 7 days left | Daily | Both |
| Three Days Remaining | 3 days left | Daily | Both |
| One Day Remaining | 1 day left | Daily | Both |
| Overdue / Expired | Past deadline | Daily | Both |

- All 5 rules inserted automatically on first migration run
- Super Admin can add, edit, disable, or delete rules from Settings
- Duplicate prevention: same rule never fires twice on the same day for the same entity
- Email + in-app notifications for all rules

---

## 🔁 Subscription Views

**All Subscriptions** — flat list with filters by category and status

**By Project** — grouped view showing each project's linked subscriptions:
```
📁 Nexus Website (3 subscriptions)
  ├── 🌐 Domain — GoDaddy — 7 days left 🟡
  ├── 🖥️ Hosting — AWS — 45 days left 🟢
  └── 🔒 SSL — Namecheap — 12 days left 🟡

📁 E-commerce App (2 subscriptions)
  ├── 🔌 Stripe API — 30 days left 🟡
  └── 🗄️ PlanetScale DB — 60 days left 🟢

⚠️ Unlinked Subscriptions (1)
  └── Adobe License — not linked to any project
```

---

## 📸 Screenshots

> *(Add screenshots after deployment)*

| Login | Dashboard | Projects |
|---|---|---|
| ![Login](#) | ![Dashboard](#) | ![Projects](#) |

| Subscriptions | Team | Settings |
|---|---|---|
| ![Subscriptions](#) | ![Team](#) | ![Settings](#) |

---

## 🗺️ Roadmap

- [x] Project & Task Management
- [x] Role-based Access Control with Granular Permissions
- [x] Escalating Alert System (configurable rules)
- [x] Subscription Tracking with Project Linking
- [x] Time Tracking
- [x] Document Management
- [x] Reports & Analytics (CSV export)
- [x] Announcements with Email Broadcast
- [x] Recycle Bin for Projects
- [ ] Bug Tracker / Issue Tracker
- [ ] Leave Management
- [ ] Sprint / Iteration Planning
- [ ] Mobile App (React Native)
- [ ] AI Assistant (natural language queries)

---

## 👨‍💻 Built By

**Minhaj Asghar**  
AI/ML Engineer & Full Stack Developer  
[GitHub](https://github.com/minhajasghar) · [Portfolio](https://minhaj-asghar-portfolio.vercel.app) · [LinkedIn](https://linkedin.com/in/minhajasghar)

---

## 🏢 Organization

**TNT Innovations** — Software & AI Solutions  
Lahore, Pakistan

---

## 📄 License

This project is private and proprietary.  
© 2025 TNT Innovations. All rights reserved.
