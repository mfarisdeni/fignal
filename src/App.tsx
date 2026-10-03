import { Route, Routes } from "react-router";
import { AuthProvider } from "@/hooks/use-auth";
import Platinum from "@/pages/Platinum";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* The MVP ships the Platinum member page only — no public pages. */}
        <Route path="/" element={<Platinum />} />
        <Route path="/platinum" element={<Platinum />} />
        <Route path="*" element={<Platinum />} />
      </Routes>
    </AuthProvider>
  );
}
