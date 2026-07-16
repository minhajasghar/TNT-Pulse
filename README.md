# TNT Pulse

TNT Pulse is a modern project and task management platform developed for TNT Innovations. It provides project tracking, task management, team collaboration, document management, announcements, reporting, and role-based access control through a secure web application.

## Live Demo

Application:
https://pulse.tntinnov.com

API Health Check:
https://pulse.tntinnov.com/api/health

---

## Features

- JWT Authentication
- Project Management
- Task Management
- Team Management
- Activity Tracking
- Announcements
- Document Management
- Reports
- Alert Management
- Subscription Management
- Role-Based Access Control
- REST API

---

## Tech Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Zustand
- React Query
- React Hook Form

### Backend

- Node.js
- Express.js
- MySQL
- JWT Authentication

### Production

- Ubuntu VPS
- Apache2 Reverse Proxy
- PM2
- Let's Encrypt SSL

---

## Project Structure

```
TNT-Pulse/
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── public/
│
├── backend/
│   ├── config/
│   ├── middleware/
│   ├── routes/
│   ├── utils/
│   └── server.js
│
├── database/
│   ├── migrations/
│   ├── schema.sql
│   └── seed.sql
│
└── README.md
```

---

## Environment Variables

### Frontend

```env
NEXT_PUBLIC_API_URL=https://pulse.tntinnov.com
```

### Backend

```env
PORT=5000

DB_HOST=localhost
DB_PORT=3306
DB_USER=your_database_user
DB_PASS=your_database_password
DB_NAME=your_database_name

JWT_SECRET=your_jwt_secret

FRONTEND_URL=https://pulse.tntinnov.com

EMAIL_USER=your_email
EMAIL_PASS=your_email_password
EMAIL_FROM=Your Name <noreply@example.com>
```

---

## Installation

Clone the repository.

```bash
git clone <repository-url>
cd TNT-Pulse
```

Install frontend dependencies.

```bash
cd frontend
npm install
```

Install backend dependencies.

```bash
cd ../backend
npm install
```

---

## Running Locally

Start the backend.

```bash
npm start
```

Start the frontend.

```bash
cd ../frontend
npm run dev
```

---

## Production Deployment

Build the frontend.

```bash
npm run build
```

Start services with PM2.

```bash
pm2 start "npm start" --name tnt-frontend
pm2 start server.js --name tnt-backend
```

Save PM2 configuration.

```bash
pm2 save
pm2 startup
```

---

## Architecture

```
Client
   │
   ▼
Apache2
   │
   ▼
Next.js (Port 3000)
   │
   ▼
Express API (Port 5000)
   │
   ▼
MySQL
```

---

## Security

- HTTPS with Let's Encrypt
- Apache Reverse Proxy
- JWT Authentication
- Environment Variables
- CORS Protection

---

## Deployment

| Component | Technology |
|----------|------------|
| Hosting | Contabo VPS |
| Operating System | Ubuntu |
| Web Server | Apache2 |
| Process Manager | PM2 |
| SSL | Let's Encrypt |
| Database | MySQL |

---

## Useful Commands

```bash
pm2 status

pm2 logs

pm2 restart tnt-backend

pm2 restart tnt-frontend

pm2 monit
```

---

## Author

**Minhaj Asghar**

GitHub: https://github.com/minhajasghar

---

## License

This project is proprietary software developed for TNT Innovations.

All rights reserved.
