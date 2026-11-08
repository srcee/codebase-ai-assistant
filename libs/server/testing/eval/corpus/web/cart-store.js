const cart = new Map();

export function addToCart(sku, unitPriceCents, quantity = 1) {
  const existing = cart.get(sku);
  const nextQuantity = (existing ? existing.quantity : 0) + quantity;
  cart.set(sku, { sku, unitPriceCents, quantity: nextQuantity });
  return nextQuantity;
}

export function removeFromCart(sku) {
  return cart.delete(sku);
}

/** The price shown at the bottom of the basket, before tax and shipping. */
export function cartTotal() {
  let total = 0;
  for (const line of cart.values()) {
    total += line.unitPriceCents * line.quantity;
  }
  return total;
}

export function clearCart() {
  cart.clear();
}
