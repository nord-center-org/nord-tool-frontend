import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { Apartamento, Lado, Ponto } from "@/react-app/utils/escadinha";
import {
  areaMolhada, arestas, comprimento, divisoriaDoApto, fachadaDoLado, portaDoApto, prumadasDoLado, sacadaDoApto, type Segmento,
} from "@/react-app/utils/escadinha3d";
import type { Camada, EstadoCamada } from "@/react-app/utils/escadinhaCury";

const ESPESSURA_LAJE = 0.25;
const PAREDE = 0.14;

// ---------------------------------------------------------------- texturas (desenhadas uma vez)

let texturas: { bloco: THREE.CanvasTexture; piso: THREE.CanvasTexture; madeira: THREE.CanvasTexture } | null = null;
function canvas(w: number, h: number, desenhar: (c: CanvasRenderingContext2D) => void) {
  const el = document.createElement("canvas");
  el.width = w;
  el.height = h;
  const c = el.getContext("2d");
  if (c) desenhar(c);
  const t = new THREE.CanvasTexture(el);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function obterTexturas() {
  if (texturas) return texturas;
  texturas = {
    // Bloco estrutural de concreto 39×19 com junta de argamassa, fiadas em amarração.
    bloco: canvas(128, 64, c => {
      c.fillStyle = "#d6d3d1";
      c.fillRect(0, 0, 128, 64);
      c.fillStyle = "#9ca3af";
      const blocos: [number, number][] = [[2, 2], [66, 2], [-30, 34], [34, 34], [98, 34]];
      for (const [x, y] of blocos) c.fillRect(x, y, 60, 28);
      c.fillStyle = "rgba(255,255,255,0.12)";
      for (const [x, y] of blocos) c.fillRect(x + 4, y + 4, 52, 6);
    }),
    piso: canvas(64, 64, c => {
      c.fillStyle = "#f5f0e6";
      c.fillRect(0, 0, 64, 64);
      c.strokeStyle = "#d6cdbb";
      c.lineWidth = 2;
      c.strokeRect(1, 1, 62, 62);
    }),
    madeira: canvas(64, 64, c => {
      c.fillStyle = "#b07a45";
      c.fillRect(0, 0, 64, 64);
      c.fillStyle = "#9a6638";
      for (let y = 0; y < 64; y += 16) c.fillRect(0, y, 64, 2);
      c.fillRect(20, 0, 2, 16); c.fillRect(44, 16, 2, 16); c.fillRect(12, 32, 2, 16); c.fillRect(52, 48, 2, 16);
    }),
  };
  return texturas;
}

/** Caixa de parede ao longo do segmento, com UV em metros (para a textura repetir no tamanho certo). */
function geometriaParede(s: Segmento, altura: number, espessura: number, escalaU: number, escalaV: number) {
  const g = new THREE.BoxGeometry(comprimento(s), altura, espessura);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * comprimento(s) / escalaU, uv.getY(i) * altura / escalaV);
  return g;
}
const posParede = (s: Segmento, y: number): [number, number, number] => [(s.a[0] + s.b[0]) / 2, y, -(s.a[1] + s.b[1]) / 2];
const angParede = (s: Segmento) => Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0]);

function forma(poly: Ponto[]) {
  const sh = new THREE.Shape();
  poly.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
  sh.closePath();
  return sh;
}
/** Placa horizontal (piso, forro, laje) no contorno, com UV em metros. */
function geometriaPlaca(poly: Ponto[], espessura: number, escalaUV = 1) {
  const g = new THREE.ExtrudeGeometry(forma(poly), { depth: espessura, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / escalaUV, uv.getY(i) / escalaUV);
  return g;
}

// ---------------------------------------------------------------- peças

/** Paredes de um lado: uma malha só (as paredes reais do projeto passam de 400 por pavimento). */
function Paredes({ segmentos, altura, cor, textura, opacidade = 1 }: { segmentos: Segmento[]; altura: number; cor?: string; textura?: THREE.Texture; opacidade?: number }) {
  const geo = useMemo(() => {
    const partes = segmentos.filter(s => comprimento(s) > 0.01).map(s => {
      const g = geometriaParede(s, altura, s.esp ?? PAREDE, 0.4, 0.2);
      g.rotateY(angParede(s));
      g.translate(...posParede(s, ESPESSURA_LAJE + altura / 2));
      return g;
    });
    const unida = partes.length ? mergeGeometries(partes) : null;
    partes.forEach(g => g.dispose());
    return unida;
  }, [segmentos, altura]);
  useEffect(() => () => geo?.dispose(), [geo]);
  if (!geo) return null;
  return (
    <mesh geometry={geo} castShadow>
      <meshStandardMaterial color={cor ?? "#ffffff"} map={cor ? null : textura ?? null} roughness={0.9} transparent={opacidade < 1} opacity={opacidade} />
    </mesh>
  );
}

/** Blocos soltos em cima da parede em execução (a fiada sendo assentada). */
function BlocosSendoColocados({ segmentos, altura }: { segmentos: Segmento[]; altura: number }) {
  const lista = useMemo(() => segmentos.slice(0, 60).flatMap(s => {
    const n = Math.max(1, Math.floor(comprimento(s) / 0.4 / 3));
    return Array.from({ length: n }, (_, k) => {
      const t = (k * 3 + 1) / Math.max(1, comprimento(s) / 0.4);
      return { x: s.a[0] + (s.b[0] - s.a[0]) * t, y: s.a[1] + (s.b[1] - s.a[1]) * t, ang: angParede(s) };
    });
  }), [segmentos]);
  return (
    <>
      {lista.map((b, i) => (
        <mesh key={i} position={[b.x, ESPESSURA_LAJE + altura + 0.1, -b.y]} rotation={[0, b.ang, 0]} castShadow>
          <boxGeometry args={[0.39, 0.19, 0.14]} />
          <meshStandardMaterial color="#9ca3af" roughness={0.9} />
        </mesh>
      ))}
    </>
  );
}

function Placa({ poly, y, espessura, cor, textura, escalaUV = 1, opacidade = 1 }: { poly: Ponto[]; y: number; espessura: number; cor: string; textura?: THREE.Texture; escalaUV?: number; opacidade?: number }) {
  const geo = useMemo(() => geometriaPlaca(poly, espessura, escalaUV), [poly, espessura, escalaUV]);
  return (
    <mesh geometry={geo} position={[0, y, 0]} receiveShadow>
      <meshStandardMaterial color={cor} map={textura ?? null} roughness={0.8} transparent={opacidade < 1} opacity={opacidade} />
    </mesh>
  );
}

// ---------------------------------------------------------------- pavimento

interface CamadasPavimentoProps {
  contorno: Ponto[];
  /** Metade da torre de cada lado (para pisos, laje e fachada). */
  metades: Record<Lado, Ponto[]>;
  apartamentos: Apartamento[];
  altura: number;
  nucleoC: Ponto;
  /** Estado das camadas por lado (E feito, X em execução). */
  estado: Record<Lado, Map<Camada, EstadoCamada> | undefined>;
  /** Camadas visíveis (null = todas). */
  filtro: Set<Camada> | null;
  /** Mostra os elevadores neste pavimento (só uma vez por pavimento). */
  comElevador: boolean;
  /** Paredes reais do projeto por lado (1ª fiada); sem elas, as paredes saem do contorno dos apartamentos. */
  paredesReais?: Record<Lado, Segmento[]> | null;
}

/**
 * O que já foi feito num pavimento, lado a lado: a alvenaria sobe em blocos (meia altura enquanto em execução),
 * a laje do teto fecha, entram esquadrias, prumadas, drywall, gesso, cerâmica, louças, portas, pintura e fachada.
 */
export default function CamadasPavimento({ contorno, metades, apartamentos, altura, nucleoC, estado, filtro, comElevador, paredesReais }: CamadasPavimentoProps) {
  const tex = obterTexturas();
  const util = Math.max(0.5, altura - ESPESSURA_LAJE);
  const mostra = (lado: Lado, c: Camada) => (filtro === null || filtro.has(c)) && estado[lado]?.get(c);

  const porLado = useMemo(() => (["A", "B"] as Lado[]).map(lado => {
    const aptos = apartamentos.filter(a => a.lado === lado);
    const paredes = paredesReais ? paredesReais[lado] : aptos.length ? (() => {
      const m = new Map<string, Segmento>();
      for (const ap of aptos) for (const s of arestas(ap.contorno)) {
        const k = [s.a, s.b].map(p => p.map(v => v.toFixed(2)).join(",")).sort().join("|");
        m.set(k, s);
      }
      return [...m.values()];
    })() : arestas(metades[lado]);
    return {
      lado, aptos, paredes,
      fachada: metades[lado].length >= 3 ? fachadaDoLado(contorno, metades[lado]) : [],
      prumadas: prumadasDoLado(apartamentos, lado, contorno, nucleoC),
    };
  }), [apartamentos, metades, contorno, nucleoC, paredesReais]);

  return (
    <group>
      {porLado.map(({ lado, aptos, paredes, fachada, prumadas }) => {
        const alv = mostra(lado, "alvenaria");
        const pintado = mostra(lado, "pintura") === "E";
        const escorado = mostra(lado, "escoramento") === "E" && !estado[lado]?.has("desescoramento");
        const metade = metades[lado];
        return (
          <group key={lado}>
            {alv && (
              <>
                <Paredes segmentos={paredes} altura={alv === "E" ? util : util * 0.45} textura={tex.bloco} cor={pintado ? "#f5efe2" : undefined} />
                {alv === "X" && <BlocosSendoColocados segmentos={paredes} altura={util * 0.45} />}
              </>
            )}
            {mostra(lado, "laje") && metade.length >= 3 && (
              <Placa poly={metade} y={altura - 0.02} espessura={0.12} cor="#cbd5e1" opacidade={mostra(lado, "laje") === "E" ? 1 : 0.45} />
            )}
            {escorado && metade.length >= 3 && aptos.flatMap(ap => {
              const [cx, cy] = [(ap.contorno[0][0] + ap.contorno[2 % ap.contorno.length][0]) / 2, (ap.contorno[0][1] + ap.contorno[2 % ap.contorno.length][1]) / 2];
              return [-1, 1].flatMap(dx => [-1, 1].map(dy => (
                <mesh key={`${ap.id}${dx}${dy}`} position={[cx + dx, ESPESSURA_LAJE + util / 2, -(cy + dy)]}>
                  <cylinderGeometry args={[0.04, 0.04, util, 6]} />
                  <meshStandardMaterial color="#f59e0b" />
                </mesh>
              )));
            })}
            {mostra(lado, "contrapiso") && aptos.map(ap => <Placa key={`cp${ap.id}`} poly={sacadaDoApto(ap, nucleoC)} y={ESPESSURA_LAJE} espessura={0.04} cor="#a8a29e" />)}
            {mostra(lado, "impermeabilizacao") && aptos.map(ap => <Placa key={`im${ap.id}`} poly={areaMolhada(ap, nucleoC)} y={ESPESSURA_LAJE + 0.01} espessura={0.02} cor="#3b82f6" opacidade={0.85} />)}
            {mostra(lado, "piso") && aptos.map(ap => <Placa key={`pi${ap.id}`} poly={ap.contorno} y={ESPESSURA_LAJE + 0.02} espessura={0.02} cor="#ffffff" textura={tex.madeira} escalaUV={1.2} />)}
            {mostra(lado, "ceramica") && aptos.flatMap(ap => [
              <Placa key={`ce${ap.id}`} poly={areaMolhada(ap, nucleoC)} y={ESPESSURA_LAJE + 0.035} espessura={0.02} cor="#ffffff" textura={tex.piso} escalaUV={0.6} />,
              <Placa key={`cs${ap.id}`} poly={sacadaDoApto(ap, nucleoC)} y={ESPESSURA_LAJE + 0.045} espessura={0.02} cor="#ffffff" textura={tex.piso} escalaUV={0.6} />,
            ])}
            {mostra(lado, "drywall") && <Paredes segmentos={aptos.map(divisoriaDoApto)} altura={util} cor={pintado ? "#f5efe2" : "#f1f5f9"} opacidade={mostra(lado, "drywall") === "E" ? 1 : 0.5} />}
            {mostra(lado, "gesso") && aptos.map(ap => <Placa key={`ge${ap.id}`} poly={ap.contorno} y={altura - 0.3} espessura={0.02} cor="#ffffff" opacidade={0.7} />)}
            {mostra(lado, "esquadria") && fachada.flatMap((s, i) => {
              const n = Math.max(1, Math.floor(comprimento(s) / 3.2));
              return Array.from({ length: n }, (_, k) => {
                const t = (k + 0.5) / n;
                return (
                  <mesh key={`es${i}-${k}`} position={[s.a[0] + (s.b[0] - s.a[0]) * t, ESPESSURA_LAJE + 1.55, -(s.a[1] + (s.b[1] - s.a[1]) * t)]} rotation={[0, angParede(s), 0]}>
                    <boxGeometry args={[1.5, 1.2, 0.18]} />
                    <meshStandardMaterial color="#7dd3fc" transparent opacity={0.7} metalness={0.3} roughness={0.1} />
                  </mesh>
                );
              });
            })}
            {mostra(lado, "fachada") && <Paredes segmentos={fachada.map(s => ({ ...s }))} altura={util + ESPESSURA_LAJE - 0.02} cor="#e7dcc8" />}
            {(["hidraulica", "gas", "incendio"] as Camada[]).map((c, ci) => mostra(lado, c) && prumadas.map((p, i) => (
              <mesh key={`${c}${i}`} position={[p[0] + ci * 0.18, util / 2 + ESPESSURA_LAJE, -p[1]]}>
                <cylinderGeometry args={[0.06, 0.06, util + ESPESSURA_LAJE, 8]} />
                <meshStandardMaterial color={c === "gas" ? "#facc15" : c === "incendio" ? "#dc2626" : "#22c55e"} />
              </mesh>
            )))}
            {mostra(lado, "eletrica") && aptos.map(ap => {
              const { p, angulo } = portaDoApto(ap, nucleoC);
              return (
                <mesh key={`el${ap.id}`} position={[p[0], ESPESSURA_LAJE + 1.6, -p[1]]} rotation={[0, angulo, 0]}>
                  <boxGeometry args={[0.4, 0.5, 0.2]} />
                  <meshStandardMaterial color="#f97316" />
                </mesh>
              );
            })}
            {mostra(lado, "portas") && aptos.map(ap => {
              const { p, angulo } = portaDoApto(ap, nucleoC);
              return (
                <mesh key={`po${ap.id}`} position={[p[0], ESPESSURA_LAJE + 1.05, -p[1]]} rotation={[0, angulo, 0]}>
                  <boxGeometry args={[0.85, 2.1, 0.2]} />
                  <meshStandardMaterial color="#92400e" />
                </mesh>
              );
            })}
            {(mostra(lado, "loucas") || mostra(lado, "metais")) && aptos.map(ap => {
              const m = areaMolhada(ap, nucleoC);
              const [x, y] = [(m[0][0] + m[2][0]) / 2, (m[0][1] + m[2][1]) / 2];
              return (
                <group key={`lo${ap.id}`} position={[x, ESPESSURA_LAJE + 0.06, -y]}>
                  {mostra(lado, "loucas") && (
                    <>
                      <mesh position={[-0.4, 0.2, 0]}><boxGeometry args={[0.4, 0.4, 0.6]} /><meshStandardMaterial color="#ffffff" roughness={0.2} /></mesh>
                      <mesh position={[0.5, 0.42, 0]}><boxGeometry args={[0.9, 0.08, 0.5]} /><meshStandardMaterial color="#e5e7eb" roughness={0.3} /></mesh>
                      <mesh position={[0.5, 0.2, 0]}><boxGeometry args={[0.8, 0.4, 0.45]} /><meshStandardMaterial color="#f8fafc" roughness={0.2} /></mesh>
                    </>
                  )}
                  {mostra(lado, "metais") && (
                    <mesh position={[0.5, 0.6, -0.15]}><cylinderGeometry args={[0.03, 0.03, 0.28, 8]} /><meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.15} /></mesh>
                  )}
                </group>
              );
            })}
          </group>
        );
      })}
      {comElevador && (filtro === null || filtro.has("elevador")) && (estado.A?.get("elevador") || estado.B?.get("elevador")) && (
        <mesh position={[nucleoC[0], ESPESSURA_LAJE + util / 2, -nucleoC[1]]}>
          <boxGeometry args={[1.6, util, 1.6]} />
          <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.3} />
        </mesh>
      )}
    </group>
  );
}
