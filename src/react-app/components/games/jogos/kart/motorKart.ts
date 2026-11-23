import * as THREE from "three";
import type { Entrada } from "@/react-app/utils/games/bombas";
import {
  LARGURA_PISTA, RAIO_ARENA, VOLTAS, classificacao, novaPartidaKart, passoKart, pistaDe, pontosKart,
  type EstadoKart, type EventoKart, type ItemKart, type ModoKart, type PistaKart,
} from "@/react-app/utils/games/kart";
import { desserializar, serializar } from "@/react-app/utils/games/espelho";
import type { FasePartida, GanchosMotor, MotorJogo, VagaJogo } from "../../comum/MolduraPartida";
import { som } from "../../audio/sintetizador";
import { CORES_JOGADORES, folhaDoCorpo, quadroDoCorpo } from "../../central/sprites";

export const PISTAS_KART: Record<PistaKart, { nome: string; ceu: string; chao: string; asfalto: string; arvore: string; noite: boolean }> = {
  verde: { nome: "Circuito Verde", ceu: "#7dd3fc", chao: "#4d7c0f", asfalto: "#3f3f46", arvore: "#166534", noite: false },
  deserto: { nome: "Cânion do Deserto", ceu: "#fdba74", chao: "#d97706", asfalto: "#57534e", arvore: "#a16207", noite: false },
  neon: { nome: "Cidade Neon", ceu: "#0f0a2e", chao: "#1e1b4b", asfalto: "#18181b", arvore: "#a21caf", noite: true },
};
export const ICONE_ITEM: Record<ItemKart, string> = { missil: "🚀", escudo: "🛡", oleo: "🛢", turbo: "⚡" };
const COR_DRIFT = ["#ffffff", "#38bdf8", "#fb923c", "#c084fc"];
const LARGURA_FOLHA = 128;
const ALTURA_FOLHA = 48 * 7;

/** Motor do Kart Turbo & Balões (three.js): pista em fita, karts com o avatar ao volante, itens e balões. */
export function criarMotorKart(caixa: HTMLDivElement, vagas: VagaJogo[], modo: ModoKart, pista: PistaKart, ganchos: GanchosMotor): MotorJogo {
  const tema = PISTAS_KART[pista];
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute("aria-label", "Pista do Kart Turbo & Balões");
  renderer.domElement.className = "rounded-lg shadow-2xl ring-1 ring-white/10";
  caixa.appendChild(renderer.domElement);
  const cena = new THREE.Scene();
  cena.background = new THREE.Color(tema.ceu);
  cena.fog = new THREE.Fog(tema.ceu, 90, 220);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  cena.add(new THREE.HemisphereLight(tema.noite ? 0x818cf8 : 0xffffff, 0x334155, tema.noite ? 0.9 : 1.2));
  const sol = new THREE.DirectionalLight(0xffffff, tema.noite ? 0.6 : 1.3);
  sol.position.set(30, 60, 20);
  cena.add(sol);
  const descartaveis: { dispose(): void }[] = [];
  const guardar = <T extends { dispose(): void }>(x: T) => { descartaveis.push(x); return x; };

  // Chão e pista (ou arena).
  const chao = new THREE.Mesh(guardar(new THREE.PlaneGeometry(600, 600)), guardar(new THREE.MeshStandardMaterial({ color: tema.chao, roughness: 1 })));
  chao.rotation.x = -Math.PI / 2;
  cena.add(chao);
  let centro = new THREE.Vector3(0, 0, 0), extensao = RAIO_ARENA * 2;
  let sorteio = 1;
  const aleat = () => { sorteio = (sorteio * 16807) % 2147483647; return sorteio / 2147483647; };
  if (modo === "gp") {
    const P = pistaDe(pista);
    const fita = (meia: number, y: number, cor: (i: number) => THREE.Color) => {
      const pos: number[] = [], cores: number[] = [], idx: number[] = [];
      P.pontos.forEach((p, i) => {
        const t = P.tangentes[i], nx = -Math.sin(t), nz = Math.cos(t), c = cor(i);
        pos.push(p.x + nx * meia, y, p.z + nz * meia, p.x - nx * meia, y, p.z - nz * meia);
        cores.push(c.r, c.g, c.b, c.r, c.g, c.b);
        const a = i * 2, b = ((i + 1) % P.pontos.length) * 2;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      });
      const g = guardar(new THREE.BufferGeometry());
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(cores, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return new THREE.Mesh(g, guardar(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })));
    };
    const vermelho = new THREE.Color("#dc2626"), branco = new THREE.Color("#f8fafc"), asfalto = new THREE.Color(tema.asfalto);
    cena.add(fita(LARGURA_PISTA / 2 + 0.7, 0.02, i => (Math.floor(i / 3) % 2 ? vermelho : branco)));
    cena.add(fita(LARGURA_PISTA / 2, 0.04, i => (i < 2 ? branco : asfalto)));
    // Árvores (cones) fora da pista, sempre no mesmo lugar.
    const geoTronco = guardar(new THREE.ConeGeometry(1.4, 4, 7)), matArvore = guardar(new THREE.MeshStandardMaterial({ color: tema.arvore, emissive: tema.noite ? tema.arvore : "#000000", emissiveIntensity: tema.noite ? 0.6 : 0 }));
    const xs = P.pontos.map(p => p.x), zs = P.pontos.map(p => p.z);
    const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    centro = new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    extensao = Math.max(maxX - minX, maxZ - minZ) + 16;
    for (let k = 0; k < 90; k++) {
      const x = minX - 20 + aleat() * (maxX - minX + 40), z = minZ - 20 + aleat() * (maxZ - minZ + 40);
      if (Math.min(...P.pontos.map(p => Math.hypot(p.x - x, p.z - z))) < LARGURA_PISTA) continue;
      const a = new THREE.Mesh(geoTronco, matArvore);
      a.position.set(x, 2, z);
      cena.add(a);
    }
  } else {
    const piso = new THREE.Mesh(guardar(new THREE.CircleGeometry(RAIO_ARENA, 64)), guardar(new THREE.MeshStandardMaterial({ color: tema.asfalto, roughness: 0.8 })));
    piso.rotation.x = -Math.PI / 2; piso.position.y = 0.03;
    const muro = new THREE.Mesh(guardar(new THREE.TorusGeometry(RAIO_ARENA, 0.6, 8, 64)), guardar(new THREE.MeshStandardMaterial({ color: "#f43f5e", emissive: tema.noite ? "#f43f5e" : "#000000" })));
    muro.rotation.x = Math.PI / 2; muro.position.y = 0.5;
    cena.add(piso, muro);
  }

  // Caixas de item, mísseis, óleo e balões-alvo.
  const geoCaixa = guardar(new THREE.BoxGeometry(1.1, 1.1, 1.1));
  const matCaixa = guardar(new THREE.MeshStandardMaterial({ color: "#facc15", emissive: "#f59e0b", emissiveIntensity: 0.5, transparent: true, opacity: 0.85 }));
  let caixas: THREE.Mesh[] = [];
  const geoMissil = guardar(new THREE.ConeGeometry(0.3, 1.2, 8)), matMissil = guardar(new THREE.MeshStandardMaterial({ color: "#ef4444", emissive: "#991b1b" }));
  const geoOleo = guardar(new THREE.CircleGeometry(1.2, 20)), matOleo = guardar(new THREE.MeshBasicMaterial({ color: "#0a0a0a", transparent: true, opacity: 0.8 }));
  const geoBalao = guardar(new THREE.SphereGeometry(0.45, 14, 10));
  const geoAlvo = guardar(new THREE.SphereGeometry(0.8, 16, 12)), matAlvo = guardar(new THREE.MeshStandardMaterial({ color: "#fde047", emissive: "#ca8a04", emissiveIntensity: 0.4 }));
  const reserva = { misseis: [] as THREE.Mesh[], oleos: [] as THREE.Mesh[], alvos: [] as THREE.Mesh[] };
  const usar = (lista: THREE.Mesh[], n: number, criar: () => THREE.Mesh) => {
    while (lista.length < n) { const m = criar(); cena.add(m); lista.push(m); }
    lista.forEach((m, i) => { m.visible = i < n; });
    return lista;
  };

  // Karts: carroceria da cor da vaga, rodas, o avatar ao volante (plano que olha para a câmera), escudo e balões.
  const geoCorpo = guardar(new THREE.BoxGeometry(2, 0.6, 1.2)), geoBico = guardar(new THREE.BoxGeometry(0.7, 0.35, 1));
  const geoRoda = guardar(new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12)), matRoda = guardar(new THREE.MeshStandardMaterial({ color: "#111827" }));
  const geoEscudo = guardar(new THREE.SphereGeometry(1.6, 16, 12)), matEscudo = guardar(new THREE.MeshBasicMaterial({ color: "#38bdf8", transparent: true, opacity: 0.25, depthWrite: false }));
  const geoFaisca = guardar(new THREE.BoxGeometry(0.18, 0.18, 0.18));
  const karts = vagas.map((v, i) => {
    const g = new THREE.Group();
    const cor = CORES_JOGADORES[i % 8];
    const matCorpo = guardar(new THREE.MeshStandardMaterial({ color: cor, roughness: 0.4, metalness: 0.3 }));
    const corpo = new THREE.Mesh(geoCorpo, matCorpo); corpo.position.y = 0.5;
    const bico = new THREE.Mesh(geoBico, matCorpo); bico.position.set(1.2, 0.45, 0);
    g.add(corpo, bico);
    for (const [x, z] of [[0.7, 0.7], [0.7, -0.7], [-0.7, 0.7], [-0.7, -0.7]]) { const r = new THREE.Mesh(geoRoda, matRoda); r.rotation.x = Math.PI / 2; r.position.set(x, 0.35, z); g.add(r); }
    const escudo = new THREE.Mesh(geoEscudo, matEscudo); escudo.position.y = 0.8; g.add(escudo);
    const textura = guardar(new THREE.CanvasTexture(folhaDoCorpo(v.avatar, `corpo-${JSON.stringify(v.avatar)}`)));
    textura.magFilter = textura.minFilter = THREE.NearestFilter; textura.colorSpace = THREE.SRGBColorSpace;
    textura.repeat.set(32 / LARGURA_FOLHA, 48 / ALTURA_FOLHA);
    const piloto = new THREE.Mesh(guardar(new THREE.PlaneGeometry(1.2, 1.8)), guardar(new THREE.MeshBasicMaterial({ map: textura, transparent: true, alphaTest: 0.5 })));
    const baloes = [0, 1, 2].map(k => { const b = new THREE.Mesh(geoBalao, guardar(new THREE.MeshStandardMaterial({ color: cor, emissive: cor, emissiveIntensity: 0.25 }))); b.position.set(-0.9, 2 + k * 0.15, (k - 1) * 0.55); g.add(b); return b; });
    cena.add(g, piloto);
    return { g, piloto, textura, escudo, baloes, x: 0, z: 0, ang: 0 };
  });
  const faiscas: { m: THREE.Mesh; v: THREE.Vector3; t: number }[] = [];
  const faisca = (x: number, z: number, cor: string, n: number, forca: number) => {
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(geoFaisca, new THREE.MeshBasicMaterial({ color: cor }));
      m.position.set(x, 0.6, z); cena.add(m);
      faiscas.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * forca, Math.random() * forca, (Math.random() - 0.5) * forca), t: 0 });
    }
  };

  // Câmera: atrás do próprio kart quando esta tela é de uma pessoa só (celular ou sozinho); senão, a pista inteira.
  const minhas = vagas.map((v, i) => ({ v, i })).filter(({ v }) => v.privada);
  const humanos = vagas.map((v, i) => ({ v, i })).filter(({ v }) => !v.bot && v.controle === undefined);
  const seguir = minhas.length === 1 ? minhas[0].i : humanos.length === 1 && vagas.filter(v => !v.bot).length === 1 ? humanos[0].i : -1;
  const posCamera = new THREE.Vector3(), olhar = new THREE.Vector3();

  let estado: EstadoKart | null = null;
  let pendentes: unknown[] = [];
  let tempo = 0, tremor = 0;

  function efeitosDoPasso(e: EstadoKart) {
    for (const ev of e.eventos as EventoKart[]) {
      const humano = "jogador" in ev && !vagas[ev.jogador]?.bot;
      if (ev.tipo === "caixa") { som.moeda(); if (humano) ganchos.vibrarLocal(ev.jogador, 30); }
      else if (ev.tipo === "usou") som.arremesso();
      else if (ev.tipo === "turbo") { som.powerup(); const k = e.karts[ev.jogador]; faisca(k.x, k.z, COR_DRIFT[ev.nivel], 12, 5); }
      else if (ev.tipo === "giro") { som.explosao(1); faisca(ev.x, ev.z, "#fb923c", 14, 6); if (humano) ganchos.vibrarLocal(ev.jogador, 150); if (seguir === ev.jogador) tremor = 0.6; }
      else if (ev.tipo === "escudo") som.escudo();
      else if (ev.tipo === "balao") { som.chute(); faisca(ev.x, ev.z, CORES_JOGADORES[ev.jogador % 8], 16, 7); }
      else if (ev.tipo === "fora") { som.morte(); ganchos.morte(ev.jogador); }
      else if (ev.tipo === "alvo") { som.moeda(); faisca(ev.x, ev.z, "#fde047", 16, 7); }
      else if (ev.tipo === "volta") { if (humano) som.contagem(ev.volta >= VOLTAS); }
      else if (ev.tipo === "chegou") { if (humano) som.vitoria(); }
      else if (ev.tipo === "batida") { if (Math.random() < 0.3) som.bloco(); }
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
      estado = novaPartidaKart({ modo, pista, semente: (Math.random() * 1e9) | 0, jogadores: vagas.map(v => ({ bot: v.bot })) });
      pendentes = [];
      faiscas.splice(0).forEach(f => cena.remove(f.m));
      estado.karts.forEach((k, i) => Object.assign(karts[i], { x: k.x, z: k.z, ang: k.ang }));
      caixas.forEach(c => cena.remove(c));
      caixas = estado.caixas.map(c => { const m = new THREE.Mesh(geoCaixa, matCaixa); m.position.set(c.x, 0.9, c.z); cena.add(m); return m; });
    },
    passo(entradas: Entrada[]) {
      const e = estado;
      if (!e) return null;
      e.karts.forEach((k, i) => Object.assign(karts[i], { x: k.x, z: k.z, ang: k.ang }));
      if (!e.terminado) { passoKart(e, entradas); efeitosDoPasso(e); if (pendentes.length < 400) pendentes.push(...e.eventos); }
      return e.terminado ? { vencedor: e.vencedor, pontos: pontosKart(e) } : null;
    },
    desenhar(alfa: number, dt: number, fase: FasePartida, vencedor: number | null) {
      const e = estado;
      if (!e) return;
      tempo += dt;
      if (caixas.length !== e.caixas.length) { caixas.forEach(c => cena.remove(c)); caixas = e.caixas.map(c => { const m = new THREE.Mesh(geoCaixa, matCaixa); m.position.set(c.x, 0.9, c.z); cena.add(m); return m; }); }
      e.caixas.forEach((c, i) => { const m = caixas[i]; m.visible = e.passo >= c.voltaEm; m.rotation.set(tempo, tempo * 1.3, 0); m.position.y = 0.9 + Math.sin(tempo * 3 + i) * 0.15; });
      usar(reserva.misseis, e.misseis.length, () => new THREE.Mesh(geoMissil, matMissil)).forEach((m, i) => { const s = e.misseis[i]; if (!s) return; m.position.set(s.x, 0.7, s.z); m.rotation.set(0, -s.ang, -Math.PI / 2); });
      usar(reserva.oleos, e.oleos.length, () => { const m = new THREE.Mesh(geoOleo, matOleo); m.rotation.x = -Math.PI / 2; return m; }).forEach((m, i) => { const o = e.oleos[i]; if (o) m.position.set(o.x, 0.06, o.z); });
      usar(reserva.alvos, e.alvos.length, () => new THREE.Mesh(geoAlvo, matAlvo)).forEach((m, i) => { const a = e.alvos[i]; if (a) m.position.set(a.x, 1.4 + Math.sin(tempo * 2 + i) * 0.3, a.z); });
      e.karts.forEach((k, i) => {
        const o = karts[i];
        const visivel = !k.fora;
        o.g.visible = o.piloto.visible = visivel;
        if (!visivel) return;
        let da = k.ang - o.ang; da = Math.atan2(Math.sin(da), Math.cos(da));
        const x = o.x + (k.x - o.x) * alfa, z = o.z + (k.z - o.z) * alfa, ang = o.ang + da * alfa;
        const girando = e.passo < k.giroAte;
        o.g.position.set(x, 0, z);
        o.g.rotation.y = -ang + (girando ? tempo * 14 : k.drift * 0.35);
        o.escudo.visible = e.passo < k.escudoAte;
        o.baloes.forEach((b, j) => { b.visible = e.modo === "baloes" && j < k.baloes; b.position.y = 2 + j * 0.15 + Math.sin(tempo * 3 + j + i) * 0.1; });
        // Faíscas do drift na cor do nível que já carregou.
        if (k.drift !== 0 && Math.random() < 0.5) {
          const nivel = k.carga >= 150 ? 3 : k.carga >= 90 ? 2 : k.carga >= 40 ? 1 : 0;
          faisca(x - Math.cos(ang) * 1.1, z - Math.sin(ang) * 1.1, COR_DRIFT[nivel], 1, 2);
        }
        if (e.passo < k.turboAte && Math.random() < 0.6) faisca(x - Math.cos(ang) * 1.3, z - Math.sin(ang) * 1.3, "#f97316", 1, 1.5);
        const comemora = fase !== "jogando" && fase !== "contagem" && vencedor === i;
        const r = quadroDoCorpo("baixo", comemora ? "vitoria" : "parado", tempo + i * 0.37);
        o.textura.offset.set(r.sx / LARGURA_FOLHA, 1 - (r.sy + r.h) / ALTURA_FOLHA);
        o.textura.repeat.set(r.w / LARGURA_FOLHA, r.h / ALTURA_FOLHA);
        o.piloto.position.set(x, 1.6 + (comemora ? Math.abs(Math.sin(tempo * 7)) * 0.4 : 0), z);
        o.piloto.quaternion.copy(camera.quaternion);
      });
      // Câmera.
      tremor = Math.max(0, tremor - dt * 1.5);
      if (seguir >= 0 && !e.karts[seguir].fora) {
        const o = karts[seguir], k = e.karts[seguir];
        const x = o.g.position.x, z = o.g.position.z, ang = k.ang;
        posCamera.set(x - Math.cos(ang) * 9, 5.5, z - Math.sin(ang) * 9);
        camera.position.lerp(posCamera, Math.min(1, dt * 5));
        olhar.set(x + Math.cos(ang) * 6, 0.8, z + Math.sin(ang) * 6);
        camera.lookAt(olhar);
      } else {
        const dist = extensao / (2 * Math.tan((camera.fov * Math.PI) / 360) * Math.min(1, camera.aspect)) * 0.85;
        camera.position.set(centro.x, dist * 0.82, centro.z + dist * 0.55);
        camera.lookAt(centro.x, 0, centro.z + 2);
      }
      if (tremor > 0) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * tremor, (Math.random() - 0.5) * tremor, 0));
      for (let k = faiscas.length - 1; k >= 0; k--) {
        const f = faiscas[k];
        f.t += dt; f.v.y -= 9 * dt; f.m.position.addScaledVector(f.v, dt);
        if (f.t > 0.8) { cena.remove(f.m); (f.m.material as THREE.Material).dispose(); faiscas.splice(k, 1); }
      }
      renderer.render(cena, camera);
    },
    placar() {
      const e = estado;
      if (!e) return { tempo: 0, jogadores: [] };
      const pos = classificacao(e);
      const restante = e.modo === "gp" ? Math.floor(e.passo / 60) : Math.max(0, Math.ceil((e.meta - e.passo) / 60));
      return {
        tempo: restante,
        jogadores: e.karts.map(k => ({
          vivo: !k.fora,
          texto: e.modo === "gp"
            ? `${k.posicao ? `🏁 ${k.posicao}º` : `${pos[k.id]}º · volta ${Math.min(VOLTAS, k.volta + 1)}/${VOLTAS}`}${k.item ? ` · ${ICONE_ITEM[k.item]}` : ""}`
            : e.karts.length === 1 ? `🎈 ${k.estouros}/10${k.item ? ` · ${ICONE_ITEM[k.item]}` : ""}` : `${"🎈".repeat(Math.max(0, k.baloes))}${k.fora ? "fora" : ""}${k.item ? ` · ${ICONE_ITEM[k.item]}` : ""}`,
        })),
      };
    },
    redimensionar,
    quadro() { return estado ? serializar({ ...estado, eventos: [] }) : null; },
    tirarEventos() { const l = pendentes.map(x => serializar(x)); pendentes = []; return l; },
    aplicar(s: unknown, eventos: unknown[]) {
      const e = desserializar(s) as EstadoKart | null;
      if (!e || !Array.isArray(e.karts)) return;
      (estado ?? e).karts.forEach((k, i) => { if (karts[i]) Object.assign(karts[i], { x: k.x, z: k.z, ang: k.ang }); });
      estado = e;
      e.eventos = eventos.map(x => desserializar(x)) as EventoKart[];
      efeitosDoPasso(e);
    },
    destruir() {
      faiscas.forEach(f => (f.m.material as THREE.Material).dispose());
      descartaveis.forEach(d => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
