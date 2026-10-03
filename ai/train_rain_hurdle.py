import os
import sys
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

# Terminal encoding for Windows console compatibility
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

# Top-level named constants
CLASSIFIER_THRESHOLD = 0.30
TRAIN = 'train'
TEST = 'test'
RF_PARAMS = dict(n_estimators=100, max_depth=12, min_samples_leaf=50, n_jobs=-1, random_state=42)

FEATURE_COLS = [
    'latitude', 'longitude', 'lead_days', 'hour',
    'temperature_ecmwf', 'temperature_gfs', 'temperature_icon', 'temperature_gem',
    'rainfall_ecmwf', 'rainfall_gfs', 'rainfall_icon', 'rainfall_gem',
    'wind_speed_ecmwf', 'wind_speed_gfs', 'wind_speed_icon', 'wind_speed_gem',
    'blend_temperature', 'blend_rainfall', 'blend_wind_speed',
    'spread_temperature', 'spread_rainfall', 'spread_wind_speed'
]


def main():
    # 1. Load data and verify split
    data_path = 'outputs/interim/ml_table.csv'
    print(f"Loading data from {data_path}...")
    df = pd.read_csv(data_path)
    df['datetime'] = pd.to_datetime(df['datetime'])

    train_df = df[df['split'] == TRAIN].copy()
    test_df = df[df['split'] == TEST].copy()

    # Split assertions matching ai/train.py
    if len(train_df) != 136080 or len(test_df) != 61560:
        raise ValueError(f"Invalid split counts: TRAIN={len(train_df)}, TEST={len(test_df)}")

    # 2. Load pre-trained Stage-1 PoP Classifier
    clf_path = 'outputs/models/rf_rain_classifier.joblib'
    if not os.path.exists(clf_path):
        raise FileNotFoundError(f"Missing classifier at {clf_path}. Run ai/train_rain_classifier.py first.")
    print(f"Loading Stage-1 PoP classifier from {clf_path}...")
    clf = joblib.load(clf_path)
    print("Stage-1 classifier loaded successfully.")

    # 3. Train or load Stage-2 Wet-Only Regressor
    # Target: resid_rainfall strictly on TRAIN records where actual_rainfall >= 0.1 mm
    wet_model_path = 'outputs/models/rf_rainfall_wet_only.joblib'
    train_wet = train_df[train_df['actual_rainfall'] >= 0.1].copy()
    n_train_wet = len(train_wet)
    print(f"\nTRAIN wet rows for Stage-2 regressor: {n_train_wet:,} / {len(train_df):,} ({n_train_wet/len(train_df)*100:.2f}%)")

    if os.path.exists(wet_model_path):
        print(f"Loading existing wet-only regressor from {wet_model_path}...")
        rf_wet = joblib.load(wet_model_path)
        print("Wet-only regressor loaded successfully.")
    else:
        print("Training Stage-2 Wet-Only RandomForestRegressor on wet records...")
        X_train_wet = train_wet[FEATURE_COLS]
        y_train_wet = train_wet['resid_rainfall']
        rf_wet = RandomForestRegressor(**RF_PARAMS)
        rf_wet.fit(X_train_wet, y_train_wet)
        os.makedirs('outputs/models', exist_ok=True)
        joblib.dump(rf_wet, wet_model_path)
        print(f"Stage-2 wet-only regressor saved to -> {wet_model_path}")

    # 4. Load baseline single-RF model for comparison
    single_rf_path = 'outputs/models/rf_rainfall.joblib'
    if not os.path.exists(single_rf_path):
        raise FileNotFoundError(f"Missing baseline single-RF model at {single_rf_path}.")
    print(f"Loading baseline single-RF model from {single_rf_path}...")
    rf_single = joblib.load(single_rf_path)
    print("Baseline model loaded successfully.")

    # 5. Evaluate on TEST split (61,560 rows)
    print(f"\nComputing predictions on TEST split (threshold tau = {CLASSIFIER_THRESHOLD:.2f})...")
    X_test = test_df[FEATURE_COLS]
    blend_test = test_df['blend_rainfall'].values
    act_test = test_df['actual_rainfall'].values

    # Method 1: weighted_blend (baseline, no ML)
    pred_blend = blend_test

    # Method 2: current_single_rf (existing hybrid_rf approach)
    single_resid = rf_single.predict(X_test)
    pred_single_rf = np.maximum(0.0, blend_test + single_resid)

    # Method 3: hurdle_model (Two-Stage Hurdle Architecture)
    pop_test = clf.predict_proba(X_test)[:, 1]
    wet_resid = rf_wet.predict(X_test)
    wet_depth_pred = np.maximum(0.0, blend_test + wet_resid)
    pred_hurdle = np.where(pop_test < CLASSIFIER_THRESHOLD, 0.0, wet_depth_pred)

    # Masks
    dry_mask = act_test < 0.1
    wet_mask = act_test >= 0.1
    n_dry = np.sum(dry_mask)
    n_wet = np.sum(wet_mask)

    def calc_metrics(pred, actual):
        mae = float(np.mean(np.abs(pred - actual)))
        rmse = float(np.sqrt(np.mean((pred - actual) ** 2)))
        return mae, rmse

    # Compute metrics per subset
    subsets = {
        'ALL Hours': (np.ones(len(act_test), dtype=bool), len(act_test)),
        'DRY Hours (< 0.1mm)': (dry_mask, n_dry),
        'WET Hours (>= 0.1mm)': (wet_mask, n_wet)
    }

    print("\n" + "=" * 115)
    print(f"        THREE-WAY BENCHMARK ON HOLD-OUT TEST SET (N = 61,560, Hurdle tau = {CLASSIFIER_THRESHOLD:.2f})")
    print("=" * 115)
    print(f"{'Subset':<22} | {'Rows':<8} | {'weighted_blend':<24} | {'current_single_rf':<24} | {'hurdle_model':<24}")
    print(f"{'':<22} | {'':<8} | {'MAE':<10} {'RMSE':<12} | {'MAE':<10} {'RMSE':<12} | {'MAE':<10} {'RMSE':<12}")
    print("-" * 115)

    all_mae_blend, all_rmse_blend = 0.0, 0.0
    all_mae_single, all_rmse_single = 0.0, 0.0
    all_mae_hurdle, all_rmse_hurdle = 0.0, 0.0

    for name, (mask, count) in subsets.items():
        m_blend = calc_metrics(pred_blend[mask], act_test[mask])
        m_single = calc_metrics(pred_single_rf[mask], act_test[mask])
        m_hurdle = calc_metrics(pred_hurdle[mask], act_test[mask])

        if name == 'ALL Hours':
            all_mae_blend, all_rmse_blend = m_blend
            all_mae_single, all_rmse_single = m_single
            all_mae_hurdle, all_rmse_hurdle = m_hurdle

        print(f"{name:<22} | {count:<8,d} | {m_blend[0]:<10.4f} {m_blend[1]:<12.4f} | {m_single[0]:<10.4f} {m_single[1]:<12.4f} | {m_hurdle[0]:<10.4f} {m_hurdle[1]:<12.4f}")

    print("=" * 115)

    # 6. Exact Zeros on Dry Hours Analysis
    single_exact_zeros = int(np.sum(pred_single_rf[dry_mask] == 0.0))
    hurdle_exact_zeros = int(np.sum(pred_hurdle[dry_mask] == 0.0))
    blend_exact_zeros = int(np.sum(pred_blend[dry_mask] == 0.0))

    print("\n--- EXACT ZERO PREDICTIONS ON TRULY DRY HOURS (actual < 0.1mm, N = 38,733) ---")
    print(f"  - weighted_blend   : {blend_exact_zeros:>6,d} / {n_dry:,} ({blend_exact_zeros/n_dry*100:>5.2f}% exact zeros)")
    print(f"  - current_single_rf: {single_exact_zeros:>6,d} / {n_dry:,} ({single_exact_zeros/n_dry*100:>5.2f}% exact zeros)")
    print(f"  - hurdle_model     : {hurdle_exact_zeros:>6,d} / {n_dry:,} ({hurdle_exact_zeros/n_dry*100:>5.2f}% exact zeros)")

    # 7. Recovery Summary
    single_delta_vs_blend = ((all_mae_single - all_mae_blend) / all_mae_blend) * 100.0
    hurdle_delta_vs_blend = ((all_mae_hurdle - all_mae_blend) / all_mae_blend) * 100.0
    hurdle_delta_vs_single = ((all_mae_hurdle - all_mae_single) / all_mae_single) * 100.0

    print("\n--- OVERALL TEST PERFORMANCE SUMMARY & RECOVERY AUDIT ---")
    print(f"1. weighted_blend Baseline MAE : {all_mae_blend:.4f} mm | RMSE: {all_rmse_blend:.4f} mm")
    print(f"2. current_single_rf MAE       : {all_mae_single:.4f} mm | RMSE: {all_rmse_single:.4f} mm ({single_delta_vs_blend:+5.2f}% vs blend)")
    print(f"3. hurdle_model MAE            : {all_mae_hurdle:.4f} mm | RMSE: {all_rmse_hurdle:.4f} mm ({hurdle_delta_vs_blend:+5.2f}% vs blend)")
    print(f"4. Hurdle Improvement over RF  : {hurdle_delta_vs_single:+5.2f}% MAE drop ({all_mae_single:.4f} -> {all_mae_hurdle:.4f} mm)")
    
    if all_mae_hurdle < all_mae_blend:
        print("\n>>> CONCLUSION: HURDLE MODEL SUCCESSFULLY BEATS BOTH SINGLE-RF AND WEIGHTED BLEND!")
    else:
        print(f"\n>>> CONCLUSION: Hurdle recovered {all_mae_single - all_mae_hurdle:.4f} mm from the single-RF penalty.")
    print("=" * 115 + "\n")


if __name__ == '__main__':
    main()
