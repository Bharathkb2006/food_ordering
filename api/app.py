from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from rapidfuzz import process, fuzz
import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import jsonify, request

app = Flask(__name__, static_folder="static", template_folder="templates")
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///food.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# ========== CONFIG - REPLACE THESE BEFORE RUNNING ==========
OWNER_EMAIL = "kbbharath2006@gmail.com"   # <-- replaced
APP_PASSWORD = "saycdacayaxcmecw"        # <-- keep your app password
OWNER_WHATSAPP = "918526022225"                   # <-- replaced
# ==========================================================


# ---------- MODELS ----------
class Food(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    category = db.Column(db.String(30), nullable=False)  # Veg / Non-Veg / Bulk
    price = db.Column(db.Integer, nullable=False, default=0)
    description = db.Column(db.String(400), nullable=True)
    image = db.Column(db.String(200), nullable=True)  # <-- image filename

class Review(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    food_id = db.Column(db.Integer, db.ForeignKey("food.id"), nullable=True)
    name = db.Column(db.String(120))
    rating = db.Column(db.Integer)
    comment = db.Column(db.String(600))
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class ContactMsg(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120))
    email = db.Column(db.String(200))
    message = db.Column(db.String(1000))
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class BulkRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120))
    email = db.Column(db.String(200))
    purpose = db.Column(db.String(1000))
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

# ---------- DB init & seed ----------
def seed_data():
    if Food.query.count() == 0:
        sample = [
            ("Biryani", "Non-Veg", 200, "Delicious biryani served with aromatic spices.", "biryani.jpg"),
            ("Mini Meals", "Veg", 50, "Tasty paneer butter masala with soft paneer cubes.", "mini_meals.jpg"),
            ("Chicken Curry", "Non-Veg", 130, "Homestyle chicken curry with rich gravy.", "chicken_curry.jpg"),
            ("Paneer Pulao", "Veg", 110, "Wok-fried rice with paneer and fresh veggies.", "panner_pulao.jpg"),
            ("Veg Meals", "Veg", 80, "Crispy masala dosa with spiced potato filling.", "veg_meals.jpg"),
            ("Mutton Curry", "Non-Veg", 170, "Fluffy omelette with mutton-flavored seasoning.", "mutton_curry.jpg"),
            ("Veg Biryani", "Veg", 60, "Fragrant rice with peas and assorted spices.", "veg_briyani.jpg"),
            ("Parotta & Fish Fry", "Non-Veg", 120, "Crispy spiced fish served with parotta.", "paratta.jpg"),
            ("Veg Pulao ", "Veg", 100, "Fragrant rice with peas and assorted spices.", "veg_pulao.jpg")
        ]
        for n, c, p, d, img in sample:
            db.session.add(Food(name=n, category=c, price=p, description=d, image=img))
        db.session.commit()

with app.app_context():
    db.create_all()
    seed_data()

# ---------- Utility: send email ----------
def send_feedback_email(name, rating, comment):
    try:
        msg = MIMEMultipart()
        msg["From"] = OWNER_EMAIL
        msg["To"] = OWNER_EMAIL
        msg["Subject"] = f"New Feedback — {rating}/5 from {name or 'Anonymous'}"

        body = f"Rating: {rating}/5\nName: {name}\n\nFeedback:\n{comment}"
        msg.attach(MIMEText(body, "plain"))

        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(OWNER_EMAIL, APP_PASSWORD)
        server.sendmail(OWNER_EMAIL, OWNER_EMAIL, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print("Error sending email:", e)
        return False

# ---------- Pages ----------
@app.route("/")
def home():
    foods = Food.query.all()  # fetch all food items from database
    return render_template("index.html", foods=foods)

@app.route("/categories")
def categories_page():
    return render_template("categories.html")

@app.route("/feedback")
def feedback_page():
    return render_template("feedback.html")

@app.route("/bulk")
def bulk_page():
    return render_template("bulk.html", owner_whatsapp=OWNER_WHATSAPP)

# ---------- APIs ----------
@app.route("/api/foods")
def api_foods():
    foods = Food.query.order_by(Food.name).all()
    out = []
    for f in foods:
        out.append({
            "id": f.id, "name": f.name, "category": f.category,
            "price": f.price, "description": f.description,
            "image": f.image
        })
    return jsonify(out)

@app.route("/api/search")
def api_search():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify([])
    foods = [f.name for f in Food.query.all()]
    results = process.extract(q, foods, scorer=fuzz.WRatio, limit=8)
    suggestions = [r[0] for r in results if r[1] >= 40]
    return jsonify(suggestions)

@app.route("/api/reviews", methods=["GET"])
def api_get_reviews():
    fid = request.args.get("food_id", type=int)
    query = Review.query.order_by(Review.created_at.desc())
    if fid:
        query = query.filter_by(food_id=fid)
    reviews = query.all()
    return jsonify([{
        "id": r.id, "food_id": r.food_id, "name": r.name,
        "rating": r.rating, "comment": r.comment,
        "created_at": r.created_at.isoformat()
    } for r in reviews])

@app.route("/api/submit_review", methods=["POST"])
def api_submit_review():
    data = request.json or {}
    name = data.get("name", "").strip()
    rating = int(data.get("rating", 0))
    comment = data.get("comment", "").strip()
    food_id = data.get("food_id")
    if not (1 <= rating <= 5) or not comment:
        return jsonify({"ok": False, "error": "Invalid review data"}), 400
    rv = Review(name=name or "Anonymous", rating=rating, comment=comment, food_id=food_id)
    db.session.add(rv)
    db.session.commit()

    # send email to owner with review (best-effort)
    send_feedback_email(name or "Anonymous", rating, comment)
    return jsonify({"ok": True})

@app.route("/api/contact", methods=["POST"])
def api_contact():
    data = request.json or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip()
    message = data.get("message", "").strip()
    if not (name and email and message):
        return jsonify({"ok": False, "error": "Missing fields"}), 400
    cm = ContactMsg(name=name, email=email, message=message)
    db.session.add(cm)
    db.session.commit()
    return jsonify({"ok": True})

@app.route("/api/bulk", methods=["POST"])
def api_bulk():
    data = request.json or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip()
    purpose = data.get("purpose", "").strip()
    if not (name and email and purpose):
        return jsonify({"ok": False, "error": "Missing fields"}), 400
    br = BulkRequest(name=name, email=email, purpose=purpose)
    db.session.add(br)
    db.session.commit()
    return jsonify({"ok": True})


@app.route("/enter_address")
def enter_address():
    return render_template("enter_address.html")

@app.route("/order_confirmed")
def order_confirmed():
    return render_template("order_confirmed.html")

@app.route("/submit_order", methods=["POST"])
def submit_order():
    data = request.json or {}
    address = data.get("address", "").strip()
    if not address:
        return jsonify({"ok": False, "error": "Address is required"}), 400

    # Send email to owner
    try:
        msg = MIMEMultipart()
        msg["From"] = OWNER_EMAIL
        msg["To"] = OWNER_EMAIL
        msg["Subject"] = "New Order Received"

        body = f"New order received!\n\nDelivery Address:\n{address}\n\nCheck your system for order details."
        msg.attach(MIMEText(body, "plain"))

        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(OWNER_EMAIL, APP_PASSWORD)
        server.sendmail(OWNER_EMAIL, OWNER_EMAIL, msg.as_string())
        server.quit()
    except Exception as e:
        print("Error sending email:", e)

    return jsonify({"ok": True})

# ---------- Run ----------
if __name__ == "__main__":
    app.run(debug=True)
