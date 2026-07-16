# TNT Pulse

A modern Project & Task Management System developed for TNT Innovations.

---

## 🚀 Live Demo

**Application:**  
https://pulse.tntinnov.com

**Health Check API:**  
https://pulse.tntinnov.com/api/health

---

## ✨ Features

- Secure Authentication (JWT)
- Dashboard
- Project Management
- Task Management
- Team Management
- Activity Tracking
- Announcements
- Documents
- Reports
- Notifications & Alerts
- Subscription Management
- Role Based Access Control
- REST API

---

## 🛠 Tech Stack

### Frontend
- Next.js 16
- React 19
- TypeScript
- Zustand
- React Query
- React Hook Form
- Tailwind CSS

### Backend
- Node.js
- Express.js
- JWT Authentication
- MySQL

### Production Server
- Ubuntu VPS
- Apache2 Reverse Proxy
- PM2 Process Manager
- Let's Encrypt SSL
- Contabo VPS

---

## 📁 Project Structure

```
TNT-Pulse
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── public/
│   └── ...
│
├── backend/
│   ├── routes/
│   ├── middleware/
│   ├── config/
│   ├── utils/
│   └── ...
│
└── README.md
```

---

## ⚙️ Environment Variables

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=https://pulse.tntinnov.com
```

### Backend (.env)

```env
PORT=5000

DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASS=your_db_password
DB_NAME=your_database

JWT_SECRET=your_secret_key

FRONTEND_URL=https://pulse.tntinnov.com

EMAIL_USER=your_email
EMAIL_PASS=your_email_password
EMAIL_FROM=Your Name <noreply@example.com>
```

---

## 💻 Local Development

### Clone Repository

```bash
git clone <repository-url>
cd TNT-Pulse
```

### Install Dependencies

Frontend

```bash
cd frontend
npm install
```

Backend

```bash
cd backend
npm install
```

---

## ▶️ Run Locally

Backend

```bash
npm start
```

Frontend

```bash
npm run dev
```

---

## 🚀 Production Deployment

### Build Frontend

```bash
cd frontend

npm install
npm run build
```

### Start Frontend

```bash
pm2 start "npm start" --name tnt-frontend
```

### Start Backend

```bash
cd backend

pm2 start server.js --name tnt-backend
```

### Save PM2 Processes

```bash
pm2 save
```

### Enable Auto Start

```bash
pm2 startup
```

---

## 🌐 Server Architecture

```
Internet
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
MySQL Database
```

---

## 🔒 Security

- HTTPS (Let's Encrypt SSL)
- Apache Reverse Proxy
- JWT Authentication
- Environment Variables
- CORS Protection

---

## 📦 Deployment Information

- Hosting: Contabo VPS
- Operating System: Ubuntu
- Web Server: Apache2
- Process Manager: PM2
- SSL: Let's Encrypt
- Database: MySQL

---

## 📊 Monitoring

Useful PM2 Commands

```bash
pm2 status

pm2 logs

pm2 restart tnt-backend

pm2 restart tnt-frontend

pm2 monit
```

---

## 🤝 Developed For

**TNT Innovations**

---

## 👨‍💻 Developer

**Minhaj Asghar**

GitHub: https://github.com/minhajasghar

---

## 📄 License

This project is proprietary software developed for TNT Innovations.
All rights reserved.
