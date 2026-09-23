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

# Models and variables lists
MODELS = ["ecmwf", "gfs", "icon", "gem"]
VARIABLES = ["temperature", "rainfall", "wind_speed"]

# Resolve project directories
base_dir = Path(__file__).resolve().parent.parent
input_file = base_dir / "outputs" / "interim" / "pairs.csv"
output_file = base_dir / "outputs" / "skill_scores.csv"

# 1. Load pairs.csv and filter for split == TARGET_SPLIT
df_pairs = pd.read_csv(input_file, low_memory=False)
df_pairs["datetime"] = pd.to_datetime(df_pairs["datetime"])

# Convert all forecast and actual metric columns to float numeric type
numeric_cols = [f"{var}_{mod}" for var in VARIABLES for mod in MODELS] + list(ACTUAL_MAP.values())
for col in numeric_cols:
    df_pairs[col] = pd.to_numeric(df_pairs[col])

df_train = df_pairs[df_pairs["split"] == TARGET_SPLIT].copy()

# 2. Compute error and metrics per city, variable, and model
records = []
for var in VARIABLES:
    actual_col = ACTUAL_MAP[var]
    for mod in MODELS:
        forecast_col = f"{var}_{mod}"
        
        # Calculate error per row (actual minus forecast)
        err = df_train[actual_col] - df_train[forecast_col]
        
        # Build temp dataframe for aggregation
        temp_df = pd.DataFrame({
            "city": df_train["city"],
            "err": err,
            "abs_err": np.abs(err),
            "sq_err": err ** 2
        })
        
        grouped = temp_df.groupby("city").agg(
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

# 4. Round mae, rmse, bias to 4 decimals and sort
df_skill["mae"] = df_skill["mae"].round(4)
df_skill["rmse"] = df_skill["rmse"].round(4)
df_skill["bias"] = df_skill["bias"].round(4)

df_skill = df_skill.sort_values(by=["city", "variable", "model"]).reset_index(drop=True)
ordered_cols = ["city", "variable", "model", "mae", "rmse", "bias", "n"]
df_skill = df_skill[ordered_cols]

# -----------------------------------------------------------------------------
# ASSERTIONS (Strict quality control - raise clear error if violated)
# -----------------------------------------------------------------------------
# Assertion 1: File has exactly 540 rows
if len(df_skill) != 540:
    raise ValueError(f"Row count mismatch: expected 540, got {len(df_skill)}")

# Assertion 2: n == 1008 for every row
if not (df_skill["n"] == 1008).all():
    raise ValueError(f"Not all rows have n == 1008: {df_skill['n'].value_counts().to_dict()}")

# Assertion 3: No NaN anywhere
if df_skill.isna().any().any():
    raise ValueError("NaN values detected in skill scores dataframe.")

# Assertion 4: No negative mae/rmse, rmse >= mae for every row
if (df_skill["mae"] < 0).any() or (df_skill["rmse"] < 0).any():
    raise ValueError("Negative MAE or RMSE detected.")

# Check rmse >= mae allowing slight float tolerance (1e-9)
if (df_skill["rmse"] < df_skill["mae"] - 1e-9).any():
    raise ValueError("Violation detected where RMSE < MAE.")

# Assertion 5: Max datetime used is earlier than 2026-08-29
max_date_used = df_train["datetime"].max()
if max_date_used >= pd.Timestamp("2026-08-29 00:00:00"):
    raise ValueError(f"Data leakage detected! Max datetime used is {max_date_used} (>= 2026-08-29 00:00:00).")

print("=" * 70)
print("[SUCCESS] All Quality Assertions Passed!")
print("=" * 70)

# -----------------------------------------------------------------------------
# SANITY CHECK REPORT & PRINT OUTPUTS
# -----------------------------------------------------------------------------
# Table: rows = model, columns = temperature/rainfall/wind_speed showing average RMSE across cities
sanity_table = df_skill.groupby(["model", "variable"])["rmse"].mean().unstack()[VARIABLES]

print("\n--- Sanity Check: Average RMSE Across Cities (rows=model, columns=variable) ---")
print(sanity_table.round(4))

print("\n--- First 8 Rows of skill_scores.csv ---")
print(df_skill.head(8))

# -----------------------------------------------------------------------------
# SAVE OUTPUT FILE
# -----------------------------------------------------------------------------
df_skill.to_csv(output_file, index=False)
print(f"\nSuccessfully written skill scores to {output_file}")
