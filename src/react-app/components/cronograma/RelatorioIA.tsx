import { useEffect, useState } from "react";
import { Bot, KeyRound, Link2, ShieldAlert, Trash2, X } from "lucide-react";

import BotaoCopiar from "../medicoes/BotaoCopiar";
import { API_BASE } from "../../config/api";
import { integracaoService } from "../../services/IntegracaoService";
import { instrucaoAssistente, linkRelatorio, quandoUsado, type IntegracaoToken } from "../../utils/integracao";

interface RelatorioIAProps {
  onFechar: () => void;
}

/**
 * Links de leitura do cronograma para assistentes de IA: cria (a chave aparece uma vez só), lista e revoga.
 * O assistente abre o link todo dia e recebe o relatório em texto (hoje, atrasadas, próximos dias, sem data).
 */
export default function RelatorioIA({ onFechar }: RelatorioIAProps) {
  const [tokens, setTokens] = useState<IntegracaoToken[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [rotulo, setRotulo] = useState("Gemini");
  const [horario, setHorario] = useState("7h");
  const [novo, setNovo] = useState<IntegracaoToken | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = async () => {
    try {
      setTokens(await integracaoService.listar());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os links");
    } finally {
      setCarregando(false);
    }
  };
  useEffect(() => { void carregar(); }, []);

  const criar = async () => {
    setErro(null);
    setOcupado(true);
    try {
      setNovo(await integracaoService.criar(rotulo.trim() || "Assistente"));
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar o link");
    } finally {
      setOcupado(false);
    }
  };

  const revogar = async (t: IntegracaoToken) => {
    if (!window.confirm(`Revogar o link "${t.nmRotulo}"? O assistente para de conseguir ler o cronograma na hora.`)) return;
    setErro(null);
    try {
      await integracaoService.revogar(t.idToken);
      if (novo?.idToken === t.idToken) setNovo(null);
      setTokens(l => l.filter(x => x.idToken !== t.idToken));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível revogar");
    }
  };

  const link = novo?.chave ? linkRelatorio(API_BASE, novo.chave, window.location.origin) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={onFechar}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-800 shadow-2xl"
        onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="relatorio-ia-titulo">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="relatorio-ia-titulo" className="flex items-center gap-2 text-lg font-bold"><Bot size={20} className="text-violet-600" /> Relatório para IA</h2>
          <button onClick={onFechar} className="text-slate-500 hover:text-slate-800" aria-label="Fechar"><X size={20} /></button>
        </div>
        <p className="text-sm text-slate-600">
          Crie um link secreto para o Gemini (ou outro assistente) ler o seu cronograma: o que tem hoje, o que está atrasado e o
          que vence nos próximos dias. Ele só lê — não altera nada.
        </p>

        {erro && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

        {link ? (
          <div className="mt-4 space-y-3 rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-violet-800"><KeyRound size={16} /> Link criado — copie agora</p>
            <p className="text-xs text-violet-700">Por segurança ele só aparece esta vez. Se perder, é só revogar e criar outro.</p>
            <div className="break-all rounded-lg border border-violet-200 bg-white px-3 py-2 font-mono text-[11px] text-slate-700">{link}</div>
            <div className="flex flex-wrap gap-2">
              <BotaoCopiar texto={link} rotulo="Copiar link" />
              <a href={link} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50">
                <Link2 className="h-3.5 w-3.5" /> Ver o relatório
              </a>
            </div>
            <div className="border-t border-violet-200 pt-3">
              <label className="flex items-center gap-2 text-xs font-bold text-violet-800">
                Mensagem pronta para o Gemini, todo dia às
                <input value={horario} onChange={e => setHorario(e.target.value.slice(0, 10))} aria-label="Horário do relatório"
                  className="w-16 rounded-md border border-violet-200 bg-white px-2 py-0.5 text-xs font-bold text-slate-700" />
              </label>
              <pre className="mt-2 whitespace-pre-wrap [overflow-wrap:anywhere] rounded-lg border border-violet-200 bg-white px-3 py-2 text-[11px] text-slate-700">{instrucaoAssistente(link, horario || "7h")}</pre>
              <div className="mt-2"><BotaoCopiar texto={instrucaoAssistente(link, horario || "7h")} rotulo="Copiar mensagem" /></div>
              <p className="mt-2 text-[11px] text-violet-700">
                No Gemini, cole a mensagem e peça para virar uma <b>ação programada</b> diária (ou use “Ações programadas” no menu).
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex gap-2">
            <input value={rotulo} onChange={e => setRotulo(e.target.value.slice(0, 60))} placeholder="Nome do link (ex.: Gemini)" aria-label="Nome do link"
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <button onClick={() => void criar()} disabled={ocupado} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50">
              {ocupado ? "Criando…" : "Criar link"}
            </button>
          </div>
        )}

        <div className="mt-5">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Links ativos</p>
          {carregando ? (
            <p className="mt-2 text-sm text-slate-500">Carregando…</p>
          ) : tokens.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Nenhum link ainda.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {tokens.map(t => (
                <li key={t.idToken} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{t.nmRotulo}</p>
                    <p className="text-[11px] text-slate-500"><span className="font-mono">{t.txPrefixo}…</span> · {quandoUsado(t.dhUltimoUso)}</p>
                  </div>
                  <button onClick={() => void revogar(t)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50">
                    <Trash2 size={14} /> Revogar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-4 flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          <ShieldAlert size={16} className="shrink-0" />
          Quem tiver o link consegue ler o seu cronograma (inclusive observações). Não compartilhe; se vazar, revogue aqui.
        </p>
      </div>
    </div>
  );
}
