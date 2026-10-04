"use client";

import { PlatinumDashboard } from "@/sections/platinum-dashboard";

/**
 * /platinum - the member-only signal dashboard.
 *
 * A client boundary: the dashboard subscribes to the signal feed and reads the
 * member session, so it has no meaningful server render.
 */
export default function Platinum() {
  return <PlatinumDashboard />;
}