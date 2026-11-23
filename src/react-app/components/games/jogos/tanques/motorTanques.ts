import * as THREE from "three";
import type { Entrada } from "@/react-app/utils/games/bombas";
import {
  BLINDAGEM, CELULA, GRADE, TAMANHO, celula, novaPartidaTanques, passoTanques, pontosTanques,
  type ArenaTanques, type EstadoTanques, type EventoTanques, type ModoTanques,
} from "@/react-app/utils/games/tanques";
import { desserializar, serializar } from "@/react-app/utils/games/espelho";
import type { FasePartida, GanchosMotor, MotorJogo, VagaJogo } from "../../comum/MolduraPartida";
import { som } from "../../audio/sintetizador";
import { CORES_JOGADORES, folhaDoCorpo, quadroDoCorpo } from "../../central/sprites";

export const ARENAS_TANQUES: Record<ArenaTanques, { nome: string; ceu: string; chao: string; pedra: string; caixote: string }> = {
  deserto: { nome: "Deserto", ceu: "#fcd34d", chao: "#d6a35c", pedra: "#78716c", caixote: "#a16207" },
  neve: { nome: "Neve", ceu: "#cbd5e1", chao: "#e2e8f0", pedra: "#475569", caixote: "#92400e" },
  fabrica: { nome: "Fábrica", ceu: "#1e293b", chao: "#334155", pedra: "#0f172a", caixote: "#b45309" },
};
const CORES_TIME = ["#ef4444", "#3b82f6"];
const LARGURA_FOLHA = 128;
const ALTURA_FOLHA = 48 * 7;

/** Motor dos Tanques de Aço (three.js): arena em grade vista do alto, tanques com torre, tiros, minas e explosões. */
export function criarMotorTanques(caixa: HTMLDivElement, vagas: VagaJogo[], modo: ModoTanques, arena: ArenaTanques, ganchos: GanchosMotor): MotorJogo {
  const tema = ARENAS_TANQUES[arena];
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute("aria-label", "Arena dos Tanques de Aço");
  renderer.domElement.className = "rounded-lg shadow-2xl ring-1 ring-white/10";
  caixa.appendChild(renderer.domElement);
  const cena = new THREE.Scene();
  cena.background = new THREE.Color(tema.ceu);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
  cena.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.1));
  const sol = new THREE.DirectionalLight(0xffffff, 1.3);
  sol.position.set(20, 50, 30);
  cena.add(sol);
  const descartaveis: { dispose(): void }[] = [];
  const guardar = <T extends { dispose(): void }>(x: T) => { descartaveis.push(x); return x; };
  const meio = TAMANHO / 2;

  const chao = new THREE.Mesh(guardar(new THREE.PlaneGeometry(TAMANHO + 30, TAMANHO + 30)), guardar(new THREE.MeshStandardMaterial({ color: tema.chao, roughness: 1 })));
  chao.rotation.x = -Math.PI / 2; chao.position.set(meio, 0, meio);
  cena.add(chao);
  const geoBloco = guardar(new THREE.BoxGeometry(CELULA, CELULA * 0.9, CELULA));
  const pedras = new THREE.InstancedMesh(geoBloco, guardar(new THREE.MeshStandardMaterial({ color: tema.pedra, roughness: 0.9 })), GRADE * GRADE);
  const caixotes = new THREE.InstancedMesh(guardar(new THREE.BoxGeometry(CELULA * 0.92, CELULA * 0.8, CELULA * 0.92)), guardar(new THREE.MeshStandardMaterial({ color: tema.caixote, roughness: 0.8 })), GRADE * GRADE);
  cena.add(pedras, caixotes);
  const matriz = new THREE.Matrix4(), corCaixote = new THREE.Color(tema.caixote), corRachado = new THREE.Color(tema.caixote).multiplyScalar(0.6);
  function montarGrade(e: EstadoTanques) {
    let np = 0, nc = 0;
    for (let z = 0; z < GRADE; z++) for (let x = 0; x < GRADE; x++) {
      const c = celula(e, x, z);
      if (c === 1) { matriz.makeTranslation((x + 0.5) * CELULA, CELULA * 0.45, (z + 0.5) * CELULA); pedras.setMatrixAt(np++, matriz); }
      else if (c === 2 || c === 3) {
        matriz.makeTranslation((x + 0.5) * CELULA, CELULA * 0.4, (z + 0.5) * CELULA);
        caixotes.setMatrixAt(nc, matriz); caixotes.setColorAt(nc++, c === 3 ? corRachado : corCaixote);
      }
    }
    pedras.count = np; caixotes.count = nc;
    pedras.instanceMatrix.needsUpdate = true; caixotes.instanceMatrix.needsUpdate = true;
    if (caixotes.instanceColor) caixotes.instanceColor.needsUpdate = true;
  }

  // Tanques: chassi e torre na cor da vaga (no modo Times, faixa da cor do time), o avatar na escotilha.
  const geoChassi = guardar(new THREE.BoxGeometry(1.7, 0.55, 1.3)), geoEsteira = guardar(new THREE.BoxGeometry(1.8, 0.4, 0.3));
  const geoTorre = guardar(new THREE.CylinderGeometry(0.5, 0.55, 0.4, 12)), geoCano = guardar(new THREE.CylinderGeometry(0.11, 0.11, 1.2, 8));
  const matEsteira = guardar(new THREE.MeshStandardMaterial({ color: "#1f2937" }));
  const tanques = vagas.map((v, i) => {
    const cor = CORES_JOGADORES[i % 8];
    const mat = guardar(new THREE.MeshStandardMaterial({ color: cor, roughness: 0.5, metalness: 0.3 }));
    const corpo = new THREE.Group();
    const chassi = new THREE.Mesh(geoChassi, mat); chassi.position.y = 0.45;
    const e1 = new THREE.Mesh(geoEsteira, matEsteira); e1.position.set(0, 0.25, 0.65);
    const e2 = new THREE.Mesh(geoEsteira, matEsteira); e2.position.set(0, 0.25, -0.65);
    corpo.add(chassi, e1, e2);
    if (modo === "times") {
      const faixa = new THREE.Mesh(guardar(new THREE.BoxGeometry(1.72, 0.1, 1.32)), guardar(new THREE.MeshBasicMaterial({ color: CORES_TIME[i % 2] })));
      faixa.position.y = 0.74; corpo.add(faixa);
    }
    const torre = new THREE.Group();
    const cabeca = new THREE.Mesh(geoTorre, mat); cabeca.position.y = 0.95;
    const cano = new THREE.Mesh(geoCano, mat); cano.rotation.z = -Math.PI / 2; cano.position.set(0.7, 0.95, 0);
    torre.add(cabeca, cano);
    const textura = guardar(new THREE.CanvasTexture(folhaDoCorpo(v.avatar, `corpo-${JSON.stringify(v.avatar)}`)));
    textura.magFilter = textura.minFilter = THREE.NearestFilter; textura.colorSpace = THREE.SRGBColorSpace;
    const r = quadroDoCorpo("baixo", "parado", 0);
    textura.offset.set(r.sx / LARGURA_FOLHA, 1 - (r.sy + r.h) / ALTURA_FOLHA);
    textura.repeat.set(r.w / LARGURA_FOLHA, r.h / ALTURA_FOLHA);
    const piloto = new THREE.Mesh(guardar(new THREE.PlaneGeometry(0.9, 1.35)), guardar(new THREE.MeshBasicMaterial({ map: textura, transparent: true, alphaTest: 0.5 })));
    cena.add(corpo, torre, piloto);
    return { corpo, torre, piloto, textura, x: 0, z: 0, ang: 0, torreAng: 0 };
  });
  const geoTiro = guardar(new THREE.SphereGeometry(0.18, 10, 8)), matTiro = guardar(new THREE.MeshBasicMaterial({ color: "#fde047" }));
  const geoMina = guardar(new THREE.CylinderGeometry(0.4, 0.45, 0.15, 14));
  const geoAlvo = guardar(new THREE.CylinderGeometry(0.7, 0.7, 1.6, 16)), matAlvo = guardar(new THREE.MeshStandardMaterial({ color: "#dc2626", emissive: "#7f1d1d" }));
  const reserva = { tiros: [] as THREE.Mesh[], minas: [] as THREE.Mesh[], alvos: [] as THREE.Mesh[] };
  const usar = (lista: THREE.Mesh[], n: number, criar: () => THREE.Mesh) => {
    while (lista.length < n) { const m = criar(); cena.add(m); lista.push(m); }
    lista.forEach((m, i) => { m.visible = i < n; });
    return lista;
  };
  const geoFaisca = guardar(new THREE.BoxGeometry(0.2, 0.2, 0.2));
  const faiscas: { m: THREE.Mesh; v: THREE.Vector3; t: number }[] = [];
  const faisca = (x: number, z: number, cor: string, n: number, forca: number) => {
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(geoFaisca, new THREE.MeshBasicMaterial({ color: cor }));
      m.position.set(x, 0.8, z); cena.add(m);
      faiscas.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * forca, Math.random() * forca, (Math.random() - 0.5) * forca), t: 0 });
    }
  };

  let estado: EstadoTanques | null = null;
  let pendentes: unknown[] = [];
  let tempo = 0, tremor = 0;

  function efeitosDoPasso(e: EstadoTanques) {
    let grade = false;
    for (const ev of e.eventos as EventoTanques[]) {
      if (ev.tipo === "tiro") { som.chute(); const t = e.tanques[ev.jogador]; faisca(t.x + Math.cos(t.torre) * 1.3, t.z + Math.sin(t.torre) * 1.3, "#fde68a", 3, 2); }
      else if (ev.tipo === "ricochete") { som.clique(); faisca(ev.x, ev.z, "#e5e7eb", 3, 3); }
      else if (ev.tipo === "acerto") { som.bloco(); faisca(ev.x, ev.z, "#f97316", 10, 5); if (!vagas[ev.jogador]?.bot) ganchos.vibrarLocal(ev.jogador, 120); }
      else if (ev.tipo === "destruido") { som.explosao(2); tremor = 0.7; faisca(ev.x, ev.z, "#f97316", 30, 9); faisca(ev.x, ev.z, "#1f2937", 15, 6); ganchos.morte(ev.jogador); }
      else if (ev.tipo === "caixote") { grade = true; if (ev.quebrou) { som.bloco(); faisca(ev.x, ev.z, tema.caixote, 10, 5); } }
      else if (ev.tipo === "mina") som.colocar();
      else if (ev.tipo === "explosao") { grade = true; som.explosao(2); tremor = 0.6; faisca(ev.x, ev.z, "#fb923c", 28, 8); }
      else if (ev.tipo === "alvo") { som.moeda(); faisca(ev.x, ev.z, "#dc2626", 18, 7); }
    }
    if (grade) montarGrade(e);
  }

  function redimensionar() {
    const w = Math.max(1, caixa.clientWidth - 8), h = Math.max(1, caixa.clientHeight - 8);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  redimensionar();
  const guardarAnteriores = (e: EstadoTanques) => e.tanques.forEach((t, i) => Object.assign(tanques[i], { x: t.x, z: t.z, ang: t.ang, torreAng: t.torre }));
  const lerpAng = (a: number, b: number, f: number) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + d * f; };

  return {
    iniciarRodada() {
      estado = novaPartidaTanques({ modo, arena, semente: (Math.random() * 1e9) | 0, jogadores: vagas.map(v => ({ bot: v.bot })) });
      pendentes = [];
      faiscas.splice(0).forEach(f => cena.remove(f.m));
      montarGrade(estado);
      guardarAnteriores(estado);
    },
    passo(entradas: Entrada[]) {
      const e = estado;
      if (!e) return null;
      guardarAnteriores(e);
      if (!e.terminado) { passoTanques(e, entradas); efeitosDoPasso(e); if (pendentes.length < 400) pendentes.push(...e.eventos); }
      return e.terminado ? { vencedor: e.vencedor, time: e.timeVencedor, pontos: pontosTanques(e) } : null;
    },
    desenhar(alfa: number, dt: number, fase: FasePartida, vencedor: number | null) {
      const e = estado;
      if (!e) return;
      tempo += dt;
      e.tanques.forEach((t, i) => {
        const o = tanques[i];
        o.corpo.visible = o.torre.visible = o.piloto.visible = t.vivo;
        if (!t.vivo) return;
        const x = o.x + (t.x - o.x) * alfa, z = o.z + (t.z - o.z) * alfa;
        const pisca = e.passo - t.atingidoEm < 30 && Math.sin(tempo * 40) > 0;
        o.corpo.position.set(x, 0, z); o.corpo.rotation.y = -lerpAng(o.ang, t.ang, alfa);
        o.torre.position.set(x, 0, z); o.torre.rotation.y = -lerpAng(o.torreAng, t.torre, alfa);
        o.corpo.visible = !pisca;
        const comemora = fase !== "jogando" && fase !== "contagem" && vencedor === i;
        o.piloto.position.set(x - 0.1, 1.7 + (comemora ? Math.abs(Math.sin(tempo * 7)) * 0.4 : 0), z);
        o.piloto.quaternion.copy(camera.quaternion);
      });
      usar(reserva.tiros, e.tiros.length, () => new THREE.Mesh(geoTiro, matTiro)).forEach((m, i) => { const s = e.tiros[i]; if (s) m.position.set(s.x, 0.95, s.z); });
      usar(reserva.minas, e.minas.length, () => new THREE.Mesh(geoMina, new THREE.MeshStandardMaterial({ color: "#111827", emissive: "#ef4444", emissiveIntensity: 0 }))).forEach((m, i) => {
        const mi = e.minas[i]; if (!mi) return;
        m.position.set(mi.x, 0.08, mi.z);
        (m.material as THREE.MeshStandardMaterial).emissiveIntensity = e.passo >= mi.armaEm && Math.sin(tempo * 8) > 0 ? 1 : 0;
      });
      usar(reserva.alvos, e.alvos.filter(a => a.vida > 0).length, () => new THREE.Mesh(geoAlvo, matAlvo)).forEach((m, i) => {
        const a = e.alvos.filter(x => x.vida > 0)[i]; if (a) { m.position.set(a.x, 0.8, a.z); m.rotation.y = tempo; }
      });
      // Câmera: a arena inteira, inclinada; treme nas explosões.
      tremor = Math.max(0, tremor - dt * 1.6);
      const dist = (TAMANHO / (2 * Math.tan((camera.fov * Math.PI) / 360) * Math.min(1, camera.aspect))) * 0.95;
      camera.position.set(meio + (Math.random() - 0.5) * tremor, dist * 0.9, meio + dist * 0.45 + (Math.random() - 0.5) * tremor);
      camera.lookAt(meio, 0, meio + 1.5);
      for (let k = faiscas.length - 1; k >= 0; k--) {
        const f = faiscas[k];
        f.t += dt; f.v.y -= 9 * dt; f.m.position.addScaledVector(f.v, dt);
        if (f.t > 0.9) { cena.remove(f.m); (f.m.material as THREE.Material).dispose(); faiscas.splice(k, 1); }
      }
      renderer.render(cena, camera);
    },
    placar() {
      const e = estado;
      if (!e) return { tempo: 0, jogadores: [] };
      const solo = e.tanques.length === 1;
      return {
        tempo: Math.max(0, Math.ceil((e.meta - e.passo) / 60)),
        alerta: e.meta - e.passo < 20 * 60,
        jogadores: e.tanques.map(t => ({
          vivo: t.vivo,
          texto: !t.vivo ? "destruído" : solo ? `🎯 ${e.alvos.filter(a => a.vida <= 0).length}/${e.alvos.length}` : `${"🛡".repeat(t.blindagem)}${"·".repeat(BLINDAGEM - t.blindagem)} · ${t.abates}💥${e.modo === "times" ? ` · ${t.time ? "azul" : "vermelho"}` : ""}`,
        })),
      };
    },
    redimensionar,
    quadro() { return estado ? serializar({ ...estado, eventos: [] }) : null; },
    tirarEventos() { const l = pendentes.map(x => serializar(x)); pendentes = []; return l; },
    aplicar(s: unknown, eventos: unknown[]) {
      const e = desserializar(s) as EstadoTanques | null;
      if (!e || !Array.isArray(e.tanques) || !Array.isArray(e.grade)) return;
      if (estado) guardarAnteriores(estado); else guardarAnteriores(e);
      const gradeMudou = !estado || estado.grade.join() !== e.grade.join();
      estado = e;
      e.eventos = eventos.map(x => desserializar(x)) as EventoTanques[];
      if (gradeMudou) montarGrade(e);
      efeitosDoPasso(e);
    },
    destruir() {
      faiscas.forEach(f => (f.m.material as THREE.Material).dispose());
      reserva.minas.forEach(m => (m.material as THREE.Material).dispose());
      pedras.dispose(); caixotes.dispose();
      descartaveis.forEach(d => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
