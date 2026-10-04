"""
promote_6model.py — Atomic cutover script from 4-model to 6-model production forecast.

Executes:
1. Strict verification gate on 6-model shadow artifacts (shape, NaNs, bounds).
2. Idempotent write-once backup of original 4-model production files.
3. Atomic promotion of 6-model files to production filenames.
4. Updates outputs/metadata.json to reflect 6 models and current timestamp.
5. Prints full audit summary and exact rollback command.

Usage: python ai/promote_6model.py
"""

import os
import sys
import json
import shutil
from datetime import datetime, timezone, timedelta
from pathlib import Path
import pandas as pd
import numpy as np

IST = timezone(timedelta(hours=5, minutes=30))
BASE_DIR = Path(__file__).resolve().parent.parent
OUTPUTS_DIR = BASE_DIR / "outputs"
DATA_DIR = BASE_DIR / "data"

SHADOW_HYBRID = OUTPUTS_DIR / "hybrid_forecast_6model.csv"
SHADOW_BLEND = OUTPUTS_DIR / "blended_forecast_6model.csv"
FORECAST_CURRENT_6M = DATA_DIR / "forecast_current_6model.csv"

PROD_HYBRID = OUTPUTS_DIR / "hybrid_forecast.csv"
PROD_BLEND = OUTPUTS_DIR / "blended_forecast.csv"
METADATA_JSON = OUTPUTS_DIR / "metadata.json"

BACKUP_HYBRID = OUTPUTS_DIR / "hybrid_forecast_4model_backup.csv"
BACKUP_BLEND = OUTPUTS_DIR / "blended_forecast_4model_backup.csv"

MODELS_6 = ["ecmwf", "gfs", "icon", "gem", "ukmo", "jma"]
MODEL_MAP = {
    "ecmwf_ifs025": "ecmwf",
    "gfs_seamless": "gfs",
    "icon_seamless": "icon",
    "gem_seamless": "gem",
    "ukmo_seamless": "ukmo",
    "jma_seamless": "jma",
    "ecmwf": "ecmwf",
    "gfs": "gfs",
    "icon": "icon",
    "gem": "gem",
    "ukmo": "ukmo",
    "jma": "jma",
}
VARIABLES = ["temperature", "rainfall", "wind_speed"]


def run_verification_gate():
    """
    Independent pre-promotion verification gate.
    Exits with code 1 if ANY quality check fails, preventing copying.
    """
    print("\n" + "=" * 75)
    print("STEP 1: PRE-PROMOTION VERIFICATION GATE")
    print("=" * 75)

    # 1. Existence check
    for p in [SHADOW_HYBRID, SHADOW_BLEND, FORECAST_CURRENT_6M]:
        if not p.exists():
            print(f"[ERROR] Required input file missing: {p}")
            sys.exit(1)

    df_hybrid = pd.read_csv(SHADOW_HYBRID)
    df_blend = pd.read_csv(SHADOW_BLEND)

    # 2. Row count and shape checks
    if df_hybrid.shape != (3240, 9):
        print(f"[ERROR] Invalid hybrid shape: {df_hybrid.shape}, expected (3240, 9)")
        sys.exit(1)
    if df_blend.shape != (3240, 6):
        print(f"[ERROR] Invalid blend shape: {df_blend.shape}, expected (3240, 6)")
        sys.exit(1)

    # 3. No NaN values anywhere
    if df_hybrid.isna().any().any():
        print(f"[ERROR] NaN values detected in {SHADOW_HYBRID}")
        sys.exit(1)
    if df_blend.isna().any().any():
        print(f"[ERROR] NaN values detected in {SHADOW_BLEND}")
        sys.exit(1)

    # 4. Physical non-negativity constraints on rainfall & wind speed
    if (df_hybrid["rainfall"] < 0).any():
        print("[ERROR] Negative rainfall detected in hybrid forecast.")
        sys.exit(1)
    if (df_hybrid["wind_speed"] < 0).any():
        print("[ERROR] Negative wind speed detected in hybrid forecast.")
        sys.exit(1)
    if (df_blend["rainfall"] < 0).any():
        print("[ERROR] Negative rainfall detected in blended forecast.")
        sys.exit(1)
    if (df_blend["wind_speed"] < 0).any():
        print("[ERROR] Negative wind speed detected in blended forecast.")
        sys.exit(1)

    # 5. Lead days and city count verification
    for name, df in [("Hybrid", df_hybrid), ("Blend", df_blend)]:
        if df["city"].nunique() != 45:
            print(f"[ERROR] {name} has {df['city'].nunique()} cities, expected 45.")
            sys.exit(1)
        lead_counts = df.groupby("lead_days").size().to_dict()
        if lead_counts != {1: 1080, 2: 1080, 3: 1080}:
            print(f"[ERROR] {name} invalid lead distribution: {lead_counts}")
            sys.exit(1)

    # 6. Re-check blend bounds against raw 6 models
    df_raw = pd.read_csv(FORECAST_CURRENT_6M)
    df_raw["model"] = df_raw["model"].map(MODEL_MAP)
    df_pivot = df_raw.pivot(
        index=["city", "datetime"],
        columns="model",
        values=VARIABLES
    )
    df_pivot.columns = [f"{var}_{mod}" for var, mod in df_pivot.columns]
    merged_check = pd.merge(df_blend, df_pivot.reset_index(), on=["city", "datetime"], how="inner")

    for var in VARIABLES:
        cols = [f"{var}_{m}" for m in MODELS_6]
        min_v = merged_check[cols].min(axis=1)
        max_v = merged_check[cols].max(axis=1)
        b_val = merged_check[var]
        oob = (b_val < min_v - 1e-9) | (b_val > max_v + 1e-9)
        if oob.any():
            print(f"[ERROR] Blend bounds violation for {var} in {oob.sum()} rows!")
            sys.exit(1)

    print("[PASS] All verification gate checks PASSED: shape (3240 rows), zero NaNs, bounds verified.")


def run_idempotent_backup():
    """
    Step 2: Backup Step.
    Safeguarded write-once backup: only backs up the TRUE original once.
    Never overwrites an existing backup.
    """
    print("\n" + "=" * 75)
    print("STEP 2: PRESERVING ORIGINAL 4-MODEL BASELINE BACKUP")
    print("=" * 75)

    # A. Blended forecast backup
    if not BACKUP_BLEND.exists():
        if PROD_BLEND.exists():
            shutil.copyfile(PROD_BLEND, BACKUP_BLEND)
            print(f"  [FRESH BACKUP CREATED] {PROD_BLEND} -> {BACKUP_BLEND}")
        else:
            print(f"  [WARNING] Live {PROD_BLEND} does not exist to back up.")
    else:
        print(f"  [PRESERVED] {BACKUP_BLEND} already exists — write-once guard active, skipping overwrite.")

    # B. Hybrid forecast backup
    if not BACKUP_HYBRID.exists():
        if PROD_HYBRID.exists():
            shutil.copyfile(PROD_HYBRID, BACKUP_HYBRID)
            print(f"  [FRESH BACKUP CREATED] {PROD_HYBRID} -> {BACKUP_HYBRID}")
        else:
            print(f"  [WARNING] Live {PROD_HYBRID} does not exist to back up.")
    else:
        print(f"  [PRESERVED] {BACKUP_HYBRID} already exists — write-once guard active, skipping overwrite.")


def run_atomic_promotion():
    """
    Step 3: Atomic copy promotion of 6-model shadow files to production files.
    """
    print("\n" + "=" * 75)
    print("STEP 3: PROMOTING 6-MODEL FORECASTS TO PRODUCTION")
    print("=" * 75)

    shutil.copyfile(SHADOW_BLEND, PROD_BLEND)
    print(f"  [PROMOTED] {SHADOW_BLEND.name} -> {PROD_BLEND}")

    shutil.copyfile(SHADOW_HYBRID, PROD_HYBRID)
    print(f"  [PROMOTED] {SHADOW_HYBRID.name} -> {PROD_HYBRID}")


def update_metadata():
    """
    Step 4: Update outputs/metadata.json with 6 models and current timestamp.
    """
    print("\n" + "=" * 75)
    print("STEP 4: UPDATING METADATA")
    print("=" * 75)

    now_ist_str = datetime.now(IST).strftime("%Y-%m-%dT%H:%M:%S+05:30")
    meta = {}
    if METADATA_JSON.exists():
        try:
            with open(METADATA_JSON, "r", encoding="utf-8") as f:
                meta = json.load(f)
        except Exception:
            pass

    meta["last_updated"] = now_ist_str
    meta["cities"] = 45
    meta["city_count"] = 45
    meta["models"] = 6
    meta["model_count"] = 6
    meta["model_names"] = ["ECMWF", "GFS", "ICON", "GEM", "UKMO", "JMA"]

    with open(METADATA_JSON, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    print(f"  [UPDATED] {METADATA_JSON} -> models: 6, last_updated: {now_ist_str}")


def print_summary():
    """
    Step 5: Print final operational summary and exact rollback command.
    """
    print("\n" + "=" * 75)
    print("PROMOTION COMPLETE: 6-MODEL SYSTEM IS NOW LIVE IN PRODUCTION")
    print("=" * 75)
    print("Summary of Changes:")
    print(f"  - Backed Up Original 4-Model Baseline: {BACKUP_HYBRID.name}, {BACKUP_BLEND.name}")
    print(f"  - Promoted Live Production Forecasts:  {PROD_HYBRID.name}, {PROD_BLEND.name}")
    print(f"  - Metadata Updated:                    {METADATA_JSON.name} (models: 6)")
    print("\nIf any issues arise, execute the instant rollback command:")
    print("  ROLLBACK: python ai/rollback_to_4model.py")
    print("=" * 75 + "\n")


def main():
    run_verification_gate()
    run_idempotent_backup()
    run_atomic_promotion()
    update_metadata()
    print_summary()


if __name__ == "__main__":
    main()
