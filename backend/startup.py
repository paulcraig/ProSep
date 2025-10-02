from fastapi import APIRouter

router = APIRouter(
    tags=['Startup']
)


@router.get("/")
async def hello_world():
    return dict({'message': 'Ready to go'})