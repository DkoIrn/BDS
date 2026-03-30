"""Tests for dataset merge logic."""

import pytest

from app.parsers.base import ParseResult
from app.transforms.merge import merge_datasets


def _make_result(headers, rows):
    return ParseResult(
        headers=headers,
        rows=rows,
        total_rows=len(rows),
        metadata={},
        source_format="csv",
    )


class TestMergeDatasets:
    def test_same_columns(self):
        a = _make_result(["x", "y"], [["1", "2"], ["3", "4"]])
        b = _make_result(["x", "y"], [["5", "6"]])
        merged, warnings = merge_datasets([a, b])
        assert merged.headers == ["x", "y"]
        assert len(merged.rows) == 3
        assert merged.total_rows == 3

    def test_different_columns_union(self):
        a = _make_result(["x", "y"], [["1", "2"]])
        c = _make_result(["x", "z"], [["3", "4"]])
        merged, warnings = merge_datasets([a, c])
        assert "x" in merged.headers
        assert "y" in merged.headers
        assert "z" in merged.headers
        # Row from a should have empty z
        idx_z = merged.headers.index("z")
        assert merged.rows[0][idx_z] == ""
        # Row from c should have empty y
        idx_y = merged.headers.index("y")
        assert merged.rows[1][idx_y] == ""

    def test_single_file_warning(self):
        a = _make_result(["x"], [["1"]])
        merged, warnings = merge_datasets([a])
        assert len(warnings) > 0
        assert any("single" in w.lower() for w in warnings)
        assert merged.rows == a.rows

    def test_empty_result(self):
        a = _make_result(["x"], [])
        b = _make_result(["x"], [["1"]])
        merged, warnings = merge_datasets([a, b])
        assert len(merged.rows) == 1

    def test_preserves_column_order(self):
        a = _make_result(["a", "b", "c"], [["1", "2", "3"]])
        b = _make_result(["c", "d"], [["4", "5"]])
        merged, _ = merge_datasets([a, b])
        # First appearance order: a, b, c, d
        assert merged.headers == ["a", "b", "c", "d"]
