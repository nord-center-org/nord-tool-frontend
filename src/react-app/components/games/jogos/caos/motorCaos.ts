import * as THREE from "three";
import type { Entrada } from "@/react-app/utils/games/bombas";
import {
  ENTREGAS_SOLO, PASSO_QUADRA, POSTOS, QUADRAS, RAIO_DERBY, RUA, TAMANHO, centro, novaPartidaCaos, passoCaos, pontosCaos,
  type Carro, type CidadeCaos, type EstadoCaos, type EventoCaos, type ModoCaos,
} from "@/react-app/utils/games/caos";
import { desserializar, serializar } from "@/react-app/utils/games/espelho";
import type { FasePartida, GanchosMotor, MotorJogo, VagaJogo } from "../../comum/MolduraPartida";
import { som } from "../../audio/sintetizador";
import { CORES_JOGADORES, folhaDoCorpo, quadroDoCorpo } from "../../central/sprites";

export const CIDADES_CAOS: Record<CidadeCaos, { nome: string; ceu: string; chao: string; asfalto: string; predios: string[]; noite: boolean }> = {
  centro: { nome: "Centro", ceu: "#93c5fd", chao: "#9ca3af", asfalto: "#374151", predios: ["#e5e7eb", "#cbd5e1", "#fde68a", "#fca5a5"], noite: false },
  porto: { nome: "Porto", ceu: "#a5b4fc", chao: "#78716c", asfalto: "#44403c", predios: ["#b45309", "#57534e", "#0e7490", "#a8a29e"], noite: false },
  noite: { nome: "Cidade à noite", ceu: "#0b1020", chao: "#1f2937", asfalto: "#111827", predios: ["#1e293b", "#312e81", "#3b0764", "#0f172a"], noite: true },
};
const LARGURA_FOLHA = 128;
const ALTURA_FOLHA = 48 * 7;

/** Motor do Caos Urbano (three.js): cidade em grade com prédios, praças, carros, viaturas, encomendas e postos. */
export function criarMotorCaos(caixa: HTMLDivElement, vagas: VagaJogo[], modo: ModoCaos, cidade: CidadeCaos, ganchos: GanchosMotor): MotorJogo {
  const tema = CIDADES_CAOS[cidade];
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute("aria-label", "Cidade do Caos Urbano");
  renderer.domElement.className = "rounded-lg shadow-2xl ring-1 ring-white/10";
  caixa.appendChild(renderer.domElement);
  const cena = new THREE.Scene();
  cena.background = new THREE.Color(tema.ceu);
  cena.fog = new THREE.Fog(tema.ceu, 80, 260);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600);
  cena.add(new THREE.HemisphereLight(tema.noite ? 0x6366f1 : 0xffffff, 0x334155, tema.noite ? 0.7 : 1.15));
  const sol = new THREE.DirectionalLight(0xffffff, tema.noite ? 0.4 : 1.2);
  sol.position.set(60, 120, 40);
  cena.add(sol);
  const descartaveis: { dispose(): void }[] = [];
  const guardar = <T extends { dispose(): void }>(x: T) => { descartaveis.push(x); return x; };

  // Chão (calçadas), ruas e prédios/praças são montados por rodada (a cidade é sorteada).
  const chao = new THREE.Mesh(guardar(new THREE.PlaneGeometry(TAMANHO + 80, TAMANHO + 80)), guardar(new THREE.MeshStandardMaterial({ color: tema.chao, roughness: 1 })));
  chao.rotation.x = -Math.PI / 2; chao.position.set(TAMANHO / 2, -0.01, TAMANHO / 2);
  cena.add(chao);
  const matRua = guardar(new THREE.MeshStandardMaterial({ color: tema.asfalto, roughness: 0.95 }));
  for (let k = 0; k <= QUADRAS; k++) {
    for (const vertical of [true, false]) {
      const r = new THREE.Mesh(guardar(new THREE.PlaneGeometry(vertical ? RUA : TAMANHO + RUA, vertical ? TAMANHO + RUA : RUA)), matRua);
      r.rotation.x = -Math.PI / 2;
      r.position.set(vertical ? k * PASSO_QUADRA : TAMANHO / 2, 0.01, vertical ? TAMANHO / 2 : k * PASSO_QUADRA);
      cena.add(r);
    }
  }
  const grupoCidade = new THREE.Group();
  cena.add(grupoCidade);
  const geoCaixa = guardar(new THREE.BoxGeometry(1, 1, 1));
  const matsPredio = tema.predios.map(c => guardar(new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, emissive: tema.noite ? "#fde68a" : "#000000", emissiveIntensity: tema.noite ? 0.08 : 0 })));
  const matPraca = guardar(new THREE.MeshStandardMaterial({ color: "#4d7c0f", roughness: 1 }));
  const matArvore = guardar(new THREE.MeshStandardMaterial({ color: "#166534" }));
  const geoArvore = guardar(new THREE.ConeGeometry(1.2, 3.5, 7));
  function montarCidade(e: EstadoCaos) {
    grupoCidade.clear();
    e.predios.forEach((p, k) => {
      const m = new THREE.Mesh(geoCaixa, matsPredio[k % matsPredio.length]);
      m.scale.set(p.x1 - p.x0, p.altura, p.z1 - p.z0);
      m.position.set((p.x0 + p.x1) / 2, p.altura / 2, (p.z0 + p.z1) / 2);
      grupoCidade.add(m);
    });
    e.pracas.forEach((praca, k) => {
      if (!praca) return;
      const i = k % QUADRAS, j = Math.floor(k / QUADRAS);
      const m = new THREE.Mesh(geoCaixa, matPraca);
      m.scale.set(PASSO_QUADRA - RUA, 0.1, PASSO_QUADRA - RUA);
      m.position.set(i * PASSO_QUADRA + PASSO_QUADRA / 2, 0.03, j * PASSO_QUADRA + PASSO_QUADRA / 2);
      grupoCidade.add(m);
      if (modo !== "derby") for (const [dx, dz] of [[-4, -4], [4, 4], [4, -4]]) { const a = new THREE.Mesh(geoArvore, matArvore); a.position.set(m.position.x + dx, 1.75, m.position.z + dz); grupoCidade.add(a); }
    });
    if (modo === "derby") {
      const anel = new THREE.Mesh(guardar(new THREE.TorusGeometry(RAIO_DERBY + 1, 0.8, 8, 64)), guardar(new THREE.MeshStandardMaterial({ color: "#f59e0b", emissive: "#b45309" })));
      anel.rotation.x = Math.PI / 2; anel.position.set(centro.x, 0.6, centro.z);
      grupoCidade.add(anel);
    }
  }

  // Carros: carroceria e cabine; jogadores na cor da vaga com o avatar, viatura com sirene, sucata enferrujada.
  const geoCorpo = guardar(new THREE.BoxGeometry(2.4, 0.7, 1.3)), geoCabine = guardar(new THREE.BoxGeometry(1.2, 0.55, 1.15));
  const matVidro = guardar(new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.2, metalness: 0.5 }));
  const matPolicia = guardar(new THREE.MeshStandardMaterial({ color: "#f8fafc" })), matSucata = guardar(new THREE.MeshStandardMaterial({ color: "#78350f", roughness: 1 }));
  const geoSirene = guardar(new THREE.BoxGeometry(0.3, 0.2, 0.9));
  const matAzul = guardar(new THREE.MeshBasicMaterial({ color: "#3b82f6" })), matVermelho = guardar(new THREE.MeshBasicMaterial({ color: "#ef4444" }));
  const montarCarro = (mat: THREE.Material) => {
    const g = new THREE.Group();
    const corpo = new THREE.Mesh(geoCorpo, mat); corpo.position.y = 0.55;
    const cabine = new THREE.Mesh(geoCabine, matVidro); cabine.position.set(-0.2, 1.15, 0);
    g.add(corpo, cabine);
    cena.add(g);
    return g;
  };
  const jogadores = vagas.map((v, i) => {
    const g = montarCarro(guardar(new THREE.MeshStandardMaterial({ color: CORES_JOGADORES[i % 8], roughness: 0.35, metalness: 0.4 })));
    const textura = guardar(new THREE.CanvasTexture(folhaDoCorpo(v.avatar, `corpo-${JSON.stringify(v.avatar)}`)));
    textura.magFilter = textura.minFilter = THREE.NearestFilter; textura.colorSpace = THREE.SRGBColorSpace;
    const r = quadroDoCorpo("baixo", "parado", 0);
    textura.offset.set(r.sx / LARGURA_FOLHA, 1 - (r.sy + r.h) / ALTURA_FOLHA); textura.repeat.set(r.w / LARGURA_FOLHA, r.h / ALTURA_FOLHA);
    const piloto = new THREE.Mesh(guardar(new THREE.PlaneGeometry(1.1, 1.65)), guardar(new THREE.MeshBasicMaterial({ map: textura, transparent: true, alphaTest: 0.5 })));
    cena.add(piloto);
    return { g, piloto, x: 0, z: 0, ang: 0 };
  });
  const outros = new Map<number, { g: THREE.Group; sirene?: THREE.Mesh[] }>();
  const marcadores = { encomendas: [] as THREE.Mesh[], destinos: [] as THREE.Mesh[], postos: [] as THREE.Mesh[] };
  const geoEncomenda = guardar(new THREE.BoxGeometry(1.2, 1.2, 1.2)), matEncomenda = guardar(new THREE.MeshStandardMaterial({ color: "#f59e0b", emissive: "#b45309", emissiveIntensity: 0.6 }));
  const geoAnel = guardar(new THREE.TorusGeometry(3, 0.3, 8, 32));
  const matDestino = guardar(new THREE.MeshBasicMaterial({ color: "#22c55e" })), matPosto = guardar(new THREE.MeshBasicMaterial({ color: "#a855f7" })), matPostoProx = guardar(new THREE.MeshBasicMaterial({ color: "#facc15" }));
  const usar = (lista: THREE.Mesh[], n: number, criar: () => THREE.Mesh) => {
    while (lista.length < n) { const m = criar(); cena.add(m); lista.push(m); }
    lista.forEach((m, i) => { m.visible = i < n; });
    return lista;
  };
  // Marcas de derrapagem e fumaça.
  const geoMarca = guardar(new THREE.PlaneGeometry(0.5, 0.5)), matMarca = guardar(new THREE.MeshBasicMaterial({ color: "#0a0a0a", transparent: true, opacity: 0.5, depthWrite: false }));
  const marcas: THREE.Mesh[] = [];
  let proximaMarca = 0;
  const geoFumaca = guardar(new THREE.SphereGeometry(0.4, 6, 5));
  const fumacas: { m: THREE.Mesh; t: number; v: THREE.Vector3 }[] = [];
  const fumaca = (x: number, z: number, cor: string, n: number, forca: number) => {
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(geoFumaca, new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.8 }));
      m.position.set(x, 0.6, z); cena.add(m);
      fumacas.push({ m, t: 0, v: new THREE.Vector3((Math.random() - 0.5) * forca, Math.random() * forca, (Math.random() - 0.5) * forca) });
    }
  };

  // Câmera: atrás do próprio carro no celular ou com uma pessoa só; senão, a cidade (ou a arena do derby) de cima.
  const minhas = vagas.map((v, i) => ({ v, i })).filter(({ v }) => v.privada);
  const humanos = vagas.map((v, i) => ({ v, i })).filter(({ v }) => !v.bot && v.controle === undefined);
  const seguir = minhas.length === 1 ? minhas[0].i : humanos.length === 1 && vagas.filter(v => !v.bot).length === 1 ? humanos[0].i : -1;
  const posCamera = new THREE.Vector3(), olhar = new THREE.Vector3();

  let estado: EstadoCaos | null = null;
  let pendentes: unknown[] = [];
  let tempo = 0, tremor = 0;

  function efeitosDoPasso(e: EstadoCaos) {
    for (const ev of e.eventos as EventoCaos[]) {
      if (ev.tipo === "batida") { if (ev.forca > 0.3) { som.bloco(); fumaca(ev.x, ev.z, "#9ca3af", 4, 3); } }
      else if (ev.tipo === "dano") { if (!vagas[ev.jogador]?.bot) ganchos.vibrarLocal(ev.jogador, 60); if (seguir === ev.jogador) tremor = 0.4; }
      else if (ev.tipo === "destruido") { som.explosao(2); fumaca(ev.x, ev.z, "#f97316", 16, 6); fumaca(ev.x, ev.z, "#1f2937", 12, 4); ganchos.morte(ev.jogador); }
      else if (ev.tipo === "preso") { som.alerta(); ganchos.morte(ev.jogador); }
      else if (ev.tipo === "estrela") som.alerta();
      else if (ev.tipo === "pegou") { som.moeda(); if (!vagas[ev.jogador]?.bot) ganchos.vibrarLocal(ev.jogador, 30); }
      else if (ev.tipo === "entregou") som.powerup();
      else if (ev.tipo === "posto") som.moeda();
      else if (ev.tipo === "chegou") { if (!vagas[ev.jogador]?.bot) som.vitoria(); }
      else if (ev.tipo === "nitro") { const c = e.carros[ev.jogador]; fumaca(c.x - Math.cos(c.ang) * 1.4, c.z - Math.sin(c.ang) * 1.4, "#38bdf8", 2, 1); }
    }
  }

  function redimensionar() {
    const w = Math.max(1, caixa.clientWidth - 8), h = Math.max(1, caixa.clientHeight - 8);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  redimensionar();
  const guardarAnteriores = (e: EstadoCaos) => e.carros.forEach((c, i) => Object.assign(jogadores[i], { x: c.x, z: c.z, ang: c.ang }));
  const posicionar = (g: THREE.Object3D, c: Carro, x: number, z: number, ang: number) => {
    g.visible = !c.fora || c.papel === "sucata";
    g.position.set(x, 0, z);
    g.rotation.set(0, -ang, c.fora ? 0.6 : 0);
  };

  return {
    iniciarRodada() {
      estado = novaPartidaCaos({ modo, cidade, semente: (Math.random() * 1e9) | 0, jogadores: vagas.map(v => ({ bot: v.bot })) });
      pendentes = [];
      montarCidade(estado);
      guardarAnteriores(estado);
      outros.forEach(o => cena.remove(o.g)); outros.clear();
    },
    passo(entradas: Entrada[]) {
      const e = estado;
      if (!e) return null;
      guardarAnteriores(e);
      if (!e.terminado) { passoCaos(e, entradas); efeitosDoPasso(e); if (pendentes.length < 400) pendentes.push(...e.eventos); }
      return e.terminado ? { vencedor: e.vencedor, pontos: pontosCaos(e) } : null;
    },
    desenhar(alfa: number, dt: number, fase: FasePartida, vencedor: number | null) {
      const e = estado;
      if (!e) return;
      tempo += dt;
      e.carros.forEach((c, i) => {
        const o = jogadores[i];
        let da = c.ang - o.ang; da = Math.atan2(Math.sin(da), Math.cos(da));
        const x = o.x + (c.x - o.x) * alfa, z = o.z + (c.z - o.z) * alfa, ang = o.ang + da * alfa;
        posicionar(o.g, c, x, z, ang);
        o.g.visible = true;
        const comemora = fase !== "jogando" && fase !== "contagem" && vencedor === i;
        o.piloto.visible = !c.fora;
        o.piloto.position.set(x, 2.3 + (comemora ? Math.abs(Math.sin(tempo * 7)) * 0.5 : 0), z);
        o.piloto.quaternion.copy(camera.quaternion);
        if (c.derrapando && !c.fora) {
          let m = marcas[proximaMarca];
          if (!m) { m = new THREE.Mesh(geoMarca, matMarca); m.rotation.x = -Math.PI / 2; cena.add(m); marcas.push(m); }
          m.position.set(x - Math.cos(ang) * 1, 0.03, z - Math.sin(ang) * 1);
          proximaMarca = (proximaMarca + 1) % 400;
          if (Math.random() < 0.3) fumaca(x, z, "#d1d5db", 1, 1);
        }
      });
      for (const c of e.cidadaos) {
        let o = outros.get(c.id);
        if (!o) {
          const g = montarCarro(c.papel === "policia" ? matPolicia : matSucata);
          const sirene = c.papel === "policia" ? [matAzul, matVermelho].map((m, k) => { const s = new THREE.Mesh(geoSirene, m); s.position.set(-0.2, 1.5, k ? -0.25 : 0.25); g.add(s); return s; }) : undefined;
          o = { g, sirene };
          outros.set(c.id, o);
        }
        posicionar(o.g, c, c.x, c.z, c.ang);
        if (o.sirene) { const liga = Math.sin(tempo * 12) > 0; o.sirene[0].visible = liga; o.sirene[1].visible = !liga; }
      }
      const livres = e.encomendas.filter(k => k.com === null);
      usar(marcadores.encomendas, livres.length, () => new THREE.Mesh(geoEncomenda, matEncomenda)).forEach((m, i) => { const k = livres[i]; if (k) { m.position.set(k.x, 1 + Math.sin(tempo * 3 + i) * 0.3, k.z); m.rotation.y = tempo; } });
      const levando = e.encomendas.filter(k => k.com !== null);
      usar(marcadores.destinos, levando.length, () => { const m = new THREE.Mesh(geoAnel, matDestino); m.rotation.x = Math.PI / 2; return m; }).forEach((m, i) => { const k = levando[i]; if (k) m.position.set(k.dx, 0.4, k.dz); });
      const proximos = new Set(e.carros.filter(c => c.posto < POSTOS).map(c => c.posto));
      usar(marcadores.postos, e.postos.length, () => { const m = new THREE.Mesh(geoAnel, matPosto); return m; }).forEach((m, i) => {
        const p = e.postos[i]; if (!p) return;
        const alvo = seguir >= 0 ? e.carros[seguir].posto === i : proximos.has(i);
        m.material = alvo ? matPostoProx : matPosto;
        m.position.set(p.x, 3, p.z); m.rotation.y = tempo; m.scale.setScalar(alvo ? 1.2 : 0.7);
        m.visible = seguir >= 0 ? e.carros[seguir].posto <= i : true;
      });
      // Câmera.
      tremor = Math.max(0, tremor - dt * 1.5);
      if (seguir >= 0) {
        const o = jogadores[seguir], c = e.carros[seguir];
        posCamera.set(o.g.position.x - Math.cos(c.ang) * 11, 6.5, o.g.position.z - Math.sin(c.ang) * 11);
        camera.position.lerp(posCamera, Math.min(1, dt * 5));
        olhar.set(o.g.position.x + Math.cos(c.ang) * 8, 1, o.g.position.z + Math.sin(c.ang) * 8);
        camera.lookAt(olhar);
      } else {
        const ext = modo === "derby" ? RAIO_DERBY * 2.3 : TAMANHO + 10, alvo = modo === "derby" ? centro : { x: TAMANHO / 2, z: TAMANHO / 2 };
        const d = (ext / (2 * Math.tan((camera.fov * Math.PI) / 360) * Math.min(1, camera.aspect))) * 0.8;
        camera.position.set(alvo.x, d * 0.85, alvo.z + d * 0.5);
        camera.lookAt(alvo.x, 0, alvo.z + 3);
      }
      if (tremor > 0) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * tremor, (Math.random() - 0.5) * tremor, 0));
      for (let k = fumacas.length - 1; k >= 0; k--) {
        const f = fumacas[k];
        f.t += dt; f.m.position.addScaledVector(f.v, dt); f.m.scale.setScalar(1 + f.t * 2);
        (f.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 - f.t);
        if (f.t > 0.8) { cena.remove(f.m); (f.m.material as THREE.Material).dispose(); fumacas.splice(k, 1); }
      }
      renderer.render(cena, camera);
    },
    placar() {
      const e = estado;
      if (!e) return { tempo: 0, jogadores: [] };
      const solo = e.carros.length === 1;
      const restante = modo === "corrida" ? Math.floor(e.passo / 60) : Math.max(0, Math.ceil((e.meta - e.passo) / 60));
      return {
        tempo: restante,
        alerta: modo !== "corrida" && e.meta - e.passo < 20 * 60,
        jogadores: e.carros.map(c => ({
          vivo: !c.fora,
          texto: modo === "fuga" ? (c.fora ? "preso" : `${"⭐".repeat(e.estrelas)} · ${Math.round(c.pontos)} pts`)
            : modo === "entregas" ? `📦 ${c.entregas}${solo ? `/${ENTREGAS_SOLO}` : ""}${c.carga !== null ? " · levando" : ""} · ${Math.round(c.pontos)} pts`
            : modo === "derby" ? (c.fora ? "destruído" : `🔧 ${Math.round(c.lataria)}%`)
            : c.tempo !== null ? `🏁 ${Math.floor(c.tempo / 60)}s` : `posto ${c.posto + 1}/${POSTOS}`,
        })),
      };
    },
    redimensionar,
    quadro() { return estado ? serializar({ ...estado, eventos: [] }) : null; },
    tirarEventos() { const l = pendentes.map(x => serializar(x)); pendentes = []; return l; },
    aplicar(s: unknown, eventos: unknown[]) {
      const e = desserializar(s) as EstadoCaos | null;
      if (!e || !Array.isArray(e.carros) || !Array.isArray(e.predios)) return;
      const novaCidade = !estado || estado.predios.length !== e.predios.length || e.passo < estado.passo;
      guardarAnteriores(estado && !novaCidade ? estado : e);
      estado = e;
      if (novaCidade) { montarCidade(e); outros.forEach(o => cena.remove(o.g)); outros.clear(); }
      e.eventos = eventos.map(x => desserializar(x)) as EventoCaos[];
      efeitosDoPasso(e);
    },
    destruir() {
      fumacas.forEach(f => (f.m.material as THREE.Material).dispose());
      descartaveis.forEach(d => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
