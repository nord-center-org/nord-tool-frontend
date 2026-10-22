import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Loader2, MailCheck, Send } from "lucide-react";

import TelaPublica, { classeBotaoPublico, classeCampoPublico, classeRotuloPublico } from "@/react-app/components/auth/TelaPublica";
import { ApiError } from "@/react-app/services/apiClient";
import { authService } from "@/react-app/services/AuthService";
import { emailValido } from "@/react-app/utils/cadastro";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState<string | null>(null);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    if (!emailValido(email)) return setErro("Informe um e-mail válido.");
    setErro(null);
    setEnviando(true);
    try {
      const r = await authService.esqueciSenha(email.trim());
      setFeito(r?.txMensagem ?? "Se o e-mail estiver cadastrado, enviamos um link.");
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível conectar ao servidor. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <TelaPublica subtitulo="Esqueci a senha">
      {feito ? (
        <div role="status" className="space-y-3 text-center">
          <MailCheck className="mx-auto h-12 w-12 text-blue-500" />
          <p className="text-sm text-slate-600">{feito}</p>
          <p className="text-xs text-slate-400">Não chegou? Confira a caixa de spam ou peça de novo em alguns minutos.</p>
          <Link to="/login" className={classeBotaoPublico}>Voltar para o login</Link>
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-4" noValidate>
          <p className="text-sm text-slate-500">Digite o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.</p>
          {erro && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{erro}</p>}
          <label className="block"><span className={classeRotuloPublico}>E-mail</span>
            <input type="email" autoFocus autoComplete="username" maxLength={150} value={email} onChange={e => setEmail(e.target.value)} className={classeCampoPublico} />
          </label>
          <button type="submit" disabled={enviando} className={classeBotaoPublico}>
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar link
          </button>
          <p className="text-center text-sm"><Link to="/login" className="font-semibold text-blue-600 hover:underline">Voltar para o login</Link></p>
        </form>
      )}
    </TelaPublica>
  );
}
