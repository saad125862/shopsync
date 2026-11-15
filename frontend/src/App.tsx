import {
  Banner,
  BlockStack,
  Frame,
  Icon,
  Navigation,
  Text,
  TopBar,
} from "@shopify/polaris";
import {
  ChartVerticalIcon,
  HomeIcon,
  NotificationIcon,
  OrderIcon,
  ProductIcon,
  RefreshIcon,
  SettingsIcon,
} from "@shopify/polaris-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { api, installRedirectUrl, type Overview, type SearchResults } from "./api";
import { ProductThumb } from "./components/ProductThumb";
import { ToastProvider } from "./hooks/useToast";
import { hasCredentials, isDemo, isEmbedded, logout } from "./lib/auth";
import Alerts from "./pages/Alerts";
import Analytics from "./pages/Analytics";
import Connect from "./pages/Connect";
import Home from "./pages/Home";
import Inventory from "./pages/Inventory";
import Orders from "./pages/Orders";
import ProductDetailPage from "./pages/ProductDetail";
import Products from "./pages/Products";
import SettingsPage from "./pages/SettingsPage";
import SyncLogs from "./pages/SyncLogs";

const CHORDS: Record<string, string> = {
  h: "/",
  o: "/orders",
  p: "/products",
  i: "/inventory",
  a: "/analytics",
  s: "/settings",
};

function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Shopify opens the app URL with ?shop&hmac when installing: hand that to the API's OAuth step. */
function shopifyLaunchUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  if (!params.get("shop") || !params.get("hmac")) return null;
  return installRedirectUrl(window.location.search);
}

export default function App() {
  const [authed, setAuthed] = useState(hasCredentials());
  const launch = authed ? null : shopifyLaunchUrl();
  useEffect(() => {
    if (launch) window.location.replace(launch);
  }, [launch]);
  if (launch) return null;
  if (!authed) return <Connect onDone={() => setAuthed(true)} />;
  return <Shell onLogout={() => setAuthed(false)} />;
}

function Shell({ onLogout }: { onLogout: () => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const searchBox = useRef<HTMLDivElement>(null);
  const debounced = useDebounced(search);

  const overview = useQuery({
    queryKey: ["overview", 30],
    queryFn: () => api<Overview>("/api/overview?days=30"),
    staleTime: 30_000,
  });
  const results = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => api<SearchResults>(`/api/search?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.trim().length >= 2,
  });

  const go = useCallback(
    (path: string) => {
      setSearchOpen(false);
      setSearch("");
      setMobileNav(false);
      nav(path);
    },
    [nav],
  );

  // Keyboard: "/" or Ctrl/Cmd+K focuses search; "g" then a letter jumps to a page.
  useEffect(() => {
    let chord = 0;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable;
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        searchBox.current?.querySelector("input")?.focus();
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "g") {
        chord = Date.now();
      } else if (chord && Date.now() - chord < 1200 && CHORDS[e.key]) {
        chord = 0;
        nav(CHORDS[e.key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav]);

  const o = overview.data;
  const alertCount = (o?.low_stock ?? 0) + (o?.out_of_stock ?? 0);

  const topBar = (
    <TopBar
      showNavigationToggle
      onNavigationToggle={() => setMobileNav((v) => !v)}
      searchField={
        <div ref={searchBox} style={{ width: "100%" }}>
          <TopBar.SearchField
            placeholder="Search products, SKUs, orders  ( / )"
            value={search}
            onChange={(v) => {
              setSearch(v);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onCancel={() => {
              setSearch("");
              setSearchOpen(false);
            }}
          />
        </div>
      }
      searchResultsVisible={searchOpen && search.trim().length >= 2}
      onSearchResultsDismiss={() => setSearchOpen(false)}
      searchResults={
        <div style={{ padding: 12, minWidth: 320 }}>
          <BlockStack gap="300">
            {results.isLoading && <Text as="p" tone="subdued">Searching...</Text>}
            {results.data && !results.data.products.length && !results.data.orders.length && (
              <Text as="p" tone="subdued">
                No results for "{search}"
              </Text>
            )}
            {!!results.data?.products.length && (
              <BlockStack gap="100">
                <Text as="h3" variant="headingXs" tone="subdued">
                  Products
                </Text>
                {results.data.products.map((p) => (
                  <button key={p.id} className="search-row" onClick={() => go(`/products/${p.id}`)}>
                    <ProductThumb title={p.title} url={p.image_url} size={28} />
                    <span>{p.title}</span>
                    <small>{p.vendor}</small>
                  </button>
                ))}
              </BlockStack>
            )}
            {!!results.data?.orders.length && (
              <BlockStack gap="100">
                <Text as="h3" variant="headingXs" tone="subdued">
                  Orders
                </Text>
                {results.data.orders.map((x) => (
                  <button key={x.id} className="search-row" onClick={() => go(`/orders?open=${x.id}`)}>
                    <span className="mono">{x.name}</span>
                    <small>
                      {x.total_price} {x.currency}
                    </small>
                  </button>
                ))}
              </BlockStack>
            )}
          </BlockStack>
        </div>
      }
      secondaryMenu={
        <TopBar.Menu
          activatorContent={
            <span className="bell">
              <Icon source={NotificationIcon} />
              {alertCount > 0 && <span className="bell-badge">{alertCount}</span>}
            </span>
          }
          open={bellOpen}
          onOpen={() => setBellOpen(true)}
          onClose={() => setBellOpen(false)}
          actions={[
            {
              items: [
                {
                  content: `${o?.out_of_stock ?? 0} out of stock`,
                  onAction: () => go("/alerts"),
                },
                { content: `${o?.low_stock ?? 0} low stock`, onAction: () => go("/alerts") },
              ],
            },
          ]}
          message={{
            title: alertCount ? "Stock needs attention" : "You're all caught up",
            description: alertCount ? "Open alerts across your locations." : "No open alerts.",
            action: { content: "View alerts", onClick: () => go("/alerts") },
            link: { content: "Inventory", to: "/inventory" },
          }}
        />
      }
      userMenu={
        <TopBar.UserMenu
          actions={[
            {
              items: [
                { content: "Settings", onAction: () => go("/settings") },
                ...(isEmbedded()
                  ? []
                  : [
                      {
                        content: "Log out",
                        onAction: () => {
                          logout();
                          qc.clear();
                          onLogout();
                        },
                      },
                    ]),
              ],
            },
          ]}
          name={o?.shop?.replace(".myshopify.com", "") ?? "Store"}
          detail={o?.shop ?? ""}
          initials={(o?.shop ?? "S").charAt(0).toUpperCase()}
          open={userOpen}
          onToggle={() => setUserOpen((v) => !v)}
        />
      }
    />
  );

  const navigation = (
    <Navigation location={pathname}>
      <Navigation.Section
        items={[
          { url: "/", label: "Home", icon: HomeIcon, exactMatch: true },
          { url: "/orders", label: "Orders", icon: OrderIcon },
          {
            url: "/products",
            label: "Products",
            icon: ProductIcon,
            subNavigationItems: [{ url: "/inventory", label: "Inventory", excludePaths: [] }],
          },
          {
            url: "/alerts",
            label: "Alerts",
            icon: NotificationIcon,
            badge: alertCount ? String(alertCount) : undefined,
          },
          { url: "/analytics", label: "Analytics", icon: ChartVerticalIcon },
        ]}
      />
      <Navigation.Section
        title="Store"
        separator
        items={[
          { url: "/sync", label: "Sync log", icon: RefreshIcon },
          { url: "/settings", label: "Settings", icon: SettingsIcon },
        ]}
      />
    </Navigation>
  );

  return (
    <Frame
      topBar={topBar}
      navigation={navigation}
      showMobileNavigation={mobileNav}
      onNavigationDismiss={() => setMobileNav(false)}
      skipToContentTarget={undefined}
    >
      <ToastProvider>
        {isDemo() && (
          <div style={{ padding: "12px 16px 0" }}>
            <Banner
              tone="info"
              title="You're viewing a read-only demo"
              action={{
                content: "Exit demo",
                onAction: () => {
                  logout();
                  qc.clear();
                  onLogout();
                },
              }}
            >
              This is a live Shopify development store connected to ShopSync. Changes are disabled.
            </Banner>
          </div>
        )}
        <div key={pathname.split("/")[1] || "home"} className="page-enter">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/:id" element={<ProductDetailPage />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/sync" element={<SyncLogs />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </ToastProvider>
    </Frame>
  );
}
