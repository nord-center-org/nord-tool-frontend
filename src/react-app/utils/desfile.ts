/**
 * Desfile da cena da obra (login e início): cenas curtas sorteadas, com máquinas e equipes atravessando o canteiro
 * e se encontrando no caminho. Regras puras: o catálogo de cenas e onde cada ator está em cada instante.
 */

export type TipoAtor =
  | "betoneira" | "retro" | "bobcat" | "empilhadeira"
  | "engenharia" | "mestre" | "engenheiro" | "pedreiroCarrinho" | "servente" | "serventeSemCapacete" | "eletricistas" | "eletricista"
  | "encanadores" | "carpinteiro" | "pintor" | "topografo" | "seguranca" | "cachorro" | "monte";

export type Acao =
  | "cavar" | "despejar" | "apontar" | "planta" | "medir" | "acenar" | "aperto" | "apitar" | "varrer" | "abaixar" | "farejar";

export type Passo =
  | { ate: number }
  | { parar: number; acao?: Acao; fala?: string; marca?: string };

export interface Ator {
  tipo: TipoAtor;
  /** Posição inicial (x da cena). */
  x: number;
  /** 1 anda para a direita; -1 para a esquerda (o desenho vira). */
  dir: 1 | -1;
  /** Unidades da cena por segundo. */
  velocidade: number;
  /** Segundos antes de começar. */
  atraso?: number;
  /** 0 = faixa de trás; 1 = faixa da frente (um pouco mais baixa, passa na frente). */
  faixa?: 0 | 1;
  /** Marca inicial (estado do desenho, ex.: monte "oculto"). */
  marca?: string;
  passos: Passo[];
}

export interface Cena {
  id: string;
  atores: Ator[];
}

export interface EstadoAtor {
  x: number;
  andando: boolean;
  acao: Acao | null;
  fala: string | null;
  marca: string | null;
}

/** Altura de cada ator (para o balão de fala). */
export const ALTURA: Record<TipoAtor, number> = {
  betoneira: 30, retro: 42, bobcat: 40, empilhadeira: 42, engenharia: 27, mestre: 27, engenheiro: 27, pedreiroCarrinho: 27,
  servente: 27, serventeSemCapacete: 27, eletricistas: 27, eletricista: 27, encanadores: 28, carpinteiro: 28, pintor: 28,
  topografo: 28, seguranca: 27, cachorro: 13, monte: 8,
};

/** Fora da tela pela esquerda e pela direita (o SVG mostra de -40 a 360 e corta as laterais em telas largas). */
export const ESQ = -110;
export const DIR = 450;

const MAQUINA = 34;
const PESSOA = 21;
const CARGA = 17;

const atravessa = (dir: 1 | -1): Passo => ({ ate: dir === 1 ? DIR : ESQ });

/**
 * Catálogo de cenas: sozinhos atravessando e encontros com fala.
 * As paradas ficam nas laterais (x < 100 ou > 250): no login, o cartão cobre o meio da cena.
 */
export const CENAS: Cena[] = [
  {
    id: "betoneira",
    atores: [{ tipo: "betoneira", x: ESQ, dir: 1, velocidade: MAQUINA, passos: [{ ate: 280 }, { parar: 2.6, fala: "Concreto chegando!" }, atravessa(1)] }],
  },
  {
    id: "retro",
    atores: [{ tipo: "retro", x: ESQ, dir: 1, velocidade: MAQUINA * 0.8, passos: [{ ate: 60 }, { parar: 3.4, acao: "cavar" }, atravessa(1)] }],
  },
  {
    id: "bobcat-cachorro",
    atores: [
      { tipo: "bobcat", x: ESQ, dir: 1, velocidade: MAQUINA, passos: [atravessa(1)] },
      { tipo: "cachorro", x: ESQ - 40, dir: 1, velocidade: MAQUINA, faixa: 1, passos: [{ ate: 300 }, { parar: 1.4, fala: "Au! Au!" }, atravessa(1)] },
    ],
  },
  {
    id: "engenharia",
    atores: [{ tipo: "engenharia", x: ESQ, dir: 1, velocidade: PESSOA, passos: [{ ate: 50 }, { parar: 3.6, acao: "planta", fala: "Essa laje sai sexta!" }, atravessa(1)] }],
  },
  {
    id: "carrinho",
    atores: [{ tipo: "pedreiroCarrinho", x: DIR, dir: -1, velocidade: PESSOA, passos: [atravessa(-1)] }],
  },
  {
    id: "eletricistas",
    atores: [{ tipo: "eletricistas", x: ESQ, dir: 1, velocidade: CARGA, passos: [{ ate: 290 }, { parar: 2, fala: "Puxa o cabo!" }, atravessa(1)] }],
  },
  {
    id: "encanadores",
    atores: [{ tipo: "encanadores", x: DIR, dir: -1, velocidade: CARGA, passos: [atravessa(-1)] }],
  },
  {
    id: "carpinteiro",
    atores: [{ tipo: "carpinteiro", x: ESQ, dir: 1, velocidade: PESSOA, passos: [atravessa(1)] }],
  },
  {
    id: "pintor",
    atores: [{ tipo: "pintor", x: DIR, dir: -1, velocidade: PESSOA, passos: [{ ate: 60 }, { parar: 1.8, fala: "Tinta fresca!" }, atravessa(-1)] }],
  },
  {
    id: "topografo",
    atores: [{ tipo: "topografo", x: ESQ, dir: 1, velocidade: PESSOA, passos: [{ ate: 280 }, { parar: 3.6, acao: "medir", fala: "Nível ok!" }, atravessa(1)] }],
  },
  {
    id: "empilhadeira",
    atores: [{ tipo: "empilhadeira", x: DIR, dir: -1, velocidade: MAQUINA * 0.8, passos: [atravessa(-1)] }],
  },
  {
    // Encontro: a betoneira vem de um lado, o pedreiro com o carrinho do outro e dá passagem.
    id: "bt-da-passagem",
    atores: [
      { tipo: "betoneira", x: DIR, dir: -1, velocidade: MAQUINA, faixa: 0, passos: [{ ate: 330 }, { parar: 1.6, fala: "Bi-bi!" }, atravessa(-1)] },
      { tipo: "pedreiroCarrinho", x: ESQ, dir: 1, velocidade: PESSOA, faixa: 1, passos: [{ ate: 40 }, { parar: 7.5, fala: "Passa, parceiro!" }, atravessa(1)] },
    ],
  },
  {
    // Encontro: mestre e engenheiro se cumprimentam no meio do canteiro.
    id: "bom-dia",
    atores: [
      { tipo: "engenheiro", x: ESQ, dir: 1, velocidade: PESSOA, faixa: 0, passos: [{ ate: 268 }, { parar: 3.6, acao: "aperto", fala: "Bom dia, mestre!" }, atravessa(1)] },
      { tipo: "mestre", x: DIR, dir: -1, velocidade: PESSOA, faixa: 1, atraso: 10, passos: [{ ate: 292 }, { parar: 3.6, acao: "aperto", fala: "Bom dia! Tudo certo." }, atravessa(-1)] },
    ],
  },
  {
    // Encontro: o tubo comprido passa e o eletricista abaixa.
    id: "cuidado-tubo",
    atores: [
      { tipo: "encanadores", x: ESQ, dir: 1, velocidade: CARGA, faixa: 1, passos: [atravessa(1)] },
      { tipo: "eletricista", x: DIR, dir: -1, velocidade: PESSOA, faixa: 0, atraso: 14.4, passos: [{ ate: 300 }, { parar: 5, acao: "abaixar", fala: "Opa! Olha o tubo!" }, atravessa(-1)] },
    ],
  },
  {
    // Encontro: a segurança do trabalho apita e o servente põe o capacete.
    id: "cade-o-capacete",
    atores: [
      { tipo: "seguranca", x: ESQ, dir: 1, velocidade: PESSOA, faixa: 0, passos: [{ ate: 270 }, { parar: 5, acao: "apitar", fala: "Cadê o capacete?!" }, atravessa(1)] },
      { tipo: "serventeSemCapacete", x: DIR, dir: -1, velocidade: PESSOA, faixa: 1, atraso: 11.5, passos: [{ ate: 300 }, { parar: 1.4 }, { parar: 2.8, fala: "Foi mal, já tô pondo!", marca: "capacete" }, atravessa(-1)] },
    ],
  },
  {
    // Encontro: a Bobcat despeja terra e o servente vem atrás com a pá.
    id: "terra-e-pa",
    atores: [
      { tipo: "bobcat", x: ESQ, dir: 1, velocidade: MAQUINA, faixa: 0, passos: [{ ate: 280 }, { parar: 2.4, acao: "despejar", fala: "Descarregando!" }, atravessa(1)] },
      { tipo: "monte", x: 310, dir: 1, velocidade: 0, faixa: 0, marca: "oculto", passos: [{ parar: 12.5 }, { parar: 10.8, marca: "cheio" }, { parar: 1.5, marca: "vazio" }] },
      { tipo: "servente", x: ESQ, dir: 1, velocidade: PESSOA, faixa: 1, passos: [{ ate: 295 }, { parar: 3.6, acao: "varrer" }, atravessa(1)] },
    ],
  },
  {
    // Encontro: o cachorro da obra cheira o tripé do topógrafo.
    id: "cachorro-curioso",
    atores: [
      { tipo: "topografo", x: ESQ, dir: 1, velocidade: PESSOA, faixa: 0, passos: [{ ate: 270 }, { parar: 4.6, acao: "medir", fala: "Sai daí, Caramelo!" }, atravessa(1)] },
      { tipo: "cachorro", x: DIR, dir: -1, velocidade: MAQUINA * 0.9, faixa: 1, atraso: 13.8, passos: [{ ate: 300 }, { parar: 2.4, acao: "farejar" }, atravessa(-1)] },
    ],
  },
];

/** Duração (s) dos passos de um ator a partir do x inicial. */
export function duracaoAtor(a: Ator): number {
  let x = a.x;
  let t = a.atraso ?? 0;
  for (const p of a.passos) {
    if ("ate" in p) { t += a.velocidade ? Math.abs(p.ate - x) / a.velocidade : 0; x = p.ate; }
    else t += p.parar;
  }
  return t;
}

export const duracaoCena = (c: Cena) => Math.max(...c.atores.map(duracaoAtor));

/** Onde o ator está no instante t (s desde o começo da cena). */
export function estadoNoTempo(a: Ator, t: number): EstadoAtor {
  let x = a.x;
  let resto = t - (a.atraso ?? 0);
  let marca = a.marca ?? null;
  if (resto < 0) return { x, andando: false, acao: null, fala: null, marca };
  for (const p of a.passos) {
    if ("ate" in p) {
      const dur = a.velocidade ? Math.abs(p.ate - x) / a.velocidade : 0;
      if (resto < dur) return { x: x + (p.ate - x) * (resto / dur), andando: true, acao: null, fala: null, marca };
      resto -= dur;
      x = p.ate;
    } else {
      if (p.marca) marca = p.marca;
      if (resto < p.parar) return { x, andando: false, acao: p.acao ?? null, fala: p.fala ?? null, marca };
      resto -= p.parar;
    }
  }
  return { x, andando: false, acao: null, fala: null, marca };
}

/** Sorteia a próxima cena sem repetir as últimas (as recentes ficam de fora enquanto houver opção). */
export function sortearCena(recentes: string[], sorteio: () => number = Math.random, cenas: Cena[] = CENAS): Cena {
  const livres = cenas.filter(c => !recentes.includes(c.id));
  const lista = livres.length ? livres : cenas;
  return lista[Math.floor(sorteio() * lista.length) % lista.length];
}

/** Quantas cenas recentes guardar para não repetir. */
export const MEMORIA_CENAS = 5;
