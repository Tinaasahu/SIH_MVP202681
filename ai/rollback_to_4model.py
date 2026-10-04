"""
rollback_to_4model.py — Instant recovery script to restore original 4-model production forecast.

Executes:
1. Verifies the existence of preserved 4-model backups.
2. Restores outputs/hybrid_forecast.csv and outputs/blended_forecast.csv from backup.
3. Resets outputs/metadata.json to reflect 4 models.
4. Prints status confirmation.

Usage: python ai/rollback_to_4model.py
"""

import os
import sys
import json
import shutil
from datetime import datetime, timezone, timedelta
from pathlib import Path

IST = timezone(timedelta(hours=5, minutes=30))
BASE_DIR = Path(__file__).resolve().parent.parent
OUTPUTS_DIR = BASE_DIR / "outputs"

PROD_HYBRID = OUTPUTS_DIR / "hybrid_forecast.csv"
PROD_BLEND = OUTPUTS_DIR / "blended_forecast.csv"
METADATA_JSON = OUTPUTS_DIR / "metadata.json"

BACKUP_HYBRID = OUTPUTS_DIR / "hybrid_forecast_4model_backup.csv"
BACKUP_BLEND = OUTPUTS_DIR / "blended_forecast_4model_backup.csv"


def main():
    print("\n" + "=" * 75)
    print("EMERGENCY ROLLBACK: RESTORING 4-MODEL PRODUCTION BASELINE")
    print("=" * 75)

    # 1. Verify backups exist
    if not BACKUP_HYBRID.exists() or not BACKUP_BLEND.exists():
        print(f"[FATAL] Cannot rollback: Backup files not found.")
        print(f"  - Hybrid backup exists: {BACKUP_HYBRID.exists()} ({BACKUP_HYBRID})")
        print(f"  - Blend backup exists:  {BACKUP_BLEND.exists()} ({BACKUP_BLEND})")
        sys.exit(1)

    # 2. Restore production files
    shutil.copyfile(BACKUP_BLEND, PROD_BLEND)
    print(f"  [RESTORED] {BACKUP_BLEND.name} -> {PROD_BLEND}")

    shutil.copyfile(BACKUP_HYBRID, PROD_HYBRID)
    print(f"  [RESTORED] {BACKUP_HYBRID.name} -> {PROD_HYBRID}")

    # 3. Reset metadata.json
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
    meta["models"] = 4
    meta["model_count"] = 4
    meta["model_names"] = ["ECMWF", "GFS", "ICON", "GEM"]

    with open(METADATA_JSON, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    print(f"  [RESTORED] {METADATA_JSON} -> models: 4, last_updated: {now_ist_str}")

    print("\n" + "=" * 75)
    print("[SUCCESS] Rollback complete. System is restored to the 4-model baseline.")
    print("=" * 75 + "\n")


if __name__ == "__main__":
    main()
