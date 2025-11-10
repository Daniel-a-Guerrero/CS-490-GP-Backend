# Salon Booking Platform - Backend

Node.js/Express API for our salon booking platform. Handles authentication, appointments, payments, and more.

## Setup

### What you need:
- Node.js
- MySQL
- Firebase account
- npm

### Installation

1. Clone the repo
   ```bash
   git clone <repository-url>
   cd CS-490-GP-Backend
   ```

2. Install packages
   ```bash
   npm install
   ```

3. Setup database
   - Create MySQL database named `salon_platform`
   - Remember your MySQL username and password

4. Create `.env` file in root folder with:

   ```env
   # Server Configuration
   PORT=4000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000

   # MySQL Database Configuration
   MYSQL_HOST=localhost
   MYSQL_USER=root
   MYSQL_PASSWORD=your_mysql_password
   MYSQL_DATABASE=salon_platform

   # Firebase Admin SDK
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
   FIREBASE_PRIVATE_KEY_ID=your-private-key-id
   FIREBASE_CLIENT_ID=your-client-id
   FIREBASE_CERT_URL=your-cert-url

   # JWT Secret
   JWT_SECRET=your_jwt_secret_key

   # Stripe (if using payments)
   STRIPE_SECRET_KEY=your_stripe_secret_key

   # ClickSend SMS (for 2FA SMS verification)
   CLICKSEND_USERNAME=your_clicksend_username
   CLICKSEND_APIKEY=your_clicksend_api_key
   OTP_FROM_NAME=StyGo
   ```

5. Start the server
   ```bash
   npm run dev
   ```
   or
   ```bash
   node app.js
   ```

## Environment Variables

- PORT - server port (default: 4000)
- MYSQL_* - your database info
- FIREBASE_* - firebase credentials
- JWT_SECRET - secret key for tokens
- CLICKSEND_* - for SMS codes (optional)

## API Endpoints

Base URL: `http://localhost:4000`

Auth header for protected routes:
```
Authorization: Bearer <token>
```

### Endpoints

#### Auth Endpoints
- `POST /api/auth/signup` - Manual signup
- `POST /api/auth/login` - Manual login
- `GET /api/auth/profile` - Get user profile (JWT)
- `POST /api/auth/verify-firebase` - Verify Firebase token
- `POST /api/auth/set-role` - Set role for new Firebase user
- `GET /api/auth/me` - Get current user (Firebase/JWT)
- `POST /api/auth/logout` - Logout
- `POST /api/auth/verify-2fa` - Verify 2FA code
- `POST /api/auth/2fa/enable` - Enable 2FA
- `POST /api/auth/2fa/disable` - Disable 2FA
- `GET /api/auth/2fa/status` - Get 2FA status

#### Staff Endpoints
- `GET /api/staff/count?salonId=<id>` - Get staff count
- `GET /api/staff/avg?salonId=<id>` - Get average staff rating
- `GET /api/staff/staff/:sid` - Get staff list (with filters)
- `GET /api/staff/efficiency/:id?salonId=<id>` - Get staff efficiency
- `GET /api/staff/efficiency?salonId=<id>` - Get average efficiency
- `GET /api/staff/revenue/:id` - Get staff revenue
- `POST /api/staff/staff` - Add staff
- `PUT /api/staff/staff/:id` - Edit staff

#### Salons Endpoints
- `POST /api/salons` - Create salon (owner)
- `GET /api/salons` - List active salons
- `GET /api/salons/pending` - List pending salons (admin)
- `PUT /api/salons/:salon_id/status` - Update salon status (admin)

#### Booking Endpoints
- `GET /api/booking/available` - Get available barbers and time slots
- `POST /api/booking/book` - Book appointment
- `PUT /api/booking/reschedule/:id` - Reschedule appointment
- `DELETE /api/booking/cancel/:id` - Cancel appointment
- `GET /api/booking/barber/schedule` - Get barber's daily schedule
- `POST /api/booking/barber/block-slot` - Block time slot (barber)

#### Appointments Endpoints
- `POST /api/appointments` - Book appointment (with price and notes)

#### Payments Endpoints
- `POST /api/payments/pay` - Process payment
- `GET /api/payments/salon/:salon_id` - Get payments for salon

#### Loyalty Endpoints
- `POST /api/loyalty/earn` - Earn loyalty points
- `GET /api/loyalty/:user_id/:salon_id` - Get loyalty points balance
- `POST /api/loyalty/redeem` - Redeem points
- `POST /api/loyalty/config` - Configure loyalty rewards

#### Reviews Endpoints
- `POST /api/reviews/add` - Add review
- `PUT /api/reviews/respond/:id` - Add review response

#### Notifications Endpoints
- `POST /api/notifications/reminder` - Send appointment reminder
- `POST /api/notifications/promotion` - Send promotional offer
- `POST /api/notifications/delay` - Notify client of delay
- `POST /api/notifications/discount` - Notify user of discount
- `GET /api/notifications` - Get user notifications

#### History Endpoints
- `GET /api/history/user` - Get user visit history
- `GET /api/history/salon/:salon_id` - Get salon visit history

#### Photos Endpoints
- `POST /api/photos/add` - Add service photo
- `GET /api/photos/:appointment_id` - Get service photos

#### Admin Dashboard Endpoints
- `GET /api/admin-dashboard/user-engagement` - Get user engagement stats
- `GET /api/admin-dashboard/appointment-trends` - Get appointment trends
- `GET /api/admin-dashboard/salon-revenues` - Get salon revenues
- `GET /api/admin-dashboard/loyalty-usage` - Get loyalty usage
- `GET /api/admin-dashboard/user-demographics` - Get user demographics
- `GET /api/admin-dashboard/customer-retention` - Get customer retention
- `GET /api/admin-dashboard/reports` - Get reports
- `GET /api/admin-dashboard/system-logs` - Get system logs

#### Shop Endpoints
- `POST /api/shop/add-product` - Add product (owner)
- `PUT /api/shop/update-product/:product_id` - Update product (owner)
- `GET /api/shop/products/:salon_id` - Get salon products (public)
- `POST /api/shop/add-to-cart` - Add to cart
- `GET /api/shop/cart` - Get cart
- `POST /api/shop/checkout` - Checkout cart

#### Health Check
- `GET /health` - Health check endpoint

## Features

- User signup/login (email and Firebase)
- JWT authentication
- 2FA with SMS
- Appointment booking
- Payment processing
- Loyalty points
- Reviews and ratings
- Notifications
- Admin dashboard

## Project Structure

```
CS-490-GP-Backend/
├── app.js - main server file
├── config/ - database and firebase setup
├── middleware/ - authentication middleware
├── modules/ - all features (auth, bookings, payments, etc)
└── services/ - SMS service
```

Each module has:
- service.js - database queries
- controller.js - handles requests
- routes.js - API routes

## SMS 2FA

Uses ClickSend for SMS codes.
1. Get ClickSend account
2. Add username and API key to .env
3. 2FA codes will be sent automatically

## Common Issues

- **Database error**: make sure MySQL is running and salon_platform database exists
- **Firebase error**: check your .env file has correct credentials
- **JWT error**: make sure JWT_SECRET is set

## Running the server

Development:
```bash
npm run dev
```

Production:
```bash
node app.js
```
