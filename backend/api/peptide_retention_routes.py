from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any, Dict, List
from backend.logic.peptide_retention import PeptideRetentionPredictor

router = APIRouter(
    prefix="/pr",
    tags=["Peptide Retention Time Prediction"]
)

class SinglePeptideRequest(BaseModel): peptide: str
class MultiplePeptidesRequest(BaseModel): peptides: List[str]


@router.post("/predict", response_model=Dict[str, Any])
async def predict_single(body: SinglePeptideRequest) -> Any:
    peptide = body.peptide.strip()

    if not peptide:
        return {"error": "No valid peptide provided."}

    result = PeptideRetentionPredictor.predict(peptide)
    return result


@router.post("/predict-multiple", response_model=List[Dict[str, Any]])
async def predict_multiple(body: MultiplePeptidesRequest) -> Any:
    peptides = [p.strip() for p in body.peptides if p.strip()]

    if not peptides:
        return {"error": "No valid peptides provided."}

    results = PeptideRetentionPredictor.predict_multiple(peptides)
    return results
