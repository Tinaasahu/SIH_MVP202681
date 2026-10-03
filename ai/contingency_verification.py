import os
import sys
import joblib
import numpy as np
import pandas as pd

# Terminal encoding for Windows console compatibility
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

# Named thresholds (IMD Rainfall Brackets)
IMD_THRESHOLDS = {
    'Light (>=0.1mm)': 0.1,
    'Moderate (>=15.6mm)': 15.6,
    'Heavy (>=64.5mm)': 64.5
}

# Feature columns copied verbatim from ai/train.py
FEATURE_COLS = [
    'latitude', 'longitude', 'lead_days', 'hour',
    'temperature_ecmwf', 'temperature_gfs', 'temperature_icon', 'temperature_gem',
    'rainfall_ecmwf', 'rainfall_gfs', 'rainfall_icon', 'rainfall_gem',
    'wind_speed_ecmwf', 'wind_speed_gfs', 'wind_speed_icon', 'wind_speed_gem',
    'blend_temperature', 'blend_rainfall', 'blend_wind_speed',
    'spread_temperature', 'spread_rainfall', 'spread_wind_speed'
]


def main():
    data_path = 'outputs/interim/ml_table.csv'
    model_path = 'outputs/models/rf_rainfall.joblib'
    out_csv_path = 'outputs/contingency_metrics.csv'

    print(f"Loading data from {data_path}...")
    df = pd.read_csv(data_path)

    # Filter strictly to TEST split
    test_df = df[df['split'] == 'test'].copy()
    n_test = len(test_df)
    print(f"Test split rows: {n_test:,}")
    if n_test != 61560:
        raise AssertionError(f"Expected exactly 61,560 rows in TEST split, but got {n_test}")

    # Ground truth actual rainfall
    actual = test_df['actual_rainfall'].values

    # Forecast vectors for the 3 methods
    print(f"Loading trained RF model from {model_path} to reconstruct hybrid_rf...")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Missing RF model at {model_path}")
    rf_model = joblib.load(model_path)

    print("Computing hybrid_rf predictions on TEST split...")
    blend_rainfall = test_df['blend_rainfall'].values
    pred_resid = rf_model.predict(test_df[FEATURE_COLS])
    hybrid_rf_pred = np.maximum(0.0, blend_rainfall + pred_resid)

    forecasts = {
        'ecmwf': test_df['rainfall_ecmwf'].values,
        'weighted_blend': blend_rainfall,
        'hybrid_rf': hybrid_rf_pred
    }

    # Evaluate 2x2 contingency tables
    records = []

    for method_name, fc_vals in forecasts.items():
        for thresh_name, thresh_val in IMD_THRESHOLDS.items():
            observed_event = actual >= thresh_val
            predicted_event = fc_vals >= thresh_val

            hits = int(np.sum(observed_event & predicted_event))
            misses = int(np.sum(observed_event & ~predicted_event))
            false_alarms = int(np.sum(~observed_event & predicted_event))
            correct_negatives = int(np.sum(~observed_event & ~predicted_event))

            # POD = hits / (hits + misses)
            denom_pod = hits + misses
            pod = round(hits / denom_pod, 4) if denom_pod > 0 else np.nan

            # FAR = false_alarms / (hits + false_alarms)
            denom_far = hits + false_alarms
            far = round(false_alarms / denom_far, 4) if denom_far > 0 else np.nan

            # CSI = hits / (hits + misses + false_alarms)
            denom_csi = hits + misses + false_alarms
            csi = round(hits / denom_csi, 4) if denom_csi > 0 else np.nan

            records.append({
                'method': method_name,
                'threshold_name': thresh_name,
                'threshold_mm': thresh_val,
                'hits': hits,
                'misses': misses,
                'false_alarms': false_alarms,
                'correct_negatives': correct_negatives,
                'pod': pod,
                'far': far,
                'csi': csi
            })

    results_df = pd.DataFrame(records)

    # --- Strict Assertions (raise clear error, never auto-fix) ---
    if len(results_df) != 9:
        raise AssertionError(f"Expected exactly 9 rows, but got {len(results_df)}")

    for idx, row in results_df.iterrows():
        total_events = row['hits'] + row['misses'] + row['false_alarms'] + row['correct_negatives']
        if total_events != n_test:
            raise AssertionError(
                f"Row {idx} ({row['method']}, {row['threshold_name']}) total events sum to {total_events}, expected {n_test}"
            )

        for metric in ['pod', 'far', 'csi']:
            val = row[metric]
            if not np.isnan(val) and not (0.0 <= val <= 1.0):
                raise AssertionError(f"Row {idx} metric '{metric}' has invalid value {val}")

    # Save to outputs/contingency_metrics.csv
    os.makedirs('outputs', exist_ok=True)
    results_df.to_csv(out_csv_path, index=False)
    print(f"\nSuccessfully written contingency metrics to {out_csv_path}")

    # --- Formatted Printout ---
    print("\n" + "=" * 110)
    print("           NCMRWF / IMD STANDARD CONTINGENCY VERIFICATION (HOLD-OUT TEST SPLIT, N=61,560)")
    print("=" * 110)
    print(f"{'Method':<16} | {'Threshold':<22} | {'Hits':<7} | {'Misses':<7} | {'FalseAlm':<8} | {'POD':<8} | {'FAR':<8} | {'CSI':<8}")
    print("-" * 110)

    for _, r in results_df.iterrows():
        pod_str = f"{r['pod']:.4f}" if not np.isnan(r['pod']) else "NaN"
        far_str = f"{r['far']:.4f}" if not np.isnan(r['far']) else "NaN"
        csi_str = f"{r['csi']:.4f}" if not np.isnan(r['csi']) else "NaN"

        print(
            f"{r['method']:<16} | {r['threshold_name']:<22} | {r['hits']:<7,d} | {r['misses']:<7,d} | "
            f"{r['false_alarms']:<8,d} | {pod_str:<8} | {far_str:<8} | {csi_str:<8}"
        )
    print("=" * 110)

    # Highlight best method per threshold
    print("\n--- BEST METHOD BY CRITICAL SUCCESS INDEX (CSI) ---")
    for thresh_name in IMD_THRESHOLDS.keys():
        sub_df = results_df[results_df['threshold_name'] == thresh_name]
        best_row = sub_df.sort_values(by='csi', ascending=False).iloc[0]
        print(f"  * {thresh_name:<22}: Best = {best_row['method']:<15} (CSI = {best_row['csi']:.4f}, POD = {best_row['pod']:.4f}, FAR = {best_row['far']:.4f})")
    print("-" * 65 + "\n")


if __name__ == '__main__':
    main()
