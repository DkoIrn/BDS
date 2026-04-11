"""Unit tests for dataset versioning service.

Tests snapshot creation, auto-pruning, and diff computation.
Uses mock Supabase client following established test patterns.
"""

import os
from unittest.mock import MagicMock, call, patch

import pandas as pd
import pytest


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

FIXTURE_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "version_test_data")


@pytest.fixture
def df_v1():
    """Load v1 sample CSV as DataFrame."""
    return pd.read_csv(os.path.join(FIXTURE_DIR, "v1_sample.csv"), dtype=str)


@pytest.fixture
def df_v2():
    """Load v2 sample CSV as DataFrame."""
    return pd.read_csv(os.path.join(FIXTURE_DIR, "v2_sample.csv"), dtype=str)


@pytest.fixture
def mock_supabase():
    """Create a mock Supabase client with chained table and storage methods."""
    mock = MagicMock()
    mock_table = MagicMock()
    mock.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.insert.return_value = mock_table
    mock_table.delete.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.order.return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=[])

    # Storage mock
    mock_storage_bucket = MagicMock()
    mock.storage.from_.return_value = mock_storage_bucket
    mock_storage_bucket.download.return_value = b"fake,csv\n1,2"
    mock_storage_bucket.upload.return_value = None
    mock_storage_bucket.remove.return_value = None

    return mock


# ---------------------------------------------------------------------------
# Tests: Snapshot Creation
# ---------------------------------------------------------------------------


class TestCreateSnapshot:
    """create_version_snapshot stores a version record with correct metadata."""

    def test_create_snapshot(self, mock_supabase):
        from app.services.versioning import create_version_snapshot

        mock_supabase.table.return_value.execute.return_value = MagicMock(data=[])

        create_version_snapshot(
            supabase=mock_supabase,
            dataset_id="ds-1",
            user_id="user-1",
            validation_run_id="run-1",
            issue_count=5,
            critical_count=2,
            warning_count=2,
            info_count=1,
            row_count=100,
            column_count=8,
            file_size=4096,
            storage_path="user-1/file.csv",
        )

        # Should insert into dataset_versions
        insert_calls = mock_supabase.table.return_value.insert.call_args_list
        assert len(insert_calls) >= 1
        record = insert_calls[-1][0][0]
        assert record["dataset_id"] == "ds-1"
        assert record["version_number"] == 1
        assert record["row_count"] == 100
        assert record["column_count"] == 8
        assert record["file_size"] == 4096
        assert record["issue_count"] == 5
        assert record["validation_run_id"] == "run-1"
        assert "v1_" in record["storage_path"]

    def test_create_snapshot_increments_version(self, mock_supabase):
        from app.services.versioning import create_version_snapshot

        # Simulate existing version 1
        mock_supabase.table.return_value.execute.return_value = MagicMock(
            data=[{"id": "v-1", "version_number": 1, "storage_path": "old/v1.csv"}]
        )

        create_version_snapshot(
            supabase=mock_supabase,
            dataset_id="ds-1",
            user_id="user-1",
            validation_run_id="run-2",
            issue_count=3,
            critical_count=1,
            warning_count=1,
            info_count=1,
            row_count=100,
            column_count=8,
            file_size=4096,
            storage_path="user-1/file.csv",
        )

        insert_calls = mock_supabase.table.return_value.insert.call_args_list
        record = insert_calls[-1][0][0]
        assert record["version_number"] == 2

    def test_version_issue_count(self, mock_supabase):
        from app.services.versioning import create_version_snapshot

        mock_supabase.table.return_value.execute.return_value = MagicMock(data=[])

        create_version_snapshot(
            supabase=mock_supabase,
            dataset_id="ds-1",
            user_id="user-1",
            validation_run_id="run-1",
            issue_count=10,
            critical_count=3,
            warning_count=5,
            info_count=2,
            row_count=50,
            column_count=4,
            file_size=2048,
            storage_path="user-1/file.csv",
        )

        insert_calls = mock_supabase.table.return_value.insert.call_args_list
        record = insert_calls[-1][0][0]
        breakdown = record["severity_breakdown"]
        assert breakdown["critical"] == 3
        assert breakdown["warning"] == 5
        assert breakdown["info"] == 2


# ---------------------------------------------------------------------------
# Tests: Auto-Pruning
# ---------------------------------------------------------------------------


class TestAutoPrune:
    """When 10 versions exist, creating an 11th deletes the oldest."""

    def test_auto_prune_at_limit(self, mock_supabase):
        from app.services.versioning import create_version_snapshot

        # Simulate 10 existing versions
        existing = [
            {"id": f"v-{i}", "version_number": i, "storage_path": f"old/v{i}.csv"}
            for i in range(1, 11)
        ]
        mock_supabase.table.return_value.execute.return_value = MagicMock(data=existing)

        create_version_snapshot(
            supabase=mock_supabase,
            dataset_id="ds-1",
            user_id="user-1",
            validation_run_id="run-11",
            issue_count=0,
            critical_count=0,
            warning_count=0,
            info_count=0,
            row_count=50,
            column_count=4,
            file_size=1024,
            storage_path="user-1/file.csv",
        )

        # Should have called delete for oldest version
        delete_calls = mock_supabase.table.return_value.delete.call_args_list
        assert len(delete_calls) >= 1

        # Should have called storage remove for pruned file
        remove_calls = mock_supabase.storage.from_.return_value.remove.call_args_list
        assert len(remove_calls) >= 1

    def test_version_number_after_prune(self, mock_supabase):
        from app.services.versioning import create_version_snapshot

        # Simulate versions 2-10 (version 1 was already pruned in a previous cycle)
        existing = [
            {"id": f"v-{i}", "version_number": i, "storage_path": f"old/v{i}.csv"}
            for i in range(2, 12)
        ]
        mock_supabase.table.return_value.execute.return_value = MagicMock(data=existing)

        create_version_snapshot(
            supabase=mock_supabase,
            dataset_id="ds-1",
            user_id="user-1",
            validation_run_id="run-12",
            issue_count=0,
            critical_count=0,
            warning_count=0,
            info_count=0,
            row_count=50,
            column_count=4,
            file_size=1024,
            storage_path="user-1/file.csv",
        )

        # Next version should be max(existing)+1 = 12, not len(versions)+1
        insert_calls = mock_supabase.table.return_value.insert.call_args_list
        record = insert_calls[-1][0][0]
        assert record["version_number"] == 12


# ---------------------------------------------------------------------------
# Tests: Diff Computation
# ---------------------------------------------------------------------------


class TestComputeDiff:
    """compute_version_diff computes row-level differences between DataFrames."""

    def test_compute_diff_added_rows(self, df_v1, df_v2):
        from app.services.versioning import compute_version_diff

        result = compute_version_diff(df_v1, df_v2)
        assert len(result["added"]) == 1
        added_row = result["added"][0]
        assert added_row["row"] == 6
        assert added_row["values"]["KP"] == "0.500"

    def test_compute_diff_removed_rows(self, df_v1, df_v2):
        from app.services.versioning import compute_version_diff

        # Reverse: v2 -> v1 means row 6 was removed
        result = compute_version_diff(df_v2, df_v1)
        assert len(result["removed"]) == 1
        removed_row = result["removed"][0]
        assert removed_row["row"] == 6

    def test_compute_diff_modified_rows(self, df_v1, df_v2):
        from app.services.versioning import compute_version_diff

        result = compute_version_diff(df_v1, df_v2)
        assert len(result["modified"]) == 1
        mod_row = result["modified"][0]
        assert mod_row["row"] == 2  # Row 2 (0-indexed row 1) has Depth change
        assert "Depth" in mod_row["changes"]
        assert mod_row["changes"]["Depth"]["old"] == "12.8"
        assert mod_row["changes"]["Depth"]["new"] == "12.6"

    def test_compute_diff_summary(self, df_v1, df_v2):
        from app.services.versioning import compute_version_diff

        result = compute_version_diff(df_v1, df_v2)
        summary = result["summary"]
        assert summary["rows_before"] == 5
        assert summary["rows_after"] == 6
        assert summary["added_count"] == 1
        assert summary["removed_count"] == 0
        assert summary["modified_count"] == 1
        assert summary["columns_before"] == 3
        assert summary["columns_after"] == 3

    def test_compute_diff_column_changes(self):
        from app.services.versioning import compute_version_diff

        df_old = pd.DataFrame({"A": ["1"], "B": ["2"]})
        df_new = pd.DataFrame({"A": ["1"], "C": ["3"]})

        result = compute_version_diff(df_old, df_new)
        summary = result["summary"]
        assert summary["columns_before"] == 2
        assert summary["columns_after"] == 2

        # Row 1 should show changes for removed col B and added col C
        assert len(result["modified"]) == 1
        changes = result["modified"][0]["changes"]
        assert "B" in changes  # Column removed
        assert "C" in changes  # Column added
