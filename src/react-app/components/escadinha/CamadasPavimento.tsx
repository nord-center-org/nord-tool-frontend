import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import {
  dentro, type AberturaPlanta, type Apartamento, type ComodoPlanta, type Lado, type ParedeReal, type Ponto, type SacadaPlanta, type VaoFachada,
} from "@/react-app/utils/escadinha";
import { centroide } from "@/react-app/utils/escadinhaApto";
import {
  areaMolhada, arestas, comprimento, divisoriaDoApto, fachadaDoLado, portaDoApto, prumadasDoLado, sacadaDoApto, type Segmento,
} from "@/react-app/utils/escadinha3d";
import type { Camada, EstadoCamada } from "@/react-app/utils/escadinhaCury";

import { lugaresDosIcones, pecasDaPlanta, type Pecas } from "@/react-app/utils/escadinhaPecas";

import PecasPavimento, { type IconeChao } from "./PecasPavimento";
import { ESCALA_FOTO, obterTexturas } from "./texturas3d";

const ESPESSURA_LAJE = 0.25;
const PAREDE = 0.14;

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
      const g = geometriaParede(s, altura, s.esp ?? PAREDE, ESCALA_FOTO, ESCALA_FOTO);
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

// ---------------------------------------------------------------- janelas e cômodos

/** Caixilhos ao longo da fachada (a 1ª fiada não mostra as janelas: uma a cada ~3,2 m, peitoril a 1,0 m). */
function Janelas({ fachada }: { fachada: Segmento[] }) {
  return (
    <>
      {fachada.flatMap((s, i) => {
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
    </>
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
  /** Corta as paredes nesta altura (m) para ver o interior, como o corte a 1,35 m do estudo do Juan. */
  corte?: number | null;
  /** Cômodos e portas lidos das paredes: piso, cerâmica, forro e portas saem deles em vez do croqui. */
  comodos?: ComodoPlanta[];
  aberturas?: AberturaPlanta[];
  /** Esconde laje e forro para ver o interior (vista do pavimento). */
  tetoAberto?: boolean;
  /**
   * Projeto lido (paredes com janelas, sacadas) e o estado de cada elemento por lado: com eles, cada atividade da
   * escadinha acrescenta a sua peça (sem eles, fica o croqui por camadas).
   */
  planta?: { paredes: ParedeReal[]; vaos: VaoFachada[]; sacadas: SacadaPlanta[] } | null;
  elementos?: Record<Lado, Map<string, EstadoCamada> | undefined>;
  filtroElementos?: Set<string> | null;
  icones?: IconeChao[];
  /** Só um apartamento (vista do apartamento em 3D). */
  soApto?: string | null;
}

/** Peças da planta por lado (e por apartamento), guardadas por planta: todos os pavimentos tipo usam as mesmas. */
const cachePecas = new WeakMap<object, Map<string, { pecas: Pecas; lugares: { aptos: Ponto[]; hall: Ponto[] } }>>();
function pecasDoLado(comodos: ComodoPlanta[], aberturas: AberturaPlanta[], planta: NonNullable<CamadasPavimentoProps["planta"]>, contorno: Ponto[], metade: Ponto[], altura: number, chave: string, soApto: string | null) {
  const porPlanta = cachePecas.get(comodos) ?? new Map();
  cachePecas.set(comodos, porPlanta);
  const k = `${chave}|${altura.toFixed(2)}|${soApto ?? ""}|${planta.paredes.length}|${metade.length}`;
  const pronto = porPlanta.get(k);
  if (pronto) return pronto;
  const doApto = soApto ? comodos.filter(c => c.apto === soApto) : null;
  const filtro = doApto
    ? (p: Ponto) => doApto.some(c => dentroComFolga(p, c.contorno))
    : metade.length >= 3 ? (p: Ponto) => dentro(p, metade) : undefined;
  const base = { comodos: doApto ?? comodos, aberturas, paredes: planta.paredes, vaos: planta.vaos, sacadas: planta.sacadas, contorno, altura, filtro };
  const r = { pecas: pecasDaPlanta(base), lugares: lugaresDosIcones(base) };
  porPlanta.set(k, r);
  return r;
}

/** Ponto dentro do cômodo ou a até ~25 cm da borda dele (paredes, portas e janelas ficam na borda). */
function dentroComFolga(p: Ponto, poly: Ponto[]) {
  if (dentro(p, poly)) return true;
  return poly.some((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const l2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l2)) : 0;
    return Math.hypot(p[0] - (a[0] + t * (b[0] - a[0])), p[1] - (a[1] + t * (b[1] - a[1]))) < 0.25;
  });
}

/**
 * O que já foi feito num pavimento, lado a lado: a alvenaria sobe em blocos (meia altura enquanto em execução),
 * a laje do teto fecha, entram esquadrias, prumadas, drywall, gesso, cerâmica, louças, portas, pintura e fachada.
 */
export default function CamadasPavimento({
  contorno, metades, apartamentos, altura, nucleoC, estado, filtro, comElevador, paredesReais, comodos, aberturas, tetoAberto = false, corte = null,
  planta = null, elementos, filtroElementos = null, icones = [], soApto = null,
}: CamadasPavimentoProps) {
  const tex = obterTexturas();
  const util = Math.min(Math.max(0.5, altura - ESPESSURA_LAJE), corte ?? Infinity);
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
    const doLado = (p: Ponto) => metades[lado].length < 3 || dentro(p, metades[lado]);
    const salas = (comodos ?? []).filter(c => doLado(centroide(c.contorno)));
    return {
      lado, aptos, paredes, salas,
      fachada: metades[lado].length >= 3 ? fachadaDoLado(contorno, metades[lado]) : [],
      prumadas: prumadasDoLado(apartamentos, lado, contorno, nucleoC),
    };
  }), [apartamentos, metades, contorno, nucleoC, paredesReais, comodos]);

  return (
    <group>
      {porLado.map(({ lado, aptos, paredes, fachada, prumadas, salas }) => {
        const alv = mostra(lado, "alvenaria");
        const pintado = mostra(lado, "pintura") === "E";
        const escorado = mostra(lado, "escoramento") === "E" && !estado[lado]?.has("desescoramento");
        const metade = metades[lado];
        if (salas.length && planta && elementos) {
          if (soApto && !aptos.some(a => a.id === soApto)) return null;
          const est = elementos[lado];
          const vis = (el: string) => (filtroElementos === null || filtroElementos.has(el)) && est?.get(el);
          const { pecas, lugares } = pecasDoLado(comodos ?? [], aberturas ?? [], planta, contorno, soApto ? [] : metade, util, lado, soApto);
          const laje = vis("laje");
          const contornoLaje = soApto ? apartamentos.find(a => a.id === soApto)?.contorno ?? [] : metade;
          return (
            <group key={lado}>
              {!soApto && planta.sacadas.filter(sc => metade.length < 3 || dentro(centroide(sc.contorno), metade)).map((sc, i) => (
                <Placa key={`sb${i}`} poly={sc.contorno} y={0} espessura={ESPESSURA_LAJE - 0.04} cor="#cbd5e1" />
              ))}
              {!tetoAberto && corte === null && laje && contornoLaje.length >= 3 && (
                <Placa poly={contornoLaje} y={altura - 0.02} espessura={0.12} cor="#e2e8f0" textura={tex.concreto} escalaUV={ESCALA_FOTO * 2} opacidade={laje === "E" ? 1 : 0.45} />
              )}
              <PecasPavimento pecas={pecas} estado={est} filtro={filtroElementos} icones={icones} lugares={lugares} tetoAberto={tetoAberto} corte={corte} />
            </group>
          );
        }
        return (
          <group key={lado}>
            {alv && (
              <>
                <Paredes segmentos={paredes} altura={alv === "E" ? util : util * 0.45} textura={tex.bloco} cor={pintado ? "#f5efe2" : undefined} />
                {alv === "X" && <BlocosSendoColocados segmentos={paredes} altura={util * 0.45} />}
              </>
            )}
            {!tetoAberto && mostra(lado, "laje") && metade.length >= 3 && (
              <Placa poly={metade} y={altura - 0.02} espessura={0.12} cor="#e2e8f0" textura={tex.concreto} escalaUV={ESCALA_FOTO * 2} opacidade={mostra(lado, "laje") === "E" ? 1 : 0.45} />
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
              <Placa key={`ce${ap.id}`} poly={areaMolhada(ap, nucleoC)} y={ESPESSURA_LAJE + 0.035} espessura={0.02} cor="#ffffff" textura={tex.piso} escalaUV={ESCALA_FOTO} />,
              <Placa key={`cs${ap.id}`} poly={sacadaDoApto(ap, nucleoC)} y={ESPESSURA_LAJE + 0.045} espessura={0.02} cor="#ffffff" textura={tex.piso} escalaUV={ESCALA_FOTO} />,
            ])}
            {mostra(lado, "drywall") && <Paredes segmentos={aptos.map(divisoriaDoApto)} altura={util} cor={pintado ? "#f5efe2" : "#f1f5f9"} opacidade={mostra(lado, "drywall") === "E" ? 1 : 0.5} />}
            {!tetoAberto && mostra(lado, "gesso") && aptos.map(ap => <Placa key={`ge${ap.id}`} poly={ap.contorno} y={altura - 0.3} espessura={0.02} cor="#ffffff" opacidade={0.7} />)}
            {mostra(lado, "esquadria") && <Janelas fachada={fachada} />}
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
      {comElevador && !(planta && elementos && comodos?.length) && (filtro === null || filtro.has("elevador")) && (estado.A?.get("elevador") || estado.B?.get("elevador")) && (
        <mesh position={[nucleoC[0], ESPESSURA_LAJE + util / 2, -nucleoC[1]]}>
          <boxGeometry args={[1.6, util, 1.6]} />
          <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.3} />
        </mesh>
      )}
    </group>
  );
}
