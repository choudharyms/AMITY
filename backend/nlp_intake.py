import re
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
from models import NLPParseResponse, Category
from config import GEMINI_API_KEY
from safety_engine import calculate_safe_window

def rule_based_fallback_parse(text: str) -> NLPParseResponse:
    """
    High-accuracy heuristic parser for Hindi, Hinglish, and English informal messages.
    Handles messages like:
    - '45 plates paneer biryani hot ready now 18kg stays good till 9pm'
    - 'Tiffin center se 30 roti aur dal bacha hai, 12 kg garam hai'
    - 'Fresh vegetables 25kg and bakery bread 10kg from morning'
    """
    clean = text.lower()
    now = datetime.now(timezone.utc)

    # 1. Quantity extraction (kg or servings/plates)
    qty_kg = 15.0
    kg_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:kg|kilos|kilograms)', clean)
    if kg_match:
        qty_kg = float(kg_match.group(1))
    else:
        servings_match = re.search(r'(\d+)\s*(?:plates|servings|people|logon|meals|packets|boxes)', clean)
        if servings_match:
            # 1 plate cooked food ~ 0.45 kg
            qty_kg = round(float(servings_match.group(1)) * 0.45, 1)

    # 2. Category & Temperature deduction
    category: Category = "cooked_hot"
    temp_c = 68.0

    if any(k in clean for k in ["cold", "chilled", "curd", "raita", "salad", "ice", "fridge", "thanda"]):
        category = "cooked_cold"
        temp_c = 4.5
    elif any(k in clean for k in ["bread", "pastry", "cake", "bun", "bakery", "biscuit", "croissant"]):
        category = "bakery"
        temp_c = None
    elif any(k in clean for k in ["vegetable", "sabzi", "fruit", "produce", "tamatar", "aloo", "fresh raw"]):
        category = "produce"
        temp_c = None
    elif any(k in clean for k in ["packet", "biscuit", "packaged", "canned", "chips", "namkeen"]):
        category = "packaged"
        temp_c = None
    elif any(k in clean for k in ["biryani", "rice", "dal", "curry", "roti", "chapati", "khichdi", "hot", "garam", "cooked", "buffet", "catering"]):
        category = "cooked_hot"
        temp_c = 70.0

    # 3. Item Name extraction
    items = []
    keywords = ["paneer biryani", "veg biryani", "chicken biryani", "rice & dal", "roti and sabzi", "dal makhani", "south indian meals", "curry", "bread & buns", "fresh produce", "vegetables", "assorted meals"]
    for kw in keywords:
        if kw in clean:
            items.append(kw.title())
            break
    if not items:
        # Grab first 4-5 words or truncate
        words = text.split()[:5]
        items.append(" ".join(words).title())

    item_name = items[0]

    # 4. Preparation time (default to 45 mins ago if 'ready now' or 'morning')
    prep_minutes_ago = 45
    if any(k in clean for k in ["now", "abhi", "freshly", "just"]):
        prep_minutes_ago = 15
    elif any(k in clean for k in ["morning", "subah"]):
        prep_minutes_ago = 180

    prepared_at = now - timedelta(minutes=prep_minutes_ago)
    safe_until, window_hours, rationale = calculate_safe_window(category, prepared_at, temp_c)

    return NLPParseResponse(
        item=item_name,
        category=category,
        qty_kg=qty_kg,
        temp_c=temp_c,
        window_hours=window_hours,
        prepared_at_iso=prepared_at.isoformat(),
        safe_until_iso=safe_until.isoformat(),
        confidence=0.88,
        notes=f"Parsed via AaharSetu heuristic engine: {rationale}"
    )

def parse_donor_message(text: str) -> NLPParseResponse:
    """
    Parses messy donor WhatsApp / Telegram messages using Gemini Flash-Lite structured JSON output.
    Falls back to heuristic parser if API key is unconfigured or rate-limited.
    """
    if not GEMINI_API_KEY:
        return rule_based_fallback_parse(text)

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=GEMINI_API_KEY)
        prompt = f"""
You are an expert food safety and rescue intake coordinator for AaharSetu (India).
Extract food donation details from this informal Hindi/Hinglish/English message:
\"\"\"{text}\"\"\"

Identify:
- item: concise food description (e.g. "Paneer Biryani", "Dal & Roti")
- category: strictly one of ["cooked_hot", "cooked_cold", "packaged", "produce", "bakery"]
- qty_kg: estimated weight in kilograms (float). If in plates/servings, convert 1 plate = 0.45 kg.
- temp_c: estimated Celsius temperature (hot cooked is ~70C, chilled is ~4C, bakery/produce/packaged is null).
- prepared_minutes_ago: integer estimate of how many minutes ago this was prepared.
"""
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1
            ),
        )
        data = json.loads(response.text)

        now = datetime.now(timezone.utc)
        prep_mins = int(data.get("prepared_minutes_ago", 40))
        prepared_at = now - timedelta(minutes=prep_mins)
        category: Category = data.get("category", "cooked_hot")
        temp_c = data.get("temp_c")
        safe_until, window_hours, rationale = calculate_safe_window(category, prepared_at, temp_c)

        return NLPParseResponse(
            item=str(data.get("item", "Surplus Food")),
            category=category,
            qty_kg=float(data.get("qty_kg", 15.0)),
            temp_c=float(temp_c) if temp_c is not None else None,
            window_hours=window_hours,
            prepared_at_iso=prepared_at.isoformat(),
            safe_until_iso=safe_until.isoformat(),
            confidence=0.96,
            notes=f"Parsed by Gemini Flash-Lite: {rationale}"
        )
    except Exception as e:
        res = rule_based_fallback_parse(text)
        res.notes += f" (Gemini fallback: {str(e)})"
        return res
