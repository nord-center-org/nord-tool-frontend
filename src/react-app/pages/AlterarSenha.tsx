import { useState, type FormEvent } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { useAuth } from "@/react-app/hooks/useAuth";
import { authService } from "@/react-app/services/AuthService";

const MIN_CARACTERES = 10;
const MAX_BYTES = 72;

function motivoSenhaInvalida(senha: string): string | null {
  if (senha.length < MIN_CARACTERES) return `A nova senha deve ter ao menos ${MIN_CARACTERES} caracteres.`;
  if (new TextEncoder().encode(senha).length > MAX_BYTES) return `A nova senha deve ter no máximo ${MAX_BYTES} bytes (acentos contam 2).`;
  return null;
}

export default function AlterarSenhaPage() {
  const { atualizarSessao } = useAuth();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    setErro(null);
    setSucesso(false);
    const motivo = motivoSenhaInvalida(nova);
    if (motivo) return setErro(motivo);
    if (nova !== confirmacao) return setErro("A confirmação não confere com a nova senha.");
    setEnviando(true);
    try {
      // O backend encerra as outras sessões e devolve um token novo para esta.
      atualizarSessao(await authService.alterarSenha(atual, nova));
      setSucesso(true);
      setAtual("");
      setNova("");
      setConfirmacao("");
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Não foi possível alterar a senha.");
    } finally {
      setEnviando(false);
    }
  };

  const campo = "mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  return (
    <div className="max-w-md mx-auto py-8">
      <form onSubmit={enviar} className="bg-white border border-slate-200 rounded-3xl shadow-sm p-8 space-y-5" noValidate>
        <div className="flex items-center gap-3">
          <KeyRound className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-black text-slate-800">Alterar senha</h2>
        </div>
        <p className="text-sm text-slate-500">Ao trocar a senha, as sessões abertas em outros navegadores são encerradas.</p>

        {erro && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{erro}</p>}
        {sucesso && <p role="status" className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">Senha alterada.</p>}

        <label className="block">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Senha atual</span>
          <input type="password" autoComplete="current-password" value={atual} onChange={e => setAtual(e.target.value)} className={campo} />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nova senha</span>
          <input type="password" autoComplete="new-password" value={nova} onChange={e => setNova(e.target.value)} className={campo} />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Confirme a nova senha</span>
          <input type="password" autoComplete="new-password" value={confirmacao} onChange={e => setConfirmacao(e.target.value)} className={campo} />
        </label>

        <button
          type="submit" disabled={enviando || !atual || !nova || !confirmacao}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white font-bold py-3 text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
          Salvar nova senha
        </button>
      </form>
    </div>
  );
}
