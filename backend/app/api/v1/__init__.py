from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.chat import router as chat_router
from app.api.v1.conversations import router as conversations_router
from app.api.v1.memories import router as memories_router
from app.api.v1.media import router as media_router
from app.api.v1.models import router as models_router
from app.api.v1.settings import router as settings_router
from app.api.v1.speech import router as speech_router
from app.api.v1.stats import router as stats_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(chat_router)
api_router.include_router(conversations_router)
api_router.include_router(memories_router)
api_router.include_router(media_router)
api_router.include_router(models_router)
api_router.include_router(settings_router)
api_router.include_router(speech_router)
api_router.include_router(stats_router)
