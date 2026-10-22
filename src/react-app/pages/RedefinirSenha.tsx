import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";

import TelaPublica, { classeBotaoPublico, classeCampoPublico, classeRotuloPublico } from "@/react-app/components/auth/TelaPublica";
import { ApiError } from "@/react-app/services/apiClient";
import { authService } from "@/react-app/services/AuthService";
import { problemaNaSenha } from "@/react-app/utils/cadastro";

export default function RedefinirSenhaPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState<string | null>(null);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    const problema = problemaNaSenha(senha, confirmacao);
    if (problema) return setErro(problema);
    setErro(null);
    setEnviando(true);
    try {
      const r = await authService.redefinirSenha(token, senha);
      setFeito(r?.txMensagem ?? "Senha alterada.");
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível conectar ao servidor. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  if (!token) {
    return (
      <TelaPublica subtitulo="Criar nova senha">
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">Link inválido. Peça um novo em "Esqueci a senha".</p>
        <Link to="/esqueci-senha" className={classeBotaoPublico}>Esqueci a senha</Link>
      </TelaPublica>
    );
  }

  return (
    <TelaPublica subtitulo="Criar nova senha">
      {feito ? (
        <div role="status" className="space-y-3 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <p className="text-sm text-slate-600">{feito}</p>
          <Link to="/login" className={classeBotaoPublico}>Entrar</Link>
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-4" noValidate>
          {erro && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{erro}</p>}
          <label className="block"><span className={classeRotuloPublico}>Nova senha</span>
            <input type="password" autoFocus autoComplete="new-password" maxLength={200} value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo de 10 caracteres" className={classeCampoPublico} />
          </label>
          <label className="block"><span className={classeRotuloPublico}>Confirme a nova senha</span>
            <input type="password" autoComplete="new-password" maxLength={200} value={confirmacao} onChange={e => setConfirmacao(e.target.value)} className={classeCampoPublico} />
          </label>
          <button type="submit" disabled={enviando} className={classeBotaoPublico}>
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Salvar nova senha
          </button>
        </form>
      )}
    </TelaPublica>
  );
}
