from typing import Any, Dict
from fastapi import APIRouter, UploadFile, Query

from backend.logic.ion_exchange_prep import IonExchangePrep

router = APIRouter(
    prefix="/sample-prep",
    tags=["Sample Prep"]
)

@router.post("/ion-exchange", response_model=Dict[str, Any])
async def ion_exchange_sample_prep(
    file: UploadFile,
    pH: float = Query(7.0, ge=0.0, le=14.0, description="Buffer pH"),
    exchanger: str = Query(
        "anion",
        description="anion = positive resin binds negative proteins; cation = negative resin binds positive proteins"
    ),
    fractions: int = Query(7, ge=1, le=50, description="Number of output fractions"),
    overlap: float = Query(0.10, ge=0.0, le=0.50, description="Fraction overlap as a proportion of bin size"),
    deadband: float = Query(0.05, ge=0.0, le=5.0, description="Charge magnitude below which proteins are treated as non-binders"),
) -> Dict[str, Any]:
    """
    Ion Exchange sample prep:
    - Compute net charge at pH for each protein
    - Flow-through (wash) vs retained based on exchanger type
    - Retained proteins are sorted from weak binders to strong binders
    - Retained proteins are split into N fractions (+ optional overlap)
    """
    return IonExchangePrep.run(
        file=file,
        pH=pH,
        exchanger=exchanger,
        fractions=fractions,
        overlap=overlap,
        deadband=deadband,
    )
