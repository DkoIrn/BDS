"""CRS coordinate transformation using pyproj."""

from __future__ import annotations

from dataclasses import dataclass, field, replace

from pyproj import Transformer

from app.parsers.base import ParseResult
from app.writers._coords import LON_NAMES, LAT_NAMES, find_column


def transform_crs(
    result: ParseResult, source_epsg: int, target_epsg: int
) -> tuple[ParseResult, list[str]]:
    """Transform coordinates in a ParseResult from one CRS to another.

    Uses always_xy=True so column order is (x/lon, y/lat).
    Returns a new ParseResult with transformed coordinates and a list of warnings.
    """
    warnings: list[str] = []

    x_idx = find_column(result.headers, LON_NAMES)
    y_idx = find_column(result.headers, LAT_NAMES)

    if x_idx is None or y_idx is None:
        warnings.append(
            "No coordinate columns found -- returned original data unchanged"
        )
        return result, warnings

    transformer = Transformer.from_crs(
        source_epsg, target_epsg, always_xy=True
    )

    new_rows: list[list[str]] = []
    for row_idx, row in enumerate(result.rows):
        new_row = list(row)  # shallow copy
        try:
            x_in = float(row[x_idx])
            y_in = float(row[y_idx])
            x_out, y_out = transformer.transform(x_in, y_in)
            new_row[x_idx] = str(round(x_out, 6))
            new_row[y_idx] = str(round(y_out, 6))
        except (ValueError, TypeError) as exc:
            warnings.append(
                f"Row {row_idx + 1}: could not transform coordinates ({exc})"
            )
        new_rows.append(new_row)

    transformed = ParseResult(
        headers=list(result.headers),
        rows=new_rows,
        total_rows=result.total_rows,
        metadata=dict(result.metadata),
        warnings=list(result.warnings) + warnings,
        source_format=result.source_format,
    )
    return transformed, warnings
