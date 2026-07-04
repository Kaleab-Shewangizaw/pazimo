# WEB AND MOBILE APPLICATION TECHNICAL DOCUMENTATION & HANDOVER

## Project Information

| Field | Value |
|---|---|
| Project Name | Pazimo |
| Client | Pazimo |
| Developer | Prime Software Solutions PLC |
| Project Version | v1.0.0 |
| Date of Handover | 15 July 2026 |

---

## 1. Introduction

### 1.1 Purpose

This document provides the technical details and operational information required for the Client to maintain, deploy, manage, and further develop the Pazimo Web Application, Organizer/Admin Portal, and Mobile Application after project completion.

### 1.2 Scope

This document covers:

- Mobile application (Flutter — Android & iOS)
- Web application (Next.js — public site, organizer dashboard, admin dashboard)
- Backend REST API (Node.js / Express)
- MongoDB database
- VPS deployment
- Security
- Third-party integrations
- Source code handover
- Credentials handover

---

## 2. System Overview

Pazimo is a comprehensive event ticketing, invitation, and RSVP platform for the Ethiopian market. Event organizers create events, sell tickets, send invitations, and collect RSVPs through customizable forms; attendees discover events, buy tickets, and check in via QR code. The solution consists of four major components sharing a single backend API:

- **Mobile Application** (Flutter — Android & iOS)
- **Web Application** (Next.js — public site, customer accounts, organizer dashboard, admin dashboard)
- **REST API Backend** (Node.js / Express)
- **MongoDB Database**

### Architecture

```
        Android App                     Next.js Web App
              \                         (public / organizer / admin)
               \                              |
                \                             |
                 -------  REST API (Express)  -
                /              |
               /               |
        iOS App          Socket.IO (real-time)
                                |
                        Node.js Backend Server
                                |
                        MongoDB Database
                                |
                +---------------+---------------+
                |               |               |
           Cloudinary      Chapa / SantimPay   Zoho SMTP /
           (media)         (payments)          GeezSMS (comms)
```

**Mobile Architecture**
- Pattern: BLoC (Business Logic Component)
- Ensures separation between UI, business logic, and data layers
- Reactive UI updates driven by state changes
- Communicates with the same REST API used by the web application

**Web Architecture**
- Next.js App Router with page-based routing
- Component composition with reusable UI components
- State management via Zustand
- API communication through Axios with centralized error handling
- Real-time updates via Socket.IO client

**Backend Architecture**
- RESTful API design with Express.js
- MVC-style layout (controllers, models, routes, services, middleware)
- Service layer for external integrations (payments, email, SMS, media)
- Real-time communication via Socket.IO
- MongoDB with Mongoose ODM and compound indexing for query performance

---

## 3. Technology Stack

### Mobile
- Framework: Flutter 3.24
- Language: Dart
- IDE: Android Studio / VS Code
- State management: BLoC / Cubit

### Web Frontend
- Framework: Next.js 15.3.6 (App Router, Turbopack in dev)
- Language: TypeScript
- UI Components: Radix UI primitives
- Styling: Tailwind CSS 4
- State Management: Zustand
- HTTP Client: Axios
- Real-time: Socket.IO Client
- Animations: Framer Motion
- QR Code: @yudiel/react-qr-scanner, html5-qrcode, qrcode.react
- Charts: Recharts
- Utilities: date-fns, clsx, tailwind-merge

### Backend
- Runtime: Node.js
- Framework: Express.js 4
- Database: MongoDB with Mongoose 7
- Authentication: JWT (jsonwebtoken), bcryptjs
- File Upload: Multer
- Cloud Storage: Cloudinary
- Real-time: Socket.IO
- Payment Gateways: Chapa (chapa-nodejs), SantimPay (custom SDK — `backend/santimSDK`)
- Email: Nodemailer (Zoho SMTP)
- SMS: GeezSMS
- Security middleware: Helmet, CORS
- Logging: Morgan

### Infrastructure
- Web Server: Nginx (reverse proxy + SSL termination)
- Process Manager: PM2
- OS: Ubuntu Server 24.04
- SSL: Let's Encrypt (Certbot)
- Frontend hosting alternative: Vercel

---

## 4. Source Code Handover

The following repositories are transferred to the Client.

| Repository | Description |
|---|---|
| mobile-app | Flutter application (Android & iOS) |
| frontend | Next.js web application (public site, organizer & admin dashboards) |
| backend | Node.js / Express REST API |

- **Repository Branch:** main
- **Release Tag:** v1.0.0

---

## 5. Project Structure

### Mobile (`lib/`)
```
lib/
├── core/            # constants, helpers, utilities
├── data/             # models, repositories, API services
├── presentation/    # screens, widgets
└── bloc/             # cubits and states
```

### Web Frontend (`frontend/`)
```
frontend/
├── app/                   # Next.js App Router pages
│   ├── admin/            # Admin dashboard
│   ├── organizer/        # Organizer dashboard
│   ├── my-account/       # Customer account pages
│   └── page.tsx          # Landing page
├── components/           # Reusable React components
├── lib/                  # Utility functions
├── hooks/                # Custom React hooks
├── store/                # Zustand state management
├── types/                # TypeScript type definitions
└── utils/                # Utility functions
```

### Backend (`backend/`)
```
backend/
├── src/
│   ├── config/          # Database, Cloudinary, server config
│   ├── controllers/     # Business logic handlers
│   ├── middleware/       # Auth, validation, error handling
│   ├── models/           # Mongoose schemas
│   ├── routes/           # API route definitions
│   ├── services/         # Payment, email, SMS integrations
│   ├── scripts/          # Admin creation, index maintenance, ticket tools
│   ├── app.js             # Express application setup
│   └── server.js          # Server entry point
├── uploads/               # File upload storage
└── santimSDK/             # SantimPay payment SDK
```

---

## 6. Installation Guide

### Mobile
```bash
# Install Flutter SDK, then:
git clone <mobile-app-repository-url>
cd mobile-app
flutter pub get
flutter run
```

### Backend
```bash
git clone <backend-repository-url>
cd backend
npm install
cp .env.example .env      # configure environment variables
npm run dev                # nodemon, development
npm start                  # production
```

### Web Frontend
```bash
git clone <frontend-repository-url>
cd frontend
npm install
cp .env.example .env       # configure environment variables
npm run dev                # Next.js dev server with Turbopack
npm run build && npm start # production build & start
```

### First-Time Database Setup
```bash
cd backend
npm run create-admin       # create initial admin user
npm run verify-admin       # verify admin user setup
npm run indexes:create     # create MongoDB indexes
```

---

## 7. Build Instructions

### Mobile — Android
```bash
flutter build apk
flutter build appbundle
```

### Mobile — iOS
```bash
flutter build ios
# Signing via Xcode using provisioning profiles / keystore
```

- **Package Name:** `com.pazimo.organizer`
- **Bundle Identifier:** `com.pazimo.organizer`

### Web Frontend
```bash
cd frontend
npm run build   # produces the .next production build
```

---

## 8. Deployment

### Mobile
- Distributed via **Google Play Store** and **Apple App Store**

### Web Application & Backend (VPS)

The web frontend and backend are deployed together on a single Ubuntu VPS using PM2 and Nginx, with the Next.js app deployed via a prebuilt `.next` artifact (no build performed on the server).

**1. Initial Server Setup**
```bash
ssh root@SERVER_IP
apt update && apt upgrade -y
apt install -y curl git build-essential ufw
```

**2. Install Node.js**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v
npm -v
```

**3. Install PM2**
```bash
npm install -g pm2
pm2 startup
pm2 save
```

**4. Install Nginx**
```bash
apt install -y nginx
systemctl enable nginx
systemctl start nginx
```

**5. Firewall**
```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

**6. Project Structure on the Server**
```
/root/app/backend
/root/app/frontend
```

**7. Backend Setup**
```bash
cd /root/app/backend
npm install --production
pm2 start src/server.js --name backend
pm2 save
```

**8. Frontend Setup — Prebuilt `.next` Method (no `npm run build` on the VPS)**

On the **local** machine:
```bash
npm run build
tar -czf next-build.tar.gz .next
scp next-build.tar.gz root@SERVER_IP:/root/app/frontend/
```

On the **server**:
```bash
cd /root/app/frontend
tar -xzf next-build.tar.gz --no-same-owner
npm install --production --no-audit --no-fund
pm2 start npm --name frontend -- start
pm2 save
```

> `package.json` on the frontend must contain: `"start": "next start -p 3001"`

**9. Nginx Reverse Proxy Configuration**

Create `/etc/nginx/sites-available/app.conf`:
```nginx
server {
    listen 80;
    server_name example.com www.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name example.com www.example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }

    location /uploads/ {
        alias /var/www/uploads/;
    }
}
```

Enable and reload:
```bash
ln -s /etc/nginx/sites-available/app.conf /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

**10. SSL Certificate**
```bash
snap install core; snap refresh core
snap install --classic certbot
certbot --nginx -d example.com -d www.example.com
```

**11. Updating the Frontend Later**

Build locally → tar `.next` → `scp` to server → extract → `pm2 restart frontend`

**12. Safe Extract Command (Low-Memory VPS)**
```bash
tar -xzf next-build.tar.gz --no-same-owner
```

### Alternative Frontend Hosting — Vercel
```bash
npm install -g vercel
cd frontend
vercel login
vercel
```
Configure `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_FRONTEND_URL` in the Vercel dashboard.

### MongoDB Atlas Setup (if not self-hosting MongoDB)
1. Create a MongoDB Atlas account and cluster
2. Get the connection string
3. Whitelist the server IP (or `0.0.0.0/0` for any IP, if acceptable)
4. Set `MONGODB_URI` in the backend `.env`

---

## 9. Database Documentation

**Database:** MongoDB (Mongoose ODM)

### Main Collections
- **User** — customers, organizers, admins, partners; role-based access control
- **Event** — organizer-created events, ticket types, wave-based pricing, location, media
- **Ticket** — purchased/invitation tickets, QR codes, check-in status, payment status
- **RsvpForm** — customizable RSVP/review forms, sections, question types, analytics
- **Invitation** — email/SMS invitations, RSVP tracking, payment status
- **Admin** — platform administrator accounts
- **Category** — event categories
- **Payment / PaymentConfig** — payment transaction records and gateway configuration
- **SantimTransaction** — SantimPay transaction records
- **Notification** — user notifications
- **OrganizerRegistration** — organizer profile/registration details
- **Withdrawal** — organizer withdrawal requests
- **Campaign / CampaignPricing** — marketing campaigns and pricing tiers
- **InvitationPricing** — invitation pricing tiers
- **QRTicket** — QR ticket references
- **ShortUrl** — URL shortening service
- **Wishlist** — user event wishlists

### Indexing Strategy
- Compound indexes for organizer/event/status/date queries
- Unique indexes on email, short IDs, ticket IDs, invitation IDs
- Full-text search index on user name fields
- Check-in and payment-status optimized indexes

Index maintenance scripts:
```bash
npm run indexes:create
npm run indexes:sync
```

### Backup
- **Schedule:** Daily
- **Retention:** 30 Days

---

## 10. API Documentation

### Base URL
- Development: `http://localhost:5000`
- Production: `https://pazimo.com`

### Authentication

`POST /api/auth/login`

Returns a JWT token. Example response:
```json
{
  "token": "xxxxxxxx",
  "user": {
    "id": "1",
    "name": "John Doe"
  }
}
```

Most endpoints require `Authorization: Bearer {token}`.

### Core Endpoint Groups

| Group | Base Path | Examples |
|---|---|---|
| Auth | `/api/auth` | register, login, logout, forgot-password, reset-password |
| Users | `/api/users` | list, get by ID, update profile, organizer stats |
| Events | `/api/events` | list, get, create, update, delete, by organizer/category |
| Tickets | `/api/tickets` | list, purchase, update, cancel, check-in, reactivate |
| RSVP | `/api/rsvp` | forms CRUD, responses, analytics, messages |
| Invitations | `/api/invitations` | create/send, update, delete, pay, RSVP response |
| Payments | `/api/payments` | Chapa & SantimPay initialize/verify |
| Withdrawals | `/api/withdrawals` | request, list, status update, organizer balance |
| Admin | `/api/admin` | dashboard stats, manage users/events/organizers/withdrawals |
| Categories | `/api/categories` | CRUD (admin) |
| Organizers | `/api/organizers` | profile, dashboard, events, analytics |
| Notifications | `/api/notifications` | list, create, mark read, delete |
| Contact | `/api/contact` | submit contact form |
| Webhooks | `/api/webhooks` | Chapa & SantimPay payment webhooks |
| Short URLs | `/api/short` | create, redirect |
| QR Tickets | `/api/qr-tickets` | get, validate, check-in |
| Campaigns | `/api/campaigns` | list, create, update |
| Campaign Pricing | `/api/campaign-pricing` | list, create |
| Invitation Pricing | `/api/invitation-pricing` | list, create |
| Payment Config | `/api/config/payment` | get/update (admin) |

### Optimized Endpoints
Performance-critical endpoints use embedded data and compound indexing:
1. `GET /api/admin/dashboard/stats` — admin statistics (<500ms)
2. `GET /api/users/organizers-stats` — organizers with embedded stats (<800ms)
3. `GET /api/organizers/:id/dashboard` — full organizer dashboard (<800ms)
4. `GET /api/withdrawals/organizer/:id/balance` — balance breakdown (<400ms)
5. `GET /api/withdrawals` / `GET /api/withdrawals/organizer/:id` — include summary stats

### Response Codes
`200` Success · `201` Created · `400` Bad Request · `401` Unauthorized · `403` Forbidden · `404` Not Found · `500` Internal Server Error

---

## 11. Security

| Area | Implementation |
|---|---|
| Authentication | JWT |
| Password Encryption | bcrypt (12 rounds) |
| SSL | Required (Let's Encrypt / Certbot) |
| API Rate Limiting | Enabled |
| Password Policy | Minimum 8 characters |
| Role-Based Access | Strict RBAC (customer, organizer, admin, partner) |
| HTTP Headers | Helmet |
| CORS | Restricted to configured origins |
| Input Validation | Server-side validation on all inputs |
| Payment Webhooks | Signature verification (Chapa, SantimPay) |
| File Uploads | Type/size validation, Cloudinary storage |

---

## 12. Third-Party Services

| Service | Purpose |
|---|---|
| Chapa | Payment gateway (Ethiopian) |
| SantimPay | Payment gateway (Ethiopian), custom SDK |
| Cloudinary | Media storage & delivery |
| Zoho (via Nodemailer) | Transactional email |
| GeezSMS | SMS gateway |
| Socket.IO | Real-time updates (ticket sales, notifications) |

---

## 13. Environment Variables

Variable names actually referenced in the codebase (values are handled separately — see Section 24).

### Backend
```
NODE_ENV
PORT
MONGODB_URI / MONGO_URI
JWT_SECRET
JWT_EXPIRES_IN
FRONTEND_URL
CORS_ORIGIN / CORS_ORIGINS
BASE_URL
BACKEND_URL
BACKEND_PUBLIC_URL

# Chapa
CHAPA_SECRET_KEY
CHAPA_WEBHOOK_BASE_URL
CHAPA_WEBHOOK_SECRET

# SantimPay
SANTIM_PAY_MERCHANT_ID
SANTIM_PAY_PRIVATE_KEY
SANTIM_PAY_PUBLIC_KEY
SANTIM_PAY_NOTIFY_URL

# Email (Zoho via Nodemailer)
EMAIL_USER_ZOHO
EMAIL_PASS_ZOHO
EMAIL_SENDER_ZOHO
EMAIL_USER
EMAIL_PASS
CONTACT_TO_EMAIL

# SMS (GeezSMS)
GEEZSMS_API_KEY
GEEZ_SMS_API_KEY

# Cloudinary
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET

# Initial admin bootstrap
ADMIN_EMAIL
ADMIN_PASSWORD
ADMIN_PHONE
```

### Web Frontend
```
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_FRONTEND_URL
NEXT_PUBLIC_SOCKET_URL
```

> Sensitive values (keys, secrets, passwords) have been shared separately with the Client through a secure channel and are **not** included in this document.

---

## 14. Admin & Organizer Portal

**Admin Dashboard**
- Platform overview & statistics
- User management
- Event oversight
- Organizer management & registrations
- Withdrawal approval/rejection
- Category, banner, campaign & invitation pricing management
- Payment configuration

**Organizer Dashboard**
- Event creation & management
- Ticket sales analytics
- Revenue tracking & withdrawal requests
- Customer management
- QR scanner for check-in
- Invitations & RSVP form builder (with responses/analytics/messages)
- Notification center

---

## 15. User Roles

| Role | Access |
|---|---|
| Admin | Full platform access |
| Organizer | Event creation, ticketing, invitations, RSVP, withdrawals |
| Customer | Ticket purchase, RSVP response, account management |
| Partner | Application access (per role configuration) |

---

## 16. Notifications

| Channel | Provider |
|---|---|
| Push Notifications (mobile) | Firebase Cloud Messaging |
| Email | Zoho SMTP via Nodemailer |
| SMS | GeezSMS |
| In-app / real-time | Socket.IO |

---

## 17. Scheduled Tasks

- Daily database backup
- Notification queue processing
- Email queue processing
- Database cleanup
- Log rotation
- Periodic index sync (`npm run indexes:sync`)

---

## 18. Testing

Completed test types:
- Unit Testing
- Integration Testing
- API Testing
- User Acceptance Testing
- Performance Testing

---

## 19. Known Issues

No critical issues at handover.

Future enhancements recommended:
- Offline synchronization (mobile)
- Dark mode
- Biometric authentication (mobile)
- Redis caching layer
- Advanced analytics (ML-powered insights)
- Multi-language support (i18n)
- Custom report builder
- Event recommendations
- Loyalty program

---

## 20. Maintenance

Recommended monthly tasks:
- Review server logs
- Update dependencies
- Renew SSL certificates
- Optimize database indexes
- Review backups

---

## 21. Backup & Recovery

| Item | Frequency |
|---|---|
| Database Backup | Daily |
| Application Backup | Weekly |
| Recovery Time Objective (RTO) | 4 Hours |

---

## 22. Monitoring

**Server Monitoring:** CPU, Memory, Disk (via VPS monitoring / PM2)

**Application Monitoring:**
- Backend logs (Morgan)
- PM2 process monitoring
- Mobile crash reporting via Firebase Crashlytics

---

## 23. Assets Delivered

- ☑ Source Code
- ☑ API Documentation
- ☑ Database Schema
- ☑ Deployment Guide
- ☑ Mobile Application
- ☑ Web Application (Organizer & Admin Portal)
- ☑ Test Data
- ☑ Design Files
- ☑ User Manual
- ☑ Administrator Manual
- ☑ SSL Certificate
- ☑ Keystore
- ☑ Google Play Console Access
- ☑ Apple Developer Access
- ☑ Firebase Project
- ☑ Database Backup
- ☑ Environment Configuration

---

## 24. Credentials Handover

The following credentials are transferred securely:

- Hosting Control Panel
- Server SSH
- Database (MongoDB Atlas / self-hosted)
- Git Repository
- Google Play Console
- Apple Developer Account
- Firebase Console
- Zoho Email Account
- GeezSMS Account
- Chapa & SantimPay Merchant Accounts
- Cloudinary Account
- Domain Registrar
- SSL Certificates

> Passwords have been communicated through a secure channel and should be changed upon receipt.

---

## 25. Warranty & Support

| Item | Detail |
|---|---|
| Support Period | 90 Days |
| Support Hours | Monday–Friday, 09:00–17:00 |
| Included | Bug fixes, deployment assistance, technical guidance |
| Excluded | New feature development, major redesign, third-party service charges |

---

## 26. Acceptance

We hereby confirm that the following items have been delivered to the Client:

- ☑ Source Code
- ☑ Documentation
- ☑ Deployment Guide
- ☑ Database
- ☑ Credentials
- ☑ Mobile Application
- ☑ Web Application (Organizer & Admin Portal)
- ☑ Design Assets
- ☑ Backup Files
- ☑ User Manuals

### Sign-Off

**Developer**
- Company: ______________________
- Representative: ______________________
- Signature: ______________________
- Date: ______________________

**Client**
- Organization: ______________________
- Representative: ______________________
- Signature: ______________________
- Date: ______________________

### Acceptance Statement

The Client acknowledges receipt of all deliverables, documentation, source code, credentials, and associated assets listed in this document. Responsibility for operation and maintenance of the system transfers to the Client upon acceptance, except for services covered under a separate support and maintenance agreement.
