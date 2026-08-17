import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { RequireAuth } from "./auth/RequireAuth";
import { Login } from "./pages/Login";
import { Cadastro } from "./pages/Cadastro";
import { Dashboard } from "./pages/Dashboard";
import { Kiosk } from "./pages/Kiosk";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/cadastro"
            element={
              <RequireAuth ownerOnly>
                <Cadastro />
              </RequireAuth>
            }
          />
          <Route
            path="/kiosk"
            element={
              <RequireAuth ownerOnly>
                <Kiosk />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
