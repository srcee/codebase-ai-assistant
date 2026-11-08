export interface Warehouse {
  id: string;
  latitude: number;
  longitude: number;
  stock: Record<string, number>;
}

const EARTH_RADIUS_KM = 6371;

/** Picks the closest warehouse that holds every item of the order. */
export function chooseWarehouse(
  warehouses: Warehouse[],
  items: Record<string, number>,
  destination: { latitude: number; longitude: number },
): Warehouse | undefined {
  return warehouses
    .filter((warehouse) =>
      Object.entries(items).every(
        ([sku, quantity]) => (warehouse.stock[sku] ?? 0) >= quantity,
      ),
    )
    .sort(
      (a, b) =>
        distanceKm(a, destination) - distanceKm(b, destination),
    )[0];
}

export function distanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}
