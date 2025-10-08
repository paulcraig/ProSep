import os, shutil

from pathlib import Path
from pydantic import BaseModel
from fastapi.responses import FileResponse
from fastapi import APIRouter, UploadFile, File, HTTPException
from backend.logic.artifact_utils import MetadataManager, PreviewGenerator


FILES_DIR = Path('data/artifacts')
router = APIRouter(prefix='/artifacts', tags=['files'])


class RenameRequest(BaseModel):
    new_name: str


class ReorderRequest(BaseModel):
    file_order: list[str]


@router.get('/')
def list_artifacts() -> list[dict]:
    return MetadataManager.get_files(FILES_DIR)


@router.post('/reorder')
def reorder_artifacts(request: ReorderRequest) -> dict:
    MetadataManager.reorder_files(request.file_order)
    return {'success': True, 'reordered': len(request.file_order)}


@router.get('/{filename}')
def download_artifact(filename: str):
    safe_name = Path(filename).name
    path = FILES_DIR / safe_name

    if not path.exists():
        raise HTTPException(status_code=404, detail='File not found')

    return FileResponse(
        path,
        filename=safe_name,
        media_type='application/octet-stream'
    )


@router.post('/')
def upload_artifact(file: UploadFile = File(...)) -> dict:
    if not file.filename:
        raise HTTPException(status_code=400, detail='Missing filename')

    safe_name = Path(file.filename).name
    dest = FILES_DIR / safe_name

    with dest.open('wb') as buffer:
        shutil.copyfileobj(file.file, buffer)

    PreviewGenerator.generate(dest)
    MetadataManager.add_file(safe_name)

    return {'name': dest.name, 'size': dest.stat().st_size}


@router.put('/{filename}/replace')
def replace_artifact(filename: str, file: UploadFile = File(...)) -> dict:
    if not file.filename:
        raise HTTPException(status_code=400, detail='Missing uploaded filename')

    safe_old = Path(filename).name
    safe_new = Path(file.filename).name

    old_path = FILES_DIR / safe_old
    new_path = FILES_DIR / safe_new

    if not old_path.exists():
        raise HTTPException(status_code=404, detail='Original file not found')

    os.remove(old_path)
    PreviewGenerator.delete(safe_old)

    with new_path.open('wb') as buffer:
        shutil.copyfileobj(file.file, buffer)

    PreviewGenerator.generate(new_path)
    MetadataManager.update_file(safe_old, safe_new)

    return {'replaced': safe_old, 'with': safe_new, 'size': new_path.stat().st_size}


@router.delete('/{filename}')
def delete_artifact(filename: str) -> dict:
    safe_name = Path(filename).name
    path = FILES_DIR / safe_name

    if not path.exists():
        raise HTTPException(status_code=404, detail='File not found')

    os.remove(path)
    PreviewGenerator.delete(safe_name)
    MetadataManager.remove_file(safe_name)
    return {'deleted': safe_name}


@router.get('/{filename}/preview')
def get_artifact_preview(filename: str):
    safe_name = Path(filename).name
    file_path = FILES_DIR / safe_name
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail='File not found')
    
    preview_path = PreviewGenerator.get_preview_path(safe_name)

    if not preview_path.exists():
        PreviewGenerator.generate(file_path)
    
    return FileResponse(
        preview_path,
        media_type='image/png'
    )