"""Dataset comparison -- row-by-row diff with tolerance thresholds."""

from dataclasses import dataclass, field
from app.parsers.base import ParseResult


@dataclass
class CompareResult:
    """Result of comparing two datasets."""

    headers: list[str]
    matched_rows: list[dict]
    mismatched_rows: list[dict]
    only_in_base: list[list[str]]
    only_in_compare: list[list[str]]
    summary: dict
    warnings: list[str] = field(default_factory=list)


def _try_float(val: str) -> float | None:
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def compare_datasets(
    base: ParseResult,
    compare: ParseResult,
    key_columns: list[str],
    tolerance: float = 0.0,
    compare_columns: list[str] | None = None,
) -> CompareResult:
    """Compare two parsed datasets row-by-row using key columns for matching.

    Args:
        base: The reference/as-designed dataset.
        compare: The as-built dataset to compare against.
        key_columns: Column names to use as row identifiers for matching.
        tolerance: Numeric tolerance for float comparisons (absolute difference).
        compare_columns: Specific columns to compare. If None, compare all shared columns.

    Returns:
        CompareResult with matched, mismatched, and unmatched rows.
    """
    warnings: list[str] = []

    # Validate key columns exist in both datasets
    for col in key_columns:
        if col not in base.headers:
            raise ValueError(f"Key column '{col}' not found in base dataset. Available: {base.headers}")
        if col not in compare.headers:
            raise ValueError(f"Key column '{col}' not found in compare dataset. Available: {compare.headers}")

    # Determine columns to compare
    shared_cols = [h for h in base.headers if h in compare.headers and h not in key_columns]
    if compare_columns:
        missing = [c for c in compare_columns if c not in shared_cols]
        if missing:
            warnings.append(f"Requested compare columns not in both datasets: {missing}")
        cols_to_compare = [c for c in compare_columns if c in shared_cols]
    else:
        cols_to_compare = shared_cols

    if not cols_to_compare:
        warnings.append("No shared columns to compare (besides key columns)")

    # Build index maps
    base_col_idx = {h: i for i, h in enumerate(base.headers)}
    comp_col_idx = {h: i for i, h in enumerate(compare.headers)}

    # Index compare rows by key
    def make_key(row: list[str], col_idx: dict[str, int]) -> str:
        return "|".join(row[col_idx[k]] for k in key_columns)

    comp_index: dict[str, list[list[str]]] = {}
    for row in compare.rows:
        key = make_key(row, comp_col_idx)
        comp_index.setdefault(key, []).append(row)

    matched_rows: list[dict] = []
    mismatched_rows: list[dict] = []
    only_in_base: list[list[str]] = []
    used_comp_keys: set[str] = set()

    for base_row in base.rows:
        key = make_key(base_row, base_col_idx)
        comp_rows = comp_index.get(key)

        if not comp_rows:
            only_in_base.append(base_row)
            continue

        used_comp_keys.add(key)
        comp_row = comp_rows[0]  # Use first match

        # Compare columns
        diffs: dict[str, dict] = {}
        has_diff = False

        for col in cols_to_compare:
            base_val = base_row[base_col_idx[col]]
            comp_val = comp_row[comp_col_idx[col]]

            base_float = _try_float(base_val)
            comp_float = _try_float(comp_val)

            if base_float is not None and comp_float is not None:
                diff = abs(base_float - comp_float)
                is_match = diff <= tolerance
                diffs[col] = {
                    "base": base_val,
                    "compare": comp_val,
                    "diff": round(diff, 6),
                    "match": is_match,
                }
                if not is_match:
                    has_diff = True
            else:
                is_match = base_val.strip() == comp_val.strip()
                diffs[col] = {
                    "base": base_val,
                    "compare": comp_val,
                    "diff": None,
                    "match": is_match,
                }
                if not is_match:
                    has_diff = True

        row_result = {
            "key": {k: base_row[base_col_idx[k]] for k in key_columns},
            "columns": diffs,
        }

        if has_diff:
            mismatched_rows.append(row_result)
        else:
            matched_rows.append(row_result)

    # Find rows only in compare
    only_in_compare: list[list[str]] = []
    for key, rows in comp_index.items():
        if key not in used_comp_keys:
            only_in_compare.extend(rows)

    total_compared = len(matched_rows) + len(mismatched_rows)
    match_pct = round((len(matched_rows) / total_compared * 100), 1) if total_compared > 0 else 0.0

    summary = {
        "base_rows": base.total_rows,
        "compare_rows": compare.total_rows,
        "matched": len(matched_rows),
        "mismatched": len(mismatched_rows),
        "only_in_base": len(only_in_base),
        "only_in_compare": len(only_in_compare),
        "match_percentage": match_pct,
        "tolerance": tolerance,
        "key_columns": key_columns,
        "compared_columns": cols_to_compare,
    }

    # Build unified header list
    all_headers = list(key_columns) + cols_to_compare

    return CompareResult(
        headers=all_headers,
        matched_rows=matched_rows,
        mismatched_rows=mismatched_rows,
        only_in_base=only_in_base,
        only_in_compare=only_in_compare,
        summary=summary,
        warnings=warnings,
    )
