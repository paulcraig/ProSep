from fastapi import APIRouter, Header, HTTPException, status
from backend.logic.auth_utils import AuthService
from pydantic import BaseModel
from typing import Optional


router = APIRouter(prefix="/admin", tags=["admin-auth"])


class VerifyRequest(BaseModel):
    hashed_password: str


class StatusResponse(BaseModel):
    password_set: bool


class SetInitialRequest(BaseModel):
    hashed_password: str


class ResetRequest(BaseModel):
    current_hashed_password: str
    new_hashed_password: str


class VerifyResponse(BaseModel):
    valid: bool


class SuccessResponse(BaseModel):
    success: bool


@router.get("/status", response_model=StatusResponse)
async def get_auth_status():
    """
    Check if a password has been set.
    """
    return StatusResponse(password_set=AuthService.get_stored_hash() is not None)


@router.post("/verify", response_model=VerifyResponse)
async def verify_password(request: VerifyRequest):
    """
    Verify a hashed password.
    """
    return VerifyResponse(valid=AuthService.verify(request.hashed_password))


@router.post("/set-initial", response_model=SuccessResponse)
async def set_initial_password(request: SetInitialRequest):
    """
    Set the initial password hash (only if none exists).
    """
    if AuthService.get_stored_hash() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Password already set. Use /reset-password instead."
        )
    success = AuthService.set_hash(request.hashed_password)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to set password."
        )
    return SuccessResponse(success=True)


@router.post("/reset-password", response_model=SuccessResponse)
async def reset_password(request: ResetRequest):
    """
    Reset password (requires valid current hash).
    """
    if not AuthService.verify(request.current_hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password invalid."
        )
    success = AuthService.set_hash(request.new_hashed_password)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset password."
        )
    return SuccessResponse(success=True)


async def verify_admin_header(x_hashed_password: Optional[str] = Header(None, alias="X-Hashed-Password")):
    """
    Dependency for protected routes.
    Expects hashed password in header `X-Hashed-Password`.
    Other routers can use: func(..., admin_hash: str = Depends(verify_admin_header))
    """
    if not AuthService.verify(x_hashed_password or ""):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Hashed-Password header"
        )
    return x_hashed_password
