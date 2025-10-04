from typing import Any
from fastapi import APIRouter, UploadFile
from logic.simulation_1de import Simulation_1de

router = APIRouter(
    prefix="/1d",
    tags=["1D Simulation"]
)
@router.post('/ProteinInfo/File', response_model=list[Any])
async def fileGetProteinInfo(file: UploadFile) -> Any:
    
    return Simulation_1de.fileGetProteinInfo(file)





@router.post('/BatchFileProtein/Batch', response_model=list[list[Any]])
async def batchFileGetProteinInfo(files: list[UploadFile]) -> Any:
    return Simulation_1de.batchFileGetProteinInfo(files)