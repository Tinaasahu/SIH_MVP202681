import pandas as pd
import numpy as np
from pathlib import Path

# Top-level dictionary mapping variables to actual column names
ACTUAL_MAP = {
    "temperature": "actual_temperature",
    "rainfall": "actual_rainfall",
    "wind_speed": "actual_wind",
}

MODELS_6 = ["ecmwf", "gfs", "icon", "gem", "ukmo", "jma"]
MODELS_4 = ["ecmwf", "gfs", "icon", "gem"]
VARIABLES = ["temperature", "rainfall", "wind_speed"]

# Resolve project directories
base_dir = Path(__file__).resolve().parent.parent
pairs_file = base_dir / "outputs" / "interim" / "pairs_lead_6model.csv"
weights_6_file = base_dir / "outputs" / "model_weights_6model.csv"
weights_4_file = base_dir / "outputs" / "model_weights_lead.csv"
output_file = base_dir / "outputs" / "interim" / "pairs_lead_6model_blend.csv"

# 1. Load pairs_lead_6model.csv and weight files
print(f"Reading pairs data from {pairs_file}...")
df_pairs = pd.read_csv(pairs_file, low_memory=False)

print(f"Reading 6-model weights from {weights_6_file}...")
df_weights_6 = pd.read_csv(weights_6_file)

print(f"Reading 4-model baseline weights from {weights_4_file}...")
df_weights_4 = pd.read_csv(weights_4_file)

# Keep original row order and column structure for verification
df_orig_order = df_pairs[["city", "datetime", "lead_days"]].copy()
original_cols = df_pairs.columns.tolist()

# Ensure numeric forecast and actual columns are explicitly cast to float64
numeric_cols = [f"{v}_{m}" for v in VARIABLES for m in MODELS_6] + list(ACTUAL_MAP.values())
for col in numeric_cols:
    df_pairs[col] = pd.to_numeric(df_pairs[col])

# 2. Pivot weights and calculate weighted blends for each variable
df_blend = df_pairs.copy()

# Dictionary to hold the 4-model blend series for comparative evaluation
blend_4model_series = {}

for var in VARIABLES:
    # --- A. 6-MODEL WEIGHTED BLEND ---
    w6_pivot = df_weights_6[df_weights_6["variable"] == var].pivot(
        index=["city", "lead_days"],
        columns="model",
        values="weight"
    ).reset_index()
    
    w6_cols = [f"w6_{m}" for m in MODELS_6]
    w6_pivot.columns = ["city", "lead_days"] + w6_cols
    
    merged_6 = pd.merge(df_blend[["city", "lead_days"]], w6_pivot, on=["city", "lead_days"], how="left")
    w6_sum = merged_6[w6_cols].sum(axis=1)
    for m in MODELS_6:
        merged_6[f"w6_{m}"] = merged_6[f"w6_{m}"] / w6_sum

    blend_6_val = sum(merged_6[f"w6_{m}"] * df_blend[f"{var}_{m}"] for m in MODELS_6)
    df_blend[f"blend_{var}"] = blend_6_val

    # --- B. 4-MODEL WEIGHTED BLEND (BASELINE BENCHMARK) ---
    w4_pivot = df_weights_4[df_weights_4["variable"] == var].pivot(
        index=["city", "lead_days"],
        columns="model",
        values="weight"
    ).reset_index()

    w4_cols = [f"w4_{m}" for m in MODELS_4]
    w4_pivot.columns = ["city", "lead_days"] + w4_cols

    merged_4 = pd.merge(df_blend[["city", "lead_days"]], w4_pivot, on=["city", "lead_days"], how="left")
    w4_sum = merged_4[w4_cols].sum(axis=1)
    for m in MODELS_4:
        merged_4[f"w4_{m}"] = merged_4[f"w4_{m}"] / w4_sum

    blend_4_val = sum(merged_4[f"w4_{m}"] * df_blend[f"{var}_{m}"] for m in MODELS_4)
    blend_4model_series[var] = blend_4_val

# Keep original columns order and append the 3 blend columns at the end
final_cols = original_cols + [f"blend_{v}" for v in VARIABLES]
df_blend = df_blend[final_cols]

# -----------------------------------------------------------------------------
# ASSERTIONS (Strict Quality Control - raise clear error if violated)
# -----------------------------------------------------------------------------
# Assertion 1: Output shape == (197640, 29), no NaN
if df_blend.shape != (197640, 29):
    raise ValueError(f"Output shape mismatch: expected (197640, 29), got {df_blend.shape}")
if df_blend.isna().any().any():
    raise ValueError("NaN values detected in pairs_lead_6model_blend.csv")

# Assertion 2: For every row and variable, blend lies between min and max of 6 model forecasts
for var in VARIABLES:
    fc_cols = [f"{var}_{m}" for m in MODELS_6]
    min_fc = df_blend[fc_cols].min(axis=1)
    max_fc = df_blend[fc_cols].max(axis=1)
    blend_val = df_blend[f"blend_{var}"]
    
    out_of_bounds = (blend_val < min_fc - 1e-9) | (blend_val > max_fc + 1e-9)
    if out_of_bounds.any():
        num_violations = out_of_bounds.sum()
        raise ValueError(
            f"Blend values for {var} fall outside [min_forecast, max_forecast] bounds in {num_violations} rows."
        )

# Assertion 3: Split counts unchanged: train 136080, test 61560
train_count = (df_blend["split"] == "train").sum()
test_count = (df_blend["split"] == "test").sum()
if train_count != 136080 or test_count != 61560:
    raise ValueError(
        f"Split counts mismatch: train={train_count} (expected 136080), test={test_count} (expected 61560)"
    )

# Assertion 4: Output row order identical to pairs_lead_6model.csv
if not (df_blend["city"].values == df_orig_order["city"].values).all() or \
   not (df_blend["datetime"].values == df_orig_order["datetime"].values).all() or \
   not (df_blend["lead_days"].values == df_orig_order["lead_days"].values).all():
    raise ValueError("Output row order does not match pairs_lead_6model.csv exactly.")

print("=" * 70)
print("[SUCCESS] All Quality Assertions Passed!")
print("=" * 70)

# -----------------------------------------------------------------------------
# EVALUATION REPORT (Print only; do not write files)
# -----------------------------------------------------------------------------
all_methods = MODELS_6 + ["equal_avg", "weighted_blend_4model", "weighted_blend_6model"]

for var in VARIABLES:
    actual_col = ACTUAL_MAP[var]
    print("\n" + "=" * 75)
    print(f"EVALUATION FOR VARIABLE: {var.upper()}")
    print("=" * 75)

    # Pre-calculate candidate forecasts
    method_fc = {m: df_blend[f"{var}_{m}"] for m in MODELS_6}
    method_fc["equal_avg"] = df_blend[[f"{var}_{m}" for m in MODELS_6]].mean(axis=1)
    method_fc["weighted_blend_4model"] = blend_4model_series[var]
    method_fc["weighted_blend_6model"] = df_blend[f"blend_{var}"]

    # A. RMSE and MAE Tables (rows = methods, columns = (split, lead_days))
    col_tuples = [
        (s, l) for s in ["train", "test"] for l in [1, 2, 3]
    ]
    col_names = [f"{s}_lead{l}" for s, l in col_tuples]

    rmse_dict = {m: {} for m in all_methods}
    mae_dict = {m: {} for m in all_methods}

    for s, l in col_tuples:
        col_name = f"{s}_lead{l}"
        mask = (df_blend["split"] == s) & (df_blend["lead_days"] == l)
        actual = df_blend.loc[mask, actual_col]

        for m in all_methods:
            fc = method_fc[m].loc[mask]
            err = actual - fc
            mae_val = np.mean(np.abs(err))
            rmse_val = np.sqrt(np.mean(err ** 2))
            rmse_dict[m][col_name] = round(rmse_val, 4)
            mae_dict[m][col_name] = round(mae_val, 4)

    df_rmse_table = pd.DataFrame(rmse_dict).T[col_names]
    df_mae_table = pd.DataFrame(mae_dict).T[col_names]

    print("\n--- RMSE TABLE (rows=methods, columns=split & lead_days) ---")
    print(df_rmse_table)

    print("\n--- MAE TABLE (rows=methods, columns=split & lead_days) ---")
    print(df_mae_table)

    # B. CRITICAL COMPARISON: weighted_blend_6model vs weighted_blend_4model on TEST Rows
    print("\n" + "-" * 75)
    print(f"CRITICAL TEST COMPARISON: 6-MODEL BLEND vs 4-MODEL BLEND ({var.upper()})")
    print("-" * 75)
    for l in [1, 2, 3]:
        col_name = f"test_lead{l}"
        wb6_rmse = df_rmse_table.loc["weighted_blend_6model", col_name]
        wb4_rmse = df_rmse_table.loc["weighted_blend_4model", col_name]
        ecmwf_rmse = df_rmse_table.loc["ecmwf", col_name]
        eq6_rmse = df_rmse_table.loc["equal_avg", col_name]

        # 6-model vs 4-model delta
        delta_4m = wb6_rmse - wb4_rmse
        pct_4m = (delta_4m / wb4_rmse) * 100.0

        # 6-model vs ecmwf delta
        delta_ec = wb6_rmse - ecmwf_rmse
        pct_ec = (delta_ec / ecmwf_rmse) * 100.0

        # 6-model vs equal_avg delta
        delta_eq = wb6_rmse - eq6_rmse
        pct_eq = (delta_eq / eq6_rmse) * 100.0

        print(f"\n[Lead Days {l} (Test Set)]")
        print(f"  * 6-Model Blend RMSE: {wb6_rmse:.4f} | 4-Model Blend RMSE: {wb4_rmse:.4f}")
        print(f"  * 6-Model minus 4-Model RMSE:       {delta_4m:+.4f} ({pct_4m:+.2f}%)")
        print(f"  * 6-Model minus ECMWF RMSE:         {delta_ec:+.4f} ({pct_ec:+.2f}%)")
        print(f"  * 6-Model minus Equal-Avg (6) RMSE: {delta_eq:+.4f} ({pct_eq:+.2f}%)")

    # C. City-Level Comparison on TEST Rows (6-model vs 4-model and vs ECMWF)
    print("\n--- CITY-LEVEL TEST RMSE COMPARISONS ---")
    for l in [1, 2, 3]:
        mask_test_l = (df_blend["split"] == "test") & (df_blend["lead_days"] == l)
        df_sub = df_blend[mask_test_l].copy()
        df_sub["blend_4model"] = blend_4model_series[var].loc[mask_test_l]

        city_metrics = []
        for city_name, g in df_sub.groupby("city"):
            act = g[actual_col]
            err_wb6 = act - g[f"blend_{var}"]
            err_wb4 = act - g["blend_4model"]
            err_ec = act - g[f"{var}_ecmwf"]

            rmse_wb6 = np.sqrt(np.mean(err_wb6 ** 2))
            rmse_wb4 = np.sqrt(np.mean(err_wb4 ** 2))
            rmse_ec = np.sqrt(np.mean(err_ec ** 2))

            city_metrics.append({
                "city": city_name,
                "rmse_6m": rmse_wb6,
                "rmse_4m": rmse_wb4,
                "rmse_ec": rmse_ec,
                "diff_vs_4m": rmse_wb6 - rmse_wb4,
                "diff_vs_ec": rmse_wb6 - rmse_ec,
            })

        df_city = pd.DataFrame(city_metrics)
        better_vs_4m = (df_city["diff_vs_4m"] < 0).sum()
        better_vs_ec = (df_city["diff_vs_ec"] < 0).sum()

        print(f"\n[Lead Days {l} - Test Set City Summary]")
        print(f"  - Cities where 6-Model Blend < 4-Model Blend RMSE: {better_vs_4m} / 45")
        print(f"  - Cities where 6-Model Blend < ECMWF RMSE:         {better_vs_ec} / 45")

# -----------------------------------------------------------------------------
# SAVE OUTPUT FILE
# -----------------------------------------------------------------------------
df_blend.to_csv(output_file, index=False)
print(f"\nSuccessfully written blended pairs dataset to {output_file}")
