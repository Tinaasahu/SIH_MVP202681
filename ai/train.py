import os
import joblib
import numpy as np
import pandas as pd
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

FEATURE_COLS = [
    'latitude', 'longitude', 'lead_days', 'hour',
    'temperature_ecmwf', 'temperature_gfs', 'temperature_icon', 'temperature_gem',
    'rainfall_ecmwf', 'rainfall_gfs', 'rainfall_icon', 'rainfall_gem',
    'wind_speed_ecmwf', 'wind_speed_gfs', 'wind_speed_icon', 'wind_speed_gem',
    'blend_temperature', 'blend_rainfall', 'blend_wind_speed',
    'spread_temperature', 'spread_rainfall', 'spread_wind_speed'
]


def main():
    # 1. Load data and split
    data_path = 'outputs/interim/ml_table.csv'
    df = pd.read_csv(data_path)
    df['datetime'] = pd.to_datetime(df['datetime'])

    train_df = df[df['split'] == TRAIN].copy()
    test_df = df[df['split'] == TEST].copy()

    # --- Assertions ---
    if len(train_df) != 136080 or len(test_df) != 61560:
        raise ValueError(f"Invalid split counts: TRAIN={len(train_df)}, TEST={len(test_df)}")

    resid_cols = [f'resid_{v}' for v in VARIABLES.keys()]
    if df[FEATURE_COLS + resid_cols].isna().any().any():
        raise ValueError("Found NaN values in FEATURE_COLS or resid_ columns")

    for col in FEATURE_COLS:
        if col.startswith('actual') or col.startswith('resid'):
            raise ValueError(f"Feature column '{col}' starts with 'actual' or 'resid'")

    max_train_dt = train_df['datetime'].max()
    if max_train_dt >= pd.Timestamp('2026-08-29'):
        raise ValueError(f"Max TRAIN datetime ({max_train_dt}) is not earlier than 2026-08-29")

    # Ensure output directory exists
    os.makedirs('outputs/models', exist_ok=True)

    # Expected values for cross-check on TEST split
    expected_blend_rmse = {
        'temperature': {1: 1.0607, 2: 1.1501, 3: 1.2194},
        'rainfall': {1: 0.7475, 2: 0.7915, 3: 0.8012},
        'wind_speed': {1: 2.9883, 2: 3.2254, 3: 3.3334}
    }
    expected_bc_rmse = {
        'temperature': {1: 0.9791, 2: 1.0611, 3: 1.1467},
        'rainfall': {1: 0.7468, 2: 0.7912, 3: 0.8037},
        'wind_speed': {1: 2.6133, 2: 2.7864, 3: 2.8696}
    }

    print("=== CROSS-CHECK TEST RMSE (weighted_blend & bias_corrected) ===")
    for var, actual_col in VARIABLES.items():
        blend_col = f'blend_{var}'
        resid_col = f'resid_{var}'

        # Compute TRAIN bias for blend
        bias_blend_df = train_df.groupby(['city', 'lead_days'])[resid_col].mean().reset_index()
        bias_blend_dict = bias_blend_df.set_index(['city', 'lead_days'])[resid_col].to_dict()
        keys_test = list(zip(test_df['city'], test_df['lead_days']))
        bias_blend_series = pd.Series([bias_blend_dict[k] for k in keys_test], index=test_df.index)

        bc_forecast = test_df[blend_col] + bias_blend_series
        if var in ['rainfall', 'wind_speed']:
            bc_forecast = np.maximum(0, bc_forecast)

        actual_test = test_df[actual_col]

        for lead in [1, 2, 3]:
            mask = test_df['lead_days'] == lead
            # weighted_blend check
            wb_rmse = np.sqrt(np.mean((actual_test[mask] - test_df.loc[mask, blend_col]) ** 2))
            wb_exp = expected_blend_rmse[var][lead]
            wb_status = "MATCH" if abs(wb_rmse - wb_exp) <= 0.001 else "MISMATCH"
            print(f" {var} weighted_blend lead{lead}: computed={wb_rmse:.4f}, exp={wb_exp:.4f} -> {wb_status}")

            # bias_corrected check
            bc_rmse = np.sqrt(np.mean((actual_test[mask] - bc_forecast[mask]) ** 2))
            bc_exp = expected_bc_rmse[var][lead]
            bc_status = "MATCH" if abs(bc_rmse - bc_exp) <= 0.001 else "MISMATCH"
            print(f" {var} bias_corrected  lead{lead}: computed={bc_rmse:.4f}, exp={bc_exp:.4f} -> {bc_status}")

    print("\n" + "=" * 70)

    # 2 & 3. Fit models, generate forecasts and evaluate per variable
    for var, actual_col in VARIABLES.items():
        blend_col = f'blend_{var}'
        resid_col = f'resid_{var}'
        ecmwf_col = f'{var}_ecmwf'

        # Fit RandomForestRegressor
        X_train = train_df[FEATURE_COLS]
        y_train = train_df[resid_col]
        X_test = test_df[FEATURE_COLS]

        rf = RandomForestRegressor(**RF_PARAMS)
        rf.fit(X_train, y_train)

        # Save model
        model_path = f'outputs/models/rf_{var}.joblib'
        joblib.dump(rf, model_path)
        print(f"Finished training and saved model for {var} -> {model_path}")

        # Predict residuals
        pred_train_resid = rf.predict(X_train)
        pred_test_resid = rf.predict(X_test)

        # Hybrid RF forecasts
        hybrid_train = train_df[blend_col] + pred_train_resid
        hybrid_test = test_df[blend_col] + pred_test_resid

        if var in ['rainfall', 'wind_speed']:
            hybrid_train = np.maximum(0, hybrid_train)
            hybrid_test = np.maximum(0, hybrid_test)

        # Compute TRAIN biases for baselines
        # 1. blend bias (actual - blend = resid_<var>)
        bias_blend_df = train_df.groupby(['city', 'lead_days'])[resid_col].mean().reset_index()
        bias_blend_dict = bias_blend_df.set_index(['city', 'lead_days'])[resid_col].to_dict()
        keys_test = list(zip(test_df['city'], test_df['lead_days']))
        bias_blend_test = pd.Series([bias_blend_dict[k] for k in keys_test], index=test_df.index)

        # 2. ecmwf bias (actual - ecmwf)
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

        test_forecasts['hybrid_rf'] = hybrid_test

        actual_test = test_df[actual_col]
        actual_train = train_df[actual_col]

        # Compute TEST metrics per method and lead_days
        methods = ['ecmwf', 'ecmwf_bias_corrected', 'weighted_blend', 'bias_corrected', 'hybrid_rf']
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

        # a) TEST Table
        print(f"\n--- TEST EVALUATION TABLE: {var.upper()} ---")
        headers = ["Method", "RMSE_L1", "RMSE_L2", "RMSE_L3", "MAE_L1", "MAE_L2", "MAE_L3"]
        print(f"{headers[0]:<22} | {headers[1]:<8} | {headers[2]:<8} | {headers[3]:<8} | {headers[4]:<8} | {headers[5]:<8} | {headers[6]:<8}")
        print("-" * 81)
        for m in methods:
            r1, r2, r3 = metrics[m]['rmse'][1], metrics[m]['rmse'][2], metrics[m]['rmse'][3]
            m1, m2, m3 = metrics[m]['mae'][1], metrics[m]['mae'][2], metrics[m]['mae'][3]
            print(f"{m:<22} | {r1:<8.4f} | {r2:<8.4f} | {r3:<8.4f} | {m1:<8.4f} | {m2:<8.4f} | {m3:<8.4f}")

        # b) hybrid_rf relative RMSE differences
        print(f"\n--- HYBRID RF RELATIVE RMSE COMPARISONS ({var.upper()}) ---")
        for lead in [1, 2, 3]:
            rf_rmse = metrics['hybrid_rf']['rmse'][lead]
            bc_rmse = metrics['bias_corrected']['rmse'][lead]
            wb_rmse = metrics['weighted_blend']['rmse'][lead]
            ebc_rmse = metrics['ecmwf_bias_corrected']['rmse'][lead]

            diff_bc = rf_rmse - bc_rmse
            pct_bc = (diff_bc / bc_rmse) * 100

            diff_wb = rf_rmse - wb_rmse
            pct_wb = (diff_wb / wb_rmse) * 100

            diff_ebc = rf_rmse - ebc_rmse
            pct_ebc = (diff_ebc / ebc_rmse) * 100

            print(f"Lead {lead}:")
            print(f"  hybrid_rf vs bias_corrected       RMSE diff: {diff_bc:+.4f} ({pct_bc:+.2f}%)")
            print(f"  hybrid_rf vs weighted_blend       RMSE diff: {diff_wb:+.4f} ({pct_wb:+.2f}%)")
            print(f"  hybrid_rf vs ecmwf_bias_corrected RMSE diff: {diff_ebc:+.4f} ({pct_ebc:+.2f}%)")

        # c) TRAIN vs TEST RMSE for hybrid_rf (Overfitting Check)
        print(f"\n--- HYBRID RF OVERFITTING CHECK (TRAIN vs TEST RMSE: {var.upper()}) ---")
        for lead in [1, 2, 3]:
            mask_tr = train_df['lead_days'] == lead
            mask_te = test_df['lead_days'] == lead

            tr_err = actual_train[mask_tr] - hybrid_train[mask_tr]
            tr_rmse = np.sqrt(np.mean(tr_err ** 2))
            te_rmse = metrics['hybrid_rf']['rmse'][lead]

            gap = te_rmse - tr_rmse
            gap_pct = (gap / tr_rmse) * 100
            print(f"Lead {lead}: TRAIN RMSE = {tr_rmse:.4f}, TEST RMSE = {te_rmse:.4f} (Gap = {gap:+.4f}, {gap_pct:+.2f}%)")

        # d) Top 8 Feature Importances
        importances = rf.feature_importances_
        sorted_indices = np.argsort(importances)[::-1][:8]
        print(f"\n--- TOP 8 FEATURE IMPORTANCES ({var.upper()}) ---")
        for rank, idx in enumerate(sorted_indices, 1):
            feat_name = FEATURE_COLS[idx]
            feat_val = importances[idx]
            print(f"  {rank}. {feat_name:<25} : {feat_val:.4f}")

        print("=" * 70)


if __name__ == '__main__':
    main()
