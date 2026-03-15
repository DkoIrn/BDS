import httpx
from app.config import settings


class SupabaseClient:
    """Lightweight Supabase client using httpx (avoids heavy SDK dependencies)."""

    def __init__(self, url: str, key: str):
        self.url = url.rstrip("/")
        self.key = key
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    def table(self, name: str) -> "TableQuery":
        return TableQuery(self, name)

    @property
    def storage(self) -> "StorageClient":
        return StorageClient(self)


class TableQuery:
    def __init__(self, client: SupabaseClient, table: str):
        self.client = client
        self.base_url = f"{client.url}/rest/v1/{table}"
        self.headers = dict(client.headers)
        self._filters: list[str] = []
        self._select = "*"
        self._is_single = False

    def select(self, columns: str = "*") -> "TableQuery":
        self._select = columns
        return self

    def eq(self, column: str, value: str) -> "TableQuery":
        self._filters.append(f"{column}=eq.{value}")
        return self

    def single(self) -> "TableQuery":
        self._is_single = True
        self.headers["Accept"] = "application/vnd.pgrst.object+json"
        return self

    def order(self, column: str, *, desc: bool = False) -> "TableQuery":
        direction = "desc" if desc else "asc"
        self._filters.append(f"order={column}.{direction}")
        return self

    def limit(self, count: int) -> "TableQuery":
        self._filters.append(f"limit={count}")
        return self

    def execute(self) -> "QueryResult":
        params = f"select={self._select}"
        if self._filters:
            params += "&" + "&".join(self._filters)
        resp = httpx.get(f"{self.base_url}?{params}", headers=self.headers)
        resp.raise_for_status()
        return QueryResult(resp.json())

    def insert(self, data: dict | list) -> "InsertQuery":
        return InsertQuery(self.client, self.base_url, data)

    def update(self, data: dict) -> "UpdateQuery":
        return UpdateQuery(self.client, self.base_url, data, self._filters)


class InsertQuery:
    def __init__(self, client: SupabaseClient, url: str, data: dict | list):
        self.client = client
        self.url = url
        self.data = data

    def execute(self) -> "QueryResult":
        resp = httpx.post(self.url, json=self.data, headers=self.client.headers)
        resp.raise_for_status()
        return QueryResult(resp.json())


class UpdateQuery:
    def __init__(self, client: SupabaseClient, url: str, data: dict, filters: list[str]):
        self.client = client
        self.url = url
        self.data = data
        self.filters = list(filters)

    def eq(self, column: str, value: str) -> "UpdateQuery":
        self.filters.append(f"{column}=eq.{value}")
        return self

    def execute(self) -> "QueryResult":
        params = "&".join(self.filters) if self.filters else ""
        url = f"{self.url}?{params}" if params else self.url
        resp = httpx.patch(url, json=self.data, headers=self.client.headers)
        resp.raise_for_status()
        return QueryResult(resp.json())


class QueryResult:
    def __init__(self, data):
        self.data = data


class StorageClient:
    def __init__(self, client: SupabaseClient):
        self.client = client

    def from_(self, bucket: str) -> "BucketClient":
        return BucketClient(self.client, bucket)


class BucketClient:
    def __init__(self, client: SupabaseClient, bucket: str):
        self.client = client
        self.bucket = bucket

    def download(self, path: str) -> bytes:
        url = f"{self.client.url}/storage/v1/object/{self.bucket}/{path}"
        resp = httpx.get(url, headers=self.client.headers)
        resp.raise_for_status()
        return resp.content


def get_supabase_client() -> SupabaseClient:
    """Create a lightweight Supabase client (bypasses RLS via service role key)."""
    return SupabaseClient(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )
