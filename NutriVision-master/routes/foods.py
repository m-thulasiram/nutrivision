from fastapi import APIRouter, HTTPException, Query
import json
from models import get_models

router = APIRouter(prefix="/api/foods", tags=["foods"])


@router.get("/regional-info", include_in_schema=False)
def get_food_regional_info(food_name: str = Query(...)):
    from models import get_regional_info
    info = get_regional_info(food_name)
    if not info.get("region"):
        raise HTTPException(status_code=404, detail=f"No regional info found for '{food_name}'")
    return info

@router.get("/regions")
def list_regions():
    regional_df = get_models().regional_df
    if regional_df.empty:
        return {"regions": []}
    regions = sorted(regional_df['region'].unique().tolist())
    return {"regions": regions}

@router.get("/states")
def list_states():
    regional_df = get_models().regional_df
    if regional_df.empty:
        return {"states": []}
    states = sorted(regional_df['state'].unique().tolist())
    return {"states": states}

@router.get("/by-region/{region}")
def foods_by_region(region: str):
    regional_df = get_models().regional_df
    if regional_df.empty:
        return {"foods": []}
    match = regional_df[regional_df['region'].str.lower() == region.lower()]
    if match.empty:
        raise HTTPException(status_code=404, detail=f"No foods found for region '{region}'")
    return {"region": region, "foods": json.loads(match.to_json(orient='records'))}

@router.get("/by-state/{state}")
def foods_by_state(state: str):
    regional_df = get_models().regional_df
    if regional_df.empty:
        return {"foods": []}
    match = regional_df[regional_df['state'].str.lower() == state.lower()]
    if match.empty:
        raise HTTPException(status_code=404, detail=f"No foods found for state '{state}'")
    return {"state": state, "foods": json.loads(match.to_json(orient='records'))}

@router.get("/search")
def search_foods(q: str = Query(..., min_length=1)):
    regional_df = get_models().regional_df
    if regional_df.empty:
        return {"foods": []}
    mask = regional_df['Food_items'].astype(str).str.lower().str.contains(q.lower(), na=False)
    match = regional_df[mask].head(20)
    results = []
    for _, row in match.iterrows():
        results.append({
            "food_items": row.get("Food_items", ""),
            "Calories": row.get("Calories", 0),
            "Proteins": row.get("Proteins", 0),
            "Carbohydrates": row.get("Carbohydrates", 0),
            "Fats": row.get("Fats", 0),
            "Veg_Flag": row.get("Veg_Flag", 1),
            "region": row.get("region", ""),
            "state": row.get("state", ""),
        })
    return {"foods": results}
