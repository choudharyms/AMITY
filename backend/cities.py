import json
from pathlib import Path
from typing import Dict, List

CITY_DIRECTORY: List[Dict[str, object]] = json.loads(
    (Path(__file__).resolve().parent.parent / "shared" / "cities.json").read_text(encoding="utf-8")
)
CITY_BY_ID = {str(city["id"]): city for city in CITY_DIRECTORY}
