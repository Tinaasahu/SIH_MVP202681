# Hybrid AI–NWP Weather Forecast Blending System

A hybrid weather forecasting system that blends physics-based Numerical Weather
Prediction (NWP) model outputs using machine learning to improve forecast skill.

Built for Smart India Hackathon 2026.

---

## Data Pipeline

```
Open-Meteo Historical Forecast API  ──►  forecast_history.csv       (61 days, 4 NWP models)
Open-Meteo Archive API (ERA5)       ──►  actual_history.csv         (61 days, ERA5 reanalysis)
Open-Meteo Previous Runs API        ──►  forecast_history_lead.csv  (61 days, 4 models × 3 lead offsets)
Open-Meteo Forecast API             ──►  forecast_current.csv       (72 hours, 4 NWP models)
```

### Final Datasets

| File | Source API | Period | Timezone | Rows |
| :--- | :--- | :--- | :--- | :--- |
| `forecast_history.csv` | [Historical Forecast API](https://open-meteo.com/en/docs/historical-forecast-api) | 2026-07-18 → 2026-09-16 (61 days) | Asia/Kolkata (IST) | 263,520 |
| `actual_history.csv` | [Archive API](https://open-meteo.com/en/docs/historical-weather-api) (ERA5 reanalysis) | 2026-07-18 → 2026-09-16 (61 days) | Asia/Kolkata (IST) | 65,880 |
| `forecast_history_lead.csv` | [Previous Runs API](https://open-meteo.com/en/docs/previous-runs-api) | 2026-07-18 → 2026-09-16 (61 days) | Asia/Kolkata (IST) | 790,560 |
| `forecast_current.csv` | [Forecast API](https://open-meteo.com/en/docs) | Next 72 hours from run time | Asia/Kolkata (IST) | 12,960 |

**NWP models:** `ecmwf_ifs025`, `gfs_seamless`, `icon_seamless`, `gem_seamless`
**Cities:** 45 Indian cities (see `data/cities.csv`)

All APIs are free, require no API key, and return hourly data.

---

## Dataset Schemas

### `forecast_history.csv` / `forecast_current.csv`

| Column | Type | Unit | Description |
| :--- | :--- | :--- | :--- |
| `city` | string | — | City name |
| `model` | string | — | NWP model identifier |
| `datetime` | string | `YYYY-MM-DDTHH:MM` | Timestamp in IST |
| `temperature` | float | °C | Air temperature at 2 m |
| `rainfall` | float | mm | Precipitation |
| `wind_speed` | float | km/h | Wind speed at 10 m |

API parameters: `hourly=temperature_2m,precipitation,wind_speed_10m`

> **Note on `forecast_history.csv`:** The Historical Forecast API stitches the
> first hours of each successive model run into a single seamless timeseries.
> Every timestamp is effectively a short-range forecast from a recent model run.
> The true lead time per timestamp cannot be determined from this API alone.

### `actual_history.csv`

ERA5 reanalysis reference data for the same date range and cities.

| Column | Type | Unit | Description |
| :--- | :--- | :--- | :--- |
| `city` | string | — | City name |
| `datetime` | string | `YYYY-MM-DDTHH:MM` | Timestamp in IST |
| `actual_temperature` | float | °C | ERA5 temperature at 2 m |
| `actual_rainfall` | float | mm | ERA5 precipitation |
| `actual_wind` | float | km/h | ERA5 wind speed at 10 m |

> ERA5 reanalysis is a model-based atmospheric reconstruction, not raw station
> observations. It is the best available gridded reference for these locations.

### `forecast_history_lead.csv`

Lead-time-specific forecasts from the Previous Runs API. Each row is a
forecast that was issued `lead_days` days before the valid time.

| Column | Type | Unit | Description |
| :--- | :--- | :--- | :--- |
| `city` | string | — | City name |
| `model` | string | — | NWP model identifier |
| `datetime` | string | `YYYY-MM-DDTHH:MM` | Valid time in IST |
| `lead_days` | int | days | 1 = predicted 24 h before valid time, 2 = 48 h, 3 = 72 h |
| `temperature` | float | °C | Forecast temperature at 2 m |
| `rainfall` | float | mm | Forecast precipitation |
| `wind_speed` | float | km/h | Forecast wind speed at 10 m |

API parameters: `hourly=temperature_2m_previous_day1,...,wind_speed_10m_previous_day3`

---

## Setup & Running

1. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Fetch NWP Forecasts (history):**
   ```bash
   python api/fetch_history.py
   ```

3. **Fetch Lead-Time Forecasts (Previous Runs):**
   ```bash
   python api/fetch_history_lead.py
   ```

4. **Fetch Current 72-Hour Forecasts:**
   ```bash
   python api/fetch_current.py
   ```
   Re-run this before each demo to get a fresh 72-hour window.

5. **Validate All Datasets:**
   ```bash
   python api/validate_data.py
   ```

6. **Run Application:**
   ```bash
   python app.py
   ```

---

## Validation Checks (`api/validate_data.py`)

| Check | Description |
| :--- | :--- |
| 1 | Shape, columns, missing values, duplicates |
| 2 | Date ranges and future-date detection |
| 3 | Hourly gap analysis per city/model |
| 4 | Row matching between forecasts and actuals |
| 5 | Diurnal temperature peak hour sanity |
| 6 | Per-model MAE/RMSE against ERA5 |
| 7 | NaN detection and model-name consistency |
| 8 | `forecast_history_lead.csv` row count |
| 9 | NaN per (model, lead_days) in lead data |
| 10 | (city, datetime) match between lead and actuals |
| 11 | Temperature MAE/RMSE per model per lead_days |
| 12 | lead_days column values and model consistency |

---

## Deprecated Files (Do NOT Use)

| File | Reason |
| :--- | :--- |
| `forecast_raw.csv` | Single forecast run from `api/forecast.py` (old pipeline). |
| `raw_forecasts/*.csv` | Single-run per-model CSVs, no lead-time information. |
| `processed/all_models_clean.csv` | Built from single-run data; `lead_hours` column is a row index, not a real forecast lead time. |
| `actual_raw.csv` | Partial/legacy actuals file. |

These files remain in the repo for backwards compatibility but should not be
used for training, evaluation, or dashboard display.

---

## Project Structure

```
SIH_MVP202681/
├── api/
│   ├── forecast.py             # Legacy: single-run NWP forecast fetcher
│   ├── fetch_history.py        # 61-day historical forecasts (4 models)
│   ├── fetch_history_lead.py   # 61-day lead-time forecasts (Previous Runs API)
│   ├── fetch_current.py        # 72-hour live forecasts
│   ├── fetch_actuals.py        # ERA5 reanalysis fetcher (archive API)
│   └── validate_data.py        # Data integrity diagnostics (12 checks)
├── data/
│   ├── cities.csv              # 45 Indian cities (lat/lon)
│   ├── forecast_history.csv    # Final: historical forecasts
│   ├── actual_history.csv      # Final: ERA5 reanalysis reference
│   ├── forecast_history_lead.csv # Final: lead-time forecasts
│   └── forecast_current.csv    # Final: live 72-hour forecasts
├── database/
│   └── weather.db              # SQLite DB (4 tables from final CSVs)
├── app.py                      # Flask application entry point
├── save_db.py                  # CSV → SQLite loader
├── requirements.txt
└── README.md
```
