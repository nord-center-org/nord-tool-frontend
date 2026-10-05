import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { useAuth, type MotivoSaida } from "@/react-app/contexts/AuthContext";

interface LoginState {
  from?: { pathname: string; search?: string; hash?: string };
  motivo?: MotivoSaida;
}

const AVISOS: Record<MotivoSaida, string> = {
  inatividade: "Sessão encerrada por inatividade. Entre novamente.",
  sessao: "Sua sessão expirou. Entre novamente.",
};

export default function LoginPage() {
  const { usuario, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const estado = (location.state ?? {}) as LoginState;
  const destino = estado.from
    ? `${estado.from.pathname}${estado.from.search ?? ""}${estado.from.hash ?? ""}`
    : "/";

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (usuario) return <Navigate to={destino} replace />;

  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    if (enviando) return;
    setErro(null);
    setEnviando(true);
    try {
      await login(email, senha);
      navigate(destino, { replace: true });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível entrar. Tente novamente.");
      setSenha("");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 font-sans">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-center text-3xl font-black tracking-tight">
          <span className="text-slate-800">Nord</span>
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Tool</span>
        </h1>
        <p className="mb-6 text-center text-sm text-slate-500">Entre para continuar</p>

        {estado.motivo && !erro && (
          <p role="status" className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {AVISOS[estado.motivo]}
          </p>
        )}
        {erro && (
          <p role="alert" className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
        )}

        <form onSubmit={enviar} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            E-mail
            <input
              type="email"
              autoFocus
              autoComplete="username"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Senha
            <div className="relative mt-1">
              <input
                type={mostrarSenha ? "text" : "password"}
                autoComplete="current-password"
                required
                value={senha}
                onChange={e => setSenha(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-3 pr-10 text-sm font-normal outline-none focus:ring-2 focus:ring-blue-500/30"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(v => !v)}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:text-slate-600"
              >
                {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={enviando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {enviando ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">Sem acesso? Peça ao administrador.</p>
      </div>
    </div>
  );
}
