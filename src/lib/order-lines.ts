import type { Order, OrderItem } from "./types";

export function orderLineId(order: Pick<Order, "id">, index: number) {
  return `line-${order.id}-${index + 1}`;
}

export function normalizedOrderItems(order: Order): OrderItem[] {
  return order.items.map((item, index) => ({
    ...item,
    lineId: item.lineId || orderLineId(order, index),
  }));
}

export function findOrderLine(order: Order, lineId: string) {
  return normalizedOrderItems(order).find((item) => item.lineId === lineId);
}
