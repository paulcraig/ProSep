from fastapi import APIRouter, Header, HTTPException, status
from backend.logic.auth_utils import AuthService
from pydantic import BaseModel
from typing import Optional


router = APIRouter(prefix="/admin", tags=["admin-auth"])


class PublicKeyResponse(BaseModel):
    public_key: str


class VerifyRequest(BaseModel):
    encrypted_password: str


class StatusResponse(BaseModel):
    password_set: bool


class SetInitialRequest(BaseModel):
    encrypted_password: str


class ResetRequest(BaseModel):
    current_encrypted_password: str
    new_encrypted_password: str


class VerifyResponse(BaseModel):
    valid: bool


class SuccessResponse(BaseModel):
    success: bool


@router.get("/status", response_model=StatusResponse)
async def get_auth_status():
    return StatusResponse(password_set=AuthService.get_stored_hash() is not None)


@router.get("/public-key", response_model=PublicKeyResponse)
async def get_public_key():
    return PublicKeyResponse(public_key=AuthService.get_public_key_pem())


@router.post("/verify", response_model=VerifyResponse)
async def verify_password(request: VerifyRequest):
    return VerifyResponse(valid=AuthService.verify(request.encrypted_password))


@router.post("/set-initial", response_model=SuccessResponse)
async def set_initial_password(request: SetInitialRequest):
    if AuthService.get_stored_hash() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Password already set. Use /reset-password instead."
        )
    success = AuthService.set_hash(request.encrypted_password)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to set password."
        )
    return SuccessResponse(success=True)


@router.post("/reset-password", response_model=SuccessResponse)
async def reset_password(request: ResetRequest):
    if not AuthService.verify(request.current_encrypted_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password invalid."
        )
    success = AuthService.set_hash(request.new_encrypted_password)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset password."
        )
    return SuccessResponse(success=True)


async def verify_admin_header(x_encrypted_password: Optional[str] = Header(None, alias="X-Encrypted-Password")):
    """
    Dependency for protected routes.
    Expects RSA-encrypted password in header `X-Encrypted-Password`.
    Other routers can use: func(..., admin_encrypted: str = Depends(verify_admin_header))
    """
    if not AuthService.verify(x_encrypted_password or ""):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Encrypted-Password header"
        )
    return x_encrypted_password