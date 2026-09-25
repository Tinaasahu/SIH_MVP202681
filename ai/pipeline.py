"""
pipeline.py — Runs all AI pipeline steps in order using subprocess.

Stops immediately on any non-zero exit code. Prints a numbered progress
line before each step and a PASS/FAIL/SKIPPED summary table at the end.

Usage: python ai/pipeline.py
"""

import os
import subprocess
import sys
import time

# ---------------------------------------------------------------------------
# Model files checked before deciding whether to run ai/train.py (step 14)
# ---------------------------------------------------------------------------
MODEL_FILES = [
    'outputs/models/rf_temperature.joblib',
    'outputs/models/rf_rainfall.joblib',
    'outputs/models/rf_wind_speed.joblib',
]

# ---------------------------------------------------------------------------
# Pipeline step definitions — in execution order
# Each entry: {'script': path, 'label': display name}
# Step 14 (train) is handled separately below with the skip check.
# ---------------------------------------------------------------------------
STEPS = [
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
    'ai/train.py',       # step 14 — may be skipped (see logic below)
    'ai/predict.py',
    'ai/alerts.py',
]

TOTAL = len(STEPS)

# ---------------------------------------------------------------------------
# Result tracking: list of (script, status, elapsed_seconds)
# status is 'PASS', 'FAIL', or 'SKIPPED'
# ---------------------------------------------------------------------------
results = []


def print_summary():
    """Print the PASS/FAIL/SKIPPED table for all steps run so far."""
    print()
    print("=" * 55)
    print(f"{'Pipeline Summary':^55}")
    print("=" * 55)
    print(f"  {'#':<4} {'Script':<26} {'Status':<10} {'Time (s)'}")
    print(f"  {'-'*4} {'-'*26} {'-'*10} {'-'*8}")
    for idx, (script, status, elapsed) in enumerate(results, 1):
        time_str = f"{elapsed:>7.2f}" if elapsed is not None else "      —"
        print(f"  {idx:<4} {script:<26} {status:<10} {time_str}")
    print("=" * 55)


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------
pipeline_start = time.perf_counter()

for step_num, script in enumerate(STEPS, 1):

    # --- Step 14: conditional skip for ai/train.py -------------------------
    if script == 'ai/train.py':
        if all(os.path.exists(f) for f in MODEL_FILES):
            print(f"[{step_num}/{TOTAL}] ai/train.py — "
                  "Models found, skipping training. "
                  "Delete outputs/models/ to retrain.")
            results.append((script, 'SKIPPED', None))
            continue   # move to next step without running train.py

    # --- Normal step -------------------------------------------------------
    print(f"[{step_num}/{TOTAL}] Running {script}...")

    t_start = time.perf_counter()
    # Run with the same interpreter; output streams directly to the terminal
    proc = subprocess.run([sys.executable, script])
    elapsed = time.perf_counter() - t_start

    if proc.returncode != 0:
        # Record failure, print summary up to this point, then stop
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
      f"Total time: {total_elapsed:.2f}s")
