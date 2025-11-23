from typing import Any
from fastapi import APIRouter, UploadFile
from pydantic import BaseModel
from backend.logic.proteolytic_digestion_logic import ProteolyticDigestion

router = APIRouter(
    prefix="/proteolytic_digestion",
    tags=["Proteolytic Digestion"]
)


@router.post('/parse_fasta', response_model=list[Any])
async def fileGetProteinInfo(file: UploadFile) -> Any:
    return ProteolyticDigestion.fileGetProteinInfo(file)


class ProteinRequest(BaseModel):
    sequence: str
    aminoAcid: str

@router.post('/seperateProtein', response_model=list[Any])
async def fileGetProteinInfo(req: ProteinRequest) -> Any:
    return ProteolyticDigestion.breakUpProtein(req.sequence, req.aminoAcid)

@router.get('/resetProteinGraph')
async def fileGetProteinInfo():
    ProteolyticDigestion.updateGraph([])