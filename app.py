# app.py Complete Salon Platform Backend
import os
from datetime import datetime, timedelta, date, time
from functools import wraps
from decimal import Decimal

from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_bcrypt import Bcrypt
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    get_jwt_identity,
    jwt_required,
)
from dotenv import load_dotenv
from flask_cors import CORS
from sqlalchemy import func, and_, or_
from werkzeug.utils import secure_filename
import uuid

# --- Load environment ---
load_dotenv()

DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME", "salon_platform")

DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# --- App and Config ---
app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_ECHO"] = os.getenv("SQLALCHEMY_ECHO", "false").lower() == "true"
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_size": int(os.getenv("SQLALCHEMY_POOL_SIZE", "10")),
    "max_overflow": int(os.getenv("SQLALCHEMY_MAX_OVERFLOW", "20")),
    "pool_timeout": int(os.getenv("SQLALCHEMY_POOL_TIMEOUT", "30")),
}

app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "change-me-in-production")
app.config["JWT_ALGORITHM"] = os.getenv("JWT_ALGORITHM", "HS256")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(
    hours=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_HOURS", "8"))
)

# File upload config
app.config["UPLOAD_FOLDER"] = os.getenv("UPLOAD_FOLDER", "./uploads")
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16MB max file size
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}

CORS(app, resources={r"/*": {"origins": os.getenv("CORS_ALLOW_ORIGINS", "*")}})

# --- Extensions ---
db = SQLAlchemy(app)
migrate = Migrate(app, db)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

# Create upload folder if it doesn't exist
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)


# ==================== MODELS ====================
class User(db.Model):
    __tablename__ = "users"
    user_id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    profile_pic = db.Column(db.String(255))
    user_role = db.Column(
        db.Enum("customer", "staff", "owner", "admin"), nullable=False
    )
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class Role(db.Model):
    __tablename__ = "roles"
    role_id = db.Column(db.Integer, primary_key=True)
    role_name = db.Column(
        db.Enum("customer", "staff", "owner", "admin"), unique=True, nullable=False
    )


class UserRole(db.Model):
    __tablename__ = "user_roles"
    user_role_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey("roles.role_id"), nullable=False)


class Auth(db.Model):
    __tablename__ = "auth"
    auth_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    last_login = db.Column(db.DateTime)
    login_count = db.Column(db.Integer, default=0)


class Salon(db.Model):
    __tablename__ = "salons"
    salon_id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    address = db.Column(db.Text)
    description = db.Column(db.Text)
    status = db.Column(db.Enum("pending", "active", "blocked"), default="pending")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class SalonSettings(db.Model):
    __tablename__ = "salon_settings"
    setting_id = db.Column(db.Integer, primary_key=True)
    salon_id = db.Column(db.Integer, db.ForeignKey("salons.salon_id"), nullable=False)
    timezone = db.Column(db.String(50), default="UTC")
    tax_rate = db.Column(db.Numeric(5, 2), default=0)
    cancellation_policy = db.Column(db.Text)
    auto_complete_after = db.Column(db.Integer, default=24)


class Staff(db.Model):
    __tablename__ = "staff"
    staff_id = db.Column(db.Integer, primary_key=True)
    salon_id = db.Column(db.Integer, db.ForeignKey("salons.salon_id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=False)
    role = db.Column(db.String(50))
    specialization = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)


class StaffAvailability(db.Model):
    __tablename__ = "staff_availability"
    availability_id = db.Column(db.Integer, primary_key=True)
    staff_id = db.Column(db.Integer, db.ForeignKey("staff.staff_id"), nullable=False)
    day_of_week = db.Column(
        db.Enum(
            "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
        )
    )
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    is_available = db.Column(db.Boolean, default=True)


class ServiceCategory(db.Model):
    __tablename__ = "service_categories"
    category_id = db.Column(db.Integer, primary_key=True)
    main_category_id = db.Column(db.Integer)
    salon_id = db.Column(db.Integer, db.ForeignKey("salons.salon_id"))
    name = db.Column(db.String(100), nullable=False)


class Service(db.Model):
    __tablename__ = "services"
    service_id = db.Column(db.Integer, primary_key=True)
    salon_id = db.Column(db.Integer, db.ForeignKey("salons.salon_id"), nullable=False)
    category_id = db.Column(
        db.Integer, db.ForeignKey("service_categories.category_id"), nullable=False
    )
    custom_name = db.Column(db.String(100))
    duration = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    description = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)


class StaffService(db.Model):
    __tablename__ = "staff_service"
    staff_service_id = db.Column(db.Integer, primary_key=True)
    staff_id = db.Column(db.Integer, db.ForeignKey("staff.staff_id"), nullable=False)
    service_id = db.Column(
        db.Integer, db.ForeignKey("services.service_id"), nullable=False
    )


class Appointment(db.Model):
    __tablename__ = "appointments"
    appointment_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=False)
    salon_id = db.Column(db.Integer, db.ForeignKey("salons.salon_id"), nullable=False)
    staff_id = db.Column(db.Integer, db.ForeignKey("staff.staff_id"))
    service_id = db.Column(
        db.Integer, db.ForeignKey("services.service_id"), nullable=False
    )
    scheduled_time = db.Column(db.DateTime, nullable=False)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    status = db.Column(
        db.Enum("booked", "completed", "cancelled", "no_show"), default="booked"
    )
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class AppointmentService(db.Model):
    __tablename__ = "appointment_services"
    id = db.Column(db.Integer, primary_key=True)
    appointment_id = db.Column(
        db.Integer, db.ForeignKey("appointments.appointment_id"), nullable=False
    )
    service_id = db.Column(
        db.Integer, db.ForeignKey("services.service_id"), nullable=False
    )
    duration = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Numeric(10, 2), nullable=False)


class Product(db.Model):
    __tablename__ = "products"
    product_id = db.Column(db.Integer, primary_key=True)
    salon_id = db.Column(db.Integer, db.ForeignKey("salons.salon_id"), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.Enum("Hair", "Skin", "Nails", "Other"))
    description = db.Column(db.Text)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    stock = db.Column(db.Integer, default=0)
    sku = db.Column(db.String(50))
    is_active = db.Column(db.Boolean, default=True)


class Cart(db.Model):
    __tablename__ = "carts"
    cart_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=False)
    salon_id = db.Column(db.Integer, db.ForeignKey("salons.salon_id"), nullable=False)
    status = db.Column(db.Enum("active", "checked_out", "abandoned"), default="active")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class CartItem(db.Model):
    __tablename__ = "cart_items"
    item_id = db.Column(db.Integer, primary_key=True)
    cart_id = db.Column(db.Integer, db.ForeignKey("carts.cart_id"), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey("products.product_id"))
    service_id = db.Column(db.Integer, db.ForeignKey("services.service_id"))
    quantity = db.Column(db.Integer, default=1)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    type = db.Column(db.Enum("product", "service"), nullable=False)


class Payment(db.Model):
    __tablename__ = "payments"
    payment_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    payment_method = db.Column(db.Enum("card", "paypal", "cash", "wallet"))
    payment_status = db.Column(
        db.Enum("pending", "completed", "failed", "refunded"), default="pending"
    )
    transaction_ref = db.Column(db.String(100))
    card_id = db.Column(db.Integer)
    appointment_id = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Order(db.Model):
    __tablename__ = "orders"
    order_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=False)
    salon_id = db.Column(db.Integer, db.ForeignKey("salons.salon_id"), nullable=False)
    total_amount = db.Column(db.Numeric(10, 2), nullable=False)
    payment_id = db.Column(db.Integer, db.ForeignKey("payments.payment_id"))
    payment_status = db.Column(
        db.Enum("pending", "paid", "failed", "refunded"), default="pending"
    )
    order_status = db.Column(
        db.Enum("processing", "completed", "cancelled"), default="processing"
    )
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class OrderItem(db.Model):
    __tablename__ = "order_items"
    order_item_id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey("orders.order_id"), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey("products.product_id"))
    service_id = db.Column(db.Integer, db.ForeignKey("services.service_id"))
    quantity = db.Column(db.Integer, default=1)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    type = db.Column(db.Enum("product", "service"), nullable=False)


class Loyalty(db.Model):
    __tablename__ = "loyalty"
    loyalty_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=False)
    salon_id = db.Column(db.Integer, db.ForeignKey("salons.salon_id"), nullable=False)
    points = db.Column(db.Integer, default=0)
    lifetime_points = db.Column(db.Integer, default=0)
    last_earned = db.Column(db.DateTime)


class Review(db.Model):
    __tablename__ = "reviews"
    review_id = db.Column(db.Integer, primary_key=True)
    appointment_id = db.Column(
        db.Integer, db.ForeignKey("appointments.appointment_id"), nullable=False
    )
    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=False)
    salon_id = db.Column(db.Integer, db.ForeignKey("salons.salon_id"), nullable=False)
    staff_id = db.Column(db.Integer, db.ForeignKey("staff.staff_id"))
    rating = db.Column(db.Integer, nullable=False)
    comment = db.Column(db.Text)
    response = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    responded_at = db.Column(db.DateTime)


class Notification(db.Model):
    __tablename__ = "notifications"
    notification_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=False)
    type = db.Column(
        db.Enum("reminder", "promotion", "status_update", "discount"), nullable=False
    )
    # title = db.Column(db.String(200))
    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    sent_at = db.Column(db.DateTime, default=datetime.utcnow)
    scheduled_for = db.Column(db.DateTime)


class Promotion(db.Model):
    __tablename__ = "promotions"
    promotion_id = db.Column(db.Integer, primary_key=True)
    salon_id = db.Column(db.Integer, db.ForeignKey("salons.salon_id"), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    discount_percent = db.Column(db.Numeric(5, 2))
    valid_from = db.Column(db.DateTime, nullable=False)
    valid_until = db.Column(db.DateTime, nullable=False)
    is_active = db.Column(db.Boolean, default=True)


# ==================== HELPER FUNCTIONS ====================


def json_required():
    """Validate JSON content type"""
    if not request.is_json:
        return jsonify(error="Content-Type must be application/json"), 415
    return None


def require_roles(*roles):
    """Decorator to enforce role-based access"""

    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            uid = int(get_jwt_identity())
            user = User.query.get(uid)
            if not user or user.user_role not in roles:
                return jsonify(error="Forbidden: Insufficient permissions"), 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def allowed_file(filename):
    """Check if file extension is allowed"""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def get_user_salon(user_id):
    """Get salon owned by user"""
    return Salon.query.filter_by(owner_id=user_id).first()


def award_loyalty_points(user_id, salon_id, amount):
    """Award loyalty points based on purchase amount"""
    settings = SalonSettings.query.filter_by(salon_id=salon_id).first()
    points_per_dollar = settings.loyalty_points_per_dollar if settings else 1

    points_earned = int(float(amount) * points_per_dollar)

    loyalty = Loyalty.query.filter_by(user_id=user_id, salon_id=salon_id).first()
    if not loyalty:
        loyalty = Loyalty(
            user_id=user_id, salon_id=salon_id, points=0, lifetime_points=0
        )
        db.session.add(loyalty)

    loyalty.points += points_earned
    loyalty.lifetime_points += points_earned
    loyalty.last_earned = datetime.utcnow()

    return points_earned


def send_notification(user_id, notification_type, message, scheduled_for=None):
    """Create a notification for a user"""
    notification = Notification(
        user_id=user_id,
        type=notification_type,
        message=message,
        scheduled_for=scheduled_for,
    )
    db.session.add(notification)
    db.session.commit()
    return notification


# ==================== AUTHENTICATION ENDPOINTS ====================


@app.get("/health")
def health():
    """Health check endpoint"""
    return jsonify(status="ok", timestamp=datetime.utcnow().isoformat())


@app.post("/auth/signup")
def signup():
    """User registration - Criteria: Auth #1"""
    err = json_required()
    if err:
        return err

    data = request.get_json()
    required_fields = ("full_name", "phone", "email", "password", "user_role")

    for field in required_fields:
        if field not in data:
            return jsonify(error=f"Missing required field: {field}"), 400

    # Validate email uniqueness
    if User.query.filter_by(email=data["email"]).first():
        return jsonify(error="Email already registered"), 409

    # Validate phone uniqueness
    if User.query.filter_by(phone=data["phone"]).first():
        return jsonify(error="Phone number already registered"), 409

    # Validate role
    if data["user_role"] not in ["customer", "staff", "owner", "admin"]:
        return jsonify(error="Invalid user role"), 400

    # Hash password
    pw_hash = bcrypt.generate_password_hash(data["password"]).decode()

    # Create user
    user = User(
        full_name=data["full_name"],
        phone=data["phone"],
        email=data["email"],
        user_role=data["user_role"],
        profile_pic=data.get("profile_pic"),
    )
    db.session.add(user)
    db.session.flush()

    # Create auth record
    auth = Auth(user_id=user.user_id, email=user.email, password_hash=pw_hash)
    db.session.add(auth)

    # Assign role
    role = Role.query.filter_by(role_name=user.user_role).first()
    if role:
        db.session.add(UserRole(user_id=user.user_id, role_id=role.role_id))

    db.session.commit()

    return (
        jsonify(
            message="User created successfully",
            user_id=user.user_id,
            email=user.email,
            role=user.user_role,
        ),
        201,
    )


@app.post("/auth/login")
def login():
    """User login - Criteria: Auth #2"""
    err = json_required()
    if err:
        return err

    data = request.get_json()

    if not data.get("email") or not data.get("password"):
        return jsonify(error="Email and password required"), 400

    auth = Auth.query.filter_by(email=data["email"]).first()
    if not auth or not bcrypt.check_password_hash(auth.password_hash, data["password"]):
        return jsonify(error="Invalid credentials"), 401

    # Get user details
    user = User.query.get(auth.user_id)

    # Create JWT token
    token = create_access_token(identity=str(auth.user_id))

    # Update login stats
    auth.last_login = datetime.utcnow()
    auth.login_count = (auth.login_count or 0) + 1
    db.session.commit()

    # Check if user is staff
    staff_record = Staff.query.filter_by(user_id=auth.user_id, is_active=True).first()

    return (
        jsonify(
            access_token=token,
            user_id=auth.user_id,
            email=user.email,
            full_name=user.full_name,
            role=user.user_role,
            staff_id=staff_record.staff_id if staff_record else None,
        ),
        200,
    )


@app.get("/auth/me")
@jwt_required()
def get_current_user():
    """Get current user profile"""
    uid = int(get_jwt_identity())
    user = User.query.get_or_404(uid)

    return jsonify(
        user_id=user.user_id,
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        role=user.user_role,
        profile_pic=user.profile_pic,
        created_at=user.created_at.isoformat() if user.created_at else None,
    )


# ==================== SALON MANAGEMENT ====================


@app.get("/salons")
def list_salons():
    """Browse available salons - Criteria: Auth #5"""
    status_filter = request.args.get("status", "active")

    query = Salon.query
    if status_filter:
        query = query.filter_by(status=status_filter)

    salons = query.all()

    result = []
    for s in salons:
        owner = User.query.get(s.owner_id)
        result.append(
            {
                "salon_id": s.salon_id,
                "name": s.name,
                "address": s.address,
                "description": s.description,
                "status": s.status,
                "owner_name": owner.full_name if owner else None,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
        )

    return jsonify(salons=result, count=len(result))


@app.post("/salons")
@require_roles("owner")
def create_salon():
    """Register salon - Criteria: Auth #3"""
    err = json_required()
    if err:
        return err

    uid = int(get_jwt_identity())
    data = request.get_json()

    if "name" not in data:
        return jsonify(error="Salon name is required"), 400

    salon = Salon(
        owner_id=uid,
        name=data["name"],
        address=data.get("address"),
        description=data.get("description"),
        status="pending",
    )
    db.session.add(salon)
    db.session.flush()

    # Create default settings
    settings = SalonSettings(
        salon_id=salon.salon_id,
        timezone=data.get("timezone", "UTC"),
        tax_rate=data.get("tax_rate", 0),
        # loyalty_points_per_dollar=data.get("loyalty_points_per_dollar", 1),
        # loyalty_redemption_rate=data.get("loyalty_redemption_rate", 0.01),
    )
    db.session.add(settings)
    db.session.commit()

    return (
        jsonify(
            salon_id=salon.salon_id,
            name=salon.name,
            status=salon.status,
            message="Salon registered. Awaiting admin approval.",
        ),
        201,
    )


@app.patch("/salons/<int:salon_id>/approve")
@require_roles("admin")
def approve_salon(salon_id):
    """Admin approve salon - Criteria: Auth #4"""
    salon = Salon.query.get_or_404(salon_id)

    data = request.get_json() or {}
    new_status = data.get("status", "active")

    if new_status not in ["active", "blocked"]:
        return jsonify(error="Status must be 'active' or 'blocked'"), 400

    salon.status = new_status
    db.session.commit()

    # Notify owner
    # send_notification(
    #     user_id=salon.owner_id,
    #     notification_type="status_update",
    #     message=f"Your salon '{salon.name}' has been {new_status}.",
    # )

    return jsonify(
        message=f"Salon {new_status}", salon_id=salon.salon_id, status=salon.status
    )


@app.get("/salons/<int:salon_id>")
def get_salon(salon_id):
    """Get salon details"""
    salon = Salon.query.get_or_404(salon_id)
    settings = SalonSettings.query.filter_by(salon_id=salon_id).first()

    return jsonify(
        salon_id=salon.salon_id,
        name=salon.name,
        address=salon.address,
        description=salon.description,
        status=salon.status,
        settings={
            "timezone": settings.timezone if settings else "UTC",
            "tax_rate": float(settings.tax_rate) if settings else 0,
            "cancellation_policy": settings.cancellation_policy if settings else None,
        },
    )


@app.patch("/salons/<int:salon_id>/settings")
@require_roles("owner")
def update_salon_settings(salon_id):
    """Configure loyalty rewards - Criteria: Loyalty #6"""
    uid = int(get_jwt_identity())
    salon = Salon.query.get_or_404(salon_id)

    if salon.owner_id != uid:
        return jsonify(error="Not your salon"), 403

    data = request.get_json()
    settings = SalonSettings.query.filter_by(salon_id=salon_id).first()

    if not settings:
        settings = SalonSettings(salon_id=salon_id)
        db.session.add(settings)

    if "timezone" in data:
        settings.timezone = data["timezone"]
    if "tax_rate" in data:
        settings.tax_rate = data["tax_rate"]
    if "cancellation_policy" in data:
        settings.cancellation_policy = data["cancellation_policy"]
    if "loyalty_points_per_dollar" in data:
        settings.loyalty_points_per_dollar = int(data["loyalty_points_per_dollar"])
    if "loyalty_redemption_rate" in data:
        settings.loyalty_redemption_rate = data["loyalty_redemption_rate"]

    db.session.commit()

    return jsonify(message="Settings updated successfully")


# ==================== STAFF MANAGEMENT ====================


@app.get("/salons/<int:salon_id>/staff")
def list_staff(salon_id):
    """View available barbers - Criteria: Booking #1"""
    staff_list = Staff.query.filter_by(salon_id=salon_id, is_active=True).all()

    result = []
    for st in staff_list:
        user = User.query.get(st.user_id)
        result.append(
            {
                "staff_id": st.staff_id,
                "user_id": st.user_id,
                "name": user.full_name if user else "Unknown",
                "role": st.role,
                "specialization": st.specialization,
                "is_active": st.is_active,
            }
        )

    return jsonify(staff=result, count=len(result))


@app.post("/salons/<int:salon_id>/staff")
@require_roles("owner")
def add_staff(salon_id):
    """Add staff member to salon"""
    uid = int(get_jwt_identity())
    salon = Salon.query.get_or_404(salon_id)

    if salon.owner_id != uid:
        return jsonify(error="Not your salon"), 403

    data = request.get_json()

    if "user_id" not in data:
        return jsonify(error="user_id required"), 400

    # Check if user exists
    user = User.query.get(data["user_id"])
    if not user:
        return jsonify(error="User not found"), 404

    # Check if already staff
    existing = Staff.query.filter_by(salon_id=salon_id, user_id=data["user_id"]).first()
    if existing:
        return jsonify(error="User is already staff at this salon"), 409

    staff = Staff(
        salon_id=salon_id,
        user_id=data["user_id"],
        role=data.get("role", "barber"),
        specialization=data.get("specialization"),
        is_active=True,
    )
    db.session.add(staff)
    db.session.commit()

    return jsonify(staff_id=staff.staff_id, message="Staff added successfully"), 201


@app.patch("/staff/<int:staff_id>/assign")
@require_roles("owner")
def assign_staff_to_salon(staff_id):
    """Assign existing staff to salon"""
    uid = int(get_jwt_identity())
    data = request.get_json()

    if not data or "salon_id" not in data:
        return jsonify(error="salon_id is required"), 400

    salon_id = data["salon_id"]

    # Verify salon ownership
    salon = Salon.query.filter_by(salon_id=salon_id, owner_id=uid).first()
    if not salon:
        return jsonify(error="You do not own this salon"), 403

    # Get staff
    staff = Staff.query.get_or_404(staff_id)

    # Assign to salon
    staff.salon_id = salon_id
    staff.is_active = True
    db.session.commit()

    return jsonify(
        message=f"Staff assigned to {salon.name}",
        staff_id=staff.staff_id,
        salon_id=salon.salon_id,
    )


@app.get("/staff/<int:staff_id>/availability")
def staff_availability(staff_id):
    """View staff availability - Criteria: Booking #1"""
    slots = StaffAvailability.query.filter_by(
        staff_id=staff_id, is_available=True
    ).all()

    return jsonify(
        staff_id=staff_id,
        availability=[
            {
                "availability_id": s.availability_id,
                "day": s.day_of_week,
                "start_time": s.start_time.isoformat(),
                "end_time": s.end_time.isoformat(),
                "is_available": s.is_available,
            }
            for s in slots
        ],
    )


@app.post("/staff/<int:staff_id>/availability")
@require_roles("staff", "owner")
def add_staff_availability(staff_id):
    """Add availability slot"""
    uid = int(get_jwt_identity())
    staff = Staff.query.get_or_404(staff_id)

    # Verify authorization
    if staff.user_id != uid:
        salon = Salon.query.get(staff.salon_id)
        if not salon or salon.owner_id != uid:
            return jsonify(error="Unauthorized"), 403

    data = request.get_json()
    required = ["day_of_week", "start_time", "end_time"]

    for field in required:
        if field not in data:
            return jsonify(error=f"Missing {field}"), 400

    try:
        start = datetime.strptime(data["start_time"], "%H:%M").time()
        end = datetime.strptime(data["end_time"], "%H:%M").time()
    except ValueError:
        return jsonify(error="Time format must be HH:MM"), 400

    availability = StaffAvailability(
        staff_id=staff_id,
        day_of_week=data["day_of_week"],
        start_time=start,
        end_time=end,
        is_available=data.get("is_available", True),
    )
    db.session.add(availability)
    db.session.commit()

    return (
        jsonify(
            availability_id=availability.availability_id, message="Availability added"
        ),
        201,
    )


@app.patch("/staff/availability/<int:availability_id>")
@require_roles("staff", "owner")
def update_staff_availability(availability_id):
    """Block/unblock time slots - Criteria: Booking #5"""
    uid = int(get_jwt_identity())
    availability = StaffAvailability.query.get_or_404(availability_id)
    staff = Staff.query.get(availability.staff_id)

    # Verify authorization
    if staff.user_id != uid:
        salon = Salon.query.get(staff.salon_id)
        if not salon or salon.owner_id != uid:
            return jsonify(error="Unauthorized"), 403

    data = request.get_json()

    if "is_available" in data:
        availability.is_available = data["is_available"]

    if "start_time" in data:
        try:
            availability.start_time = datetime.strptime(
                data["start_time"], "%H:%M"
            ).time()
        except ValueError:
            return jsonify(error="Invalid start_time format"), 400

    if "end_time" in data:
        try:
            availability.end_time = datetime.strptime(data["end_time"], "%H:%M").time()
        except ValueError:
            return jsonify(error="Invalid end_time format"), 400

    db.session.commit()

    return jsonify(message="Availability updated")


@app.get("/staff/<int:staff_id>/appointments")
@require_roles("staff", "owner")
def staff_schedule(staff_id):
    """View barber daily schedule - Criteria: Booking #4"""
    uid = int(get_jwt_identity())
    staff = Staff.query.get_or_404(staff_id)

    # Verify authorization
    if staff.user_id != uid:
        salon = Salon.query.get(staff.salon_id)
        if not salon or salon.owner_id != uid:
            return jsonify(error="Unauthorized"), 403

    # Get date filter
    date_str = request.args.get("date")
    if date_str:
        try:
            filter_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return jsonify(error="Date format must be YYYY-MM-DD"), 400
    else:
        filter_date = date.today()

    # Query appointments
    start_of_day = datetime.combine(filter_date, time.min)
    end_of_day = datetime.combine(filter_date, time.max)

    appointments = (
        Appointment.query.filter(
            and_(
                Appointment.staff_id == staff_id,
                Appointment.scheduled_time >= start_of_day,
                Appointment.scheduled_time <= end_of_day,
                Appointment.status.in_(["booked", "completed"]),
            )
        )
        .order_by(Appointment.scheduled_time)
        .all()
    )

    result = []
    for appt in appointments:
        user = User.query.get(appt.user_id)
        service = Service.query.get(appt.service_id)
        result.append(
            {
                "appointment_id": appt.appointment_id,
                "customer_name": user.full_name if user else "Unknown",
                "service_name": service.custom_name if service else "Unknown",
                "scheduled_time": appt.scheduled_time.isoformat(),
                "duration": service.duration if service else 0,
                "price": float(appt.price),
                "status": appt.status,
                "notes": appt.notes,
            }
        )

    return jsonify(
        date=filter_date.isoformat(),
        staff_id=staff_id,
        appointments=result,
        count=len(result),
    )


# ==================== SERVICES ====================


@app.get("/salons/<int:salon_id>/services")
def list_services(salon_id):
    """List salon services"""
    services = Service.query.filter_by(salon_id=salon_id, is_active=True).all()

    result = []
    for sv in services:
        category = ServiceCategory.query.get(sv.category_id)
        result.append(
            {
                "service_id": sv.service_id,
                "name": sv.custom_name,
                "category": category.name if category else None,
                "duration": sv.duration,
                "price": float(sv.price),
                "description": sv.description,
            }
        )

    return jsonify(services=result, count=len(result))


@app.post("/salons/<int:salon_id>/services")
@require_roles("owner")
def create_service(salon_id):
    """Create new service"""
    uid = int(get_jwt_identity())
    salon = Salon.query.get_or_404(salon_id)

    if salon.owner_id != uid:
        return jsonify(error="Not your salon"), 403

    data = request.get_json()
    required = ["custom_name", "category_id", "duration", "price"]

    for field in required:
        if field not in data:
            return jsonify(error=f"Missing {field}"), 400

    service = Service(
        salon_id=salon_id,
        category_id=data["category_id"],
        custom_name=data["custom_name"],
        duration=int(data["duration"]),
        price=Decimal(str(data["price"])),
        description=data.get("description"),
        is_active=data.get("is_active", True),
    )
    db.session.add(service)
    db.session.commit()

    return jsonify(service_id=service.service_id, message="Service created"), 201


# ==================== PRODUCTS (SHOP) ====================


@app.get("/salons/<int:salon_id>/products")
def list_products(salon_id):
    """List salon products - Criteria: Shopping #1"""
    products = Product.query.filter_by(salon_id=salon_id, is_active=True).all()

    return jsonify(
        products=[
            {
                "product_id": p.product_id,
                "name": p.name,
                "category": p.category,
                "description": p.description,
                "price": float(p.price),
                "stock": p.stock,
                "sku": p.sku,
            }
            for p in products
        ],
        count=len(products),
    )


@app.post("/salons/<int:salon_id>/products")
@require_roles("owner")
def create_product(salon_id):
    """Create product for salon shop"""
    uid = int(get_jwt_identity())
    salon = Salon.query.get_or_404(salon_id)

    if salon.owner_id != uid:
        return jsonify(error="Not your salon"), 403

    data = request.get_json()
    required = ["name", "price"]

    for field in required:
        if field not in data:
            return jsonify(error=f"Missing {field}"), 400

    product = Product(
        salon_id=salon_id,
        name=data["name"],
        category=data.get("category", "Other"),
        description=data.get("description"),
        price=Decimal(str(data["price"])),
        stock=int(data.get("stock", 0)),
        sku=data.get("sku"),
        is_active=data.get("is_active", True),
    )
    db.session.add(product)
    db.session.commit()

    return jsonify(product_id=product.product_id, message="Product created"), 201


# ==================== APPOINTMENTS ====================

# @app.post("/appointments")
# @jwt_required()
# def book_appointment():
#     """Book appointment"""
#     err = json_required()
#     if err:
#         return err

#     uid = int(get_jwt_identity())
#     data = request.get_json()

#     required = ("salon_id", "service_id", "scheduled_time")
#     if any(k not in data for k in required):
#         return jsonify(error="Missing required fields"), 400

#     try:
#         sched_at = datetime.fromisoformat(data["scheduled_time"])
#     except Exception:
#         return (
#             jsonify(
#                 error="scheduled_time must be ISO 8601 (e.g., 2025-10-30T10:00:00)"
#             ),
#             400,
#         )

#     service = Service.query.get_or_404(data["service_id"])

#     appt = Appointment(
#         user_id=uid,
#         salon_id=data["salon_id"],
#         staff_id=data.get("staff_id"),
#         service_id=service.service_id,
#         scheduled_time=sched_at,
#         price=service.price,
#         status="booked",
#         notes=data.get("notes"),
#     )
#     db.session.add(appt)
#     db.session.flush()

#     db.session.add(
#         AppointmentService(
#             appointment_id=appt.appointment_id,
#             service_id=service.service_id,
#             duration=service.duration,
#             price=service.price,
#         )
#     )
#     db.session.commit()

#     # Send confirmation notification
#     send_notification(
#         user_id=uid,
#         notification_type="status_update",
#         message=f"Your appointment has been booked for {sched_at.strftime('%B %d, %Y at %I:%M %p')}",
#     )

#     return (
#         jsonify(
#             appointment_id=appt.appointment_id,
#             status=appt.status,
#             scheduled_time=appt.scheduled_time.isoformat(),
#             price=float(appt.price),
#         ),
#         201,
#     )


@app.post("/appointments")
@jwt_required()
def book_appointment():
    """Book appointment"""
    err = json_required()
    if err:
        return err

    uid = int(get_jwt_identity())
    data = request.get_json()

    required = ("salon_id", "service_id", "scheduled_time")
    if any(k not in data for k in required):
        return jsonify(error="Missing required fields"), 400

    try:
        sched_at = datetime.fromisoformat(data["scheduled_time"])
    except Exception:
        return (
            jsonify(
                error="scheduled_time must be ISO 8601 (e.g., 2025-10-30T10:00:00)"
            ),
            400,
        )

    service = Service.query.get_or_404(data["service_id"])

    appt = Appointment(
        user_id=uid,
        salon_id=data["salon_id"],
        staff_id=data.get("staff_id"),
        service_id=service.service_id,
        scheduled_time=sched_at,
        price=service.price,
        status="booked",
        notes=data.get("notes"),
    )
    db.session.add(appt)
    db.session.flush()

    db.session.add(
        AppointmentService(
            appointment_id=appt.appointment_id,
            service_id=service.service_id,
            duration=service.duration,
            price=service.price,
        )
    )
    db.session.commit()

    return (
        jsonify(
            appointment_id=appt.appointment_id,
            status=appt.status,
            scheduled_time=appt.scheduled_time.isoformat(),
            price=float(appt.price),
        ),
        201,
    )


@app.get("/appointments")
@jwt_required()
def list_appointments():
    """Get user appointments"""
    uid = int(get_jwt_identity())
    user = User.query.get(uid)

    if user.user_role == "staff":
        # Get staff appointments
        staff = Staff.query.filter_by(user_id=uid).first()
        if staff:
            appointments = Appointment.query.filter_by(staff_id=staff.staff_id).all()
        else:
            appointments = []
    else:
        # Get user's own appointments
        appointments = Appointment.query.filter_by(user_id=uid).all()

    result = []
    for appt in appointments:
        salon = Salon.query.get(appt.salon_id)
        service = Service.query.get(appt.service_id)
        result.append(
            {
                "appointment_id": appt.appointment_id,
                "salon_name": salon.name if salon else "Unknown",
                "service_name": service.custom_name if service else "Unknown",
                "scheduled_time": appt.scheduled_time.isoformat(),
                "status": appt.status,
                "price": float(appt.price),
            }
        )

    return jsonify(appointments=result, count=len(result))


@app.get("/users/me/appointments")
@jwt_required()
def my_appointments():
    """View visit history - Criteria: Profile #1"""
    uid = int(get_jwt_identity())

    appointments = (
        Appointment.query.filter_by(user_id=uid)
        .order_by(Appointment.scheduled_time.desc())
        .all()
    )

    result = []
    for appt in appointments:
        salon = Salon.query.get(appt.salon_id)
        service = Service.query.get(appt.service_id)
        staff = Staff.query.get(appt.staff_id) if appt.staff_id else None
        staff_user = User.query.get(staff.user_id) if staff else None

        result.append(
            {
                "appointment_id": appt.appointment_id,
                "salon_name": salon.name if salon else "Unknown",
                "service_name": service.custom_name if service else "Unknown",
                "staff_name": staff_user.full_name if staff_user else None,
                "scheduled_time": appt.scheduled_time.isoformat(),
                "status": appt.status,
                "price": float(appt.price),
                "notes": appt.notes,
            }
        )

    return jsonify(appointments=result, count=len(result))


@app.get("/salons/<int:salon_id>/customers/<int:customer_id>/history")
@require_roles("owner", "staff")
def customer_history(salon_id, customer_id):
    """View customer visit history - Criteria: Profile #2"""
    uid = int(get_jwt_identity())
    salon = Salon.query.get_or_404(salon_id)

    # Verify authorization
    user = User.query.get(uid)
    if user.user_role == "owner" and salon.owner_id != uid:
        return jsonify(error="Not your salon"), 403
    elif user.user_role == "staff":
        staff = Staff.query.filter_by(user_id=uid, salon_id=salon_id).first()
        if not staff:
            return jsonify(error="Not staff at this salon"), 403

    appointments = (
        Appointment.query.filter_by(salon_id=salon_id, user_id=customer_id)
        .order_by(Appointment.scheduled_time.desc())
        .all()
    )

    customer = User.query.get(customer_id)

    result = []
    for appt in appointments:
        service = Service.query.get(appt.service_id)
        result.append(
            {
                "appointment_id": appt.appointment_id,
                "service_name": service.custom_name if service else "Unknown",
                "scheduled_time": appt.scheduled_time.isoformat(),
                "status": appt.status,
                "price": float(appt.price),
            }
        )

    return jsonify(
        customer={
            "user_id": customer.user_id,
            "name": customer.full_name,
            "email": customer.email,
            "phone": customer.phone,
        },
        appointments=result,
        total_visits=len(result),
    )


@app.patch("/appointments/<int:appointment_id>/reschedule")
@jwt_required()
def reschedule_appointment(appointment_id):
    """Reschedule appointment - Criteria: Booking #2"""
    err = json_required()
    if err:
        return err

    uid = int(get_jwt_identity())
    appt = Appointment.query.get_or_404(appointment_id)

    # Verify ownership
    if appt.user_id != uid:
        return jsonify(error="Not your appointment"), 403

    if appt.status not in ("booked",):
        return jsonify(error="Only booked appointments can be rescheduled"), 400

    new_time = request.get_json().get("scheduled_time")
    try:
        appt.scheduled_time = datetime.fromisoformat(new_time)
    except Exception:
        return jsonify(error="scheduled_time must be ISO 8601"), 400

    db.session.commit()

    # Send notification
    # send_notification(
    #     user_id=uid,
    #     notification_type="status_update",
    #     message=f"Your appointment has been rescheduled to {appt.scheduled_time.strftime('%B %d, %Y at %I:%M %p')}",
    # )

    return jsonify(
        message="Appointment rescheduled", new_time=appt.scheduled_time.isoformat()
    )


@app.patch("/appointments/<int:appointment_id>/cancel")
@jwt_required()
def cancel_appointment(appointment_id):
    """Cancel appointment - Criteria: Booking #3"""
    uid = int(get_jwt_identity())
    appt = Appointment.query.get_or_404(appointment_id)

    # Verify ownership
    if appt.user_id != uid:
        return jsonify(error="Not your appointment"), 403

    if appt.status == "cancelled":
        return jsonify(message="Already cancelled"), 200

    appt.status = "cancelled"
    db.session.commit()

    # Send notification
    # send_notification(
    #     user_id=uid,
    #     notification_type="status_update",
    #     message=f"Your appointment scheduled for {appt.scheduled_time.strftime('%B %d, %Y at %I:%M %p')} has been cancelled.",
    # )

    return jsonify(message="Appointment cancelled")


@app.patch("/appointments/<int:appointment_id>/complete")
@require_roles("staff", "owner")
def complete_appointment(appointment_id):
    """Mark appointment as completed and award loyalty points"""
    uid = int(get_jwt_identity())
    appt = Appointment.query.get_or_404(appointment_id)

    # Verify authorization
    user = User.query.get(uid)
    if user.user_role == "staff":
        staff = Staff.query.filter_by(user_id=uid).first()
        if not staff or staff.staff_id != appt.staff_id:
            return jsonify(error="Not your appointment"), 403
    elif user.user_role == "owner":
        salon = Salon.query.get(appt.salon_id)
        if salon.owner_id != uid:
            return jsonify(error="Not your salon"), 403

    if appt.status == "completed":
        return jsonify(message="Already completed"), 200

    appt.status = "completed"

    # Award loyalty points - Criteria: Loyalty #3
    points_earned = award_loyalty_points(appt.user_id, appt.salon_id, appt.price)

    db.session.commit()

    # Send notification
    send_notification(
        user_id=appt.user_id,
        notification_type="status_update",
        message=f"Your appointment is complete! You earned {points_earned} loyalty points.",
    )

    return jsonify(message="Appointment completed", points_earned=points_earned)


# @app.post("/appointments/<int:appointment_id>/images")
# @jwt_required()
# def upload_appointment_images(appointment_id):
#     """Upload before/after images - Criteria: Profile #5"""
#     uid = int(get_jwt_identity())
#     appt = Appointment.query.get_or_404(appointment_id)

#     # Verify authorization (customer or staff)
#     user = User.query.get(uid)
#     authorized = False

#     if appt.user_id == uid:
#         authorized = True
#     elif user.user_role in ["staff", "owner"]:
#         if user.user_role == "staff":
#             staff = Staff.query.filter_by(user_id=uid).first()
#             if staff and staff.staff_id == appt.staff_id:
#                 authorized = True
#         elif user.user_role == "owner":
#             salon = Salon.query.get(appt.salon_id)
#             if salon and salon.owner_id == uid:
#                 authorized = True

#     if not authorized:
#         return jsonify(error="Unauthorized"), 403

#     # Handle file upload
#     # if "before_image" not in request.files and "after_image" not in request.files:
#     #     return jsonify(error="No image file provided"), 400

#     # if "before_image" in request.files:
#     #     file = request.files["before_image"]
#     #     if file and allowed_file(file.filename):
#     #         filename = f"{uuid.uuid4()}_{secure_filename(file.filename)}"
#     #         filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
#     #         file.save(filepath)
#     #         appt.before_image = filename

#     # if "after_image" in request.files:
#     #     file = request.files["after_image"]
#     #     if file and allowed_file(file.filename):
#     #         filename = f"{uuid.uuid4()}_{secure_filename(file.filename)}"
#     #         filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
#     #         file.save(filepath)
#     #         appt.after_image = filename

#     db.session.commit()

#     return jsonify(
#         message="Images uploaded",
#         before_image=appt.before_image,
#         after_image=appt.after_image,
#     )


# ==================== CART & CHECKOUT ====================


@app.post("/carts")
@jwt_required()
def create_cart():
    """Create shopping cart"""
    err = json_required()
    if err:
        return err

    uid = int(get_jwt_identity())
    data = request.get_json()

    if "salon_id" not in data:
        return jsonify(error="salon_id required"), 400

    # Check for existing active cart
    existing = Cart.query.filter_by(
        user_id=uid, salon_id=data["salon_id"], status="active"
    ).first()

    if existing:
        return jsonify(cart_id=existing.cart_id, message="Using existing cart"), 200

    cart = Cart(user_id=uid, salon_id=data["salon_id"], status="active")
    db.session.add(cart)
    db.session.commit()

    return jsonify(cart_id=cart.cart_id), 201


@app.get("/carts/active")
@jwt_required()
def get_active_cart():
    """Get user's active cart"""
    uid = int(get_jwt_identity())

    cart = Cart.query.filter_by(user_id=uid, status="active").first()
    if not cart:
        return jsonify(message="No active cart", cart=None), 200

    items = CartItem.query.filter_by(cart_id=cart.cart_id).all()

    cart_items = []
    total = 0

    for item in items:
        if item.type == "product":
            product = Product.query.get(item.product_id)
            cart_items.append(
                {
                    "item_id": item.item_id,
                    "type": "product",
                    "name": product.name if product else "Unknown",
                    "quantity": item.quantity,
                    "price": float(item.price),
                    "subtotal": float(item.price * item.quantity),
                }
            )
        else:
            service = Service.query.get(item.service_id)
            cart_items.append(
                {
                    "item_id": item.item_id,
                    "type": "service",
                    "name": service.custom_name if service else "Unknown",
                    "quantity": item.quantity,
                    "price": float(item.price),
                    "subtotal": float(item.price * item.quantity),
                }
            )

        total += float(item.price * item.quantity)

    return jsonify(
        cart_id=cart.cart_id,
        salon_id=cart.salon_id,
        items=cart_items,
        total=total,
        item_count=len(cart_items),
    )


@app.post("/carts/<int:cart_id>/items")
@jwt_required()
def add_cart_item(cart_id):
    """Add item to cart - Criteria: Shopping #2"""
    err = json_required()
    if err:
        return err

    uid = int(get_jwt_identity())
    cart = Cart.query.get_or_404(cart_id)

    if cart.user_id != uid:
        return jsonify(error="Not your cart"), 403

    data = request.get_json()

    if "type" not in data or "price" not in data:
        return jsonify(error="type and price required"), 400

    # Validate item exists
    if data["type"] == "product" and "product_id" in data:
        product = Product.query.get(data["product_id"])
        if not product or product.stock < int(data.get("quantity", 1)):
            return jsonify(error="Product not available or insufficient stock"), 400
    elif data["type"] == "service" and "service_id" in data:
        service = Service.query.get(data["service_id"])
        if not service:
            return jsonify(error="Service not found"), 404

    item = CartItem(
        cart_id=cart.cart_id,
        product_id=data.get("product_id"),
        service_id=data.get("service_id"),
        quantity=int(data.get("quantity", 1)),
        price=Decimal(str(data["price"])),
        type=data["type"],
    )
    db.session.add(item)
    db.session.commit()

    return jsonify(item_id=item.item_id, message="Item added to cart"), 201


@app.delete("/carts/items/<int:item_id>")
@jwt_required()
def remove_cart_item(item_id):
    """Remove item from cart"""
    uid = int(get_jwt_identity())
    item = CartItem.query.get_or_404(item_id)
    cart = Cart.query.get(item.cart_id)

    if cart.user_id != uid:
        return jsonify(error="Not your cart"), 403

    db.session.delete(item)
    db.session.commit()

    return jsonify(message="Item removed")


@app.post("/checkout")
@jwt_required()
def checkout():
    """Checkout cart - Criteria: Shopping #2, Payments #1, #2"""
    err = json_required()
    if err:
        return err

    uid = int(get_jwt_identity())
    data = request.get_json()

    cart_id = data.get("cart_id")
    cart = Cart.query.get_or_404(cart_id)

    if cart.user_id != uid or cart.status != "active":
        return jsonify(error="Invalid cart"), 400

    items = CartItem.query.filter_by(cart_id=cart.cart_id).all()
    if not items:
        return jsonify(error="Cart is empty"), 400

    # Calculate total
    subtotal = sum(float(i.price) * i.quantity for i in items)

    # Apply loyalty points redemption - Criteria: Loyalty #5
    points_to_redeem = int(data.get("redeem_points", 0))
    discount = 0

    if points_to_redeem > 0:
        loyalty = Loyalty.query.filter_by(user_id=uid, salon_id=cart.salon_id).first()
        if not loyalty or loyalty.points < points_to_redeem:
            return jsonify(error="Insufficient loyalty points"), 400

        # Get redemption rate
        settings = SalonSettings.query.filter_by(salon_id=cart.salon_id).first()
        redemption_rate = float(settings.loyalty_redemption_rate) if settings else 0.01

        discount = points_to_redeem * redemption_rate
        loyalty.points -= points_to_redeem

    total = subtotal - discount

    # Create payment
    pay = Payment(
        user_id=uid,
        amount=total,
        payment_method=data.get("payment_method", "card"),
        payment_status="completed",
        transaction_ref=f"TXN-{uuid.uuid4().hex[:12].upper()}",
    )
    db.session.add(pay)
    db.session.flush()

    # Create order
    order = Order(
        user_id=uid,
        salon_id=cart.salon_id,
        total_amount=total,
        payment_id=pay.payment_id,
        payment_status="paid",
        order_status="completed",
    )
    db.session.add(order)
    db.session.flush()

    # Create order items
    for i in items:
        db.session.add(
            OrderItem(
                order_id=order.order_id,
                product_id=i.product_id,
                service_id=i.service_id,
                quantity=i.quantity,
                price=i.price,
                type=i.type,
            )
        )

        # Update product stock
        if i.type == "product" and i.product_id:
            product = Product.query.get(i.product_id)
            if product:
                product.stock -= i.quantity

    # Mark cart as checked out
    cart.status = "checked_out"

    # Award loyalty points for purchase - Criteria: Loyalty #3
    points_earned = award_loyalty_points(uid, cart.salon_id, total)

    db.session.commit()

    # Send notification
    # send_notification(
    #     user_id=uid,
    #     notification_type="status_update",
    #     message=f"Your order #{order.order_id} has been confirmed. You earned {points_earned} loyalty points!",
    # )

    return jsonify(
        order_id=order.order_id,
        total=float(total),
        subtotal=float(subtotal),
        discount=float(discount),
        points_redeemed=points_to_redeem,
        points_earned=points_earned,
        transaction_ref=pay.transaction_ref,
    )


# ==================== LOYALTY PROGRAM ====================


@app.get("/loyalty")
@jwt_required()
def loyalty_balance():
    """View loyalty points balance - Criteria: Loyalty #4"""
    uid = int(get_jwt_identity())
    records = Loyalty.query.filter_by(user_id=uid).all()

    result = []
    for r in records:
        salon = Salon.query.get(r.salon_id)
        result.append(
            {
                "salon_id": r.salon_id,
                "salon_name": salon.name if salon else "Unknown",
                "points": r.points,
                "lifetime_points": r.lifetime_points,
                "last_earned": r.last_earned.isoformat() if r.last_earned else None,
            }
        )

    return jsonify(loyalty=result, total_salons=len(result))


@app.get("/loyalty/<int:salon_id>")
@jwt_required()
def loyalty_by_salon(salon_id):
    """Get loyalty points for specific salon"""
    uid = int(get_jwt_identity())
    loyalty = Loyalty.query.filter_by(user_id=uid, salon_id=salon_id).first()

    if not loyalty:
        return (
            jsonify(
                salon_id=salon_id,
                points=0,
                lifetime_points=0,
                message="No loyalty record found",
            ),
            200,
        )

    salon = Salon.query.get(salon_id)
    settings = SalonSettings.query.filter_by(salon_id=salon_id).first()

    return jsonify(
        salon_id=salon_id,
        salon_name=salon.name if salon else "Unknown",
        points=loyalty.points,
        lifetime_points=loyalty.lifetime_points,
        last_earned=loyalty.last_earned.isoformat() if loyalty.last_earned else None,
        redemption_rate=float(settings.loyalty_redemption_rate) if settings else 0.01,
        points_per_dollar=settings.loyalty_points_per_dollar if settings else 1,
    )


# ==================== REVIEWS ====================


@app.post("/reviews")
@jwt_required()
def create_review():
    """Leave review - Criteria: Profile #3"""
    err = json_required()
    if err:
        return err

    uid = int(get_jwt_identity())
    data = request.get_json()

    if "appointment_id" not in data or "rating" not in data:
        return jsonify(error="appointment_id and rating required"), 400

    appt = Appointment.query.get_or_404(data["appointment_id"])

    if appt.user_id != uid:
        return jsonify(error="Not your appointment"), 403

    if appt.status != "completed":
        return jsonify(error="Can only review completed appointments"), 400

    # Check if review already exists
    existing = Review.query.filter_by(appointment_id=appt.appointment_id).first()
    if existing:
        return jsonify(error="Review already exists for this appointment"), 409

    # Validate rating
    rating = int(data["rating"])
    if rating < 1 or rating > 5:
        return jsonify(error="Rating must be between 1 and 5"), 400

    rv = Review(
        appointment_id=appt.appointment_id,
        user_id=uid,
        salon_id=appt.salon_id,
        staff_id=appt.staff_id,
        rating=rating,
        comment=data.get("comment"),
    )
    db.session.add(rv)
    db.session.commit()

    return jsonify(review_id=rv.review_id, message="Review submitted successfully"), 201


@app.get("/salons/<int:salon_id>/reviews")
def list_reviews(salon_id):
    """Get salon reviews"""
    reviews = (
        Review.query.filter_by(salon_id=salon_id)
        .order_by(Review.created_at.desc())
        .all()
    )

    result = []
    for rv in reviews:
        user = User.query.get(rv.user_id)
        result.append(
            {
                "review_id": rv.review_id,
                "user_name": user.full_name if user else "Anonymous",
                "rating": rv.rating,
                "comment": rv.comment,
                "response": rv.response,
                "created_at": rv.created_at.isoformat() if rv.created_at else None,
                "responded_at": (
                    rv.responded_at.isoformat() if rv.responded_at else None
                ),
            }
        )

    # Calculate average rating
    avg_rating = (
        db.session.query(func.avg(Review.rating)).filter_by(salon_id=salon_id).scalar()
    )

    return jsonify(
        reviews=result,
        count=len(result),
        average_rating=float(avg_rating) if avg_rating else 0,
    )


@app.patch("/reviews/<int:review_id>/respond")
@require_roles("owner", "admin")
def respond_review(review_id):
    """Respond to review - Criteria: Profile #4"""
    uid = int(get_jwt_identity())
    review = Review.query.get_or_404(review_id)

    # Verify ownership
    user = User.query.get(uid)
    if user.user_role == "owner":
        salon = Salon.query.get(review.salon_id)
        if salon.owner_id != uid:
            return jsonify(error="Not your salon"), 403

    data = request.get_json()

    if "response" not in data:
        return jsonify(error="response text required"), 400

    review.response = data["response"]
    review.responded_at = datetime.utcnow()
    db.session.commit()

    # Notify customer
    send_notification(
        user_id=review.user_id,
        notification_type="status_update",
        message=f"The salon has responded to your review!",
    )

    return jsonify(message="Response added successfully")


# ==================== NOTIFICATIONS ====================


@app.get("/notifications")
@jwt_required()
def get_notifications():
    """Get user notifications"""
    uid = int(get_jwt_identity())

    notifications = (
        Notification.query.filter_by(user_id=uid)
        .order_by(Notification.sent_at.desc())
        .limit(50)
        .all()
    )

    return jsonify(
        notifications=[
            {
                "notification_id": n.notification_id,
                "type": n.type,
                "title": n.title,
                "message": n.message,
                "is_read": n.is_read,
                "sent_at": n.sent_at.isoformat() if n.sent_at else None,
            }
            for n in notifications
        ],
        unread_count=sum(1 for n in notifications if not n.is_read),
    )


@app.patch("/notifications/<int:notification_id>/read")
@jwt_required()
def mark_notification_read(notification_id):
    """Mark notification as read"""
    uid = int(get_jwt_identity())
    notification = Notification.query.get_or_404(notification_id)

    if notification.user_id != uid:
        return jsonify(error="Not your notification"), 403

    notification.is_read = True
    db.session.commit()

    return jsonify(message="Marked as read")


@app.post("/notifications/send")
@require_roles("owner", "admin")
def send_promotional_notification():
    """Send promotional notifications - Criteria: Notifications #2, #4"""
    uid = int(get_jwt_identity())
    data = request.get_json()

    required = ["user_ids", "title", "message", "type"]
    for field in required:
        if field not in data:
            return jsonify(error=f"Missing {field}"), 400

    user_ids = data["user_ids"]
    notification_type = data["type"]

    if notification_type not in ["promotion", "discount", "status_update"]:
        return jsonify(error="Invalid notification type"), 400

    # Create notifications
    created = 0
    for user_id in user_ids:
        send_notification(
            user_id=user_id,
            notification_type=notification_type,
            message=data["message"],
        )
        created += 1

    return jsonify(message=f"Sent {created} notifications", count=created)


# ==================== PROMOTIONS ====================


@app.post("/salons/<int:salon_id>/promotions")
@require_roles("owner")
def create_promotion(salon_id):
    """Create promotional offer"""
    uid = int(get_jwt_identity())
    salon = Salon.query.get_or_404(salon_id)

    if salon.owner_id != uid:
        return jsonify(error="Not your salon"), 403

    data = request.get_json()
    required = ["title", "description", "discount_percent", "valid_from", "valid_until"]

    for field in required:
        if field not in data:
            return jsonify(error=f"Missing {field}"), 400

    try:
        valid_from = datetime.fromisoformat(data["valid_from"])
        valid_until = datetime.fromisoformat(data["valid_until"])
    except ValueError:
        return jsonify(error="Invalid date format"), 400

    promotion = Promotion(
        salon_id=salon_id,
        title=data["title"],
        description=data["description"],
        discount_percent=Decimal(str(data["discount_percent"])),
        valid_from=valid_from,
        valid_until=valid_until,
        is_active=data.get("is_active", True),
    )
    db.session.add(promotion)
    db.session.commit()

    # Notify loyal customers
    loyal_customers = (
        Loyalty.query.filter_by(salon_id=salon_id)
        .filter(Loyalty.lifetime_points > 100)
        .all()
    )

    for loyalty in loyal_customers:
        send_notification(
            user_id=loyalty.user_id,
            notification_type="promotion",
            message=f"{data['description']} - {data['discount_percent']}% off!",
        )

    return (
        jsonify(
            promotion_id=promotion.promotion_id,
            message="Promotion created and customers notified",
        ),
        201,
    )


@app.get("/salons/<int:salon_id>/promotions")
def list_promotions(salon_id):
    """Get active promotions"""
    now = datetime.utcnow()
    promotions = Promotion.query.filter(
        and_(
            Promotion.salon_id == salon_id,
            Promotion.is_active == True,
            Promotion.valid_from <= now,
            Promotion.valid_until >= now,
        )
    ).all()

    return jsonify(
        promotions=[
            {
                "promotion_id": p.promotion_id,
                "title": p.title,
                "description": p.description,
                "discount_percent": float(p.discount_percent),
                "valid_from": p.valid_from.isoformat(),
                "valid_until": p.valid_until.isoformat(),
            }
            for p in promotions
        ]
    )


# ==================== ADMIN ANALYTICS ====================


@app.get("/admin/stats/engagement")
@require_roles("admin")
def admin_engagement_stats():
    """User engagement stats - Criteria: Admin #1"""
    total_users = User.query.count()
    active_users = db.session.query(
        func.count(func.distinct(Appointment.user_id))
    ).scalar()

    # Users by role
    users_by_role = (
        db.session.query(User.user_role, func.count(User.user_id))
        .group_by(User.user_role)
        .all()
    )

    # Recent signups (last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    recent_signups = User.query.filter(User.created_at >= thirty_days_ago).count()

    return jsonify(
        total_users=total_users,
        active_users=active_users,
        recent_signups_30d=recent_signups,
        users_by_role={role: count for role, count in users_by_role},
        engagement_rate=round(
            (active_users / total_users * 100) if total_users > 0 else 0, 2
        ),
    )


@app.get("/admin/stats/appointments")
@require_roles("admin")
def admin_appointment_stats():
    """Appointment trends - Criteria: Admin #2"""
    total_appointments = Appointment.query.count()

    # Appointments by status
    by_status = (
        db.session.query(Appointment.status, func.count(Appointment.appointment_id))
        .group_by(Appointment.status)
        .all()
    )

    # Appointments by hour (peak hours)
    peak_hours = (
        db.session.query(
            func.hour(Appointment.scheduled_time).label("hour"),
            func.count(Appointment.appointment_id).label("count"),
        )
        .group_by("hour")
        .order_by(func.count(Appointment.appointment_id).desc())
        .limit(5)
        .all()
    )

    # This week's appointments
    week_start = datetime.utcnow() - timedelta(days=datetime.utcnow().weekday())
    week_appointments = Appointment.query.filter(
        Appointment.scheduled_time >= week_start
    ).count()

    return jsonify(
        total_appointments=total_appointments,
        this_week=week_appointments,
        by_status={status: count for status, count in by_status},
        peak_hours=[{"hour": h, "appointments": c} for h, c in peak_hours],
    )


@app.get("/admin/stats/revenue")
@require_roles("admin")
def admin_revenue_stats():
    """Revenue tracking - Criteria: Admin #3"""
    # Total revenue
    total_revenue = (
        db.session.query(func.sum(Payment.amount))
        .filter(Payment.payment_status == "completed")
        .scalar()
        or 0
    )

    # Revenue by salon
    revenue_by_salon = (
        db.session.query(Salon.name, func.sum(Order.total_amount).label("revenue"))
        .join(Order, Order.salon_id == Salon.salon_id)
        .filter(Order.payment_status == "paid")
        .group_by(Salon.salon_id)
        .order_by(func.sum(Order.total_amount).desc())
        .limit(10)
        .all()
    )

    # Monthly revenue (last 6 months)
    six_months_ago = datetime.utcnow() - timedelta(days=180)
    monthly_revenue = (
        db.session.query(
            func.date_format(Payment.created_at, "%Y-%m").label("month"),
            func.sum(Payment.amount).label("revenue"),
        )
        .filter(
            and_(
                Payment.payment_status == "completed",
                Payment.created_at >= six_months_ago,
            )
        )
        .group_by("month")
        .order_by("month")
        .all()
    )

    return jsonify(
        total_revenue=float(total_revenue),
        top_salons=[
            {"salon": name, "revenue": float(rev)} for name, rev in revenue_by_salon
        ],
        monthly_trend=[
            {"month": month, "revenue": float(rev)} for month, rev in monthly_revenue
        ],
    )


@app.get("/admin/stats/loyalty")
@require_roles("admin")
def admin_loyalty_stats():
    """Loyalty program usage - Criteria: Admin #4"""
    total_points_issued = (
        db.session.query(func.sum(Loyalty.lifetime_points)).scalar() or 0
    )

    current_points = db.session.query(func.sum(Loyalty.points)).scalar() or 0

    points_redeemed = total_points_issued - current_points

    # Active loyalty members
    active_members = Loyalty.query.filter(Loyalty.points > 0).count()

    # Top loyalty earners
    top_earners = (
        db.session.query(User.full_name, Loyalty.lifetime_points)
        .join(User, User.user_id == Loyalty.user_id)
        .order_by(Loyalty.lifetime_points.desc())
        .limit(10)
        .all()
    )

    return jsonify(
        total_points_issued=total_points_issued,
        current_points_balance=current_points,
        points_redeemed=points_redeemed,
        redemption_rate=round(
            (
                (points_redeemed / total_points_issued * 100)
                if total_points_issued > 0
                else 0
            ),
            2,
        ),
        active_members=active_members,
        top_earners=[{"name": name, "points": pts} for name, pts in top_earners],
    )


@app.get("/admin/stats/demographics")
@require_roles("admin")
def admin_demographics():
    """User demographics - Criteria: Admin #5"""
    # Users by role
    role_distribution = (
        db.session.query(User.user_role, func.count(User.user_id))
        .group_by(User.user_role)
        .all()
    )

    # Salons by status
    salon_status = (
        db.session.query(Salon.status, func.count(Salon.salon_id))
        .group_by(Salon.status)
        .all()
    )

    # Geographic distribution (if address available)
    # This is simplified - you'd parse address for real implementation

    return jsonify(
        users_by_role={role: count for role, count in role_distribution},
        salons_by_status={status: count for status, count in salon_status},
        total_salons=Salon.query.count(),
        total_staff=Staff.query.filter_by(is_active=True).count(),
    )


@app.get("/admin/stats/retention")
@require_roles("admin")
def admin_retention():
    """Customer retention metrics - Criteria: Admin #6"""
    # Users with multiple appointments (repeat customers)
    repeat_customers = (
        db.session.query(
            Appointment.user_id,
            func.count(Appointment.appointment_id).label("visit_count"),
        )
        .group_by(Appointment.user_id)
        .having(func.count(Appointment.appointment_id) > 1)
        .count()
    )

    total_customers = db.session.query(
        func.count(func.distinct(Appointment.user_id))
    ).scalar()

    retention_rate = (
        (repeat_customers / total_customers * 100) if total_customers > 0 else 0
    )

    # Average visits per customer
    avg_visits = (
        db.session.query(func.avg(func.count(Appointment.appointment_id)))
        .group_by(Appointment.user_id)
        .scalar()
        or 0
    )

    # Churn analysis (users who haven't booked in 90 days)
    ninety_days_ago = datetime.utcnow() - timedelta(days=90)
    inactive_users = (
        db.session.query(func.count(func.distinct(Appointment.user_id)))
        .filter(Appointment.scheduled_time < ninety_days_ago)
        .scalar()
    )

    return jsonify(
        total_customers=total_customers,
        repeat_customers=repeat_customers,
        retention_rate=round(retention_rate, 2),
        average_visits_per_customer=round(float(avg_visits), 2),
        inactive_users_90d=inactive_users,
    )


@app.get("/admin/reports/summary")
@require_roles("admin")
def admin_summary_report():
    """Generate summary report - Criteria: Admin #7"""
    # Collect all key metrics
    report = {
        "generated_at": datetime.utcnow().isoformat(),
        "overview": {
            "total_users": User.query.count(),
            "total_salons": Salon.query.count(),
            "active_salons": Salon.query.filter_by(status="active").count(),
            "total_appointments": Appointment.query.count(),
            "total_revenue": float(
                db.session.query(func.sum(Payment.amount))
                .filter(Payment.payment_status == "completed")
                .scalar()
                or 0
            ),
        },
        "this_month": {
            "new_users": User.query.filter(
                User.created_at >= datetime.utcnow().replace(day=1)
            ).count(),
            "appointments": Appointment.query.filter(
                Appointment.scheduled_time >= datetime.utcnow().replace(day=1)
            ).count(),
            "revenue": float(
                db.session.query(func.sum(Payment.amount))
                .filter(
                    and_(
                        Payment.payment_status == "completed",
                        Payment.created_at >= datetime.utcnow().replace(day=1),
                    )
                )
                .scalar()
                or 0
            ),
        },
        "loyalty": {
            "active_members": Loyalty.query.filter(Loyalty.points > 0).count(),
            "total_points_issued": db.session.query(
                func.sum(Loyalty.lifetime_points)
            ).scalar()
            or 0,
        },
    }

    return jsonify(report)


@app.get("/admin/system/health")
@require_roles("admin")
def admin_system_health():
    """Monitor system health - Criteria: Admin #8"""
    try:
        # Test database connection
        db.session.execute("SELECT 1")
        db_status = "healthy"
    except Exception as e:
        db_status = f"error: {str(e)}"

    # Count records
    record_counts = {
        "users": User.query.count(),
        "salons": Salon.query.count(),
        "appointments": Appointment.query.count(),
        "payments": Payment.query.count(),
    }

    # Recent errors (you'd need an error log table for this)
    # Simplified version

    return jsonify(
        status="ok",
        timestamp=datetime.utcnow().isoformat(),
        database=db_status,
        record_counts=record_counts,
        uptime="Operational",
    )


# ==================== ERROR HANDLERS ====================


@app.errorhandler(404)
def not_found(error):
    return jsonify(error="Resource not found"), 404


@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return jsonify(error="Internal server error"), 500


@app.errorhandler(403)
def forbidden(error):
    return jsonify(error="Forbidden"), 403


# ==================== MAIN ====================

if __name__ == "__main__":
    debug = os.getenv("APP_DEBUG", "true").lower() == "true"
    host = os.getenv("APP_HOST", "0.0.0.0")
    port = int(os.getenv("APP_PORT", "5000"))

    print(f"\n{'='*60}")
    print(f"🚀 Salon Platform API Starting...")
    print(f"{'='*60}")
    print(f"Environment: {'Development' if debug else 'Production'}")
    print(f"Server: http://{host}:{port}")
    print(f"Database: {DB_NAME}")
    print(f"{'='*60}\n")

    app.run(host=host, port=port, debug=debug)
