from backend.logic.peptide_retention import PeptideRetentionPredictor
from typing import Any, List, Dict

from fastapi import APIRouter, Query

router = APIRouter(
    prefix="/pr",
    tags=["Peptide Retention Time Prediction"]
)

@router.get("/predict", response_model=List[Dict[str, Any]])
async def predict_retention_times(peptides: str = Query("")) -> Any:
    try:
        peptides_list = [p.strip() for p in peptides.split(',') if p.strip()]
        if not peptides_list:
            return {"error": "No valid peptides provided."}

        predictions = PeptideRetentionPredictor.predict(peptides_list)
        return predictions
    except Exception as e:
        return {"error": str(e)}