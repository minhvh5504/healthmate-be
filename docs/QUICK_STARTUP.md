# 🚀 OMMS Backend - Hướng Dẫn Khởi Động Nhanh Cho Team Frontend

Tài liệu này hướng dẫn team Frontend cách chạy OMMS Backend trên máy local để tích hợp với Frontend, **KHÔNG CẦN** cài đặt Node.js, PostgreSQL hay bất kỳ công cụ phát triển nào khác.

## 📋 Yêu Cầu Hệ Thống

### Chỉ cần cài đặt Docker Desktop:

- **Windows**: [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)
- **Mac**: [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop)
- **Linux**: [Docker Engine](https://docs.docker.com/engine/install/) + [Docker Compose](https://docs.docker.com/compose/install/)

### Yêu cầu phần cứng tối thiểu:
- RAM: 4GB (khuyến nghị 8GB)
- Ổ cứng trống: 5GB
- CPU: 2 cores

---

## 🎯 Cách Sử Dụng (Siêu Đơn Giản!)

### Bước 1: Cài đặt Docker Desktop

1. Tải và cài đặt Docker Desktop từ link ở trên
2. Mở Docker Desktop và đợi nó khởi động hoàn toàn
3. Kiểm tra Docker đã chạy chưa: mở Terminal/Command Prompt và gõ:
   ```bash
   docker --version
   ```
   Nếu hiện ra version của Docker là OK!

### Bước 2: Giải nén và chạy Backend

1. **Giải nén** folder backend mà team BE gửi cho bạn
2. **Mở Terminal/Command Prompt** tại folder backend:
   - **Windows**: Click phải vào folder → chọn "Open in Terminal" hoặc "Git Bash Here"
   - **Mac/Linux**: Click phải vào folder → chọn "New Terminal at Folder"

3. **Chạy script khởi động**:

   #### 🪟 Trên Windows:
   ```bash
   quick-startup.bat
   ```
   
   #### 🍎 Trên Mac/Linux:
   ```bash
   chmod +x quick-startup.sh
   ./quick-startup.sh
   ```

4. **Đợi khoảng 2-5 phút** để Docker tải và khởi động các services lần đầu tiên

5. **Xong!** Backend đã sẵn sàng tại: `http://localhost:8080`

---

## 🌐 Các Endpoint Quan Trọng

Sau khi chạy thành công, bạn có thể truy cập:

| Service | URL | Mô tả |
|---------|-----|-------|
| **Backend API** | `http://localhost:8080` | API chính để gọi từ Frontend |
| **API Documentation** | `http://localhost:8080/api` | Swagger UI - xem tất cả API endpoints |
| **Database** | `localhost:5432` | PostgreSQL (nếu cần kết nối trực tiếp) |

### 📚 Xem API Documentation

Mở trình duyệt và truy cập: `http://localhost:8080/api`

Tại đây bạn sẽ thấy:
- ✅ Tất cả API endpoints có sẵn
- ✅ Cách gọi API (method, parameters, body)
- ✅ Response examples
- ✅ Có thể test API trực tiếp trên Swagger UI

---

## 🔧 Các Lệnh Hữu Ích

### Xem logs của Backend:
```bash
docker-compose logs -f backend
```

### Xem logs của Database:
```bash
docker-compose logs -f postgres
```

### Dừng tất cả services:
```bash
docker-compose down
```

### Khởi động lại services:
```bash
docker-compose restart
```

### Xóa hoàn toàn và khởi động lại từ đầu:
```bash
docker-compose down -v
docker-compose up --build -d
```

### Kiểm tra trạng thái services:
```bash
docker-compose ps
```

---

## 🐛 Xử Lý Sự Cố Thường Gặp

### ❌ Lỗi: "Docker daemon is not running"
**Giải pháp**: Mở Docker Desktop và đợi nó khởi động hoàn toàn

### ❌ Lỗi: "Port 8080 is already in use"
**Giải pháp**: 
1. Tắt ứng dụng đang dùng port 8080
2. Hoặc sửa file `docker-compose.yml`, dòng `ports: - "8080:8080"` thành `ports: - "8081:8080"` (thay 8080 đầu tiên thành port khác)

### ❌ Lỗi: "Port 5432 is already in use"
**Giải pháp**: 
1. Tắt PostgreSQL nếu đang chạy trên máy
2. Hoặc sửa file `docker-compose.yml`, dòng `ports: - "5432:5432"` thành `ports: - "5433:5432"`

### ❌ Backend không kết nối được với Database
**Giải pháp**:
```bash
# Dừng tất cả
docker-compose down -v

# Khởi động lại
docker-compose up --build -d

# Xem logs để kiểm tra
docker-compose logs -f
```

### ❌ Lỗi CORS khi gọi API từ Frontend
**Giải pháp**: 
1. Mở file `docker-compose.yml`
2. Tìm dòng `FRONTEND_URL: http://localhost:3000`
3. Thay đổi thành URL của Frontend của bạn (ví dụ: `http://localhost:5173` nếu dùng Vite)
4. Khởi động lại: `docker-compose restart backend`

### ❌ Không thấy dữ liệu trong Database
**Giải pháp**: Database mới sẽ trống, cần:
1. Đăng ký tài khoản mới qua API `/auth/register`
2. Hoặc yêu cầu team BE cung cấp file seed data

---

## 🔐 Thông Tin Đăng Nhập Database (Nếu Cần)

Nếu bạn muốn kết nối trực tiếp vào database bằng tool như DBeaver, pgAdmin:

```
Host: localhost
Port: 5432
Database: omms_db
Username: omms_user
Password: omms_password_2026
```

---

## 📝 Cấu Hình Môi Trường (Environment Variables)

Các biến môi trường quan trọng đã được cấu hình sẵn trong `docker-compose.yml`:

| Biến | Giá trị mặc định | Mô tả |
|------|------------------|-------|
| `PORT` | 8080 | Port của Backend API |
| `FRONTEND_URL` | http://localhost:3000 | URL của Frontend (cho CORS) |
| `DATABASE_URL` | postgresql://... | Connection string tới PostgreSQL |
| `JWT_SECRET` | omms_dev_jwt_secret... | Secret key cho JWT (dev only) |

**⚠️ Lưu ý**: Các giá trị này chỉ dùng cho development. Production sẽ dùng giá trị khác.

---

## 🔄 Workflow Làm Việc Hàng Ngày

### Khi bắt đầu làm việc:
```bash
# Chạy script khởi động
./quick-startup.sh        # Mac/Linux
quick-startup.bat         # Windows
```

### Trong khi làm việc:
- Backend sẽ chạy ở background
- Gọi API từ Frontend như bình thường
- Xem Swagger UI nếu cần tham khảo API: `http://localhost:8080/api`

### Khi kết thúc làm việc:
```bash
# Dừng services (nhưng giữ lại data)
docker-compose stop

# Hoặc dừng và xóa containers (giữ lại data trong volumes)
docker-compose down
```

---

## 📞 Liên Hệ Hỗ Trợ

Nếu gặp vấn đề không giải quyết được:

1. **Chụp screenshot** lỗi
2. **Copy logs** bằng lệnh: `docker-compose logs > logs.txt`
3. **Liên hệ team Backend** và gửi kèm screenshot + logs

---

## 🎓 Tài Liệu Bổ Sung

- [Docker Desktop Documentation](https://docs.docker.com/desktop/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Swagger UI Guide](https://swagger.io/tools/swagger-ui/)

---

## ✅ Checklist Trước Khi Bắt Đầu

- [ ] Đã cài đặt Docker Desktop
- [ ] Docker Desktop đang chạy
- [ ] Đã giải nén folder backend
- [ ] Đã chạy script `quick-startup.sh` hoặc `quick-startup.bat`
- [ ] Truy cập được `http://localhost:8080/api` và thấy Swagger UI
- [ ] Đã đọc phần API Documentation trên Swagger
- [ ] Đã test gọi 1 API đơn giản (ví dụ: health check)

---

## 🎉 Chúc Bạn Code Vui Vẻ!

Nếu mọi thứ chạy OK, bạn đã sẵn sàng tích hợp Frontend với Backend! 🚀

**Happy Coding!** 💻✨
