import { Loader2 } from "lucide-react";
import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/react-app/contexts/AuthContext";

export default function RotaProtegida() {
  const { usuario, carregando } = useAuth();
  const location = useLocation();

  if (carregando) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-label="Carregando" />
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
