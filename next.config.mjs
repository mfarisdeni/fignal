/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The shell is prerendered as static HTML and the feed hydrates from
  // Firestore in the browser, so the static shell is all that ships - there is
  // no per-user data in the HTML to leak or go stale.
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },
};

export default nextConfig;