"""Dataset merge -- combine multiple ParseResults into one."""

from __future__ import annotations

from app.parsers.base import ParseResult


def merge_datasets(
    results: list[ParseResult],
) -> tuple[ParseResult, list[str]]:
    """Merge multiple ParseResults with union columns and missing-value padding.

    Column order preserves first-appearance order across all inputs.
    Missing values are filled with empty string.
    """
    warnings: list[str] = []

    if not results:
        return ParseResult(
            headers=[], rows=[], total_rows=0, metadata={}, source_format=""
        ), ["No datasets provided"]

    if len(results) == 1:
        warnings.append("Single file provided -- returned unchanged")
        return results[0], warnings

    # Build unified header list preserving first-appearance order
    unified: list[str] = []
    seen: set[str] = set()
    for r in results:
        for h in r.headers:
            key = h.lower()
            if key not in seen:
                seen.add(key)
                unified.append(h)

    # Map each result's rows to the unified header layout
    merged_rows: list[list[str]] = []
    for r in results:
        # Build column index mapping for this result
        col_map: dict[str, int] = {}
        for i, h in enumerate(r.headers):
            col_map[h.lower()] = i

        for row in r.rows:
            new_row: list[str] = []
            for uh in unified:
                src_idx = col_map.get(uh.lower())
                if src_idx is not None and src_idx < len(row):
                    new_row.append(row[src_idx])
                else:
                    new_row.append("")
            merged_rows.append(new_row)

    total = sum(r.total_rows for r in results)

    merged = ParseResult(
        headers=unified,
        rows=merged_rows,
        total_rows=total,
        metadata={},
        source_format=results[0].source_format,
    )
    return merged, warnings
