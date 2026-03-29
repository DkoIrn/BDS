"""CSV writer -- converts ParseResult to CSV bytes."""

import csv
import io

from app.parsers.base import ParseResult


def write_csv(result: ParseResult) -> tuple[bytes, list[str]]:
    """Convert a ParseResult to CSV bytes.

    Returns:
        Tuple of (csv_bytes, warnings). Warnings list is always empty for CSV.
    """
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(result.headers)
    for row in result.rows:
        writer.writerow(row)
    return buf.getvalue().encode("utf-8"), []
