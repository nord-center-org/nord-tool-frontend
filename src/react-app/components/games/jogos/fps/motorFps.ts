import * as THREE from "three";
import type { Entrada } from "@/react-app/utils/games/bombas";
import {
  ALTURA_NIVEL, ARMAS, CELULA, GRADE, TAMANHO, TEMPO, altura, novaPartidaFps, passoFps, pontosFps,
  type Arma, type EstadoFps, type EventoFps, type MapaFps, type ModoFps,
} from "@/react-app/utils/games/fps";
import { desserializar, serializar } from "@/react-app/utils/games/espelho";
import type { FasePartida, GanchosMotor, MotorJogo, VagaJogo } from "../../comum/MolduraPartida";
import { som } from "../../audio/sintetizador";
import { CORES_JOGADORES, folhaDoCorpo, quadroDoCorpo } from "../../central/sprites";

export const MAPAS_FPS: Record<MapaFps, { nome: string; ceu: string; neblina: string; chao: string; bloco: string; topo: string }> = {
  templo: { nome: "Templo", ceu: "#7dd3fc", neblina: "#bae6fd", chao: "#a3a380", bloco: "#a8a29e", topo: "#65a30d" },
  fabrica: { nome: "Fábrica", ceu: "#334155", neblina: "#475569", chao: "#52525b", bloco: "#71717a", topo: "#f59e0b" },
  gelo: { nome: "Gelo", ceu: "#e0f2fe", neblina: "#f0f9ff", chao: "#e2e8f0", bloco: "#93c5fd", topo: "#f8fafc" },
};
const CORES_TIME = ["#ef4444", "#3b82f6"];
const COR_ARMA: Record<Arma, string> = { pistola: "#9ca3af", rifle: "#22c55e", escopeta: "#f97316", sniper: "#a855f7" };
const LARGURA_FOLHA = 128;
const ALTURA_FOLHA = 48 * 7;

/** Motor da Arena Voxel (three.js): primeira pessoa quando a tela é de uma pessoa só; senão, a arena vista do alto. */
export function criarMotorFps(caixa: HTMLDivElement, vagas: VagaJogo[], modo: ModoFps, mapa: MapaFps, ganchos: GanchosMotor): MotorJogo {
  const tema = MAPAS_FPS[mapa];
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute("aria-label", "Arena Voxel");
  renderer.domElement.className = "rounded-lg shadow-2xl ring-1 ring-white/10";
  caixa.appendChild(renderer.domElement);
  const cena = new THREE.Scene();
  cena.background = new THREE.Color(tema.ceu);
  cena.fog = new THREE.Fog(tema.neblina, 30, 90);
  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 300);
  cena.add(camera);
  cena.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.1));
  const sol = new THREE.DirectionalLight(0xffffff, 1.3);
  sol.position.set(20, 50, 30);
  cena.add(sol);
  const descartaveis: { dispose(): void }[] = [];
  const guardar = <T extends { dispose(): void }>(x: T) => { descartaveis.push(x); return x; };
  const meio = TAMANHO / 2;

  // Mira no centro (só na primeira pessoa).
  const mira = document.createElement("div");
  mira.setAttribute("aria-hidden", "true");
  mira.style.cssText = "position:absolute;left:50%;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;pointer-events:none;border:2px solid rgba(255,255,255,.85);border-radius:50%;box-shadow:0 0 0 1px rgba(0,0,0,.4);display:none";
  if (getComputedStyle(caixa).position === "static") caixa.style.position = "relative";
  caixa.appendChild(mira);

  const chao = new THREE.Mesh(guardar(new THREE.PlaneGeometry(TAMANHO + 40, TAMANHO + 40)), guardar(new THREE.MeshStandardMaterial({ color: tema.chao, roughness: 1 })));
  chao.rotation.x = -Math.PI / 2; chao.position.set(meio, 0, meio);
  cena.add(chao);
  const geoBloco = guardar(new THREE.BoxGeometry(1, 1, 1));
  const blocos = new THREE.InstancedMesh(geoBloco, guardar(new THREE.MeshStandardMaterial({ color: tema.bloco, roughness: 0.9 })), GRADE * GRADE * 3);
  const topos = new THREE.InstancedMesh(guardar(new THREE.BoxGeometry(CELULA, 0.08, CELULA)), guardar(new THREE.MeshStandardMaterial({ color: tema.topo, roughness: 0.9 })), GRADE * GRADE);
  cena.add(blocos, topos);
  const matriz = new THREE.Matrix4(), cor = new THREE.Color(), corBase = new THREE.Color(tema.bloco);
  function montarArena(e: EstadoFps) {
    let nb = 0, nt = 0;
    for (let z = 0; z < GRADE; z++) for (let x = 0; x < GRADE; x++) {
      const h = altura(e, x, z);
      // Um cubo por nível, com um leve xadrez de cor (cara de voxel).
      for (let k = 0; k < h; k++) {
        matriz.makeScale(CELULA, ALTURA_NIVEL, CELULA).setPosition((x + 0.5) * CELULA, (k + 0.5) * ALTURA_NIVEL, (z + 0.5) * CELULA);
        blocos.setMatrixAt(nb, matriz);
        blocos.setColorAt(nb++, cor.copy(corBase).multiplyScalar((x + z + k) % 2 ? 0.9 : 1.05));
      }
      if (h > 0) { matriz.makeTranslation((x + 0.5) * CELULA, h * ALTURA_NIVEL + 0.04, (z + 0.5) * CELULA); topos.setMatrixAt(nt++, matriz); }
    }
    blocos.count = nb; topos.count = nt;
    blocos.instanceMatrix.needsUpdate = true; topos.instanceMatrix.needsUpdate = true;
    if (blocos.instanceColor) blocos.instanceColor.needsUpdate = true;
  }
  // Colina: anel brilhante no topo do meio.
  const anelColina = new THREE.Mesh(guardar(new THREE.RingGeometry(2.4, 3, 32)), guardar(new THREE.MeshBasicMaterial({ color: "#fde047", side: THREE.DoubleSide, transparent: true, opacity: 0.8 })));
  anelColina.rotation.x = -Math.PI / 2; anelColina.position.set(meio, ALTURA_NIVEL + 0.1, meio);
  anelColina.visible = modo === "colina" && vagas.length > 1;
  cena.add(anelColina);

  // Soldados: o avatar de corpo inteiro (sempre virado para a câmera) com a arma na mão; bots da arena são drones.
  const geoArma = guardar(new THREE.BoxGeometry(0.7, 0.14, 0.14));
  const matArma: Record<Arma, THREE.MeshStandardMaterial> = {
    pistola: guardar(new THREE.MeshStandardMaterial({ color: COR_ARMA.pistola, metalness: 0.6 })),
    rifle: guardar(new THREE.MeshStandardMaterial({ color: COR_ARMA.rifle, metalness: 0.4 })),
    escopeta: guardar(new THREE.MeshStandardMaterial({ color: COR_ARMA.escopeta, metalness: 0.4 })),
    sniper: guardar(new THREE.MeshStandardMaterial({ color: COR_ARMA.sniper, metalness: 0.4 })),
  };
  const geoDrone = guardar(new THREE.SphereGeometry(0.5, 14, 10)), geoOlho = guardar(new THREE.SphereGeometry(0.16, 8, 6));
  const matDrone = guardar(new THREE.MeshStandardMaterial({ color: "#1f2937", metalness: 0.7, roughness: 0.3 })), matOlho = guardar(new THREE.MeshBasicMaterial({ color: "#ef4444" }));
  const geoAnel = guardar(new THREE.TorusGeometry(0.45, 0.06, 6, 20));
  type Visual = { g: THREE.Group; figura: THREE.Object3D; arma: THREE.Mesh; anel: THREE.Mesh | null; x: number; y: number; z: number; ang: number };
  const visuais: Visual[] = [];
  function visualDe(i: number, e: EstadoFps): Visual {
    if (visuais[i]) return visuais[i];
    const s = e.soldados[i], v = vagas[i];
    const g = new THREE.Group();
    let figura: THREE.Object3D;
    if (v && !s.extra) {
      const textura = guardar(new THREE.CanvasTexture(folhaDoCorpo(v.avatar, `corpo-${JSON.stringify(v.avatar)}`)));
      textura.magFilter = textura.minFilter = THREE.NearestFilter; textura.colorSpace = THREE.SRGBColorSpace;
      const r = quadroDoCorpo("baixo", "parado", 0);
      textura.offset.set(r.sx / LARGURA_FOLHA, 1 - (r.sy + r.h) / ALTURA_FOLHA);
      textura.repeat.set(r.w / LARGURA_FOLHA, r.h / ALTURA_FOLHA);
      figura = new THREE.Mesh(guardar(new THREE.PlaneGeometry(1.2, 1.8)), guardar(new THREE.MeshBasicMaterial({ map: textura, transparent: true, alphaTest: 0.5 })));
      figura.position.y = 0.9;
    } else {
      const d = new THREE.Group();
      const corpo = new THREE.Mesh(geoDrone, matDrone); corpo.position.y = 1.1;
      const olho = new THREE.Mesh(geoOlho, matOlho); olho.position.set(0.42, 1.15, 0);
      d.add(corpo, olho);
      figura = d;
    }
    const arma = new THREE.Mesh(geoArma, matArma.pistola); arma.position.set(0.45, 1.05, 0.25);
    const braco = new THREE.Group(); braco.add(arma);
    g.add(figura, braco);
    const corVaga = e.times ? CORES_TIME[s.time] : CORES_JOGADORES[i % 8];
    const anel = s.extra ? null : new THREE.Mesh(geoAnel, guardar(new THREE.MeshBasicMaterial({ color: corVaga })));
    if (anel) { anel.rotation.x = Math.PI / 2; anel.position.y = 0.05; g.add(anel); }
    cena.add(g);
    visuais[i] = { g, figura, arma, anel, x: s.x, y: s.y, z: s.z, ang: s.ang };
    return visuais[i];
  }

  // Arma na mão da primeira pessoa.
  const armaFp = new THREE.Mesh(guardar(new THREE.BoxGeometry(0.07, 0.07, 0.4)), matArma.pistola);
  armaFp.position.set(0.14, -0.16, -0.5);
  camera.add(armaFp);
  const clarao = new THREE.Mesh(guardar(new THREE.SphereGeometry(0.07, 8, 6)), guardar(new THREE.MeshBasicMaterial({ color: "#fde68a" })));
  clarao.position.set(0.14, -0.14, -0.75); clarao.visible = false;
  camera.add(clarao);

  // Pedestais e bandeiras.
  const geoPedestal = guardar(new THREE.CylinderGeometry(0.5, 0.6, 0.3, 12)), matPedestal = guardar(new THREE.MeshStandardMaterial({ color: "#475569" }));
  const geoArmaPed = guardar(new THREE.BoxGeometry(0.8, 0.2, 0.2));
  const pedestais: { base: THREE.Mesh; arma: THREE.Mesh }[] = [];
  const geoMastro = guardar(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6)), geoPano = guardar(new THREE.PlaneGeometry(0.9, 0.6));
  const bandeiras: THREE.Group[] = [];
  const geoTiro = guardar(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]));
  const tiros: { l: THREE.Line; t: number }[] = [];
  const geoFaisca = guardar(new THREE.BoxGeometry(0.12, 0.12, 0.12));
  const faiscas: { m: THREE.Mesh; v: THREE.Vector3; t: number }[] = [];
  const faisca = (x: number, y: number, z: number, cor: string, n: number, forca: number) => {
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(geoFaisca, new THREE.MeshBasicMaterial({ color: cor }));
      m.position.set(x, y, z); cena.add(m);
      faiscas.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * forca, Math.random() * forca, (Math.random() - 0.5) * forca), t: 0 });
    }
  };

  // Câmera: primeira pessoa quando esta tela é de uma pessoa só (o celular dela ou só um humano aqui).
  const minhas = vagas.map((v, i) => ({ v, i })).filter(({ v }) => v.privada);
  const humanos = vagas.map((v, i) => ({ v, i })).filter(({ v }) => !v.bot && v.controle === undefined);
  const seguir = minhas.length === 1 ? minhas[0].i : humanos.length === 1 && vagas.filter(v => !v.bot).length === 1 ? humanos[0].i : -1;

  let estado: EstadoFps | null = null;
  let pendentes: unknown[] = [];
  let tempo = 0, tremor = 0, coice = 0, dano = 0;
  const veu = document.createElement("div");
  veu.setAttribute("aria-hidden", "true");
  veu.style.cssText = "position:absolute;inset:4px;pointer-events:none;border-radius:8px;background:radial-gradient(transparent 55%, rgba(220,38,38,.75));opacity:0;transition:opacity .1s";
  caixa.appendChild(veu);

  function montarObjetos(e: EstadoFps) {
    pedestais.splice(0).forEach(p => cena.remove(p.base, p.arma));
    for (const p of e.pedestais) {
      const base = new THREE.Mesh(geoPedestal, matPedestal), arma = new THREE.Mesh(geoArmaPed, matArma[p.arma]);
      const y = altura(e, Math.floor(p.x / CELULA), Math.floor(p.z / CELULA)) * ALTURA_NIVEL;
      base.position.set(p.x, y + 0.15, p.z); arma.position.set(p.x, y + 0.9, p.z);
      cena.add(base, arma); pedestais.push({ base, arma });
    }
    bandeiras.splice(0).forEach(b => cena.remove(b));
    for (const b of e.bandeiras) {
      const g = new THREE.Group();
      const mastro = new THREE.Mesh(geoMastro, matPedestal); mastro.position.y = 1.1;
      const pano = new THREE.Mesh(geoPano, guardar(new THREE.MeshBasicMaterial({ color: CORES_TIME[b.time], side: THREE.DoubleSide })));
      pano.position.set(0.45, 1.9, 0);
      g.add(mastro, pano); cena.add(g); bandeiras.push(g);
    }
  }

  function efeitosDoPasso(e: EstadoFps) {
    for (const ev of e.eventos as EventoFps[]) {
      const humano = "jogador" in ev && ev.jogador < vagas.length && !vagas[ev.jogador]?.bot && !e.soldados[ev.jogador]?.extra;
      if (ev.tipo === "tiro") {
        if (ev.jogador === seguir || Math.random() < 0.5) som.chute();
        const l = new THREE.Line(geoTiro, new THREE.LineBasicMaterial({ color: COR_ARMA[ev.arma], transparent: true }));
        l.position.set(ev.x, ev.y, ev.z);
        l.lookAt(ev.ax, ev.ay, ev.az);
        l.scale.z = Math.max(0.1, Math.hypot(ev.ax - ev.x, ev.ay - ev.y, ev.az - ev.z));
        cena.add(l); tiros.push({ l, t: 0 });
        if (ev.jogador === seguir) { coice = 1; clarao.visible = true; }
      } else if (ev.tipo === "acerto") {
        som.bloco(); faisca(ev.x, ev.y, ev.z, "#dc2626", 6, 3);
        if (humano) ganchos.vibrarLocal(ev.jogador, 80);
        if (ev.jogador === seguir) { dano = 1; tremor = 0.15; }
      } else if (ev.tipo === "abate") {
        som.explosao(1); const s = e.soldados[ev.jogador]; faisca(s.x, s.y + 1, s.z, s.extra ? "#1f2937" : CORES_JOGADORES[ev.jogador % 8], 18, 6);
        if (ev.jogador < vagas.length && !e.soldados[ev.jogador].extra) ganchos.morte(ev.jogador);
      } else if (ev.tipo === "arma") { if (humano) som.powerup(); }
      else if (ev.tipo === "recarga") { if (ev.jogador === seguir) som.clique(); }
      else if (ev.tipo === "pulo") { if (ev.jogador === seguir && ev.encadeado > 0) som.moeda(); }
      else if (ev.tipo === "desliza") { if (ev.jogador === seguir) som.arremesso(); }
      else if (ev.tipo === "bandeira") { if (ev.acao === "capturou") som.vitoria(); else if (ev.acao === "pegou") som.alerta(); else som.clique(); }
      else if (ev.tipo === "voltou") { if (ev.jogador === seguir) som.escudo(); }
    }
  }

  function redimensionar() {
    const w = Math.max(1, caixa.clientWidth - 8), h = Math.max(1, caixa.clientHeight - 8);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  redimensionar();
  const guardarAnteriores = (e: EstadoFps) => e.soldados.forEach((s, i) => { const v = visualDe(i, e); v.x = s.x; v.y = s.y; v.z = s.z; v.ang = s.ang; });
  const lerpAng = (a: number, b: number, f: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * f;

  return {
    iniciarRodada() {
      estado = novaPartidaFps({ modo, mapa, semente: (Math.random() * 1e9) | 0, jogadores: vagas.map(v => ({ bot: v.bot })) });
      pendentes = [];
      faiscas.splice(0).forEach(f => { cena.remove(f.m); (f.m.material as THREE.Material).dispose(); });
      tiros.splice(0).forEach(t => { cena.remove(t.l); (t.l.material as THREE.Material).dispose(); });
      montarArena(estado);
      montarObjetos(estado);
      guardarAnteriores(estado);
    },
    passo(entradas: Entrada[]) {
      const e = estado;
      if (!e) return null;
      guardarAnteriores(e);
      if (!e.terminado) { passoFps(e, entradas); efeitosDoPasso(e); if (pendentes.length < 400) pendentes.push(...e.eventos); }
      return e.terminado ? { vencedor: e.vencedor, time: e.timeVencedor, pontos: pontosFps(e) } : null;
    },
    desenhar(alfa: number, dt: number, fase: FasePartida, vencedor: number | null) {
      const e = estado;
      if (!e) return;
      tempo += dt;
      const primeira = seguir >= 0 && e.soldados[seguir]?.vivo;
      e.soldados.forEach((s, i) => {
        const v = visualDe(i, e);
        v.g.visible = s.vivo && !(primeira && i === seguir);
        if (!s.vivo) return;
        const x = v.x + (s.x - v.x) * alfa, y = v.y + (s.y - v.y) * alfa, z = v.z + (s.z - v.z) * alfa;
        const comemora = fase !== "jogando" && fase !== "contagem" && vencedor === i;
        v.g.position.set(x, y + (comemora ? Math.abs(Math.sin(tempo * 7)) * 0.4 : 0) - (s.deslizaAte > e.passo ? 0.5 : 0), z);
        const ang = lerpAng(v.ang, s.ang, alfa);
        // A figura encara a câmera; a arma aponta para onde o soldado olha.
        if (v.figura instanceof THREE.Mesh) { v.figura.quaternion.copy(camera.quaternion); }
        else v.figura.rotation.y = -ang;
        v.arma.parent!.rotation.y = -ang;
        v.arma.material = matArma[s.arma];
      });
      e.pedestais.forEach((p, i) => { const o = pedestais[i]; if (!o) return; o.arma.visible = e.passo >= p.voltaEm; o.arma.rotation.y = tempo * 2; o.arma.position.y = o.base.position.y + 0.75 + Math.sin(tempo * 3) * 0.1; });
      e.bandeiras.forEach((b, i) => { const g = bandeiras[i]; if (!g) return; g.position.set(b.x, b.com !== null ? e.soldados[b.com].y + 0.6 : altura(e, Math.floor(b.x / CELULA), Math.floor(b.z / CELULA)) * ALTURA_NIVEL, b.z); });
      anelColina.rotation.z = tempo;
      // Câmera.
      tremor = Math.max(0, tremor - dt);
      coice = Math.max(0, coice - dt * 8);
      dano = Math.max(0, dano - dt * 2);
      if (coice < 0.6) clarao.visible = false;
      veu.style.opacity = String(dano * 0.8);
      mira.style.display = primeira ? "block" : "none";
      armaFp.visible = !!primeira;
      if (primeira) {
        const s = e.soldados[seguir], v = visuais[seguir];
        const x = v.x + (s.x - v.x) * alfa, y = v.y + (s.y - v.y) * alfa, z = v.z + (s.z - v.z) * alfa;
        const ang = lerpAng(v.ang, s.ang, alfa);
        const olho = s.deslizaAte > e.passo ? 0.8 : 1.5;
        const balanco = s.noChao ? Math.sin(tempo * 10) * 0.03 : 0;
        camera.position.set(x + (Math.random() - 0.5) * tremor, y + olho + balanco, z + (Math.random() - 0.5) * tremor);
        camera.rotation.set(0, 0, 0);
        camera.lookAt(x + Math.cos(ang) * 10, y + olho + Math.sin(s.pitch) * 3 * Math.max(0, coice), z + Math.sin(ang) * 10);
        armaFp.material = matArma[s.arma];
        armaFp.position.z = -0.5 + coice * 0.06;
        armaFp.scale.set(1, 1, s.arma === "sniper" ? 1.6 : s.arma === "rifle" ? 1.3 : 1);
        armaFp.rotation.x = s.recarregando > 0 ? -0.8 : coice * 0.15;
      } else {
        const dist = (TAMANHO / (2 * Math.tan((camera.fov * Math.PI) / 360) * Math.min(1, camera.aspect))) * 0.75;
        camera.position.set(meio, dist * 0.9, meio + dist * 0.5);
        camera.lookAt(meio, 0, meio + 1);
      }
      for (let k = tiros.length - 1; k >= 0; k--) {
        const t = tiros[k];
        t.t += dt; (t.l.material as THREE.LineBasicMaterial).opacity = Math.max(0, 1 - t.t / 0.15);
        if (t.t > 0.15) { cena.remove(t.l); (t.l.material as THREE.Material).dispose(); tiros.splice(k, 1); }
      }
      for (let k = faiscas.length - 1; k >= 0; k--) {
        const f = faiscas[k];
        f.t += dt; f.v.y -= 9 * dt; f.m.position.addScaledVector(f.v, dt);
        if (f.t > 0.7) { cena.remove(f.m); (f.m.material as THREE.Material).dispose(); faiscas.splice(k, 1); }
      }
      renderer.render(cena, camera);
    },
    placar() {
      const e = estado;
      if (!e) return { tempo: 0, jogadores: [] };
      const vez = (s: EstadoFps["soldados"][number]) => {
        const A = ARMAS[s.arma];
        const municao = s.recarregando > 0 ? "recarregando" : `${s.pente}/${s.arma === "pistola" ? "∞" : s.reserva}`;
        return `❤${Math.ceil(s.vida)} · ${A.nome} ${municao}`;
      };
      return {
        tempo: Math.max(0, Math.ceil((TEMPO - e.passo) / 60)),
        alerta: TEMPO - e.passo < 20 * 60,
        jogadores: e.soldados.filter(s => !s.extra).map(s => ({
          vivo: s.vivo,
          texto: !s.vivo ? `abatido · volta em ${Math.max(0, Math.ceil((s.voltaEm - e.passo) / 60))} s` : `${vez(s)} · ${s.abates}💀${e.modo === "colina" ? ` · ${s.pontos}👑` : ""}${e.times && e.modo !== "bots" ? ` · ${s.time ? "azul" : "vermelho"}` : ""}${s.bandeira !== null ? " · 🚩" : ""}${e.modo === "bandeira" || (e.modo === "colina" && e.times) ? ` · ${e.placarTimes[0]}×${e.placarTimes[1]}` : ""}`,
        })),
      };
    },
    redimensionar,
    quadro() { return estado ? serializar({ ...estado, eventos: [] }) : null; },
    tirarEventos() { const l = pendentes.map(x => serializar(x)); pendentes = []; return l; },
    aplicar(s: unknown, eventos: unknown[]) {
      const e = desserializar(s) as EstadoFps | null;
      if (!e || !Array.isArray(e.soldados) || !Array.isArray(e.alturas)) return;
      if (estado) guardarAnteriores(estado); else guardarAnteriores(e);
      const novo = !estado || estado.alturas.join() !== e.alturas.join();
      estado = e;
      e.eventos = eventos.map(x => desserializar(x)) as EventoFps[];
      if (novo) { montarArena(e); montarObjetos(e); }
      efeitosDoPasso(e);
    },
    destruir() {
      faiscas.forEach(f => (f.m.material as THREE.Material).dispose());
      tiros.forEach(t => (t.l.material as THREE.Material).dispose());
      blocos.dispose(); topos.dispose();
      descartaveis.forEach(d => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      mira.remove(); veu.remove();
    },
  };
}
