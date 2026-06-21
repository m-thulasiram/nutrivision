from fastapi import APIRouter, Depends
from pydantic import BaseModel
import sqlite3
from datetime import datetime

from dependencies import require_user_id
from database import get_db
import crud
from services.hybrid_scanner_service import get_hybrid_candidates, YOLO_TO_SUPER_CAT
from routes.users import _build_daily_progress

router = APIRouter(
    prefix="/api/scanner",
    tags=["scanner"]
)

class ScannerMatchRequest(BaseModel):
    detected_class: str

@router.post("/match")
async def scanner_match(
    request: ScannerMatchRequest,
    current_user_id: int = Depends(require_user_id),
    db: sqlite3.Connection = Depends(get_db)
):
    """
    POST route for hybrid food scanner classification.
    Takes a YOLO visual label and returns the top 5 most likely regional candidates.
    """
    user_data = crud.get_user(db, current_user_id)
    preferred_state = "Tamil Nadu"
    diet_type = "vegetarian"
    
    if user_data:
        preferred_state = user_data.get("preferred_state", "Tamil Nadu")
        diet_type = user_data.get("diet_type", "vegetarian")
        
    # Get today's progress to check remaining protein
    progress_res = _build_daily_progress(db, current_user_id)
    progress = progress_res.get("progress", {})
    remaining_protein = progress.get("remaining", {}).get("protein_g", 0.0) if progress else 0.0
    
    # Get current hour
    current_hour = datetime.now().hour
    
    # Get matches from the database
    candidates = get_hybrid_candidates(
        detected_class=request.detected_class,
        user_state=preferred_state,
        diet_type=diet_type,
        hour=current_hour,
        remaining_protein=remaining_protein
    )
    
    # Map yolo class to super category name
    super_category = YOLO_TO_SUPER_CAT.get(request.detected_class.replace(" ", "_"), "Snack")
    
    return {
        "success": True,
        "detected_class": request.detected_class,
        "super_category": super_category,
        "candidates": candidates
    }
