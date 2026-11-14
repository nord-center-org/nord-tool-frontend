/**
 * Repertório v11 — o instrumento segue a cifra: os acordes escritos (com o tempo de cada linha) viram os acordes e a
 * linha do baixo que o braço, o teclado e o sintetizador mostram, no lugar do que foi reconhecido no áudio.
 * Puro, testável em node.
 */
import type { Nota, SegmentoAcorde } from "./analise.ts";
import type { Cifra } from "./cifra.ts";
import { lerAcorde, transporAcorde } from "./teoria.ts";
import { acordesEmOrdem, arrumar, temposValidos } from "./linhaDoTempo.ts";

/**
 * Os acordes da cifra no tempo: cada linha com tempo distribui os seus acordes entre o começo dela e o da próxima
 * linha com tempo, pela coluna (como foram escritos em cima da letra). `semitons` leva a cifra para o tom do áudio
 * (a transposição da cifra no player). Linhas sem tempo ficam de fora; texto que não é acorde também.
 */
export function segmentosDaCifra(cifra: Cifra, tempos: (number | null)[], duracao: number, semitons = 0, temposAcordes?: number[] | null): SegmentoAcorde[] {
  // v17: com as horas da linha do tempo, cada acorde entra na hora dele
  const ordem = acordesEmOrdem(cifra);
  if (temposValidos(temposAcordes, ordem.length)) {
    const ts = arrumar(temposAcordes, duracao);
    return ordem.flatMap((a, k) => {
      const fim = k + 1 < ts.length ? ts[k + 1] : duracao;
      return fim > ts[k] ? [{ inicio: ts[k], fim, acorde: semitons ? transporAcorde(a.nome, semitons) : a.nome }] : [];
    });
  }
  const comTempo = cifra.blocos.flatMap((b, i) => {
    const t = tempos[i];
    return t !== null && t !== undefined && Number.isFinite(t) && b.acordes.length ? [{ b, t }] : [];
  }).sort((a, b) => a.t - b.t);
  // o fim de cada linha é o começo da próxima linha com tempo (com ou sem acorde)
  const inicios = tempos.filter((t): t is number => t !== null && t !== undefined && Number.isFinite(t)).sort((a, b) => a - b);
  const marcas: { inicio: number; acorde: string }[] = [];
  for (const { b, t } of comTempo) {
    const fim = Math.min(duracao, inicios.find(x => x > t) ?? duracao);
    const ultimo = b.acordes[b.acordes.length - 1];
    const largura = Math.max(b.texto.length, ultimo.col + ultimo.nome.length, 8);
    for (const a of b.acordes) {
      if (!lerAcorde(a.nome)) continue;
      const inicio = t + (a.col / largura) * Math.max(0, fim - t);
      marcas.push({ inicio: Math.round(inicio * 1000) / 1000, acorde: semitons ? transporAcorde(a.nome, semitons) : a.nome });
    }
  }
  marcas.sort((a, b) => a.inicio - b.inicio);
  const seg: SegmentoAcorde[] = [];
  marcas.forEach((m, i) => {
    const fim = i + 1 < marcas.length ? marcas[i + 1].inicio : duracao;
    if (fim > m.inicio) seg.push({ inicio: m.inicio, fim, acorde: m.acorde });
  });
  return seg;
}

/** A linha do baixo dos acordes: a fundamental (ou o baixo invertido, em "C/E") de cada um, de E1 a D#2. */
export function baixoDosAcordes(segmentos: SegmentoAcorde[]): Nota[] {
  return segmentos.flatMap(s => {
    const a = lerAcorde(s.acorde);
    if (!a) return [];
    const pc = a.baixo ?? a.raiz;
    return [{ inicio: s.inicio, fim: s.fim, midi: 28 + ((pc - 4 + 12) % 12), forca: 1 }];
  });
}
