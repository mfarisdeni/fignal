import { Route, Routes } from "react-router";
import { AdminAuthProvider } from "@/hooks/use-admin-auth";
import { AuthProvider } from "@/hooks/use-auth";
import Admin from "@/pages/Admin";
import Platinum from "@/pages/Platinum";

export default function App() {
  return (
    <AuthProvider>
      {/* Admin carries its own passcode session, separate from the member one. */}
      <AdminAuthProvider>
        <Routes>
          {/* The MVP ships the Platinum member page only — no public pages. */}
          <Route path="/" element={<Platinum />} />
          <Route path="/platinum" element={<Platinum />} />
          {/* Mounted before the catch-all, and linked from nowhere in the UI. */}
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Platinum />} />
        </Routes>
      </AdminAuthProvider>
    </AuthProvider>
  );
}
