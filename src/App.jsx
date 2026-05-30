import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/context/useAuth";

import DashboardLayout from "@/layouts/DashboardLayout";

import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import Customers from "@/pages/Customers";
import Conversations from "@/pages/Conversations";
import Channels from "@/pages/Channels";
import Team from "@/pages/Team";
import FunnelKanban from "@/pages/FunnelKanban";
import Settings from "@/pages/Settings";

function PrivateRoute({ children }) {
  const location = useLocation();
  const { user, loading, canAccess } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        Carregando...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccess(location.pathname)) {
    return <Navigate to="/conversations" replace />;
  }

  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          loading ? (
            <div className="min-h-screen bg-black flex items-center justify-center text-white">
              Carregando...
            </div>
          ) : !user ? (
            <Login />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      <Route
        element={
          <PrivateRoute>
            <DashboardLayout />
          </PrivateRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/conversations" element={<Conversations />} />
        <Route path="/funnel" element={<FunnelKanban />} />
        <Route path="/team" element={<Team />} />
        <Route path="/channels" element={<Channels />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
