import { Tabs } from "@shopify/polaris";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import Alerts from "./pages/Alerts";
import Inventory from "./pages/Inventory";
import Orders from "./pages/Orders";
import Overview from "./pages/Overview";
import SettingsPage from "./pages/SettingsPage";
import SyncLogs from "./pages/SyncLogs";

const TABS = [
  { id: "overview", content: "Overview", path: "/" },
  { id: "inventory", content: "Inventory", path: "/inventory" },
  { id: "orders", content: "Orders", path: "/orders" },
  { id: "alerts", content: "Alerts", path: "/alerts" },
  { id: "sync", content: "Sync log", path: "/sync" },
  { id: "settings", content: "Settings", path: "/settings" },
];

export default function App() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const selected = Math.max(
    0,
    TABS.findIndex((t) => (t.path === "/" ? pathname === "/" : pathname.startsWith(t.path))),
  );
  return (
    <>
      <div style={{ background: "#fff", borderBottom: "1px solid #e1e3e5" }}>
        <Tabs tabs={TABS} selected={selected} onSelect={(i) => nav(TABS[i].path)} />
      </div>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/sync" element={<SyncLogs />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
