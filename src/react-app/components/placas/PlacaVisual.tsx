import { forwardRef } from "react";

import { FONTES, layoutPlaca, tamanhoDoTexto, type Caixa, type ConfigPlaca, type ImagemPlaca, type ValoresPlaca } from "@/react-app/utils/placas";

interface PlacaVisualProps {
  config: ConfigPlaca;
  valores: ValoresPlaca;
  /** Imagens do modelo (URL de objeto já baixada), ou null. */
  fundo: string | null;
  logo: string | null;
  /** v2: URL (data:) de cada imagem solta, pelo id; as que ainda não chegaram ficam de fora. */
  soltas?: Record<number, string>;
}

/** Imagem solta: no lugar, no tamanho e no giro guardados (esticada para o tamanho, como no Canva). */
function Solta({ i, url }: { i: ImagemPlaca; url?: string }) {
  if (!url) return null;
  return (
    <img src={url} alt="" draggable={false} style={{
      position: "absolute", left: i.x, top: i.y, width: i.w, height: i.h, objectFit: "fill",
      transform: i.rot ? `rotate(${i.rot}deg)` : undefined, transformOrigin: "center", pointerEvents: "none",
    }} />
  );
}

const pos = (c: Caixa) => ({ position: "absolute" as const, left: c.x, top: c.y, width: c.w, height: c.h });
const alinhar = { left: "flex-start", center: "center", right: "flex-end" } as const;

/**
 * A placa desenhada em tamanho de folha A4 (1123 × 794 px na horizontal). Quem mostra em tamanho menor usa
 * `transform: scale`; a exportação usa este mesmo desenho, em resolução maior.
 */
const PlacaVisual = forwardRef<HTMLDivElement, PlacaVisualProps>(function PlacaVisual({ config: c, valores: v, fundo, logo, soltas = {} }, ref) {
  const l = layoutPlaca(c);
  const linhas = v.linhas.length ? v.linhas : ["Escreva o texto da placa"];
  const tamanho = tamanhoDoTexto(c, linhas, l.quadro);
  const rodape = v.rodape.trim() || c.rodape.texto;
  // As do modelo embaixo das da placa; cada lista na ordem de empilhar.
  const todas = [...c.imagens, ...v.imagens];
  return (
    <div ref={ref} style={{ position: "relative", width: l.folha.largura, height: l.folha.altura, overflow: "hidden", background: c.fundo.cor, fontFamily: FONTES.calibri.css }}>
      {fundo && <img src={fundo} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
      <div style={{ position: "absolute", inset: 0, background: c.fundo.cor, opacity: fundo ? c.fundo.escurecer : 1 }} />
      {todas.filter(i => i.camada === "atras").map(i => <Solta key={i.id} i={i} url={soltas[i.img]} />)}

      {l.logo && logo && (
        <img src={logo} alt="" style={{ ...pos(l.logo), objectFit: "contain", objectPosition: c.orientacao === "paisagem" ? "left center" : "center" }} />
      )}

      {l.cabecalho && (
        <div style={{ ...pos(l.cabecalho), background: "#ffffff", borderRadius: 18, display: "flex", alignItems: "center", padding: "0 18px" }}>
          <div style={{ flex: 1, border: "1.5px solid #374151", height: 36, display: "flex", alignItems: "center", padding: "0 10px", fontWeight: 700, fontSize: 19, color: "#000", whiteSpace: "nowrap", overflow: "hidden" }}>
            {c.cabecalho.rotulo}{c.cabecalho.rotulo && v.cabecalho ? " " : ""}{v.cabecalho}
          </div>
        </div>
      )}

      <div style={{ ...pos(l.painel), background: c.painel.cor, borderRadius: c.painel.raio }} />

      <div style={{
        ...pos(l.quadro), border: c.quadro.borda ? `1.5px solid ${c.quadro.corBorda}` : "none", display: "flex", flexDirection: "column",
        justifyContent: "center", alignItems: alinhar[c.quadro.alinhamento], gap: tamanho * 0.45, padding: "0 24px", boxSizing: "border-box",
      }}>
        {linhas.map((t, i) => (
          <p key={i} style={{
            margin: 0, fontFamily: FONTES[c.quadro.fonte].css, fontWeight: c.quadro.negrito ? 700 : 400, fontSize: tamanho, lineHeight: 1.1,
            color: v.linhas.length ? c.quadro.corTexto : "#9ca3af", textAlign: c.quadro.alinhamento, overflowWrap: "anywhere",
          }}>{t}</p>
        ))}
      </div>

      {l.rodape && (
        <div style={{ ...pos(l.rodape), background: c.rodape.cor, color: c.rodape.corTexto, padding: "8px 12px", boxSizing: "border-box", overflow: "hidden" }}>
          {c.rodape.titulo && <p style={{ margin: 0, fontWeight: 700, fontSize: c.rodape.tamanho + 1 }}>{c.rodape.titulo}</p>}
          <p style={{ margin: "2px 0 0", fontSize: c.rodape.tamanho, lineHeight: 1.5, textAlign: "justify", whiteSpace: "pre-wrap" }}>{rodape}</p>
        </div>
      )}
      {todas.filter(i => i.camada === "frente").map(i => <Solta key={i.id} i={i} url={soltas[i.img]} />)}
    </div>
  );
});

export default PlacaVisual;
