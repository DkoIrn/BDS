def format_location(kp_value: float | None, row_number: int) -> str:
    """Format a location string for validation messages.

    Returns 'At KP {kp:.3f} (row {row})' when kp_value is provided,
    or 'Row {row}' when kp_value is None.
    """
    if kp_value is not None:
        return f"At KP {kp_value:.3f} (row {row_number})"
    return f"Row {row_number}"
