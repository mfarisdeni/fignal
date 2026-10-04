import { AdminDashboard } from "@/sections/admin-dashboard";

/**
 * /admin — the passcode-gated prompt desk.
 * Reachable by URL only; it is deliberately absent from member navigation.
 */
export default function Admin() {
  return <AdminDashboard />;
}
