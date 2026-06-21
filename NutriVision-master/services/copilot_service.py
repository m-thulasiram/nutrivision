import os
import json
import asyncio
from typing import AsyncGenerator
import pandas as pd
from pathlib import Path

# Load food database once at startup
FOOD_DB_PATH = Path("expanded_food_database.csv")
food_df = pd.read_csv(FOOD_DB_PATH)
# Rename columns to maintain backwards compatibility with existing copilot code
food_df = food_df.rename(columns={
    "Food Name": "Food_items",
    "Protein": "Proteins",
    "Fat": "Fats",
    "Carbs": "Carbohydrates"
})

# Load category mappings
MAPPING_PATH = Path("category_mapping.csv")
if MAPPING_PATH.exists():
    mapping_df = pd.read_csv(MAPPING_PATH)
    food_to_super_cat = dict(zip(mapping_df["Food Name"], mapping_df["Super Category"]))
    food_df["Super Category"] = food_df["Food_items"].map(food_to_super_cat)
else:
    food_df["Super Category"] = "Snack"

def build_system_prompt(user_context: dict) -> str:
  return f"""You are NutriVision's AI nutrition assistant. You are an expert in Indian nutrition and regional cuisine.

USER PROFILE:
- Name: {user_context.get('name', 'User')}
- Goal: {user_context.get('goal', 'maintain')}
- Diet type: {user_context.get('diet_type', 'vegetarian')}
- Region: {user_context.get('preferred_state', 'Tamil Nadu')}
- Age: {user_context.get('age', 25)}
- Weight: {user_context.get('weight_kg', 70)}kg

TODAY'S NUTRITION STATUS:
- Calories consumed: {user_context.get('consumed_calories', 0)} / {user_context.get('target_calories', 2000)} kcal
- Protein consumed: {user_context.get('consumed_protein', 0)}g / {user_context.get('target_protein', 120)}g
- Carbs consumed: {user_context.get('consumed_carbs', 0)}g / {user_context.get('target_carbs', 220)}g
- Fats consumed: {user_context.get('consumed_fats', 0)}g / {user_context.get('target_fats', 65)}g

REMAINING TODAY:
- Calories remaining: {user_context.get('remaining_calories', 2000)}
- Protein remaining: {user_context.get('remaining_protein', 120)}g
- Carbs remaining: {user_context.get('remaining_carbs', 220)}g
- Fats remaining: {user_context.get('remaining_fats', 65)}g

MEALS LOGGED TODAY:
{user_context.get('meals_today_str', 'No meals logged yet')}

STRICT RULES YOU MUST FOLLOW:
1. ONLY recommend foods matching the user's diet type. If vegetarian, NEVER suggest meat, fish, or eggs. If eggetarian, eggs are allowed but no meat or fish.
2. Prioritise foods from the user's region.
   For Tamil Nadu: idli, dosa, sambar, rasam, kootu, pongal, rice dishes, appam.
   For Punjab: roti, dal makhani, rajma, chole, sarson saag, paneer dishes.
   For Kerala: puttu, appam, stew, avial, fish curry (for non-veg), kadala curry.
   For Bengal: macher jhol, dal, rice, shorshe ilish (non-veg), aloo posto.
   For Maharashtra: vada pav, misal pav, poha, puran poli, bhakri.
   For Gujarat: dhokla, thepla, khichdi, undhiyu, handvo.
3. Keep responses SHORT — under 80 words unless the user asks for detail.
4. When recommending food always include:
   - Food name
   - Approximate calories and protein
   - Why it fits their remaining targets
5. When user says they ate something:
   - Confirm what you understood
   - Give estimated macros
   - Ask if they want to log it
   - If yes, return a JSON block for logging
6. For diabetic users: warn about high-sugar or high-GI foods automatically.
7. Never make up nutritional values. Use approximate real values only.

RESPONSE FORMAT RULES:
- For plain text answers: just reply normally
- When recommending a specific food, end your message with a JSON block in this format:
  |||FOOD_CARD|||
  {{"food_name":"Idli","calories":156,"protein_g":5,"carbs_g":30,"fats_g":1.7,"serving":"2 pieces (80g)","reason":"Low calorie, high carb — fills your remaining 800 kcal gap"}}
  |||END_CARD|||
- When user confirms they want to log a meal:
  |||LOG_MEAL|||
  {{"food_name":"Idli","quantity":2,"weight_g":80,"calories":124,"protein_g":4,"carbs_g":24,"fats_g":1.4}}
  |||END_LOG|||
"""

def search_food_db(query: str, 
                   diet_type: str,
                   state: str,
                   limit: int = 3) -> list:
  """Search food DB for RAG context."""
  df = food_df.copy()
  
  # Normalize diet_type
  dt = diet_type.lower() if diet_type else "any"
  df["VegNovVeg_num"] = pd.to_numeric(df["VegNovVeg"], errors="coerce")
  
  # Filter by diet type
  if dt in ("vegetarian", "veg"):
    df = df[df["VegNovVeg_num"] == 0]
  elif dt == "eggetarian":
    is_veg = df["VegNovVeg_num"] == 0
    is_egg = df["Food_items"].str.lower().str.contains("egg", na=False)
    df = df[is_veg | is_egg]
  
  # Check if query matches any super-category keywords
  query_lower = query.lower()
  category_query_map = {
      "chicken": "Chicken Dish",
      "fish": "Fish Dish",
      "egg": "Egg Dish",
      "dosa": "Dosa Variant",
      "idli": "Idli Variant",
      "roti": "Bread/Roti",
      "bread": "Bread/Roti",
      "paratha": "Bread/Roti",
      "dal": "Dal",
      "pappu": "Dal",
      "curry": "Curry",
      "dessert": "Dessert",
      "sweet": "Dessert",
      "snack": "Snack",
      "beverage": "Beverage",
      "drink": "Beverage",
      "rice": "Rice Dish"
  }
  
  matched_cat = None
  for kw, cat in category_query_map.items():
      if kw in query_lower:
          matched_cat = cat
          break
          
  if matched_cat:
      # Retrieve foods matching this category
      cat_mask = df["Super Category"] == matched_cat
      matches = df[cat_mask]
  else:
      mask = df["Food_items"].str.lower().str.contains(query_lower, na=False)
      matches = df[mask]
      
  if not matches.empty:
      # Rank matches: preferred state matches first
      if state:
          is_state = matches["State"].str.lower() == state.lower()
          results = pd.concat([matches[is_state], matches[~is_state]]).head(limit)
      else:
          results = matches.head(limit)
  else:
      # Return top foods by protein from the state
      state_df = df[df["State"].str.lower() == state.lower()] if state else df
      if state_df.empty:
          state_df = df
      results = state_df.nlargest(limit, "Proteins")
  
  return results[[
    "Food_items", "Calories", "Proteins",
    "Carbohydrates", "Fats", "VegNovVeg"
  ]].to_dict("records")

async def stream_copilot_response(
  message: str,
  user_context: dict,
  conversation_history: list
) -> AsyncGenerator[str, None]:
  """
  Stream AI response word by word.
  Yields chunks of text.
  """
  
  # RAG: search food DB for relevant foods
  relevant_foods = search_food_db(
    message,
    user_context.get("diet_type", "vegetarian"),
    user_context.get("preferred_state", "Tamil Nadu")
  )
  
  # Inject RAG context into user message
  rag_context = ""
  if relevant_foods:
    rag_context = "\n\nRELEVANT FOODS FROM DATABASE:\n"
    for food in relevant_foods:
      rag_context += (
        f"- {food['Food_items']}: "
        f"{food['Calories']}kcal, "
        f"{food['Proteins']}g protein, "
        f"{food['Carbohydrates']}g carbs, "
        f"{food['Fats']}g fat\n"
      )
  
  enhanced_message = message + rag_context
  
  # Build messages for API
  messages = [
    {
      "role": "system",
      "content": build_system_prompt(user_context)
    }
  ]
  
  # Add conversation history
  for turn in conversation_history[-10:]:
    messages.append({
      "role": turn["role"],
      "content": turn["content"]
    })
  
  # Add current message
  messages.append({
    "role": "user",
    "content": enhanced_message
  })
  
  api_key = os.getenv("OPENAI_API_KEY")
  if not api_key or api_key == "your_key_here":
      # Dynamic mock fallback logic for offline/api key-less development
      msg_lower = message.lower()
      
      # 1. Ask for food recommendation: e.g. "What should I eat for lunch?", "recommend", "dinner", "eat"
      if any(keyword in msg_lower for keyword in ["eat", "lunch", "dinner", "recommend", "suggest", "food"]):
          if relevant_foods:
              food = relevant_foods[0]
              food_name = food["Food_items"]
              calories = int(food["Calories"])
              protein = int(food["Proteins"])
              carbs = int(food["Carbohydrates"])
              fats = int(food["Fats"])
          else:
              food_name = "Idli"
              calories = 156
              protein = 5
              carbs = 30
              fats = 2
          
          state = user_context.get("preferred_state", "Tamil Nadu")
          reason = f"Low calorie, fits your {user_context.get('diet_type', 'vegetarian')} diet and region ({state}) perfectly."
          response = (
              f"Based on your remaining budget and region ({state}), I highly recommend trying {food_name}. "
              f"It is a nutritious choice that fits your targets perfectly.\n\n"
              f"|||FOOD_CARD|||\n"
              f'{{"food_name":"{food_name}","calories":{calories},'
              f'"protein_g":{protein},"carbs_g":{carbs},"fats_g":{fats},'
              f'"serving":"1 serving","reason":"{reason}"}}\n'
              f"|||END_CARD|||"
          )
      
      # 2. Log a meal by talking: e.g. "I had 2 idlis", "I ate X", "ate", "had"
      elif any(keyword in msg_lower for keyword in ["ate", "had", "eat", "logged"]):
          import re
          qty = 1
          match = re.search(r"\b(\d+)\b", msg_lower)
          if match:
              try:
                  qty = int(match.group(1))
              except ValueError:
                  qty = 1
          
          food_name = "Idli"
          if "sambar" in msg_lower:
              food_name = "Sambar"
          elif "roti" in msg_lower or "chappati" in msg_lower:
              food_name = "Chappati"
          elif "dosa" in msg_lower:
              food_name = "Dosa"
          elif relevant_foods:
              food_name = relevant_foods[0]["Food_items"]
          
          match_db = None
          for f in relevant_foods:
              if f["Food_items"].lower() in msg_lower:
                  match_db = f
                  break
          if not match_db and relevant_foods:
              match_db = relevant_foods[0]
              
          if match_db:
              food_name = match_db["Food_items"]
              calories = int(match_db["Calories"]) * qty
              protein = int(match_db["Proteins"]) * qty
              carbs = int(match_db["Carbohydrates"]) * qty
              fats = int(match_db["Fats"]) * qty
          else:
              calories = 124 * qty
              protein = 4 * qty
              carbs = 24 * qty
              fats = 1 * qty

          response = (
              f"Got it! {qty} {food_name} is approximately {calories} kcal and {protein}g protein. "
              f"Would you like to log this to your daily tracker?\n\n"
              f"|||LOG_MEAL|||\n"
              f'{{"food_name":"{food_name}","quantity":{qty},"weight_g":{qty * 80},'
              f'"calories":{calories},"protein_g":{protein},"carbs_g":{carbs},"fats_g":{fats}}}\n'
              f"|||END_LOG|||"
          )
      
      # 3. Check status: e.g. "Am I on track?", "status", "track", "progress"
      elif any(keyword in msg_lower for keyword in ["track", "status", "progress", "on track"]):
          consumed_cals = user_context.get("consumed_calories", 0)
          target_cals = user_context.get("target_calories", 2000)
          consumed_protein = user_context.get("consumed_protein", 0)
          target_protein = user_context.get("target_protein", 120)
          
          response = (
              f"You've consumed {consumed_cals} out of your {target_cals} kcal goal today. "
              f"Your protein is at {consumed_protein}g / {target_protein}g. "
              f"You have {max(0, target_cals - consumed_cals)} kcal and {max(0, target_protein - consumed_protein)}g protein remaining. "
              f"Try adding a high-protein option like dal or paneer to hit your goals!"
          )
          
      # 4. Diabetic check: e.g. "jalebi", "sugar", "diabetic", "diabetes"
      elif any(keyword in msg_lower for keyword in ["jalebi", "sugar", "diabetic", "diabetes"]):
          response = (
              "Warning: Jalebi is extremely high in refined sugars and glycemic index. "
              "As a diabetic user, this will cause a sharp spike in blood glucose levels. "
              "I recommend avoiding it or opting for a sugar-free alternative in small quantities."
          )
          
      # 5. Default chat
      else:
          response = (
              f"Hi {user_context.get('name', 'User')}! I'm your NutriVision AI assistant. "
              f"I know your goal is to {user_context.get('goal', 'maintain')} and you prefer a {user_context.get('diet_type', 'vegetarian')} diet. "
              f"How can I help you today? You can ask me to recommend foods, log a meal, or check your remaining budget!"
          )
          
      for word in response.split(" "):
          yield word + " "
          await asyncio.sleep(0.02)
      return
  
  # OpenAI stream call
  from openai import AsyncOpenAI
  client = AsyncOpenAI(api_key=api_key)
  
  stream = await client.chat.completions.create(
    model="gpt-4o-mini",
    messages=messages,
    max_tokens=500,
    temperature=0.7,
    stream=True,
  )
  
  async for chunk in stream:
    delta = chunk.choices[0].delta.content
    if delta:
      yield delta
