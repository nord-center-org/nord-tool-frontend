import { useState } from "react";
import { Check, Copy, KeyRound, Loader2, MailCheck } from "lucide-react";

import { acessoService, type AcessoUsuario, type SenhaProvisoria } from "@/react-app/services/AcessoService";

interface Props {
  usuario: AcessoUsuario;
  ehEuMesmo: boolean;
  onResetado: (u: AcessoUsuario) => void;
}

const formatarValidade = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Reset de senha pelo admin: gera uma senha provisória; no próximo login a pessoa cria a dela. */
export default function ResetSenhaUsuario({ usuario, ehEuMesmo, onResetado }: Props) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<SenhaProvisoria | null>(null);
  const [copiado, setCopiado] = useState(false);

  if (ehEuMesmo || usuario.cdSituacaoCadastro === "PENDENTE") return null;

  const resetar = async () => {
    if (!window.confirm(`Resetar a senha de ${usuario.nmNome}? A senha atual para de funcionar na hora e as sessões abertas são encerradas.`)) return;
    setEnviando(true); setErro(null); setCopiado(false);
    try {
      const r = await acessoService.resetarSenha(usuario.id);
      setResultado(r);
      onResetado({ ...usuario, inTrocarSenha: true });
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Não foi possível resetar a senha.");
    } finally {
      setEnviando(false);
    }
  };

  const copiar = async () => {
    if (!resultado) return;
    try {
      await navigator.clipboard.writeText(resultado.senhaProvisoria);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <section aria-label="Senha do usuário" className="mx-4 mt-3 rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-700">Senha</p>
          <p className="text-xs text-slate-500">
            {usuario.inTrocarSenha
              ? "Resetada: aguardando a pessoa entrar com a senha provisória e criar a nova."
              : "Esqueceu a senha? Gere uma provisória; no próximo login a pessoa cria a dela."}
          </p>
        </div>
        <button type="button" onClick={() => void resetar()} disabled={enviando}
          className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50">
          {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
          {usuario.inTrocarSenha ? "Gerar outra provisória" : "Resetar senha"}
        </button>
      </div>
      {erro && <p role="alert" className="mt-2 text-sm text-red-700">{erro}</p>}
      {resultado && (
        <div role="status" className="mt-3 animate-surgir rounded-xl border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs font-semibold text-blue-900">Senha provisória de {usuario.nmNome}:</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <code className="rounded-lg bg-white px-3 py-1.5 font-mono text-lg font-black tracking-[0.2em] text-slate-900 shadow-sm">{resultado.senhaProvisoria}</code>
            <button type="button" onClick={() => void copiar()} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-2 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100">
              {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copiado ? "Copiada" : "Copiar"}
            </button>
          </div>
          <p className="mt-2 text-xs text-blue-900/80">
            Vale até {formatarValidade(resultado.dhValidaAte)}. Passe para a pessoa: ela entra com o e-mail e essa senha e, na mesma hora, cria a senha nova.
            Ela só aparece agora: anote antes de fechar.
          </p>
          {resultado.emailEnviado && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-700"><MailCheck className="h-3.5 w-3.5" /> Também foi enviada para {usuario.nmEmail}.</p>}
        </div>
      )}
    </section>
  );
}
