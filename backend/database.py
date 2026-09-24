"""Compatibility import for code that still refers to the repository module."""

from supabase_gateway import SupabaseGateway, db

__all__ = ["SupabaseGateway", "db"]
