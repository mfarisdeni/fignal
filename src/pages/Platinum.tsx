import { PlatinumDashboard } from "@/sections/platinum-dashboard";

/**
 * /platinum — the member-only signal dashboard.
 * Kept as a thin page component so a router can mount it directly.
 */
export default function Platinum() {
  return <PlatinumDashboard />;
}
