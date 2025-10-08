from backend.logic.peptide_retention import PeptideRetentionPredictor
from typing import Any, List, Dict

from fastapi import APIRouter

router = APIRouter(
    prefix="/pr",
    tags=["Peptide Retention Time Prediction"]
)

@router.get("/predict", response_model=List[Dict[str, Any]])
async def predict_retention_times(peptides: List[str]) -> Any:
    try:
        if not peptides:
            return {"error": "No valid peptides provided."}

        predictor = PeptideRetentionPredictor()
        predictions = predictor.predict(peptides)
        return predictions
    except Exception as e:
        return {"error": str(e)}