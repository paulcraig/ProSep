from fastapi import APIRouter
from typing import Dict, Any, List

from pydantic import BaseModel, Field
from typing import Optional
from backend.logic.size_exclusion import SizeExclusionFractionation
from backend.logic.ion_exchange_fractionation import IonExchangeFractionation

router = APIRouter(prefix="/size_exclusion", tags=["size exclusion"])
gelDict = {
    "Bio-P 0.1-1.8 kDa": [100, 1800],
    "Bio-P 0.8-4.0 kDa": [800, 4000],
    "Bio-P 1.0-6.0 kDa": [1000, 6000],
    "Bio-P 1.5-20.0 kDa": [1500, 20000],
    "Bio-P 2.5-40.0 kDA": [2500, 40000],
    "Bio-P 3.0-60.0 kDa": [3000, 60000],
    "Bio-P 5.0-100 kDa": [5000, 100000],
    "S-X 0.4-14.0 kDa": [400, 14000],
    "S-X <2.0 kDA": [0, 2000],
    "S-X <0.4 kDA": [0, 400],
    "Bio-A 10.0 - 500 kDA": [10000, 500000],
    "Bio-A 10.0 - 1500 kDA": [10000, 1500000],
}



class SizeExclusionRequest(BaseModel):
    fasta_content: str = Field(..., description="FASTA content as raw text")
    gel_name: str = Field(..., description="Gel name from gelDict")
    proteinList: List[IonExchangeFractionation.ProteinEntry] = Field(
        ..., description="List of protein entries"
    )
    min_size: Optional[int] = None  # Optional for backward compatibility
    max_size: Optional[int] = None
@router.post("/process", response_model=Dict[str, Any])
async def process_ion_exchange(body: SizeExclusionRequest) -> Any:
    if not body.fasta_content.strip():
        return {"error": "No FASTA content provided."}
    if body.gel_name not in gelDict:
        return {"error": f"Invalid gel name: {body.gel_name}"}
    min_size, max_size = gelDict[body.gel_name]
    try:
        return SizeExclusionFractionation.process(body.fasta_content, min_size, max_size, body.proteinList)
    except ValueError as exc:
        return {"error": str(exc)}
    


   