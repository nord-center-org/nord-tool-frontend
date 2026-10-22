import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import TelaPublica, { classeBotaoPublico, classeCampoPublico, classeRotuloPublico } from "@/react-app/components/auth/TelaPublica";
import type { Humor } from "@/react-app/components/auth/Mascote";
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
  const [focoSenha, setFocoSenha] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [reacao, setReacao] = useState<"triste" | "feliz" | null>(null);
  const [tremor, setTremor] = useState(0);
  const destino = destinoSeguro(params.get("voltar"));

  // Logo depois de entrar, a tela fica um instante para o mascote comemorar.
  if (autenticado && reacao !== "feliz") return <Navigate to={destino} replace />;

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (enviando) return;
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email.trim(), senha);
      // O mascote comemora um instante antes de abrir o sistema (sem espera para quem pediu menos movimento).
      setReacao("feliz");
      const calmo = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      window.setTimeout(() => navigate(destino, { replace: true }), calmo ? 0 : 650);
    } catch (e) {
      setReacao("triste");
      setTremor(t => t + 1);
      window.setTimeout(() => setReacao(r => (r === "triste" ? null : r)), 1400);
      // Erro da API traz a mensagem do backend; falha de rede (TypeError do fetch) vira um aviso legível.
      setErro(e instanceof ApiError ? e.message : "Não foi possível conectar ao servidor. Tente novamente.");
      setSenha("");
    } finally {
      setEnviando(false);
    }
  };

  const humor: Humor = reacao ?? (focoSenha ? (mostrarSenha ? "espiando" : "tapando") : "normal");

  return (
    <TelaPublica subtitulo="Entre com seu e-mail e senha" humor={humor} tremor={tremor}>
      <form onSubmit={enviar} className="space-y-6" noValidate>
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
            <span className={classeRotuloPublico}>E-mail</span>
            <input
              type="email" autoComplete="username" required autoFocus maxLength={150}
              value={email} onChange={e => setEmail(e.target.value)}
              className={classeCampoPublico}
            />
          </label>
          <label className="block">
            <span className={classeRotuloPublico}>Senha</span>
            <span className="relative block">
              <input
                type={mostrarSenha ? "text" : "password"} autoComplete="current-password" required maxLength={200}
                value={senha} onChange={e => setSenha(e.target.value)}
                onFocus={() => setFocoSenha(true)} onBlur={() => setFocoSenha(false)}
                className={`${classeCampoPublico} pr-11`}
              />
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => setMostrarSenha(v => !v)}
                aria-label={mostrarSenha ? "Esconder senha" : "Mostrar senha"} aria-pressed={mostrarSenha}
                className="absolute inset-y-0 right-0 mt-1 flex w-11 items-center justify-center rounded-r-xl text-slate-400 hover:text-blue-600">
                {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>
        </div>

        <button type="submit" disabled={enviando || !email.trim() || !senha} className={classeBotaoPublico}>
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
          Entrar
        </button>

        <div className="flex items-center justify-between text-sm">
          <Link to="/esqueci-senha" className="font-semibold text-slate-500 hover:text-blue-600">Esqueci a senha</Link>
          <Link to="/cadastro" className="font-semibold text-blue-600 hover:underline">Criar conta</Link>
        </div>
      </form>
    </TelaPublica>
  );
}
