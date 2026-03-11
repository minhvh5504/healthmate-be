# OMMS API Integration Guide for Frontend

> **Tài liệu tích hợp API cho Frontend Team**  
> Version: 2.0 (Standardized Response Format)  
> Last Updated: 2026-02-02

---

## 📋 Mục lục

- [Thông tin chung](#thông-tin-chung)
- [Standardized Response Format](#standardized-response-format)
- [Authentication](#authentication)
- [User Flows](#user-flows)
  - [1. Guest Ordering Flow](#1-guest-ordering-flow-khách-đặt-món)
  - [2. Staff Order Management Flow](#2-staff-order-management-flow-nhân-viên-quản-lý-đơn)
  - [3. Manager Menu Management Flow](#3-manager-menu-management-flow-quản-lý-menu)
  - [4. Admin Reports Flow](#4-admin-reports-flow-xem-báo-cáo)
- [Error Handling](#error-handling)
- [WebSocket Events](#websocket-events)
- [Best Practices](#best-practices)

---

## 🌐 Thông tin chung

### Base URL
```
Development: http://localhost:3000
Production: https://api.omms.com
```

### API Prefix
```
/api/v1
```

### Headers
```javascript
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <access_token>" // Chỉ cho protected endpoints
}
```

---

## 📦 Standardized Response Format

**TẤT CẢ** endpoints đều trả về format chuẩn sau:

### Success Response
```typescript
interface ApiResponse<T> {
  success: true;
  statusCode: number;        // 200, 201, etc.
  message: string;           // Human-readable message
  messageCode: string;       // Code for i18n (e.g., "ORDER.CREATE.SUCCESS")
  data: T;                   // Actual data
  timestamp: string;         // ISO 8601 timestamp
}
```

**Example:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Venue retrieved successfully",
  "messageCode": "VENUE.GET.SUCCESS",
  "data": {
    "id": "venue-123",
    "name": "Thai Restaurant",
    "isActive": true
  },
  "timestamp": "2026-02-02T15:30:00.000Z"
}
```

### Error Response
```typescript
interface ApiErrorResponse {
  success: false;
  statusCode: number;        // 400, 401, 404, 500, etc.
  message: string;           // Generic error message
  messageCode: string;       // Error code for i18n
  errorMessage: string;      // Detailed error message
  errorCode: string;         // Same as messageCode
  timestamp: string;
}
```

**Example:**
```json
{
  "success": false,
  "statusCode": 404,
  "message": "Venue retrieval failed",
  "messageCode": "VENUE.NOT_FOUND",
  "errorMessage": "Venue with ID venue-123 not found",
  "errorCode": "VENUE.NOT_FOUND",
  "timestamp": "2026-02-02T15:30:00.000Z"
}
```

### Frontend Integration

```typescript
// Accessing data
const response = await api.get('/venues/123');
const venue = response.data; // Access via .data

// Error handling
try {
  const response = await api.post('/orders', orderData);
  toast.success(response.message); // Or use messageCode for i18n
} catch (error) {
  const errorCode = error.response.data.messageCode;
  const errorMessage = error.response.data.errorMessage;
  
  // Use messageCode for i18n
  toast.error(t(errorCode));
}
```

---

## 🔐 Authentication

### 1. Register (Public)
```http
POST /api/v1/auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "Password@123",
  "fullName": "John Doe",
  "phoneNumber": "+84123456789",
  "role": "STAFF" // GUEST, STAFF, MANAGER, ADMIN
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "User registered successfully. Please check your email for verification code.",
  "messageCode": "AUTH.REGISTER.SUCCESS",
  "data": {
    "user": {
      "id": "user-123",
      "email": "user@example.com",
      "fullName": "John Doe",
      "role": "STAFF",
      "isVerified": false
    }
  },
  "timestamp": "2026-02-02T15:30:00.000Z"
}
```

### 2. Verify Email
```http
POST /api/v1/auth/verify-email
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Email verified successfully",
  "messageCode": "AUTH.VERIFY.SUCCESS",
  "data": {
    "user": {
      "id": "user-123",
      "email": "user@example.com",
      "isVerified": true
    }
  },
  "timestamp": "2026-02-02T15:30:00.000Z"
}
```

### 3. Login
```http
POST /api/v1/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "Password@123"
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Login successful",
  "messageCode": "AUTH.LOGIN.SUCCESS",
  "data": {
    "user": {
      "id": "user-123",
      "email": "user@example.com",
      "fullName": "John Doe",
      "role": "STAFF"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "timestamp": "2026-02-02T15:30:00.000Z"
}
```

### 4. Refresh Token
```http
POST /api/v1/auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Token refreshed successfully",
  "messageCode": "AUTH.REFRESH.SUCCESS",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "timestamp": "2026-02-02T15:30:00.000Z"
}
```

---

## 🎯 User Flows

## 1. Guest Ordering Flow (Khách đặt món)

> **Không cần authentication** - Guest có thể đặt món mà không cần đăng nhập

### Flow Diagram
```
Guest scans QR → Validate QR → Browse Menu → Create Order → Track Order
```

### Step 1: Validate QR Code (Public)
```http
GET /api/v1/qr-codes/validate/{code}
```

**Example:**
```http
GET /api/v1/qr-codes/validate/QR-TABLE-001
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "QR code validated successfully",
  "messageCode": "QR_CODE.VALIDATE.SUCCESS",
  "data": {
    "id": "qr-123",
    "code": "QR-TABLE-001",
    "type": "TABLE",
    "isActive": true,
    "serviceArea": {
      "id": "area-123",
      "name": "Table 5",
      "type": "TABLE",
      "venue": {
        "id": "venue-123",
        "name": "Thai Restaurant",
        "description": "Authentic Thai cuisine"
      }
    },
    "scannedCount": 15,
    "lastScannedAt": "2026-02-02T15:30:00.000Z"
  },
  "timestamp": "2026-02-02T15:30:00.000Z"
}
```

**Error Cases:**
```json
// QR not found
{
  "success": false,
  "statusCode": 404,
  "messageCode": "QR_CODE.NOT_FOUND",
  "errorMessage": "QR code not found"
}

// QR inactive
{
  "success": false,
  "statusCode": 400,
  "messageCode": "QR_CODE.INACTIVE",
  "errorMessage": "QR code is inactive"
}
```

### Step 2: Get Categories (Public)
```http
GET /api/v1/menu/categories?includeInactive=false
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Categories retrieved successfully",
  "messageCode": "CATEGORY.LIST.SUCCESS",
  "data": [
    {
      "id": "cat-1",
      "name": "Appetizers",
      "description": "Start your meal right",
      "displayOrder": 1,
      "isActive": true
    },
    {
      "id": "cat-2",
      "name": "Main Course",
      "description": "Our signature dishes",
      "displayOrder": 2,
      "isActive": true
    }
  ],
  "timestamp": "2026-02-02T15:30:00.000Z"
}
```

### Step 3: Get Dishes (Public)
```http
GET /api/v1/menu/dishes?venueId={venueId}&categoryId={categoryId}&includeInactive=false
```

**Example:**
```http
GET /api/v1/menu/dishes?venueId=venue-123&categoryId=cat-1
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Dishes retrieved successfully",
  "messageCode": "DISH.LIST.SUCCESS",
  "data": [
    {
      "id": "dish-1",
      "name": "Tom Yum Soup",
      "description": "Spicy and sour Thai soup",
      "price": 120000,
      "imageUrl": "https://cloudinary.com/...",
      "isAvailable": true,
      "isActive": true,
      "category": {
        "id": "cat-1",
        "name": "Appetizers"
      },
      "venue": {
        "id": "venue-123",
        "name": "Thai Restaurant"
      }
    }
  ],
  "timestamp": "2026-02-02T15:30:00.000Z"
}
```

**Query Parameters:**
- `venueId` (optional): Filter by venue
- `categoryId` (optional): Filter by category
- `search` (optional): Search by dish name
- `includeInactive` (optional): Include inactive dishes (default: false)

### Step 4: Create Order (Public)
```http
POST /api/v1/orders
```

**Request Body:**
```json
{
  "venueId": "venue-123",
  "serviceAreaId": "area-123",
  "guestType": "WALK_IN",
  "guestName": "John Doe",
  "guestPhone": "+84123456789",
  "notes": "No spicy please",
  "items": [
    {
      "dishId": "dish-1",
      "quantity": 2,
      "notes": "Extra lime"
    },
    {
      "dishId": "dish-2",
      "quantity": 1
    }
  ],
  "deviceFingerprint": "unique-device-id-123",
  "ipAddress": "192.168.1.100"
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Order created successfully",
  "messageCode": "ORDER.CREATE.SUCCESS",
  "data": {
    "id": "order-123",
    "orderNumber": "ORD-20260202-001",
    "status": "CREATED_PENDING_CONFIRM",
    "guestName": "John Doe",
    "guestPhone": "+84123456789",
    "totalAmount": 360000,
    "notes": "No spicy please",
    "orderItems": [
      {
        "id": "item-1",
        "dishId": "dish-1",
        "dishName": "Tom Yum Soup",
        "dishPrice": 120000,
        "quantity": 2,
        "subtotal": 240000,
        "notes": "Extra lime"
      },
      {
        "id": "item-2",
        "dishId": "dish-2",
        "dishName": "Pad Thai",
        "dishPrice": 120000,
        "quantity": 1,
        "subtotal": 120000
      }
    ],
    "venue": {
      "id": "venue-123",
      "name": "Thai Restaurant"
    },
    "serviceArea": {
      "id": "area-123",
      "name": "Table 5"
    },
    "createdAt": "2026-02-02T15:30:00.000Z"
  },
  "timestamp": "2026-02-02T15:30:00.000Z"
}
```

**Error Cases:**
```json
// Dish not available
{
  "success": false,
  "statusCode": 400,
  "messageCode": "DISH.NOT_AVAILABLE",
  "errorMessage": "Dishes not available: Tom Yum Soup"
}

// Dish not found
{
  "success": false,
  "statusCode": 400,
  "messageCode": "DISH.NOT_FOUND",
  "errorMessage": "Some dishes not found"
}
```

### Step 5: Track Order (Public)
```http
GET /api/v1/orders/{orderId}
```

**Example:**
```http
GET /api/v1/orders/order-123
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Order retrieved successfully",
  "messageCode": "ORDER.GET.SUCCESS",
  "data": {
    "id": "order-123",
    "orderNumber": "ORD-20260202-001",
    "status": "IN_PREP",
    "guestName": "John Doe",
    "totalAmount": 360000,
    "orderItems": [...],
    "createdAt": "2026-02-02T15:30:00.000Z",
    "updatedAt": "2026-02-02T15:35:00.000Z"
  },
  "timestamp": "2026-02-02T15:40:00.000Z"
}
```

**Order Status Values:**
- `CREATED_PENDING_CONFIRM` - Chờ xác nhận
- `CONFIRMED` - Đã xác nhận
- `IN_PREP` - Đang chuẩn bị
- `READY` - Sẵn sàng
- `SERVED` - Đã phục vụ
- `CANCELLED` - Đã hủy
- `REJECTED` - Bị từ chối

---

## 2. Staff Order Management Flow (Nhân viên quản lý đơn)

> **Requires authentication** - Role: STAFF, MANAGER, ADMIN

### Flow Diagram
```
View Pending Orders → Confirm/Reject → Update Status → Complete Order
```

### Step 1: Get Pending Orders (Protected)
```http
GET /api/v1/orders/pending
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Pending orders retrieved successfully",
  "messageCode": "ORDER.PENDING.SUCCESS",
  "data": [
    {
      "id": "order-123",
      "orderNumber": "ORD-20260202-001",
      "status": "CREATED_PENDING_CONFIRM",
      "guestName": "John Doe",
      "totalAmount": 360000,
      "createdAt": "2026-02-02T15:30:00.000Z"
    }
  ],
  "timestamp": "2026-02-02T15:40:00.000Z"
}
```

### Step 2: Confirm Order (Protected)
```http
POST /api/v1/orders/{orderId}/confirm
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "notes": "Confirmed by staff"
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Order confirmed successfully",
  "messageCode": "ORDER.CONFIRM.SUCCESS",
  "data": {
    "id": "order-123",
    "status": "CONFIRMED",
    "confirmation": {
      "confirmedBy": {
        "id": "user-123",
        "fullName": "Staff Name"
      },
      "confirmedAt": "2026-02-02T15:35:00.000Z"
    }
  },
  "timestamp": "2026-02-02T15:35:00.000Z"
}
```

### Step 3: Reject Order (Protected)
```http
POST /api/v1/orders/{orderId}/reject
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "rejectionReason": "Out of stock"
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Order rejected successfully",
  "messageCode": "ORDER.REJECT.SUCCESS",
  "data": {
    "id": "order-123",
    "status": "REJECTED",
    "cancelledReason": "Out of stock"
  },
  "timestamp": "2026-02-02T15:35:00.000Z"
}
```

### Step 4: Update Order Status (Protected)
```http
PATCH /api/v1/orders/{orderId}/status
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "status": "IN_PREP" // IN_PREP, READY, SERVED
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Order status updated successfully",
  "messageCode": "ORDER.UPDATE.SUCCESS",
  "data": {
    "id": "order-123",
    "status": "IN_PREP",
    "updatedAt": "2026-02-02T15:40:00.000Z"
  },
  "timestamp": "2026-02-02T15:40:00.000Z"
}
```

### Step 5: Get All Orders (Protected)
```http
GET /api/v1/orders?status={status}&venueId={venueId}&startDate={date}&endDate={date}
Authorization: Bearer <access_token>
```

**Example:**
```http
GET /api/v1/orders?status=CONFIRMED&venueId=venue-123
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Orders retrieved successfully",
  "messageCode": "ORDER.LIST.SUCCESS",
  "data": [
    {
      "id": "order-123",
      "orderNumber": "ORD-20260202-001",
      "status": "CONFIRMED",
      "totalAmount": 360000,
      "createdAt": "2026-02-02T15:30:00.000Z"
    }
  ],
  "timestamp": "2026-02-02T15:40:00.000Z"
}
```

---

## 3. Manager Menu Management Flow (Quản lý menu)

> **Requires authentication** - Role: MANAGER, ADMIN

### Categories Management

#### Get All Categories
```http
GET /api/v1/menu/categories?includeInactive=true
Authorization: Bearer <access_token>
```

#### Create Category
```http
POST /api/v1/menu/categories
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "name": "Desserts",
  "description": "Sweet endings",
  "displayOrder": 5,
  "isActive": true
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Category created successfully",
  "messageCode": "CATEGORY.CREATE.SUCCESS",
  "data": {
    "id": "cat-5",
    "name": "Desserts",
    "description": "Sweet endings",
    "displayOrder": 5,
    "isActive": true
  },
  "timestamp": "2026-02-02T15:40:00.000Z"
}
```

#### Update Category
```http
PATCH /api/v1/menu/categories/{id}
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "name": "Desserts & Sweets",
  "displayOrder": 4
}
```

#### Delete Category
```http
DELETE /api/v1/menu/categories/{id}
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Category deleted successfully",
  "messageCode": "CATEGORY.DELETE.SUCCESS",
  "data": {
    "id": "cat-5",
    "deletedAt": "2026-02-02T15:40:00.000Z"
  },
  "timestamp": "2026-02-02T15:40:00.000Z"
}
```

### Dishes Management

#### Create Dish
```http
POST /api/v1/menu/dishes
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "name": "Mango Sticky Rice",
  "description": "Traditional Thai dessert",
  "price": 80000,
  "categoryId": "cat-5",
  "venueId": "venue-123",
  "imageUrl": "https://cloudinary.com/...",
  "isAvailable": true,
  "isActive": true
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Dish created successfully",
  "messageCode": "DISH.CREATE.SUCCESS",
  "data": {
    "id": "dish-10",
    "name": "Mango Sticky Rice",
    "price": 80000,
    "isAvailable": true
  },
  "timestamp": "2026-02-02T15:40:00.000Z"
}
```

#### Toggle Dish Availability
```http
PATCH /api/v1/menu/dishes/{id}/toggle-availability
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Dish availability toggled to available",
  "messageCode": "DISH.TOGGLE.SUCCESS",
  "data": {
    "id": "dish-10",
    "isAvailable": true
  },
  "timestamp": "2026-02-02T15:40:00.000Z"
}
```

---

## 4. Admin Reports Flow (Xem báo cáo)

> **Requires authentication** - Role: MANAGER, ADMIN

### Revenue Report
```http
GET /api/v1/reports/revenue?startDate={date}&endDate={date}&venueId={id}
Authorization: Bearer <access_token>
```

**Example:**
```http
GET /api/v1/reports/revenue?startDate=2026-02-01&endDate=2026-02-02
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Revenue report generated successfully",
  "messageCode": "REPORT.GENERATE.SUCCESS",
  "data": {
    "summary": {
      "totalRevenue": 5000000,
      "totalOrders": 50,
      "averageOrderValue": 100000
    },
    "byVenue": [
      {
        "venueName": "Thai Restaurant",
        "totalRevenue": 3000000,
        "orderCount": 30
      },
      {
        "venueName": "Pool Bar",
        "totalRevenue": 2000000,
        "orderCount": 20
      }
    ],
    "byDate": [
      {
        "date": "2026-02-01",
        "totalRevenue": 2500000,
        "orderCount": 25
      },
      {
        "date": "2026-02-02",
        "totalRevenue": 2500000,
        "orderCount": 25
      }
    ]
  },
  "timestamp": "2026-02-02T15:40:00.000Z"
}
```

### Top Dishes Report
```http
GET /api/v1/reports/top-dishes?limit=10&startDate={date}&endDate={date}
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Top dishes report generated successfully",
  "messageCode": "REPORT.GENERATE.SUCCESS",
  "data": {
    "topDishes": [
      {
        "dishId": "dish-1",
        "dishName": "Tom Yum Soup",
        "totalQuantity": 100,
        "totalRevenue": 1200000,
        "orderCount": 50
      }
    ],
    "totalDishes": 25
  },
  "timestamp": "2026-02-02T15:40:00.000Z"
}
```

### Confirmation Analytics
```http
GET /api/v1/reports/confirmation-analytics?startDate={date}&endDate={date}
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Confirmation analytics generated successfully",
  "messageCode": "REPORT.GENERATE.SUCCESS",
  "data": {
    "summary": {
      "totalOrders": 100,
      "confirmedOrders": 85,
      "rejectedOrders": 10,
      "pendingOrders": 5,
      "confirmationRate": 85.00,
      "rejectionRate": 10.00,
      "averageConfirmationTimeMs": 120000,
      "averageConfirmationTimeMinutes": 2.00
    },
    "topRejectionReasons": [
      {
        "reason": "Out of stock",
        "count": 5
      },
      {
        "reason": "Kitchen closed",
        "count": 3
      }
    ]
  },
  "timestamp": "2026-02-02T15:40:00.000Z"
}
```

### Peak Hours Analytics
```http
GET /api/v1/reports/peak-hours?startDate={date}&endDate={date}
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Peak hours analytics generated successfully",
  "messageCode": "REPORT.GENERATE.SUCCESS",
  "data": {
    "hourlyData": [
      {
        "hour": 12,
        "orderCount": 25,
        "totalRevenue": 500000
      },
      {
        "hour": 18,
        "orderCount": 30,
        "totalRevenue": 600000
      }
    ],
    "peakHour": {
      "hour": 18,
      "orderCount": 30,
      "totalRevenue": 600000
    }
  },
  "timestamp": "2026-02-02T15:40:00.000Z"
}
```

---

## ❌ Error Handling

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `AUTH.LOGIN.INVALID_CREDENTIALS` | 401 | Email hoặc password sai |
| `AUTH.LOGIN.NOT_VERIFIED` | 403 | Account chưa verify email |
| `AUTH.VERIFY.INVALID_OTP` | 400 | OTP không đúng |
| `AUTH.VERIFY.OTP_EXPIRED` | 400 | OTP đã hết hạn |
| `VENUE.NOT_FOUND` | 404 | Không tìm thấy venue |
| `DISH.NOT_FOUND` | 404 | Không tìm thấy món ăn |
| `DISH.NOT_AVAILABLE` | 400 | Món ăn không available |
| `ORDER.NOT_FOUND` | 404 | Không tìm thấy đơn hàng |
| `ORDER.INVALID_STATUS` | 400 | Trạng thái đơn không hợp lệ |
| `QR_CODE.NOT_FOUND` | 404 | Không tìm thấy QR code |
| `QR_CODE.INACTIVE` | 400 | QR code đã bị vô hiệu hóa |

### Error Handling Example

```typescript
// Axios interceptor
axios.interceptors.response.use(
  (response) => response.data, // Return data directly
  (error) => {
    const { statusCode, messageCode, errorMessage } = error.response.data;
    
    // Handle specific errors
    switch (messageCode) {
      case 'AUTH.LOGIN.INVALID_CREDENTIALS':
        toast.error('Email hoặc mật khẩu không đúng');
        break;
      case 'DISH.NOT_AVAILABLE':
        toast.error('Món ăn hiện không có sẵn');
        break;
      case 'QR_CODE.INACTIVE':
        toast.error('QR code không còn hoạt động');
        break;
      default:
        toast.error(errorMessage);
    }
    
    return Promise.reject(error);
  }
);
```

---

## 🔄 WebSocket Events

### Connect to WebSocket
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: accessToken // Optional for authenticated events
  }
});
```

### Listen to Events

#### New Order Created
```javascript
socket.on('order:pending:confirmation', (order) => {
  console.log('New order pending:', order);
  // Update UI, show notification
});
```

#### Order Confirmed
```javascript
socket.on('order:confirmed', (order) => {
  console.log('Order confirmed:', order);
  // Update order status in UI
});
```

#### Order Status Updated
```javascript
socket.on('order:status:updated', ({ orderId, status }) => {
  console.log(`Order ${orderId} status: ${status}`);
  // Update order status in real-time
});
```

#### Order Routed to Kitchen
```javascript
socket.on('order:routed', ({ order, targetStation }) => {
  console.log(`Order routed to: ${targetStation}`);
});
```

---

## 💡 Best Practices

### 1. Always Access Data via `.data`
```typescript
// ✅ Correct
const response = await api.get('/venues');
const venues = response.data;

// ❌ Wrong
const venues = await api.get('/venues');
```

### 2. Use Message Codes for i18n
```typescript
// ✅ Correct
const response = await api.post('/orders', data);
toast.success(t(response.messageCode)); // Translated message

// ❌ Wrong
toast.success(response.message); // Hardcoded English
```

### 3. Handle Errors Properly
```typescript
try {
  const response = await api.post('/orders', orderData);
  toast.success(t(response.messageCode));
} catch (error) {
  const { messageCode, errorMessage } = error.response.data;
  toast.error(t(messageCode) || errorMessage);
}
```

### 4. Store Tokens Securely
```typescript
// Use httpOnly cookies or secure storage
localStorage.setItem('accessToken', token); // ❌ Not secure
// Better: Use httpOnly cookies or encrypted storage
```

### 5. Implement Token Refresh
```typescript
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Try to refresh token
      const newToken = await refreshAccessToken();
      // Retry original request
      return axios(error.config);
    }
    return Promise.reject(error);
  }
);
```

---

## 📞 Support

Nếu có vấn đề:
- Check Swagger docs: `http://localhost:3000/api`
- Review error `messageCode` để biết chính xác lỗi gì
- Contact backend team với error details

---

**Happy Coding! 🚀**
