"""Tests for CSV writer -- converts ParseResult to CSV bytes."""

import csv
import io

from app.parsers.base import ParseResult
from app.writers.csv_writer import write_csv


def _make_result(headers: list[str], rows: list[list[str]]) -> ParseResult:
    return ParseResult(
        headers=headers,
        rows=rows,
        total_rows=len(rows),
        metadata={},
        source_format="test",
    )


def test_basic_conversion():
    result = _make_result(["a", "b"], [["1", "2"], ["3", "4"]])
    out_bytes, warnings = write_csv(result)
    assert warnings == []
    reader = csv.reader(io.StringIO(out_bytes.decode("utf-8")))
    rows = list(reader)
    assert rows[0] == ["a", "b"]
    assert rows[1] == ["1", "2"]
    assert rows[2] == ["3", "4"]


def test_empty_rows():
    result = _make_result(["x", "y"], [])
    out_bytes, warnings = write_csv(result)
    reader = csv.reader(io.StringIO(out_bytes.decode("utf-8")))
    rows = list(reader)
    assert len(rows) == 1
    assert rows[0] == ["x", "y"]


def test_special_characters():
    result = _make_result(["name", "value"], [["hello, world", 'say "hi"'], ["line\nnewline", "normal"]])
    out_bytes, warnings = write_csv(result)
    reader = csv.reader(io.StringIO(out_bytes.decode("utf-8")))
    rows = list(reader)
    assert rows[1][0] == "hello, world"
    assert rows[1][1] == 'say "hi"'
    assert rows[2][0] == "line\nnewline"
