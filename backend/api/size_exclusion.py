from fastapi import APIRouter, UploadFile, Form
from typing import Dict, Any

from backend.logic.size_exclusion import SizeExclusionFractionation

router = APIRouter(prefix="/size_exclusion", tags=["size exclusion"])

@router.post("/parse_fasta", response_model=Dict[str, Any])
async def parse_fasta(file: UploadFile, gelSelect: str = Form(...)):
    result = SizeExclusionFractionation(gelSelect, file)
    return result.write()

@router.get("/gelSelect")
async def get_gel_dict():
    return SizeExclusionFractionation.getGelDict()