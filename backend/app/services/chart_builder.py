"""Chart builder service for QC PDF reports.

Generates matplotlib charts as PIL Images for embedding in PDF reports:
- Severity pie (donut) chart
- KP density scatter chart
"""

from __future__ import annotations

import io

import matplotlib
matplotlib.use("Agg")  # Headless rendering for Railway/server environments

from matplotlib.figure import Figure
from PIL import Image

# Colors matching report_builder SEVERITY_COLORS (hex equivalents)
SEVERITY_CHART_COLORS = {
    "critical": "#EF4444",  # red-500
    "warning": "#F59E0B",   # amber-500
    "info": "#3B82F6",      # blue-500
}

TITLE_COLOR = "#0F172A"  # slate-900


def generate_severity_pie(
    critical: int, warning: int, info: int
) -> Image.Image | None:
    """Generate a donut pie chart showing issue severity breakdown.

    Returns None if all counts are zero (no issues to chart).
    """
    entries = []
    colors = []
    labels = []

    for label, count, color_key in [
        ("Critical", critical, "critical"),
        ("Warning", warning, "warning"),
        ("Info", info, "info"),
    ]:
        if count > 0:
            entries.append(count)
            colors.append(SEVERITY_CHART_COLORS[color_key])
            labels.append(f"{label} ({count})")

    if not entries:
        return None

    fig = Figure(figsize=(4, 3), dpi=150)
    fig.set_facecolor("white")
    ax = fig.add_subplot(111)

    ax.pie(
        entries,
        labels=labels,
        colors=colors,
        autopct="%1.0f%%",
        wedgeprops={"width": 0.6},
        textprops={"fontsize": 8},
    )
    ax.set_title(
        "Issue Severity Breakdown",
        fontsize=10,
        fontweight="bold",
        color=TITLE_COLOR,
        pad=10,
    )

    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", facecolor="white")
    buf.seek(0)
    img = Image.open(buf).convert("RGB").copy()
    buf.close()
    del fig

    return img


def generate_kp_density_chart(
    issues: list[dict],
) -> Image.Image | None:
    """Generate a scatter plot showing issue density along KP axis.

    Returns None if no issues have kp_value fields.
    """
    kp_values = []
    severity_colors = []

    for issue in issues:
        kp = issue.get("kp_value")
        if kp is None:
            continue
        try:
            kp_float = float(kp)
        except (ValueError, TypeError):
            continue
        kp_values.append(kp_float)
        sev = issue.get("severity", "info")
        severity_colors.append(SEVERITY_CHART_COLORS.get(sev, SEVERITY_CHART_COLORS["info"]))

    if not kp_values:
        return None

    fig = Figure(figsize=(6, 3), dpi=150)
    fig.set_facecolor("white")
    ax = fig.add_subplot(111)

    ax.scatter(kp_values, [0.5] * len(kp_values), c=severity_colors, alpha=0.6, s=30, edgecolors="none")

    ax.set_xlabel("KP (km)", fontsize=9)
    ax.set_title(
        "Issue Density Along KP",
        fontsize=10,
        fontweight="bold",
        color=TITLE_COLOR,
        pad=10,
    )

    # Hide y-axis (density strip only)
    ax.get_yaxis().set_visible(False)
    ax.set_ylim(0, 1)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_visible(False)

    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", facecolor="white")
    buf.seek(0)
    img = Image.open(buf).convert("RGB").copy()
    buf.close()
    del fig

    return img
