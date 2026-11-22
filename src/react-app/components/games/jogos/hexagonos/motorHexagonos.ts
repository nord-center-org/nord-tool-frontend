import * as THREE from "three";
import { desserializar, serializar } from "@/react-app/utils/games/espelho";
import type { Entrada } from "@/react-app/utils/games/bombas";
import {
  ALTURA_CAMADA, CAI_APOS, alturaDaCamada, camadaDoJogador, novaPartidaHex, passoHex, segundosRestantesHex, type EstadoHex, type EventoHex, type ModoHex,
} from "@/react-app/utils/games/hexagonos";
import type { FasePartida, GanchosMotor, MotorJogo, VagaJogo } from "../../comum/MolduraPartida";
import { som } from "../../audio/sintetizador";
import { CORES_JOGADORES, folhaDoCorpo, quadroDoCorpo } from "../../central/sprites";

/** Cenários: cores das camadas, do céu e da névoa (tudo gerado por código). */
export const CENARIOS_HEX = {
  neon: { nome: "Neon", camadas: ["#7c3aed", "#db2777", "#0891b2"], ceu: "#0b0820", nevoa: "#1e1038" },
  lava: { nome: "Vulcão", camadas: ["#f97316", "#dc2626", "#7c2d12"], ceu: "#1a0606", nevoa: "#3b0a0a" },
  gelo: { nome: "Gelo", camadas: ["#38bdf8", "#a5f3fc", "#6366f1"], ceu: "#06121f", nevoa: "#0c2a44" },
} as const;
export type CenarioHex = keyof typeof CENARIOS_HEX;

const LARGURA_FOLHA = 128;
const ALTURA_FOLHA = 48 * 7;

/**
 * Motor 3D do Sumô dos Hexágonos (three.js): pisos hexagonais em instâncias que brilham e despencam, avatares de
 * corpo inteiro como sprites voltados para a câmera (no estilo pixel do NordTool), sombra, câmera que acompanha a
 * camada em jogo e partículas. As regras ficam em utils/games/hexagonos.ts.
 */
export function criarMotorHexagonos(caixa: HTMLDivElement, vagas: VagaJogo[], modo: ModoHex, cenario: CenarioHex, ganchos: GanchosMotor): MotorJogo {
  const tema = CENARIOS_HEX[cenario];
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute("aria-label", "Arena do Sumô dos Hexágonos");
  renderer.domElement.className = "rounded-lg shadow-2xl ring-1 ring-white/10";
  caixa.appendChild(renderer.domElement);

  const cena = new THREE.Scene();
  cena.background = new THREE.Color(tema.ceu);
  cena.fog = new THREE.Fog(tema.nevoa, 18, 46);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  cena.add(new THREE.HemisphereLight(0xc4b5fd, 0x1e1b4b, 1.1));
  const sol = new THREE.DirectionalLight(0xffffff, 1.4);
  sol.position.set(6, 14, 8);
  cena.add(sol);

  // Estrelas ao fundo (pontos gerados por código).
  const estrelasGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(600 * 3);
  for (let i = 0; i < 600; i++) {
    const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 40;
    pos.set([Math.cos(a) * r, -20 + Math.random() * 50, Math.sin(a) * r - 20], i * 3);
  }
  estrelasGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  cena.add(new THREE.Points(estrelasGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.7 })));

  const geoHex = new THREE.CylinderGeometry(0.97, 0.97, 0.42, 6);
  const matHex = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.15, emissive: new THREE.Color(0x000000) });
  const geoSombra = new THREE.CircleGeometry(0.36, 20);
  const geoAnel = new THREE.RingGeometry(0.36, 0.46, 24);
  const geoFaisca = new THREE.BoxGeometry(0.12, 0.12, 0.12);

  let estado: EstadoHex | null = null;
  let pendentes: unknown[] = [];
  function efeitosDoPasso(e: EstadoHex) {
    let pisadas = 0;
    for (const ev of e.eventos) {
      if (ev.tipo === "pisou") pisadas++;
      tratar(ev);
    }
    if (pisadas && Math.random() < 0.3) som.bloco();
  }
  // Uma malha por camada (para apagar as de cima quando o jogo desce) e o endereço de cada piso nelas.
  let camadasMesh: THREE.InstancedMesh[] = [];
  let enderecos: { camada: number; local: number }[] = [];
  const anteriores: { x: number; y: number; z: number }[] = [];
  const jogadores: { corpo: THREE.Mesh; textura: THREE.CanvasTexture; sombra: THREE.Mesh; anel: THREE.Mesh; nome: THREE.Sprite }[] = [];
  const faiscas: { m: THREE.Mesh; v: THREE.Vector3; t: number }[] = [];
  let tremor = 0;
  let tempo = 0;
  const alvoCamera = new THREE.Vector3(0, 0, 0);
  const cor = new THREE.Color();
  const matriz = new THREE.Matrix4();
  const base = tema.camadas.map(c => new THREE.Color(c));
  const branco = new THREE.Color("#fef9c3");

  // Avatares: a folha de sprites do corpo inteiro vira textura de um plano que sempre olha para a câmera.
  vagas.forEach((v, i) => {
    const folha = folhaDoCorpo(v.avatar, `corpo-${JSON.stringify(v.avatar)}`);
    const textura = new THREE.CanvasTexture(folha);
    textura.magFilter = THREE.NearestFilter;
    textura.minFilter = THREE.NearestFilter;
    textura.colorSpace = THREE.SRGBColorSpace;
    textura.repeat.set(32 / LARGURA_FOLHA, 48 / ALTURA_FOLHA);
    const corpo = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.65), new THREE.MeshBasicMaterial({ map: textura, transparent: true, alphaTest: 0.5 }));
    const sombra = new THREE.Mesh(geoSombra, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false }));
    sombra.rotation.x = -Math.PI / 2;
    const anel = new THREE.Mesh(geoAnel, new THREE.MeshBasicMaterial({ color: CORES_JOGADORES[i], transparent: true, opacity: 0.95, depthWrite: false }));
    anel.rotation.x = -Math.PI / 2;
    // Etiqueta "P1" acima da cabeça.
    const etiqueta = document.createElement("canvas");
    etiqueta.width = 64; etiqueta.height = 32;
    const g = etiqueta.getContext("2d");
    if (g) {
      g.font = "900 22px system-ui"; g.textAlign = "center"; g.lineWidth = 5; g.strokeStyle = "rgba(0,0,0,.85)";
      g.strokeText(`P${i + 1}`, 32, 24); g.fillStyle = CORES_JOGADORES[i]; g.fillText(`P${i + 1}`, 32, 24);
    }
    const nome = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(etiqueta), depthTest: false }));
    nome.scale.set(0.8, 0.4, 1);
    cena.add(corpo, sombra, anel, nome);
    jogadores.push({ corpo, textura, sombra, anel, nome });
  });

  function montarPisos(e: EstadoHex) {
    camadasMesh.forEach(m => { cena.remove(m); (m.material as THREE.Material).dispose(); m.dispose(); });
    const contagem = Array.from({ length: e.camadas }, (_, k) => e.pisos.filter(p => p.camada === k).length);
    camadasMesh = contagem.map(n => {
      const m = new THREE.InstancedMesh(geoHex, matHex.clone(), n);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      cena.add(m);
      return m;
    });
    const proximo = contagem.map(() => 0);
    enderecos = e.pisos.map(p => {
      const local = proximo[p.camada]++;
      matriz.makeTranslation(p.x, alturaDaCamada(p.camada) - 0.21, p.z);
      camadasMesh[p.camada].setMatrixAt(local, matriz);
      camadasMesh[p.camada].setColorAt(local, base[p.camada % base.length]);
      return { camada: p.camada, local };
    });
  }

  function faisca(x: number, y: number, z: number, corHex: string, n: number, forca: number) {
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(geoFaisca, new THREE.MeshBasicMaterial({ color: corHex }));
      m.position.set(x, y, z);
      cena.add(m);
      faiscas.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * forca, Math.random() * forca, (Math.random() - 0.5) * forca), t: 0 });
    }
  }

  function tratar(ev: EventoHex) {
    const e = estado!;
    switch (ev.tipo) {
      case "caiu": {
        const p = e.pisos[ev.piso];
        faisca(p.x, alturaDaCamada(p.camada), p.z, tema.camadas[p.camada % 3], 3, 3);
        break;
      }
      case "dash": som.chute(); ganchos.vibrarLocal(ev.jogador, 20); break;
      case "pulo": som.arremesso(); break;
      case "empurrao": som.explosao(1); tremor = Math.min(0.6, tremor + 0.35); faisca(ev.x, ev.y + 0.8, ev.z, "#fde047", 10, 5); break;
      case "morte": som.morte(); ganchos.morte(ev.jogador); break;
      case "borda": som.alerta(); break;
      default: break;
    }
  }

  function redimensionar() {
    const w = Math.max(1, caixa.clientWidth - 8), h = Math.max(1, caixa.clientHeight - 8);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  redimensionar();

  return {
    iniciarRodada() {
      estado = novaPartidaHex({ modo, jogadores: vagas.map(v => ({ nome: v.nome, bot: v.bot })) });
      montarPisos(estado);
      pendentes = [];
      anteriores.length = 0;
      estado.jogadores.forEach(j => anteriores.push({ x: j.x, y: j.y, z: j.z }));
      faiscas.splice(0).forEach(f => cena.remove(f.m));
      alvoCamera.set(0, 0, 0);
    },
    passo(entradas: Entrada[]) {
      const e = estado;
      if (!e) return null;
      e.jogadores.forEach((j, i) => { anteriores[i] = { x: j.x, y: j.y, z: j.z }; });
      passoHex(e, entradas);
      efeitosDoPasso(e);
      if (pendentes.length < 400) pendentes.push(...e.eventos);
      return e.terminado ? { vencedor: e.vencedor } : null;
    },
    desenhar(alfa: number, dt: number, fase: FasePartida, vencedor: number | null) {
      const e = estado;
      if (!e || !camadasMesh.length) return;
      tempo += dt;
      // Pisos: brilham ao serem pisados (piscando mais rápido perto de cair) e despencam girando.
      e.pisos.forEach((p, i) => {
        const y0 = alturaDaCamada(p.camada) - 0.21;
        if (p.caiuEm !== null) {
          const t = (e.passo - p.caiuEm) / 60;
          if (t > 1.4) { matriz.makeScale(0, 0, 0); camadasMesh[enderecos[i].camada].setMatrixAt(enderecos[i].local, matriz); return; }
          matriz.makeRotationY(t * 3).setPosition(p.x, y0 - t * t * 9, p.z);
          camadasMesh[enderecos[i].camada].setMatrixAt(enderecos[i].local, matriz);
          return;
        }
        if (p.pisadoEm !== null) {
          const falta = Math.max(0, CAI_APOS - (e.passo - p.pisadoEm)) / CAI_APOS;
          const pisca = Math.sin(tempo * (10 + (1 - falta) * 30)) > 0;
          cor.copy(base[p.camada % base.length]).lerp(branco, pisca ? 0.75 : 0.35);
          const treme = (1 - falta) * 0.04;
          matriz.makeTranslation(p.x + (Math.random() - 0.5) * treme, y0 - (1 - falta) * 0.06, p.z + (Math.random() - 0.5) * treme);
        } else {
          cor.copy(base[p.camada % base.length]);
          matriz.makeTranslation(p.x, y0, p.z);
        }
        camadasMesh[enderecos[i].camada].setMatrixAt(enderecos[i].local, matriz);
        camadasMesh[enderecos[i].camada].setColorAt(enderecos[i].local, cor);
      });
      // Câmera: acompanha a camada onde está a maioria dos vivos; as camadas acima dela ficam quase transparentes.
      const vivos = e.jogadores.filter(j => j.vivo);
      const camadasVivos = vivos.map(camadaDoJogador).sort((a, b) => a - b);
      const camadaFoco = camadasVivos.length ? camadasVivos[Math.floor(camadasVivos.length / 2)] : 0;
      camadasMesh.forEach((m, k) => {
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
        const mat = m.material as THREE.MeshStandardMaterial;
        const alvo = k < camadaFoco ? 0.12 : 1;
        mat.opacity += (alvo - mat.opacity) * Math.min(1, dt * 4);
        const transparente = mat.opacity < 0.99;
        if (transparente !== mat.transparent) {
          mat.transparent = transparente;
          mat.depthWrite = !transparente;
          mat.needsUpdate = true;
        }
      });
      alvoCamera.y += (alturaDaCamada(camadaFoco) - alvoCamera.y) * Math.min(1, dt * 2.5);
      const raio = e.raio * 1.7 + 6;
      tremor = Math.max(0, tremor - dt * 1.5);
      camera.position.set((Math.random() - 0.5) * tremor, alvoCamera.y + raio * 0.95 + (Math.random() - 0.5) * tremor, raio * 0.95);
      camera.lookAt(0, alvoCamera.y - 1, 0);

      // Jogadores (interpolados entre os passos), sombra no piso de baixo e anel da cor da vaga.
      e.jogadores.forEach((j, i) => {
        const o = jogadores[i];
        const visivel = j.vivo;
        o.corpo.visible = o.sombra.visible = o.anel.visible = o.nome.visible = visivel;
        if (!visivel) return;
        const a = anteriores[i] ?? j;
        const x = a.x + (j.x - a.x) * alfa, y = a.y + (j.y - a.y) * alfa, z = a.z + (j.z - a.z) * alfa;
        const comemora = fase !== "jogando" && fase !== "contagem" && vencedor === i;
        const dir = j.direcao === "cima" ? "cima" : j.direcao === "baixo" ? "baixo" : "lado";
        const r = quadroDoCorpo(dir, comemora ? "vitoria" : j.andando ? "andando" : "parado", tempo + i * 0.37);
        const espelha = j.direcao === "esquerda" && !comemora;
        o.textura.offset.set((espelha ? r.sx + r.w : r.sx) / LARGURA_FOLHA, 1 - (r.sy + r.h) / ALTURA_FOLHA);
        o.textura.repeat.set((espelha ? -r.w : r.w) / LARGURA_FOLHA, r.h / ALTURA_FOLHA);
        const pulo = comemora ? Math.abs(Math.sin(tempo * 7)) * 0.3 : 0;
        o.corpo.position.set(x, y + 0.82 + pulo, z);
        o.corpo.quaternion.copy(camera.quaternion);
        o.nome.position.set(x, y + 1.95 + pulo, z);
        const chao = alturaDaCamada(Math.min(e.camadas - 1, camadaDoJogador(j))) + 0.01;
        const altura = Math.max(0, y - chao);
        o.sombra.position.set(x, chao, z);
        o.sombra.scale.setScalar(Math.max(0.3, 1 - altura / ALTURA_CAMADA));
        o.anel.position.set(x, chao + 0.005, z);
      });

      // Faíscas com gravidade.
      for (let k = faiscas.length - 1; k >= 0; k--) {
        const f = faiscas[k];
        f.t += dt;
        f.v.y -= 12 * dt;
        f.m.position.addScaledVector(f.v, dt);
        f.m.rotation.x += dt * 6;
        if (f.t > 1.2) { cena.remove(f.m); faiscas.splice(k, 1); }
      }
      renderer.render(cena, camera);
    },
    placar() {
      const e = estado;
      if (!e) return { tempo: 0, jogadores: [] };
      const restante = segundosRestantesHex(e);
      return {
        tempo: restante,
        alerta: e.jogadores.length === 1 ? false : restante <= 20,
        jogadores: e.jogadores.map(j => ({
          vivo: j.vivo,
          texto: j.vivo ? `${e.camadas > 1 ? `camada ${camadaDoJogador(j) + 1}` : "na arena"}${e.passo >= j.dashPronto ? " · ⚡" : ""}` : "caiu",
        })),
      };
    },
    redimensionar,
    quadro() {
      return estado ? serializar({ ...estado, eventos: [] }) : null;
    },
    tirarEventos() {
      const l = pendentes.map(x => serializar(x));
      pendentes = [];
      return l;
    },
    aplicar(s: unknown, eventos: unknown[]) {
      const e = desserializar(s) as EstadoHex | null;
      if (!e || !Array.isArray(e.pisos) || !Array.isArray(e.jogadores)) return;
      // Rodada nova (ou o primeiro quadro): monta o piso de novo.
      if (!estado || estado.pisos.length !== e.pisos.length || e.passo < estado.passo) { montarPisos(e); anteriores.length = 0; }
      e.jogadores.forEach((j, i) => { const a = estado?.jogadores[i]; anteriores[i] = a ? { x: a.x, y: a.y, z: a.z } : { x: j.x, y: j.y, z: j.z }; });
      estado = e;
      e.eventos = eventos.map(x => desserializar(x)) as EstadoHex["eventos"];
      efeitosDoPasso(e);
    },
    destruir() {
      camadasMesh.forEach(m => { (m.material as THREE.Material).dispose(); m.dispose(); });
      renderer.dispose();
      geoHex.dispose(); matHex.dispose(); geoSombra.dispose(); geoAnel.dispose(); geoFaisca.dispose(); estrelasGeo.dispose();
      jogadores.forEach(o => o.textura.dispose());
      renderer.domElement.remove();
    },
  };
}
