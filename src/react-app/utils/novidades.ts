/**
 * Novidades anunciadas pelo Lugia Nexus, o mascote da tela inicial.
 * Toda entrega publicada acrescenta uma entrada NO TOPO desta lista (a mais recente primeiro), com id único.
 */

export interface Novidade {
  /** Único e estável: data + assunto, ex.: "2026-10-25-lugia-chat". */
  id: string;
  /** Data da publicação (AAAA-MM-DD). */
  data: string;
  titulo: string;
  /** O que mudou, em uma ou duas frases para quem usa o app. */
  texto: string;
  /** Onde ver a novidade no app. */
  onde?: { rotulo: string; caminho: string };
}

export const NOVIDADES: Novidade[] = [
  {
    id: "2026-11-10-cubicagem",
    data: "2026-11-10",
    titulo: "Cubicagem: o volume das peças direto do projeto",
    texto: "Em Mapeamentos → Cubicagem, abra o PDF do projeto e escreva o código da peça (V12, P5, L3): a seção é achada no desenho, você mede o comprimento ou a área ali mesmo e sai o volume em m³, com totais por tipo, descontos, perda e planilha.",
    onde: { rotulo: "Mapeamentos → Cubicagem", caminho: "/mapeamentos/cubicagem" },
  },
  {
    id: "2026-11-10-bloco-notas-texto",
    data: "2026-11-10",
    titulo: "Bloco de notas: texto formatado, documento, PDF nítido e outros arquivos",
    texto: "As caixas de texto agora têm negrito, itálico, sublinhado, cor, tamanho e alinhamento, e dá para mudar a largura delas. Cada caderno ganhou um documento de texto no estilo do Word (em páginas ou contínuo), que pode ficar lado a lado com o desenho, e as páginas podem ser giradas. PDFs ficam nítidos no zoom como no original, dá para inserir imagens, Word, Excel e TXT como páginas, e tocar de novo na ferramenta ativa solta o lápis.",
    onde: { rotulo: "Mapeamentos → Bloco de notas", caminho: "/mapeamentos/bloco-notas" },
  },
  {
    id: "2026-11-10-placas-imagens",
    data: "2026-11-10",
    titulo: "Placas: ponha imagens na folha",
    texto: "Nas placas e nos modelos, “Adicionar imagem” põe fotos, selos e logos em qualquer lugar da folha: arraste para mover, puxe os cantos para redimensionar, gire pela bolinha de baixo e escolha se a imagem fica na frente ou atrás do painel, como no Canva.",
    onde: { rotulo: "Mapeamentos → Placas", caminho: "/mapeamentos/placas" },
  },
  {
    id: "2026-11-09-bloco-notas",
    data: "2026-11-09",
    titulo: "Bloco de notas: escreva à mão e anote PDFs",
    texto: "Em Mapeamentos → Bloco de notas, crie cadernos (pautado, quadriculado, pontilhado ou em branco) e escreva com caneta que sente a pressão, marca-texto, borracha, formas, texto e imagens. Abra um PDF para anotar por cima e baixe o caderno em PDF quando quiser.",
    onde: { rotulo: "Mapeamentos → Bloco de notas", caminho: "/mapeamentos/bloco-notas" },
  },
  {
    id: "2026-11-05-relatorio-por-usuario",
    data: "2026-11-05",
    titulo: "Relatório fotográfico: cada um com os seus, e compartilháveis",
    texto: "Os relatórios fotográficos agora são de quem cria, não da obra: cada pessoa vê os seus e os que foram compartilhados com ela, e os administradores veem todos. Dentro do relatório, “Compartilhar” manda para pessoas, para a sua equipe ou para uma equipe inteira; quem recebe vê e baixa o PDF.",
    onde: { rotulo: "Mapeamentos → Relatório fotográfico", caminho: "/mapeamentos/relatorio-fotografico" },
  },
  {
    id: "2026-11-05-notificacoes-celular",
    data: "2026-11-05",
    titulo: "Notificações no celular",
    texto: "Em Configurações → Notificações no celular, toque em “Ativar notificações neste aparelho” para receber, mesmo com o app fechado, os avisos de demanda nova ou alterada, do horário agendado chegando, do prazo do dia e das respostas do SAC. No iPhone, adicione o NordTool à Tela de Início antes.",
    onde: { rotulo: "Configurações → Notificações", caminho: "/configuracoes#notificacoes" },
  },
  {
    id: "2026-11-04-placas",
    data: "2026-11-04",
    titulo: "Placas: monte placas de aviso da obra",
    texto: "Em Mapeamentos → Placas, crie placas a partir de um modelo (foto de fundo com marca d'água, logo, “OBRA:”, quadro de texto e rodapé) e baixe em PNG ou PDF A4 para imprimir. Os administradores montam e ajustam os modelos.",
    onde: { rotulo: "Mapeamentos → Placas", caminho: "/mapeamentos/placas" },
  },
  {
    id: "2026-11-04-sac-avisos-exportar",
    data: "2026-11-04",
    titulo: "SAC: aviso quando o chamado é respondido e exportação",
    texto: "Quando um administrador responde ou muda o status do seu chamado, ele aparece no Início avisando até você abrir o chamado, e o SAC ganha um selo no menu. Nas listas de chamados dá para marcar vários e exportar um ZIP com a descrição e os prints de cada um.",
    onde: { rotulo: "Visão Geral → SAC", caminho: "/sac" },
  },
  {
    id: "2026-11-04-sac",
    data: "2026-11-04",
    titulo: "SAC: peça mudanças no sistema com print marcado",
    texto: "No menu, o SAC abre um chamado para os administradores: escreva o que precisa mudar, tire o print de qualquer tela, marque com seta, círculo ou rabisco e envie. Você acompanha o status e a resposta em “Meus chamados”.",
    onde: { rotulo: "Visão Geral → SAC", caminho: "/sac" },
  },
  {
    id: "2026-11-03-escadinha-3d-por-atividade",
    data: "2026-11-03",
    titulo: "Escadinha: cada atividade aparece no 3D",
    texto: "O 3D agora monta o pavimento pelo projeto: janelas, portas-sacada com sacada e gradil, banheiros, dormitórios, escada e elevadores, e cada atividade marcada acrescenta só a sua peça (a alvenaria só a alvenaria, cada prumada a sua…); testes, conferências e limpezas viram um ícone no chão. Navegue livre como no SketchUp e abra o apartamento em 3D.",
    onde: { rotulo: "Organizacional → Escadinha", caminho: "/organizacional/escadinha" },
  },
  {
    id: "2026-11-03-animacoes-sempre-ligadas",
    data: "2026-11-03",
    titulo: "Animações paradas? Agora dá para ligar",
    texto: "Se o celular está na economia de bateria ou com “remover animações”, as cenas do login e da tela inicial ficavam paradas. Em Configurações → Aparência, escolha “Sempre ligadas” para ver as animações mesmo assim (ou “Desligadas”, se preferir tudo parado).",
    onde: { rotulo: "Configurações → Aparência", caminho: "/configuracoes#aparencia" },
  },
  {
    id: "2026-11-03-cronograma-imagem-filtros",
    data: "2026-11-03",
    titulo: "Cronograma: exporte em imagem e os filtros ficam salvos",
    texto: "Na Lista e na Rotina (semana ou mês) do Cronograma Semanal, o botão “Exportar imagem” monta uma imagem bonita com as demandas e as observações, para baixar ou compartilhar sem tirar print. E a tela agora lembra a visão e os filtros que você deixou da última vez.",
    onde: { rotulo: "Organizacional → Cronograma semanal", caminho: "/organizacional/cronograma" },
  },
  {
    id: "2026-10-30-cronograma-chat-lugia",
    data: "2026-10-30",
    titulo: "Cronograma: crie demandas conversando com a Lugia",
    texto: "No Cronograma Semanal, o botão “Criar com a Lugia” abre um chat: escreva do seu jeito o que quer programar (“reunião de obra toda segunda e quarta às 9h”, “entregar o relatório sexta”) e ela monta a demanda com título, categoria, dias, horário e prazo. É só clicar em “Criar demanda” ou em “Revisar” para ajustar antes; dá para pedir ajustes na conversa.",
    onde: { rotulo: "Organizacional → Cronograma semanal", caminho: "/organizacional/cronograma" },
  },
  {
    id: "2026-10-30-cronograma-dias-escadinha-auto",
    data: "2026-10-30",
    titulo: "Rotina com dias da semana, domingo primeiro e busca; escadinha monta sozinha",
    texto: "Na Rotina do Cronograma Semanal, a visão de mês ganhou o cabeçalho com os dias da semana, a semana agora começa no domingo e tem barra de busca para achar um compromisso. Na Lista, o botão “Expandir observações” abre as observações de todas as demandas de uma vez. Na Escadinha, assim que o ZIP de projetos termina de ser lido, a torre já é montada e salva sozinha, sem precisar clicar em “Montar a torre”.",
    onde: { rotulo: "Organizacional → Cronograma semanal", caminho: "/organizacional/cronograma" },
  },
  {
    id: "2026-10-30-escadinha-status-menu",
    data: "2026-10-30",
    titulo: "Escadinha: todos os status no menu da célula e o corte a 1,35 m no 3D",
    texto: "No menu da célula agora aparecem todos os status da escadinha da Cury para escolher à mão (atrasado, atrasada em execução, atraso com anterior pendente, dentro do período do ciclo, vazio…); a meta do ciclo continua automática e “Limpar” volta ao cálculo automático. No pavimento em 3D, as paredes e pisos ganharam as texturas do estudo do Juan (bloco 39×19, porcelanato e concreto) e a opção “Corte a 1,35 m” para olhar dentro dos apartamentos.",
    onde: { rotulo: "Organizacional → Escadinha", caminho: "/organizacional/escadinha" },
  },
  {
    id: "2026-10-29-escadinha-pavimento-3d",
    data: "2026-10-29",
    titulo: "Escadinha: apartamentos reais, pavimento em 3D e apartamento modelo",
    texto: "Os apartamentos, cômodos e portas agora saem das paredes do projeto (não mais caixas genéricas). Escolha o pavimento com um clique (na torre ou na lista ao lado) e abra com o segundo: veja a planta 2D ou o 3D do pavimento no estado atual, ou o “Apartamento modelo” pronto. A marcação é feita no pavimento e a grade da escadinha é o reflexo, com os 9 status da obra (inclusive a meta do ciclo, automática).",
    onde: { rotulo: "Organizacional → Escadinha", caminho: "/organizacional/escadinha" },
  },
  {
    id: "2026-10-29-lugia-automatico",
    data: "2026-10-29",
    titulo: "Lugia no Automático: IAs gratuitas que se revezam sozinhas",
    texto: "Escolha “Automático” no seletor de modelos e a Lugia usa as IAs gratuitas (Gemini, Groq, OpenRouter, Mistral, NVIDIA). Quando uma atinge o limite de uso, passa para a próxima sem você fazer nada, e cada resposta mostra qual IA respondeu.",
    onde: { rotulo: "Lugia (IA) → seletor de modelo", caminho: "/lugia" },
  },
  {
    id: "2026-10-29-escadinha-projetos",
    data: "2026-10-29",
    titulo: "Escadinha lê os projetos do Construcode e monta as torres sozinha",
    texto: "Em “Importar projetos”, envie o ZIP baixado do Construcode (ou os PDFs): o NordTool lê as pranchas vetoriais, sem conversão manual. Da 1ª fiada saem as paredes reais bloco a bloco (estrutural, vedação, sem função, corta-fogo, pela legenda); do corte esquemático, os pavimentos com o pé-direito certo; e a junta de dilatação divide os lados A e B. Já monta todas as torres do pacote, mostra o quantitativo de blocos da 1ª fiada com o que a escadinha marcou como assentado e uma lista do que falta pedir de projeto (arquitetura, térreo, instalações…). A medição na planta gruda na face das paredes.",
    onde: { rotulo: "Organizacional → Escadinha", caminho: "/organizacional/escadinha" },
  },
  {
    id: "2026-10-29-escadinha-cury",
    data: "2026-10-29",
    titulo: "Escadinha no padrão Cury, com o 3D construindo junto",
    texto: "A escadinha agora tem os 13 ciclos e 96 atividades da Cury, com status e cores (executado, em execução, atrasado, cadeado, meta do período) e a grade “A Escadinha” para preencher por pavimento e lado. O prédio 3D cresce com a alvenaria (blocos no lado A e B) e mostra o que foi executado: laje, esquadrias, prumadas, drywall, gesso, cerâmica, louças, portas, fachada… Dá para filtrar uma atividade, ver os pontos de atenção, medir distância e área na planta e abrir o apartamento com a planta da tipologia (dois cliques).",
    onde: { rotulo: "Organizacional → Escadinha", caminho: "/organizacional/escadinha" },
  },
  {
    id: "2026-10-28-cronograma-equipes",
    data: "2026-10-28",
    titulo: "Equipes no cronograma, mover demandas de outras pessoas e filtro por pessoa",
    texto: "Monte equipes por obra (dá para puxar da hierarquia: o líder e todos abaixo dele): quem está na mesma equipe vê as demandas uns dos outros e pode movê-las na esteira. O administrador vê tudo. E o novo filtro mostra só as suas demandas, as de uma pessoa, de várias ou de uma equipe inteira.",
    onde: { rotulo: "Organizacional → Cronograma semanal", caminho: "/organizacional/cronograma" },
  },
  {
    id: "2026-10-28-avatar-pixel",
    data: "2026-10-28",
    titulo: "O avatar voltou a ser pixel art",
    texto: "A pedido da equipe, o avatar voltou para o estilo pixelado, agora mais caprichado: contorno colorido, cor dos olhos, brilho no cabelo e todas as opções novas (formatos de olho, cabelos, acessórios, uniformes e fundos com cena).",
    onde: { rotulo: "Configurações → Meu avatar", caminho: "/conta/avatar" },
  },
  {
    id: "2026-10-28-rotina-varios-dias",
    data: "2026-10-28",
    titulo: "Atividade fixa em vários dias de uma vez",
    texto: "Na demanda fixa, marque quantos dias quiser (ou use “Seg a Sex”): o NordTool cria uma atividade por dia, já com o mesmo horário.",
    onde: { rotulo: "Organizacional → Cronograma semanal", caminho: "/organizacional/cronograma" },
  },
  {
    id: "2026-10-28-cronograma-subacessos",
    data: "2026-10-28",
    titulo: "Subacessos no Cronograma",
    texto: "Em Acessos (e por cargo, em Equipe e cargos) o Cronograma ganhou subacessos: excluir, compartilhar, rotina fixa e relatório para IA. Dá para tirar só o que quiser; estagiários já vêm sem poder excluir demandas.",
    onde: { rotulo: "Configurações → Acessos", caminho: "/configuracoes" },
  },
  {
    id: "2026-10-28-relatorio-ia",
    data: "2026-10-28",
    titulo: "Relatório do cronograma para o Gemini",
    texto: "No Cronograma semanal, toque em “Relatório para IA” e crie um link secreto de leitura. Cole a mensagem pronta no Gemini (ou outro assistente) como ação programada e receba todo dia o resumo do que tem hoje, do que está atrasado e do que vence nos próximos dias. Dá para revogar o link quando quiser.",
    onde: { rotulo: "Organizacional → Cronograma semanal", caminho: "/organizacional/cronograma" },
  },
  {
    id: "2026-10-28-escadinha-torres",
    data: "2026-10-28",
    titulo: "Escadinha: apartamentos, lados A/B, várias torres e ciclos editáveis",
    texto: "Na planta 2D, toque num apartamento para ver e trocar o lado, desenhe apartamentos e a divisão dos lados (o lado A é o da junta; dá para inverter). Agora a obra pode ter várias torres, os ciclos e atividades são editáveis e tudo fica salvo para a equipe toda.",
    onde: { rotulo: "Organizacional → Escadinha", caminho: "/organizacional/escadinha" },
  },
  {
    id: "2026-10-28-avatar-quadrinho",
    data: "2026-10-28",
    titulo: "Avatar com traço de quadrinho e formato dos olhos",
    texto: "O avatar ganhou traço de quadrinho (contorno forte, sombra com hachura, nariz marcado, camisa de trabalho com bolsos) e agora dá para escolher o formato dos olhos: amendoado, redondo, puxado, caído, pequeno, grande… A grua da tela de login também aparece inteira.",
    onde: { rotulo: "Configurações → Meu avatar", caminho: "/conta/avatar" },
  },
  {
    id: "2026-10-28-avatar-desfile",
    data: "2026-10-28",
    titulo: "Avatar novo e a obra cheia de vida",
    texto: "O avatar virou ilustração (traço fino, olhos de mangá, cabelo em mechas) e ganhou muitas opções: 16 funções, 15 cabelos, cor dos olhos, sobrancelhas, acessórios (óculos, abafador, rádio, máscara…) e cor do capacete. Na cena da obra, as cenas agora são sorteadas: pedreiro com carrinho, eletricistas com a bobina, encanadores com o tubo, o topógrafo, o cachorro da obra e encontros entre eles.",
    onde: { rotulo: "Configurações → Meu avatar", caminho: "/conta/avatar" },
  },
  {
    id: "2026-10-27-escadinha-3d",
    data: "2026-10-27",
    titulo: "Escadinha 3D: o prédio a partir da prancha",
    texto: "Anexe o PDF da planta chave: o NordTool acha o contorno da torre e os pavimentos e monta o prédio em 3D. Gire, use o cubo de vistas e toque num pavimento para ele sair da torre e virar planta 2D, com as atividades do ciclo ao lado.",
    onde: { rotulo: "Menu → Organizacional → Escadinha", caminho: "/organizacional/escadinha" },
  },
  {
    id: "2026-10-27-desfile-obra",
    data: "2026-10-27",
    titulo: "Máquinas passando pela obra",
    texto: "Na cena da obra agora passam, uma de cada vez, a betoneira, a retroescavadeira, a Bobcat e o time de engenharia a pé. E o céu da tela de login ocupa a tela inteira, sem a faixa cortada no topo.",
    onde: { rotulo: "Início → cena da obra", caminho: "/" },
  },
  {
    id: "2026-10-25-lugia-gratuita",
    data: "2026-10-25",
    titulo: "Lugia mais rápida e com opções gratuitas",
    texto: "Novos modelos gratuitos e rápidos (Groq e OpenRouter), o Gemini tenta de novo sozinho quando está sobrecarregado, e os botões no topo abrem Claude, ChatGPT ou Gemini numa janela ao lado, com a sua conta.",
    onde: { rotulo: "Lugia (IA) → topo da tela e seletor de modelo", caminho: "/lugia" },
  },
  {
    id: "2026-10-25-lugia-executar",
    data: "2026-10-25",
    titulo: "Lugia no ar: converse e peça mudanças no app",
    texto: "O chat agora roda direto no NordTool. Quem é Admin da Lugia ganha o modo \"Executar no NordTool\": descreva a mudança (com print, se quiser) e o agente Claude altera o código, abre o PR e faz o merge quando o CI passar.",
    onde: { rotulo: "Lugia (IA) → Executar no NordTool", caminho: "/lugia" },
  },
  {
    id: "2026-10-25-lugia-print",
    data: "2026-10-25",
    titulo: "Mostre para a Lugia: print de qualquer tela",
    texto: "No chat, toque em \"Print do app\", vá até a tela, marque a área e o recorte volta como anexo, com a conversa do jeito que estava. Em qualquer tela também há o botão de recorte no topo.",
    onde: { rotulo: "Lugia (IA) → Print do app", caminho: "/lugia" },
  },
  {
    id: "2026-10-25-lugia-atalho",
    data: "2026-10-25",
    titulo: "Atalho para a Lugia no menu",
    texto: "Ao lado de Configurações, no rodapé do menu, o ícone de brilho abre o chat com a Lugia.",
    onde: { rotulo: "Menu → ícone ao lado de Configurações", caminho: "/lugia" },
  },
  {
    id: "2026-10-25-lugia-chat",
    data: "2026-10-25",
    titulo: "Chegou a Lugia: Claude, ChatGPT e Gemini no NordTool",
    texto: "Converse com as três IAs num lugar só, troque de modelo no meio da conversa e anexe fotos ou PDFs (termos, comprovantes, plantas). O histórico fica salvo.",
    onde: { rotulo: "Menu → Visão Geral → Lugia (IA)", caminho: "/lugia" },
  },
];

const PREFIXO = "@NordTool:novidade_vista:";

export const chaveNovidadeVista = (idUsuario: number | string) => `${PREFIXO}${idUsuario}`;

/** Novidades que a pessoa ainda não viu: as que vêm antes da última vista (a lista é da mais nova para a mais antiga). */
export function naoVistas(lista: Novidade[], ultimaVista: string | null): Novidade[] {
  if (!ultimaVista) return lista;
  const posicao = lista.findIndex(n => n.id === ultimaVista);
  return posicao < 0 ? lista : lista.slice(0, posicao);
}

export function lerUltimaVista(storage: Pick<Storage, "getItem"> | undefined, idUsuario: number | string): string | null {
  try {
    return storage?.getItem(chaveNovidadeVista(idUsuario)) ?? null;
  } catch {
    return null;
  }
}

export function marcarVista(storage: Pick<Storage, "setItem"> | undefined, idUsuario: number | string, id: string): void {
  try {
    storage?.setItem(chaveNovidadeVista(idUsuario), id);
  } catch {
    // Sem armazenamento: o mascote só volta a contar a novidade.
  }
}

/** "25 out" a partir de AAAA-MM-DD, sem depender do fuso do aparelho. */
export function dataCurta(iso: string): string {
  const [, mes, dia] = iso.split("-").map(Number);
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return mes >= 1 && mes <= 12 && dia ? `${dia} ${meses[mes - 1]}` : iso;
}
