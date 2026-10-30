/**
 * Lê o pacote de projetos no navegador (o ZIP baixado do Construcode ou PDFs soltos): cada página vira desenho
 * vetorial (pdf.js) e passa pela análise pura de projetoVetorial. Também monta a Torre da Escadinha com o resultado.
 */
import { lerPdf } from "./pdfTermo";
import { lerPaginaVetorial } from "./projetoPdfVetor";
import { analisarPrancha, codigoDoArquivo, lerCarimbo, semRevisoesAntigas, montarTorreDoPacote, type PranchaLida, type TorreDoPacote } from "./projetoVetorial";
import { lerZipArquivo } from "./zip";
import { nucleo, type Torre } from "./escadinha";
import { apartamentosPadrao, atribuirLados, definirLados } from "./escadinhaApto";

export interface PacoteLido {
  nome: string;
  pranchas: PranchaLida[];
  /** Arquivos que não deu para ler (com o motivo). */
  falhas: { arquivo: string; motivo: string }[];
}

const MAX_PAGINAS = 6;
const respirar = () => new Promise(r => setTimeout(r, 0));

/**
 * Pranchas que montam o modelo (estrutura: 1ª fiada, fôrma, elevação, graute) ou fora do padrão de nome da Cury são
 * lidas por inteiro; as outras (armação, detalhes, instalações…) entram só pelo nome, para a lista do que veio.
 */
export function precisaAnalisar(nome: string): boolean {
  const c = codigoDoArquivo(nome);
  if (!c.disciplina) return true;
  return c.disciplina === "EST" && (c.tipo === "modulacao" || c.tipo === "forma" || c.tipo === "elevacao" || c.tipo === "graute");
}

/** Prancha conhecida só pelo nome do arquivo (não precisou abrir). */
function soPeloNome(nome: string): PranchaLida {
  return { carimbo: lerCarimbo(nome, []), escala: null, niveis: [], paredes: [], quantitativo: [], totalBlocos: 0, contorno: null, junta: null };
}

/** Lê os arquivos escolhidos (ZIPs e PDFs), avisando o andamento a cada prancha. */
export async function lerPacote(arquivos: File[], aoProgredir: (feitos: number, total: number, atual: string) => void): Promise<PacoteLido> {
  const pdfs: { nome: string; bytes: Uint8Array }[] = [];
  const falhas: PacoteLido["falhas"] = [];
  const pranchas: PranchaLida[] = [];
  const pdf = (n: string) => /\.pdf$/i.test(n);
  for (const f of arquivos) {
    if (/\.zip$/i.test(f.name)) {
      try {
        aoProgredir(0, 1, `Abrindo ${f.name}…`);
        // Lê o ZIP aos pedaços (o pacote da obra passa de 600 MB) e só descompacta o que vai ser analisado.
        pdfs.push(...await lerZipArquivo(f, n => pdf(n) && precisaAnalisar(n), n => { if (pdf(n) && !precisaAnalisar(n)) pranchas.push(soPeloNome(n)); }));
      } catch (e) {
        falhas.push({ arquivo: f.name, motivo: e instanceof Error ? e.message : "ZIP ilegível" });
      }
    } else if (pdf(f.name)) {
      if (precisaAnalisar(f.name)) pdfs.push({ nome: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
      else pranchas.push(soPeloNome(f.name));
    } else falhas.push({ arquivo: f.name, motivo: "Formato não suportado (envie PDF ou ZIP). DWG: exporte em PDF no Construcode." });
  }
  const pdfjs = await import("pdfjs-dist");
  for (let i = 0; i < pdfs.length; i++) {
    const { nome, bytes } = pdfs[i];
    aoProgredir(i, pdfs.length, nome);
    await respirar();
    try {
      const { documento, nrPaginas } = await lerPdf(bytes);
      try {
        for (let p = 1; p <= Math.min(nrPaginas, MAX_PAGINAS); p++) {
          const pagina = await documento.getPage(p);
          const vetor = await lerPaginaVetorial(pagina, pdfjs.OPS as unknown as Record<string, number>);
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
  aoProgredir(pdfs.length, pdfs.length, "");
  return { nome: arquivos.length === 1 ? arquivos[0].name : `${arquivos.length} arquivos`, pranchas: semRevisoesAntigas(pranchas), falhas };
}

/**
 * Torre da Escadinha a partir do que veio do pacote. Mantém da torre atual o que não vem do projeto (início da obra,
 * espessura de laje, tipologias dos apartamentos quando o contorno não mudou de tamanho).
 */
export function torreDoPacote(dados: TorreDoPacote, nome: string, arquivo: string, atual?: Torre): Torre {
  const { contorno } = dados;
  const pavimentos = dados.pavimentos.map(p => (p.tipo === "barrilete" ? { ...p, contorno: nucleo(contorno) } : p));
  const lados = dados.junta ? { ...definirLados(contorno, null, dados.junta), fonte: "junta" as const } : definirLados(contorno, null);
  return {
    nome,
    contorno,
    pavimentos,
    origem: "projeto",
    arquivo,
    lados,
    // Apartamentos pelas paredes (cômodos ligados por porta, sem o hall); sem paredes que fechem, a malha de exemplo.
    apartamentos: atribuirLados(
      dados.apartamentos.length >= 2 ? dados.apartamentos.map(a => ({ id: a.id, nome: a.nome, contorno: a.contorno, lado: "A" as const })) : apartamentosPadrao(contorno),
      lados,
    ),
    comodos: dados.comodos,
    paredes: dados.paredes,
    projeto: dados.projeto,
    inicioObra: atual?.inicioObra ?? null,
    espessuraLaje: atual?.espessuraLaje,
  };
}

export { montarTorreDoPacote };
