export function addItem(bag, id, qty) {
  const n = bag.items.get(id) ?? 0;
  bag.items.set(id, n + qty);
  return bag;
}
