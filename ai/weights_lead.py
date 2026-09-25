import pandas as pd
import numpy as np
from pathlib import Path

# Top-level named constant
EPSILON = 1e-6
MODELS = ["ecmwf", "gfs", "icon", "gem"]
VARIABLES = ["temperature", "rainfall", "wind_speed"]

# Resolve project paths
base_dir = Path(__file__).resolve().parent.parent
input_file = base_dir / "outputs" / "skill_scores_lead.csv"
output_file = base_dir / "outputs" / "model_weights_lead.csv"

# 1. Load skill_scores_lead.csv
df_skill = pd.read_csv(input_file)

# 2. Compute inverse-RMSE and weights per (city, variable, lead_days) group
df_skill["inv_rmse"] = 1.0 / (df_skill["rmse"] + EPSILON)
group_inv_sum = df_skill.groupby(["city", "variable", "lead_days"])["inv_rmse"].transform("sum")
df_skill["weight"] = df_skill["inv_rmse"] / group_inv_sum

# 3. Round weight to 6 decimals and sort
df_skill["weight"] = df_skill["weight"].round(6)
df_weights = df_skill.sort_values(by=["city", "variable", "lead_days", "model"]).reset_index(drop=True)
ordered_cols = ["city", "variable", "lead_days", "model", "weight"]
df_weights = df_weights[ordered_cols]

# -----------------------------------------------------------------------------
# ASSERTIONS (Strict Quality Control - raise clear error if violated)
# -----------------------------------------------------------------------------
# Assertion 1: Exactly 1620 rows: 45 cities, 3 variables, 3 lead_days, 4 models
if len(df_weights) != 1620:
    raise ValueError(f"Row count mismatch: expected 1620, got {len(df_weights)}")
if df_weights["city"].nunique() != 45:
    raise ValueError(f"City count mismatch: expected 45, got {df_weights['city'].nunique()}")
if df_weights["variable"].nunique() != 3:
    raise ValueError(f"Variable count mismatch: expected 3, got {df_weights['variable'].nunique()}")
if df_weights["lead_days"].nunique() != 3:
    raise ValueError(f"Lead days count mismatch: expected 3, got {df_weights['lead_days'].nunique()}")
if df_weights["model"].nunique() != 4:
    raise ValueError(f"Model count mismatch: expected 4, got {df_weights['model'].nunique()}")

# Assertion 2: No NaN, every weight > 0 and < 1
if df_weights["weight"].isna().any():
    raise ValueError("NaN values detected in weights.")
if (df_weights["weight"] <= 0).any() or (df_weights["weight"] >= 1).any():
    raise ValueError("Weight out of bounds (must be strictly > 0 and < 1).")

# Assertion 3: Weights sum to 1 within 1e-5 for each (city, variable, lead_days) group
group_sums = df_weights.groupby(["city", "variable", "lead_days"])["weight"].sum()
if not np.allclose(group_sums, 1.0, atol=1e-5):
    max_dev = (group_sums - 1.0).abs().max()
    raise ValueError(f"Group weights sum constraint violated. Max deviation: {max_dev}")

# Assertion 4: In every group, the model with the lowest rmse has the highest weight
merged_check = pd.merge(
    df_skill[["city", "variable", "lead_days", "model", "rmse"]],
    df_weights,
    on=["city", "variable", "lead_days", "model"]
)
for (c, v, l), g in merged_check.groupby(["city", "variable", "lead_days"]):
    min_rmse_model = g.loc[g["rmse"].idxmin(), "model"]
    max_weight_model = g.loc[g["weight"].idxmax(), "model"]
    if min_rmse_model != max_weight_model:
        raise ValueError(
            f"Lowest RMSE model ({min_rmse_model}) does not match highest weight model ({max_weight_model}) for {c}, {v}, lead {l}"
        )

print("=" * 70)
print("[SUCCESS] All Quality Assertions Passed!")
print("=" * 70)

# -----------------------------------------------------------------------------
# PRINT REPORTS
# -----------------------------------------------------------------------------
# 1. For each variable, table: rows = model, columns = lead_days 1, 2, 3 showing average weight across cities
print("\n--- Average Model Weight Across 45 Cities per Variable ---")
for var in VARIABLES:
    var_df = df_weights[df_weights["variable"] == var]
    avg_table = var_df.groupby(["model", "lead_days"])["weight"].mean().unstack()[[1, 2, 3]]
    print(f"\n[Variable: {var}]")
    print(avg_table.round(6))

# 2. Min and max weight per variable
print("\n--- Min and Max Weight Per Variable ---")
min_max_table = df_weights.groupby("variable")["weight"].agg(["min", "max"])
print(min_max_table)

# 3. For each variable and lead_days, count how many of 45 cities have each model as highest-weight model
print("\n--- Top-Performing Model Counts Across 45 Cities ---")
for var in VARIABLES:
    var_df = df_weights[df_weights["variable"] == var]
    # Identify row with max weight per (city, lead_days)
    idx_max = var_df.groupby(["city", "lead_days"])["weight"].idxmax()
    top_models = var_df.loc[idx_max]
    top_count_table = (
        top_models.groupby(["model", "lead_days"])
        .size()
        .unstack(fill_value=0)
        .reindex(index=MODELS, columns=[1, 2, 3], fill_value=0)
    )
    print(f"\n[Variable: {var} - Number of Cities Where Model has Highest Weight]")
    print(top_count_table)

# 4. Agartala rainfall lead_days 1 weights
agartala_rain_l1 = df_weights[
    (df_weights["city"] == "Agartala") &
    (df_weights["variable"] == "rainfall") &
    (df_weights["lead_days"] == 1)
]
print("\n--- Agartala Rainfall Lead Days 1 Weights ---")
print(agartala_rain_l1[["model", "weight"]].to_string(index=False))

# -----------------------------------------------------------------------------
# SAVE OUTPUT FILE
# -----------------------------------------------------------------------------
df_weights.to_csv(output_file, index=False)
print(f"\nSuccessfully written model weights to {output_file}")
