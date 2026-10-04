"use client";

import { Landing } from "@/sections/landing";

/**
 * / - the public landing page.
 * The member dashboard lives at /platinum, the prompt desk at /admin.
 *
 * A client boundary because the landing section carries the language toggle and
 * its stateful marketing panels.
 */
export default function LandingPage() {
  return <Landing />;
}