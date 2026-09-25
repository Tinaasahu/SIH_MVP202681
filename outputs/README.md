Files Member 3 should read for the dashboard.

## Final Output Files

| File | What it is | Key columns | Rows |
|---|---|---|---|
| `hybrid_forecast.csv` | Final AI/ML forecast (adaptive blend + ML residual correction) | `city`, `datetime`, `lead_days`, `blend_temperature`, `blend_rainfall`, `blend_wind_speed`, `temperature`, `rainfall`, `wind_speed` — last 3 are the final hybrid values | 3 240 |
| `blended_forecast.csv` | Layer 1 only — adaptive model blend, no ML correction | `city`, `datetime`, `lead_days`, `temperature`, `rainfall`, `wind_speed` | 3 240 |
| `extreme_alerts.csv` | Extreme weather alerts using production thresholds | `city`, `datetime`, `event`, `severity`, `forecast_value`, `threshold` | 0 (see note below) |
| `skill_scores_lead.csv` & `model_weights_lead.csv` | Per-city / per-variable / per-lead-day model performance and blend weights — for "why this forecast" transparency features | varies | optional |

## Do NOT Use for the Dashboard

| Path | Reason |
|---|---|
| `database/weather.db` | Rebuilt on each run but not the primary interface |
| `data/*.csv` | Raw and intermediate data, not curated for display |
| `outputs/interim/*.csv` | Intermediate working files, not final outputs |
| `outputs/models/*.joblib` | Trained model binaries, not data |

## Known Limitations

- **Short training window:** data covers only a 61-day monsoon period (18 Jul – 16 Sep 2026); performance in other seasons is unverified.
- **Reanalysis actuals:** "actual" values used for training come from ERA5 reanalysis, not ground-station observations.
- **Lead-time coverage:** skill and weights were evaluated on 24–72 h lead times; very long-range forecasts are not covered.
- **Empty alerts file:** `extreme_alerts.csv` has 0 rows because no city crosses the production thresholds in the current 72 h window — verified against the data, not a bug.
- **`lead_days` approximation:** for `forecast_current`, `lead_days` is derived from hours since the file's own start time, not a true model-run issue time.

## How to Refresh

To regenerate all output files after new data arrives, run from the project root:

```
python ai/pipeline.py
```

Takes about 3 minutes.
