# TNT Pulse

TNT Pulse is a modern project and task management platform developed for **TNT Innovations**. It provides project tracking, task management, team collaboration, document management, announcements, reporting, and role-based access control through a secure web application.

> 🔒 **This is a showcase repository.** TNT Pulse is an internal, proprietary system built for TNT Innovations. Source code and live deployment are kept private for company confidentiality. This README documents the system architecture, feature set, and tech stack. A full walkthrough/demo video is available on request.

---

## Overview

Built and deployed end-to-end as TNT Innovations' internal project management tool — from database design to production deployment on a self-managed VPS.

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
- Self-managed VPS
- Apache2 Reverse Proxy
- PM2
- Let's Encrypt SSL

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
- Environment-based configuration (no secrets committed)
- CORS Protection

---

## Deployment

| Component | Technology |
|----------|------------|
| Hosting | Self-managed VPS |
| Operating System | Ubuntu |
| Web Server | Apache2 |
| Process Manager | PM2 |
| SSL | Let's Encrypt |
| Database | MySQL |

---

## Screenshots / Demo

*(Add screenshots or a screen-recorded walkthrough GIF/video here — dashboard, task management, alert system, etc.)*

---

## Author

**[Minhaj Asghar](https://minhajasghar.vercel.app)**
GitHub: https://github.com/minhajasghar

---

## License

This project is proprietary software developed for TNT Innovations. All rights reserved. Source code is not publicly available.
