from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import json
import sqlite3

from dependencies import require_user_id
from database import get_db
from services.copilot_service import (
  stream_copilot_response,
  search_food_db
)
from routes.users import _build_daily_progress
import crud

router = APIRouter(
  prefix="/api/copilot",
  tags=["copilot"]
)

class ConversationTurn(BaseModel):
  role: str    # "user" or "assistant"
  content: str

class CopilotRequest(BaseModel):
  message: str
  conversation_history: List[
    ConversationTurn
  ] = []

@router.post("/chat")
async def copilot_chat(
  request: CopilotRequest,
  current_user_id: int = Depends(require_user_id),
  db: sqlite3.Connection = Depends(get_db)
):
  """
  Stream AI nutrition copilot response.
  Returns Server-Sent Events (SSE).
  """
  
  # Get user's current nutrition status
  user_data = crud.get_user(db, current_user_id)
  
  # Get today's progress
  progress_res = _build_daily_progress(db, current_user_id)
  progress = progress_res.get("progress", {})
  
  # Get today's meals as string
  meals_str = "No meals logged yet"
  if progress and progress.get("meals_today"):
    meals = progress["meals_today"]
    meals_str = "\n".join([
      f"- {m['detected_items']} ({m['total_calories']}kcal)"
      for m in meals[:5]
    ])
  
  # Build full user context
  user_context = {
    "name": user_data["name"] if user_data else "User",
    "goal": user_data["goal"] if user_data else "maintain",
    "diet_type": user_data.get("diet_type", "vegetarian") if user_data else "vegetarian",
    "preferred_state": user_data.get("preferred_state", "Tamil Nadu") if user_data else "Tamil Nadu",
    "age": user_data["age"] if user_data else 25,
    "weight_kg": user_data["weight_kg"] if user_data else 70,
    "target_calories": user_data.get("target_calories", 2000) if user_data else 2000,
    "target_protein": user_data.get("target_protein", 120) if user_data else 120,
    "target_carbs": user_data.get("target_carbs", 220) if user_data else 220,
    "target_fats": user_data.get("target_fats", 65) if user_data else 65,
    
    "consumed_calories": progress.get("consumed", {}).get("calories", 0) if progress else 0,
    "consumed_protein": progress.get("consumed", {}).get("protein_g", 0) if progress else 0,
    "consumed_carbs": progress.get("consumed", {}).get("carbs_g", 0) if progress else 0,
    "consumed_fats": progress.get("consumed", {}).get("fats_g", 0) if progress else 0,
    
    "remaining_calories": progress.get("remaining", {}).get("calories", 2000) if progress else 2000,
    "remaining_protein": progress.get("remaining", {}).get("protein_g", 120) if progress else 120,
    "remaining_carbs": progress.get("remaining", {}).get("carbs_g", 220) if progress else 220,
    "remaining_fats": progress.get("remaining", {}).get("fats_g", 65) if progress else 65,
    "meals_today_str": meals_str,
  }
  
  history = [
    {"role": t.role, "content": t.content}
    for t in request.conversation_history
  ]
  
  async def event_stream():
    async for chunk in stream_copilot_response(
      request.message,
      user_context,
      history
    ):
      # SSE format: data: <content>\n\n
      yield f"data: {json.dumps({'text': chunk})}\n\n"
    
    # Signal stream end
    yield f"data: {json.dumps({'done': True})}\n\n"
  
  return StreamingResponse(
    event_stream(),
    media_type="text/event-stream",
    headers={
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    }
  )

@router.post("/log-meal")
async def log_meal_from_copilot(
  meal_data: dict,
  current_user_id: int = Depends(require_user_id),
  db: sqlite3.Connection = Depends(get_db)
):
  """Log a meal confirmed by the user in chat."""
  detected_items = meal_data.get("food_name", "Unknown")
  calories = float(meal_data.get("calories", 0))
  protein = float(meal_data.get("protein_g", 0))
  carbs = float(meal_data.get("carbs_g", 0))
  fats = float(meal_data.get("fats_g", 0))
  
  crud.create_meal_log(db, {
      "user_id": current_user_id,
      "detected_items": detected_items,
      "total_calories": calories,
      "total_protein": protein,
      "total_carbs": carbs,
      "total_fats": fats,
  })
  
  crud.create_or_update_daily_log(
      db, 
      current_user_id, 
      crud.get_today_str(),
      calories, 
      protein, 
      carbs, 
      fats
  )
  
  return {
    "success": True,
    "message": f"{detected_items} logged successfully",
    "logged": meal_data
  }
