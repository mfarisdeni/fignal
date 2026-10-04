import { Route, Routes } from "react-router";
import { AdminAuthProvider } from "@/hooks/use-admin-auth";
import { AuthProvider } from "@/hooks/use-auth";
import Admin from "@/pages/Admin";
import Landing from "@/pages/Landing";
import Platinum from "@/pages/Platinum";

export default function App() {
  return (
    <AuthProvider>
      {/* Admin carries its own passcode session, separate from the member one. */}
      <AdminAuthProvider>
        <Routes>
          {/* Public landing at the root; members live behind /platinum. */}
          <Route path="/" element={<Landing />} />
          <Route path="/platinum" element={<Platinum />} />
          {/* Mounted before the catch-all, and linked from nowhere in the UI. */}
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </AdminAuthProvider>
    </AuthProvider>
  );
}
