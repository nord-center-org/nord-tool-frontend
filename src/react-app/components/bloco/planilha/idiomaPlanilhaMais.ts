/**
 * Bloco de notas v5: o resto dos textos do Fortune-sheet em português (formatação condicional, validação de dados,
 * proteção, cores alternadas, imagens, busca de funções, atalhos). Completa o PT de idiomaPlanilha.ts.
 */
type Textos = Record<string, string>;

const conditionformat: Textos = {
  conditionformat_greaterThan: "Formatação condicional: maior que", conditionformat_greaterThan_title: "Formatar células maiores que",
  conditionformat_lessThan: "Formatação condicional: menor que", conditionformat_lessThan_title: "Formatar células menores que",
  conditionformat_between: "Formatação condicional: entre", conditionformat_between_title: "Formatar células com valores entre",
  conditionformat_equal: "Formatação condicional: igual a", conditionformat_equal_title: "Formatar células iguais a",
  conditionformat_textContains: "Formatação condicional: texto contém", conditionformat_textContains_title: "Formatar células que contêm o texto",
  conditionformat_occurrenceDate: "Formatação condicional: data", conditionformat_occurrenceDate_title: "Formatar células com as datas",
  conditionformat_duplicateValue: "Formatação condicional: valores repetidos", conditionformat_duplicateValue_title: "Formatar células com valores",
  conditionformat_top10: "Formatação condicional: 10 maiores", conditionformat_top10_percent: "Formatação condicional: 10% maiores",
  conditionformat_top10_title: "Formatar as células com os maiores valores", conditionformat_last10: "Formatação condicional: 10 menores",
  conditionformat_last10_percent: "Formatação condicional: 10% menores", conditionformat_last10_title: "Formatar as células com os menores valores",
  conditionformat_aboveAverage: "Formatação condicional: acima da média", conditionformat_aboveAverage_title: "Formatar células acima da média",
  conditionformat_belowAverage: "Formatação condicional: abaixo da média", conditionformat_belowAverage_title: "Formatar células abaixo da média",
  rule: "Regra", newRule: "Nova regra", editRule: "Editar regra", deleteRule: "Excluir regra", deleteCellRule: "Excluir regras das células",
  deleteSheetRule: "Excluir regras da página", manageRules: "Gerenciar regras", showRules: "Mostrar as regras de", highlightCellRules: "Destacar células",
  itemSelectionRules: "Maiores e menores", conditionformatManageRules: "Regras de formatação condicional", format: "Formato", setFormat: "Formatar",
  setAs: "com", setAsByArea: "Na área escolhida, formatar com", applyRange: "Aplicar ao intervalo", selectRange: "Escolher o intervalo",
  selectRange_percent: "Porcentagem do intervalo", selectRange_average: "Média do intervalo", selectRange_value: "Valor do intervalo",
  pleaseSelectRange: "Escolha o intervalo", selectDataRange: "Escolher dados", selectCell: "escolher célula", pleaseSelectCell: "Escolha a célula",
  pleaseSelectADate: "Escolha uma data", pleaseEnterInteger: "Escreva um número inteiro de 1 a 1000", onlySingleCell: "Só dá para usar uma célula",
  conditionValueCanOnly: "O valor da condição precisa ser um número ou uma célula", ruleTypeItem1: "Formatar todas as células pelo valor",
  ruleTypeItem2: "Formatar só as células que contêm", ruleTypeItem2_title: "Só células que atendem à condição",
  ruleTypeItem3: "Formatar só os maiores ou menores valores", ruleTypeItem3_title: "Valores que estão entre os",
  ruleTypeItem4: "Formatar só valores acima ou abaixo da média", ruleTypeItem4_title: "Valores que estão",
  ruleTypeItem5: "Formatar só valores únicos ou repetidos", ruleTypeItem6: "Usar uma fórmula para escolher as células",
  formula: "Fórmula", textColor: "Cor do texto", cellColor: "Cor da célula", confirm: "OK", confirmColor: "Confirmar cor", cancel: "Cancelar",
  close: "Fechar", clearColorSelect: "Limpar cor", sheet: "Página", currentSheet: "Esta página", dataBar: "Barra de dados",
  dataBarColor: "Cor da barra de dados", gradientDataBar_1: "Barra em degradê azul", gradientDataBar_2: "Barra em degradê verde",
  gradientDataBar_3: "Barra em degradê vermelho", gradientDataBar_4: "Barra em degradê laranja", gradientDataBar_5: "Barra em degradê azul-claro",
  gradientDataBar_6: "Barra em degradê roxo", solidColorDataBar_1: "Barra azul", solidColorDataBar_2: "Barra verde", solidColorDataBar_3: "Barra vermelha",
  solidColorDataBar_4: "Barra laranja", solidColorDataBar_5: "Barra azul-clara", solidColorDataBar_6: "Barra roxa", colorGradation: "Escala de cores",
  colorGradation_1: "Verde-amarelo-vermelho", colorGradation_2: "Vermelho-amarelo-verde", colorGradation_3: "Verde-branco-vermelho",
  colorGradation_4: "Vermelho-branco-verde", colorGradation_5: "Azul-branco-vermelho", colorGradation_6: "Vermelho-branco-azul",
  colorGradation_7: "Branco-vermelho", colorGradation_8: "Vermelho-branco", colorGradation_9: "Verde-branco", colorGradation_10: "Branco-verde",
  colorGradation_11: "Verde-amarelo", colorGradation_12: "Amarelo-verde", icons: "Ícones", pleaseSelectIcon: "Escolha um conjunto de ícones:",
  cellValue: "Valor da célula", specificText: "Texto", occurrenceDate: "Data", greaterThan: "Maior que", lessThan: "Menor que", between: "Entre",
  equal: "Igual a", in: "em", between2: "", contain: "Contém", textContains: "Texto contém", duplicateValue: "Valor repetido", uniqueValue: "Valor único",
  top: "Maiores", top10: "10 maiores", top10_percent: "10% maiores", last: "Menores", last10: "10 menores", last10_percent: "10% menores", oneself: "",
  above: "Acima", aboveAverage: "Acima da média", below: "Abaixo", belowAverage: "Abaixo da média", all: "Tudo", yesterday: "Ontem", today: "Hoje",
  tomorrow: "Amanhã", lastWeek: "Semana passada", thisWeek: "Esta semana", lastMonth: "Mês passado", thisMonth: "Este mês", lastYear: "Ano passado",
  thisYear: "Este ano", last7days: "Últimos 7 dias", last30days: "Últimos 30 dias", next7days: "Próximos 7 dias", next30days: "Próximos 30 dias",
  next60days: "Próximos 60 dias", chooseRuleType: "Tipo de regra", editRuleDescription: "Descrição da regra", newFormatRule: "Nova regra de formatação",
  editFormatRule: "Editar regra de formatação", formatStyle: "Estilo", fillType: "Preenchimento", color: "Cor", twocolor: "Duas cores",
  tricolor: "Três cores", multicolor: "Várias cores", grayColor: "Cinza", gradient: "Degradê", solid: "Sólido", maxValue: "Maior valor",
  medianValue: "Mediana", minValue: "Menor valor", direction: "Direção", threeWayArrow: "3 setas", fourWayArrow: "4 setas", fiveWayArrow: "5 setas",
  threeTriangles: "3 triângulos", shape: "Formas", threeColorTrafficLight: "Semáforo de 3 cores", fourColorTrafficLight: "Semáforo de 4 cores",
  threeSigns: "3 sinais", greenRedBlackGradient: "Verde-vermelho-preto", rimless: "Sem borda", bordered: "Com borda", mark: "Marcas",
  threeSymbols: "3 símbolos", tricolorFlag: "Bandeira de 3 cores", circled: "Com círculo", noCircle: "Sem círculo", grade: "Níveis",
  grade4: "4 níveis", grade5: "5 níveis", threeStars: "3 estrelas", fiveQuadrantDiagram: "5 quadrantes", fiveBoxes: "5 caixas",
};

const dataVerification: Textos = {
  cellRange: "Intervalo de células", selectCellRange: "Clique para escolher as células", selectCellRange2: "Escolha um intervalo de células",
  verificationCondition: "Critério", allowMultiSelect: "Permitir escolher vários", dropdown: "Lista suspensa", checkbox: "Caixa de seleção",
  number: "Número", number_integer: "Número inteiro", number_decimal: "Número decimal", text_content: "Texto (conteúdo)", text_length: "Texto (tamanho)",
  date: "Data", validity: "Validade", placeholder1: "Escreva as opções separadas por vírgula, como 1,2,3,4,5", placeholder2: "Escreva o conteúdo",
  placeholder3: "Um número, como 10", placeholder4: "Escreva o texto", placeholder5: "Escreva a dica que aparece ao escolher a célula",
  selected: "Marcada", notSelected: "Desmarcada", between: "Entre", notBetween: "Fora de", equal: "Igual a", notEqualTo: "Diferente de",
  moreThanThe: "Maior que", lessThan: "Menor que", greaterOrEqualTo: "Maior ou igual a", lessThanOrEqualTo: "Menor ou igual a", include: "Contém",
  exclude: "Não contém", earlierThan: "Antes de", noEarlierThan: "Não antes de", laterThan: "Depois de", noLaterThan: "Não depois de",
  identificationNumber: "Número de documento", phoneNumber: "Telefone", remote: "Buscar opções automaticamente",
  prohibitInput: "Recusar dados inválidos", hintShow: "Mostrar dica ao escolher a célula", deleteVerification: "Remover validação",
  tooltipInfo1: "A lista suspensa precisa de opções", tooltipInfo2: "A caixa de seleção precisa de conteúdo", tooltipInfo3: "O valor não é um número",
  tooltipInfo4: "O valor 2 não pode ser menor que o valor 1", tooltipInfo5: "O texto não pode ficar vazio", tooltipInfo6: "O valor não é uma data",
  tooltipInfo7: "A data 2 não pode ser antes da data 1", textlengthInteger: "O tamanho do texto precisa ser um número inteiro (0 ou mais)",
};

const protection: Textos = {
  protectiontTitle: "Proteção", enterPassword: "Senha (opcional)", enterHintTitle: "Aviso ao tentar editar (opcional)",
  enterHint: "A célula que você tentou mudar está numa página protegida. Para mudar, tire a proteção da página (pode pedir senha).",
  swichProtectionTip: "Proteger a página e as células travadas", authorityTitle: "Quem usa esta página pode:", selectLockedCells: "Escolher células travadas",
  selectunLockedCells: "Escolher células destravadas", formatCells: "Formatar células", formatColumns: "Formatar colunas", formatRows: "Formatar linhas",
  insertColumns: "Inserir colunas", insertRows: "Inserir linhas", insertHyperlinks: "Inserir links", deleteColumns: "Excluir colunas",
  deleteRows: "Excluir linhas", sort: "Classificar", filter: "Filtrar", usePivotTablereports: "Usar tabela dinâmica", editObjects: "Editar objetos",
  editScenarios: "Editar cenários", allowRangeTitle: "Quem usa o intervalo pode:", allowRangeAdd: "Novo...", allowRangeAddTitle: "Título",
  allowRangeAddSqrf: "Referência", selectCellRange: "Clique para escolher as células", selectCellRangeHolder: "Intervalo de células",
  allowRangeAddTitlePassword: "Senha", allowRangeAddTitleHint: "Aviso", allowRangeAddTitleHintTitle: "Aviso quando houver senha (opcional)",
  allowRangeAddtitleDefault: "Nome do intervalo", rangeItemDblclick: "Clique duas vezes para editar", rangeItemHasPassword: "Tem senha",
  rangeItemErrorTitleNull: "O título está vazio", rangeItemErrorRangeNull: "A referência está vazia", rangeItemErrorRange: "A referência está errada",
  validationTitle: "Senha", validationTips: "Escreva a senha para tirar a proteção da página", validationInputHint: "Escreva a senha",
  checkPasswordNullalert: "Escreva a senha!", checkPasswordWrongalert: "Senha errada; tente de novo.", checkPasswordSucceedalert: "Proteção tirada!",
  defaultRangeHintText: "A célula está protegida por senha.",
  defaultSheetHintText: "A célula está numa página protegida. Para mudar, tire a proteção da página (pode pedir senha).",
};

const formulaMore: Textos = {
  valueTitle: "Valor", tipSelectDataRange: "Escolher dados", tipDataRangeTile: "Intervalo de dados", findFunctionTitle: "Procurar função",
  tipInputFunctionName: "Nome da função ou o que ela faz", Array: "Matriz", Database: "Banco de dados", Date: "Data", Engineering: "Engenharia",
  Filter: "Filtro", Financial: "Financeiro", luckysheet: "Outras", other: "Outras", Logical: "Lógica", Lookup: "Pesquisa", Math: "Matemática",
  Operator: "Operador", Parser: "Conversão", Statistical: "Estatística", Text: "Texto", dataMining: "Mineração de dados",
  selectFunctionTitle: "Escolha uma função", calculationResult: "Resultado", tipSuccessText: "Pronto", tipParamErrorText: "Tipo de parâmetro errado",
  helpClose: "Fechar", helpCollapse: "Recolher", helpExample: "Exemplo", helpAbstract: "Resumo", execfunctionError: "Erro na fórmula",
  execfunctionSelfError: "A fórmula não pode usar a própria célula",
  execfunctionSelfErrorResult: "A fórmula não pode usar a própria célula; o resultado ficaria errado",
  allowRepeatText: "Pode repetir", allowOptionText: "Opcional", selectCategory: "Ou escolha uma categoria",
};

const formula: Textos = {
  ifGenerate: "Montar fórmula SE", tipNotBelongToIf: "A função desta célula não é um SE!", ifGenCompareValueTitle: "Valor de comparação",
  ifGenSelectCellTitle: "Clique para escolher a célula", ifGenRangeTitle: "Intervalo", ifGenRangeTo: "até", ifGenRangeEvaluate: "Avaliar intervalo",
  ifGenSelectRangeTitle: "Clique para escolher o intervalo", ifGenCutWay: "Dividir", ifGenCutSame: "Em partes iguais", ifGenCutNpiece: "Em N partes",
  ifGenCutCustom: "Personalizado", ifGenCutConfirm: "OK", ifGenTipSelectCell: "Escolher células", ifGenTipSelectCellPlace: "Escolha as células",
  ifGenTipSelectRange: "Escolher intervalo", ifGenTipSelectRangePlace: "Escolha o intervalo", ifGenTipNotNullValue: "O valor de comparação não pode ficar vazio!",
  ifGenTipLableTitile: "Rótulo", ifGenTipRangeNotforNull: "O intervalo não pode ficar vazio!", ifGenTipCutValueNotforNull: "O valor da divisão não pode ficar vazio!",
  ifGenTipNotGenCondition: "Não há condição para montar!",
};

const info: Textos = {
  detailUpdate: "Aberta agora", detailSave: "Cópia local restaurada", tips: "Renomear planilha", wait: "aguardando atualização",
  pageInfo: "Total ${total}, ${totalPage} páginas, atual ${currentPage}", tipInputNumberLimit: "Dá para adicionar de 1 a 100",
  pageInfoFull: "Total ${total}, ${totalPage} páginas, tudo à mostra", sheetIsFocused: "Foco preso na planilha.", sheetNotFocused: "Foco solto da planilha.",
  sheetSrIntro: "Para prender ou soltar o foco da planilha (e navegar pela barra), use Shift, Control, F.", Dropdown: "Lista",
  toggleSheetFocusShortcut: "Prender/soltar o foco: Shift, Control, F.", selectRangeShortcut: "Escolher intervalo: Shift e as setas.",
  autoFillDownShortcut: "Preencher para baixo a partir da primeira célula: Control (ou Command), D.",
  autoFillRightShortcut: "Preencher para a direita a partir da primeira célula: Control (ou Command), R.", boldTextShortcut: "Negrito: Control (ou Command), B.",
  copyShortcut: "Copiar: Control (ou Command), C.", pasteShortcut: "Colar: Control (ou Command), V.", undoShortcut: "Desfazer: Control (ou Command), Z.",
  redoShortcut: "Refazer: Control (ou Command), Shift, Z.", deleteCellContentShortcut: "Apagar o conteúdo: Delete ou Backspace.",
  confirmCellEditShortcut: "Confirmar e descer: Enter.", moveRightShortcut: "Ir para a direita: Tab.", moveLeftShortcut: "Ir para a esquerda: Shift, Tab.",
};

const rightclick: Textos = {
  array1: "Matriz de uma dimensão", array2: "Matriz de duas dimensões", array3: "Matriz de várias dimensões", diagonal: "Diagonal",
  antiDiagonal: "Diagonal inversa", diagonalOffset: "Deslocamento da diagonal", offset: "Deslocamento", boolean: "Lógico", flip: "Espelhar",
  upAndDown: "De cima para baixo", leftAndRight: "Da esquerda para a direita", clockwise: "Sentido horário", counterclockwise: "Sentido anti-horário",
  matrixCalculation: "Cálculo de matriz", log: "Log", delete0: "Tirar os zeros das pontas", generateNewMatrix: "Gerar nova matriz",
  cannotDeleteRowReadOnly: "Não dá para excluir uma linha só de leitura", cannotDeleteColumnReadOnly: "Não dá para excluir uma coluna só de leitura",
  cannotInsertOnRowReadOnly: "Não dá para inserir numa linha só de leitura", cannotInsertOnColumnReadOnly: "Não dá para inserir numa coluna só de leitura",
};

const findAndReplace: Textos = {
  rowSpan: "Intervalo de linhas", columnSpan: "Intervalo de colunas", locationExample: "Local", lessTwoRowTip: "Escolha pelo menos duas linhas",
  lessTwoColumnTip: "Escolha pelo menos duas colunas", modeTip: "Não dá para fazer isso neste modo", locationConstant: "Constante",
  locationFormula: "Fórmula", locationDate: "Data", locationDigital: "Número", locationString: "Texto", locationBool: "Lógico", locationError: "Erro",
  locationNull: "Vazia", locationCondition: "Formatação condicional", locationRowSpan: "Intervalo de linhas", locationColumnSpan: "Intervalo de colunas",
  locationTiplessTwoRow: "Escolha pelo menos duas linhas", locationTiplessTwoColumn: "Escolha pelo menos duas colunas", locationTipNotFindCell: "Célula não encontrada",
};

const SECOES: Record<string, Textos> = {
  conditionformat, dataVerification, protection, formulaMore, formula, info, rightclick, findAndReplace,
  alternatingColors: {
    applyRange: "Aplicar ao intervalo", selectRange: "Escolher os dados", header: "Cabeçalho", footer: "Rodapé",
    errorInfo: "Não dá para fazer isso com várias áreas selecionadas; selecione uma só", textTitle: "Estilo", custom: "PERSONALIZADO", close: "fechar",
    selectionTextColor: "Clique para escolher a cor do texto", selectionCellColor: "Clique para escolher a cor da célula", removeColor: "Tirar cores alternadas",
    colorShow: "cor", currentColor: "Atual", tipSelectRange: "Escolha o intervalo das cores alternadas", errorNoRange: "Nenhum intervalo escolhido",
    errorExistColors: "Já há cores alternadas aqui e elas não podem ser editadas",
  },
  paint: { start: "Pincel de formatação ligado", end: "ESC", tipSelectRange: "Escolha o que copiar", tipNotMulti: "Não dá para fazer isso com várias áreas selecionadas" },
  screenshot: {
    screenshotTipNoSelection: "Escolha a área da captura", screenshotTipTitle: "Aviso!", screenshotTipHasMerge: "Não dá para fazer isso em células mescladas",
    screenshotTipHasMulti: "Não dá para fazer isso com várias áreas selecionadas", screenshotTipSuccess: "Pronto", screenshotImageName: "Captura",
    downLoadClose: "Fechar", downLoadCopy: "Copiar", downLoadBtn: "Baixar", browserNotTip: "Este navegador não permite!",
    rightclickTip: "Clique com o botão direito na imagem e escolha \"copiar\"", successTip: "Pronto (se colar não funcionar, clique com o botão direito na imagem e copie)",
  },
  splitText: {
    tipNoMulti: "Não dá para fazer isso com várias áreas selecionadas; selecione uma só",
    tipNoMultiColumn: "Dá para dividir uma coluna por vez: escolha várias linhas de uma coluna só", tipNoSelect: "Escolha as células antes",
  },
  imageText: {
    imageSetting: "Imagem", close: "Fechar", conventional: "Geral", moveCell1: "Mover e redimensionar com as células", moveCell2: "Mover sem redimensionar",
    moveCell3: "Não mover nem redimensionar", fixedPos: "Posição fixa", border: "Borda", width: "Largura", radius: "Arredondamento", style: "Estilo",
    solid: "Contínua", dashed: "Tracejada", dotted: "Pontilhada", double: "Dupla", color: "Cor",
  },
  punctuation: { tab: "Tab", semicolon: "ponto e vírgula", comma: "vírgula", space: "espaço" },
  sheetconfig: { chartEditNoOpt: "Não dá para fazer isso editando um gráfico!" },
  drag: {
    affectPivot: "Não dá para mudar: afetaria a tabela dinâmica!", offsetColumnLessZero: "O deslocamento da coluna não pode ser negativo!",
    pasteMustKeybordAlert: "Copiar e colar na planilha: Ctrl + C copia, Ctrl + V cola, Ctrl + X recorta",
    pasteMustKeybordAlertHTMLTitle: "Copiar e colar na planilha",
    pasteMustKeybordAlertHTML: "<b>Ctrl + C</b> copia<br/><b>Ctrl + V</b> cola<br/><b>Ctrl + X</b> recorta",
  },
  dropCell: { chineseNumber: "Números chineses" },
  imageCtrl: { borderTile: "Cor da borda da imagem", borderCur: "Cor" },
  cellFormat: {
    protectionTips: "Para travar células ou ocultar fórmulas, proteja a página (botão Proteger a página na barra).", tipsPart: "Parte marcada",
    tipsAll: "Tudo marcado", sheetDataIsNullAlert: "Erro: não há dados!",
  },
  print: { menuItemAreas: "Áreas de impressão", menuItemRows: "Linhas de título", menuItemColumns: "Colunas de título" },
  fontFamily: { MicrosoftYaHei: "YaHei" },
};

export default SECOES;

/** Formatos de data e hora do menu, no jeito brasileiro. */
export const DATAS_PT = [
  { name: "05/08/1930", value: "dd/MM/yyyy" }, { name: "05/08", value: "dd/MM" }, { name: "05/08/1930 13:30", value: "dd/MM/yyyy hh:mm" },
  { name: "agosto de 1930", value: "MMMM \"de\" yyyy" }, { name: "1930-08-05", value: "yyyy-MM-dd" }, { name: "13:30:30", value: "h:mm:ss" },
  { name: "13:30", value: "h:mm" },
];

/** Tipos de link no "Inserir link". */
export const LINKS_PT = [{ text: "Página da internet", value: "webpage" }, { text: "Intervalo de células", value: "cellrange" }, { text: "Página da planilha", value: "sheet" }];
