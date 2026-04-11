"""Unit tests for procrastinate job queue infrastructure.

Tests the queue module's task registration, helper functions, retry strategy,
idempotent cleanup, progress tracking, and job recording.

Uses procrastinate's InMemoryConnector for testing (no real DB needed).
"""

import asyncio
from unittest.mock import MagicMock

import procrastinate
from procrastinate import testing as procrastinate_testing
import pytest


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def in_memory_app():
    """Create a procrastinate App backed by InMemoryConnector for testing."""
    connector = procrastinate_testing.InMemoryConnector()
    test_app = procrastinate.App(
        connector=connector,
        import_paths=["app.queue.tasks"],
    )

    @test_app.task(
        name="validate_dataset",
        queue="validation",
        retry=procrastinate.RetryStrategy(max_attempts=3, exponential_wait=10),
    )
    async def validate_dataset_test(dataset_id: str, config_json: dict | None = None):
        pass

    return test_app, connector, validate_dataset_test


# ---------------------------------------------------------------------------
# Tests: App Configuration
# ---------------------------------------------------------------------------


class TestProcrastinateAppConfigured:
    """App instance has correct import_paths and connector type."""

    def test_import_paths(self):
        from app.queue import app as queue_app
        assert "app.queue.tasks" in queue_app.import_paths

    def test_connector_exists(self):
        from app.queue import app as queue_app
        assert queue_app.connector is not None


# ---------------------------------------------------------------------------
# Tests: Task Registration
# ---------------------------------------------------------------------------


class TestValidateTaskRegistered:
    """validate_dataset task is registered with name, queue, and retry."""

    def test_task_exists(self):
        from app.queue.tasks import validate_dataset
        assert validate_dataset is not None

    def test_task_name(self):
        from app.queue.tasks import validate_dataset
        assert validate_dataset.name == "validate_dataset"

    def test_task_queue(self):
        from app.queue.tasks import validate_dataset
        assert validate_dataset.queue == "validation"


class TestRetryStrategy:
    """RetryStrategy uses exponential_wait=10, max_attempts=3."""

    def test_retry_max_attempts(self):
        from app.queue.tasks import validate_dataset
        retry = validate_dataset.retry_strategy
        assert retry is not None
        assert retry.max_attempts == 3

    def test_retry_exponential_wait(self):
        from app.queue.tasks import validate_dataset
        retry = validate_dataset.retry_strategy
        assert retry.exponential_wait == 10


# ---------------------------------------------------------------------------
# Tests: Idempotent Cleanup
# ---------------------------------------------------------------------------


class TestIdempotentCleanup:
    """cleanup_previous_run deletes existing validation_issues and validation_runs."""

    def test_cleanup_deletes_issues_first_then_runs(self):
        from app.queue.tasks import cleanup_previous_run

        mock_supabase = MagicMock()
        mock_table = MagicMock()
        mock_supabase.table.return_value = mock_table
        mock_table.delete.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.execute.return_value = MagicMock(data=[])

        cleanup_previous_run(mock_supabase, "test-dataset-id")

        # Should call table() for both validation_issues and validation_runs
        table_calls = [c[0][0] for c in mock_supabase.table.call_args_list]
        assert "validation_issues" in table_calls
        assert "validation_runs" in table_calls

        # Issues deleted before runs (FK constraint ordering)
        issues_idx = table_calls.index("validation_issues")
        runs_idx = table_calls.index("validation_runs")
        assert issues_idx < runs_idx

    def test_cleanup_uses_correct_dataset_id(self):
        from app.queue.tasks import cleanup_previous_run

        mock_supabase = MagicMock()
        mock_table = MagicMock()
        mock_supabase.table.return_value = mock_table
        mock_table.delete.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.execute.return_value = MagicMock(data=[])

        cleanup_previous_run(mock_supabase, "abc-123")

        eq_calls = mock_table.eq.call_args_list
        for c in eq_calls:
            assert c[0][0] == "dataset_id"
            assert c[0][1] == "abc-123"


# ---------------------------------------------------------------------------
# Tests: Job Persistence via InMemoryConnector
# ---------------------------------------------------------------------------


class TestJobPersisted:
    """Deferring a job via InMemoryConnector creates a job record with status todo."""

    def test_defer_creates_job(self, in_memory_app):
        test_app, connector, validate_task = in_memory_app

        async def _run():
            async with test_app.open_async():
                job_id = await validate_task.defer_async(
                    dataset_id="test-dataset-123",
                    config_json=None,
                )
                return job_id

        job_id = asyncio.get_event_loop().run_until_complete(_run())
        # In procrastinate 3.8+, defer_async returns an int (job_id)
        assert job_id is not None
        assert isinstance(job_id, int)

        # The InMemoryConnector stores jobs internally as dicts
        jobs = connector.jobs
        assert len(jobs) >= 1
        # Verify the stored job has the correct task and status
        job_data = jobs[job_id]
        assert job_data["task_name"] == "validate_dataset"
        assert job_data["status"] == "todo"


# ---------------------------------------------------------------------------
# Tests: Progress Update Format
# ---------------------------------------------------------------------------


class TestProgressUpdateFormat:
    """update_progress writes correct JSONB shape {stage, detail} to datasets."""

    def test_progress_shape(self):
        from app.queue.tasks import update_progress

        mock_supabase = MagicMock()
        mock_table = MagicMock()
        mock_supabase.table.return_value = mock_table
        mock_table.update.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.execute.return_value = MagicMock(data=[])

        update_progress(mock_supabase, "test-dataset-id", "validating", "Running check 3/7")

        mock_supabase.table.assert_called_once_with("datasets")
        mock_table.update.assert_called_once()
        update_arg = mock_table.update.call_args[0][0]
        assert "validation_progress" in update_arg
        progress = update_arg["validation_progress"]
        assert progress["stage"] == "validating"
        assert progress["detail"] == "Running check 3/7"

    def test_progress_with_empty_detail(self):
        from app.queue.tasks import update_progress

        mock_supabase = MagicMock()
        mock_table = MagicMock()
        mock_supabase.table.return_value = mock_table
        mock_table.update.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.execute.return_value = MagicMock(data=[])

        update_progress(mock_supabase, "ds-1", "downloading")

        update_arg = mock_table.update.call_args[0][0]
        progress = update_arg["validation_progress"]
        assert progress["stage"] == "downloading"
        assert progress["detail"] == ""


# ---------------------------------------------------------------------------
# Tests: Record Job Run
# ---------------------------------------------------------------------------


class TestRecordJobRun:
    """record_job_run inserts correct data into job_runs table."""

    def test_inserts_with_required_fields(self):
        from app.queue.tasks import record_job_run

        mock_supabase = MagicMock()
        mock_table = MagicMock()
        mock_supabase.table.return_value = mock_table
        mock_table.insert.return_value = mock_table
        mock_table.execute.return_value = MagicMock(data=[])

        run_id = record_job_run(mock_supabase, "ds-1", job_id=42, status="succeeded")

        assert run_id is not None
        mock_supabase.table.assert_called_once_with("job_runs")
        insert_arg = mock_table.insert.call_args[0][0]
        assert insert_arg["dataset_id"] == "ds-1"
        assert insert_arg["procrastinate_job_id"] == 42
        assert insert_arg["status"] == "succeeded"
        assert insert_arg["job_type"] == "validation"
        assert insert_arg["max_attempts"] == 3

    def test_inserts_with_error_details(self):
        from app.queue.tasks import record_job_run

        mock_supabase = MagicMock()
        mock_table = MagicMock()
        mock_supabase.table.return_value = mock_table
        mock_table.insert.return_value = mock_table
        mock_table.execute.return_value = MagicMock(data=[])

        record_job_run(
            mock_supabase, "ds-1", job_id=None, status="failed",
            error_summary="File not found", error_detail="Traceback...", duration_ms=1234,
        )

        insert_arg = mock_table.insert.call_args[0][0]
        assert insert_arg["error_summary"] == "File not found"
        assert insert_arg["error_detail"] == "Traceback..."
        assert insert_arg["duration_ms"] == 1234


# ---------------------------------------------------------------------------
# Tests: Feature Flag
# ---------------------------------------------------------------------------


class TestFeatureFlag:
    """USE_JOB_QUEUE feature flag controls queue behavior."""

    def test_feature_flag_exists(self):
        from app.queue import USE_JOB_QUEUE
        assert isinstance(USE_JOB_QUEUE, bool)

    def test_default_is_false(self):
        from app.queue import USE_JOB_QUEUE
        assert USE_JOB_QUEUE is False


# ---------------------------------------------------------------------------
# Tests: Worker Entry Point
# ---------------------------------------------------------------------------


class TestWorkerEntryPoint:
    """Worker module is importable and has main function."""

    def test_worker_module_importable(self):
        from app.queue import worker
        assert hasattr(worker, "main")

    def test_worker_main_is_callable(self):
        from app.queue.worker import main
        assert callable(main)
