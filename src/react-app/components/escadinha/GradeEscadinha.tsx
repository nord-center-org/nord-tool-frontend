import { Download, Lock } from "lucide-react";
import { useMemo, useState, type MouseEvent } from "react";

import MenuCelula, { type AlvoCelula } from "./MenuCelula";
import {
  COR_STATUS, LEGENDA, chaveCelula, type Avaliacao, type Grade, type LinhaGrade, type ModeloEscadinha, type StatusMarcado,
} from "@/react-app/utils/escadinhaCury";

interface GradeEscadinhaProps {
  modelo: ModeloEscadinha;
  linhas: LinhaGrade[];
  grade: Grade;
  avaliacao: Map<string, Avaliacao>;
  editavel: boolean;
  hoje: string;
  nomeTorre: string;
  /** Mostra só um ciclo (id) ou todos. */
  ciclo: string | null;
  onMarcar: (chaves: string[], status: StatusMarcado | "", data?: string) => void;
}

const dataBr = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
const nomeLinha = (l: LinhaGrade) => `${l.pavimento.tipo === "tipo" ? `${l.pavimento.sigla}º` : l.pavimento.nome} — Lado ${l.lado}`;
/** Texto escuro ou claro conforme o fundo do ciclo. */
const textoSobre = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150 ? "#0f172a" : "#ffffff";
};

/**
 * A Escadinha no formato da Cury: ciclos coloridos no topo, atividades em pé, pavimento/lado nas linhas.
 * Cor = status calculado; cadeado = esperando a etapa anterior; ponto rosa = meta do período. Clique muda o status.
 */
export default function GradeEscadinha({ modelo, linhas, grade, avaliacao, editavel, hoje, nomeTorre, ciclo, onMarcar }: GradeEscadinhaProps) {
  const [alvo, setAlvo] = useState<AlvoCelula | null>(null);
  const ciclos = useMemo(() => modelo.ciclos.filter(c => !ciclo || c.id === ciclo), [modelo, ciclo]);

  const abrir = (e: MouseEvent, l: LinhaGrade, idAtividade: string, nomeAtividade: string) => {
    if (!editavel) return;
    const outro = l.lado === "A" ? "B" : "A";
    setAlvo({
      chaves: [chaveCelula(l.pavimento.id, l.lado, idAtividade)],
      chaveOutroLado: linhas.some(x => x.pavimento.id === l.pavimento.id && x.lado === outro) ? chaveCelula(l.pavimento.id, outro, idAtividade) : undefined,
      titulo: nomeAtividade,
      subtitulo: nomeLinha(l),
      x: e.clientX + 8,
      y: e.clientY + 8,
    });
  };

  const exportar = async () => {
    const XLSX = await import("xlsx");
    const atividades = ciclos.flatMap(c => c.atividades.map(a => ({ c, a })));
    const ROT: Record<string, string> = Object.fromEntries(LEGENDA.map(l => [l.status, l.rotulo]));
    const linhasPlanilha = [
      ["Pav. / Lado", ...atividades.map(x => x.c.nome)],
      ["", ...atividades.map(x => x.a.nome)],
      ...linhas.map(l => [nomeLinha(l), ...atividades.map(({ a }) => {
        const k = chaveCelula(l.pavimento.id, l.lado, a.id);
        const av = avaliacao.get(k);
        const c = grade[k];
        return av ? `${ROT[av.status]}${c?.s === "E" && c.d ? ` (${dataBr(c.d)})` : ""}` : "";
      })]),
    ];
    const planilha = XLSX.utils.aoa_to_sheet(linhasPlanilha);
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, "Escadinha");
    XLSX.writeFile(livro, `escadinha-${nomeTorre.replace(/[^\w-]+/g, "-").toLowerCase()}-${hoje}.xlsx`);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-300">
        {LEGENDA.map(l => (
          <span key={l.status} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm border border-slate-500" style={{ background: l.cor }} /> {l.rotulo}
          </span>
        ))}
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-pink-500" /> Meta do período</span>
        <button type="button" onClick={() => void exportar()}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-100 hover:bg-slate-700">
          <Download className="h-3.5 w-3.5" /> Baixar Excel
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-700">
        <table className="border-separate border-spacing-0 text-[10px]">
          <thead className="sticky top-0 z-20">
            <tr>
              <th rowSpan={2} className="sticky left-0 z-30 min-w-[7.5rem] border-b border-r border-slate-700 bg-indigo-900 px-2 text-left font-extrabold text-white">Pav. / Lado</th>
              {ciclos.map(c => (
                <th key={c.id} colSpan={c.atividades.length} style={{ background: c.cor, color: textoSobre(c.cor) }}
                  className="border-b border-r border-slate-800/40 px-1 py-1 text-center font-extrabold leading-tight">
                  {c.nome.toUpperCase()}
                  <span className="block text-[9px] font-semibold opacity-80">{c.metasAtivas ? `${c.dias}d · meta ${c.metaPav}` : "sem meta"}</span>
                </th>
              ))}
            </tr>
            <tr>
              {ciclos.flatMap(c => c.atividades.map(a => (
                <th key={a.id} title={a.nome} className="h-40 min-w-[2.1rem] max-w-[2.1rem] border-b border-r border-indigo-800 bg-indigo-700 align-bottom">
                  <div className="mx-auto flex h-40 w-[2.1rem] items-end justify-center pb-1">
                    <span className="block max-h-[9.2rem] overflow-hidden text-ellipsis whitespace-nowrap font-bold text-white [writing-mode:vertical-rl] rotate-180">
                      {a.nome}
                    </span>
                  </div>
                  {a.install && <span className="mb-1 block rounded bg-blue-500 px-0.5 text-[7px] font-extrabold text-white">INST</span>}
                </th>
              )))}
            </tr>
          </thead>
          <tbody>
            {linhas.map(l => (
              <tr key={`${l.pavimento.id}|${l.lado}`}>
                <th className={`sticky left-0 z-10 whitespace-nowrap border-r border-slate-700 bg-slate-900 px-2 py-1 text-left font-bold text-slate-100 ${l.lado === "B" ? "border-b border-b-slate-600" : ""}`}>
                  {nomeLinha(l)}
                </th>
                {ciclos.flatMap(c => c.atividades.map(a => {
                  const k = chaveCelula(l.pavimento.id, l.lado, a.id);
                  const av = avaliacao.get(k);
                  const cel = grade[k];
                  if (!av) return <td key={a.id} />;
                  const titulo = [
                    `${a.nome} · ${nomeLinha(l)}`,
                    LEGENDA.find(x => x.status === av.status)?.rotulo,
                    av.janela ? `Plano: ${dataBr(av.janela[0])} a ${dataBr(av.janela[1])}` : "",
                    cel?.s === "E" && cel.d ? `Executado em ${dataBr(cel.d)}` : "",
                  ].filter(Boolean).join("\n");
                  return (
                    <td key={a.id} className={`border-r border-slate-800 p-0 ${l.lado === "B" ? "border-b border-b-slate-600" : "border-b border-b-slate-800"}`}>
                      <button type="button" title={titulo} aria-label={titulo} disabled={!editavel} onClick={e => abrir(e, l, a.id, a.nome)}
                        style={{ background: COR_STATUS[av.status] }}
                        className={`relative flex h-7 w-full min-w-[2.1rem] items-center justify-center ${editavel ? "cursor-pointer hover:brightness-110" : "cursor-default"}`}>
                        {av.status === "bloqueado" && <Lock className="h-3 w-3 text-slate-400" aria-hidden="true" />}
                        {av.status === "na" && <span className="text-[8px] font-extrabold text-slate-600">N/A</span>}
                        {av.meta && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-pink-500" aria-hidden="true" />}
                      </button>
                    </td>
                  );
                }))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {alvo && <MenuCelula alvo={alvo} hoje={hoje} onMarcar={onMarcar} onFechar={() => setAlvo(null)} />}
    </div>
  );
}
