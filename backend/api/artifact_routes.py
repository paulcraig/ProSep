import os, shutil

from pathlib import Path
from pydantic import BaseModel
from fastapi.responses import FileResponse
from fastapi import APIRouter, UploadFile, File, HTTPException
from backend.logic.artifact_utils import MetadataManager, PreviewGenerator


router = APIRouter(prefix="/artifacts", tags=["files"])


class ReorderRequest(BaseModel):
    file_order: list[str]


@router.get("/{group}")
def list_artifacts(group: str) -> list[dict]:
    return MetadataManager.get_files(group)


@router.post("/{group}/reorder")
def reorder_artifacts(group: str, request: ReorderRequest) -> dict:
    MetadataManager.reorder_files(group, request.file_order)
    return {"success": True, "reordered": len(request.file_order)}


@router.get("/{group}/{filename}")
def download_artifact(group: str, filename: str):
    safe_name = Path(filename).name
    files_dir = MetadataManager.get_group_dir(group)
    path = files_dir / safe_name

    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path,
        filename=safe_name,
        media_type="application/octet-stream"
    )


@router.post("/{group}")
def upload_artifact(group: str, file: UploadFile = File(...)) -> dict:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    safe_name = Path(file.filename).name
    files_dir = MetadataManager.get_group_dir(group)
    dest = files_dir / safe_name

    with dest.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    PreviewGenerator.generate(group, dest)
    MetadataManager.add_file(group, safe_name)

    return {"name": dest.name, "size": dest.stat().st_size}


@router.put("/{group}/{filename}/replace")
def replace_artifact(group: str, filename: str, file: UploadFile = File(...)) -> dict:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing uploaded filename")

    safe_old = Path(filename).name
    safe_new = Path(file.filename).name

    files_dir = MetadataManager.get_group_dir(group)
    old_path = files_dir / safe_old
    new_path = files_dir / safe_new

    if not old_path.exists():
        raise HTTPException(status_code=404, detail="Original file not found")

    os.remove(old_path)
    PreviewGenerator.delete(group, safe_old)

    with new_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    PreviewGenerator.generate(group, new_path)
    MetadataManager.update_file(group, safe_old, safe_new)

    return {"replaced": safe_old, "with": safe_new, "size": new_path.stat().st_size}


@router.delete("/{group}/{filename}")
def delete_artifact(group: str, filename: str) -> dict:
    safe_name = Path(filename).name
    files_dir = MetadataManager.get_group_dir(group)
    path = files_dir / safe_name

    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    os.remove(path)
    PreviewGenerator.delete(group, safe_name)
    MetadataManager.remove_file(group, safe_name)
    return {"deleted": safe_name}


@router.get("/{group}/{filename}/preview")
def get_artifact_preview(group: str, filename: str):
    safe_name = Path(filename).name
    files_dir = MetadataManager.get_group_dir(group)
    file_path = files_dir / safe_name
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    preview_path = PreviewGenerator.get_preview_path(group, safe_name)

    if not preview_path.exists():
        PreviewGenerator.generate(group, file_path)
    
    return FileResponse(
        preview_path,
        media_type="image/png"
    )
