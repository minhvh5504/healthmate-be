# OMMS Backend API

<p align="center">
  <strong>Order Management & Menu System for Restaurants & Hotels</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-11.0.1-E0234E?style=flat&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/TypeScript-5.7.3-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PostgreSQL-17-4169E1?style=flat&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Prisma-7.2.0-2D3748?style=flat&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/WebSocket-Socket.io-010101?style=flat&logo=socket.io&logoColor=white" alt="WebSocket" />
</p>

---

## 📋 Table of Contents

- [About](#about)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Authentication & Authorization](#authentication--authorization)
- [Guest Ordering Flow](#guest-ordering-flow)
- [Available Scripts](#available-scripts)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## 🎯 About

**OMMS (Order Management & Menu System)** is a comprehensive RESTful API built with NestJS that powers restaurant and hotel ordering systems. It provides real-time order management, menu configuration, QR code-based ordering, and multi-venue support with role-based access control.

**Target Users:**
- **Guests** - Scan QR codes and place orders without authentication
- **Staff** - Manage orders, confirm/reject, and update order status
- **Managers** - Configure menus, venues, and view reports
- **Administrators** - Full system access and user management

**Perfect For:**
- 🏨 Hotels with multiple F&B outlets
- 🍽️ Restaurants with table ordering
- 🏊 Pool bars and room service
- 🎯 Multi-venue hospitality businesses

---

## ✨ Key Features

### 🔐 Authentication & User Management
- JWT-based authentication with access & refresh tokens
- Email verification with OTP (15-minute expiry)
- Role-based access control (GUEST, STAFF, MANAGER, ADMIN)
- User profile management with avatar upload
- Password reset functionality

### 🍽️ Menu Management
- **Categories**: Organize dishes into categories with display order
- **Dishes**: Full CRUD with pricing, descriptions, and images
- **Availability Toggle**: Real-time dish availability control
- **Multi-venue Support**: Different menus for different venues
- **Public API**: Unauthenticated access for guest browsing

### 📱 QR Code System
- **Dynamic QR Generation**: Unique codes for tables/rooms
- **Validation**: Real-time QR code validation with venue/service area info
- **Scan Tracking**: Track scan count and last scanned time
- **Active/Inactive Toggle**: Enable/disable QR codes on demand
- **Download**: Generate QR code images for printing

### 🛒 Order Management
- **Guest Ordering**: Place orders without authentication
- **Order Lifecycle**: 
  - `CREATED_PENDING_CONFIRM` → Staff confirms/rejects
  - `CONFIRMED` → Routed to kitchen/bar
  - `IN_PREP` → Being prepared
  - `READY` → Ready for pickup/delivery
  - `SERVED` → Completed
  - `CANCELLED` / `REJECTED` → Cancelled states
- **Anti-Fake Measures**: Device fingerprint & IP tracking
- **Order Confirmation Gate**: Staff must confirm before processing
- **Order Routing**: Automatic routing to target stations
- **Real-time Updates**: WebSocket notifications for order status

### 🏢 Venue & Service Area Management
- **Multi-venue Support**: Manage multiple restaurants/bars
- **Service Areas**: Tables, rooms, and service zones
- **QR Code Integration**: Link service areas to QR codes
- **Active Orders Tracking**: Prevent deletion of areas with active orders

### 📊 Reports & Analytics
- **Revenue Reports**: Total revenue, by venue, by date
- **Top Dishes**: Most ordered items with revenue breakdown
- **Confirmation Analytics**: Confirmation rates, rejection reasons
- **Order Status Distribution**: Visual breakdown of order states
- **Peak Hours Analysis**: Identify busy periods

### 🔄 Real-time Features (WebSocket)
- Order status updates
- New order notifications
- Kitchen/bar routing alerts
- Queue position updates

### 📤 File Upload
- Cloudinary integration for image storage
- User avatar upload
- Dish images
- Multiple format support (JPEG, PNG, WebP, SVG)

### 📧 Notifications
- Email notifications for:
  - Account verification
  - Order confirmations
  - Password reset

---

## 🛠️ Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **NestJS** | 11.0.1 | Backend framework |
| **TypeScript** | 5.7.3 | Programming language |
| **PostgreSQL** | 17+ | Primary database |
| **Prisma** | 7.2.0 | ORM & database toolkit |
| **Passport JWT** | 10.0.0 | Authentication strategy |
| **Socket.io** | Latest | Real-time WebSocket communication |
| **class-validator** | 0.14.1 | DTO validation |
| **Nodemailer** | 7.0.12 | Email service |
| **Cloudinary** | 2.8.0 | Image upload & storage |
| **QRCode** | 1.5.4 | QR code generation |
| **Swagger/OpenAPI** | 8.0.7 | API documentation |
| **Jest** | 29.7.0 | Testing framework |

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18.x or higher) - [Download](https://nodejs.org/)
- **Yarn** (v1.22.x or higher) - `npm install -g yarn`
- **PostgreSQL** (v14+ recommended) - [Download](https://www.postgresql.org/download/)
- **Git** - [Download](https://git-scm.com/downloads)

**Optional:**
- **Docker** - For containerized PostgreSQL
- **Prisma Studio** - GUI for database inspection (included with Prisma)

---

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone <repository-url>
cd OMMS/code/backend

# 2. Install dependencies
yarn install

# 3. Setup environment
cp .env.example .env
# Edit .env with your configuration

# 4. Setup database
yarn prisma:migrate
yarn prisma:seed

# 5. Start development server
yarn start:dev

# 6. Open Prisma Studio (optional)
yarn prisma:studio
```

The API will be available at `http://localhost:3000`  
Swagger docs at `http://localhost:3000/api`

---

## ⚙️ Environment Configuration

### Create Environment File

```bash
cp .env.example .env
```

### Configure Environment Variables

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/omms_db"

# Server
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# JWT Authentication
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your_super_secret_refresh_key_change_this_too
JWT_REFRESH_EXPIRES_IN=30d

# Email Configuration (Gmail example)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=youremail@gmail.com
MAIL_PASSWORD=your_app_specific_password
MAIL_FROM="OMMS <youremail@gmail.com>"

# Cloudinary (for image uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_FOLDER=omms
```

### Gmail Setup

1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password:
   - Go to [Google Account Settings](https://myaccount.google.com/security)
   - Navigate to **Security** → **2-Step Verification** → **App passwords**
   - Generate a new app password for "Mail"
   - Use this password in `MAIL_PASSWORD`

---

## 🗄️ Database Setup

### Option 1: Local PostgreSQL

```bash
# Create database
psql -U postgres
CREATE DATABASE omms_db;
\q

# Run migrations
yarn prisma:migrate

# Seed database with demo data
yarn prisma:seed
```

**Demo Users Created:**
- **Admin**: `admin@omms.com` / `Admin@123`
- **Manager**: `manager@omms.com` / `Manager@123`
- **Staff**: `staff@omms.com` / `Staff@123`

**Demo Data:**
- 5 Venues (Thai Restaurant, Palm Restaurant, Lobby Bar, Pool Bar, Room Service)
- 10+ Categories (Appetizers, Main Course, Desserts, etc.)
- 50+ Dishes with prices and descriptions
- Service Areas (Tables, Rooms)
- QR Codes for each service area

### Option 2: Docker PostgreSQL

```bash
docker run --name omms-postgres \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=omms_db \
  -p 5432:5432 \
  -d postgres:17

yarn prisma:migrate
yarn prisma:seed
```

### View Database (Prisma Studio)

```bash
yarn prisma:studio
```

Opens at `http://localhost:5555`

---

## 🏃 Running the Application

### Development Mode (with hot reload)

```bash
yarn start:dev
```

API available at `http://localhost:3000`

### Production Build

```bash
# Build
yarn build

# Start production server
yarn start:prod
```

### Debug Mode

```bash
yarn start:debug
```

---

## 📚 API Documentation

Interactive API documentation via **Swagger UI**:

**[http://localhost:3000/api](http://localhost:3000/api)**

### API Modules Overview

| Module | Base Path | Description | Auth Required |
|--------|-----------|-------------|---------------|
| **Authentication** | `/api/v1/auth` | Register, login, verify email, refresh tokens | Public |
| **Menu Categories** | `/api/v1/menu/categories` | Browse and manage categories | Public (GET) |
| **Menu Dishes** | `/api/v1/menu/dishes` | Browse and manage dishes | Public (GET) |
| **QR Codes** | `/api/v1/qr-codes` | Generate, validate, manage QR codes | Public (validate) |
| **Orders** | `/api/v1/orders` | Create, manage, track orders | Public (create, get) |
| **Venues** | `/api/v1/venues` | Manage venues and locations | Protected |
| **Service Areas** | `/api/v1/service-areas` | Manage tables, rooms, zones | Protected |
| **Reports** | `/api/v1/reports` | Analytics and reports | Protected |
| **Upload** | `/api/v1/upload` | File and image uploads | Protected |

---

## 📁 Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── seed.ts                # Database seeding
│   └── migrations/            # Migration history
├── src/
│   ├── main.ts                # Application entry point
│   ├── app.module.ts          # Root module
│   ├── common/                # Shared utilities
│   │   ├── constants/         # Message codes, roles
│   │   ├── decorators/        # @CurrentUser, @Roles, @Public
│   │   ├── exceptions/        # ApiException
│   │   ├── guards/            # JwtAuthGuard, RolesGuard
│   │   ├── interfaces/        # ApiResponse, ResponseHelper
│   │   └── pipes/             # Validation pipes
│   ├── modules/               # Feature modules
│   │   ├── auth/              # Authentication & authorization
│   │   ├── menu/              # Menu management
│   │   │   ├── categories/    # Category CRUD
│   │   │   └── dishes/        # Dish CRUD
│   │   ├── order/             # Order management
│   │   ├── qr-code/           # QR code generation & validation
│   │   ├── venue/             # Venue management
│   │   ├── service-area/      # Service area management
│   │   ├── reports/           # Analytics & reports
│   │   ├── realtime/          # WebSocket gateway
│   │   ├── notifications/     # Email notifications
│   │   ├── upload/            # File uploads
│   │   └── prisma/            # Prisma service
│   └── providers/             # External providers
│       └── cloudinary.provider.ts
├── test/                      # E2E tests
├── .env                       # Environment variables
├── .env.example               # Example environment
└── package.json               # Dependencies
```

---

## 🔐 Authentication & Authorization

### Authentication Flow

1. **Registration**:
   ```
   POST /api/v1/auth/register → Creates user → Sends OTP
   POST /api/v1/auth/verify-email → Verifies OTP → Activates account
   ```

2. **Login**:
   ```
   POST /api/v1/auth/login → Returns access + refresh tokens
   ```

3. **Token Refresh**:
   ```
   POST /api/v1/auth/refresh → Returns new access token
   ```

4. **Protected Endpoints**:
   ```
   Authorization: Bearer <access_token>
   ```

### Role-Based Access Control

| Role | Permissions |
|------|-------------|
| **GUEST** | Browse menu, place orders (no auth required) |
| **STAFF** | Confirm/reject orders, update status, view all orders |
| **MANAGER** | Manage menus, venues, view reports |
| **ADMIN** | Full system access, user management |

### Standardized API Response Format

All endpoints return a consistent response format:

**Success Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Operation successful",
  "messageCode": "VENUE.GET.SUCCESS",
  "data": { ... },
  "timestamp": "2026-02-02T15:30:00.000Z"
}
```

**Error Response:**
```json
{
  "success": false,
  "statusCode": 404,
  "message": "Operation failed",
  "messageCode": "VENUE.NOT_FOUND",
  "errorMessage": "Venue with ID xyz not found",
  "errorCode": "VENUE.NOT_FOUND",
  "timestamp": "2026-02-02T15:30:00.000Z"
}
```

---

## 🛒 Guest Ordering Flow

The system supports **unauthenticated guest ordering** via QR codes:

### Step-by-Step Flow

1. **Guest scans QR code** at their table/room
   ```
   GET /api/v1/qr-codes/validate/{code}
   → Returns venue, service area, and menu info
   ```

2. **Browse menu** (no authentication required)
   ```
   GET /api/v1/menu/categories
   GET /api/v1/menu/dishes?venueId={id}
   ```

3. **Place order** (no authentication required)
   ```
   POST /api/v1/orders
   {
     "venueId": "...",
     "serviceAreaId": "...",
     "guestName": "John Doe",
     "guestPhone": "+1234567890",
     "items": [
       { "dishId": "...", "quantity": 2, "notes": "No onions" }
     ],
     "deviceFingerprint": "...",
     "ipAddress": "..."
   }
   → Order created with status: CREATED_PENDING_CONFIRM
   ```

4. **Staff confirms order**
   ```
   POST /api/v1/orders/{id}/confirm
   → Status: CONFIRMED → Routed to kitchen
   ```

5. **Track order** (optional, no auth required)
   ```
   GET /api/v1/orders/{id}
   → Returns current order status
   ```

### Order Status Flow

```
CREATED_PENDING_CONFIRM (Guest creates order)
         ↓
    CONFIRMED (Staff confirms) ← Can be REJECTED
         ↓
      IN_PREP (Kitchen preparing)
         ↓
       READY (Ready for pickup/delivery)
         ↓
      SERVED (Completed)
```

---

## 📜 Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| **Development** | `yarn start:dev` | Start with hot reload |
| **Build** | `yarn build` | Compile TypeScript |
| **Production** | `yarn start:prod` | Run production build |
| **Debug** | `yarn start:debug` | Start with debugger |
| **Lint** | `yarn lint` | Run ESLint |
| **Format** | `yarn format` | Format with Prettier |
| **Test** | `yarn test` | Run unit tests |
| **Test E2E** | `yarn test:e2e` | Run E2E tests |
| **Test Coverage** | `yarn test:cov` | Generate coverage |
| **Prisma Migrate** | `yarn prisma:migrate` | Run migrations |
| **Prisma Generate** | `yarn prisma:generate` | Generate Prisma Client |
| **Prisma Seed** | `yarn prisma:seed` | Seed database |
| **Prisma Studio** | `yarn prisma:studio` | Open Prisma Studio |
| **Prisma Reset** | `yarn prisma:reset` | Reset database |

---

## 🧪 Testing

### Run Unit Tests

```bash
yarn test
```

### Run E2E Tests

```bash
yarn test:e2e
```

### Generate Coverage Report

```bash
yarn test:cov
```

### Test with Watch Mode

```bash
yarn test:watch
```

---

## 🔧 Troubleshooting

### Database Connection Issues

**Error**: `Can't reach database server`

**Solutions**:
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Verify DATABASE_URL in .env
# Format: postgresql://username:password@host:port/database

# Test connection
yarn prisma db pull
```

### Migration Issues

```bash
# Reset database (deletes all data)
yarn prisma:reset

# Or manually
psql -U postgres -c "DROP DATABASE omms_db;"
psql -U postgres -c "CREATE DATABASE omms_db;"
yarn prisma:migrate
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000          # Mac/Linux
netstat -ano | findstr :3000  # Windows

# Change PORT in .env
PORT=3001
```

### Email Sending Issues

1. Enable 2FA and create App Password
2. Use correct SMTP settings:
   - Gmail: `smtp.gmail.com:587` (TLS)
   - Outlook: `smtp-mail.outlook.com:587`
3. Check firewall blocking port 587

### Cloudinary Upload Issues

1. Verify credentials in `.env`
2. Check API limits in Cloudinary dashboard
3. Ensure file size < 5MB
4. Verify formats: JPEG, PNG, WebP, SVG

---

## 📄 License

This project is licensed under the MIT License.

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📞 Support

For issues and questions:
- Create an issue in the repository
- Check the [API Documentation](http://localhost:3000/api)
- Review Prisma Studio for database inspection

---

**Built with ❤️ using NestJS, Prisma, and PostgreSQL**
# healthmate-be
