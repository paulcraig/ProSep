from typing import Any, Dict

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.logic.affinity_chromatography import AffinityChromatography


router = APIRouter(
    prefix="/affinity_chromatography",
    tags=["Affinity Chromatography"],
)

class AffinityChromatographyRequest(BaseModel):
    """
    Request body schema for running Affinity Chromatography.
    """
    fasta_content: str = Field(..., description="FASTA content as raw text")
    prosite_strong: str = Field(..., description="PROSITE motif matching strongly bound proteins")
    prosite_weak: str = Field(..., description="PROSITE motif matching weakly bound proteins")
    
    # Fractionation and simulation controls
    fraction_count: int = Field(80, ge=1, le=500)
    noise: float = Field(0.10, ge=0.0, le=1.0, description="Overlap between fractions")

@router.post("/process", response_model=Dict[str, Any])
async def process_affinity(body: AffinityChromatographyRequest) -> Any:
    """
    Run affinity chromatography and return the simulated result.
    """
    if not body.fasta_content.strip():
        return {"error": "No FASTA content provided."}
    
    try:
        return AffinityChromatography.process(
            fasta_content=body.fasta_content,
            fraction_count=body.fraction_count,
            prosite_strong=body.prosite_strong,
            prosite_weak=body.prosite_weak
        )
    except ValueError as exc:
        return {"error": str(exc)}  
        