"""
PSA Card Grader API
====================
FastAPI backend that accepts card images and returns PSA grade predictions
using the trained Random Forest model.

Endpoints:
    GET  / - Health check
    POST /predict - Upload image and get PSA grade prediction

Setup:
    pip install fastapi uvicorn python-multipart pillow scikit-learn joblib numpy opencv-python

Run locally:
    uvicorn main:app --reload

Deploy to Railway/Render:
    - Set start command to: uvicorn main:app --host 0.0.0.0 --port $PORT
"""

import os
import json
import joblib
import numpy as np
import cv2
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import uvicorn

# ── App Setup ──────────────────────────────────────────────────────────────────
app = FastAPI(
    title="PSA Card Grader API",
    description="Predicts PSA grades for Pokemon card images using a Random Forest model.",
    version="1.0.0"
)

# Allow requests from any origin so the React Native app can connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Model Loading ──────────────────────────────────────────────────────────────
MODEL_PATH    = os.path.join(os.path.dirname(__file__), "model", "rf_model.pkl")
METADATA_PATH = os.path.join(os.path.dirname(__file__), "model", "model_metadata.json")

# Load model and metadata once when server starts
print("Loading model...")
try:
    model = joblib.load(MODEL_PATH)
    print("Model loaded successfully!")
except Exception as e:
    print(f"Error loading model: {e}")
    model = None

try:
    with open(METADATA_PATH, 'r') as f:
        metadata = json.load(f)
    IMAGE_SIZE = tuple(metadata['image_size'])
    print(f"Metadata loaded. Image size: {IMAGE_SIZE}")
except Exception as e:
    print(f"Error loading metadata, using defaults: {e}")
    IMAGE_SIZE = (224, 224)
    metadata   = {'grades': list(range(1, 11))}

# ── Response Models ────────────────────────────────────────────────────────────
class PredictionResponse(BaseModel):
    predicted_grade: int
    confidence:      float
    grade_probabilities: List[dict]
    message:         str


class HealthResponse(BaseModel):
    status:       str
    model_loaded: bool
    image_size:   List[int]


# ── Image Preprocessing ────────────────────────────────────────────────────────
def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """
    Takes raw image bytes, resizes to the training image size,
    normalizes pixel values, and flattens to 1D array — exactly
    the same preprocessing used during training.
    """
    # Convert bytes to numpy array
    nparr = np.frombuffer(image_bytes, np.uint8)
    img   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise ValueError("Could not decode image")

    # Resize to match training image size
    img = cv2.resize(img, IMAGE_SIZE)

    # Convert BGR to RGB
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    # Normalize to 0-1
    img = img.astype(np.float32) / 255.0

    # Flatten to 1D
    return img.flatten()


# ── Endpoints ──────────────────────────────────────────────────────────────────
@app.get("/", response_model=HealthResponse)
def health_check():
    """Health check endpoint to verify the API is running."""
    return HealthResponse(
        status="ok",
        model_loaded=model is not None,
        image_size=list(IMAGE_SIZE)
    )


@app.post("/predict", response_model=PredictionResponse)
async def predict(file: UploadFile = File(...)):
    """
    Upload a card image and get a PSA grade prediction.

    Returns:
        predicted_grade:     The most likely PSA grade (1-10)
        confidence:          Confidence percentage for the top prediction
        grade_probabilities: Probability for each grade 1-10
        message:             Human readable result
    """
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded")

    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        # Read and preprocess image
        image_bytes    = await file.read()
        processed_img  = preprocess_image(image_bytes)

        # Get prediction and probabilities
        img_array      = processed_img.reshape(1, -1)
        predicted_grade = int(model.predict(img_array)[0])
        probabilities   = model.predict_proba(img_array)[0]

        # Build grade probabilities list
        grade_probs = [
            {
                "grade":       int(model.classes_[i]),
                "probability": round(float(prob) * 100, 1)
            }
            for i, prob in enumerate(probabilities)
        ]

        # Sort by probability descending
        grade_probs = sorted(grade_probs, key=lambda x: x['probability'], reverse=True)

        # Get confidence for top prediction
        confidence = max(p['probability'] for p in grade_probs)

        return PredictionResponse(
            predicted_grade=predicted_grade,
            confidence=confidence,
            grade_probabilities=grade_probs,
            message=f"Predicted PSA Grade: {predicted_grade}"
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


# ── Run Locally ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)