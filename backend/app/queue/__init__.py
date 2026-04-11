"""Procrastinate job queue application instance.

Uses PsycopgConnector for async PostgreSQL communication.
Connects via DATABASE_URL (direct connection or session-mode Supavisor port 5432).
Do NOT use the transaction pooler (port 6543) -- it breaks LISTEN/NOTIFY.
"""

import logging
import os

import procrastinate
from procrastinate import testing as procrastinate_testing

from app.config import settings

logger = logging.getLogger(__name__)

# Feature flag for safe transition from BackgroundTasks to procrastinate.
# Set USE_JOB_QUEUE=true in environment to enable queue-based processing.
USE_JOB_QUEUE = settings.use_job_queue

# Build the procrastinate app.
# The connector requires a direct PostgreSQL connection string.
_database_url = settings.database_url or os.environ.get("DATABASE_URL", "")

if _database_url:
    _connector = procrastinate.PsycopgConnector(conninfo=_database_url)
else:
    # No DATABASE_URL: use InMemoryConnector for local dev/testing
    _connector = procrastinate_testing.InMemoryConnector()
    logger.warning("No DATABASE_URL set -- using InMemoryConnector (jobs will not persist)")

app = procrastinate.App(
    connector=_connector,
    import_paths=["app.queue.tasks"],
)
