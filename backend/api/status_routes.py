from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import List, Optional

from backend.api.auth_routes import verify_admin_header
from backend.logic.status_utils import StatusService


router = APIRouter(prefix="/status", tags=["status"])


class PRInfo(BaseModel):
    id: int
    title: str
    url: str


class VersionInfo(BaseModel):
    version: str
    remote_version: str
    creation_date: str
    notes: str
    prs: List[PRInfo]
    available_versions: List[str]
    locked: bool


class CheckoutRequest(BaseModel):
    version: str
    lock: bool = False


class CheckoutResponse(BaseModel):
    success: bool
    version: str
    locked: bool
    message: str


class LockRequest(BaseModel):
    locked: bool


class LockResponse(BaseModel):
    success: bool
    locked: bool


class ApacheMetrics(BaseModel):
    requests_per_minute: int
    error_rate: float
    avg_response_time: int
    service_running: bool


class UvicornMetrics(BaseModel):
    requests_per_minute: int
    error_rate: float
    avg_response_time: int
    process_running: bool


class PerformanceMetrics(BaseModel):
    uptime: str
    apache: ApacheMetrics
    uvicorn: UvicornMetrics


class AutoUpdateStatus(BaseModel):
    active: bool
    interval_minutes: int


class ActivateRequest(BaseModel):
    active: bool


class IntervalRequest(BaseModel):
    interval_minutes: int = Field(ge=1, le=60)


class SuccessResponse(BaseModel):
    success: bool
    message: Optional[str] = None


@router.get("/version", response_model=VersionInfo)
async def get_version():
    return StatusService.get_version_info()


@router.post("/version/checkout", response_model=CheckoutResponse)
async def checkout_version(request: CheckoutRequest, admin_hash: str = Depends(verify_admin_header)):
    result = StatusService.checkout_version(request.version, request.lock)
    return result


@router.post("/version/lock", response_model=LockResponse)
async def set_version_lock(request: LockRequest, admin_hash: str = Depends(verify_admin_header)):
    result = StatusService.set_version_lock(request.locked)
    return result


@router.get("/performance", response_model=PerformanceMetrics)
async def get_performance():
    return StatusService.get_performance_metrics()


@router.get("/auto-update", response_model=AutoUpdateStatus)
async def get_auto_update_status():
    return StatusService.get_auto_update_status()


@router.post("/auto-update/activate", response_model=SuccessResponse)
async def set_auto_update_active(request: ActivateRequest, admin_hash: str = Depends(verify_admin_header)):
    result = StatusService.set_auto_update_active(request.active)
    return result


@router.post("/auto-update/interval", response_model=SuccessResponse)
async def set_auto_update_interval(request: IntervalRequest, admin_hash: str = Depends(verify_admin_header)):
    result = StatusService.set_auto_update_interval(request.interval_minutes)
    return result


@router.post("/restart/apache", response_model=SuccessResponse)
async def restart_apache(admin_hash: str = Depends(verify_admin_header)):
    return StatusService.restart_apache()


@router.post("/restart/uvicorn", response_model=SuccessResponse)
async def restart_uvicorn(admin_hash: str = Depends(verify_admin_header)):
    return StatusService.restart_uvicorn()


@router.post("/restart/app", response_model=SuccessResponse)
async def restart_app(admin_hash: str = Depends(verify_admin_header)):
    return StatusService.restart_app()
