#!/bin/bash
# ---------------------------------------------------------------------------
# Download BlazePose TFJS model files for WeChat mini-program offline use.
#
# Usage: bash scripts/download-blazepose-models.sh
#
# Models will be saved to:
#   static/models/detector/       — BlazePose detector model
#   static/models/landmark_lite/ — BlazePose landmark model (lite)
#
# NOTE: If this script fails, manually download the files and place them:
#   - Detector: from any accessible TFJS BlazePose model URL
#   - Landmark: from any accessible TFJS BlazePose landmark model URL
#
# Known working approach (Kaggle account required):
#   1. Go to https://www.kaggle.com/models/mediapipe/blazepose-3d
#   2. Download the TFJS format (not TFLite)
#   3. Extract detector/ and landmark/ folders to static/models/
# ---------------------------------------------------------------------------

set -e

DEST_DETECTOR="/Users/pi-dal/Developer/sport-snack/static/models/detector"
DEST_LANDMARK="/Users/pi-dal/Developer/sport-snack/static/models/landmark_lite"
mkdir -p "$DEST_DETECTOR" "$DEST_LANDMARK"

echo "Downloading BlazePose TFJS models..."

# These URLs may need updating — check https://github.com/nicknochnack/BlazePoseTFJS
# or the TensorFlow.js model registry for current working URLs.
DETECTOR_URL="https://tfhub.dev/mediapipe/tfjs-model/blazepose_3d/detector/1"
LANDMARK_URL="https://tfhub.dev/mediapipe/tfjs-model/blazepose_3d/landmark/lite/2"

echo "⚠️  NOTE: If downloads fail (404/503), the model hosting URLs need updating."
echo "   Check TensorFlow.js or MediaPipe official resources for current URLs."
echo ""
echo "Detector target: $DETECTOR_URL"
echo "Landmark target: $LANDMARK_URL"
echo ""
echo "If URLs return 404, models cannot be downloaded automatically."
echo "Manual steps:"
echo "  1. Download BlazePose TFJS models from a working CDN or Kaggle"
echo "  2. Place model.json and shard files in static/models/detector/"
echo "  3. Place model.json and shard files in static/models/landmark_lite/"
