/**
 * O Fortune-sheet não tem português: os textos da barra, do menu do botão direito, das abas e das janelas são trocados
 * no objeto de idioma inglês (o mesmo que o editor lê), uma vez só. v5: as funções também ficam em português (lista,
 * ajuda e célula); o motor recebe a fórmula traduzida na hora do cálculo e ganha as funções que não tinha.
 */
import { FormulaCache, locale } from "@fortune-sheet/core";
import { Parser } from "@fortune-sheet/formula-parser";

import { EXTRAS } from "@/react-app/utils/funcoesExtras";
import { listaEmPortugues, type ItemLista } from "@/react-app/utils/funcoesPlanilha";
import { formulaParaMotor } from "@/react-app/utils/planilha";

import SECOES, { DATAS_PT, LINKS_PT } from "./idiomaPlanilhaMais";

type Textos = Record<string, unknown>;

const PT: Record<string, Textos> = {
  generalDialog: {
    partiallyError: "Não dá para fazer isso em células mescladas só em parte", readOnlyError: "Não dá para fazer isso no modo só leitura",
    dataNullError: "Não dá para fazer isso em dados que não existem", noSeletionError: "Selecione as células antes", cannotSelectMultiple: "Não dá para usar várias seleções",
  },
  toolbar: {
    toolbar: "Barra de ferramentas", undo: "Desfazer (Ctrl+Z)", redo: "Refazer (Ctrl+Y)", "clear-format": "Limpar formatação", "format-painter": "Pincel de formatação",
    paintFormat: "Pincel de formatação", "currency-format": "Formatar como moeda", "percentage-format": "Formatar como porcentagem",
    "number-decrease": "Diminuir casas decimais", "number-increase": "Aumentar casas decimais", moreFormats: "Mais formatos", "border-all": "Todas as bordas",
    "merge-all": "Mesclar células", format: "Formato", font: "Fonte", "font-size": "Tamanho da fonte", bold: "Negrito (Ctrl+B)", italic: "Itálico (Ctrl+I)",
    "strike-through": "Tachado (Alt+Shift+5)", underline: "Sublinhado (Ctrl+U)", "font-color": "Cor do texto", "align-left": "Alinhar à esquerda",
    "align-center": "Centralizar", "align-right": "Alinhar à direita", "align-top": "Alinhar em cima", "align-mid": "Centralizar na vertical",
    "align-bottom": "Alinhar embaixo", chooseColor: "escolher cor", resetColor: "Redefinir", customColor: "PERSONALIZADA", alternatingColors: "Cores alternadas",
    confirmColor: "OK", cancelColor: "Cancelar", collapse: "Recolher", background: "Cor de preenchimento", border: "Bordas", borderStyle: "Estilo da borda",
    "merge-cell": "Mesclar células", chooseMergeType: "Tipo de mesclagem", horizontalAlign: "Alinhamento horizontal", verticalAlign: "Alinhamento vertical",
    alignment: "Alinhamento", textWrap: "Quebra de texto", textWrapMode: "Modo de quebra de texto", textRotate: "Rotação do texto", textRotateMode: "Modo de rotação",
    freeze: "Congelar", sort: "Classificar", filter: "Filtro", sortAndFilter: "Classificar e filtrar", findAndReplace: "Localizar e substituir",
    "formula-sum": "SOMA", autoSum: "Soma automática", moreFunction: "Mais funções", conditionalFormat: "Formatação condicional", comment: "Comentário",
    pivotTable: "Tabela dinâmica", chart: "Gráfico", screenshot: "Captura", splitColumn: "Dividir texto em colunas", insertImage: "Inserir imagem",
    insertLink: "Inserir link", dataVerification: "Validação de dados", protection: "Proteger a página", clearText: "Limpar cor",
    noColorSelectedText: "Nenhuma cor escolhida", toolMore: "Mais", toolLess: "Menos", toolClose: "Fechar", toolMoreTip: "Mais recursos",
    moreOptions: "Mais opções", cellFormat: "Formatar células", print: "Imprimir",
  },
  button: { confirm: "OK", cancel: "Cancelar", close: "Fechar", update: "Atualizar", delete: "Excluir", insert: "Inserir", prevPage: "Anterior", nextPage: "Próxima", total: "total:" },
  format: {
    moreCurrency: "Mais formatos de moeda", moreDateTime: "Mais formatos de data e hora", moreNumber: "Mais formatos de número", titleCurrency: "Formatos de moeda",
    decimalPlaces: "Casas decimais", titleDateTime: "Formatos de data e hora", titleNumber: "Formatos de número", tipDecimalPlaces: "As casas decimais vão de 0 a 9!",
    select: "Escolher", format: "formato", currency: "moeda",
  },
  border: {
    borderTop: "Borda de cima", borderBottom: "Borda de baixo", borderLeft: "Borda esquerda", borderRight: "Borda direita", borderNone: "Sem borda",
    borderAll: "Todas as bordas", borderOutside: "Bordas externas", borderInside: "Bordas internas", borderHorizontal: "Bordas horizontais",
    borderVertical: "Bordas verticais", borderColor: "cor da borda", borderSize: "espessura da borda", borderSlash: "Borda diagonal", borderDefault: "padrão", borderStyle: "estilo da borda",
  },
  merge: { mergeAll: "Mesclar tudo", mergeV: "Mesclar na vertical", mergeH: "Mesclar na horizontal", mergeCancel: "Desfazer mesclagem", overlappingError: "Não dá para mesclar áreas sobrepostas", partiallyError: "Não dá para fazer isso em células mescladas só em parte" },
  align: { left: "esquerda", center: "centro", right: "direita", top: "Em cima", middle: "No meio", bottom: "Embaixo" },
  textWrap: { overflow: "Transbordar", wrap: "Quebrar texto", clip: "Cortar" },
  rotation: { none: "Nenhuma", angleup: "Inclinar para cima", angledown: "Inclinar para baixo", vertical: "Empilhar na vertical", rotationUp: "Girar para cima", rotationDown: "Girar para baixo" },
  freezen: {
    default: "Congelar", freezenRow: "Primeira linha", freezenColumn: "Primeira coluna", freezenRC: "Linha e coluna", freezenRowRange: "Até a linha atual",
    freezenColumnRange: "Até a coluna atual", freezenRCRange: "Até a célula atual", freezenCancel: "Descongelar", noSeletionError: "Nenhuma área selecionada",
    rangeRCOverErrorTitle: "Aviso de congelamento", rangeRCOverError: "A área congelada passa da parte visível. Congele de novo uma área menor.",
  },
  sort: {
    asc: "Crescente ", desc: "Decrescente ", custom: "Classificação personalizada", hasTitle: "Os dados têm linha de cabeçalho", sortBy: "Classificar por",
    addOthers: "Adicionar outra coluna", close: "fechar", confirm: "classificar", columnOperation: "Coluna", secondaryTitle: "depois por",
    sortTitle: "Classificar intervalo", sortRangeTitle: "Classificar de", sortRangeTitleTo: "até",
    noRangeError: "Não dá para fazer isso com várias áreas selecionadas; selecione uma só", mergeError: "A seleção tem células mescladas; não dá para fazer isso!",
  },
  filter: {
    filter: "criar filtro", sortByAsc: "Classificar de A a Z", sortByDesc: "Classificar de Z a A", filterByColor: "Filtrar por cor", filterByCondition: "Filtrar por condição",
    filterByValues: "Filtrar por valores", filiterInputNone: "Nenhuma", filiterInputTip: "Valor do filtro", filiterRangeStartTip: "Valor", filiterRangeEndTip: "Valor",
    filterValueByAllBtn: "Marcar tudo", filterValueByClearBtn: "Limpar", filterValueByInverseBtn: "Inverter", filterValueByTip: "Filtrar por valores",
    filterConform: "Confirmar", filterCancel: "Cancelar", clearFilter: "Tirar filtro", conditionNone: "Nenhuma", conditionCellIsNull: "Está vazia",
    conditionCellNotNull: "Não está vazia", conditionCellTextContain: "O texto contém", conditionCellTextNotContain: "O texto não contém",
    conditionCellTextStart: "O texto começa com", conditionCellTextEnd: "O texto termina com", conditionCellTextEqual: "O texto é exatamente",
    conditionCellDateEqual: "A data é", conditionCellDateBefore: "A data é antes de", conditionCellDateAfter: "A data é depois de",
    conditionCellGreater: "Maior que", conditionCellGreaterEqual: "Maior ou igual a", conditionCellLess: "Menor que", conditionCellLessEqual: "Menor ou igual a",
    conditionCellEqual: "É igual a", conditionCellNotEqual: "É diferente de", conditionCellBetween: "Está entre", conditionCellNotBetween: "Não está entre",
    filiterMoreDataTip: "Muitos dados! Aguarde", filiterMonthText: "Mês", filiterYearText: "Ano", filiterByColorTip: "Filtrar pela cor da célula",
    filiterByTextColorTip: "Filtrar pela cor do texto", filterContainerOneColorTip: "Esta coluna tem uma cor só", filterDateFormatTip: "Formato de data",
    valueBlank: "(Vazias)", mergeError: "O filtro tem células mescladas; não dá para fazer isso!",
  },
  rightclick: {
    copy: "Copiar", copyAs: "Copiar como", paste: "Colar", insert: "Inserir", image: "Inserir imagem", link: "Inserir link", delete: "Excluir",
    deleteCell: "Excluir célula", deleteSelected: "Excluir selecionadas: ", hide: "Ocultar", hideSelected: "Ocultar selecionadas: ", showHide: "Mostrar ocultas: ",
    to: "Para", left: "Esquerda", right: "Direita", top: "Acima", bottom: "Abaixo", moveLeft: "Mover para a esquerda", moveUp: "Mover para cima", add: "Inserir",
    row: "Linha", column: "Coluna", width: " (largura)", height: " (altura)", number: "Quantidade", confirm: "Confirmar", orderAZ: "Classificar de A a Z",
    orderZA: "Classificar de Z a A", clearContent: "Limpar conteúdo", matrix: "Operação de matriz", sortSelection: "Classificar", filterSelection: "Filtrar",
    chartGeneration: "Criar gráfico", firstLineTitle: "primeira linha é título", untitled: "sem título", transpose: "Transpor", plus: "Somar", minus: "Subtrair",
    multiply: "Multiplicar", divided: "Dividir", power: "Potência", root: "Raiz", removeDuplicate: "Tirar valores repetidos", byRow: "Por linha", byCol: "Por coluna",
    noMulti: "Não dá para fazer isso com várias áreas selecionadas; selecione uma só", cannotDeleteAllRow: "Não dá para excluir todas as linhas",
    cannotDeleteAllColumn: "Não dá para excluir todas as colunas", rowOverLimit: "Passou do limite de 10.000 linhas", columnOverLimit: "Passou do limite de 1.000 colunas",
  },
  comment: { insert: "Inserir comentário", edit: "Editar comentário", delete: "Excluir comentário", showOne: "Mostrar/ocultar", showAll: "Mostrar/ocultar todos" },
  sheetconfig: {
    delete: "Excluir", copy: "Duplicar", rename: "Renomear", changeColor: "Mudar cor", hide: "Ocultar", unhide: "Mostrar", moveLeft: "Mover para a esquerda",
    moveRight: "Mover para a direita", resetColor: "Redefinir cor", cancelText: "Cancelar", chooseText: "Confirmar cor", focus: "Focar",
    tipNameRepeat: "Já existe uma página com esse nome", noMoreSheet: "A planilha precisa de pelo menos uma página visível.",
    confirmDelete: "Excluir a página", redoDelete: "Dá para desfazer com Ctrl+Z", noHide: "Não dá para ocultar: precisa sobrar uma página visível",
    sheetNameSpecCharError: "O nome não pode ter: [ ] :  ? * / ' \"", sheetNamecannotIsEmptyError: "O nome da página não pode ficar vazio",
  },
  findAndReplace: {
    find: "Localizar", replace: "Substituir", goto: "Ir para", location: "Local", formula: "Fórmula", date: "Data", number: "Número", string: "Texto", error: "Erro",
    condition: "Condição", findTextbox: "Localizar", replaceTextbox: "Substituir por", regexTextbox: "Expressão regular", wholeTextbox: "Palavra inteira",
    distinguishTextbox: "Diferenciar maiúsculas", allReplaceBtn: "Substituir tudo", replaceBtn: "Substituir", allFindBtn: "Localizar tudo", findBtn: "Próximo",
    noFindTip: "Não encontrado", searchTargetSheet: "Página", searchTargetCell: "Célula", searchTargetValue: "Valor", searchInputTip: "Escreva o que procurar",
    noReplceTip: "Nada para substituir", noMatchTip: "Nada encontrado", successTip: "${xlength} encontrados",
  },
  insertLink: {
    linkText: "Texto", linkType: "Tipo de link", linkAddress: "Endereço", linkSheet: "Página", linkCell: "Intervalo de células", linkTooltip: "Dica",
    selectCellRange: "Selecionar células", cellRangePlaceholder: "Selecione com o mouse ou escreva", placeholder1: "Endereço da página na internet",
    placeholder2: "Célula, por exemplo A1", placeholder3: "Texto da dica", tooltipInfo1: "Escreva um link válido",
    invalidCellRangeTip: "Escreva um intervalo válido, como Página1!A1:C8", openLink: "Abrir link", goTo: "Ir para ${linkAddress}",
  },
  splitText: { splitDelimiters: "Separadores", splitOther: "Outro", splitContinueSymbol: "Separadores seguidos contam como um", splitDataPreview: "Prévia", splitTextTitle: "Dividir texto", splitConfirmToExe: "Já tem dados aqui; substituir?" },
  dropCell: { copyCell: "Copiar", sequence: "Sequência", onlyFormat: "Só o formato", noFormat: "Sem o formato", day: "Dia", workDay: "Dia útil", month: "Mês", year: "Ano" },
  formula: { sum: "Soma", average: "Média", count: "Contagem", max: "Máximo", min: "Mínimo", find: "Saiba mais", tipSelectCell: "Selecione a célula para inserir a função" },
  drag: {
    noMerge: "Não dá para fazer isso em células mescladas", noMulti: "Não dá para fazer isso com várias áreas selecionadas; selecione uma só",
    noPaste: "Não dá para colar aqui; selecione uma célula e cole de novo", noPartMerge: "Não dá para fazer isso em células mescladas só em parte",
    inputCorrect: "Escreva um valor válido", notLessOne: "Linhas e colunas não podem ser menos que 1",
  },
  cellFormat: { cellFormatTitle: "Formatar células", protection: "Proteção", locked: "Travada", hidden: "Oculta", selectionIsNullAlert: "Selecione as células!" },
  print: { normalBtn: "Normal", layoutBtn: "Layout da página", pageBtn: "Quebra de página", menuItemPrint: "Imprimir (Ctrl+P)" },
  edit: { typing: "digitando" },
  info: {
    loading: "Carregando...", copy: "Copiar", return: "Sair", rename: "Renomear", noName: "Planilha sem título", add: "Adicionar", addLast: "linhas no fim",
    backTop: "Voltar ao topo", nextPage: "Próxima", tipInputNumber: "Escreva um número", tipRowHeightLimit: "A altura da linha vai de 0 a 545",
    tipColumnWidthLimit: "A largura da coluna vai de 0 a 2038", currentCellInput: "Conteúdo da célula", newSheet: "Nova página", sheetOptions: "Opções da página",
    zoomIn: "Aumentar zoom", zoomOut: "Diminuir zoom", shortcuts: "Atalhos do teclado",
  },
};

let aplicado = false;

/** Troca os textos em inglês pelos em português (no lugar, uma vez). */
export function aplicarPortugues(): void {
  if (aplicado) return;
  aplicado = true;
  const en = locale({ lang: "en" } as Parameters<typeof locale>[0]) as unknown as Record<string, Textos>;
  for (const fonte of [PT, SECOES]) {
    for (const [secao, textos] of Object.entries(fonte)) {
      if (en[secao] && typeof en[secao] === "object") Object.assign(en[secao], textos);
    }
  }
  // v5: lista de funções (autocompletar e "Mais funções") em português, formatos de data e tipos de link.
  const listas = en as unknown as { functionlist: ItemLista[]; dateFmtList: unknown[]; linkTypeList: unknown[] };
  listas.functionlist.splice(0, listas.functionlist.length, ...listaEmPortugues(listas.functionlist));
  listas.dateFmtList.splice(0, listas.dateFmtList.length, ...DATAS_PT);
  listas.linkTypeList.splice(0, listas.linkTypeList.length, ...LINKS_PT);
  ensinarPortuguesAoMotor();
  protegerCursorDaFormula();
  // Fonte padrão do Google Sheets (a primeira da lista é a padrão do editor).
  const fontes = ["Arial", "Times New Roman", "Tahoma", "Verdana"];
  (en as unknown as { fontarray: string[] }).fontarray.splice(0, 4, ...fontes);
  Object.assign((en as unknown as { fontjson: Record<string, number> }).fontjson, Object.fromEntries(fontes.map((f, i) => [f.toLowerCase(), i])));
  // Nomes dos formatos de número.
  const alvo = en as unknown as { defaultFmt: (moeda: string) => { text: string }[] };
  const original = alvo.defaultFmt;
  alvo.defaultFmt = (moeda: string) => original(moeda).map(f => ({ ...f, ...(BRASIL[f.text] ?? {}), text: FORMATOS[f.text] ?? f.text }));
}

/** Formatos no jeito brasileiro (data dia/mês/ano, hora 24 h); o exemplo aparece no menu. */
const BRASIL: Record<string, { value: string; example: string }> = {
  Number: { value: "#,##0.00", example: "1.000,12" }, Percent: { value: "0.00%", example: "12,21%" },
  Accounting: { value: "R$ #,##0.00;(R$ #,##0.00)", example: "(R$ 1.200,09)" }, Currency: { value: "R$ #,##0.00", example: "R$ 1.200,09" },
  Date: { value: "dd/MM/yyyy", example: "29/11/2017" }, Time: { value: "hh:mm", example: "15:00" }, "Time 24H": { value: "hh:mm:ss", example: "15:00:00" },
  "Date time": { value: "dd/MM/yyyy hh:mm", example: "29/11/2017 15:00" }, "Date time 24 H": { value: "dd/MM/yyyy hh:mm:ss", example: "29/11/2017 15:00:00" },
};

/**
 * Defeito do editor: digitando uma fórmula com nome que ele não conhece seguido de aspas (=VLOOKUP("…), ele se perde na
 * posição do cursor e, para se recuperar, usa um campo interno (rangeResizeTo) que nunca é preenchido, derrubando a
 * tela inteira. O campo passa a apontar para a caixa de edição em foco, e o cursor só vai para o fim do texto.
 */
function protegerCursorDaFormula(): void {
  const proto = FormulaCache.prototype as unknown as Record<string, unknown>;
  if (Object.getOwnPropertyDescriptor(proto, "rangeResizeTo")) return;
  const guardado = new WeakMap<object, unknown>();
  Object.defineProperty(proto, "rangeResizeTo", {
    configurable: true,
    get(this: object) {
      const valor = guardado.get(this);
      if (valor) return valor;
      const ativo = document.activeElement;
      return [ativo instanceof HTMLElement && ativo.isContentEditable ? ativo : document.querySelector("[contenteditable=true]") ?? document.body];
    },
    set(this: object, valor: unknown) { guardado.set(this, valor); },
  });
}

let motorEnsinado = false;

/**
 * O motor de fórmulas só conhece os nomes em inglês: cada fórmula é traduzida antes do cálculo (=SOMA(A1;B1) vira
 * =SUM(A1,B1)), e as funções que ele não tem (PROCX, UNIRTEXTO, MÁXIMOSES…) são atendidas por funcoesExtras.
 */
function ensinarPortuguesAoMotor(): void {
  if (motorEnsinado) return;
  motorEnsinado = true;
  const proto = Parser.prototype;
  const calcular = proto.parse;
  proto.parse = function (this: Parser, expressao: string, opcoes?: unknown) {
    return calcular.call(this, formulaParaMotor(`=${expressao}`).slice(1), opcoes);
  };
  const chamar = proto._callFunction;
  proto._callFunction = function (this: Parser, nome: string, params: unknown[] = []) {
    const extra = EXTRAS[nome.toUpperCase()];
    return extra ? extra(params as Parameters<typeof extra>[0]) : chamar.call(this, nome, params);
  };
}

const FORMATOS: Record<string, string> = {
  Automatic: "Automático", "Plain text": "Texto simples", Number: "Número", Percent: "Porcentagem", Scientific: "Científico",
  Accounting: "Contábil", Currency: "Moeda", Date: "Data", Time: "Hora", "Date time": "Data e hora", Duration: "Duração",
  Financial: "Financeiro", "More formats": "Mais formatos", "Rounded currency": "Moeda arredondada", "Time 24H": "Hora com segundos",
  "Date time 24 H": "Data e hora com segundos", "Custom formats": "Formatos personalizados",
};
