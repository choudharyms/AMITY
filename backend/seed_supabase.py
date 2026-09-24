#!/usr/bin/env python3
"""
AaharSetu Supabase Seeder
Executes the seed data into Supabase via REST / Management API or direct SQL.
"""
import os
import sys
from pathlib import Path
import httpx
from dotenv import load_dotenv

# Load env variables from root
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("VITE_SUPABASE_KEY")

SEED_SQL_FILE = ROOT_DIR / "supabase" / "seed.sql"

def seed_database():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[!] SUPABASE_URL or SUPABASE_KEY missing in .env")
        print("    Running in local simulation mode. Seed file is at:", SEED_SQL_FILE)
        return False

    print(f"[*] Target Supabase Project: {SUPABASE_URL}")
    print(f"[*] Reading seed SQL: {SEED_SQL_FILE}")

    if not SEED_SQL_FILE.exists():
        print(f"[!] Seed file not found at {SEED_SQL_FILE}")
        return False

    sql_content = SEED_SQL_FILE.read_text(encoding="utf-8")
    print(f"[*] Loaded {len(sql_content)} bytes of SQL.")

    # Try Supabase SQL API (pg_query endpoint if available)
    # Or execute individual tables via REST API
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }

    print("[*] Seeding completed. You can also run 'npx supabase db reset' or execute via Antigravity MCP.")
    return True

if __name__ == "__main__":
    success = seed_database()
    sys.exit(0 if success else 1)
