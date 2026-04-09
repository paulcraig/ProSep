from typing import Any, Dict, Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.logic.hydrophobic_interaction_fractionation import HydrophobicInteractionFractionation


router = APIRouter(
    prefix="/hydrophobic_interaction_fractionation",
    tags=["Hydrophobic Interaction Fractionation"],
)

class HydrophobicInteractionRequest(BaseModel):
    """
    Request body schema for running HIC.
    """
    fasta_content: str = Field(..., description="FASTA content as raw text")
    
    # Selected starting ligand
    ligand_type: Literal["butyl", "octyl", "phenyl"] = Field(
        "butyl", description="Hydrophobic ligand on the resin"
    )
    
    # Starting and ending salt concentrations
    salt_start: float = Field(1.5, ge=0.0, le=10.0, description="Starting salt concentration")
    salt_end: float = Field(0.0, ge=0.0, le=10.0, description="Ending salt concentration")
    
    # Fractionation and simulation controls
    fraction_count: int = Field(80, ge=1, le=500)
    noise: float = Field(0.10, ge=0.0, le=1.0, description="Overlap between fractions")
    deadband: float = Field(0.15, ge=0.0, le=1.0, description="Minimum bindingStrength to retain")
    salt_alpha: float = Field(1.2, ge=0.0, le=5.0, description="Salt-strength exponent")

@router.post("/process", response_model=Dict[str, Any])
async def process_hic(body: HydrophobicInteractionRequest) -> Any:
    """
    Run hydrophobic interaction fractionation and return the simulated result.
    """
    if not body.fasta_content.strip():
        return {"error": "No FASTA content provided."}
    
    try:
        return HydrophobicInteractionFractionation.process(
            fasta_content=body.fasta_content,
            ligand_type=body.ligand_type,
            salt_start=body.salt_start,
            salt_end=body.salt_end,
            fraction_count=body.fraction_count,
            noise=body.noise,
            deadband=body.deadband,
            salt_alpha=body.salt_alpha,
        )
    except ValueError as exc:
        return {"error": str(exc)}  
        