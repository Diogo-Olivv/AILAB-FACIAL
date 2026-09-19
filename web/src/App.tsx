import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { SiteAccessGate } from "./components/SiteAccessGate";

const basename = import.meta.env.BASE_URL.replace(/\/$/, "");

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={basename}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <SiteAccessGate>
                <Dashboard />
              </SiteAccessGate>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

