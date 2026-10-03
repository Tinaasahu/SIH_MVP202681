import os
import sys
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

# Top-level named constants (copied verbatim from ai/train.py)
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

    # 2. Binary target: is_wet = 1 if actual_rainfall >= 0.1 else 0
    y_train = (train_df['actual_rainfall'] >= 0.1).astype(int)
    y_test = (test_df['actual_rainfall'] >= 0.1).astype(int)

    X_train = train_df[FEATURE_COLS]
    X_test = test_df[FEATURE_COLS]

    print(f"TRAIN split: {len(y_train):,} total rows | Wet: {y_train.sum():,} ({y_train.mean()*100:.2f}%) | Dry: {(1 - y_train).sum():,} ({(1 - y_train.mean())*100:.2f}%)")
    print(f"TEST split : {len(y_test):,} total rows | Wet: {y_test.sum():,} ({y_test.mean()*100:.2f}%) | Dry: {(1 - y_test).sum():,} ({(1 - y_test.mean())*100:.2f}%)")

    # 3. Train or load RandomForestClassifier
    out_model_path = 'outputs/models/rf_rain_classifier.joblib'
    if os.path.exists(out_model_path):
        print(f"\nTrained classifier already exists at {out_model_path}. Loading...")
        clf = joblib.load(out_model_path)
        print("Classifier loaded successfully.")
    else:
        print("\nTraining PoP Stage-1 RandomForestClassifier...")
        clf = RandomForestClassifier(**RF_PARAMS)
        clf.fit(X_train, y_train)
        os.makedirs('outputs/models', exist_ok=True)
        joblib.dump(clf, out_model_path)
        print(f"Classifier saved successfully to -> {out_model_path}")

    # 4. Predict PoP probabilities on TEST split
    # Class 1 probability is Probability of Precipitation (PoP)
    print("Computing PoP probabilities on TEST split...")
    pop_test = clf.predict_proba(X_test)[:, 1]

    # Ground truth masks on TEST split
    dry_mask = (y_test == 0).values  # actual < 0.1 mm
    wet_mask = (y_test == 1).values  # actual >= 0.1 mm
    n_dry = dry_mask.sum()
    n_wet = wet_mask.sum()

    # 5. Evaluate Candidate Thresholds
    thresholds = [0.25, 0.30, 0.35, 0.40, 0.45]
    results = []

    for tau in thresholds:
        pred_wet = (pop_test >= tau).astype(int)

        # True Positives, False Positives, True Negatives, False Negatives
        tp = int(np.sum((pred_wet == 1) & wet_mask))
        fp = int(np.sum((pred_wet == 1) & dry_mask))
        tn = int(np.sum((pred_wet == 0) & dry_mask))
        fn = int(np.sum((pred_wet == 0) & wet_mask))

        # Metrics
        fpr_dry = (fp / n_dry) * 100.0  # False Positive Rate on truly dry hours (false rain alarm)
        fnr_wet = (fn / n_wet) * 100.0  # False Negative Rate on truly wet hours (missed rain)

        precision = (tp / (tp + fp)) * 100.0 if (tp + fp) > 0 else 0.0
        recall = (tp / (tp + fn)) * 100.0 if (tp + fn) > 0 else 0.0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

        results.append({
            'threshold': tau,
            'fpr_dry': fpr_dry,
            'fp_count': fp,
            'fnr_wet': fnr_wet,
            'fn_count': fn,
            'precision': precision,
            'recall': recall,
            'f1': f1,
        })

    # 6. Print Comparison Table
    print("\n" + "=" * 94)
    print("      STAGE-1 RAIN CLASSIFIER THRESHOLD OPTIMIZATION (HOLD-OUT TEST SPLIT, N=61,560)")
    print("=" * 94)
    print(f"{'Threshold (tau)':<16} | {'FPR Dry (False Alarms)':<24} | {'FNR Wet (Missed Rain)':<23} | {'Precision':<10} | {'Recall':<8} | {'F1-Score':<8}")
    print("-" * 94)
    for r in results:
        print(f"  tau = {r['threshold']:.2f}     | {r['fpr_dry']:>6.2f}% ({r['fp_count']:>5,d}/{n_dry:,})  | {r['fnr_wet']:>6.2f}% ({r['fn_count']:>5,d}/{n_wet:,})  | {r['precision']:>8.2f}% | {r['recall']:>6.2f}% | {r['f1']:>7.2f}%")
    print("=" * 94)

    # 7. Print Feature Importances (Top 8)
    importances = clf.feature_importances_
    sorted_idx = np.argsort(importances)[::-1]

    print("\n--- TOP 8 FEATURE IMPORTANCES (rf_rain_classifier) ---")
    for rank, idx in enumerate(sorted_idx[:8], 1):
        feature_name = FEATURE_COLS[idx]
        imp_val = importances[idx]
        print(f"  {rank}. {feature_name:<22} : {imp_val*100:>6.2f}%")
    print("-" * 55 + "\n")


if __name__ == '__main__':
    main()
