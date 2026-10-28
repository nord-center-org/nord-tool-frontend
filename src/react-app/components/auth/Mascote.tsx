import Avatar from "@/react-app/components/avatar/Avatar";
import { FUNCOES, PELES, avatarPadrao, tom, type AvatarConfig, type DataComemorativa } from "@/react-app/utils/avatar";
import "./TelaPublica.css";

export type Humor = "normal" | "tapando" | "espiando" | "triste" | "feliz";

const BASE: AvatarConfig = {
  ...avatarPadrao(1),
  pele: "p4", cabelo: "curto", corCabelo: "castanho", olhos: "normal", boca: "sorriso", barba: "nenhuma", sobrancelha: "normal",
  corOlhos: "castanho", acessorio: "nenhum", detalhe: "nenhum", corCapacete: "funcao", funcao: "engenheiro", capacete: true, fundo: "azul", datas: true,
};

/** Mascote do login: espia por cima do cartão, tapa os olhos na senha, comemora ao entrar. */
export default function Mascote({ humor, tema }: { humor: Humor; tema: DataComemorativa | null }) {
  const config: AvatarConfig = {
    ...BASE,
    boca: humor === "triste" ? "seria" : humor === "feliz" ? "aberta" : "sorriso",
    olhos: humor === "feliz" ? "feliz" : "normal",
  };
  const pele = PELES[config.pele];
  const camisa = FUNCOES[config.funcao].camisa;
  const maos = humor === "tapando" || humor === "espiando";

  // Mão em vetor (mesma escala 100×100 do avatar): manga, mão e dedos.
  const mao = (x0: number, baixa: boolean, espelhar: boolean) => (
    <g className="nt-mao" style={{ transform: maos ? (baixa ? "translateY(12px)" : "none") : "translateY(70px)" }}>
      <g transform={espelhar ? `translate(${2 * x0 + 18} 0) scale(-1 1)` : undefined}>
        <path d={`M${x0 + 2} 100 L${x0 + 3} 58 C${x0 + 3} 55 ${x0 + 15} 55 ${x0 + 15} 58 L${x0 + 16} 100 Z`} fill={camisa} stroke={tom(camisa, -0.35)} strokeWidth="1.2" />
        <path d={`M${x0} 50 C${x0} 40 ${x0 + 2} 34 ${x0 + 9} 34 C${x0 + 16} 34 ${x0 + 18} 40 ${x0 + 18} 50 C${x0 + 18} 56 ${x0 + 14} 59 ${x0 + 9} 59 C${x0 + 4} 59 ${x0} 56 ${x0} 50 Z`}
          fill={pele} stroke={tom(pele, -0.42)} strokeWidth="1.1" />
        <path d={`M${x0 + 4.5} 36 L${x0 + 4.5} 46 M${x0 + 9} 35 L${x0 + 9} 46 M${x0 + 13.5} 36 L${x0 + 13.5} 46`} stroke={tom(pele, -0.25)} strokeWidth="1" strokeLinecap="round" />
        <ellipse cx={x0 + 6} cy="40" rx="2" ry="3" fill="#fff" opacity="0.2" />
      </g>
    </g>
  );

  return (
    <div className={`relative h-24 w-24 ${humor === "feliz" ? "nt-comemora" : humor === "triste" ? "nt-nega" : ""}`}>
      <Avatar config={config} tema={tema} tamanho={96} animado semFundo className="block drop-shadow-[0_4px_6px_rgba(15,23,42,0.35)]" rotulo="Mascote do NordTool" />
      <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        {mao(31, false, false)}
        {mao(51, humor === "espiando", true)}
      </svg>
    </div>
  );
}
