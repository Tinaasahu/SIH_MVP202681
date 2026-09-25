"""
Hybrid Weather AI - Main Application Entry Point & REST API
Smart India Hackathon 2026 (PS: 26081)
"""

import os
import csv
from flask import Flask, jsonify, request

# Graceful pandas import to support both venv and environments with C-extension conflicts
try:
    import pandas as pd
    USE_PANDAS = True
except (ImportError, ValueError, Exception):
    pd = None
    USE_PANDAS = False

app = Flask(__name__)

# Base project paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUTS_DIR = os.path.join(BASE_DIR, "outputs")
DATA_DIR = os.path.join(BASE_DIR, "data")


def load_csv_records(csv_path):
    """
    Reads a CSV file into a list of dict records.
    Uses pandas if available; falls back to standard library csv module.
    """
    if not os.path.exists(csv_path):
        return None

    if USE_PANDAS and pd is not None:
        try:
            df = pd.read_csv(csv_path)
            df = df.where(pd.notnull(df), None)
            return df.to_dict(orient='records')
        except Exception:
            pass

    records = []
    with open(csv_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            cleaned = {}
            for k, v in row.items():
                if v == '' or v is None:
                    cleaned[k] = None
                else:
                    try:
                        if '.' in v:
                            cleaned[k] = float(v)
                        else:
                            cleaned[k] = int(v)
                    except ValueError:
                        cleaned[k] = v
            records.append(cleaned)
    return records


@app.after_request
def add_cors_headers(response):
    """Enable CORS for local frontend development."""
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response


@app.route('/')
def index():
    return jsonify({
        "status": "online",
        "service": "Hybrid Weather AI System",
        "version": "1.0.0",
        "engine": "pandas" if (USE_PANDAS and pd is not None) else "standard-csv",
        "endpoints": {
            "forecast": "/api/forecast",
            "weights": "/api/weights",
            "skill": "/api/skill",
            "alerts": "/api/alerts",
            "cities": "/api/cities",
            "confidence": "/api/confidence"
        }
    })


@app.route('/api/forecast', methods=['GET'])
def get_forecast():
    """
    Returns records from outputs/hybrid_forecast.csv.
    Optional query parameters:
      - city: filter by city name (e.g. ?city=Kanpur)
      - lead_days: filter by lead time (1, 2, or 3)
    """
    csv_path = os.path.join(OUTPUTS_DIR, "hybrid_forecast.csv")
    records = load_csv_records(csv_path)
    if records is None:
        return jsonify({"error": "hybrid_forecast.csv not found"}), 404

    city = request.args.get('city')
    lead_days = request.args.get('lead_days')

    if city:
        city_lower = city.strip().lower()
        records = [r for r in records if str(r.get('city', '')).lower() == city_lower]
    if lead_days:
        try:
            ld = int(lead_days)
            records = [r for r in records if r.get('lead_days') == ld]
        except ValueError:
            pass

    return jsonify(records)


@app.route('/api/weights', methods=['GET'])
def get_weights():
    """
    Returns records from outputs/model_weights_lead.csv.
    Optional query parameters:
      - city: filter by city name
      - variable: filter by variable ('temperature', 'rainfall', 'wind_speed')
      - lead_days: filter by lead_days (1, 2, 3)
    """
    csv_path = os.path.join(OUTPUTS_DIR, "model_weights_lead.csv")
    records = load_csv_records(csv_path)
    if records is None:
        return jsonify({"error": "model_weights_lead.csv not found"}), 404

    city = request.args.get('city')
    variable = request.args.get('variable')
    lead_days = request.args.get('lead_days')

    if city:
        city_lower = city.strip().lower()
        records = [r for r in records if str(r.get('city', '')).lower() == city_lower]
    if variable:
        var_lower = variable.strip().lower()
        records = [r for r in records if str(r.get('variable', '')).lower() == var_lower]
    if lead_days:
        try:
            ld = int(lead_days)
            records = [r for r in records if r.get('lead_days') == ld]
        except ValueError:
            pass

    return jsonify(records)


@app.route('/api/skill', methods=['GET'])
def get_skill():
    """
    Returns records from outputs/skill_scores_lead.csv.
    Optional query parameters:
      - city: filter by city name
      - variable: filter by variable ('temperature', 'rainfall', 'wind_speed')
      - lead_days: filter by lead_days (1, 2, 3)
    """
    csv_path = os.path.join(OUTPUTS_DIR, "skill_scores_lead.csv")
    records = load_csv_records(csv_path)
    if records is None:
        return jsonify({"error": "skill_scores_lead.csv not found"}), 404

    city = request.args.get('city')
    variable = request.args.get('variable')
    lead_days = request.args.get('lead_days')

    if city:
        city_lower = city.strip().lower()
        records = [r for r in records if str(r.get('city', '')).lower() == city_lower]
    if variable:
        var_lower = variable.strip().lower()
        records = [r for r in records if str(r.get('variable', '')).lower() == var_lower]
    if lead_days:
        try:
            ld = int(lead_days)
            records = [r for r in records if r.get('lead_days') == ld]
        except ValueError:
            pass

    return jsonify(records)


@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    """
    Returns records from outputs/extreme_alerts.csv.
    Optional query parameter:
      - city: filter by city name
    """
    csv_path = os.path.join(OUTPUTS_DIR, "extreme_alerts.csv")
    records = load_csv_records(csv_path)
    if records is None:
        return jsonify({"error": "extreme_alerts.csv not found"}), 404

    city = request.args.get('city')
    if city:
        city_lower = city.strip().lower()
        records = [r for r in records if str(r.get('city', '')).lower() == city_lower]

    return jsonify(records)


@app.route('/api/cities', methods=['GET'])
def get_cities():
    """
    Returns unique cities and their latitude/longitude coordinates from
    data/cities.csv or outputs/hybrid_forecast.csv.
    """
    cities_path = os.path.join(DATA_DIR, "cities.csv")
    forecast_path = os.path.join(OUTPUTS_DIR, "hybrid_forecast.csv")

    cities = load_csv_records(cities_path)
    if cities is not None:
        return jsonify(cities)

    forecast_records = load_csv_records(forecast_path)
    if forecast_records is not None:
        unique_cities = sorted(list({r['city'] for r in forecast_records if 'city' in r}))
        return jsonify([{"city": c} for c in unique_cities])

    return jsonify([])


@app.route('/api/confidence', methods=['GET'])
def get_confidence():
    """
    Returns records from outputs/confidence_scores.csv.
    Optional query parameters:
      - city: filter by city name (e.g. ?city=Kanpur)
      - lead_day: filter by lead day (1, 2, or 3)
    """
    csv_path = os.path.join(OUTPUTS_DIR, "confidence_scores.csv")
    records = load_csv_records(csv_path)
    if records is None:
        return jsonify({"error": "confidence_scores.csv not found"}), 404

    city = request.args.get('city')
    lead_day = request.args.get('lead_day') or request.args.get('lead_days')

    if city:
        city_lower = city.strip().lower()
        records = [r for r in records if str(r.get('city', '')).lower() == city_lower]
    if lead_day:
        try:
            ld = int(lead_day)
            records = [r for r in records if r.get('lead_day') == ld or r.get('lead_days') == ld]
        except ValueError:
            pass

    return jsonify(records)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print(f"\n🚀 Hybrid Weather AI API starting on http://localhost:{port}")
    print(f"📡 Endpoints available at http://localhost:{port}/api/\n")
    app.run(host='0.0.0.0', port=port, debug=True)
