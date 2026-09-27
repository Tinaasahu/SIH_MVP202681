"""
make_training_charts.py
Reads trained RF models and ml_table.csv, computes metrics, saves 3 charts.
Never modifies models or writes outside outputs/charts/.
"""
import os
import numpy as np
import pandas as pd
import joblib
import matplotlib.pyplot as plt

# ---------------------------------------------------------------------------
# Constants — copied verbatim from ai/train.py
# ---------------------------------------------------------------------------
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

# NWP model columns per variable (for equal_avg baseline)
NWP_COLS = {
    'temperature': ['temperature_ecmwf', 'temperature_gfs', 'temperature_icon', 'temperature_gem'],
    'rainfall':    ['rainfall_ecmwf',    'rainfall_gfs',    'rainfall_icon',    'rainfall_gem'],
    'wind_speed':  ['wind_speed_ecmwf',  'wind_speed_gfs',  'wind_speed_icon',  'wind_speed_gem'],
}

CLIP_VARS = {'rainfall', 'wind_speed'}  # clip at 0
LEADS = [1, 2, 3]
LEAD_LABELS = {1: '24 h', 2: '48 h', 3: '72 h'}


def rmse(actual, forecast):
    return np.sqrt(np.mean((actual - forecast) ** 2))


def main():
    # ---- 0. Load & split ----
    df = pd.read_csv('outputs/interim/ml_table.csv')
    df['datetime'] = pd.to_datetime(df['datetime'])

    train_df = df[df['split'] == 'train'].copy()
    test_df  = df[df['split'] == 'test'].copy()

    # Assertions
    if len(train_df) != 136080:
        raise ValueError(f"Expected 136080 train rows, got {len(train_df)}")
    if len(test_df) != 61560:
        raise ValueError(f"Expected 61560 test rows, got {len(test_df)}")
    if train_df[FEATURE_COLS].isna().any().any() or test_df[FEATURE_COLS].isna().any().any():
        raise ValueError("NaN found in FEATURE_COLS")

    os.makedirs('outputs/charts', exist_ok=True)

    # ---- Collect results per variable ----
    # chart1 data: {var: {split: {lead: rmse}}}
    chart1_data = {}
    # chart2 data: {var: [(feature, importance), ...]}  top 8
    chart2_data = {}
    # chart3 data: {var: [ecmwf, equal_avg, weighted_blend, bias_corrected, hybrid]}
    chart3_data = {}

    for var, actual_col in VARIABLES.items():
        blend_col = f'blend_{var}'
        resid_col = f'resid_{var}'
        ecmwf_col = f'{var}_ecmwf'

        # ---- a. Load model ----
        model_path = f'outputs/models/rf_{var}.joblib'
        rf = joblib.load(model_path)
        print(f"Loaded model: {model_path}")

        # ---- b. Predict residuals ----
        X_train = train_df[FEATURE_COLS]
        X_test  = test_df[FEATURE_COLS]
        pred_train = rf.predict(X_train)
        pred_test  = rf.predict(X_test)
        print(f"  Predictions OK  train={len(pred_train)}, test={len(pred_test)}")

        # ---- c. Hybrid forecast ----
        hybrid_train = train_df[blend_col].values + pred_train
        hybrid_test  = test_df[blend_col].values  + pred_test
        if var in CLIP_VARS:
            hybrid_train = np.maximum(0, hybrid_train)
            hybrid_test  = np.maximum(0, hybrid_test)

        # ---- d. RMSE by lead_days for train & test ----
        chart1_data[var] = {'train': {}, 'test': {}}
        for lead in LEADS:
            m_tr = train_df['lead_days'] == lead
            m_te = test_df['lead_days']  == lead
            chart1_data[var]['train'][lead] = rmse(train_df.loc[m_tr, actual_col], hybrid_train[m_tr.values])
            chart1_data[var]['test'][lead]  = rmse(test_df.loc[m_te, actual_col],  hybrid_test[m_te.values])

        # ---- e. Feature importances — top 8 ----
        imps = rf.feature_importances_
        pairs = sorted(zip(FEATURE_COLS, imps), key=lambda x: x[1], reverse=True)[:8]
        chart2_data[var] = pairs

        # ---- f. Baseline RMSE on TEST per lead_days ----
        # ecmwf
        ecmwf_rmse = {}
        equal_avg_rmse = {}
        blend_rmse = {}
        for lead in LEADS:
            m = test_df['lead_days'] == lead
            actual = test_df.loc[m, actual_col]
            ecmwf_rmse[lead]    = rmse(actual, test_df.loc[m, ecmwf_col])
            equal_avg_rmse[lead] = rmse(actual, test_df.loc[m, NWP_COLS[var]].mean(axis=1))
            blend_rmse[lead]     = rmse(actual, test_df.loc[m, blend_col])

        # ---- g. Bias-corrected baseline ----
        bias_by_group = train_df.groupby(['city', 'lead_days'])[resid_col].mean()
        keys = list(zip(test_df['city'], test_df['lead_days']))
        bias_series = pd.Series([bias_by_group.loc[k] for k in keys], index=test_df.index)
        bc_forecast = test_df[blend_col] + bias_series
        if var in CLIP_VARS:
            bc_forecast = np.maximum(0, bc_forecast)

        bc_rmse = {}
        for lead in LEADS:
            m = test_df['lead_days'] == lead
            bc_rmse[lead] = rmse(test_df.loc[m, actual_col], bc_forecast[m])

        # ---- h. chart3 uses TEST RMSE at lead_days==1 ----
        chart3_data[var] = [
            ecmwf_rmse[1],
            equal_avg_rmse[1],
            blend_rmse[1],
            bc_rmse[1],
            chart1_data[var]['test'][1],
        ]

    # ======================================================================
    # Print tables and save charts
    # ======================================================================

    # ---- CHART 1: Train vs Test RMSE (grouped bar) ----
    print("\n" + "=" * 70)
    print("CHART 1 — Train vs Test RMSE (Hybrid RF)")
    print("=" * 70)
    for var in VARIABLES:
        print(f"\n  {var.upper()}")
        print(f"  {'Lead':<6} {'Train RMSE':<12} {'Test RMSE':<12}")
        print(f"  {'-'*30}")
        for lead in LEADS:
            tr = chart1_data[var]['train'][lead]
            te = chart1_data[var]['test'][lead]
            print(f"  {LEAD_LABELS[lead]:<6} {tr:<12.4f} {te:<12.4f}")

    fig1, axes1 = plt.subplots(1, 3, figsize=(14, 5), sharey=False)
    fig1.suptitle('Hybrid RF — Train vs Test RMSE', fontsize=14, fontweight='bold')
    bar_w = 0.3
    x_pos = np.arange(len(LEADS))

    for ax, var in zip(axes1, VARIABLES):
        tr_vals = [chart1_data[var]['train'][l] for l in LEADS]
        te_vals = [chart1_data[var]['test'][l]  for l in LEADS]
        bars_tr = ax.bar(x_pos - bar_w/2, tr_vals, bar_w, label='Train', color='#4C72B0')
        bars_te = ax.bar(x_pos + bar_w/2, te_vals, bar_w, label='Test',  color='#DD8452')
        # Annotate
        for b in bars_tr:
            ax.text(b.get_x() + b.get_width()/2, b.get_height(), f'{b.get_height():.3f}',
                    ha='center', va='bottom', fontsize=7)
        for b in bars_te:
            ax.text(b.get_x() + b.get_width()/2, b.get_height(), f'{b.get_height():.3f}',
                    ha='center', va='bottom', fontsize=7)
        ax.set_xticks(x_pos)
        ax.set_xticklabels([LEAD_LABELS[l] for l in LEADS])
        ax.set_title(var.replace('_', ' ').title())
        ax.set_ylabel('RMSE')
        ax.legend(fontsize=8)

    fig1.tight_layout(rect=[0, 0, 1, 0.93])
    fig1.savefig('outputs/charts/chart1_train_vs_test_rmse.png', dpi=200)
    plt.close(fig1)
    print("\n  [OK] Saved chart1_train_vs_test_rmse.png")

    # ---- CHART 2: Feature importances (horizontal bar) ----
    print("\n" + "=" * 70)
    print("CHART 2 — Top 8 Feature Importances")
    print("=" * 70)
    for var in VARIABLES:
        print(f"\n  {var.upper()}")
        for rank, (feat, imp) in enumerate(chart2_data[var], 1):
            print(f"  {rank}. {feat:<25} {imp:.4f}")

    fig2, axes2 = plt.subplots(1, 3, figsize=(16, 5), sharey=False)
    fig2.suptitle('RF Feature Importances — Top 8', fontsize=14, fontweight='bold')

    for ax, var in zip(axes2, VARIABLES):
        feats = [f for f, _ in chart2_data[var]][::-1]       # reversed for horizontal bar
        imps  = [v for _, v in chart2_data[var]][::-1]
        bars = ax.barh(feats, imps, color='#55A868')
        for b in bars:
            ax.text(b.get_width(), b.get_y() + b.get_height()/2,
                    f' {b.get_width():.4f}', va='center', fontsize=7)
        ax.set_title(var.replace('_', ' ').title())
        ax.set_xlabel('Importance')

    fig2.tight_layout(rect=[0, 0, 1, 0.93])
    fig2.savefig('outputs/charts/chart2_feature_importance.png', dpi=200)
    plt.close(fig2)
    print("\n  [OK] Saved chart2_feature_importance.png")

    # ---- CHART 3: Layer-by-layer improvement (line) ----
    stages = ['ECMWF alone', 'Equal average', 'Weighted blend',
              'Blend+bias-corrected', 'Hybrid(+RF)']

    print("\n" + "=" * 70)
    print("CHART 3 — Layer-by-Layer Improvement (TEST RMSE, lead_days=1)")
    print("=" * 70)
    print(f"\n  {'Stage':<25}", end='')
    for var in VARIABLES:
        print(f" {var:<14}", end='')
    print()
    print(f"  {'-'*65}")
    for i, stage in enumerate(stages):
        print(f"  {stage:<25}", end='')
        for var in VARIABLES:
            print(f" {chart3_data[var][i]:<14.4f}", end='')
        print()

    fig3, ax3 = plt.subplots(figsize=(10, 6))
    fig3.suptitle('Layer-by-Layer Improvement — TEST RMSE (24 h lead)', fontsize=13, fontweight='bold')
    x3 = np.arange(len(stages))
    colors = {'temperature': '#4C72B0', 'rainfall': '#55A868', 'wind_speed': '#DD8452'}
    markers = {'temperature': 'o', 'rainfall': 's', 'wind_speed': '^'}

    for var in VARIABLES:
        vals = chart3_data[var]
        ax3.plot(x3, vals, marker=markers[var], label=var.replace('_', ' ').title(),
                 color=colors[var], linewidth=2, markersize=7)
        for i, v in enumerate(vals):
            ax3.annotate(f'{v:.3f}', (x3[i], v), textcoords='offset points',
                         xytext=(0, 10), ha='center', fontsize=7)

    ax3.set_xticks(x3)
    ax3.set_xticklabels(stages, rotation=18, ha='right', fontsize=9)
    ax3.set_ylabel('RMSE')
    ax3.legend()
    ax3.grid(axis='y', alpha=0.3)

    fig3.tight_layout(rect=[0, 0, 1, 0.93])
    fig3.savefig('outputs/charts/chart3_layer_by_layer_improvement.png', dpi=200)
    plt.close(fig3)
    print("\n  [OK] Saved chart3_layer_by_layer_improvement.png")

    print("\n[OK] All 3 charts written to outputs/charts/")


if __name__ == '__main__':
    main()
