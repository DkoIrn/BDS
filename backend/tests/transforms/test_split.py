"""Tests for dataset split logic."""

import pytest

from app.parsers.base import ParseResult
from app.transforms.split import split_by_kp, split_by_column


def _make_result(headers, rows):
    return ParseResult(
        headers=headers,
        rows=rows,
        total_rows=len(rows),
        metadata={},
        source_format="csv",
    )


class TestSplitByKp:
    def test_basic_kp_split(self):
        result = _make_result(
            ["kp", "depth"],
            [["1.0", "5"], ["3.0", "6"], ["6.0", "7"], ["8.0", "8"]],
        )
        splits, warnings = split_by_kp(result, [(0, 5), (5, 10)])
        assert len(splits) == 2
        label_0, part_0 = splits[0]
        label_1, part_1 = splits[1]
        assert len(part_0.rows) == 2  # kp 1.0, 3.0
        assert len(part_1.rows) == 2  # kp 6.0, 8.0

    def test_no_kp_column(self):
        result = _make_result(["name", "value"], [["A", "1"]])
        splits, warnings = split_by_kp(result, [(0, 5)])
        assert len(splits) == 0
        assert any("kp" in w.lower() or "column" in w.lower() for w in warnings)

    def test_kp_range_labels(self):
        result = _make_result(["kp"], [["2.0"], ["7.0"]])
        splits, warnings = split_by_kp(result, [(0, 5), (5, 10)])
        labels = [label for label, _ in splits]
        assert "KP_0_5" in labels[0] or "KP_0.0_5.0" in labels[0]

    def test_empty_range(self):
        result = _make_result(["kp"], [["2.0"]])
        splits, warnings = split_by_kp(result, [(5, 10)])
        # Range (5,10) has no rows, so empty result
        assert len(splits) == 1
        assert len(splits[0][1].rows) == 0


class TestSplitByColumn:
    def test_basic_column_split(self):
        result = _make_result(
            ["survey_type", "value"],
            [["DOB", "1"], ["DOC", "2"], ["DOB", "3"]],
        )
        splits, warnings = split_by_column(result, "survey_type")
        assert len(splits) == 2
        # Find DOB group
        dob_parts = [p for label, p in splits if label == "DOB"]
        assert len(dob_parts) == 1
        assert len(dob_parts[0].rows) == 2

    def test_missing_column(self):
        result = _make_result(["name"], [["A"]])
        splits, warnings = split_by_column(result, "nonexistent")
        assert len(splits) == 0
        assert len(warnings) > 0

    def test_empty_values_skipped(self):
        result = _make_result(
            ["type", "val"],
            [["A", "1"], ["", "2"], ["A", "3"]],
        )
        splits, warnings = split_by_column(result, "type")
        labels = [label for label, _ in splits]
        assert "" not in labels
        assert any("skip" in w.lower() or "empty" in w.lower() for w in warnings)

    def test_preserves_headers(self):
        result = _make_result(
            ["group", "x", "y"],
            [["A", "1", "2"], ["B", "3", "4"]],
        )
        splits, _ = split_by_column(result, "group")
        for _, part in splits:
            assert part.headers == ["group", "x", "y"]
