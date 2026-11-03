/**
 * Lê o pacote de projetos no navegador (o ZIP baixado do Construcode ou PDFs soltos). Do ZIP só sai o índice e as
 * pranchas que importam: revisões antigas ficam de fora, só fôrma/1ª fiada/graute da estrutura são desenhadas (pdf.js
 * + análise pura de projetoVetorial) e o resto entra pelo nome, para o "o que tem e o que falta". Também monta a Torre
 * da Escadinha com o resultado, já com cômodos e apartamentos lidos das paredes.
 */
import { lerPdf } from "./pdfTermo";
import { lerPaginaVetorial } from "./projetoPdfVetor";
import {
  analisarPrancha, lerCarimbo, montarTorreDoPacote, precisaDesenho, revisoesVigentes, type PranchaLida, type TorreDoPacote,
} from "./projetoVetorial";
import { extrairDoZip, indiceZip } from "./zip";
import { nucleo, type Torre } from "./escadinha";
import { apartamentosPadrao, atribuirLados, definirLados } from "./escadinhaApto";
import { VERSAO_LEITURA, lerComodos } from "./escadinhaComodos";

export interface PacoteLido {
  nome: string;
  pranchas: PranchaLida[];
  /** Arquivos que não deu para ler (com o motivo). */
  falhas: { arquivo: string; motivo: string }[];
  /** Revisões antigas deixadas de fora (a mais nova de cada prancha é a que vale). */
  antigas: string[];
  /** Pranchas reconhecidas só pelo nome (não precisam de desenho). */
  soPeloNome: number;
}

const MAX_PAGINAS = 6;
const respirar = () => new Promise(r => setTimeout(r, 0));

interface Candidato { nome: string; obter: () => Promise<Uint8Array> }

/** Lê os arquivos escolhidos (ZIPs e PDFs), avisando o andamento a cada prancha. */
export async function lerPacote(arquivos: File[], aoProgredir: (feitos: number, total: number, atual: string) => void): Promise<PacoteLido> {
  const candidatos: Candidato[] = [];
  const falhas: PacoteLido["falhas"] = [];
  const dwgs: string[] = [];
  for (const f of arquivos) {
    if (/\.zip$/i.test(f.name)) {
      try {
        for (const e of await indiceZip(f)) {
          if (/\.pdf$/i.test(e.nome)) candidatos.push({ nome: e.nome, obter: () => extrairDoZip(f, e) });
          else if (/\.dwg$/i.test(e.nome)) dwgs.push(e.nome);
        }
      } catch (e) {
        falhas.push({ arquivo: f.name, motivo: e instanceof Error ? e.message : "ZIP ilegível" });
      }
    } else if (/\.pdf$/i.test(f.name)) candidatos.push({ nome: f.name, obter: async () => new Uint8Array(await f.arrayBuffer()) });
    else if (/\.dwg$/i.test(f.name)) dwgs.push(f.name);
    else falhas.push({ arquivo: f.name, motivo: "Formato não suportado (envie PDF ou ZIP)." });
  }
  // DWG sem o PDF da mesma prancha: avisa (o PDF vetorial do Construcode tem o mesmo desenho).
  const basePdf = new Set(candidatos.map(c => c.nome.replace(/\.[^.]+$/, "").toUpperCase()));
  for (const d of dwgs) if (!basePdf.has(d.replace(/\.[^.]+$/, "").toUpperCase())) falhas.push({ arquivo: d, motivo: "DWG sem o PDF da prancha: baixe também o PDF no Construcode." });

  const { vigentes, antigas } = revisoesVigentes(candidatos, c => c.nome);
  const desenhar = vigentes.filter(c => precisaDesenho(c.nome));
  const pranchas: PranchaLida[] = vigentes.filter(c => !precisaDesenho(c.nome)).map(c => ({
    carimbo: lerCarimbo(c.nome, []), escala: null, niveis: [], paredes: [], quantitativo: [], totalBlocos: 0, contorno: null, junta: null,
  }));
  const pdfjs = desenhar.length ? await import("pdfjs-dist") : null;
  for (let i = 0; i < desenhar.length; i++) {
    const { nome, obter } = desenhar[i];
    aoProgredir(i, desenhar.length, nome);
    await respirar();
    try {
      const { documento, nrPaginas } = await lerPdf(await obter());
      try {
        for (let p = 1; p <= Math.min(nrPaginas, MAX_PAGINAS); p++) {
          const pagina = await documento.getPage(p);
          const vetor = await lerPaginaVetorial(pagina, pdfjs!.OPS as unknown as Record<string, number>);
          pranchas.push(analisarPrancha(nrPaginas > 1 ? `${nome} (pág. ${p})` : nome, vetor));
          pagina.cleanup();
        }
      } finally {
        await documento.destroy();
      }
    } catch (e) {
      falhas.push({ arquivo: nome, motivo: e instanceof Error ? e.message : "PDF ilegível" });
    }
  }
  aoProgredir(desenhar.length, desenhar.length, "");
  return {
    nome: arquivos.length === 1 ? arquivos[0].name : `${arquivos.length} arquivos`,
    pranchas,
    falhas,
    antigas: antigas.map(c => c.nome),
    soPeloNome: vigentes.length - desenhar.length,
  };
}

/**
 * Torre da Escadinha a partir do que veio do pacote. Mantém da torre atual o que não vem do projeto (início da obra,
 * espessura de laje). Apartamentos e cômodos saem das paredes reais; sem paredes suficientes, a malha de exemplo.
 */
export function torreDoPacote(dados: TorreDoPacote, nome: string, arquivo: string, atual?: Torre): Torre {
  const { contorno } = dados;
  const pavimentos = dados.pavimentos.map(p => (p.tipo === "barrilete" ? { ...p, contorno: nucleo(contorno) } : p));
  const lados = dados.junta ? { ...definirLados(contorno, null, dados.junta), fonte: "junta" as const } : definirLados(contorno, null);
  const lidos = lerComodos(dados.paredes, contorno, dados.rotulos, dados.notasElevador);
  const apartamentos = lidos.apartamentos.length >= 2 ? lidos.apartamentos : apartamentosPadrao(contorno);
  return {
    nome,
    contorno,
    pavimentos,
    origem: "projeto",
    arquivo,
    lados,
    apartamentos: atribuirLados(apartamentos, lados),
    paredes: lidos.paredes,
    comodos: lidos.comodos,
    aberturas: lidos.aberturas,
    rotulos: dados.rotulos,
    notasElevador: dados.notasElevador,
    vaos: lidos.vaos,
    sacadas: lidos.sacadas,
    leitura: VERSAO_LEITURA,
    projeto: dados.projeto,
    inicioObra: atual?.inicioObra ?? null,
    espessuraLaje: atual?.espessuraLaje,
  };
}

export { montarTorreDoPacote };
