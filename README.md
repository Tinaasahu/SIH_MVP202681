# Hybrid AI–NWP Weather Forecast Blending System

[![Smart India Hackathon 2026](https://img.shields.io/badge/SIH-2026-orange.svg)](https://sih.gov.in/)
[![Problem Statement](https://img.shields.io/badge/Problem%20Statement-26081-blue.svg)](https://sih.gov.in/)
[![Theme](https://img.shields.io/badge/Theme-Disaster%20Management-red.svg)](https://sih.gov.in/)
[![Ministry](https://img.shields.io/badge/Ministry-Earth%20Sciences%20(MoES)-green.svg)](https://moes.gov.in/)
[![Organization](https://img.shields.io/badge/Organization-NCMRWF-teal.svg)](https://www.ncmrwf.gov.in/)

An operational **Hybrid AI–NWP Multi-Model Weather Forecast Blending Platform** developed for **Smart India Hackathon 2026** (Problem Statement ID: **26081**). 

The platform dynamically blends physics-based Numerical Weather Prediction (NWP) model outputs with machine learning and explainable statistical calibration to produce superior forecasts for **temperature**, **precipitation**, **wind speed**, and **extreme weather indicators** across 45 Indian cities up to 72 hours in advance.

---

## Table of Contents

- [Problem Statement & Background](#problem-statement--background)
- [System Architecture](#system-architecture)
- [Core Features & Innovations](#core-features--innovations)
- [Tech Stack](#tech-stack)
- [Data Pipeline & Datasets](#data-pipeline--datasets)
- [Dataset Schemas](#dataset-schemas)
- [Data Integrity & Validation Framework](#data-integrity--validation-framework)
- [AI & Blending Pipeline](#ai--blending-pipeline)
- [REST API Endpoints](#rest-api-endpoints)
- [Setup & Running Instructions](#setup--running-instructions)
- [Project Directory Structure](#project-directory-structure)
- [Deprecated Files](#deprecated-files-do-not-use)

---

## Problem Statement & Background

**Organization:** Ministry of Earth Sciences (MoES)  
**Department:** National Centre for Medium Range Weather Forecasting (NCMRWF)  
**Challenge:** Different forecasting systems perform differently depending on region, season, lead time, and weather situation. Physical NWP models (ECMWF, GFS, ICON, GEM), ensemble systems, and machine learning models each possess distinct localized strengths and vulnerabilities.

This project delivers a hybrid blending framework that:
1. Assigns **adaptive weights** to forecast sources based on historical skill, forecast lead time ($D+1, D+2, D+3$), and regional geography.
2. Calibrates physical forecasts using **supervised machine learning (Random Forest)** to eliminate residual systematic terrain biases.
3. Provides an **Explainable Confidence Engine (ECE)** (0–100%) so forecasters understand model consensus and uncertainty.
4. Delivers actionable disaster management decision support via a **Risk Priority Index (RPI)** tailored for civil defense authorities (NDRF / SDMAs).
5. Provides an **automated operational workflow** with a 16-step CLI pipeline, self-refreshing cache manager, and live Next.js command dashboard.

---

## System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        DATA INGESTION (Open-Meteo Public APIs)                        │
├──────────────────────────┬──────────────────────────┬──────────────────────────────────┤
│ Previous Runs API        │ Archive API              │ Historical & Forecast APIs       │
│ (Lead D+1, D+2, D+3)     │ (ERA5 Reanalysis Actuals)│ (61-day baseline + 72h live)     │
└────────────┬─────────────┴────────────┬─────────────┴────────────────┬─────────────────┘
             │                          │                              │
             ▼                          ▼                              ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          DATA PERSISTENCE & INTEGRITY CHECK                            │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • forecast_history_lead.csv (790k rows)    • actual_history.csv (65.8k rows)           │
│ • forecast_current.csv (12.9k rows)        • weather.db (SQLite Database)              │
│ • api/validate_data.py (12-point automated diagnostic suite)                           │
└───────────────────────────────────────┬────────────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                           AI BLENDING & INTELLIGENCE ENGINE                            │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Align & Preprocess (align_lead.py)                                                  │
│ 2. Compute Verification Skill: RMSE & MAE vs ERA5 per lead day (skill_lead.py)         │
│ 3. Compute Lead-Adaptive Inverse-RMSE Weights (weights_lead.py)                        │
│ 4. Generate Blended Consensus Forecasts (blend_lead.py, blend_current.py)              │
│ 5. Machine Learning Residual Calibration (Random Forest Regressors: train.py)          │
│ 6. Explainable Confidence Engine: 50% Skill + 30% Agreement + 20% Lead Decay           │
│ 7. Multi-Hazard Alerting Engine: Heatwave, Cloudburst, Windstorm (alerts.py)           │
└───────────────────────────────────────┬────────────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                       FLASK BACKEND REST SERVICE (app.py)                              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Endpoints: /api/forecast, /api/weights, /api/skill, /api/confidence, /api/alerts     │
│ • Decision Matrix: /api/rpi (Risk Priority Index 0-100 for Disaster Operations)        │
│ • Cache Manager: Auto-refreshes 72h operational forecast window on 6h TTL              │
│ • Dual-Engine Parsing: Accelerated pandas with native standard library csv fallback    │
└───────────────────────────────────────┬────────────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                  NEXT.JS 15 OPERATIONAL DASHBOARD (frontend/)                          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Atmosphere Immersion Layer: Real-time particle rain, lightning, and heat hazes       │
│ • Interactive Leaflet Weather Map & Model Dominance Visualizer                         │
│ • Lead-Time Model Comparison & Model Attribution Breakdown Charts                      │
│ • Disaster Management Portal: NDRF Action Directives & District Risk Matrix            │
│ • Fail-Safe Design: Multi-port probing (:5001/:5000) & typed offline mock fallback     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Features & Innovations

### 1. Lead-Time Aware Dynamic Weighting
Unlike simple ensemble averaging that treats models equally regardless of horizon, our pipeline uses the **Previous Runs API** to train on genuine forecast degradation. Independent weight vectors are assigned for **Day 1 (0–24h)**, **Day 2 (24–48h)**, and **Day 3 (48–72h)**:
$$\text{Weight}_{m, v, l} = \frac{\frac{1}{\text{RMSE}_{m, v, l}^2}}{\sum_k \frac{1}{\text{RMSE}_{k, v, l}^2}}$$

### 2. Hybrid ML Residual Correction
A dynamic weighted average is combined with scikit-learn **Random Forest Regressors** (`rf_temperature.joblib`, `rf_rainfall.joblib`, `rf_wind_speed.joblib`) trained on spatial, diurnal, and inter-model spread features to calibrate out systematic microclimate biases.

### 3. Transparent Explainable Confidence Engine (ECE)
To eliminate the "black-box trust deficit" in operational forecasting, every forecast timestamp is accompanied by a transparent 0–100% confidence metric:
$$\text{Confidence} = 0.50 \times \text{Skill Score} + 0.30 \times \text{Inter-Model Agreement} + 0.20 \times \text{Lead Horizon}$$
- **Skill Score:** Historical performance of the leading model for that city and lead day.
- **Inter-Model Agreement:** Inverse standard deviation ($\sigma$) across the 4 NWP predictions.
- **Lead Horizon:** Temporal decay function ($100\%$ on Day 1, decaying down to $60\%$ on Day 3).

### 4. Disaster Management Risk Priority Index (RPI)
Directly aligned with the hackathon's **Disaster Management** theme, the platform calculates an emergency operations index for government disaster agencies (NDRF / SDMAs):
$$\text{RPI} = 0.35 \times \text{RainRisk} + 0.25 \times \text{HeatRisk} + 0.20 \times \text{WindRisk} + 0.20 \times \text{Confidence}$$
- **0–30 (Low):** Standard monitoring.
- **31–55 (Moderate):** Local civic advisory, drainage clearing.
- **56–75 (High):** Orange alert, shelter readiness, emergency personnel standby.
- **76–100 (Critical):** Red warning, NDRF battalion pre-positioning, evacuation advisories.

### 5. Atmospheric Immersion UI
The Next.js dashboard features an interactive **Atmosphere Layer** built with HTML5 Canvas and CSS animations that renders realistic environmental conditions (particle rain, lightning flashes, wind streaks, amber heatwave shimmering) corresponding to the selected city's active forecast.

---

## Tech Stack

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 TECHNOLOGY LANDSCAPE                                    │
├──────────────────────────┬──────────────────────────┬───────────────────────────────────┤
│ Frontend & UX            │ Backend & Serving        │ Machine Learning & Statistics     │
│ • Next.js 15 (App Router)│ • Python 3.10+ / Flask 3 │ • Scikit-learn (Random Forest)    │
│ • React 19 / TypeScript 5│ • Dual-Engine (Pandas/CSV)│ • NumPy / Inverse-RMSE Weighting │
│ • Tailwind CSS v4        │ • SQLite3 Relational DB  │ • Explainable Confidence Engine   │
│ • HTML5 Canvas Particles │ • RESTful JSON API       │ • Joblib Model Serialization      │
│ • Leaflet / Recharts     │ • Multi-Port Auto-Detect │ • IMD Hazard Alerting Engine      │
└──────────────────────────┴──────────────────────────┴───────────────────────────────────┘
```

<p align="left">
  <!-- Frontend -->
  <img src="https://img.shields.io/badge/Next.js_15-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript_5-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS_v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Leaflet-199900?style=for-the-badge&logo=leaflet&logoColor=white" alt="Leaflet" />
  <br>
  <!-- Backend & ML -->
  <img src="https://img.shields.io/badge/Python_3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Flask_3.0+-000000?style=for-the-badge&logo=flask&logoColor=white" alt="Flask" />
  <img src="https://img.shields.io/badge/scikit--learn-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white" alt="Scikit-Learn" />
  <img src="https://img.shields.io/badge/Pandas-150458?style=for-the-badge&logo=pandas&logoColor=white" alt="Pandas" />
  <img src="https://img.shields.io/badge/NumPy-013243?style=for-the-badge&logo=numpy&logoColor=white" alt="NumPy" />
  <img src="https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
</p>

### Detailed Architectural Tier Breakdown

#### 1. Frontend & Visual Analytics Tier (`frontend/`)
- **Next.js 15 (App Router)**: Powers high-performance server/client component rendering, streaming state hydration, and modular page routing (`/forecast`, `/model-intelligence`, `/extreme-weather`, `/rpi`, `/model-performance`, `/data-health`).
- **React 19 & TypeScript 5**: Enforces strict compile-time type safety across meteorological metrics, data sources, and component props.
- **Tailwind CSS v4 & PostCSS**: Modern, utility-first CSS layout with customized atmospheric glassmorphism themes and responsive multi-column operational command center grids.
- **HTML5 Canvas Atmosphere Engine (`AtmosphereLayer.tsx`)**: Custom-engineered real-time particle rendering engine simulating localized atmospheric dynamics (wind streaks, rain density, thunderstorm flash cycles, and convective heatwave hazes).
- **Leaflet & React-Leaflet (`WeatherMap/`)**: Renders interactive, pan-and-zoom GIS spatial maps across India with custom markers color-coded by model dominance, temperature, rainfall, and hazard level.
- **Recharts 3.10**: Delivers high-density timeseries curves comparing raw NWP model forecasts against blended consensus predictions over 24h, 48h, and 72h lead horizons.
- **Framer Motion**: Smooth micro-interactions, layout transitions, and hazard drawer alert animations.
- **Lucide React**: Curated, modern iconography for meteorological indicators and emergency severity badges.

#### 2. Backend & Operational API Tier (`app.py`, `api/`)
- **Python 3.10+ & Flask 3.0+**: Lightweight, high-throughput microframework serving REST endpoints with sub-10ms response times for cached forecast records.
- **Dual-Engine Graceful Fallback**: Native engine automatically detects available Python runtime libraries—accelerating lookups via `pandas` when available while gracefully falling back to standard library `csv` to guarantee zero-crash execution across minimal environments.
- **Dynamic Port & Base-URL Auto-Discovery**: Client integration layer automatically probes both `http://localhost:5000/api` and `http://localhost:5001/api` with timeout-gated health queries to effortlessly bypass macOS AirPlay port conflicts.
- **Cache Management Subsystem (`api/cache_manager.py`)**: TTL-governed cache manager that checks forecast freshness on startup and automatically triggers fresh 72-hour operational ingestion cycles every 6 hours.

#### 3. AI, Machine Learning & Statistical Modeling (`ai/`)
- **Scikit-Learn 1.3+**: Implements supervised `RandomForestRegressor` models (`rf_temperature`, `rf_rainfall`, `rf_wind_speed`) trained on multi-model interactions and spatial/diurnal features to perform residual non-linear bias correction.
- **Joblib**: High-performance persistence and serialization for trained scikit-learn model artifacts.
- **NumPy 1.26+ & Pandas 2.1+**: Vectorized array computation and timeseries data alignment across hundreds of thousands of hourly records.
- **Lead-Adaptive Dynamic Weighting Engine (`weights_lead.py`)**: Computes inverse-RMSE weights for each model conditioned on `(city, variable, lead_day)` to dynamically penalize faster-decaying models as forecast horizons extend.
- **Explainable Confidence Engine (ECE) (`confidence_engine.py`)**: Calculates 0–100% confidence scores deconstructed into verified historical skill (50%), inter-model consensus spread (30%), and forecast lead decay (20%).
- **Disaster Risk Priority Index (RPI) Matrix (`app.py`)**: Synthesizes multi-hazard threat levels into a singular 0–100 operational metric with auto-generated emergency response protocols for disaster mitigation.

#### 4. Data Ingestion & Integrity Framework (`api/`, `data/`)
- **Open-Meteo REST APIs**:
  - *Historical Forecast API*: 61 days of continuous hourly model outputs across ECMWF IFS, GFS, ICON, and GEM.
  - *Previous Runs API*: Multi-lead archived runs capturing true issuance offsets ($D+1, D+2, D+3$).
  - *Archive API (ERA5 Reanalysis)*: ECMWF gridded atmospheric ground-truth reference data (0.25° resolution).
  - *Forecast API*: Real-time rolling 72-hour operational forecast cycles.
- **12-Point Automated Diagnostics (`api/validate_data.py`)**: Automated verification testing checking for diurnal solar noon inflection sanity, continuous timestamps (zero gaps), NaN distributions, and table alignment.
- **SQLite3 Database (`database/weather.db`)**: Relational structured storage linking forecast runs, actuals, and model skill scores.


---

## Data Pipeline & Datasets

```
Open-Meteo Historical Forecast API  ──►  forecast_history.csv       (61 days, 4 NWP models)
Open-Meteo Archive API (ERA5)       ──►  actual_history.csv         (61 days, ERA5 reanalysis)
Open-Meteo Previous Runs API        ──►  forecast_history_lead.csv  (61 days, 4 models × 3 lead offsets)
Open-Meteo Forecast API             ──►  forecast_current.csv       (72 hours, 4 NWP models)
```

### Verified Active Datasets

| File | Source API | Period | Timezone | Rows |
| :--- | :--- | :--- | :--- | :--- |
| `data/forecast_history.csv` | [Historical Forecast API](https://open-meteo.com/en/docs/historical-forecast-api) | 2026-07-18 → 2026-09-16 (61 days) | Asia/Kolkata (IST) | 263,520 |
| `data/actual_history.csv` | [Archive API](https://open-meteo.com/en/docs/historical-weather-api) (ERA5) | 2026-07-18 → 2026-09-16 (61 days) | Asia/Kolkata (IST) | 65,880 |
| `data/forecast_history_lead.csv` | [Previous Runs API](https://open-meteo.com/en/docs/previous-runs-api) | 2026-07-18 → 2026-09-16 (61 days) | Asia/Kolkata (IST) | 790,560 |
| `data/forecast_current.csv` | [Forecast API](https://open-meteo.com/en/docs) | Next 72 hours from run time | Asia/Kolkata (IST) | 12,960 |

- **4 NWP Models:** `ecmwf_ifs025` (0.25°), `gfs_seamless` (0.25°), `icon_seamless` (0.25°), `gem_seamless` (0.25°)
- **45 Indian Cities:** Spanning all major meteorological subdivisions (see `data/cities.csv`)
- **Variables Evaluated:** 2m Temperature (°C), Precipitation/Rainfall (mm), 10m Wind Speed (km/h)

---

## Dataset Schemas

### `data/forecast_history_lead.csv` (Primary Training Data)
Forecasts issued at specific prior lead offsets.
| Column | Type | Unit | Description |
| :--- | :--- | :--- | :--- |
| `city` | string | — | City name |
| `model` | string | — | NWP model identifier (`ecmwf_ifs025`, `gfs_seamless`, etc.) |
| `datetime` | string | `YYYY-MM-DDTHH:MM` | Valid time in IST |
| `lead_days` | int | days | `1` = 24h prior, `2` = 48h prior, `3` = 72h prior |
| `temperature` | float | °C | 2m Air temperature |
| `rainfall` | float | mm | Hourly precipitation |
| `wind_speed` | float | km/h | 10m Wind speed |

### `data/actual_history.csv` (Ground Truth Verification)
ERA5 atmospheric reanalysis reference data.
| Column | Type | Unit | Description |
| :--- | :--- | :--- | :--- |
| `city` | string | — | City name |
| `datetime` | string | `YYYY-MM-DDTHH:MM` | Timestamp in IST |
| `actual_temperature` | float | °C | ERA5 2m temperature |
| `actual_rainfall` | float | mm | ERA5 precipitation |
| `actual_wind` | float | km/h | ERA5 10m wind speed |

### `data/forecast_current.csv` (Live 72-Hour Operational Ingestion)
Forecasts for the rolling 72-hour operational window across all 4 models and 45 cities.

---

## Data Integrity & Validation Framework

Before running model training or blending, data integrity is verified using [`api/validate_data.py`](file:///Users/utkarshagrawal/Desktop/SIH202681/SIH_MVP202681/api/validate_data.py) across 12 diagnostic checks:

| Check # | Description | Criteria |
| :---: | :--- | :--- |
| **1** | Shape, columns, missing values, duplicates | Required columns present, zero duplicate rows |
| **2** | Date ranges and future-date leakage | Timestamps strictly bounded to valid historical window |
| **3** | Hourly gap analysis per city/model | Zero missing hours in the 61-day continuous timeseries |
| **4** | Row matching between forecasts and actuals | Exact 1-to-1 timestamp alignment between forecasts and ERA5 |
| **5** | Diurnal temperature peak hour sanity | Peak solar heating must occur between 13:00 and 16:00 IST |
| **6** | Per-model baseline MAE/RMSE against ERA5 | Sanity checks on physical error bounds |
| **7** | NaN detection and model-name consistency | Standardized identifiers without null values |
| **8** | `forecast_history_lead.csv` row count | Verifies full 790,560 rows ($45\text{ cities} \times 61\text{ days} \times 24\text{h} \times 4\text{ models} \times 3\text{ leads}$) |
| **9** | NaN per `(model, lead_days)` in lead data | Audits null counts across every lead slice |
| **10** | `(city, datetime)` match between lead and actuals | Cross-table join integrity |
| **11** | Temperature MAE/RMSE per model per `lead_days` | Confirms expected physical error growth as lead time increases |
| **12** | `lead_days` column values and model consistency | Exactly `{1, 2, 3}` present for all models |

---

## AI & Blending Pipeline

The entire AI workflow is automated via [`ai/pipeline.py`](file:///Users/utkarshagrawal/Desktop/SIH202681/SIH_MVP202681/ai/pipeline.py), which executes the following 16 stages in sequence:

```bash
python ai/pipeline.py
```

| Step | Script | Description |
| :---: | :--- | :--- |
| **1** | `ai/preprocessing.py` | Cleans and standardizes raw forecast timeseries |
| **2** | `ai/align.py` | Joins single-run forecasts with ERA5 actuals |
| **3** | `ai/skill.py` | Computes historical RMSE and MAE per model |
| **4** | `ai/weights.py` | Computes inverse-error baseline model weights |
| **5** | `ai/blend.py` | Generates baseline blended predictions |
| **6** | `ai/preprocessing_lead.py` | Cleans multi-lead Previous Runs timeseries |
| **7** | `ai/align_lead.py` | Aligns multi-lead forecasts with ERA5 reanalysis ground truth |
| **8** | `ai/skill_lead.py` | Computes RMSE/MAE per `(city, variable, lead_day)` |
| **9** | `ai/weights_lead.py` | Computes dynamic lead-adaptive weights ($D+1, D+2, D+3$) |
| **10** | `ai/blend_lead.py` | Generates historical blended forecast across lead times |
| **11** | `ai/blend_current.py` | Applies lead-time weights to current 72h live forecast window |
| **12** | `ai/features.py` | Generates temporal, cyclical, and multi-model interaction features |
| **13** | `ai/baseline.py` | Evaluates baseline persistence and simple ensemble metrics |
| **14** | `ai/train.py` | Trains Random Forest models (skips automatically if models exist) |
| **15** | `ai/predict.py` | Produces calibrated hybrid ML predictions (`hybrid_forecast.csv`) |
| **16** | `ai/alerts.py` | Evaluates extreme weather thresholds and generates hazard alerts |

*Note: The Explainable Confidence Engine can be run anytime via `python ai/confidence_engine.py` to regenerate `outputs/confidence_scores.csv`.*

---

## REST API Endpoints

The Flask backend (`app.py`) runs on port `5000` (or `5001` if macOS AirPlay conflicts):

| Endpoint | Method | Query Parameters | Description |
| :--- | :---: | :--- | :--- |
| `/` | `GET` | — | Service health, version, engine status (`pandas` or `standard-csv`) |
| `/api/forecast` | `GET` | `city`, `lead_days` | Blended predictions alongside individual NWP forecasts |
| `/api/weights` | `GET` | `city`, `variable`, `lead_days` | Model weights per model, variable, and lead time |
| `/api/skill` | `GET` | `city`, `variable`, `lead_days` | Verified RMSE/MAE scores against ERA5 ground truth |
| `/api/confidence` | `GET` | `city`, `lead_days` | 0–100% confidence scores with skill/agreement/lead breakdown |
| `/api/alerts` | `GET` | `city` | Active heatwave, heavy rainfall, and high wind warnings |
| `/api/cities` | `GET` | — | List of all 45 supported Indian cities with lat/long and state |
| `/api/rpi` | `GET` | `city` *(optional)* | Risk Priority Index (0–100) and disaster response directives |
| `/api/rpi/map` | `GET` | — | GeoJSON-ready summary of city threat levels for map rendering |
| `/api/metadata` | `GET` | — | Pipeline run metadata, timestamp freshness, and row counts |

---

## Setup & Running Instructions

### 1. Prerequisites
- Python 3.10 or higher
- Node.js 18 or higher with npm

### 2. Backend Setup & Pipeline Execution

```bash
# 1. Clone repository
git clone https://github.com/Tinaasahu/SIH_MVP202681.git
cd SIH_MVP202681

# 2. Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Verify data integrity (All 12 checks should pass)
python api/validate_data.py

# 5. Run the complete AI blending pipeline
python ai/pipeline.py

# 6. Generate explainable confidence scores
python ai/confidence_engine.py

# 7. Start the Flask REST API server
python app.py
```
*The API will be available at `http://localhost:5000` (or `http://localhost:5001`).*

### 3. Frontend Setup & Launch

Open a separate terminal window:

```bash
cd frontend

# Install Node dependencies
npm install

# Start development server
npm run dev
```
*Open [http://localhost:3000](http://localhost:3000) in your browser.*

---

## Project Directory Structure

```
SIH_MVP202681/
├── ai/                         # AI, ML & Blending Algorithms
│   ├── alerts.py               # Extreme weather threshold engine
│   ├── align.py / align_lead.py# Joins forecasts with ERA5 actuals
│   ├── blend.py / blend_lead.py# Dynamic inverse-error blending
│   ├── blend_current.py        # Blends live 72-hour operational window
│   ├── confidence_engine.py    # Explainable Confidence Engine (0-100%)
│   ├── features.py             # Feature engineering for ML
│   ├── pipeline.py             # Master 16-step orchestrated runner
│   ├── predict.py              # ML inference with Random Forest
│   ├── skill.py / skill_lead.py# RMSE/MAE evaluation against ERA5
│   ├── train.py                # Random Forest model training
│   └── weights.py / weights_lead.py # Lead-adaptive weight computation
├── api/                        # Ingestion & Validation Modules
│   ├── cache_manager.py        # TTL-based live forecast caching
│   ├── fetch_actuals.py        # ERA5 reanalysis fetcher
│   ├── fetch_current.py        # Live 72-hour forecast fetcher
│   ├── fetch_history.py        # 61-day historical forecast fetcher
│   ├── fetch_history_lead.py   # Multi-lead Previous Runs fetcher
│   └── validate_data.py        # 12-point automated diagnostic suite
├── data/                       # Datasets & Reference Files
│   ├── cities.csv              # 45 Indian cities with coordinates
│   ├── actual_history.csv      # ERA5 reanalysis actuals (65.8k rows)
│   ├── forecast_current.csv    # Live 72h forecast (12.9k rows)
│   ├── forecast_history.csv    # Historical forecasts (263k rows)
│   └── forecast_history_lead.csv # Lead-time forecasts (790k rows)
├── database/                   # SQLite Storage
│   └── weather.db              # Database tables from core CSVs
├── outputs/                    # AI Pipeline Deliverables
│   ├── blended_forecast.csv    # Dynamically blended predictions
│   ├── confidence_scores.csv   # ECE scores and spread metrics
│   ├── extreme_alerts.csv      # Active hazard warnings
│   ├── hybrid_forecast.csv     # Calibrated ML predictions
│   ├── model_weights_lead.csv  # Weights per (city, variable, lead)
│   └── skill_scores_lead.csv   # Model verification metrics
├── frontend/                   # Next.js 15 Web Application
│   ├── src/
│   │   ├── app/                # App router (page.tsx, layout.tsx)
│   │   ├── components/         # UI components
│   │   │   ├── AtmosphereLayer.tsx # Canvas particle & weather engine
│   │   │   ├── ExtremeWeather/ # Hazard display & alerts
│   │   │   ├── ForecastHero/   # Top decision hero
│   │   │   ├── ModelComparison/# Multi-model comparison charts
│   │   │   ├── ModelContribution/# Attribution & dynamic weights
│   │   │   ├── WeatherMap/     # Leaflet India map
│   │   │   └── pages/          # Deep-dive pages (RPI, Health, Skill)
│   │   ├── data/mockData.ts    # Fallback mock datasets for demos
│   │   └── lib/api.ts          # API integration layer with multi-port detection
├── app.py                      # Flask REST API application
├── requirements.txt            # Python dependencies
└── README.md                   # System documentation
```

---

## Deprecated Files (Do NOT Use)

The following files represent early development iterations and are retained strictly for backward compatibility. **Do not use them for model training, benchmarking, or dashboard display**:

| Deprecated File | Reason |
| :--- | :--- |
| `data/forecast_raw.csv` | Single forecast run from `api/forecast.py` (old pipeline). |
| `data/raw_forecasts/*.csv` | Single-run per-model CSVs without lead-time information. |
| `data/processed/all_models_clean.csv` | Built from single-run data; `lead_hours` is a row index, not actual forecast lead time. |
| `data/actual_raw.csv` | Partial/legacy actuals file. |

---

## Acknowledgments & Hackathon Details

- **Event:** Smart India Hackathon 2026
- **Problem Statement:** PS-26081 — *Hybrid AI–NWP Weather Forecast Blending System*
- **Organization:** Ministry of Earth Sciences (MoES)
- **Department:** National Centre for Medium Range Weather Forecasting (NCMRWF)
- **Primary Data Provider:** [Open-Meteo APIs](https://open-meteo.com) (integrating ECMWF IFS, NOAA GFS, DWD ICON, and CMC GEM) & ECMWF Copernicus Climate Change Service (ERA5 Reanalysis).
