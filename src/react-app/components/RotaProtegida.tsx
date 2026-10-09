import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { ShieldOff } from "lucide-react";
import { useAuth } from "@/react-app/hooks/useAuth";
import { podeAbrirRota } from "@/react-app/utils/sessao";

/** Sem sessão vai para o login (voltando à mesma tela depois); sem o módulo da rota mostra o aviso. */
export default function RotaProtegida({ children }: { children: ReactNode }) {
  const { autenticado } = useAuth();
  const location = useLocation();
  if (!autenticado) {
    const voltar = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?voltar=${voltar}`} replace />;
  }
  return <>{children}</>;
}

/** Usado dentro do layout: a autorização real é do backend; aqui só evita abrir uma tela que daria 403. */
export function ExigeModuloDaRota({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const location = useLocation();
  if (podeAbrirRota(usuario?.permissoes, location.pathname)) return <>{children}</>;
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
        <ShieldOff className="w-9 h-9 text-slate-400" />
      </div>
      <h2 className="text-2xl font-black text-slate-800 mb-2">Sem acesso a esta área</h2>
      <p className="text-slate-500 font-medium max-w-sm">
        Seu usuário não tem permissão para este módulo. Peça a liberação a um administrador.
      </p>
    </div>
  );
}
