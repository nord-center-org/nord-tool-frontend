import Avatar from "@/react-app/components/avatar/Avatar";
import { FUNCOES, PELES, avatarPadrao, tom, type AvatarConfig, type DataComemorativa } from "@/react-app/utils/avatar";
import "./TelaPublica.css";

export type Humor = "normal" | "tapando" | "espiando" | "triste" | "feliz";

const BASE: AvatarConfig = {
  ...avatarPadrao(1),
  pele: "p4", cabelo: "curto", corCabelo: "castanho", olhos: "normal", boca: "sorriso", barba: "nenhuma", sobrancelha: "normal",
  corOlhos: "castanho", acessorio: "nenhum", detalhe: "nenhum", corCapacete: "funcao", funcao: "engenheiro", capacete: true, fundo: "azul", datas: true,
};

const MAO = [".K.K.K.", "KSKSKSK", "KLSSSSK", "KSSSSSK", "KSsSsSK", ".KKKKK."];

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

  // Mão em pixel (mesma grade 32×32 do avatar): manga e mão com dedos.
  const contorno = tom(pele, -0.5);
  const mao = (x0: number, baixa: boolean) => (
    <g className="nt-mao" style={{ transform: maos ? (baixa ? "translateY(4px)" : "none") : "translateY(22px)" }}>
      <rect x={x0} y="17" width="6" height="15" fill={tom(camisa, -0.45)} />
      <rect x={x0 + 1} y="17" width="4" height="15" fill={camisa} />
      <rect x={x0 + 1} y="17" width="1" height="15" fill={tom(camisa, 0.22)} />
      {MAO.map((linha, i) => [...linha].map((c, j) => c === "." ? null : (
        <rect key={`${i}-${j}`} x={x0 + j} y={11 + i} width="1" height="1" fill={c === "K" ? contorno : c === "s" ? tom(pele, -0.18) : c === "L" ? tom(pele, 0.25) : pele} />
      )))}
    </g>
  );

  return (
    <div className={`relative h-24 w-24 ${humor === "feliz" ? "nt-comemora" : humor === "triste" ? "nt-nega" : ""}`}>
      <Avatar config={config} tema={tema} tamanho={96} animado semFundo className="block drop-shadow-[0_4px_6px_rgba(15,23,42,0.35)]" rotulo="Mascote do NordTool" />
      <svg viewBox="0 0 32 32" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" shapeRendering="crispEdges" aria-hidden="true">
        {mao(9, false)}
        {mao(16, humor === "espiando")}
      </svg>
    </div>
  );
}
