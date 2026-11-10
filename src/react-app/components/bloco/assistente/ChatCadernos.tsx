import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent, type KeyboardEvent } from "react";
import { Bot, Check, FileText, Image as ImageIcon, Loader2, MessageSquarePlus, Paperclip, Play, Send, Sparkles, Square, TriangleAlert, X } from "lucide-react";

import { lerArquivoBase64, lugiaService, type AnexoEnvio } from "@/react-app/services/LugiaService";
import { descreverAcao, idDesconhecido, separarAcoes, type AcaoCaderno, type ItemConhecido } from "@/react-app/utils/chatCadernos";
import {
  agruparModelos, lerModeloPreferido, MAX_ANEXOS, modeloInicial, rotuloModelo, ROTULO_PROVEDOR, salvarModeloPreferido, textoDaMensagem, validarArquivo,
  type MensagemTela, type ModeloIa,
} from "@/react-app/utils/lugia";

export type TipoAberto = "CADERNO" | "PLANILHA" | "DOCUMENTO";

interface Props {
  visivel: boolean;
  onFechar: () => void;
  /** Cadernos, planilhas e documentos da pessoa (para descrever as ações e recusar ids inventados). */
  itens: ItemConhecido[];
  /** O que está aberto na tela: vai junto na pergunta e tem prioridade na busca. */
  aberto: { tipo: TipoAberto; id: number } | null;
  /** Executa a ação confirmada; devolve a mensagem de erro (ou null quando deu certo). */
  onExecutar: (acao: AcaoCaderno) => Promise<string | null>;
}

interface AnexoLocal extends AnexoEnvio { chave: string }
type EstadoAcao = "fazendo" | "feito" | { erro: string };

const mensagemDe = (e: unknown, padrao: string) => (e instanceof Error && e.message ? e.message : padrao);
const armazenamento = () => (typeof window === "undefined" ? undefined : window.localStorage);

const SUGESTOES = [
  "Onde eu anotei sobre a concretagem?",
  "Resuma o que está aberto",
  "Monte uma planilha com os materiais que aparecem nos meus cadernos",
  "Passe a foto anexada para uma planilha",
];

/**
 * Chat dos cadernos (Bloco de notas v4): a Lugia pesquisa no Bloco de notas da pessoa, lê fotos e PDFs anexados e
 * sugere ações (abrir, criar, anotar, renomear) que só acontecem quando a pessoa toca em "Fazer". Usa as mesmas IAs
 * da Lugia; a conversa fica no histórico da Lugia com o título "Cadernos · …".
 */
export default function ChatCadernos({ visivel, onFechar, itens, aberto, onExecutar }: Props) {
  const [modelos, setModelos] = useState<ModeloIa[] | null>(null);
  const [modelo, setModelo] = useState<string | null>(null);
  const [idConversa, setIdConversa] = useState<number | null>(null);
  const [mensagens, setMensagens] = useState<MensagemTela[]>([]);
  const [texto, setTexto] = useState("");
  const [anexos, setAnexos] = useState<AnexoLocal[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [estados, setEstados] = useState<Record<string, EstadoAcao>>({});
  const [arrastando, setArrastando] = useState(false);
  const cancelar = useRef<AbortController | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLTextAreaElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  // Os modelos só carregam quando o chat abre pela primeira vez.
  useEffect(() => {
    if (!visivel || modelos !== null) return;
    lugiaService.modelos()
      .then(m => { setModelos(m.modelos); setModelo(modeloInicial(m.modelos, lerModeloPreferido(armazenamento()))); })
      .catch(e => { setModelos([]); setErro(mensagemDe(e, "Não foi possível conectar à Lugia.")); });
  }, [visivel, modelos]);
  useEffect(() => () => cancelar.current?.abort(), []);
  useEffect(() => { if (visivel) window.setTimeout(() => entrada.current?.focus({ preventScroll: true }), 50); }, [visivel]);
  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [mensagens]);

  const grupos = useMemo(() => agruparModelos(modelos ?? []), [modelos]);

  const anexar = async (arquivos: Iterable<File>) => {
    let total = anexos.length;
    for (const a of arquivos) {
      const problema = validarArquivo(a, total);
      if (problema) { setErro(problema); continue; }
      total++;
      try {
        const base64 = await lerArquivoBase64(a);
        setAnexos(l => [...l, { chave: `${a.name}-${a.lastModified}-${Math.random()}`, nome: a.name || "foto.png", mime: a.type, base64 }]);
      } catch (e) {
        setErro(mensagemDe(e, `Não foi possível ler ${a.name}.`));
      }
    }
    if (arquivo.current) arquivo.current.value = "";
  };

  const colar = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const imagens = Array.from(e.clipboardData.files).filter(f => f.type.startsWith("image/"));
    if (imagens.length) { e.preventDefault(); void anexar(imagens); }
  };
  const soltar = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setArrastando(false);
    if (e.dataTransfer.files.length) void anexar(Array.from(e.dataTransfer.files));
  };

  const novaConversa = () => {
    if (enviando) return;
    setIdConversa(null); setMensagens([]); setEstados({}); setErro(null);
  };

  const enviar = async (evento?: FormEvent, sugestao?: string) => {
    evento?.preventDefault();
    const pergunta = sugestao ?? texto;
    if (enviando || !modelo || (!pergunta.trim() && anexos.length === 0)) return;
    const daVez: MensagemTela = {
      papel: "usuario",
      partes: [
        ...anexos.map(a => (a.mime === "application/pdf" ? { tipo: "pdf" as const, nome: a.nome } : { tipo: "imagem" as const, nome: a.nome, mime: a.mime })),
        ...(pergunta.trim() ? [{ tipo: "texto" as const, texto: pergunta }] : []),
      ],
    };
    const pedido = {
      idConversa: idConversa ?? undefined, modelo, modo: "chat" as const, contexto: "cadernos" as const,
      tipoAberto: aberto?.tipo, idAberto: aberto?.id,
      texto: pergunta, anexos: anexos.map(({ nome, mime, base64 }) => ({ nome, mime, base64 })),
    };
    const provedor = modelos?.find(m => m.id === modelo)?.provedor;
    setMensagens(l => [...l, daVez, { papel: "assistente", provedor, partes: [{ tipo: "texto", texto: "" }] }]);
    setTexto(""); setAnexos([]); setErro(null); setEnviando(true);
    const controle = new AbortController();
    cancelar.current = controle;
    const naUltima = (f: (m: MensagemTela) => MensagemTela) => setMensagens(l => [...l.slice(0, -1), f(l[l.length - 1])]);
    try {
      await lugiaService.conversar(pedido, {
        onConversa: id => setIdConversa(id),
        onTexto: delta => naUltima(m => ({ ...m, partes: [{ tipo: "texto", texto: textoDaMensagem(m) + delta }] })),
        onFerramenta: passo => naUltima(m => ({ ...m, passos: [...(m.passos ?? []), passo].slice(-3) })),
        onProvedor: id => naUltima(m => ({ ...m, provedor: id })),
        onErro: m => setErro(m),
      }, controle.signal);
    } catch (e) {
      if (!controle.signal.aborted) setErro(mensagemDe(e, "Não foi possível enviar a mensagem."));
    } finally {
      setEnviando(false);
      cancelar.current = null;
      setMensagens(l => {
        const limpas = l.map(m => (m.passos ? { ...m, passos: undefined } : m));
        const ultima = limpas[limpas.length - 1];
        return ultima?.papel === "assistente" && !textoDaMensagem(ultima) ? limpas.slice(0, -1) : limpas;
      });
    }
  };

  const fazer = async (chave: string, acao: AcaoCaderno) => {
    setEstados(e => ({ ...e, [chave]: "fazendo" }));
    let resultado: string | null;
    try {
      resultado = await onExecutar(acao);
    } catch (e) {
      resultado = mensagemDe(e, "Não deu para fazer.");
    }
    setEstados(e => ({ ...e, [chave]: resultado ? { erro: resultado } : "feito" }));
    // No celular o chat cobre a tela: fecha para a pessoa ver o que foi feito (a conversa continua guardada).
    if (!resultado && window.matchMedia?.("(max-width: 639px)").matches) onFechar();
  };

  const tecla = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void enviar(); }
    if (e.key === "Escape") onFechar();
  };

  const nomeAberto = aberto ? itens.find(i => i.tipo === aberto.tipo.toLowerCase() && i.id === aberto.id)?.titulo : undefined;

  return (
    <aside aria-label="Chat dos cadernos" hidden={!visivel}
      onDragOver={e => { e.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)} onDrop={soltar}
      className={`${visivel ? "flex" : "hidden"} fixed inset-0 z-40 flex-col border-slate-200 bg-white shadow-2xl sm:inset-y-3 sm:left-auto sm:right-3 sm:w-[420px] sm:rounded-2xl sm:border`}>
      <header className="flex items-center gap-2 border-b border-slate-200 px-3 py-2.5">
        <span className="rounded-xl bg-blue-50 p-1.5"><Sparkles className="h-4 w-4 text-blue-600" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-slate-800">Lugia nos cadernos</h2>
          <p className="truncate text-[11px] text-slate-500">{nomeAberto ? `Olhando: ${nomeAberto}` : "Pesquisa e faz coisas no seu Bloco de notas"}</p>
        </div>
        <button type="button" onClick={novaConversa} disabled={enviando || mensagens.length === 0} title="Nova conversa" aria-label="Nova conversa"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40"><MessageSquarePlus className="h-4 w-4" /></button>
        <button type="button" onClick={onFechar} aria-label="Fechar o chat dos cadernos" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
      </header>

      <div className="relative min-h-0 flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
        {arrastando && (
          <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-blue-400 bg-blue-50/90 text-sm font-bold text-blue-700">
            Solte a foto ou o PDF aqui
          </div>
        )}
        {mensagens.length === 0 && (
          <div className="flex flex-col items-center gap-3 pt-6 text-center">
            <div className="rounded-2xl bg-blue-50 p-3"><Bot className="h-7 w-7 text-blue-600" /></div>
            <p className="max-w-xs text-sm text-slate-600">Pergunte sobre o que está nos seus cadernos, planilhas e documentos, mande uma foto ou peça para criar e anotar. Nada muda sem você tocar em <b>Fazer</b>.</p>
            <div className="flex flex-col gap-1.5">
              {SUGESTOES.map(s => (
                <button key={s} type="button" disabled={!modelo || enviando} onClick={() => void enviar(undefined, s)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
            <p className="max-w-xs text-[11px] text-slate-400">A Lugia lê as caixas de texto, os documentos e as planilhas. O que foi escrito à mão ainda não é lido.</p>
          </div>
        )}
        {mensagens.map((m, i) => {
          const doUsuario = m.papel === "usuario";
          const ultima = i === mensagens.length - 1;
          const { texto: corpo, acoes, pendente } = doUsuario ? { texto: textoDaMensagem(m), acoes: [], pendente: false } : separarAcoes(textoDaMensagem(m));
          return (
            <div key={i} className={`flex ${doUsuario ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${doUsuario ? "bg-blue-600 text-white" : "border border-slate-200 bg-slate-50 text-slate-800"}`}>
                {!doUsuario && m.provedor && <p className="mb-0.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">{ROTULO_PROVEDOR[m.provedor]}</p>}
                {m.partes.filter(p => p.tipo !== "texto").map((p, j) => (
                  <p key={j} className={`mb-1 flex items-center gap-1.5 text-xs ${doUsuario ? "text-blue-100" : "text-slate-500"}`}>
                    {p.tipo === "pdf" ? <FileText className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}{"nome" in p && p.nome ? p.nome : "Anexo"}
                  </p>
                ))}
                {corpo && <div className="whitespace-pre-wrap break-words leading-relaxed">{corpo}</div>}
                {m.passos?.map((p, j) => <p key={j} className="mt-1 truncate font-mono text-[11px] text-slate-500">{p}</p>)}
                {enviando && ultima && !doUsuario && (!corpo || pendente) && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />{pendente ? "Preparando as ações…" : "Pesquisando nos cadernos…"}</p>
                )}
                {acoes.length > 0 && (
                  <ul className="mt-2 space-y-1.5" aria-label="Ações sugeridas">
                    {acoes.map((a, j) => {
                      const chave = `${i}-${j}`;
                      const estado = estados[chave];
                      const inventado = idDesconhecido(a, itens);
                      return (
                        <li key={chave} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2">
                          <span className="min-w-0 flex-1 text-xs font-semibold text-slate-700">
                            {descreverAcao(a, itens)}
                            {inventado && <span className="block font-normal text-amber-700">Não achei esse item no seu Bloco de notas.</span>}
                            {estado && typeof estado === "object" && <span role="alert" className="block font-normal text-red-600">{estado.erro}</span>}
                          </span>
                          {estado === "feito" ? (
                            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-emerald-700"><Check className="h-3.5 w-3.5" />Feito</span>
                          ) : (
                            <button type="button" disabled={estado === "fazendo" || inventado || enviando} onClick={() => void fazer(chave, a)}
                              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40">
                              {estado === "fazendo" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                              {estado && typeof estado === "object" ? "Tentar de novo" : "Fazer"}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
        <div ref={fim} />
      </div>

      {erro && (
        <p role="alert" className="mx-3 mb-2 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span className="flex-1">{erro}</span>
          <button type="button" aria-label="Fechar aviso" onClick={() => setErro(null)}><X className="h-3.5 w-3.5" /></button>
        </p>
      )}

      <form onSubmit={e => void enviar(e)} className="border-t border-slate-200 p-3">
        {anexos.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-1.5">
            {anexos.map(a => (
              <li key={a.chave} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 py-0.5 pl-1.5 pr-0.5 text-xs text-slate-700">
                {a.mime === "application/pdf" ? <FileText className="h-3.5 w-3.5 text-red-600" /> : <img src={`data:${a.mime};base64,${a.base64}`} alt="" className="h-6 w-8 rounded object-cover" />}
                <span className="max-w-[8rem] truncate">{a.nome}</span>
                <button type="button" aria-label={`Remover ${a.nome}`} onClick={() => setAnexos(l => l.filter(x => x.chave !== a.chave))} className="rounded p-0.5 hover:bg-slate-200"><X className="h-3 w-3" /></button>
              </li>
            ))}
          </ul>
        )}
        <textarea ref={entrada} value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={tecla} onPaste={colar} rows={2} maxLength={20_000}
          aria-label="Pergunta para a Lugia sobre os cadernos" disabled={!modelo}
          placeholder={modelos?.length === 0 ? "Nenhuma IA disponível agora." : "Pergunte ou peça algo (cole ou solte uma foto)"}
          className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none disabled:bg-slate-50" />
        <div className="mt-2 flex items-center gap-2">
          <select value={modelo ?? ""} onChange={e => { setModelo(e.target.value); salvarModeloPreferido(armazenamento(), e.target.value); }}
            disabled={!modelos?.length || enviando} aria-label="IA que responde"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700">
            {modelos === null && <option value="">Carregando…</option>}
            {grupos.map(g => (
              <optgroup key={g.provedor} label={ROTULO_PROVEDOR[g.provedor]}>
                {g.modelos.map(m => <option key={m.id} value={m.id}>{rotuloModelo(m)}</option>)}
              </optgroup>
            ))}
          </select>
          <input ref={arquivo} type="file" multiple hidden accept="image/*,application/pdf" onChange={e => void anexar(Array.from(e.target.files ?? []))} />
          <button type="button" onClick={() => arquivo.current?.click()} disabled={enviando || anexos.length >= MAX_ANEXOS} aria-label="Anexar foto ou PDF" title="Anexar foto ou PDF"
            className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50"><Paperclip className="h-4 w-4" /></button>
          {enviando ? (
            <button type="button" onClick={() => cancelar.current?.abort()} aria-label="Parar"
              className="rounded-xl border border-slate-200 p-2 text-slate-700 hover:bg-slate-50"><Square className="h-4 w-4" /></button>
          ) : (
            <button type="submit" disabled={!modelo || (!texto.trim() && anexos.length === 0)} aria-label="Enviar"
              className="rounded-xl bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:opacity-50"><Send className="h-4 w-4" /></button>
          )}
        </div>
      </form>
    </aside>
  );
}
