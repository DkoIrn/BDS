from supabase import create_client, Client
from app.config import settings


def get_supabase_client() -> Client:
    """Create a Supabase client using the service role key (bypasses RLS)."""
    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )
