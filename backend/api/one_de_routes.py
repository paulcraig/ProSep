from typing import Any
from fastapi import APIRouter, UploadFile
from backend.logic.simulation_1de import Simulation_1de

router = APIRouter(
    prefix="/1d",
    tags=["1D Simulation"]
)
@router.post('/protein_info', response_model=list[Any])
async def fileGetProteinInfo(file: UploadFile) -> Any:
    
    return Simulation_1de.fileGetProteinInfo(file)





@router.post('/Batch_files', response_model=list[list[Any]])
async def batchFileGetProteinInfo(files: list[UploadFile]) -> Any:
    return Simulation_1de.batchFileGetProteinInfo(files)