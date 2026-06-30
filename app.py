from flask import Flask, render_template, request, jsonify
import json
import os

app = Flask(__name__)

def load_hotels():
    dir_path = os.path.dirname(os.path.realpath(__file__))
    file_path = os.path.join(dir_path, "hotels.json")
    with open(file_path, "r") as file:
        return json.load(file)

def get_price(h):
    return int(h["price"].replace("₹", "").replace(",", "").split("/")[0])

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/stats")
def stats():
    hotels = load_hotels()
    cities = set(h["city"] for h in hotels)
    ratings = [float(h["rating"]) for h in hotels]
    avg = round(sum(ratings) / len(ratings), 1) if ratings else 0

    return jsonify({
        "total_hotels": len(hotels),
        "total_cities": len(cities),
        "avg_rating": avg
    })

@app.route("/get_hotels", methods=["POST"])
def get_hotels():
    city = request.json.get("city")

    if not city:
        return jsonify([])

    hotels = load_hotels()
    filtered = [h for h in hotels if h["city"].lower() == city.lower()]
    return jsonify(filtered)

@app.route("/get_cities")
def get_cities():
    hotels = load_hotels()
    cities = sorted(set(h["city"] for h in hotels))
    return jsonify(cities)

@app.route("/recommend", methods=["POST"])
def recommend():
    data = request.json
    city = data.get("city")
    budget = data.get("budget")
    preference = data.get("preference")

    hotels = load_hotels()
    city_hotels = [h for h in hotels if h["city"].lower() == city.lower()]

    if not city_hotels:
        return jsonify({})

    def score(h):
        rating = float(h["rating"])
        price = get_price(h)

        if preference == "cheap":
            return -price
        elif preference == "luxury":
            return rating * 10
        else:
            return rating * 10 - (price / 1000)

    if budget:
        city_hotels = [h for h in city_hotels if get_price(h) <= int(budget)]

    if not city_hotels:
        return jsonify({})

    best = max(city_hotels, key=score)

    pref_labels = {
        "cheap": "best price within your budget",
        "luxury": "highest guest rating for a premium experience",
        "balanced": "the best balance of rating and price"
    }
    reason = (
        f"Selected for {pref_labels.get(preference, 'best overall value')} "
        f"in {city}. Rated {best['rating']}/10 with {best['reviews']} reviews "
        f"at {best['price']}."
    )

    return jsonify({"hotel": best, "reason": reason})

if __name__ == "__main__":
    app.run(debug=True, port=5001)
