#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# Download BlazePose TFJS models via Kaggle API.
#
# Reads credentials from .env.local in the repo root.
# Kaggle model: https://www.kaggle.com/models/mediapipe/blazepose-3d
#
# Usage:
#   python3 scripts/download-blazepose-models.py
# ---------------------------------------------------------------------------

import os
import sys
import subprocess
import shutil
import json
import tempfile

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST_DETECTOR = os.path.join(REPO_ROOT, "src", "static", "models", "detector")
DEST_LANDMARK = os.path.join(REPO_ROOT, "src", "static", "models", "landmark_lite")

# Kaggle model reference: https://www.kaggle.com/models/mediapipe/blazepose-3d
KAGGLE_MODEL = "mediapipe/blazepose-3d"
# Correct instance paths (owner/model/framework/slug/version)
DETECTOR_INSTANCE = "mediapipe/blazepose-3d/TfJs/detector/1"
LANDMARK_INSTANCE = "mediapipe/blazepose-3d/TfJs/landmark-lite/2"


def run(cmd: list[str], check=True) -> subprocess.CompletedProcess:
    print(f"  $ {' '.join(cmd)}")
    return subprocess.run(cmd, check=check, capture_output=True, text=True)


def load_env_local():
    """Load KAGGLE_USERNAME and KAGGLE_KEY from .env.local."""
    env_path = os.path.join(REPO_ROOT, ".env.local")
    if not os.path.exists(env_path):
        return None
    creds = {}
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            # Handle both "KEY=value" and "export KEY=value" formats
            line = line.lstrip("export ").strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip().strip('"').strip("'")
                if k in ("KAGGLE_USERNAME", "KAGGLE_KEY"):
                    creds[k] = v
    return creds if creds else None


def ensure_kaggle():
    try:
        run(["kaggle", "--version"], check=False)
        return
    except FileNotFoundError:
        pass

    print("Installing kaggle...")
    run([sys.executable, "-m", "pip", "install", "kaggle", "-q"])
    print("  kaggle installed.")


def download_model_files():
    # Load credentials from .env.local
    creds = load_env_local()
    if not creds:
        print("ERROR: .env.local not found or missing KAGGLE_USERNAME/KAGGLE_KEY.")
        sys.exit(1)

    username = creds.get("KAGGLE_USERNAME", "")
    key = creds.get("KAGGLE_KEY", "")

    if not username or not key:
        print("ERROR: KAGGLE_USERNAME or KAGGLE_KEY not set in .env.local.")
        sys.exit(1)

    # Configure kaggle credentials
    kaggle_dir = os.path.expanduser("~/.kaggle")
    os.makedirs(kaggle_dir, exist_ok=True)
    with open(os.path.join(kaggle_dir, "kaggle.json"), "w") as f:
        json.dump({"username": username, "key": key}, f)
    os.chmod(os.path.join(kaggle_dir, "kaggle.json"), 0o600)
    print(f"  Kaggle credentials configured for {username}.")

    # Download all model files
    print(f"Downloading BlazePose TFJS models from Kaggle ({KAGGLE_MODEL})...")

    with tempfile.TemporaryDirectory() as tmp:
        zip_path = os.path.join(tmp, "blazepose_tfjs.zip")

        # Download via kaggle CLI — correct command format:
        # kaggle models instances versions download <owner>/<model>/<framework>/<slug>/<version>
        run(["kaggle", "models", "instances", "versions", "download",
             "--force", "-p", tmp, DETECTOR_INSTANCE])
        run(["kaggle", "models", "instances", "versions", "download",
             "--force", "-p", tmp, LANDMARK_INSTANCE])

        # Find downloaded files (may be in a blazepose-3d/ subdirectory)
        downloaded = []
        for root, dirs, files in os.walk(tmp):
            for f in files:
                if f.endswith((".json", ".bin")):
                    downloaded.append(os.path.join(root, f))

        print(f"  Downloaded {len(downloaded)} model files.")

        # First downloaded file (detector) has larger shards (4MB+2MB vs ~2.7MB)
        # Second (landmark-lite) has single ~2.7MB shard
        # Both have model.json
        all_shards = [f for f in downloaded if f.endswith(".bin")]
        all_shards.sort(key=lambda f: os.path.getsize(f), reverse=True)
        # detector has 2 shards totalling ~5.9MB; landmark-lite has 1 shard ~2.7MB
        # Use detector for the first model (larger), landmark for the second
        detector_shards = all_shards[:2]    # largest 2 shards
        landmark_shards = all_shards[2:]   # remaining (landmark-lite)
        model_jsons = [f for f in downloaded if f.endswith("model.json")]
        detector_jsons = [f for f in model_jsons if os.path.getsize(f) > 100_000]
        landmark_jsons = [f for f in model_jsons if os.path.getsize(f) <= 100_000]
        # Fallback if sizes are similar: take first as detector
        if not detector_jsons and model_jsons:
            detector_jsons = [model_jsons[0]]
        if not landmark_jsons and len(model_jsons) > 1:
            landmark_jsons = [model_jsons[1]]
        detector_files = detector_shards + detector_jsons
        landmark_files = landmark_shards + landmark_jsons

        # Copy to destination
        for d, files in [("detector", detector_files), ("landmark_lite", landmark_files)]:
            dest = DEST_DETECTOR if d == "detector" else DEST_LANDMARK
            os.makedirs(dest, exist_ok=True)
            for src in files:
                dst = os.path.join(dest, os.path.basename(src))
                shutil.copy2(src, dst)
                size_kb = os.path.getsize(dst) // 1024
                print(f"  {os.path.basename(src):40s} → {d:12s} ({size_kb} KB)")

    # Verify
    detector_ok = os.path.exists(os.path.join(DEST_DETECTOR, "model.json"))
    landmark_ok = os.path.exists(os.path.join(DEST_LANDMARK, "model.json"))
    detector_count = len(os.listdir(DEST_DETECTOR))
    landmark_count = len(os.listdir(DEST_LANDMARK))

    print(f"\nVerification:")
    print(f"  detector/     {'✅' if detector_ok else '❌'} ({detector_count} files)")
    print(f"  landmark_lite/ {'✅' if landmark_ok else '❌'} ({landmark_count} files)")

    if not (detector_ok and landmark_ok):
        print("\n⚠️  Warning: model.json not found in expected directories.")
        print("  Listing static/models/:")
        for root, dirs, files in os.walk(os.path.join(REPO_ROOT, "static", "models")):
            for f in files:
                rel = os.path.relpath(os.path.join(root, f), REPO_ROOT)
                print(f"    {rel}")
        sys.exit(1)

    print("\n✅ Model download complete.")
    return True


if __name__ == "__main__":
    ensure_kaggle()
    success = download_model_files()
    sys.exit(0 if success else 1)
