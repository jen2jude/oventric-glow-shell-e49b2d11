const RECENT_PRODUCTS_KEY = "oventric:recent-products";
const MAX_RECENT_PRODUCTS = 12;

export function readRecentProductIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_PRODUCTS_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0).slice(0, MAX_RECENT_PRODUCTS);
  } catch {
    return [];
  }
}

export function rememberRecentProduct(productId: string): void {
  if (typeof window === "undefined" || !productId) return;
  const next = [productId, ...readRecentProductIds().filter((id) => id !== productId)].slice(
    0,
    MAX_RECENT_PRODUCTS,
  );
  window.localStorage.setItem(RECENT_PRODUCTS_KEY, JSON.stringify(next));
}