"use client";

import { AdminDashboard } from "@/sections/admin-dashboard";

/**
 * /admin - the passcode-gated prompt desk.
 *
 * A client boundary: the desk holds the pasted prompt, the parsed preview and
 * the publish action, all of which are live state.
 */
export default function Admin() {
  return <AdminDashboard />;
}