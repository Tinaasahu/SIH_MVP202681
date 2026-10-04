import os
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import RandomForestRegressor

# Top-level named constants
TRAIN = 'train'
TEST = 'test'
RF_PARAMS = dict(n_estimators=100, max_depth=12, min_samples_leaf=50, n_jobs=-1, random_state=42)

VARIABLES = {
    'temperature': 'actual_temperature',
    'rainfall': 'actual_rainfall',
    'wind_speed': 'actual_wind'
}

# Exact 29 feature columns from features_6model.py
FEATURE_COLS = [
    'latitude', 'longitude', 'elevation_m', 'lead_days', 'hour',
    'temperature_ecmwf', 'temperature_gfs', 'temperature_icon', 'temperature_gem', 'temperature_ukmo', 'temperature_jma',
    'rainfall_ecmwf', 'rainfall_gfs', 'rainfall_icon', 'rainfall_gem', 'rainfall_ukmo', 'rainfall_jma',
    'wind_speed_ecmwf', 'wind_speed_gfs', 'wind_speed_icon', 'wind_speed_gem', 'wind_speed_ukmo', 'wind_speed_jma',
    'blend_temperature', 'blend_rainfall', 'blend_wind_speed',
    'spread_temperature', 'spread_rainfall', 'spread_wind_speed'
]

# Exact 21 feature columns used by original 4-model architecture
FEATURE_COLS_4 = [
    'latitude', 'longitude', 'lead_days', 'hour',
    'temperature_ecmwf', 'temperature_gfs', 'temperature_icon', 'temperature_gem',
    'rainfall_ecmwf', 'rainfall_gfs', 'rainfall_icon', 'rainfall_gem',
    'wind_speed_ecmwf', 'wind_speed_gfs', 'wind_speed_icon', 'wind_speed_gem',
    'blend_temperature', 'blend_rainfall', 'blend_wind_speed',
    'spread_temperature', 'spread_rainfall', 'spread_wind_speed'
]


def main():
    base_dir = Path(__file__).resolve().parent.parent
    data_6m_path = base_dir / 'outputs' / 'interim' / 'ml_table_6model.csv'
    data_4m_path = base_dir / 'outputs' / 'interim' / 'ml_table.csv'
    models_dir = base_dir / 'outputs' / 'models'
    os.makedirs(models_dir, exist_ok=True)

    # 1. Load 6-model dataset
    print(f"Reading 6-model dataset from {data_6m_path}...")
    df_6m = pd.read_csv(data_6m_path, low_memory=False)
    df_6m['datetime'] = pd.to_datetime(df_6m['datetime'])

    train_df = df_6m[df_6m['split'] == TRAIN].copy()
    test_df = df_6m[df_6m['split'] == TEST].copy()

    # Assertions on 6-model dataset
    if len(train_df) != 136080 or len(test_df) != 61560:
        raise ValueError(f"Invalid split counts: TRAIN={len(train_df)}, TEST={len(test_df)}")

    resid_cols = [f'resid_{v}' for v in VARIABLES.keys()]
    if df_6m[FEATURE_COLS + resid_cols].isna().any().any():
        raise ValueError("Found NaN values in FEATURE_COLS or resid_ columns")

    for col in FEATURE_COLS:
        if col.startswith('actual') or col.startswith('resid'):
            raise ValueError(f"Feature column '{col}' starts with 'actual' or 'resid'")

    max_train_dt = train_df['datetime'].max()
    if max_train_dt >= pd.Timestamp('2026-08-29'):
        raise ValueError(f"Max TRAIN datetime ({max_train_dt}) is not earlier than 2026-08-29")

    # 2. Load 4-model dataset TEST split for baseline comparison
    print(f"Reading original 4-model dataset for benchmark from {data_4m_path}...")
    df_4m = pd.read_csv(data_4m_path, low_memory=False)
    test_df_4m = df_4m[df_4m['split'] == TEST].copy()

    if len(test_df_4m) != 61560:
        raise ValueError(f"Expected 61560 test rows in ml_table.csv, got {len(test_df_4m)}")

    print("=" * 80)
    print("STARTING MODEL TRAINING & EVALUATION (3 VARIABLES)")
    print("=" * 80)

    # 3. Fit models, generate forecasts and evaluate per variable
    for var, actual_col in VARIABLES.items():
        print(f"\n>>> PROCESSING VARIABLE: {var.upper()}")
        blend_col = f'blend_{var}'
        resid_col = f'resid_{var}'
        ecmwf_col = f'{var}_ecmwf'

        # Fit new 6-model RandomForestRegressor
        X_train = train_df[FEATURE_COLS]
        y_train = train_df[resid_col]
        X_test = test_df[FEATURE_COLS]

        print(f"Training 6-model RF on {len(X_train):,} rows with {len(FEATURE_COLS)} features...")
        rf_6m = RandomForestRegressor(**RF_PARAMS)
        rf_6m.fit(X_train, y_train)

        # Save 6-model model (never overwrite 4-model files)
        model_6m_path = models_dir / f'rf_{var}_6model.joblib'
        joblib.dump(rf_6m, model_6m_path)
        print(f"Saved 6-model model to: {model_6m_path}")

        # Predict residuals with 6-model RF
        pred_train_resid_6m = rf_6m.predict(X_train)
        pred_test_resid_6m = rf_6m.predict(X_test)

        # Hybrid RF 6-model forecasts
        hybrid_train_6m = train_df[blend_col] + pred_train_resid_6m
        hybrid_test_6m = test_df[blend_col] + pred_test_resid_6m

        if var in ['rainfall', 'wind_speed']:
            hybrid_train_6m = np.maximum(0, hybrid_train_6m)
            hybrid_test_6m = np.maximum(0, hybrid_test_6m)

        # Load original 4-model RF and compute its predictions on original test split
        model_4m_path = models_dir / f'rf_{var}.joblib'
        if not model_4m_path.exists():
            raise FileNotFoundError(f"Original 4-model model not found at {model_4m_path}")
        rf_4m = joblib.load(model_4m_path)
        pred_test_resid_4m = rf_4m.predict(test_df_4m[FEATURE_COLS_4])
        hybrid_test_4m = test_df_4m[blend_col] + pred_test_resid_4m
        if var in ['rainfall', 'wind_speed']:
            hybrid_test_4m = np.maximum(0, hybrid_test_4m)

        # Compute TRAIN biases for 6-model baselines
        # A. 6-model blend bias (actual - blend = resid_<var>)
        bias_blend_df = train_df.groupby(['city', 'lead_days'])[resid_col].mean().reset_index()
        bias_blend_dict = bias_blend_df.set_index(['city', 'lead_days'])[resid_col].to_dict()
        keys_test = list(zip(test_df['city'], test_df['lead_days']))
        bias_blend_test = pd.Series([bias_blend_dict[k] for k in keys_test], index=test_df.index)

        # B. ecmwf bias (actual - ecmwf)
        train_df['ecmwf_resid'] = train_df[actual_col] - train_df[ecmwf_col]
        bias_ecmwf_df = train_df.groupby(['city', 'lead_days'])['ecmwf_resid'].mean().reset_index()
        bias_ecmwf_dict = bias_ecmwf_df.set_index(['city', 'lead_days'])['ecmwf_resid'].to_dict()
        bias_ecmwf_test = pd.Series([bias_ecmwf_dict[k] for k in keys_test], index=test_df.index)

        # Forecasts on TEST split
        test_forecasts = {}
        test_forecasts['ecmwf'] = test_df[ecmwf_col]

        ecmwf_bc = test_df[ecmwf_col] + bias_ecmwf_test
        if var in ['rainfall', 'wind_speed']:
            ecmwf_bc = np.maximum(0, ecmwf_bc)
        test_forecasts['ecmwf_bias_corrected'] = ecmwf_bc

        test_forecasts['weighted_blend'] = test_df[blend_col]

        blend_bc = test_df[blend_col] + bias_blend_test
        if var in ['rainfall', 'wind_speed']:
            blend_bc = np.maximum(0, blend_bc)
        test_forecasts['bias_corrected'] = blend_bc

        test_forecasts['hybrid_rf_4model_ORIGINAL'] = hybrid_test_4m
        test_forecasts['hybrid_rf_6model_NEW'] = hybrid_test_6m

        actual_test = test_df[actual_col]
        actual_train = train_df[actual_col]

        # Compute TEST metrics per method and lead_days
        methods = [
            'ecmwf',
            'weighted_blend',
            'bias_corrected',
            'ecmwf_bias_corrected',
            'hybrid_rf_4model_ORIGINAL',
            'hybrid_rf_6model_NEW'
        ]
        metrics = {m: {'rmse': {}, 'mae': {}} for m in methods}

        for m in methods:
            fc = test_forecasts[m]
            for lead in [1, 2, 3]:
                mask = test_df['lead_days'] == lead
                err = actual_test[mask] - fc[mask]
                rmse = np.sqrt(np.mean(err ** 2))
                mae = np.mean(np.abs(err))
                metrics[m]['rmse'][lead] = rmse
                metrics[m]['mae'][lead] = mae

        # a) Full TEST Table
        print(f"\n--- TEST EVALUATION TABLE: {var.upper()} ---")
        headers = ["Method", "RMSE_L1", "RMSE_L2", "RMSE_L3", "MAE_L1", "MAE_L2", "MAE_L3"]
        print(f"{headers[0]:<26} | {headers[1]:<8} | {headers[2]:<8} | {headers[3]:<8} | {headers[4]:<8} | {headers[5]:<8} | {headers[6]:<8}")
        print("-" * 85)
        for m in methods:
            r1, r2, r3 = metrics[m]['rmse'][1], metrics[m]['rmse'][2], metrics[m]['rmse'][3]
            m1, m2, m3 = metrics[m]['mae'][1], metrics[m]['mae'][2], metrics[m]['mae'][3]
            print(f"{m:<26} | {r1:<8.4f} | {r2:<8.4f} | {r3:<8.4f} | {m1:<8.4f} | {m2:<8.4f} | {m3:<8.4f}")

        # b) THE VERDICT NUMBER: hybrid_rf_6model vs hybrid_rf_4model_ORIGINAL
        print(f"\n" + "=" * 80)
        print(f"THE VERDICT: HYBRID RF 6-MODEL vs HYBRID RF 4-MODEL ORIGINAL ({var.upper()})")
        print("=" * 80)
        for lead in [1, 2, 3]:
            rf6_rmse = metrics['hybrid_rf_6model_NEW']['rmse'][lead]
            rf4_rmse = metrics['hybrid_rf_4model_ORIGINAL']['rmse'][lead]
            diff = rf6_rmse - rf4_rmse
            pct = (diff / rf4_rmse) * 100.0
            print(f"Lead {lead}:")
            print(f"  * 6-Model Hybrid RMSE: {rf6_rmse:.4f} | 4-Model Hybrid RMSE: {rf4_rmse:.4f}")
            print(f"  * RMSE Difference: {diff:+.4f} ({pct:+.2f}%)")

        # c) TRAIN vs TEST RMSE for hybrid_rf_6model (Overfitting Check)
        print(f"\n--- HYBRID RF 6-MODEL OVERFITTING CHECK (TRAIN vs TEST RMSE: {var.upper()}) ---")
        for lead in [1, 2, 3]:
            mask_tr = train_df['lead_days'] == lead
            tr_err = actual_train[mask_tr] - hybrid_train_6m[mask_tr]
            tr_rmse = np.sqrt(np.mean(tr_err ** 2))
            te_rmse = metrics['hybrid_rf_6model_NEW']['rmse'][lead]

            gap = te_rmse - tr_rmse
            gap_pct = (gap / tr_rmse) * 100.0
            print(f"Lead {lead}: TRAIN RMSE = {tr_rmse:.4f}, TEST RMSE = {te_rmse:.4f} (Gap = {gap:+.4f}, {gap_pct:+.2f}%)")

        # d) Top 10 Feature Importances
        importances = rf_6m.feature_importances_
        sorted_indices = np.argsort(importances)[::-1][:10]
        print(f"\n--- TOP 10 FEATURE IMPORTANCES ({var.upper()}) ---")
        for rank, idx in enumerate(sorted_indices, 1):
            feat_name = FEATURE_COLS[idx]
            feat_val = importances[idx]
            tag = "  <-- [OROGRAPHY]" if feat_name == "elevation_m" else ""
            print(f"  {rank:2d}. {feat_name:<25} : {feat_val:.4f}{tag}")

        # Check where elevation_m ranks overall
        elev_idx = FEATURE_COLS.index('elevation_m')
        elev_val = importances[elev_idx]
        elev_rank = int(np.where(np.argsort(importances)[::-1] == elev_idx)[0][0]) + 1
        print(f"  ==> 'elevation_m' Rank: #{elev_rank} / {len(FEATURE_COLS)} (Importance: {elev_val:.4f})")
        print("=" * 80)


if __name__ == '__main__':
    main()
