import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Box, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";

import Campo, { classeInput } from "@/react-app/components/casamento/Campo";
import ModalBase from "@/react-app/components/casamento/ModalBase";
import EditorCubicagem from "@/react-app/components/cubicagem/EditorCubicagem";
import CabecalhoPagina from "@/react-app/components/ui/CabecalhoPagina";
import { cubicagemService as servico, type Cubicagem } from "@/react-app/services/CubicagemService";

const mensagem = (e: unknown, padrao: string) => (e instanceof Error && e.message ? e.message : padrao);
const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

function NovaCubicagemModal({ onCriar, onFechar }: { onCriar: (titulo: string) => Promise<string | null>; onFechar: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return setErro("Dê um nome à cubicagem.");
    setSalvando(true);
    const m = await onCriar(titulo.trim());
    setSalvando(false);
    if (m) setErro(m);
  };
  return (
    <ModalBase titulo="Nova cubicagem" onFechar={onFechar}>
      <form onSubmit={e => void enviar(e)} className="space-y-4">
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <Campo rotulo="Nome" dica="Ex.: a obra e o pavimento do projeto.">
          <input autoFocus value={titulo} maxLength={120} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Torre A · 3º pavimento" className={classeInput} />
        </Campo>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onFechar} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">Cancelar</button>
          <button type="submit" disabled={salvando} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}Criar
          </button>
        </div>
      </form>
    </ModalBase>
  );
}

/** Cubicagem: volume de concreto (m³) das peças de um projeto em PDF. Cada pessoa vê só as suas. */
export default function CubicagemPage() {
  const [lista, setLista] = useState<Cubicagem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<number | null>(null);
  const [nova, setNova] = useState(false);
  const [busca, setBusca] = useState("");

  const carregar = useCallback(() => {
    servico.listar().then(setLista).catch(e => setErro(mensagem(e, "Não deu para carregar as cubicagens.")));
  }, []);
  useEffect(carregar, [carregar]);

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (lista ?? []).filter(c => !t || c.nmTitulo.toLowerCase().includes(t));
  }, [lista, busca]);

  if (aberta != null) return <div className="p-3 sm:p-6"><EditorCubicagem id={aberta} onVoltar={() => { setAberta(null); carregar(); }} /></div>;

  const excluir = async (c: Cubicagem) => {
    if (!window.confirm(`Excluir a cubicagem "${c.nmTitulo}" com todas as peças?`)) return;
    try { await servico.excluir(c.id); carregar(); } catch (e) { setErro(mensagem(e, "Não deu para excluir.")); }
  };

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <CabecalhoPagina icone={Box} titulo="Cubicagem" subtitulo="Volume de concreto das peças do projeto, em m³"
        acoes={<button type="button" onClick={() => setNova(true)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"><Plus className="h-4 w-4" />Nova cubicagem</button>} />
      {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {lista && lista.length > 4 && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar pelo nome" aria-label="Buscar cubicagem" className={`${classeInput} pl-9`} />
        </div>
      )}
      {!lista && !erro && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</p>}
      {lista && !lista.length && (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
          <Box className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-2 font-bold text-slate-700">Nenhuma cubicagem ainda</p>
          <p className="mt-1 text-sm text-slate-500">Crie uma, abra o PDF do projeto e busque a peça pelo código (V12, P5, L3): o volume sai em m³, com totais por tipo, descontos e perda.</p>
          <button type="button" onClick={() => setNova(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"><Plus className="h-4 w-4" />Nova cubicagem</button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtradas.map(c => (
          <article key={c.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 hover:border-blue-300">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setAberta(c.id)}>
              <h3 className="truncate font-bold text-slate-800">{c.nmTitulo}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{c.qtPecas ?? 0} {c.qtPecas === 1 ? "peça" : "peças"} · perda {Number(c.nrPerda).toLocaleString("pt-BR")}% · {quando(c.dhAlteracao)}</p>
            </button>
            <button type="button" aria-label={`Abrir ${c.nmTitulo}`} onClick={() => setAberta(c.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
            <button type="button" aria-label={`Excluir ${c.nmTitulo}`} onClick={() => void excluir(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
          </article>
        ))}
      </div>
      {nova && <NovaCubicagemModal onFechar={() => setNova(false)} onCriar={async titulo => {
        try { const c = await servico.criar(titulo); setNova(false); setAberta(c.id); return null; } catch (e) { return mensagem(e, "Não deu para criar."); }
      }} />}
    </div>
  );
}
