import pandas as pd
import numpy as np
from pathlib import Path

# Lead days calculation rule:
# start = minimum datetime in forecast_current_clean.csv
# hours_ahead = (datetime - start) in whole hours
# lead_days = hours_ahead // 24 + 1 (values in {1, 2, 3})

MODELS = ["ecmwf", "gfs", "icon", "gem"]
VARIABLES = ["temperature", "rainfall", "wind_speed"]

# Resolve project directories
base_dir = Path(__file__).resolve().parent.parent
forecast_file = base_dir / "outputs" / "interim" / "forecast_current_clean.csv"
weights_file = base_dir / "outputs" / "model_weights_lead.csv"
output_file = base_dir / "outputs" / "blended_forecast.csv"

# 1. Load forecast_current_clean.csv and model_weights_lead.csv
df_fc = pd.read_csv(forecast_file)
df_fc["datetime"] = pd.to_datetime(df_fc["datetime"])
df_weights = pd.read_csv(weights_file)

# 2. Assign lead_days using forecast's own start time
start_time = df_fc["datetime"].min()
hours_ahead = ((df_fc["datetime"] - start_time).dt.total_seconds() // 3600).astype(int)
df_fc["lead_days"] = hours_ahead // 24 + 1

# Assert lead_days values are exactly {1, 2, 3}
if set(df_fc["lead_days"].unique()) != {1, 2, 3}:
    raise ValueError(f"Unexpected lead_days values: {set(df_fc['lead_days'].unique())}")

# 3. Pivot forecast to wide format: one row per (city, datetime, lead_days)
df_pivot = df_fc.pivot(
    index=["city", "datetime", "lead_days"],
    columns="model",
    values=VARIABLES
)

# Flatten multi-index columns: variable_model
df_wide = df_pivot.copy()
df_wide.columns = [f"{var}_{mod}" for var, mod in df_pivot.columns]
df_wide = df_wide.reset_index()

# 4. Pivot weights and calculate blended forecast for each variable
df_blended = df_wide.copy()

for var in VARIABLES:
    # Pivot weights for the current variable to (city, lead_days) level
    w_pivot = df_weights[df_weights["variable"] == var].pivot(
        index=["city", "lead_days"],
        columns="model",
        values="weight"
    ).reset_index()
    
    w_cols = [f"w_{m}" for m in MODELS]
    w_pivot.columns = ["city", "lead_days"] + w_cols
    
    # Merge weights onto wide forecast on (city, lead_days)
    merged = pd.merge(df_wide, w_pivot, on=["city", "lead_days"], how="left")
    
    # Normalize merged weights so they sum to 1.0 per row
    w_sum = merged[w_cols].sum(axis=1)
    for m in MODELS:
        merged[f"w_{m}"] = merged[f"w_{m}"] / w_sum

    # Compute blend = sum(weight * forecast)
    df_blended[var] = sum(merged[f"w_{m}"] * merged[f"{var}_{m}"] for m in MODELS)

# 5. Format output columns and sort by city, datetime
output_cols = ["city", "datetime", "lead_days", "temperature", "rainfall", "wind_speed"]
df_out = df_blended.sort_values(by=["city", "datetime"]).reset_index(drop=True)[output_cols]

# -----------------------------------------------------------------------------
# ASSERTIONS (Strict Quality Control - raise clear error if violated)
# -----------------------------------------------------------------------------
# Assertion 1: Exact row count = 45 cities x 72 hours = 3240 rows, 6 columns
if df_out.shape != (3240, 6):
    raise ValueError(f"Output shape mismatch: expected (3240, 6), got {df_out.shape}")

# Assertion 2: No NaN anywhere in output dataframe
if df_out.isna().any().any():
    raise ValueError("NaN values detected in blended forecast dataframe.")

# Assertion 3: lead_days values are exactly {1, 2, 3}
if set(df_out["lead_days"].unique()) != {1, 2, 3}:
    raise ValueError(f"Unexpected lead_days in output: {set(df_out['lead_days'].unique())}")

# Assertion 4: Exactly 45 unique cities
if df_out["city"].nunique() != 45:
    raise ValueError(f"City count mismatch: expected 45, got {df_out['city'].nunique()}")

# Assertion 5: For every row and variable, blend lies between min and max of 4 model forecasts
for var in VARIABLES:
    fc_cols = [f"{var}_{m}" for m in MODELS]
    min_fc = df_wide[fc_cols].min(axis=1)
    max_fc = df_wide[fc_cols].max(axis=1)
    blend_val = df_out[var]
    
    out_of_bounds = (blend_val < min_fc - 1e-9) | (blend_val > max_fc + 1e-9)
    if out_of_bounds.any():
        num_violations = out_of_bounds.sum()
        raise ValueError(
            f"Blended forecast for {var} falls outside [min, max] bounds in {num_violations} rows."
        )

# Format datetime as string %Y-%m-%d %H:%M:%S
df_out["datetime"] = df_out["datetime"].dt.strftime("%Y-%m-%d %H:%M:%S")

print("=" * 70)
print("[SUCCESS] All Quality Assertions Passed!")
print("=" * 70)

# -----------------------------------------------------------------------------
# SANITY REPORT & PRINT OUTPUTS
# -----------------------------------------------------------------------------
print("\n--- Blended Forecast Summary Statistics ---")
print(df_out[["temperature", "rainfall", "wind_speed"]].describe().round(4))

print("\n--- First 8 Rows of blended_forecast.csv ---")
print(df_out.head(8))

# -----------------------------------------------------------------------------
# SAVE OUTPUT FILE
# -----------------------------------------------------------------------------
df_out.to_csv(output_file, index=False)
print(f"\nSuccessfully written blended forecast to {output_file}")
