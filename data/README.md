# Member 1: Data Pipeline & Preprocessing Documentation

This document describes the datasets produced by Member 1 for the
**Hybrid AI–NWP Forecast Blending Framework**.

---

# Data Pipeline Overview

```
Open-Meteo Historical Forecast API  ──►  forecast_history.csv       (61 days, 4 models)
Open-Meteo Archive API (ERA5)       ──►  actual_history.csv         (61 days, ERA5 reanalysis)
Open-Meteo Previous Runs API        ──►  forecast_history_lead.csv  (61 days, 4 models × 3 lead offsets)
Open-Meteo Forecast API             ──►  forecast_current.csv       (72 hours, 4 models)
```

1. **Historical Forecasts** (`api/fetch_history.py`): Retrieves 61 days of hourly
   forecasts from four NWP models via the Open-Meteo Historical Forecast API.
2. **ERA5 Reanalysis Reference** (`api/fetch_history.py`): Retrieves corresponding
   ERA5 reanalysis data via the Open-Meteo Archive API for the same date window.
3. **Lead-Time Forecasts** (`api/fetch_history_lead.py`): Retrieves forecasts at
   1-day, 2-day, and 3-day lead offsets via the Open-Meteo Previous Runs API.
4. **Current Forecasts** (`api/fetch_current.py`): Retrieves the next 72 hours
   of forecasts from the same four NWP models via the Open-Meteo Forecast API.
5. **Validation** (`api/validate_data.py`): Runs 12 integrity checks on all
   four datasets (shape, dates, gaps, matching rows, diurnal sanity, error
   metrics, NaN detection, model-name consistency, lead data integrity).

NWP models used: `ecmwf_ifs025`, `gfs_seamless`, `icon_seamless`, `gem_seamless`

**No forward-fill, interpolation, or imputation is applied.** Missing values
are reported by the validation script and left as-is for the ML member to
handle during model training.

---

# Folder Structure

```text
data/
├── forecast_history.csv       ← 61-day historical forecasts (4 models × 45 cities)
├── actual_history.csv         ← 61-day ERA5 reanalysis reference (45 cities)
├── forecast_history_lead.csv  ← 61-day lead-time forecasts (4 models × 3 leads × 45 cities)
├── forecast_current.csv       ← 72-hour live forecasts (4 models × 45 cities)
├── cities.csv                 ← Master list of 45 Indian cities (lat/lon)
│
├── raw_forecasts/             ← DEPRECATED: single-run forecasts, not used
├── processed/                 ← DEPRECATED: not used
├── actual_weather.csv         ← DEPRECATED: noise-added forecast data, not real observations
├── actual_raw.csv             ← DEPRECATED: partial/legacy actuals
└── forecast_raw.csv           ← DEPRECATED: single-run forecast from old pipeline
```

---

# Final Datasets

## 1. `forecast_history.csv`

61-day historical hourly forecasts from 4 NWP models for 45 Indian cities.
Produced by `api/fetch_history.py`.

| Column | Type | Unit | Description |
| :--- | :--- | :--- | :--- |
| `city` | string | — | City name |
| `model` | string | — | NWP model identifier (`ecmwf_ifs025`, `gfs_seamless`, `icon_seamless`, `gem_seamless`) |
| `datetime` | string | `YYYY-MM-DDTHH:MM` | Forecast timestamp in IST |
| `temperature` | float | °C | Air temperature at 2 m |
| `rainfall` | float | mm | Precipitation |
| `wind_speed` | float | km/h | Wind speed at 10 m |

API: `https://historical-forecast-api.open-meteo.com/v1/forecast`
Parameters: `hourly=temperature_2m,precipitation,wind_speed_10m`, `models=ecmwf_ifs025,...`, `timezone=Asia/Kolkata`
Period: `start_date=2026-07-18`, `end_date=2026-09-16`

**Rows:** ~263,520 (45 cities × 4 models × ~1,464 hours)

---

## 2. `actual_history.csv`

61-day hourly ERA5 reanalysis data for 45 Indian cities, covering the same
date range as `forecast_history.csv`. Produced by `api/fetch_history.py`.

| Column | Type | Unit | Description |
| :--- | :--- | :--- | :--- |
| `city` | string | — | City name |
| `datetime` | string | `YYYY-MM-DDTHH:MM` | Timestamp in IST |
| `actual_temperature` | float | °C | ERA5 temperature at 2 m |
| `actual_rainfall` | float | mm | ERA5 precipitation |
| `actual_wind` | float | km/h | ERA5 wind speed at 10 m |

API: `https://archive-api.open-meteo.com/v1/archive`
Parameters: `hourly=temperature_2m,precipitation,wind_speed_10m`, `timezone=Asia/Kolkata`
Period: `start_date=2026-07-18`, `end_date=2026-09-16`

**Rows:** ~65,880 (45 cities × ~1,464 hours)

> **Note:** ERA5 reanalysis is a model-based atmospheric reconstruction, not raw
> station observations. It is the best available gridded reference for these cities.

---

## 3. `forecast_history_lead.csv`

61-day lead-time-specific forecasts from the Previous Runs API.

Each row represents a forecast for a given valid time (`datetime`) that was
issued a specific number of days before that valid time:

- **`lead_days=1`**: The value predicted **24 hours** before the valid time
- **`lead_days=2`**: The value predicted **48 hours** before the valid time
- **`lead_days=3`**: The value predicted **72 hours** before the valid time

| Column | Type | Unit | Description |
| :--- | :--- | :--- | :--- |
| `city` | string | — | City name |
| `model` | string | — | NWP model identifier |
| `datetime` | string | `YYYY-MM-DDTHH:MM` | Valid time in IST |
| `lead_days` | int | days | 1, 2, or 3 (see explanation above) |
| `temperature` | float | °C | Forecast temperature at 2 m |
| `rainfall` | float | mm | Forecast precipitation |
| `wind_speed` | float | km/h | Forecast wind speed at 10 m |

API: `https://previous-runs-api.open-meteo.com/v1/forecast`
Parameters: `hourly=temperature_2m_previous_day1,...,wind_speed_10m_previous_day3`, `models=ecmwf_ifs025,...`, `timezone=Asia/Kolkata`
Period: `start_date=2026-07-18`, `end_date=2026-09-16`

**Rows:** 790,560 (45 cities × 4 models × 3 leads × ~1,464 hours)

---

## 4. `forecast_current.csv`

Next 72 hours of live forecasts from the same 4 NWP models for 45 cities.
Produced by `api/fetch_current.py`. Re-run this script before each demo.

| Column | Type | Unit | Description |
| :--- | :--- | :--- | :--- |
| `city` | string | — | City name |
| `model` | string | — | NWP model identifier (same 4 as history) |
| `datetime` | string | `YYYY-MM-DDTHH:MM` | Forecast timestamp in IST |
| `temperature` | float | °C | Forecast temperature at 2 m |
| `rainfall` | float | mm | Forecast precipitation |
| `wind_speed` | float | km/h | Forecast wind speed at 10 m |

API: `https://api.open-meteo.com/v1/forecast`
Parameters: `forecast_days=3`, `hourly=temperature_2m,precipitation,wind_speed_10m`, `models=ecmwf_ifs025,...`, `timezone=Asia/Kolkata`

**Rows:** 12,960 (45 cities × 4 models × 72 hours)

---

## 5. `cities.csv`

Master list of 45 Indian cities with coordinates.

| Column | Type | Description |
| :--- | :--- | :--- |
| `city` | string | City name |
| `latitude` | float | Latitude (decimal degrees) |
| `longitude` | float | Longitude (decimal degrees) |

---

# Known Limitation: Lead-Time Bias in `forecast_history.csv`

> **Important:** The Open-Meteo **Historical Forecast API** does _not_ return
> forecasts keyed by issue time + lead time. Instead it **stitches the first
> hours of each successive model run** into a single seamless timeseries.
>
> Because the four models we use update every 6–12 hours, every timestamp in
> `forecast_history.csv` is effectively a short-range forecast from a recent
> model run. The true lead time per timestamp cannot be determined from this
> API alone.
>
> **Consequences:**
>
> - Historical error metrics (MAE/RMSE) represent **best-case, short-lead
>   model performance**, not the full degradation at 24 h, 48 h, or 72 h.
> - The suspiciously low ECMWF MAE (~0.45 °C) is partly because ERA5 and
>   ECMWF IFS share the same underlying model; comparing them at short lead
>   times is nearly self-comparison.
> - An ML blending model trained on this data alone will learn **short-range
>   correction patterns only**.
>
> For true lead-time-stratified evaluation, use `forecast_history_lead.csv`
> which was fetched via the
> [Previous Runs API](https://open-meteo.com/en/docs/previous-runs-api)
> with fixed 1/2/3-day offsets.
>
> **Source:**
> [Open-Meteo Historical Forecast API docs](https://open-meteo.com/en/docs/historical-forecast-api) —
> _"A continuous hourly timeseries built by stitching the first hours of each
> successive model run."_

---

# Validation

Run `python api/validate_data.py` to execute all 12 checks:

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

# Deprecated Files (Do NOT Use)

| File | Reason |
| :--- | :--- |
| `actual_weather.csv` | Generated by adding random noise to forecasts — circular validation. Replaced by `actual_history.csv`. |
| `actual_raw.csv` | Partial/legacy actuals file. |
| `forecast_raw.csv` | Single forecast run from old pipeline (`api/forecast.py`). |
| `raw_forecasts/*.csv` | Single-run per-model CSVs, no lead-time information. |
| `processed/all_models_clean.csv` | Built from single-run data; `lead_hours` column is a row index (0, 1, 2, ...), not a real forecast lead time. |

---

# Downstream Usage

- **ML Member**: Join `forecast_history.csv` (or `forecast_history_lead.csv`) with
  `actual_history.csv` on `(city, datetime)` to compute per-model errors and train
  blending models. Use `forecast_current.csv` for live inference.
- **Dashboard Member**: Query the final CSVs to display live and historical
  forecast comparisons.
