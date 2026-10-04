"""
pipeline.py — Runs all AI pipeline steps in order using subprocess.

Default: 6-Model NWP Pipeline (ECMWF, GFS, ICON, GEM, UKMO, JMA + Elevation)
Legacy flag: python ai/pipeline.py --legacy-4model

Stops immediately on any non-zero exit code. Prints a numbered progress
line before each step and a PASS/FAIL/SKIPPED summary table at the end.
"""

import os
import subprocess
import sys
import time

# ---------------------------------------------------------------------------
# Check CLI arguments
# ---------------------------------------------------------------------------
USE_LEGACY = "--legacy-4model" in sys.argv

# ---------------------------------------------------------------------------
# Model files checked before deciding whether to run training
# ---------------------------------------------------------------------------
MODEL_FILES_4MODEL = [
    'outputs/models/rf_temperature.joblib',
    'outputs/models/rf_rainfall.joblib',
    'outputs/models/rf_wind_speed.joblib',
]

MODEL_FILES_6MODEL = [
    'outputs/models/rf_temperature_6model.joblib',
    'outputs/models/rf_rainfall_6model.joblib',
    'outputs/models/rf_wind_speed_6model.joblib',
]

# ---------------------------------------------------------------------------
# Pipeline step definitions — in execution order
# ---------------------------------------------------------------------------
LEGACY_STEPS = [
    'ai/preprocessing.py',
    'ai/align.py',
    'ai/skill.py',
    'ai/weights.py',
    'ai/blend.py',
    'ai/preprocessing_lead.py',
    'ai/align_lead.py',
    'ai/skill_lead.py',
    'ai/weights_lead.py',
    'ai/blend_lead.py',
    'ai/blend_current.py',
    'ai/features.py',
    'ai/baseline.py',
    'ai/train.py',
    'ai/export_performance.py',
    'ai/contingency_verification.py',
    'ai/predict.py',
    'ai/alerts.py',
]

SIX_MODEL_STEPS = [
    'ai/preprocessing_6model.py',
    'ai/align_6model_lead.py',
    'ai/skill_6model.py',
    'ai/weights_6model.py',
    'ai/blend_6model.py',
    'ai/blend_current_6model.py',
    'ai/features_6model.py',
    'ai/train_6model.py',
    'ai/predict_6model.py',
    'ai/promote_6model.py',
    'ai/alerts.py',
    'ai/confidence_engine.py',
]

if USE_LEGACY:
    STEPS = LEGACY_STEPS
    MODEL_FILES = MODEL_FILES_4MODEL
    TRAIN_SCRIPT = 'ai/train.py'
    MODE_NAME = "Legacy 4-Model Pipeline"
else:
    STEPS = SIX_MODEL_STEPS
    MODEL_FILES = MODEL_FILES_6MODEL
    TRAIN_SCRIPT = 'ai/train_6model.py'
    MODE_NAME = "Production 6-Model Pipeline (ECMWF, GFS, ICON, GEM, UKMO, JMA + Elevation)"

TOTAL = len(STEPS)

# ---------------------------------------------------------------------------
# Result tracking: list of (script, status, elapsed_seconds)
# ---------------------------------------------------------------------------
results = []


def print_summary():
    """Print the PASS/FAIL/SKIPPED table for all steps run so far."""
    print()
    print("=" * 60)
    print(f"{MODE_NAME:^60}")
    print("=" * 60)
    print(f"  {'#':<4} {'Script':<30} {'Status':<10} {'Time (s)'}")
    print(f"  {'-'*4} {'-'*30} {'-'*10} {'-'*8}")
    for idx, (script, status, elapsed) in enumerate(results, 1):
        time_str = f"{elapsed:>7.2f}" if elapsed is not None else "      —"
        print(f"  {idx:<4} {script:<30} {status:<10} {time_str}")
    print("=" * 60)


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------
print("\n" + "=" * 60)
print(f"Starting {MODE_NAME} ({TOTAL} steps)...")
print("=" * 60 + "\n")

pipeline_start = time.perf_counter()

for step_num, script in enumerate(STEPS, 1):

    # --- Conditional skip for training ------------------------------------
    if script == TRAIN_SCRIPT:
        if all(os.path.exists(f) for f in MODEL_FILES):
            print(f"[{step_num}/{TOTAL}] {script} — "
                  "Models found, skipping training. "
                  "Delete outputs/models/ to retrain.")
            results.append((script, 'SKIPPED', None))
            continue

    # --- Normal step -------------------------------------------------------
    print(f"[{step_num}/{TOTAL}] Running {script}...")

    t_start = time.perf_counter()
    proc = subprocess.run([sys.executable, script])
    elapsed = time.perf_counter() - t_start

    if proc.returncode != 0:
        results.append((script, 'FAIL', elapsed))
        print_summary()
        print(f"\nFAILED at step {step_num}/{TOTAL}: {script} "
              f"(exit code {proc.returncode})")
        sys.exit(1)

    results.append((script, 'PASS', elapsed))

# ---------------------------------------------------------------------------
# All steps completed successfully
# ---------------------------------------------------------------------------
total_elapsed = time.perf_counter() - pipeline_start
print_summary()
print(f"\nAll {TOTAL} steps completed successfully. "
      f"Total time: {total_elapsed:.2f}s\n")
