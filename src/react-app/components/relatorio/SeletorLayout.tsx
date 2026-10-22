import { LAYOUTS, layoutPorCodigo, type LayoutPagina } from "@/react-app/utils/relatorioFotografico";

/** Cores das montanhas por linha, como nas miniaturas de apps de relatório (verde, amarelo, vermelho, roxo). */
const MONTANHAS = [["#2f6b2f", "#4c9a3f"], ["#c9a227", "#f2d16b"], ["#b3261e", "#e0574c"], ["#6d4fc2", "#a58bf0"]];

/** Miniatura da página: folha com sombra, fotos (céu e montanhas) e linhas de texto embaixo ou ao lado. */
export function MiniaturaLayout({ layout, tamanho = 64 }: { layout: LayoutPagina; tamanho?: number }) {
  const retrato = layout.orientacao === "retrato";
  const [W, H] = retrato ? [60, 80] : [80, 60];
  const m = 4;
  const area = { x: m, y: m, w: W - 2 * m, h: H - 2 * m };
  const linhaDe = (y: number) => {
    const ys = [...new Set(layout.celulas.map(c => c.y))].sort((a, b) => a - b);
    return Math.max(0, ys.indexOf(y));
  };
  return (
    <svg viewBox={`0 0 ${W + 3} ${H + 3}`} width={retrato ? tamanho * 0.75 : tamanho} height={retrato ? tamanho : tamanho * 0.75} aria-hidden="true">
      <rect x="3" y="3" width={W} height={H} fill="#9ca3af" />
      <rect x="0.5" y="0.5" width={W - 1} height={H - 1} fill="#fffbea" stroke="#475569" strokeWidth="1" />
      {layout.celulas.map((c, i) => {
        const x = area.x + c.x * area.w + 1, y = area.y + c.y * area.h + 1, w = c.w * area.w - 2, h = c.h * area.h - 2;
        const direita = c.texto === "direita";
        const fw = direita ? w * 0.55 : w;
        const fh = direita ? h : h * 0.72;
        const [escura, clara] = MONTANHAS[linhaDe(c.y) % MONTANHAS.length];
        const linhasTexto = direita ? [0.15, 0.35, 0.55] : [0.82, 0.92];
        return (
          <g key={i}>
            <rect x={x} y={y} width={fw} height={fh} fill="#dff7fb" stroke="#334155" strokeWidth="0.8" />
            <path d={`M${x + 0.5} ${y + fh - 0.5} L${x + fw * 0.35} ${y + fh * 0.45} L${x + fw * 0.55} ${y + fh * 0.7} L${x + fw * 0.75} ${y + fh * 0.2} L${x + fw - 0.5} ${y + fh - 0.5} Z`} fill={escura} />
            <path d={`M${x + fw * 0.75} ${y + fh * 0.2} L${x + fw - 0.5} ${y + fh - 0.5} L${x + fw * 0.82} ${y + fh - 0.5} Z`} fill={clara} />
            {linhasTexto.map(t => direita
              ? <rect key={t} x={x + fw + 2} y={y + h * t} width={w - fw - 3} height="0.9" fill="#94a3b8" />
              : <rect key={t} x={x + 1} y={y + h * t} width={w - 2} height="0.9" fill="#94a3b8" />)}
          </g>
        );
      })}
    </svg>
  );
}

interface SeletorLayoutProps {
  valor: string;
  onMudar: (codigo: string) => void;
  desabilitado?: boolean;
  rotulo?: string;
}

/** Escolha do layout da página em faixa rolável (como no app de relatórios), com o nome do layout escolhido. */
export default function SeletorLayout({ valor, onMudar, desabilitado = false, rotulo = "Modelo da página" }: SeletorLayoutProps) {
  const atual = layoutPorCodigo(valor);
  return (
    <div>
      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 pt-1" role="radiogroup" aria-label={rotulo}>
        {LAYOUTS.map(l => {
          const marcado = l.codigo === atual.codigo;
          return (
            <button key={l.codigo} type="button" role="radio" aria-checked={marcado} aria-label={l.nome} title={l.nome} disabled={desabilitado}
              onClick={() => onMudar(l.codigo)}
              className={`flex shrink-0 snap-start flex-col items-center justify-end gap-2 rounded-2xl p-2 transition-all disabled:opacity-60 ${marcado ? "bg-blue-50 ring-2 ring-blue-500" : "hover:bg-slate-50"}`}>
              <MiniaturaLayout layout={l} tamanho={72} />
              <span className={`h-5 w-5 rounded-full border-2 ${marcado ? "border-blue-600 bg-blue-600 shadow-[inset_0_0_0_3px_white]" : "border-slate-400 bg-white"}`} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <p className="text-xs font-semibold text-slate-500">{atual.nome} · {atual.celulas.length} foto{atual.celulas.length === 1 ? "" : "s"} por página</p>
    </div>
  );
}
