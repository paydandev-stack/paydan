import type { Order, VendorSubOrder } from "./types";
export function vendorGroupTotal(group: VendorSubOrder): number {
  return group.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
}

export function vendorGroupCost(group: VendorSubOrder): number {
  return group.items.reduce(
    (sum, item) => sum + item.costPrice * item.quantity,
    0,
  );
}

export function orderCost(order: Order): number {
  return order.items.reduce(
    (sum, item) => sum + item.costPrice * item.quantity,
    0,
  );
}
