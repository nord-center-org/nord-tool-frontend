import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { Eye, EyeOff, KeyRound, Loader2, LogIn } from "lucide-react";
import TelaPublica, { classeBotaoPublico, classeCampoPublico, classeRotuloPublico } from "@/react-app/components/auth/TelaPublica";
import type { Humor } from "@/react-app/components/auth/Mascote";
import { useAuth } from "@/react-app/hooks/useAuth";
import { destinoSeguro } from "@/react-app/utils/sessao";
import { ApiError } from "@/react-app/services/apiClient";
import { forcaSenha, problemaNaSenha } from "@/react-app/utils/cadastro";

const ROTULO_FORCA = ["", "fraca", "boa", "forte"];

export default function LoginPage() {
  const { autenticado, entrar, definirSenha, sessaoEncerrada } = useAuth();
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
  // Senha resetada pelo admin: a senha digitada era a provisória e agora a pessoa cria a dela.
  const [provisoria, setProvisoria] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [nova, setNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const destino = destinoSeguro(params.get("voltar"));

  // Logo depois de entrar, a tela fica um instante para o mascote comemorar.
  if (autenticado && reacao !== "feliz") return <Navigate to={destino} replace />;

  const comemorar = () => {
    // O mascote comemora um instante antes de abrir o sistema (sem espera para quem pediu menos movimento).
    setReacao("feliz");
    const calmo = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => navigate(destino, { replace: true }), calmo ? 0 : 650);
  };

  const criarSenha = async (evento: FormEvent) => {
    evento.preventDefault();
    if (enviando || provisoria === null) return;
    const problema = problemaNaSenha(nova, confirmacao);
    if (problema) return setErro(problema);
    setErro(null);
    setEnviando(true);
    try {
      await definirSenha(email.trim(), provisoria, nova);
      comemorar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível conectar ao servidor. Tente novamente.");
      // Provisória vencida ou errada: volta para o login normal.
      if (e instanceof ApiError && e.status !== 400) { setProvisoria(null); setNova(""); setConfirmacao(""); }
    } finally {
      setEnviando(false);
    }
  };

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (enviando) return;
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email.trim(), senha);
      comemorar();
    } catch (e) {
      if (e instanceof ApiError && e.cdErro === "TROCAR_SENHA") {
        setProvisoria(senha);
        setAviso(e.message);
        setSenha("");
        return;
      }
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

  if (provisoria !== null) {
    const forca = forcaSenha(nova);
    return (
      <TelaPublica subtitulo="Crie a sua senha nova" humor={humor} tremor={tremor}>
        <form onSubmit={criarSenha} className="space-y-5" noValidate>
          <p role="status" className="flex gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0" /> {aviso}
          </p>
          {erro && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{erro}</p>}
          <p className="text-sm text-slate-500">Entrando como <strong className="text-slate-700">{email.trim()}</strong>.</p>
          <div>
            <label className="block">
              <span className={classeRotuloPublico}>Senha nova</span>
              <input type="password" autoComplete="new-password" autoFocus maxLength={200} value={nova}
                onChange={e => setNova(e.target.value)} onFocus={() => setFocoSenha(true)} onBlur={() => setFocoSenha(false)}
                aria-describedby="forca-nova" className={classeCampoPublico} />
            </label>
            <span id="forca-nova" className="mt-1 flex items-center gap-2 text-xs text-slate-400">
              <span className="flex gap-1" aria-hidden="true">
                {[1, 2, 3].map(n => <span key={n} className={`h-1.5 w-8 rounded-full ${forca >= n ? (forca === 1 ? "bg-amber-400" : "bg-green-500") : "bg-slate-200"}`} />)}
              </span>
              {nova && forca > 0 ? `senha ${ROTULO_FORCA[forca]}` : "mínimo de 10 caracteres"}
            </span>
          </div>
          <label className="block">
            <span className={classeRotuloPublico}>Confirme a senha nova</span>
            <input type="password" autoComplete="new-password" maxLength={200} value={confirmacao}
              onChange={e => setConfirmacao(e.target.value)} onFocus={() => setFocoSenha(true)} onBlur={() => setFocoSenha(false)}
              className={classeCampoPublico} />
          </label>
          <button type="submit" disabled={enviando || !nova || !confirmacao} className={classeBotaoPublico}>
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            Salvar e entrar
          </button>
          <button type="button" onClick={() => { setProvisoria(null); setErro(null); setNova(""); setConfirmacao(""); }}
            className="w-full text-center text-sm font-semibold text-slate-500 hover:text-blue-600">Voltar para o login</button>
        </form>
      </TelaPublica>
    );
  }

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
