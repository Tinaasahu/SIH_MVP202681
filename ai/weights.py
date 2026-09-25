import pandas as pd
import numpy as np
from pathlib import Path

# Top-level named constant
EPSILON = 1e-6

# Resolve project directories
base_dir = Path(__file__).resolve().parent.parent
input_file = base_dir / "outputs" / "skill_scores.csv"
output_file = base_dir / "outputs" / "model_weights.csv"

# 1. Load skill_scores.csv
df_skill = pd.read_csv(input_file)

# 2. Compute inverse-RMSE and weights per (city, variable) group
df_skill["inv_rmse"] = 1.0 / (df_skill["rmse"] + EPSILON)
group_inv_sum = df_skill.groupby(["city", "variable"])["inv_rmse"].transform("sum")
df_skill["weight"] = df_skill["inv_rmse"] / group_inv_sum

# 3. Round weight to 6 decimals and sort
df_skill["weight"] = df_skill["weight"].round(6)
df_weights = df_skill.sort_values(by=["city", "variable", "model"]).reset_index(drop=True)
ordered_cols = ["city", "variable", "model", "weight"]
df_weights = df_weights[ordered_cols]

# -----------------------------------------------------------------------------
# ASSERTIONS (Strict quality control - raise clear error if violated)
# -----------------------------------------------------------------------------
# Assertion 1: Exactly 540 rows, 45 cities, 3 variables, 4 models
if len(df_weights) != 540:
    raise ValueError(f"Row count mismatch: expected 540, got {len(df_weights)}")
if df_weights["city"].nunique() != 45:
    raise ValueError(f"City count mismatch: expected 45, got {df_weights['city'].nunique()}")
if df_weights["variable"].nunique() != 3:
    raise ValueError(f"Variable count mismatch: expected 3, got {df_weights['variable'].nunique()}")
if df_weights["model"].nunique() != 4:
    raise ValueError(f"Model count mismatch: expected 4, got {df_weights['model'].nunique()}")

# Assertion 2: No NaN, every weight > 0 and < 1
if df_weights["weight"].isna().any():
    raise ValueError("NaN values detected in weights.")
if (df_weights["weight"] <= 0).any() or (df_weights["weight"] >= 1).any():
    raise ValueError("Weight out of bounds (must be strictly > 0 and < 1).")

# Assertion 3: Weights sum to 1 within 1e-5 for each (city, variable) group
group_sums = df_weights.groupby(["city", "variable"])["weight"].sum()
if not np.allclose(group_sums, 1.0, atol=1e-5):
    max_dev = (group_sums - 1.0).abs().max()
    raise ValueError(f"Group weights sum constraint violated. Max deviation: {max_dev}")

# Assertion 4: Inside every group, the model with the lowest rmse has the highest weight
merged_check = pd.merge(df_skill[["city", "variable", "model", "rmse"]], df_weights, on=["city", "variable", "model"])
for (c, v), g in merged_check.groupby(["city", "variable"]):
    min_rmse_model = g.loc[g["rmse"].idxmin(), "model"]
    max_weight_model = g.loc[g["weight"].idxmax(), "model"]
    if min_rmse_model != max_weight_model:
        raise ValueError(f"Lowest RMSE model ({min_rmse_model}) does not match highest weight model ({max_weight_model}) for {c}, {v}")

print("=" * 70)
print("[SUCCESS] All Quality Assertions Passed!")
print("=" * 70)

# -----------------------------------------------------------------------------
# PRINT REPORT & OUTPUTS
# -----------------------------------------------------------------------------
# Table: rows = model, columns = variable showing average weight across cities
avg_weight_table = df_weights.groupby(["model", "variable"])["weight"].mean().unstack()[["temperature", "rainfall", "wind_speed"]]
print("\n--- Average Model Weights Across Cities (rows=model, columns=variable) ---")
print(avg_weight_table.round(6))

# Min and Max weight per variable
print("\n--- Min and Max Weight Per Variable ---")
min_max_weights = df_weights.groupby("variable")["weight"].agg(["min", "max"])
print(min_max_weights)

# Agartala temperature 4 weights
agartala_temp = df_weights[(df_weights["city"] == "Agartala") & (df_weights["variable"] == "temperature")]
print("\n--- Agartala Temperature Weights ---")
print(agartala_temp[["model", "weight"]].to_string(index=False))

# -----------------------------------------------------------------------------
# SAVE OUTPUT FILE
# -----------------------------------------------------------------------------
df_weights.to_csv(output_file, index=False)
print(f"\nSuccessfully written model weights to {output_file}")
