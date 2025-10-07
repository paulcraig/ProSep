import os, shutil

from pathlib import Path
from pydantic import BaseModel
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse


FILES_DIR = Path('data/artifacts')
FILES_DIR.mkdir(parents=True, exist_ok=True)
router = APIRouter(prefix='/artifacts', tags=['files'])


class RenameRequest(BaseModel):
    new_name: str


@router.get('/')
def list_artifacts() -> list[dict]:
    files = []
    for f in FILES_DIR.iterdir():
        if f.is_file():
            files.append({
                'id': f.name,
                'name': f.name,
                'size': f.stat().st_size,
                'url': f'/artifacts/{f.name}',
            })
    return files


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

    return {'name': dest.name, 'size': dest.stat().st_size}


@router.put('/{filename}')
def rename_artifact(filename: str, body: RenameRequest):
    safe_old = Path(filename).name
    safe_new = Path(body.new_name).name
    src = FILES_DIR / safe_old
    dest = FILES_DIR / safe_new

    if not src.exists():
        raise HTTPException(status_code=404, detail='File not found')
    if dest.exists():
        raise HTTPException(status_code=400, detail='Target name already exists')

    src.rename(dest)
    return {'old_name': safe_old, 'new_name': safe_new}


@router.delete('/{filename}')
def delete_artifact(filename: str) -> dict:
    safe_name = Path(filename).name
    path = FILES_DIR / safe_name

    if not path.exists():
        raise HTTPException(status_code=404, detail='File not found')

    os.remove(path)
    return {'deleted': safe_name}
