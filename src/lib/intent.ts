export type ShoppingIntent = {
  id: string;
  path: string;
  productId?: string;
  variantId?: string;
  quantity?: number;
  createdAt: number;
};
const key = "paydan-shopping-intent-v2";
export function safePath(value: string | null): string {
  return value &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !/[\\\u0000-\u001f]/.test(value) &&
    !value.startsWith("/api/")
    ? value
    : "/shop";
}
export function rememberIntent(
  input: Omit<ShoppingIntent, "id" | "createdAt">,
) {
  const value = {
    ...input,
    path: safePath(input.path),
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  localStorage.setItem(key, JSON.stringify(value));
  return value;
}
export function readIntent(): ShoppingIntent | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    if (
      !value ||
      typeof value.id !== "string" ||
      Date.now() - value.createdAt > 86400000
    )
      return null;
    return { ...value, path: safePath(value.path) };
  } catch {
    return null;
  }
}
export function clearIntent() {
  localStorage.removeItem(key);
}
