"""Dataset split -- split a ParseResult by KP range or column value."""

from __future__ import annotations

from app.parsers.base import ParseResult
from app.writers._coords import find_column

KP_NAMES = {"kp", "chainage", "sta", "station", "km_post"}


def split_by_kp(
    result: ParseResult, ranges: list[tuple[float, float]]
) -> tuple[list[tuple[str, ParseResult]], list[str]]:
    """Split dataset by KP (chainage) ranges.

    Each range is [start, end) -- inclusive start, exclusive end.
    Returns list of (label, ParseResult) pairs and warnings.
    """
    warnings: list[str] = []

    kp_idx = find_column(result.headers, KP_NAMES)
    if kp_idx is None:
        warnings.append(
            "No KP/chainage column found -- cannot split by KP range"
        )
        return [], warnings

    splits: list[tuple[str, ParseResult]] = []
    for start, end in ranges:
        label = f"KP_{start}_{end}"
        subset: list[list[str]] = []
        for row in result.rows:
            try:
                kp_val = float(row[kp_idx])
            except (ValueError, TypeError, IndexError):
                continue
            if start <= kp_val < end:
                subset.append(row)

        part = ParseResult(
            headers=list(result.headers),
            rows=subset,
            total_rows=len(subset),
            metadata=dict(result.metadata),
            source_format=result.source_format,
        )
        splits.append((label, part))

    return splits, warnings


def split_by_column(
    result: ParseResult, column_name: str
) -> tuple[list[tuple[str, ParseResult]], list[str]]:
    """Split dataset by unique values in a named column.

    Empty/null values are skipped with a warning.
    Returns list of (value_label, ParseResult) pairs and warnings.
    """
    warnings: list[str] = []

    # Find column index by name (case-insensitive)
    col_idx: int | None = None
    for i, h in enumerate(result.headers):
        if h.strip().lower() == column_name.strip().lower():
            col_idx = i
            break

    if col_idx is None:
        warnings.append(f"Column '{column_name}' not found in headers")
        return [], warnings

    # Group rows by column value
    groups: dict[str, list[list[str]]] = {}
    empty_count = 0
    for row in result.rows:
        val = row[col_idx].strip() if col_idx < len(row) else ""
        if not val:
            empty_count += 1
            continue
        groups.setdefault(val, []).append(row)

    if empty_count > 0:
        warnings.append(
            f"Skipped {empty_count} row(s) with empty values in '{column_name}'"
        )

    splits: list[tuple[str, ParseResult]] = []
    for val, rows in groups.items():
        part = ParseResult(
            headers=list(result.headers),
            rows=rows,
            total_rows=len(rows),
            metadata=dict(result.metadata),
            source_format=result.source_format,
        )
        splits.append((val, part))

    return splits, warnings
