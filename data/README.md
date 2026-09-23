# Hybrid AI–NWP Forecast Blending Framework

## Member 1: Data Pipeline & Preprocessing Documentation

This document describes the datasets produced by Member 1 for the
**Hybrid AI–NWP Forecast Blending Framework**.

---

# Data Pipeline Overview

```
Open-Meteo Historical Forecast API  ──►  forecast_history.csv   (60 days, 4 models)
Open-Meteo Archive API (ERA5)       ──►  actual_history.csv     (60 days, ERA5 reanalysis)
Open-Meteo Forecast API             ──►  forecast_current.csv   (72 hours, 4 models)
```

1. **Historical Forecasts** (`api/fetch_history.py`): Retrieves 60 days of hourly
   forecasts from four NWP models via the Open-Meteo Historical Forecast API.
2. **ERA5 Observations** (`api/fetch_history.py`): Retrieves corresponding ERA5
   reanalysis data via the Open-Meteo Archive API for the same 60-day window.
3. **Current Forecasts** (`api/fetch_current.py`): Retrieves the next 72 hours
   of forecasts from the same four NWP models via the Open-Meteo Forecast API.
4. **Validation** (`api/validate_data.py`): Runs 7 integrity checks on all
   three datasets (shape, dates, gaps, matching rows, diurnal sanity, error
   metrics, NaN detection, and model-name consistency).

NWP models used: `ecmwf_ifs025`, `gfs_seamless`, `icon_seamless`, `gem_seamless`

**No forward-fill, interpolation, or imputation is applied.** Missing values
are reported by the validation script and left as-is for the ML member to
handle during model training.

---

# Folder Structure

```text
data/
├── forecast_history.csv      ← 60-day historical forecasts (4 models × 45 cities)
├── actual_history.csv        ← 60-day ERA5 reanalysis observations (45 cities)
├── forecast_current.csv      ← 72-hour live forecasts (4 models × 45 cities)
├── cities.csv                ← Master list of 45 Indian cities (lat/lon)
│
├── raw_forecasts/            ← LEGACY (single-run forecasts, not used)
├── processed/                ← LEGACY (not used)
└── actual_weather.csv        ← DEPRECATED: contains future dates, likely a
                                 forecast not real observations. Do NOT use
                                 as ground truth.
```

---

# Final Datasets

## 1. `forecast_history.csv`

60-day historical hourly forecasts from 4 NWP models for 45 Indian cities.
Produced by `api/fetch_history.py`.

| Column | Type | Description |
| :--- | :--- | :--- |
| `city` | string | City name |
| `model` | string | NWP model identifier (`ecmwf_ifs025`, `gfs_seamless`, `icon_seamless`, `gem_seamless`) |
| `datetime` | string | Forecast timestamp in IST (`YYYY-MM-DDTHH:MM`) |
| `temperature` | float | Air temperature at 2 m (°C) |
| `rainfall` | float | Precipitation (mm) |
| `wind_speed` | float | Wind speed at 10 m (km/h) |

**Rows:** ~263,520 (45 cities × 4 models × ~1,464 hours)

---

## 2. `actual_history.csv`

60-day hourly ERA5 reanalysis data for 45 Indian cities, covering the same
date range as `forecast_history.csv`. Produced by `api/fetch_history.py`.

| Column | Type | Description |
| :--- | :--- | :--- |
| `city` | string | City name |
| `datetime` | string | Observation timestamp in IST (`YYYY-MM-DDTHH:MM`) |
| `actual_temperature` | float | ERA5 temperature at 2 m (°C) |
| `actual_rainfall` | float | ERA5 precipitation (mm) |
| `actual_wind` | float | ERA5 wind speed at 10 m (km/h) |

**Rows:** ~65,880 (45 cities × ~1,464 hours)

> **Note:** ERA5 reanalysis is a model-based reconstruction, not raw station
> observations. It is the best available gridded reference for these cities.

---

## 3. `forecast_current.csv`

Next 72 hours of live forecasts from the same 4 NWP models for 45 cities.
Produced by `api/fetch_current.py`. Re-run this script to refresh.

| Column | Type | Description |
| :--- | :--- | :--- |
| `city` | string | City name |
| `model` | string | NWP model identifier (same 4 as history) |
| `datetime` | string | Forecast timestamp in IST (`YYYY-MM-DDTHH:MM`) |
| `temperature` | float | Forecast temperature at 2 m (°C) |
| `rainfall` | float | Forecast precipitation (mm) |
| `wind_speed` | float | Forecast wind speed at 10 m (km/h) |

**Rows:** 12,960 (45 cities × 4 models × 72 hours)

---

## 4. `cities.csv`

Master list of 45 Indian cities with coordinates.

| Column | Type | Description |
| :--- | :--- | :--- |
| `city` | string | City name |
| `latitude` | float | Latitude (decimal degrees) |
| `longitude` | float | Longitude (decimal degrees) |

---

# Validation

Run `python api/validate_data.py` to execute all 7 checks:

| Check | Description |
| :--- | :--- |
| 1 | Shape, columns, missing values, duplicates |
| 2 | Date ranges and future-date detection |
| 3 | Hourly gap analysis per city/model |
| 4 | Row matching between forecasts and actuals |
| 5 | Diurnal temperature peak hour sanity |
| 6 | Per-model MAE/RMSE against ERA5 |
| 7 | NaN detection and model-name consistency |

---

# Known Limitation: Lead-Time Bias in `forecast_history.csv`

> **Important:** The Open-Meteo **Historical Forecast API** does _not_ return
> forecasts keyed by issue time + lead time. Instead it **stitches the first
> hours of each successive model run** into a single seamless timeseries.
>
> Because the four models we use update every 6–12 hours, every timestamp in
> `forecast_history.csv` is effectively a **very short-range forecast (≈ 0–6 h
> lead time for ECMWF/GFS/ICON, ≈ 0–12 h for GEM)**. There is no mix of
> short-range and long-range predictions, and no `lead_hours` column—because
> the true lead time cannot be determined from this API.
>
> **Consequences:**
>
> - Historical error metrics (MAE/RMSE) represent **best-case, short-lead
>   model performance**, not the full degradation at 24 h, 48 h, or 72 h.
> - The suspiciously low ECMWF MAE (~0.45 °C) is partly because ERA5 and
>   ECMWF IFS share the same underlying model; comparing them at 0–6 h is
>   nearly self-comparison.
> - An ML blending model trained on this data will learn **short-range
>   correction patterns only**.
>
> For true lead-time-stratified evaluation, use the
> [Previous Runs API](https://open-meteo.com/en/docs/previous-runs-api)
> (fixed 1–7 day offsets) or the
> [Single Runs API](https://open-meteo.com/en/docs/single-runs-api)
> (full individual model runs).
>
> **Source:**
> [Open-Meteo Historical Forecast API docs](https://open-meteo.com/en/docs/historical-forecast-api) —
> _"A continuous hourly timeseries built by stitching the first hours of each
> successive model run."_

---

# Deprecated Files (Do NOT Use)

| File | Reason |
| :--- | :--- |
| `actual_weather.csv` | Contains dates beyond today (forecast data, not observations). Not real ground truth. |
| `raw_forecasts/*.csv` | Single forecast run only, no lead-time or issue-time information. |
| `processed/*_clean.csv` | Built from single-run data with forward-fill imputation. Not suitable for training. |
| `processed/all_models_clean.csv` | Same issue; `lead_hours` is a row index (0–2327), not a real lead time. |

---

# Downstream Usage

- **ML Member**: Join `forecast_history.csv` with `actual_history.csv` on
  `(city, datetime)` to compute per-model errors and train blending models.
  Use `forecast_current.csv` for live inference.
- **Dashboard Member**: Query the final CSVs to display live and historical
  forecast comparisons.
