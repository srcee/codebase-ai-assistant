"""Loads the supplier's product list into the catalogue."""
import csv


class ImportRejected(Exception):
    pass


def import_products_csv(path):
    """Reads a supplier file and returns catalogue entries; stops at the first bad row."""
    products = []
    with open(path, newline="") as handle:
        for line_number, row in enumerate(csv.DictReader(handle), start=2):
            if not row.get("sku"):
                raise ImportRejected(f"Row {line_number} has no SKU")
            products.append(
                {
                    "sku": row["sku"].strip(),
                    "title": row["title"].strip(),
                    "price_cents": parse_price_cell(row["price"]),
                }
            )
    return products


def parse_price_cell(cell):
    """Turns "12,50" or "12.50" into 1250 cents."""
    normalised = cell.strip().replace(",", ".")
    try:
        return round(float(normalised) * 100)
    except ValueError as error:
        raise ImportRejected(f"Price cell is not a number: {cell}") from error
