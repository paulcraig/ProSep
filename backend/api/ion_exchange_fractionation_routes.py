from typing import Any, Dict, Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.logic.ion_exchange_fractionation import IonExchangeFractionation


router = APIRouter(
    prefix="/ion_exchange_fractionation",
    tags=["Ion Exchange Fractionation"],
)


class IonExchangeRequest(BaseModel):
    fasta_content: str = Field(..., description="FASTA content as raw text")
    ph: float = Field(7.0, ge=0.0, le=14.0)
    media_type: Literal["Q", "S"] = Field("Q", description="Q (anion exchange) or S (cation exchange)")
    fraction_count: int = Field(80, ge=1, le=500)
    noise: float = Field(0.10, ge=0.0, le=1.0)


@router.post("/process", response_model=Dict[str, Any])
async def process_ion_exchange(body: IonExchangeRequest) -> Any:
    if not body.fasta_content.strip():
        return {"error": "No FASTA content provided."}

    try:
        return IonExchangeFractionation.process(
            fasta_content=body.fasta_content,
            ph=body.ph,
            media_type=body.media_type,
            fraction_count=body.fraction_count,
            noise=body.noise,
        )
    except ValueError as exc:
        return {"error": str(exc)}
