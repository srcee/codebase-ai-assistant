"""Builds the monthly sales report that finance asks for."""
import csv
from collections import defaultdict
from datetime import date


def generate_sales_report(orders, output_path):
    """Writes one row per month with the number of orders and the revenue."""
    monthly = _group_by_month(orders)
    with open(output_path, "w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["month", "orders", "revenue_cents"])
        for month in sorted(monthly):
            rows = monthly[month]
            writer.writerow([month, len(rows), sum(row["total_cents"] for row in rows)])


def _group_by_month(orders):
    grouped = defaultdict(list)
    for order in orders:
        placed = date.fromisoformat(order["placed_on"])
        grouped[f"{placed.year}-{placed.month:02d}"].append(order)
    return grouped


def best_selling_skus(orders, limit=5):
    """Returns the SKUs with the most units sold, highest first."""
    totals = defaultdict(int)
    for order in orders:
        for line in order["lines"]:
            totals[line["sku"]] += line["quantity"]
    return sorted(totals, key=totals.get, reverse=True)[:limit]
