# Hybrid AI–NWP Forecast Blending Framework

## Member 1: Data Pipeline & Preprocessing Documentation

This document describes the datasets, data pipeline flow, file structures, schemas, and SQLite database storage produced by Member 1 for the **Hybrid AI–NWP Forecast Blending Framework**.

---

# Data Pipeline Overview

The data collection, preprocessing, and storage workflow operates in five sequential stages:

$$\text{Open-Meteo APIs} \longrightarrow \text{Raw Forecasts} \longrightarrow \text{Cleaning \& Feature Engineering} \longrightarrow \text{Processed Dataset} \longrightarrow \text{SQLite Database}$$

1. **Open-Meteo APIs**: 6-day hourly weather forecasts are queried across multiple Numerical Weather Prediction (NWP) models (`ecmwf_ifs04`, `gfs_seamless`, `icon_seamless`, `gem_seamless`).
2. **Raw Forecasts**: Model-specific raw datasets are stored separately in `data/raw_forecasts/`.
3. **Cleaning**: Data parsing, deduplication, sorting, non-negative clipping, missing value forward-fill imputation, and feature engineering (`lead_hours`) are executed.
4. **Processed Dataset**: Preprocessed individual model files and a unified merged dataset (`all_models_clean.csv`) are generated in `data/processed/`.
5. **SQLite Database**: Datasets are stored in `database/weather.db` under `forecast_data` and `actual_data` tables for downstream analysis.

---

# Folder Structure

```text
data/
├── raw_forecasts/
│   ├── ecmwf.csv
│   ├── gfs.csv
│   ├── icon.csv
│   └── gem.csv
│
├── processed/
│   ├── ecmwf_clean.csv
│   ├── gfs_clean.csv
│   ├── icon_clean.csv
│   ├── gem_clean.csv
│   └── all_models_clean.csv
│
├── actual_weather.csv
└── cities.csv
```

---

# Dataset Descriptions

- `cities.csv`: Master configuration file containing target cities and their latitude/longitude coordinates.
- `raw_forecasts/*.csv`: Raw 6-day hourly forecast datasets retrieved directly from Open-Meteo for each individual NWP model (`ecmwf`, `gfs`, `icon`, `gem`).
- `processed/*_clean.csv`: Preprocessed individual model datasets with standardized timestamps, deduplication, numeric validation, missing value imputation, and engineered `lead_hours`.
- `processed/all_models_clean.csv`: Merged and cleaned dataset combining all preprocessed NWP models into a single file ready for model training.
- `actual_weather.csv`: Ground-truth actual weather observations for evaluating NWP and AI model forecast accuracy.

---

# Schema for all_models_clean.csv

| Column | Type | Description |
| :--- | :--- | :--- |
| `city` | string | Name of the target city/location |
| `model` | string | Identifier of the NWP model (`ecmwf`, `gfs`, `icon`, `gem`) |
| `datetime` | datetime | Timestamp of the forecast hour (`YYYY-MM-DDTHH:MM:SS`) |
| `lead_hours` | integer | Forecast lead time in hours relative to the initial timestamp for each city |
| `temperature` | float | Air temperature at 2 meters altitude (°C) |
| `rainfall` | float | Precipitation amount (mm) |
| `wind_speed` | float | Surface wind speed at 10 meters altitude (km/h) |

---

# Schema for actual_weather.csv

| Column | Type | Description |
| :--- | :--- | :--- |
| `city` | string | Name of the target city/location |
| `datetime` | datetime | Timestamp of the actual weather observation |
| `actual_temperature` | float | Observed ground-truth air temperature (°C) |
| `actual_rainfall` | float | Observed ground-truth precipitation (mm) |
| `actual_wind` | float | Observed ground-truth wind speed (km/h) |

---

# SQLite Tables

The SQLite database stored at `database/weather.db` contains two primary tables:

1. `forecast_data`: Contains multi-model forecast records with numerical predictions across lead hours.
2. `actual_data`: Contains ground-truth weather observations corresponding to forecast timestamps.

### Downstream Usage
- **Member 2**: Consumes `forecast_data` and `actual_data` tables to compute Root Mean Square Error (RMSE), bias, and performance metrics across NWP models for training hybrid machine learning blending algorithms.
- **Member 3**: Queries `database/weather.db` to feed the interactive web dashboard visualization interface.
