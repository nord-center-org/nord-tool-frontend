import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, Image as ImageIcon, Loader2, Search, Send, Share2, X } from "lucide-react";

import { baixarImagem, compartilharImagem, pngDaCifra, podeCompartilharArquivo, type InfoCifra } from "@/react-app/components/repertorio/desenhoCifra";
import { repertorioService } from "@/react-app/services/RepertorioService";
import { alternarPessoa, filtrarPessoas, type PessoaCompartilhavel } from "@/react-app/utils/compartilhamento";

const botao = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40";

/** v12: a imagem da cifra, com baixar, compartilhar (no celular) e copiar o texto. */
export function PainelImagemCifra({ info }: { info: InfoCifra }) {
  const [png, setPng] = useState<{ blob: Blob; url: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const podeCompartilhar = useMemo(podeCompartilharArquivo, []);
  useEffect(() => {
    let vivo = true, url = "";
    setPng(null);
    pngDaCifra(info).then(blob => { if (!vivo) return; url = URL.createObjectURL(blob); setPng({ blob, url }); }).catch(e => vivo && setErro(e instanceof Error ? e.message : "Não deu para gerar a imagem."));
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); };
  }, [info]);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(`${info.titulo}${info.artista ? ` — ${info.artista}` : ""}${info.tom ? `\nTom: ${info.tom}` : ""}\n\n${info.texto}`); setCopiado(true); setTimeout(() => setCopiado(false), 1800); }
    catch { setErro("Não deu para copiar aqui. Selecione o texto da cifra e copie."); }
  };
  return (
    <div className="space-y-2">
      <div className="flex min-h-[10rem] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
        {png ? <img src={png.url} alt={`Imagem da cifra de ${info.titulo}`} className="max-h-80 w-auto rounded-lg shadow" />
          : erro ? <p className="text-xs text-red-600">{erro}</p> : <Loader2 className="h-6 w-6 animate-spin text-slate-400" />}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={botao} disabled={!png} onClick={() => png && baixarImagem(png.blob, info.titulo)}><Download className="h-4 w-4" />Baixar imagem</button>
        {podeCompartilhar && <button type="button" className={botao} disabled={!png} onClick={() => png && void compartilharImagem(png.blob, info.titulo)}><Share2 className="h-4 w-4" />Compartilhar imagem</button>}
        <button type="button" className={botao} onClick={() => void copiar()}>{copiado ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}{copiado ? "Copiado" : "Copiar texto"}</button>
      </div>
    </div>
  );
}

/**
 * Repertório v12 — compartilhar a cifra: mandar para pessoas do NordTool (cada uma recebe uma cópia em "Recebidas",
 * sem o áudio) e a imagem bonitinha para baixar ou mandar pelo celular.
 */
export default function CompartilharCifra({ info, onFechar }: { info: InfoCifra; onFechar: () => void }) {
  const [pessoas, setPessoas] = useState<PessoaCompartilhavel[] | null>(null);
  const [busca, setBusca] = useState("");
  const [ids, setIds] = useState<number[]>([]);
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);
  useEffect(() => {
    repertorioService.pessoas().then(setPessoas).catch(() => { setPessoas([]); setResultado({ ok: false, texto: "Não deu para carregar as pessoas agora." }); });
  }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);
  const lista = useMemo(() => filtrarPessoas(pessoas ?? [], busca), [pessoas, busca]);

  const enviar = async () => {
    setEnviando(true);
    setResultado(null);
    try {
      const r = await repertorioService.enviarCifra({ idsUsuarios: ids, nmTitulo: info.titulo, nmArtista: info.artista, nmTom: info.tom, txCifra: info.texto, txMensagem: mensagem.trim() });
      const n = r?.nrEnviadas ?? ids.length;
      setResultado({ ok: true, texto: `Cifra enviada para ${n} ${n === 1 ? "pessoa" : "pessoas"}. Ela aparece em "Recebidas" no Repertório de quem recebeu.` });
      setIds([]);
      setMensagem("");
    } catch (e) {
      setResultado({ ok: false, texto: e instanceof Error ? e.message : "Não deu para enviar a cifra." });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onClick={onFechar}>
      <div role="dialog" aria-modal="true" aria-label="Compartilhar a cifra" onClick={e => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <Share2 className="h-5 w-5 text-orange-500" />
          <b className="mr-auto min-w-0 truncate text-slate-800">Compartilhar “{info.titulo}”</b>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-2">
          <section aria-label="Mandar para pessoas">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-700"><Send className="h-4 w-4" />Mandar para alguém do NordTool</h3>
            <label className="relative block">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar pelo nome" aria-label="Buscar pessoa"
                className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-sm outline-none focus:border-blue-500" />
            </label>
            <ul className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-100" aria-label="Pessoas">
              {pessoas === null ? <li className="flex items-center gap-2 p-3 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</li>
                : lista.length === 0 ? <li className="p-3 text-xs text-slate-500">Ninguém encontrado.</li>
                  : lista.map(p => (
                    <li key={p.id}>
                      <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50">
                        <input type="checkbox" checked={ids.includes(p.id)} onChange={() => setIds(l => alternarPessoa(l, p.id))} />
                        <span className="min-w-0 flex-1 truncate">{p.nmNome}</span>
                        {p.nmCargo && <span className="truncate text-[11px] text-slate-400">{p.nmCargo}</span>}
                      </label>
                    </li>
                  ))}
            </ul>
            <label className="mt-2 block text-xs font-bold text-slate-600">Recado (opcional)
              <textarea value={mensagem} onChange={e => setMensagem(e.target.value.slice(0, 300))} rows={2} placeholder="Ex.: essa é a do culto de domingo"
                className="mt-1 w-full resize-none rounded-lg border border-slate-200 p-2 text-sm font-normal outline-none focus:border-blue-500" />
            </label>
            <button type="button" onClick={() => void enviar()} disabled={!ids.length || enviando}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40">
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {ids.length ? `Enviar para ${ids.length} ${ids.length === 1 ? "pessoa" : "pessoas"}` : "Escolha com quem compartilhar"}
            </button>
            {resultado && <p role={resultado.ok ? "status" : "alert"} className={`mt-2 rounded-lg px-3 py-2 text-xs ${resultado.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{resultado.texto}</p>}
            <p className="mt-2 text-[11px] text-slate-500">Vai a cifra como está aqui (no tom que você está vendo), sem o áudio.</p>
          </section>
          <section aria-label="Imagem da cifra">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-700"><ImageIcon className="h-4 w-4" />Imagem da cifra</h3>
            <PainelImagemCifra info={info} />
          </section>
        </div>
      </div>
    </div>
  );
}
