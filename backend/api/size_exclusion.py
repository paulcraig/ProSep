from fastapi import APIRouter, UploadFile, Form
from typing import Dict, Any, List

from pydantic import BaseModel, Field

from backend.logic.size_exclusion import SizeExclusionFractionation
from ion_exchange_fractionation import IonExchangeFractionation

router = APIRouter(prefix="/size_exclusion", tags=["size exclusion"])
class SizeExclusionRequest(BaseModel):
    fasta_content: str = Field(..., description="FASTA content as raw text")
    min_size: int = Field(..., description="Minimum size cutoff")
    max_size: int = Field(..., description="Maximum size cutoff")
    proteinList: List[IonExchangeFractionation.ProteinEntry] = Field(
        ..., description="List of protein entries"
    )
@router.post("/process", response_model=Dict[str, Any])
async def process_ion_exchange(body: SizeExclusionRequest) -> Any:
    if not body.fasta_content.strip():
        return {"error": "No FASTA content provided."}

    try:
        return SizeExclusionFractionation.process(body.fasta_content,body.min_size,body.max_size,body.proteinList)
    except ValueError as exc:
        return {"error": str(exc)}
    


   