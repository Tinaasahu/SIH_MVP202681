import pandas as pd
import numpy as np
from pathlib import Path

# Top-level named constants
TARGET_SPLIT = "train"
ACTUAL_MAP = {
    "temperature": "actual_temperature",
    "rainfall": "actual_rainfall",
    "wind_speed": "actual_wind",
}
MODELS = ["ecmwf", "gfs", "icon", "gem"]
VARIABLES = ["temperature", "rainfall", "wind_speed"]

# Resolve project paths
base_dir = Path(__file__).resolve().parent.parent
input_file = base_dir / "outputs" / "interim" / "pairs_lead.csv"
output_file = base_dir / "outputs" / "skill_scores_lead.csv"

# 1. Load pairs_lead.csv, parse datetime, filter split == TARGET_SPLIT
df_pairs = pd.read_csv(input_file, low_memory=False)
df_pairs["datetime"] = pd.to_datetime(df_pairs["datetime"])

# Convert numeric forecast and actual columns to numeric float type
numeric_cols = [f"{var}_{mod}" for var in VARIABLES for mod in MODELS] + list(ACTUAL_MAP.values())
for col in numeric_cols:
    df_pairs[col] = pd.to_numeric(df_pairs[col])

df_train = df_pairs[df_pairs["split"] == TARGET_SPLIT].copy()

# 2. Compute error and metrics per city, variable, lead_days, and model
records = []
for var in VARIABLES:
    actual_col = ACTUAL_MAP[var]
    for mod in MODELS:
        forecast_col = f"{var}_{mod}"
        
        # Calculate row-wise error (actual minus forecast)
        err = df_train[actual_col] - df_train[forecast_col]
        
        temp_df = pd.DataFrame({
            "city": df_train["city"],
            "lead_days": df_train["lead_days"],
            "err": err,
            "abs_err": np.abs(err),
            "sq_err": err ** 2
        })
        
        grouped = temp_df.groupby(["city", "lead_days"]).agg(
            mae=("abs_err", "mean"),
            rmse=("sq_err", lambda s: np.sqrt(s.mean())),
            bias=("err", "mean"),
            n=("err", "count")
        ).reset_index()
        
        grouped["variable"] = var
        grouped["model"] = mod
        records.append(grouped)

# Combine all results into one DataFrame
df_skill = pd.concat(records, ignore_index=True)

# 3. Round metrics to 4 decimal places and format output dataframe
df_skill["mae"] = df_skill["mae"].round(4)
df_skill["rmse"] = df_skill["rmse"].round(4)
df_skill["bias"] = df_skill["bias"].round(4)

df_skill = df_skill.sort_values(by=["city", "variable", "lead_days", "model"]).reset_index(drop=True)
ordered_cols = ["city", "variable", "lead_days", "model", "mae", "rmse", "bias", "n"]
df_skill = df_skill[ordered_cols]

# -----------------------------------------------------------------------------
# ASSERTIONS (Strict Quality Control - raise clear error if violated)
# -----------------------------------------------------------------------------
# Assertion 1: Exactly 1620 rows
if len(df_skill) != 1620:
    raise ValueError(f"Row count mismatch: expected 1620, got {len(df_skill)}")

# Assertion 2: n == 1008 for every row
if not (df_skill["n"] == 1008).all():
    raise ValueError(f"Not all rows have n == 1008: {df_skill['n'].value_counts().to_dict()}")

# Assertion 3: No NaN anywhere
if df_skill.isna().any().any():
    raise ValueError("NaN values detected in skill scores dataframe.")

# Assertion 4: No negative mae/rmse, rmse >= mae for every row
if (df_skill["mae"] < 0).any() or (df_skill["rmse"] < 0).any():
    raise ValueError("Negative MAE or RMSE detected.")

if (df_skill["rmse"] < df_skill["mae"] - 1e-9).any():
    raise ValueError("Violation detected where RMSE < MAE.")

# Assertion 5: lead_days values are exactly {1, 2, 3}
if set(df_skill["lead_days"].unique()) != {1, 2, 3}:
    raise ValueError(f"Unexpected lead_days values: {set(df_skill['lead_days'].unique())}")

# Assertion 6: Max datetime used is earlier than 2026-08-29
max_date_used = df_train["datetime"].max()
if max_date_used >= pd.Timestamp("2026-08-29 00:00:00"):
    raise ValueError(f"Data leakage detected! Max datetime used is {max_date_used} (>= 2026-08-29 00:00:00).")

print("=" * 70)
print("[SUCCESS] All Quality Assertions Passed!")
print("=" * 70)

# -----------------------------------------------------------------------------
# SANITY CHECK REPORT & PRINT OUTPUTS
# -----------------------------------------------------------------------------
# For each variable, print a table with rows = model, columns = lead_days 1, 2, 3 showing average RMSE across 45 cities
for var in VARIABLES:
    var_df = df_skill[df_skill["variable"] == var]
    pivot_table = var_df.groupby(["model", "lead_days"])["rmse"].mean().unstack()[[1, 2, 3]]
    print(f"\n--- Average RMSE Across 45 Cities ({var}) ---")
    print(pivot_table.round(4))

print("\n--- First 8 Rows of skill_scores_lead.csv ---")
print(df_skill.head(8))

# -----------------------------------------------------------------------------
# SAVE OUTPUT FILE
# -----------------------------------------------------------------------------
df_skill.to_csv(output_file, index=False)
print(f"\nSuccessfully written skill scores to {output_file}")
