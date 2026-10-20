from typing import Any, Dict
from fastapi import APIRouter
from pydantic import BaseModel, Field
from backend.logic.tandem_ms import TandemMS

router = APIRouter(
    prefix="/tandem_ms",
    tags=["Tandem Mass Spectrometry"],
)

class TandemMSRequest(BaseModel):
    fasta_content: str = Field(..., description="FASTA content as raw text")
    amino_acid: str = Field(..., description="Amino acid protein sequence for tandem mass spectrometry analysis")
    protease: str = Field("trypsin", description="Protease used for digestion (e.g., trypsin, chymotrypsin)")
    lower_limit: float = Field(0.0, ge=0.0, le=100.0, description="Lower limit for mass/charge ratio")
    upper_limit: float = Field(3000.0, ge=0.0, le=1000.0, description="Upper limit for mass/charge ratio")


@router.post("/plot", response_model=Dict[str, Any])
async def plot_tandem_ms(body: TandemMSRequest) -> Any:
    if not body.fasta_content.strip():
        return {"error": "No FASTA content provided."}

    try:
        sim = TandemMS()

        return sim.runAnalysis(
            sequence=body.amino_acid,
            proteaseChoice=body.protease,
            lowerLimit=body.lower_limit,
            upperLimit=body.upper_limit
        )
    
    except ValueError as exc:
        return {"error": str(exc)}

@router.post("/by_peaks", response_model=Dict[str, Any])
async def by_peaks_tandem_ms(body: TandemMSRequest) -> Any:
    try:
        sim = TandemMS()

        return sim.sequencePeaks(
            peptide=body.amino_acid
        )
    except ValueError as exc:
        return {"error": str(exc)}
