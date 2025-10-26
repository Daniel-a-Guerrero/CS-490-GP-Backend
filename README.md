# Salon Platform API

A production-ready Flask REST API for managing **salons, staff, services, appointments, carts/orders, payments, loyalty, and notifications.**  
This project uses **Flask**, **SQLAlchemy**, **JWT Authentication**, and **MySQL**.

---

## Run the Code

- At first create the database in you system using MySQL Workbench
- Not your Host ID, Password and PORT
- Then Create the '.env' file by following the below instructions
- Run the code using the command: 'python app.py'

## ⚙️ Environment Configuration (.env)

### App

APP_ENV=development

APP_DEBUG=true

APP_HOST=0.0.0.0

APP_PORT=5000

### Database

DB_USER=root

DB_PASSWORD = Add your MySQL Password here

DB_HOST=127.0.0.1

DB_PORT=3306 (CHange accoridng to your PORT number)

DB_NAME=salon_platform

### SQLAlchemy options

SQLALCHEMY_ECHO=false

SQLALCHEMY_POOL_SIZE=10

SQLALCHEMY_MAX_OVERFLOW=20

SQLALCHEMY_POOL_TIMEOUT=30

### JWT

JWT_SECRET_KEY= Generate and add HS256 Secret Key

- You may run the below code for JWT_SECRET_KEY

```
import secrets, base64
key_bytes = secrets.token_bytes(32)
key_base64 = base64.urlsafe_b64encode(key_bytes).decode('utf-8')
print(key_base64)
```

JWT_ALGORITHM=HS256

JWT_ACCESS_TOKEN_EXPIRES_HOURS=8

### Security

BCRYPT_ROUNDS=12

### CORS

CORS_ALLOW_ORIGINS=\*

---
