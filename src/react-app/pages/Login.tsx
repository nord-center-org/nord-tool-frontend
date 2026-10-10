import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { Loader2, LogIn } from "lucide-react";
import { useAuth } from "@/react-app/hooks/useAuth";
import { destinoSeguro } from "@/react-app/utils/sessao";
import { ApiError } from "@/react-app/services/apiClient";

export default function LoginPage() {
  const { autenticado, entrar, sessaoEncerrada } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const destino = destinoSeguro(params.get("voltar"));

  if (autenticado) return <Navigate to={destino} replace />;

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (enviando) return;
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email.trim(), senha);
      navigate(destino, { replace: true });
    } catch (e) {
      // Erro da API traz a mensagem do backend; falha de rede (TypeError do fetch) vira um aviso legível.
      setErro(e instanceof ApiError ? e.message : "Não foi possível conectar ao servidor. Tente novamente.");
      setSenha("");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-6 font-sans">
      <form onSubmit={enviar} className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl shadow-xl p-8 space-y-6" noValidate>
        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tight">
            <span className="text-slate-800">Nord</span>
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Tool</span>
          </h1>
          <p className="text-sm text-slate-500 mt-2">Entre com seu e-mail e senha</p>
        </div>

        {sessaoEncerrada && !erro && (
          <p role="status" className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            Sua sessão terminou. Entre novamente para continuar.
          </p>
        )}
        {erro && (
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{erro}</p>
        )}

        <div className="space-y-4">
          <label className="block">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">E-mail</span>
            <input
              type="email" autoComplete="username" required autoFocus maxLength={150}
              value={email} onChange={e => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Senha</span>
            <input
              type="password" autoComplete="current-password" required maxLength={200}
              value={senha} onChange={e => setSenha(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
        </div>

        <button
          type="submit" disabled={enviando || !email.trim() || !senha}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white font-bold py-3 text-sm shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
          Entrar
        </button>
      </form>
    </div>
  );
}
