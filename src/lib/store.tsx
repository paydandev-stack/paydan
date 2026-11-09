"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type {
  Address,
  AdminRole,
  Banner,
  CartLine,
  Category,
  DemoState,
  Order,
  OrderItem,
  PaymentStatus,
  Product,
  ProcurementStage,
  Quote,
  ReturnRequest,
  ShippingZone,
  SourcingRequest,
  SourcingStatus,
  StoreSettings,
  TeamMember,
  Vendor,
  FulfillmentStatus,
  Voucher,
} from "./types";
import { emptyState } from "./empty-state";
import { api, publicApi } from "./api-client";
import { rememberIntent } from "./intent";
type PlaceOrderInput = {
  customerName: string;
  email: string;
  phone: string;
  address: Omit<Address, "id" | "isDefault">;
  deliveryFee: number;
  discount: number;
  paymentMethod: "paystack" | "transfer";
  notes: string;
  saveAddress: boolean;
};

type SourcingInput = {
  images?: string[];
  customerName: string;
  email: string;
  phone: string;
  productName: string;
  categorySlug: string;
  description: string;
  quantity: number;
  budget?: number;
  city: string;
  state: string;
};

type Actions = {
  addToCart: (productId: string, variantId: string, quantity?: number) => void;
  setQuantity: (productId: string, variantId: string, quantity: number) => void;
  removeLine: (productId: string, variantId: string) => void;
  undoRemove: () => void;
  clearCart: () => void;
  saveForLater: (productId: string, variantId: string) => void;
  moveToCart: (productId: string, variantId: string) => void;
  toggleWishlist: (productId: string) => void;
  placeOrder: (input: PlaceOrderInput) => Promise<Order>;
  updateOrderStatus: (
    orderId: string,
    patch: {
      paymentStatus?: PaymentStatus;
      fulfillmentStatus?: FulfillmentStatus;
      notes?: string;
    },
  ) => void;
  updateVendorStage: (
    orderId: string,
    groupId: string,
    stage: ProcurementStage,
    note?: string,
  ) => void;
  cancelOrder: (orderId: string) => void;
  saveProduct: (product: Product) => void;
  setProductStatus: (productId: string, status: Product["status"]) => void;
  saveVendor: (vendor: Vendor) => void;
  updateCategory: (
    slug: string,
    patch: Partial<
      Pick<
        Category,
        | "name"
        | "title"
        | "description"
        | "order"
        | "active"
        | "restricted"
        | "facets"
        | "subcategories"
      >
    >,
  ) => void;
  updateShippingZone: (
    id: string,
    patch: Partial<Pick<ShippingZone, "fee" | "eta" | "active">>,
  ) => void;
  updateSourcing: (
    id: string,
    patch: Partial<Pick<SourcingRequest, "adminNotes" | "assignee" | "status">>,
  ) => void;
  saveVoucher: (voucher: Voucher) => void;
  toggleVoucher: (code: string) => void;
  addTeamMember: (member: Omit<TeamMember, "id">) => void;
  submitSourcing: (input: SourcingInput) => Promise<string>;
  setSourcingStatus: (id: string, status: SourcingStatus) => void;
  saveQuote: (id: string, quote: Quote) => void;
  sendQuote: (id: string) => void;
  respondToQuote: (id: string, response: "accepted" | "declined") => void;
  convertQuoteToOrder: (id: string) => string;
  saveBanner: (banner: Banner) => void;
  toggleBanner: (id: string) => void;
  updateCustomer: (
    id: string,
    patch: {
      name?: string;
      email?: string;
      phone?: string;
      city?: string;
      state?: string;
      notes?: string;
    },
  ) => void;
  addAddress: (address: Omit<Address, "id">) => void;
  updateAddress: (id: string, patch: Partial<Omit<Address, "id">>) => void;
  removeAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;
  createReturn: (input: {
    orderId: string;
    productId: string;
    quantity: number;
    reason: string;
    detail: string;
    images?: string[];
  }) => Promise<ReturnRequest>;
  signInCustomer: (name: string, email: string) => void;
  signOutCustomer: () => void;
  signInAdmin: (role?: AdminRole) => void;
  signOutAdmin: () => void;
  setLocation: (location: { state: string; city: string }) => void;
  updateSettings: (patch: Partial<StoreSettings>) => void;
  updateTeamMember: (id: string, patch: Partial<TeamMember>) => void;
  notify: (
    message: string,
    tone?: "success" | "error" | "info",
    extra?: {
      actionLabel?: string;
      actionHref?: string;
      action?: "undo-remove";
    },
  ) => void;
  dismissToast: (id: string) => void;
  resetDemo: () => void;
};

type StoreValue = {
  state: DemoState;
  hydrated: boolean;
  actions: Actions;
  refresh: () => Promise<void>;
};
const DemoContext = createContext<StoreValue | null>(null);
export function DemoProvider({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState: DemoState;
}) {
  const [state, setState] = useState(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState("");
  const pathname = usePathname();
  const scope = pathname.startsWith("/admin") ? "admin" : "customer";
  const [loadedScope, setLoadedScope] = useState(scope);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const requestVersion = useRef(0);
  const lastRemoved = useRef<CartLine | null>(null);
  const notify = useCallback<Actions["notify"]>(
    (message, tone = "success", extra) =>
      setState((s) => ({
        ...s,
        toasts: [
          ...s.toasts,
          { id: crypto.randomUUID(), message, tone, ...extra },
        ],
      })),
    [],
  );
  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const response = await api<DemoState | { guest: true }>(
        "/api/store?scope=" + scopeRef.current,
      );
      const next =
        "guest" in response
          ? await publicApi<DemoState>("/api/catalog")
          : response;
      if (version === requestVersion.current) {
        setState((current) => ({ ...next, toasts: current.toasts }));
        setError("");
        setLoadedScope(scopeRef.current);
      }
    } catch (error) {
      if (version === requestVersion.current)
        setError(error instanceof Error ? error.message : "Unable to refresh.");
    } finally {
      setHydrated(true);
    }
  }, []);
  useEffect(() => {
    localStorage.removeItem("paydan-demo-v1");
    localStorage.removeItem("paydan-ask-v1");
    setState((s) => ({
      ...emptyState(),
      products: s.products,
      categories: s.categories,
      banners: s.banners,
      settings: s.settings,
      toasts: s.toasts,
    }));
    void refresh();
  }, [scope, refresh]);
  useEffect(() => {
    const reload = () => void refresh();
    window.addEventListener("focus", reload);
    window.addEventListener("paydan-refresh", reload);
    return () => {
      window.removeEventListener("focus", reload);
      window.removeEventListener("paydan-refresh", reload);
    };
  }, [refresh]);
  const run = useCallback(
    async (name: string, args: unknown[], key = crypto.randomUUID()) => {
      setPending((n) => n + 1);
      try {
        const response = await api<{ result: unknown }>("/api/commands", {
          name,
          args,
          key,
        });
        await refresh();
        return response.result;
      } catch (error) {
        notify(
          error instanceof Error ? error.message : "Unable to save.",
          "error",
        );
        throw error;
      } finally {
        setPending((n) => n - 1);
      }
    },
    [refresh, notify],
  );
  useEffect(() => {
    const channel = new BroadcastChannel("paydan-auth");
    channel.onmessage = () => {
      setState(emptyState());
      sessionStorage.removeItem("paydan-chat-v2");
      void refresh();
    };
    return () => channel.close();
  }, [refresh]);
  const actions = useMemo(() => {
    const result: Record<string, unknown> = {};
    const names = [
      "addToCart",
      "setQuantity",
      "removeLine",
      "undoRemove",
      "clearCart",
      "saveForLater",
      "moveToCart",
      "toggleWishlist",
      "placeOrder",
      "updateOrderStatus",
      "updateVendorStage",
      "cancelOrder",
      "saveProduct",
      "setProductStatus",
      "saveVendor",
      "updateCategory",
      "updateShippingZone",
      "updateSourcing",
      "saveVoucher",
      "toggleVoucher",
      "addTeamMember",
      "submitSourcing",
      "setSourcingStatus",
      "saveQuote",
      "sendQuote",
      "respondToQuote",
      "convertQuoteToOrder",
      "saveBanner",
      "toggleBanner",
      "updateCustomer",
      "addAddress",
      "updateAddress",
      "removeAddress",
      "setDefaultAddress",
      "createReturn",
      "signInCustomer",
      "signOutCustomer",
      "signInAdmin",
      "signOutAdmin",
      "setLocation",
      "updateSettings",
      "updateTeamMember",
      "notify",
      "dismissToast",
      "resetDemo",
    ];
    for (const name of names)
      result[name] = (...args: unknown[]) => run(name, args);
    for (const name of [
      "placeOrder",
      "submitSourcing",
      "convertQuoteToOrder",
      "createReturn",
    ])
      result[name] = (...args: unknown[]) => run(name, args);
    result.notify = notify;
    result.dismissToast = (id: string) =>
      setState((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) }));
    result.signInCustomer = result.signInAdmin = () =>
      location.assign("/login");
    result.signOutCustomer = result.signOutAdmin = async () => {
      try {
        await api("/api/auth/sign-out", {});
        const channel = new BroadcastChannel("paydan-auth");
        channel.postMessage("changed");
        channel.close();
        localStorage.removeItem("paydan-shopping-intent-v2");
        sessionStorage.removeItem("paydan-chat-v2");
        setState(emptyState());
        location.assign("/");
      } catch (error) {
        notify(
          error instanceof Error ? error.message : "Sign out failed.",
          "error",
        );
      }
    };
    result.resetDemo = () =>
      notify("Demo state has been replaced with your secure account.", "info");
    result.addToCart = (productId: string, variantId: string, quantity = 1) => {
      if (!state.customerSession) {
        rememberIntent({ productId, variantId, quantity, path: "/cart" });
        location.assign("/login");
        return;
      }
      void run("addToCart", [productId, variantId, quantity])
        .then(() => notify("Added to your cart"))
        .catch(() => {});
    };
    result.removeLine = (productId: string, variantId: string) => {
      lastRemoved.current =
        state.cart.find(
          (l) => l.productId === productId && l.variantId === variantId,
        ) ?? null;
      void run("removeLine", [productId, variantId])
        .then(() =>
          notify("Item removed", "info", {
            actionLabel: "Undo",
            action: "undo-remove",
          }),
        )
        .catch(() => {});
    };
    result.undoRemove = () => {
      const line = lastRemoved.current;
      if (line) {
        lastRemoved.current = null;
        void run("addToCart", [
          line.productId,
          line.variantId,
          line.quantity,
        ]).catch(() => {});
      }
    };
    result.setLocation = (value: { state: string; city: string }) => {
      if (state.customerSession)
        void run("setLocation", [value]).catch(() => {});
      else setState((s) => ({ ...s, location: value }));
    };
    result.toggleWishlist = (id: string) => {
      if (!state.customerSession) {
        rememberIntent({ path: "/account/wishlist" });
        location.assign("/login");
        return;
      }
      void run("toggleWishlist", [id]).catch(() => {});
    };
    return result as unknown as Actions;
  }, [notify, run, state.customerSession, state.cart]);
  return (
    <DemoContext.Provider
      value={{
        state,
        hydrated: hydrated && loadedScope === scope,
        actions,
        refresh,
      }}
    >
      {pending > 0 && (
        <div
          className="pending-indicator"
          role="status"
          aria-label="Saving changes"
        />
      )}
      {error && (
        <div className="service-notice" role="status">
          {error} <button onClick={() => void refresh()}>Retry</button>
        </div>
      )}
      {children}
    </DemoContext.Provider>
  );
}
export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error("Store provider is missing.");
  return value;
}
