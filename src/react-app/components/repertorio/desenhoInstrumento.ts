/**
 * Desenho do instrumento no canvas, no estilo dos vídeos de piano: as notas descem e, quando chegam ao braço (ou ao
 * teclado), acendem no lugar onde se toca. O braço fica deitado, com a corda mais grave embaixo, como na tablatura.
 */
import { corDaNota, ehPreta, janelaDoMapa, type EventoQueda, type Instrumento } from "@/react-app/utils/musica/instrumentos";
import { nomeDaNota } from "@/react-app/utils/musica/teoria";

export interface Cena {
  instrumento: Instrumento;
  eventos: EventoQueda[];
  casas: number;
  acordeAtual: string | null;
  proximoAcorde: string | null;
  /** Segundos que cabem na área de queda. */
  janela: number;
  escuro: boolean;
  /** Escreve as notas com bemol (como a cifra no tom atual). */
  bemol: boolean;
  /** Mostra todas as notas do braço (ou do teclado) em cinza; a que toca acende na cor. */
  todasNotas: boolean;
}

/** Quanto antes de chegar a próxima nota já aparece marcada (vazada) no braço. */
const ANTECIPA = 0.8;

const CORES = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];

/** Primeiro evento com fim > t (busca binária pelo início, os eventos vêm em ordem). */
function primeiroVisivel(ev: EventoQueda[], t: number, folga: number) {
  let lo = 0, hi = ev.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (ev[m].inicio < t - folga) lo = m + 1; else hi = m; }
  return lo;
}

/** v14: a nota debaixo de um ponto do desenho (para tocar ao clicar). */
export interface NotaNoPonto { midi: number; corda?: number; casa?: number }
export type AcharNota = (x: number, y: number) => NotaNoPonto | null;

export function desenhar(ctx: CanvasRenderingContext2D, w: number, h: number, cena: Cena, t: number): AcharNota {
  const { instrumento: ins, eventos, janela, escuro } = cena;
  const fundo = escuro ? "#0f172a" : "#f8fafc", tinta = escuro ? "#e2e8f0" : "#334155", fraco = escuro ? "#334155" : "#cbd5e1";
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, w, h);
  const teclado = ins.id === "teclado";
  const altura = (e: EventoQueda) => (teclado ? e.midi ?? 0 : ins.cordas[e.corda ?? 0] + (e.casa ?? 0));
  const nome = (m: number) => nomeDaNota(m, cena.bemol);
  // em telas baixas o braço ganha mais espaço (6 cordas precisam caber com o nome de cada nota)
  const altBase = teclado ? Math.min(h * 0.32, 110) : Math.min(h * (h < 300 ? 0.58 : 0.42), 30 * ins.cordas.length + 26);
  const topoBase = h - altBase;

  // ---------- onde cada evento cai (x, largura) e a linha da corda ----------
  let xDe: (e: EventoQueda) => { x: number; l: number };
  let desenharBase: (ativos: EventoQueda[], proximos: EventoQueda[]) => void;
  let achar: AcharNota;
  if (teclado) {
    const [ini, fim] = ins.faixa;
    const brancas: number[] = [];
    for (let m = ini; m <= fim; m++) if (!ehPreta(m)) brancas.push(m);
    const lb = w / brancas.length;
    const xTecla = (m: number) => {
      if (!ehPreta(m)) return { x: brancas.indexOf(m) * lb, l: lb };
      return { x: (brancas.indexOf(m - 1) + 1) * lb - lb * 0.3, l: lb * 0.6 };
    };
    xDe = e => xTecla(e.midi ?? ini);
    achar = (x, y) => {
      if (y < topoBase || y > h || x < 0 || x > w) return null;
      // as pretas ficam por cima, na parte de cima das teclas
      if (y < topoBase + altBase * 0.62) {
        for (let m = ini; m <= fim; m++) if (ehPreta(m)) { const k = xTecla(m); if (x >= k.x && x < k.x + k.l) return { midi: m }; }
      }
      const m = brancas[Math.min(brancas.length - 1, Math.floor(x / lb))];
      return m === undefined ? null : { midi: m };
    };
    desenharBase = ativos => {
      const acesas = new Set(ativos.map(e => e.midi));
      const rotular = (m: number, x: number, l: number, alto: number) => {
        ctx.fillStyle = "#fff"; ctx.font = `bold ${Math.max(9, Math.min(13, l * 0.5))}px sans-serif`; ctx.textAlign = "center";
        ctx.fillText(nome(m), x + l / 2, topoBase + alto - 8);
      };
      for (const m of brancas) {
        const { x, l } = xTecla(m);
        ctx.fillStyle = acesas.has(m) ? "#3b82f6" : "#ffffff";
        ctx.fillRect(x + 0.5, topoBase, l - 1, altBase);
        ctx.strokeStyle = "#94a3b8"; ctx.strokeRect(x + 0.5, topoBase, l - 1, altBase);
        if (cena.todasNotas && !acesas.has(m)) { ctx.fillStyle = "#94a3b8"; ctx.font = `${Math.max(8, Math.min(12, l * 0.45))}px sans-serif`; ctx.textAlign = "center"; ctx.fillText(nome(m), x + l / 2, topoBase + altBase - 20); }
        if (m % 12 === 0) { ctx.fillStyle = acesas.has(m) ? "#fff" : "#64748b"; ctx.font = `${Math.max(9, lb * 0.4)}px sans-serif`; ctx.textAlign = "center"; ctx.fillText(`C${Math.floor(m / 12) - 1}`, x + l / 2, h - 6); }
      }
      for (let m = ini; m <= fim; m++) {
        if (!ehPreta(m)) continue;
        const { x, l } = xTecla(m);
        ctx.fillStyle = acesas.has(m) ? "#60a5fa" : "#1e293b";
        ctx.fillRect(x, topoBase, l, altBase * 0.62);
        if (cena.todasNotas && !acesas.has(m)) { ctx.fillStyle = "#94a3b8"; ctx.font = `${Math.max(7, Math.min(10, l * 0.55))}px sans-serif`; ctx.textAlign = "center"; ctx.fillText(nome(m), x + l / 2, topoBase + altBase * 0.62 - 6); }
        if (acesas.has(m)) rotular(m, x, l, altBase * 0.62);
      }
      for (const m of brancas) if (acesas.has(m)) { const { x, l } = xTecla(m); rotular(m, x, l, altBase - 14); }
    };
  } else {
    const n = ins.cordas.length;
    const margem = 30, x0 = margem + 16, larg = w - x0 - 10;
    const k = (f: number) => (1 - 2 ** (-f / 12)) / (1 - 2 ** (-cena.casas / 12));
    const xTraste = (f: number) => x0 + larg * k(f);
    const xCasa = (c: number) => (c === 0 ? x0 - 12 : (xTraste(c - 1) + xTraste(c)) / 2);
    const yCorda = (c: number) => topoBase + 12 + ((altBase - 30) * (n - 1 - c)) / Math.max(1, n - 1);
    achar = (x, y) => {
      if (y < topoBase || y > h) return null;
      let corda = 0, dist = Infinity;
      for (let c = 0; c < n; c++) { const d = Math.abs(yCorda(c) - y); if (d < dist) { dist = d; corda = c; } }
      let casa = 0;
      if (x >= x0) { casa = cena.casas; for (let f = 1; f <= cena.casas; f++) if (x < xTraste(f)) { casa = f; break; } }
      return { midi: ins.cordas[corda] + casa, corda, casa };
    };
    xDe = e => {
      const c = e.casa ?? 0;
      const l = c === 0 ? 20 : Math.max(10, (xTraste(c) - xTraste(c - 1)) * 0.8);
      return { x: xCasa(c) - l / 2, l };
    };
    desenharBase = (ativos, proximos) => {
      ctx.fillStyle = escuro ? "#3f2a1d" : "#7c4a2d";
      ctx.fillRect(x0, topoBase + 4, larg, altBase - 22);
      // marcações
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      for (const f of [3, 5, 7, 9, 12, 15, 17, 19]) {
        if (f > cena.casas) continue;
        const x = xCasa(f), yMeio = topoBase + 4 + (altBase - 22) / 2;
        if (f === 12) { ctx.beginPath(); ctx.arc(x, yMeio - 8, 3, 0, 7); ctx.arc(x, yMeio + 8, 3, 0, 7); ctx.fill(); }
        else { ctx.beginPath(); ctx.arc(x, yMeio, 3, 0, 7); ctx.fill(); }
      }
      // trastes
      for (let f = 0; f <= cena.casas; f++) {
        ctx.fillStyle = f === 0 ? "#f1f5f9" : "#cbd5e1";
        ctx.fillRect(xTraste(f) - (f === 0 ? 2 : 1), topoBase + 4, f === 0 ? 4 : 2, altBase - 22);
        if (f > 0 && (f <= 12 || f % 2 === 1)) { ctx.fillStyle = tinta; ctx.font = "10px sans-serif"; ctx.textAlign = "center"; ctx.fillText(String(f), xCasa(f), h - 5); }
      }
      // cordas
      for (let c = 0; c < n; c++) {
        const y = yCorda(c);
        ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1 + (n - c) * 0.35;
        ctx.beginPath(); ctx.moveTo(x0 - 4, y); ctx.lineTo(x0 + larg, y); ctx.stroke();
        ctx.fillStyle = CORES[c % CORES.length]; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(ins.nomesCordas[c], 10, y + 4);
      }
      const raio = Math.max(6, Math.min(12, ((altBase - 30) / Math.max(1, n - 1)) * 0.48));
      // todas as notas do braço em cinza (a que toca acende por cima, na cor da corda)
      if (cena.todasNotas) {
        for (let c = 0; c < n; c++) {
          for (let f = 0; f <= cena.casas; f++) {
            const largCasa = f === 0 ? 22 : xTraste(f) - xTraste(f - 1);
            const r = Math.min(raio * 0.9, largCasa * 0.42);
            if (r < 4) continue;
            const x = xCasa(f), y = yCorda(c);
            ctx.fillStyle = escuro ? "#475569" : "#cbd5e1";
            ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
            const txt = nome(ins.cordas[c] + f);
            ctx.fillStyle = escuro ? "#e2e8f0" : "#334155";
            ctx.font = `bold ${Math.max(6, Math.min(r * (txt.length > 1 ? 0.95 : 1.1), 11))}px sans-serif`; ctx.textAlign = "center";
            ctx.fillText(txt, x, y + r * 0.36);
          }
        }
      }
      // próximas notas: círculo vazado com o nome, onde o dedo vai
      for (const e of proximos) {
        const c = e.corda ?? 0, x = xCasa(e.casa ?? 0), y = yCorda(c);
        ctx.fillStyle = escuro ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.9)";
        ctx.strokeStyle = CORES[c % CORES.length]; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, raio, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = CORES[c % CORES.length]; ctx.font = `bold ${raio}px sans-serif`; ctx.textAlign = "center"; ctx.fillText(nome(altura(e)), x, y + raio * 0.36);
      }
      // notas tocando agora: círculo cheio com o nome
      for (const e of ativos) {
        const c = e.corda ?? 0, x = xCasa(e.casa ?? 0), y = yCorda(c);
        ctx.save();
        ctx.shadowColor = CORES[c % CORES.length]; ctx.shadowBlur = 14;
        ctx.fillStyle = CORES[c % CORES.length];
        ctx.beginPath(); ctx.arc(x, y, raio + 1, 0, 7); ctx.fill();
        ctx.restore();
        ctx.fillStyle = "#fff"; ctx.font = `bold ${raio}px sans-serif`; ctx.textAlign = "center"; ctx.fillText(nome(altura(e)), x, y + raio * 0.36);
      }
    };
  }

  // ---------- notas caindo ----------
  const ativos: EventoQueda[] = [], proximos: EventoQueda[] = [];
  const pxPorSeg = topoBase / janela;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, w, topoBase); ctx.clip();
  // linhas de tempo (a cada segundo) para dar noção de velocidade
  ctx.strokeStyle = fraco; ctx.lineWidth = 1; ctx.setLineDash([2, 6]);
  for (let s = Math.ceil(t); s < t + janela; s++) { const y = topoBase - (s - t) * pxPorSeg; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  ctx.setLineDash([]);
  for (let i = primeiroVisivel(eventos, t, 10); i < eventos.length; i++) {
    const e = eventos[i];
    if (e.inicio > t + janela) break;
    if (e.fim < t) continue;
    if (e.inicio <= t) ativos.push(e);
    else if (e.inicio - t <= ANTECIPA && !proximos.some(p => p.corda === e.corda && p.casa === e.casa)) proximos.push(e);
    const yBase = topoBase - (e.inicio - t) * pxPorSeg;
    const yTopo = topoBase - (e.fim - t) * pxPorSeg;
    const { x, l } = xDe(e);
    const cor = teclado ? (ehPreta(e.midi ?? 0) ? "#60a5fa" : "#3b82f6") : CORES[(e.corda ?? 0) % CORES.length];
    const alt = Math.max(16, yBase - yTopo);
    ctx.fillStyle = cor;
    ctx.globalAlpha = e.inicio <= t ? 1 : 0.88;
    arredondado(ctx, x, yBase - alt, l, alt, Math.min(6, l / 2));
    ctx.fill();
    ctx.globalAlpha = 1;
    // nome da nota (e, no braço, a casa) dentro do bloco
    const fonte = Math.max(8, Math.min(13, l * 0.55));
    ctx.fillStyle = "#fff"; ctx.textAlign = "center";
    ctx.font = `bold ${fonte}px sans-serif`;
    ctx.fillText(nome(altura(e)), x + l / 2, yBase - 4);
    if (!teclado && alt >= fonte * 2 + 10) {
      ctx.globalAlpha = 0.85; ctx.font = `${Math.max(8, fonte - 3)}px sans-serif`;
      ctx.fillText(e.casa ? `casa ${e.casa}` : "solta", x + l / 2, yBase - fonte - 7);
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
  // linha de chegada
  ctx.fillStyle = escuro ? "#38bdf8" : "#0ea5e9";
  ctx.fillRect(0, topoBase - 2, w, 2);
  desenharBase(ativos, proximos.filter(p => !ativos.some(a => a.corda === p.corda && a.casa === p.casa)));

  // acorde atual e o próximo
  if (cena.acordeAtual) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#f97316"; ctx.font = "bold 22px sans-serif"; ctx.fillText(cena.acordeAtual, 10, 28);
    const largura = ctx.measureText(cena.acordeAtual).width;
    if (cena.proximoAcorde) { ctx.fillStyle = tinta; ctx.globalAlpha = 0.6; ctx.font = "bold 13px sans-serif"; ctx.fillText(`→ ${cena.proximoAcorde}`, 18 + largura, 27); ctx.globalAlpha = 1; }
  }
  return achar;
}

function arredondado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------- v4: mapa do braço

/** Notas tocando agora e as que chegam em seguida (no máximo uma por corda/casa). */
function notasDoMomento(eventos: EventoQueda[], t: number) {
  const ativos: EventoQueda[] = [], proximos: EventoQueda[] = [];
  for (let i = primeiroVisivel(eventos, t, 10); i < eventos.length; i++) {
    const e = eventos[i];
    if (e.inicio > t + ANTECIPA) break;
    if (e.fim < t) continue;
    if (e.inicio <= t) ativos.push(e);
    else if (!proximos.some(p => p.corda === e.corda && p.casa === e.casa)) proximos.push(e);
  }
  return { ativos, proximos: proximos.filter(p => !ativos.some(a => a.corda === p.corda && a.casa === p.casa)) };
}

/**
 * Mapa do braço em pé, como os mapas de notas impressos: a pestana em cima com o nome das cordas (a mais grave à
 * esquerda), as casas descendo e, em cada uma, a nota numa bolinha com a cor da letra. Tocando, a nota da vez cresce e
 * ganha um anel branco; a próxima ganha um anel tracejado. Só para instrumentos de corda.
 */
export function desenharMapa(ctx: CanvasRenderingContext2D, w: number, h: number, cena: Cena, t: number): AcharNota {
  const { instrumento: ins, escuro } = cena;
  const fundo = escuro ? "#0f172a" : "#ffffff", tinta = escuro ? "#e2e8f0" : "#334155";
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, w, h);
  const n = ins.cordas.length;
  if (!n) return () => null;
  const nome = (m: number) => nomeDaNota(m, cena.bemol);
  const { ativos, proximos } = notasDoMomento(cena.eventos, t);

  // acorde da vez em cima
  const topoAcorde = 26;
  if (cena.acordeAtual) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#f97316"; ctx.font = "bold 18px sans-serif"; ctx.fillText(cena.acordeAtual, 8, 19);
    const lg = ctx.measureText(cena.acordeAtual).width;
    if (cena.proximoAcorde) { ctx.fillStyle = tinta; ctx.globalAlpha = 0.6; ctx.font = "bold 12px sans-serif"; ctx.fillText(`→ ${cena.proximoAcorde}`, 16 + lg, 18); ctx.globalAlpha = 1; }
  }

  // geometria: braço centralizado, colunas iguais por corda, a pestana e as casas
  const margemNumero = 22;
  const largBraco = Math.min(w - margemNumero * 2 - 8, n * 58);
  const x0 = (w - largBraco) / 2;
  const coluna = largBraco / n;
  const xCorda = (c: number) => x0 + coluna * (c + 0.5);
  const altPestana = 30;
  const yPestana = topoAcorde;
  const yCasas = yPestana + altPestana;
  const linhaMin = 24;
  const cabem = Math.max(1, Math.floor((h - yCasas - 4) / linhaMin));
  const emUso = [...ativos, ...proximos].map(e => e.casa ?? 0);
  const { inicio, n: mostradas } = janelaDoMapa(cena.casas, cabem, emUso);
  const linha = (h - yCasas - 4) / mostradas;
  const yCasa = (f: number) => yCasas + (f - inicio + 0.5) * linha;
  const raio = Math.max(7, Math.min(coluna * 0.36, linha * 0.42, 20));

  // madeira do braço e a pestana (ou a casa de cima, quando a janela desce)
  ctx.fillStyle = escuro ? "#1e293b" : "#f8fafc";
  ctx.fillRect(x0, yCasas, largBraco, linha * mostradas);
  ctx.fillStyle = escuro ? "#7c5a35" : "#e9c48f";
  ctx.fillRect(x0 - 6, yPestana, largBraco + 12, altPestana);
  ctx.fillStyle = escuro ? "#e2e8f0" : "#ffffff";
  ctx.fillRect(x0 - 6, yCasas - 3, largBraco + 12, inicio === 1 ? 4 : 1);

  // trastes e números das casas
  ctx.textAlign = "right";
  for (let k = 0; k <= mostradas; k++) {
    const y = yCasas + k * linha;
    ctx.fillStyle = escuro ? "#475569" : "#1f2937";
    ctx.fillRect(x0, y - 0.75, largBraco, 1.5);
    if (k < mostradas) { ctx.fillStyle = tinta; ctx.globalAlpha = 0.7; ctx.font = "10px sans-serif"; ctx.fillText(String(inicio + k), x0 - 8, y + linha / 2 + 3); ctx.globalAlpha = 1; }
  }
  // marcações (3, 5, 7, 9, 12…) entre as cordas do meio
  ctx.fillStyle = escuro ? "#64748b" : "#475569";
  for (let f = inicio; f < inicio + mostradas; f++) {
    if (![3, 5, 7, 9, 12, 15, 17, 19, 21].includes(f)) continue;
    const y = yCasa(f), meio = x0 + largBraco / 2;
    const r = Math.max(3, Math.min(6, linha * 0.14));
    if (f === 12) { ctx.beginPath(); ctx.arc(meio - coluna, y, r, 0, 7); ctx.arc(meio + coluna, y, r, 0, 7); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(meio + (n % 2 ? coluna / 2 : 0), y, r, 0, 7); ctx.fill(); }
  }
  // cordas (mais grossas no grave) e o nome de cada uma na pestana
  for (let c = 0; c < n; c++) {
    const x = xCorda(c);
    ctx.strokeStyle = escuro ? "#94a3b8" : "#6b7280"; ctx.lineWidth = 1 + (n - c) * 0.45;
    ctx.beginPath(); ctx.moveTo(x, yCasas - 2); ctx.lineTo(x, yCasas + linha * mostradas); ctx.stroke();
  }

  const ativo = (c: number, f: number) => ativos.some(e => (e.corda ?? 0) === c && (e.casa ?? 0) === f);
  const proximo = (c: number, f: number) => proximos.some(e => (e.corda ?? 0) === c && (e.casa ?? 0) === f);
  const bolinha = (x: number, y: number, r: number, txt: string, acesa: boolean, vem: boolean) => {
    const cor = corDaNota(txt);
    ctx.save();
    if (acesa) { ctx.shadowColor = cor.fundo; ctx.shadowBlur = 18; }
    ctx.globalAlpha = acesa || vem || !ativos.length ? 1 : 0.8;
    ctx.fillStyle = cor.fundo;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.restore();
    if (acesa) { ctx.strokeStyle = escuro ? "#f8fafc" : "#111827"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 2.5, 0, 7); ctx.stroke(); }
    else if (vem) { ctx.strokeStyle = cor.fundo; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(x, y, r + 4, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
    ctx.fillStyle = cor.texto;
    ctx.font = `bold ${Math.max(8, Math.min(r * (txt.length > 1 ? 0.85 : 1.05), 15))}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(txt, x, y + r * 0.34);
  };

  // pestana: as cordas soltas
  for (let c = 0; c < n; c++) {
    const txt = nome(ins.cordas[c]);
    const acesa = ativo(c, 0), vem = proximo(c, 0);
    if (acesa || vem) bolinha(xCorda(c), yPestana + altPestana / 2, Math.min(raio, altPestana * 0.42), txt, acesa, vem);
    else {
      ctx.fillStyle = escuro ? "#fde68a" : "#7c4a2d"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(txt, xCorda(c), yPestana + altPestana / 2 + 4.5);
    }
  }
  // todas as casas
  for (let f = inicio; f < inicio + mostradas; f++) {
    for (let c = 0; c < n; c++) {
      const acesa = ativo(c, f);
      bolinha(xCorda(c), yCasa(f), acesa ? raio * 1.15 : raio, nome(ins.cordas[c] + f), acesa, proximo(c, f));
    }
  }
  return (x, y) => {
    if (x < x0 - 6 || x > x0 + largBraco + 6 || y < yPestana || y > yCasas + linha * mostradas) return null;
    const corda = Math.max(0, Math.min(n - 1, Math.floor((x - x0) / coluna)));
    const casa = y < yCasas ? 0 : Math.min(inicio + mostradas - 1, inicio + Math.floor((y - yCasas) / linha));
    return { midi: ins.cordas[corda] + casa, corda, casa };
  };
}
