# Hybrid Weather AI System

A hybrid weather forecasting system integrating physics-based Numerical Weather Prediction (NWP) with deep learning machine learning models.

## Project Structure

```
SIH_MVP202681/
├── api/          # REST API routes and model inference engines
├── data/         # Weather datasets and data preprocessing scripts
├── database/     # Database schemas and connection management
├── app.py        # Main Flask application entry point
├── requirements.txt # Python package dependencies
└── README.md     # Project documentation
```

## Setup & Running

1. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Fetch NWP Forecasts:**
   ```bash
   python api/forecast.py
   ```

3. **Fetch Real Historical Actuals (ERA5 reanalysis via Open-Meteo archive API):**
   ```bash
   python api/fetch_actuals.py
   ```
   This downloads independent ground-truth observations for all cities in `data/cities.csv`.
   The date range is auto-detected from the forecast data. You can also specify dates manually:
   ```bash
   python api/fetch_actuals.py --start-date 2026-06-25 --end-date 2026-09-23
   ```

4. **Save to Database (optional):**
   ```bash
   python save_db.py
   ```

5. **Run Application:**
   ```bash
   python app.py
   ```
