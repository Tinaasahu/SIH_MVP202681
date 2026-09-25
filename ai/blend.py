import pandas as pd
import numpy as np
from pathlib import Path

# Top-level dictionary mapping variables to actual column names
ACTUAL_MAP = {
    "temperature": "actual_temperature",
    "rainfall": "actual_rainfall",
    "wind_speed": "actual_wind",
}

MODELS = ["ecmwf", "gfs", "icon", "gem"]
VARIABLES = ["temperature", "rainfall", "wind_speed"]

# Resolve project directories
base_dir = Path(__file__).resolve().parent.parent
pairs_file = base_dir / "outputs" / "interim" / "pairs.csv"
weights_file = base_dir / "outputs" / "model_weights.csv"
output_file = base_dir / "outputs" / "interim" / "pairs_blend.csv"

# 1. Load pairs.csv and model_weights.csv
df_pairs = pd.read_csv(pairs_file, low_memory=False)
df_weights = pd.read_csv(weights_file)

# Keep original row order and column structure for verification
df_orig_order = df_pairs[["city", "datetime"]].copy()
original_cols = df_pairs.columns.tolist()

# Ensure numeric columns are explicitly cast to float64
numeric_cols = [f"{v}_{m}" for v in VARIABLES for m in MODELS] + list(ACTUAL_MAP.values())
for col in numeric_cols:
    df_pairs[col] = pd.to_numeric(df_pairs[col])

# 2. Pivot weights and calculate weighted blends for each variable
df_blend = df_pairs.copy()

for var in VARIABLES:
    # Pivot weights to city level for the current variable
    w_pivot = df_weights[df_weights["variable"] == var].pivot(index="city", columns="model", values="weight")
    w_pivot.columns = [f"w_{m}" for m in w_pivot.columns]
    
    # Left join weights onto pairs dataframe by city
    merged = pd.merge(df_blend, w_pivot, on="city", how="left")
    
    # Normalize merged weights so they sum to exactly 1.0 (prevents rounding drift)
    w_cols = [f"w_{m}" for m in MODELS]
    w_sum = merged[w_cols].sum(axis=1)
    for m in MODELS:
        merged[f"w_{m}"] = merged[f"w_{m}"] / w_sum

    # Compute blend = sum(weight * forecast)
    blend_series = sum(merged[f"w_{m}"] * merged[f"{var}_{m}"] for m in MODELS)
    df_blend[f"blend_{var}"] = blend_series

# Keep original columns order and append the 3 blend columns at the end
final_cols = original_cols + [f"blend_{v}" for v in VARIABLES]
df_blend = df_blend[final_cols]

# -----------------------------------------------------------------------------
# ASSERTIONS (Strict quality control - raise clear error if violated)
# -----------------------------------------------------------------------------
# Assertion 1: Output shape == (65880, 21), no NaN
if df_blend.shape != (65880, 21):
    raise ValueError(f"Output shape mismatch: expected (65880, 21), got {df_blend.shape}")
if df_blend.isna().any().any():
    raise ValueError("NaN values detected in pairs_blend.csv")

# Assertion 2: For every row and variable, blend lies between min and max of 4 model forecasts
for var in VARIABLES:
    fc_cols = [f"{var}_{m}" for m in MODELS]
    min_fc = df_blend[fc_cols].min(axis=1)
    max_fc = df_blend[fc_cols].max(axis=1)
    blend_val = df_blend[f"blend_{var}"]
    
    # Allow 1e-9 tolerance as specified in requirement
    out_of_bounds = (blend_val < min_fc - 1e-9) | (blend_val > max_fc + 1e-9)
    if out_of_bounds.any():
        num_violations = out_of_bounds.sum()
        raise ValueError(f"Blend values for {var} fall outside [min_forecast, max_forecast] bounds in {num_violations} rows.")

# Assertion 3: Split counts unchanged: train 45360, test 20520
train_count = (df_blend["split"] == "train").sum()
test_count = (df_blend["split"] == "test").sum()
if train_count != 45360 or test_count != 20520:
    raise ValueError(f"Split counts mismatch: train={train_count} (expected 45360), test={test_count} (expected 20520)")

# Assertion 4: Output row order identical to pairs.csv
if not (df_blend["city"].values == df_orig_order["city"].values).all() or not (df_blend["datetime"].values == df_orig_order["datetime"].values).all():
    raise ValueError("Output row order does not match pairs.csv exactly.")

print("=" * 70)
print("[SUCCESS] All Quality Assertions Passed!")
print("=" * 70)

# -----------------------------------------------------------------------------
# EVALUATION REPORT (Print only; do not write files)
# -----------------------------------------------------------------------------
eval_results = {}

for var in VARIABLES:
    actual_col = ACTUAL_MAP[var]
    print("\n" + "=" * 70)
    print(f"EVALUATION FOR VARIABLE: {var.upper()}")
    print("=" * 70)
    
    # Define candidate methods
    methods = {m: df_blend[f"{var}_{m}"] for m in MODELS}
    methods["equal_avg"] = df_blend[[f"{var}_{m}" for m in MODELS]].mean(axis=1)
    methods["weighted_blend"] = df_blend[f"blend_{var}"]
    
    for split_name in ["train", "test"]:
        mask = df_blend["split"] == split_name
        actual = df_blend.loc[mask, actual_col]
        
        table_rows = []
        for method_name, fc_series in methods.items():
            fc = fc_series.loc[mask]
            err = actual - fc
            mae = np.mean(np.abs(err))
            rmse = np.sqrt(np.mean(err ** 2))
            table_rows.append({"method": method_name, "mae": round(mae, 4), "rmse": round(rmse, 4)})
        
        df_table = pd.DataFrame(table_rows).set_index("method")
        print(f"\n--- {split_name.upper()} SPLIT METRICS ---")
        print(df_table)
        
        # Save test metrics for delta calculation
        if split_name == "test":
            eval_results[var] = df_table

    # Print Deltas for Test RMSE
    test_df = eval_results[var]
    wb_rmse = test_df.loc["weighted_blend", "rmse"]
    eq_rmse = test_df.loc["equal_avg", "rmse"]
    best_single_rmse = test_df.loc[MODELS, "rmse"].min()
    best_single_name = test_df.loc[MODELS, "rmse"].idxmin()
    
    delta_eq = wb_rmse - eq_rmse
    delta_best = wb_rmse - best_single_rmse
    
    print(f"\n--- TEST RMSE DELTA SUMMARY FOR {var.upper()} ---")
    print(f"  * Test RMSE (weighted_blend) minus Test RMSE (equal_avg):        {delta_eq:+.4f}")
    print(f"  * Test RMSE (weighted_blend) minus Test RMSE (best single '{best_single_name}'): {delta_best:+.4f}")

# -----------------------------------------------------------------------------
# SAVE OUTPUT FILE
# -----------------------------------------------------------------------------
df_blend.to_csv(output_file, index=False)
print(f"\nSuccessfully written blended pairs dataset to {output_file}")
