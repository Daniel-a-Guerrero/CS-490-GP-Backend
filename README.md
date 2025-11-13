<p align="center">
  <img src="public/uploads/salon-1762887976728-106554538.png" alt="StyGo" width="120" />
</p>

# StyGo Platform – Backend

Node.js/Express backend that powers the StyGo salon platform. The service exposes REST APIs for owner onboarding, salon management, appointment scheduling, staff operations, analytics, loyalty, and notification workflows. It integrates with MySQL, Firebase Admin, Nodemailer, Twilio/ClickSend for 2FA, and Stripe-ready payment plumbing.

---

## Tech Stack

| Layer            | Tools / Libraries                                                         |
|------------------|---------------------------------------------------------------------------|
| Runtime          | Node.js 22, Express 5, Nodemon                                            |
| Auth & Security  | JWT, Firebase Admin, Helmet, CORS, Cookie-Parser                          |
| Data             | MySQL (mysql2/promise), MSSQL (legacy support)                            |
| Messaging        | Nodemailer (Gmail SMTP), Twilio, ClickSend                                |
| Utilities        | dotenv, dotenvx, Morgan, Multer                                           |

---

## Features

- **Authentication & Roles**
  - Manual signup/login with JWT cookies
  - Firebase OAuth verification & role assignment
  - Owner auto-onboarding with salon slug creation
  - Two-factor authentication via SMS or email (Twilio → ClickSend fallback)

- **Salon & Staff Management**
  - CRUD for salons with photo uploads
  - Staff creation, PIN setup emails, availability, efficiency tracking
  - Owner health checks (`/api/salons/check-owner`)

- **Appointments & Bookings**
  - Slot availability, booking, rescheduling, history
  - Analytics-ready metrics (revenue, retention, user engagement)

- **Customer Experience**
  - Loyalty points, reviews, gallery photos, notifications, shop/catalog

- **Admin / Backoffice**
  - Dashboards for trends, retention, demographics, logs
  - Payments, payouts, appointment history exports

---

## Repository Layout

```
CS-490-GP-Backend/
├── app.js                   # Express bootstrap + global middleware
├── config/                  # Database pool + Firebase Admin
├── middleware/              # Auth guards, upload helpers, etc.
├── modules/                 # Feature modules (auth, salons, staff, etc.)
│   └── <feature>/
│       ├── controller.js
│       ├── routes.js
│       └── service.js
├── services/                # Shared services (email, sms, clicksend, etc.)
├── public/uploads/          # Uploaded assets (served via /uploads)
└── database/                # Seed scripts & migration helpers
```

---

## Getting Started

### Prerequisites

- Node.js 18+ (22.x recommended)
- npm 9+
- MySQL 8.x (with a database named `salon_platform`)
- Firebase Service Account for Admin SDK

### Installation

```bash
git clone <repo-url>
cd CS-490-GP-Backend
npm install
```

### Environment Variables

Create `.env` in the project root (never commit these secrets):

```env
# Server
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
JWT_SECRET=replace_with_strong_secret

# Database
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=salon_platform

# Firebase Admin
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_PRIVATE_KEY_ID=...
FIREBASE_CLIENT_ID=...
FIREBASE_CLIENT_X509_CERT_URL=...

# Email (Nodemailer)
EMAIL_USER=stygo.notification@gmail.com
EMAIL_PASS=app-specific-password
EMAIL_FROM="StyGo Platform <stygo.notification@gmail.com>"

# SMS / 2FA
TWILIO_ACCOUNT_SID=optional_if_using_twilio
TWILIO_AUTH_TOKEN=optional
TWILIO_PHONE_NUMBER=optional
CLICKSEND_USERNAME=optional_clicksend_username
CLICKSEND_APIKEY=optional_clicksend_key
OTP_FROM_NAME=StyGo
```

> **Tip:** enable either Twilio or ClickSend; the auth service automatically falls back to ClickSend when Twilio credentials are missing.

### Database Prep

1. Create the database:
   ```sql
   CREATE DATABASE salon_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
2. Run any schema migrations/seed scripts located under `database/`.
3. If you imported production data, verify the `salons` table columns (`name`, `salon_name`, `slug`, etc.) so the dynamic queries in `modules/auth/controller.js` resolve correctly.

### Run the Server

```bash
npm run dev     # nodemon + auto-reload
# or
node app.js     # production-style start
```

Server boots at `http://localhost:4000` and exposes `/health` for readiness probes.

---

## Key API Groups

All endpoints live under `/api/*` and expect `Authorization: Bearer <token>` for protected resources.

| Module        | Example Routes                                                                                          |
|---------------|---------------------------------------------------------------------------------------------------------|
| Auth          | `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/verify-2fa`        |
| Salons        | `GET /api/salons`, `POST /api/salons`, `GET /api/salons/check-owner`, `PUT /api/salons/:id`             |
| Staff         | `POST /api/staff/staff`, `PUT /api/staff/staff/:id`, `GET /api/staff/efficiency`, `GET /api/staff/count`|
| Bookings      | `GET /api/booking/available`, `POST /api/booking/book`, `PUT /api/booking/reschedule/:id`               |
| Appointments  | `POST /api/appointments`, `GET /api/appointments/history`, `GET /api/appointments/staff/:id`            |
| Analytics     | `GET /api/analytics/overview`, `GET /api/admin-dashboard/user-engagement`, etc.                         |
| Loyalty       | `POST /api/loyalty/earn`, `POST /api/loyalty/redeem`, `GET /api/loyalty/:user_id/:salon_id`             |
| Photos        | `POST /api/photos/salon`, `DELETE /api/photos/:photo_id`, `GET /api/photos/:appointment_id`             |
| Notifications | `POST /api/notifications/reminder`, `GET /api/notifications`                                            |

For a full list, inspect each module’s `routes.js`.

---

## Development Tips

- **Hot Reload**: `npm run dev` uses Nodemon and re-runs `app.js` on file changes.
- **Uploads**: image uploads land in `public/uploads`, which are served statically via `/uploads`.
- **2FA Messages**: provide Twilio credentials for A2P-registered numbers; otherwise ClickSend handles SMS.
- **Error Logging**: unhandled errors bubble to `app.js`’s centralized error handler and log to the console.
- **Seeds**: use `database/seed-after-salon.sql` to quickly populate demo staff/services after registering a salon.

---

## Troubleshooting

| Issue                                 | Resolution                                                                                 |
|---------------------------------------|--------------------------------------------------------------------------------------------|
| `ER_ACCESS_DENIED_ERROR`              | Verify `MYSQL_*` credentials and that MySQL is reachable.                                   |
| `/api/auth/me` returns 500            | Ensure both `users` and `salons` tables have the columns referenced in `auth/controller`.   |
| SMS not sending                       | Confirm Twilio/ClickSend env vars and that the `services/smsService.js` log shows “ready”.  |
| Firebase `auth/argument-error`        | Private key must preserve newline escape sequences (`\n`).                                  |
| Uploaded photos 404                   | The server must be started from repo root so `public/uploads` resolves correctly.          |

---

## Contributing

1. Create a feature branch (`git checkout -b feature/my-change`)
2. Make your changes with clear commits
3. Ensure lint/tests (if added) pass
4. Submit a pull request describing the change and any manual test steps

---

## License

Internal coursework project for CS-490 GP. Distribution outside the team requires instructor approval.

---

Happy building! 💇‍♀️💈 If you hit any blockers, document the steps and errors in your PR or reach out on the team Slack.
