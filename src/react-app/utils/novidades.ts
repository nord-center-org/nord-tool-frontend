/**
 * Novidades anunciadas na tela inicial pelo avatar do dono do NordTool (sem ele, pelo mascote Lugia Nexus).
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
    id: "2026-11-22-games-v15",
    data: "2026-11-22",
    titulo: "Games: Corrida Espacial com gravidade de verdade",
    texto: "Naves com inércia, planetas que puxam e um laser que atordoa: corra pelos anéis, quebre asteroides ou dispute cristais, de 1 a 8 jogadores. Sozinho, contra o relógio.",
    onde: { rotulo: "Individual → Games", caminho: "/gestao/games" },
  },
  {
    id: "2026-11-22-games-v14",
    data: "2026-11-22",
    titulo: "Games: Coroa Maldita, o pique-pega das plataformas",
    texto: "Pule, use o pulo duplo, dê investidas e caia na cabeça dos rivais para roubar a coroa: vence quem ficar mais tempo com ela. No Pega-Pega, passe a bomba antes que ela exploda. De 1 a 8 jogadores, em três arenas.",
    onde: { rotulo: "Individual → Games", caminho: "/gestao/games" },
  },
  {
    id: "2026-11-22-games-v13",
    data: "2026-11-22",
    titulo: "Games: Fuga da Masmorra, aventura em equipe",
    texto: "Uma masmorra nova a cada partida: salas que trancam até vencer os monstros, baús com melhorias, espinhos, a chave escondida e o guardião no fim. Espada e esquiva, de 1 a 8 jogadores, e o Desafio Diário com a mesma masmorra para todo mundo.",
    onde: { rotulo: "Individual → Games", caminho: "/gestao/games" },
  },
  {
    id: "2026-11-22-games-v12",
    data: "2026-11-22",
    titulo: "Games: Horda Zumbi, sobrevivência em equipe",
    texto: "De 1 a 8 jogadores defendendo a casa à noite, só com a luz das lanternas: conserte as barricadas, compre armas nas bancadas e levante os amigos caídos. Modos Ondas, Resgate e Chefão, com bots que ajudam de verdade.",
    onde: { rotulo: "Individual → Games", caminho: "/gestao/games" },
  },
  {
    id: "2026-11-22-games-v11",
    data: "2026-11-22",
    titulo: "Games: o jogo inteiro no seu celular",
    texto: "Jogando com a turma, cada celular agora mostra a partida rodando, com o controle embaixo — dá para jogar sem TV. No mesmo Wi-Fi a conexão é direta entre os aparelhos (fluida e sem custo); fora dele, passa pela internet. Nas Cartas você vê só a sua mão e na Guerra Naval só a sua frota. Botão na barra do celular para voltar a ver só o controle.",
    onde: { rotulo: "Individual → Games", caminho: "/gestao/games" },
  },
  {
    id: "2026-11-22-games-v10",
    data: "2026-11-22",
    titulo: "Games: controles do seu jeito e controle de videogame",
    texto: "Novo botão Controles: troque as teclas, escolha se o controle aparece na tela, analógico ou setas, tamanho, modo canhoto e vibração. Controles de videogame (Bluetooth ou USB) agora funcionam no computador, no tablet e no celular — e cada controle a mais pode entrar como um jogador. O direcional do celular ficou mais firme e mostra o que está mandando.",
    onde: { rotulo: "Individual → Games", caminho: "/gestao/games" },
  },
  {
    id: "2026-11-22-games-v9",
    data: "2026-11-22",
    titulo: "Games: Cartas da Virada, com a mão no seu celular",
    texto: "O jogo de descarte por cor ou número de 2 a 8 na mesa: Pular, Inverter, +2, Coringa e +4, e não esqueça de avisar VIRADA! na última carta. Modos Clássico, Empilhamento Caótico (acumula +2/+4, o 7 troca e o 0 gira as mãos) e Rápido. Jogando pelo celular, a sua mão aparece só no seu aparelho.",
    onde: { rotulo: "Individual → Games", caminho: "/gestao/games" },
  },
  {
    id: "2026-11-22-games-v8",
    data: "2026-11-22",
    titulo: "Games: Guerra Naval com até 8 frotas",
    texto: "A batalha naval de turnos: esconda a frota, mire e afunde os navios rivais. Clássico (um tiro por vez), Salva (um tiro por navio de pé) e Especiais com sonar e bombardeio em cruz. Bots que caçam de verdade e, sozinho, a Caçada: afunde a frota escondida em até 60 tiros.",
    onde: { rotulo: "Individual → Games", caminho: "/gestao/games" },
  },
  {
    id: "2026-11-21-games-v7",
    data: "2026-11-21",
    titulo: "Games: Duelo ao Meio-Dia, o saque mais rápido do Oeste",
    texto: "Espere o FOGO! (quem atira antes queima a largada), desconfie das fintas e compense o vento. Duelo com todos ao mesmo tempo ou Torneio 1 × 1 até a final, com câmera lenta no tiro decisivo. Sozinho: treino de reflexo de 5 sinais.",
    onde: { rotulo: "Individual → Games", caminho: "/gestao/games" },
  },
  {
    id: "2026-11-21-games-v6",
    data: "2026-11-21",
    titulo: "Games: Encaixe Versus, o puzzle de peças que caem",
    texto: "Até 8 tabuleiros lado a lado: linhas limpas mandam lixo para os rivais (Versus), corrida de 40 linhas (Sprint) e, sozinho, Maratona até 50 linhas. Segurar peça, fantasma, combos e bots que jogam de verdade. No celular: setas, Girar e Guardar.",
    onde: { rotulo: "Individual → Games", caminho: "/gestao/games" },
  },
  {
    id: "2026-11-21-games-v5",
    data: "2026-11-21",
    titulo: "Games: chegou o primeiro jogo 3D, o Sumô dos Hexágonos",
    texto: "Pisos hexagonais que brilham, racham e caem em três camadas (Queda) ou uma arena que desmorona pela borda enquanto todos se empurram com o dash (Sumô). De 1 a 8 jogadores, com bots, Copa, Modo Tela e celular como controle (Dash e Pular). Sozinho, o desafio é sobreviver 60 segundos.",
    onde: { rotulo: "Individual → Games", caminho: "/gestao/games" },
  },
  {
    id: "2026-11-21-games-v4",
    data: "2026-11-21",
    titulo: "Games de cara nova: Modo Tela, avatares de corpo inteiro e jogo sozinho",
    texto: "A Central ganhou visual gamer. O Modo Tela transforma o tablet ou o computador no servidor: QR Code grande e cada um entra pelo celular. Os avatares agora aparecem de corpo inteiro, andando, caindo e comemorando. E todos os jogos vão de 1 a 8: no Bombas Táticas dá para jogar sozinho, no Desafio ou na meta de moedas.",
    onde: { rotulo: "Individual → Games", caminho: "/gestao/games" },
  },
  {
    id: "2026-11-21-app-android-v4",
    data: "2026-11-21",
    titulo: "App Android 5.0: botão para verificar atualizações",
    texto: "Dentro do app, em Configurações → App Android, aparece a versão instalada e a mais nova, com o botão Verificar atualizações: o app baixa a versão nova na hora e você só autoriza. Em app antigo, o botão baixa a atualização para instalar por cima.",
    onde: { rotulo: "Configurações → App Android", caminho: "/configuracoes" },
  },
  {
    id: "2026-11-21-games-fase-3",
    data: "2026-11-21",
    titulo: "Games: jogue com a turma usando o celular como controle",
    texto: "Abra uma sala no Bombas Táticas, mostre o QR Code na tela grande e cada pessoa entra pelo celular, que vira o controle (direcional, bomba e ação). Até 8 jogadores, bots completam as vagas, quem cai volta para a mesma vaga, e cada um ganha a partida na própria conta.",
    onde: { rotulo: "Individual → Games", caminho: "/gestao/games" },
  },
  {
    id: "2026-11-21-games-fase-2",
    data: "2026-11-21",
    titulo: "Games: recordes, ranking, conquistas e Modo Copa",
    texto: "Cada partida agora vai para a sua conta: recorde, vitórias, ranking da turma, últimas partidas e 9 conquistas. Chegou o Modo Copa (3, 5 ou 7 partidas, pontos por colocação e pódio no fim), e os favoritos da Central acompanham você em qualquer aparelho.",
    onde: { rotulo: "Individual → Games", caminho: "/gestao/games" },
  },
  {
    id: "2026-11-21-games-fase-1",
    data: "2026-11-21",
    titulo: "Games: a Central de jogos chegou",
    texto: "Nova aba Games em Individual: a Central com os 21 jogos que estão chegando e o primeiro já jogável, o Bombas Táticas, contra bots (fácil, médio e difícil), em 3 biomas e 3 modos, até 8 jogadores. Tudo desenhado e tocado por código.",
    onde: { rotulo: "Individual → Games", caminho: "/gestao/games" },
  },
  {
    id: "2026-11-19-lote-ceramica",
    data: "2026-11-19",
    titulo: "Controle de Lote de Cerâmica",
    texto: "Nova aba em Mapeamentos: os lotes de cerâmica de cada torre, com alerta quando lotes, tonalidades ou calibres diferentes são aplicados no mesmo pavimento, saldo por lote e dashboard da obra.",
    onde: { rotulo: "Mapeamentos → Controle de Lote de Cerâmica", caminho: "/mapeamentos/lote-ceramica" },
  },
  {
    id: "2026-11-18-acessos-v2",
    data: "2026-11-18",
    titulo: "Acessos: mais telas sob controle e o “Manter conectado no app”",
    texto: "Bloco de notas, Cubicagem, Treinos, Repertório e as telas em construção agora aparecem em Acessos para liberar ou tirar de cada pessoa, perfil ou cargo. E dá para escolher quem fica sempre conectado no app Android.",
    onde: { rotulo: "Configurações → Acessos", caminho: "/configuracoes" },
  },
  {
    id: "2026-11-18-app-android-barra",
    data: "2026-11-18",
    titulo: "App Android 4.0: tela certinha no Android 15",
    texto: "A barra de horário do celular não fica mais por cima do NordTool. Quem já tem a 3.0 recebe a atualização sozinho ao abrir o app: é só confirmar.",
  },
  {
    id: "2026-11-18-app-android-v3",
    data: "2026-11-18",
    titulo: "App Android 3.0: se atualiza sozinho",
    texto: "Instale a versão 3.0 pelo menu uma última vez: daqui em diante, quando sair uma versão nova, o app baixa sozinho ao abrir e só pede para você confirmar a instalação.",
  },
  {
    id: "2026-11-18-app-android-v2",
    data: "2026-11-18",
    titulo: "App Android 2.0: sempre conectado e com avisos",
    texto: "Baixe o app de novo e instale por cima: agora ele não desconecta mais, fica ativo em segundo plano e mostra os avisos nas notificações do celular, mesmo fechado. Administradores também recebem cada alteração feita no NordTool, com o nome de quem fez.",
    onde: { rotulo: "Configurações → Notificações no celular", caminho: "/configuracoes#notificacoes" },
  },
  {
    id: "2026-11-18-app-android",
    data: "2026-11-18",
    titulo: "NordTool no celular: app Android",
    texto: "Agora dá para instalar o NordTool no celular Android: toque em “Baixar app Android”, no fim do menu lateral, abra o arquivo e permita a instalação. O app abre direto no NordTool, envia fotos e arquivos e salva os downloads na pasta Downloads.",
  },
  {
    id: "2026-11-16-planilha-linhas",
    data: "2026-11-16",
    titulo: "Planilha: 1000 linhas, inserir várias e ajuste rápido",
    texto: "A planilha nova já vem com 1000 linhas, o botão “Adicionar” no fim ficou à vista, inserir com várias linhas selecionadas já sugere a mesma quantidade e dois cliques na borda ajustam a coluna ou a linha ao conteúdo.",
    onde: { rotulo: "Mapeamentos → Bloco de notas", caminho: "/mapeamentos/bloco-notas" },
  },
  {
    id: "2026-11-16-caderno-v7",
    data: "2026-11-16",
    titulo: "Caderno: editar a página, barra onde quiser e baixar páginas",
    texto: "No caderno, o botão de editar abre a página (ou a página do PDF) no editor de imagens e ela volta editada. A barra de lápis, canetas e formas pode ficar em cima, nas laterais ou flutuante. E no painel de páginas dá para marcar só as que quer e baixar em PDF, JPEG ou PNG.",
    onde: { rotulo: "Mapeamentos → Bloco de notas", caminho: "/mapeamentos/bloco-notas" },
  },
  {
    id: "2026-11-16-caderno-pinca-zoom",
    data: "2026-11-16",
    titulo: "Caderno: pinça no tablet e zoom no ponto",
    texto: "No caderno, o zoom agora vai sempre para onde está o mouse (ou entre os dedos). No tablet, a pinça funciona como no Xodo: abre e fecha o zoom e dois dedos arrastam a folha. O modo Texto também ganhou zoom.",
    onde: { rotulo: "Mapeamentos → Bloco de notas", caminho: "/mapeamentos/bloco-notas" },
  },
  {
    id: "2026-11-16-sac-concluidos",
    data: "2026-11-16",
    titulo: "SAC: aba Concluídos e print com o menu",
    texto: "Os chamados resolvidos ou recusados saem da esteira e ficam na nova aba \u201cConcluídos\u201d. E o \u201cTirar print de uma tela\u201d agora pega o menu lateral também, do jeito que está na tela.",
    onde: { rotulo: "SAC", caminho: "/sac" },
  },
  {
    id: "2026-11-14-repertorio-linha-do-tempo",
    data: "2026-11-14",
    titulo: "Repertório: linha do tempo dos acordes",
    texto: "No player, \u201cLinha do tempo\u201d mostra cada acorde da cifra como um bloco em cima da forma de onda da música. Arraste o primeiro para o lugar certo e os seguintes vão sendo empurrados junto; \u201cPôr aqui\u201d acerta o acorde escolhido com a música tocando.",
    onde: { rotulo: "Gestão Individual → Repertório", caminho: "/gestao/repertorio" },
  },
  {
    id: "2026-11-14-repertorio-aberto",
    data: "2026-11-14",
    titulo: "Repertório aberto para todos",
    texto: "Agora todo mundo vê, toca e edita as músicas e as criações do Repertório, de qualquer login. Cada uma mostra quem criou (e quem editou por último), e só quem criou pode excluir.",
    onde: { rotulo: "Gestão Individual → Repertório", caminho: "/gestao/repertorio" },
  },
  {
    id: "2026-11-14-repertorio-ajustes-notacao",
    data: "2026-11-14",
    titulo: "Repertório: notas com sustenido, Dó Ré Mi e tela mais limpa",
    texto: "As notas agora aparecem com sustenido (C#, F#…) em todo o Repertório, e dá para trocar para bemol ou para Dó, Ré, Mi no novo ícone de ajustes, no canto do player. As opções menos usadas foram para lá, deixando a tela mais limpa.",
    onde: { rotulo: "Gestão Individual → Repertório", caminho: "/gestao/repertorio" },
  },
  {
    id: "2026-11-14-repertorio-pads-e-notas",
    data: "2026-11-14",
    titulo: "Repertório: cifra com pads, notas que tocam e carregando sem travar",
    texto: "A tela de escrever cifra ficou no estilo da aba Criar: arraste os pads dos acordes e solte em cima da sílaba, com uma marca mostrando onde cai. Clicar numa nota do braço ou do mapa do braço toca o som dela. O player ganhou o botão \u201cInstrumento online\u201d e o volume da música (com botão de tirar o som). E o que estiver carregando aparece num aviso no canto, com \u201cCancelar\u201d, sem travar a tela.",
    onde: { rotulo: "Gestão Individual → Repertório", caminho: "/gestao/repertorio" },
  },
  {
    id: "2026-11-14-repertorio-mexer-acordes",
    data: "2026-11-14",
    titulo: "Repertório: escreva a cifra arrastando os acordes",
    texto: "\u201cEscrever cifra\u201d ficou mais simples: cole (ou identifique) a letra e ponha os acordes com o mouse em cima das sílabas, arrastando para o lugar certo. O tempo de cada linha o app acha sozinho e a cifra rola com a música. E clicar no nome do acorde toca o som dele como o instrumento escolhido e acende as notas no braço ou no teclado.",
    onde: { rotulo: "Gestão Individual → Repertório", caminho: "/gestao/repertorio" },
  },
  {
    id: "2026-11-14-repertorio-compartilhar-cifra",
    data: "2026-11-14",
    titulo: "Repertório: compartilhe a cifra",
    texto: "No player, toque em \u201cCompartilhar\u201d para mandar a cifra para quem usa o NordTool (com um recado, se quiser) ou gerar uma imagem bonitinha da cifra para baixar e mandar pelo celular. As cifras que mandarem para você ficam na nova aba \u201cRecebidas\u201d: mude o tom, baixe a imagem ou ponha numa música sua.",
    onde: { rotulo: "Gestão Individual → Repertório → Recebidas", caminho: "/gestao/repertorio?aba=recebidas" },
  },
  {
    id: "2026-11-14-repertorio-identificar-letra",
    data: "2026-11-14",
    titulo: "Repertório: identificar a letra e cifra em cima da sílaba",
    texto: "Em \u201cEscrever cifra\u201d, \u201cIdentificar letra\u201d escuta a música no seu aparelho e escreve a letra com a hora de cada verso. Clique na sílaba e toque no acorde (ou no teclado de acordes) para pôr a cifra em cima dela; clique no acorde para ouvir. Num verso, ouça só ele, gere a cifra do trecho que escolher ou reescreva a letra dele. E agora dá para subir ou descer o tom da cifra, e o braço segue a cifra que você escreveu.",
    onde: { rotulo: "Gestão Individual → Repertório", caminho: "/gestao/repertorio" },
  },
  {
    id: "2026-11-13-repertorio-escrever-cifra",
    data: "2026-11-13",
    titulo: "Repertório: escreva a cifra tocando",
    texto: "No player, \u201cEscrever cifra\u201d: cole a letra, dê play e aperte os acordes do campo harmônico (ou qualquer outro) na hora em que entram; a cifra vai se escrevendo com os acordes em cima da sílaba certa e rola sozinha depois. E em \u201cMostrar\u201d você escolhe ver a cifra e o instrumento, só a cifra ou só o instrumento.",
    onde: { rotulo: "Gestão Individual → Repertório", caminho: "/gestao/repertorio" },
  },
  {
    id: "2026-11-13-sac-pdf-prints",
    data: "2026-11-13",
    titulo: "SAC: vários prints e exportação em PDF",
    texto: "No botão do SAC no canto, adicione até 6 prints ao chamado, desta tela ou de outra, e veja as miniaturas antes de enviar. Quem administra exporta os chamados marcados num PDF caprichado, com o texto de cada um e os prints ao lado.",
    onde: { rotulo: "Visão Geral → SAC", caminho: "/sac" },
  },
  {
    id: "2026-11-13-repertorio-selecionar-copiar",
    data: "2026-11-13",
    titulo: "Criar: um quadradinho por clique e copiar e colar notas",
    texto: "Na aba Criar, o clique na grade agora marca um quadradinho só (arraste para esticar a nota). No modo \u201cSelecionar\u201d, arraste um retângulo sobre as notas para copiar, recortar, colar (inclusive em outra faixa), duplicar, apagar ou mover com as setas. Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+D e Ctrl+A também funcionam.",
    onde: { rotulo: "Gestão Individual → Repertório → Criar", caminho: "/gestao/repertorio?aba=criar" },
  },
  {
    id: "2026-11-13-repertorio-timbres-ferramentas",
    data: "2026-11-13",
    titulo: "Repertório: timbres e ferramentas para tocar",
    texto: "No instrumento online e no estúdio: escolha o timbre (baixo dedo, palheta, slap, fretless; piano, órgão; guitarra limpa ou distorcida; pad, sino; bateria eletrônica), toque no braço do baixo ou do violão, sustente as notas, transponha, destaque uma escala, toque acordes com uma tecla e treine com metrônomo.",
    onde: { rotulo: "Gestão Individual → Repertório → Instrumento online", caminho: "/gestao/repertorio" },
  },
  {
    id: "2026-11-13-repertorio-conta",
    data: "2026-11-13",
    titulo: "Repertório em qualquer aparelho",
    texto: "As músicas do Repertório (com a cifra, os ajustes e a análise) e as criações da aba Criar agora ficam na sua conta: abra no celular o que você subiu no computador. As que já estavam neste aparelho sobem sozinhas (até 15 MB cada).",
    onde: { rotulo: "Gestão Individual → Repertório", caminho: "/gestao/repertorio" },
  },
  {
    id: "2026-11-13-repertorio-criar",
    data: "2026-11-13",
    titulo: "Repertório: instrumento online e aba Criar",
    texto: "Toque baixo, teclado, violão, sintetizador ou bateria direto na tela (ou no teclado do computador) em “Instrumento online”. Na nova aba Criar, monte uma música faixa por faixa: escreva as notas na grade ou grave tocando, com metrônomo, e mande para o player ou baixe em WAV.",
    onde: { rotulo: "Gestão Individual → Repertório → Criar", caminho: "/gestao/repertorio?aba=criar" },
  },
  {
    id: "2026-11-13-repertorio-sintetizador",
    data: "2026-11-13",
    titulo: "Repertório: sintetizador do instrumento",
    texto: "Ligue “Sintetizador” no painel do instrumento: as notas que aparecem (a linha do baixo, os acordes do violão ou do teclado) tocam com som do instrumento junto com a música, no tom e no andamento escolhidos, nas notas caindo e no mapa do braço.",
    onde: { rotulo: "Gestão Individual → Repertório", caminho: "/gestao/repertorio" },
  },
  {
    id: "2026-11-13-repertorio-mapa-braco",
    data: "2026-11-13",
    titulo: "Repertório: mapa do braço com as notas coloridas",
    texto: "No baixo (4 ou 5 cordas) e no violão, toque em “Mapa do braço” para ver o braço em pé com todas as notas, cada uma na cor da letra (C verde, D vermelho, E amarelo…). Tocando a música, a nota da vez acende com um anel e a próxima fica tracejada.",
    onde: { rotulo: "Gestão Individual → Repertório", caminho: "/gestao/repertorio" },
  },
  {
    id: "2026-11-13-caderno-zoom-pdf",
    data: "2026-11-13",
    titulo: "Caderno: zoom de projeto, rodinha do mouse e PDF na barra",
    texto: "No caderno, a rodinha do mouse dá zoom onde está o cursor e vai até 1600%, para ler cotas de prancha; arraste com a rodinha apertada para mover. O botão de inserir PDF agora fica na barra, e escrever num texto não desfaz mais o desenho com Ctrl+Z.",
    onde: { rotulo: "Mapeamentos → Bloco de notas → Caderno", caminho: "/mapeamentos/bloco-notas" },
  },
  {
    id: "2026-11-13-sac-botao-canto",
    data: "2026-11-13",
    titulo: "SAC no canto de todas as telas",
    texto: "Um botãozinho no canto inferior direito abre uma janelinha para falar com o SAC: conte o problema ou a ideia e envie dali mesmo (a tela em que você está vai junto), ou tire um print dela antes de mandar.",
    onde: { rotulo: "Botão do SAC no canto da tela", caminho: "/sac" },
  },
  {
    id: "2026-11-12-planilha-mover-ajustar",
    data: "2026-11-12",
    titulo: "Planilha: mover linhas e colunas e ajustar a largura",
    texto: "Na planilha do bloco de notas, use “Mover” (ou Alt+Shift+setas) para trocar a linha ou coluna selecionada de lugar, com as fórmulas acompanhando. Dois cliques na borda do cabeçalho ajustam a coluna ao texto, e Shift + rodinha do mouse rola para os lados.",
    onde: { rotulo: "Mapeamentos → Bloco de notas → Planilha", caminho: "/mapeamentos/bloco-notas" },
  },
  {
    id: "2026-11-12-cronograma-chat-sem-ia",
    data: "2026-11-12",
    titulo: "Cronograma: chat de demandas sem IA",
    texto: "O “Criar pelo chat” agora monta a demanda na hora, sem IA e sem esperar: entende dias da semana, datas (amanhã, sexta que vem, 20/11), horários, prazo (até dia 15), período (de 15 a 20/12), #tag e uma demanda por linha. Ajustes como “muda para quinta às 10h” continuam valendo.",
    onde: { rotulo: "Organizacional → Cronograma semanal", caminho: "/organizacional/cronograma" },
  },
  {
    id: "2026-11-12-repertorio-todas-notas",
    data: "2026-11-12",
    titulo: "Repertório: todas as notas no braço",
    texto: "Ligue “Todas as notas” no instrumento: o braço (ou o teclado) mostra o nome de cada nota em cinza, e a que está tocando acende na cor da corda. A escolha fica salva neste aparelho.",
    onde: { rotulo: "Gestão Individual → Repertório", caminho: "/gestao/repertorio" },
  },
  {
    id: "2026-11-12-repertorio-nomes-notas",
    data: "2026-11-12",
    titulo: "Repertório: nome das notas e baixo mais limpo",
    texto: "As notas que descem e as que acendem no braço (ou no teclado) agora mostram o nome, igual à cifra (C, G, F#, Bb…), e a casa onde tocar; a próxima já aparece marcada antes de chegar. A linha do baixo ficou mais limpa: a bateria e as notas soltas não viram mais nota (as músicas já enviadas são analisadas de novo ao abrir).",
    onde: { rotulo: "Gestão Individual → Repertório", caminho: "/gestao/repertorio" },
  },
  {
    id: "2026-11-12-repertorio",
    data: "2026-11-12",
    titulo: "Repertório: toque junto com a música",
    texto: "Envie uma música e eu reconheço o tom, o BPM, os acordes e o baixo. Mude o tom e o andamento, separe voz, baixo e bateria e acompanhe a cifra rolando com o baixo, o violão ou o teclado mostrando onde tocar.",
    onde: { rotulo: "Gestão Individual → Repertório", caminho: "/gestao/repertorio" },
  },
  {
    id: "2026-11-11-relatorio-sem-contorno",
    data: "2026-11-11",
    titulo: "Relatório: fotos sem contorno",
    texto: "No PDF do relatório fotográfico as fotos não têm mais a linha cinza em volta; o tamanho delas continua o mesmo.",
    onde: { rotulo: "Mapeamentos → Relatório fotográfico", caminho: "/mapeamentos/relatorio-fotografico" },
  },
  {
    id: "2026-11-11-editor-imagens-varinha",
    data: "2026-11-11",
    titulo: "Editor de imagens: varinha mágica",
    texto: "Toque numa cor e a varinha seleciona sozinha a área parecida. Para tirar o fundo de uma foto, toque no fundo e em “Apagar”, ou toque no objeto e em “Apagar o resto”, e baixe em PNG.",
    onde: { rotulo: "Mapeamentos → Bloco de notas → Editar imagem", caminho: "/mapeamentos/bloco-notas" },
  },
  {
    id: "2026-11-11-cronograma-periodo",
    data: "2026-11-11",
    titulo: "Cronograma: atividade de vários dias",
    texto: "Agora a demanda tem dia de início e dia de fim e aparece na Rotina em todos os dias do período. Na Rotina, toque em “Selecionar dias” e depois no primeiro e no último dia no calendário.",
    onde: { rotulo: "Organizacional → Cronograma semanal → Rotina", caminho: "/organizacional/cronograma" },
  },
  {
    id: "2026-11-11-relatorio-trocar-modelo",
    data: "2026-11-11",
    titulo: "Relatório: trocar o modelo depois",
    texto: "No relatório fotográfico, toque no nome do modelo (com o lápis) para trocar por outro ou ficar sem modelo. Dá para trazer os itens que faltam e o layout do modelo novo, sem perder nada do que já foi preenchido.",
    onde: { rotulo: "Mapeamentos → Relatório fotográfico", caminho: "/mapeamentos/relatorio-fotografico" },
  },
  {
    id: "2026-11-11-planilha-em-portugues",
    data: "2026-11-11",
    titulo: "Planilha em português, com mais funções",
    texto: "As fórmulas agora têm nome em português, como no Google Sheets (=SOMA, =PROCV, =CONT.SE…), com ; e vírgula nos números, e chegaram PROCX, UNIRTEXTO, MÁXIMOSES e MÍNIMOSES. Datas em dd/mm/aaaa, números com vírgula e todos os menus em português.",
    onde: { rotulo: "Mapeamentos → Bloco de notas → Planilha", caminho: "/mapeamentos/bloco-notas" },
  },
  {
    id: "2026-11-10-novidades-com-avatar",
    data: "2026-11-10",
    titulo: "Novidades com a cara do chefe",
    texto: "Quem conta as novidades agora é o avatar do dono do NordTool, às vezes com um cafezinho na mão e às vezes com o rádio. Toque nele no canto da tela inicial para ver as últimas atualizações.",
    onde: { rotulo: "Tela inicial", caminho: "/" },
  },
  {
    id: "2026-11-10-chat-dos-cadernos",
    data: "2026-11-10",
    titulo: "Lugia nos cadernos",
    texto: "No Bloco de notas, “Perguntar à Lugia” procura nos seus cadernos, planilhas e documentos, lê fotos e PDFs que você mandar e cria planilha, documento ou página nova. Ela mostra o que vai fazer e só faz quando você toca em “Fazer”.",
    onde: { rotulo: "Mapeamentos → Bloco de notas", caminho: "/mapeamentos/bloco-notas" },
  },
  {
    id: "2026-11-10-avatar-feminino",
    data: "2026-11-10",
    titulo: "Avatar: versão feminina",
    texto: "Em Meu avatar, escolha traços femininos (cílios, bochechas rosadas e blusa com decote), batom, cabelos novos (longo com franja, cachos longos, maria-chiquinha) e enfeites: argolas, pérolas, laço, tiara e flor.",
    onde: { rotulo: "Configurações → Meu avatar", caminho: "/conta/avatar" },
  },
  {
    id: "2026-11-10-meus-dados",
    data: "2026-11-10",
    titulo: "Meus dados: cada um cuida dos seus",
    texto: "Em Configurações → Meus dados, cada pessoa preenche e altera o próprio nome, celular e empresa. O cargo continua com o administrador, porque é ele que dá os acessos.",
    onde: { rotulo: "Configurações → Meus dados", caminho: "/conta/dados" },
  },
  {
    id: "2026-11-10-editor-imagens",
    data: "2026-11-10",
    titulo: "Editor de imagens, como o Paint.net",
    texto: "No bloco de notas, “Editar imagem” abre um editor com camadas, pincel, formas, texto, balde de tinta, recorte, girar, redimensionar e ajustes de cor. As fotos do relatório fotográfico e as imagens das placas abrem nele pelo botão do pincel.",
    onde: { rotulo: "Mapeamentos → Bloco de notas", caminho: "/mapeamentos/bloco-notas" },
  },
  {
    id: "2026-11-10-conversor-arquivos",
    data: "2026-11-10",
    titulo: "Converter arquivos, como no ILovePDF",
    texto: "No bloco de notas, “Converter” junta, divide e organiza PDFs, transforma imagem, Word e Excel em PDF, PDF em imagem, comprime, numera páginas, põe marca d'água e troca o formato de imagens, tudo no seu aparelho.",
    onde: { rotulo: "Mapeamentos → Bloco de notas", caminho: "/mapeamentos/bloco-notas" },
  },
  {
    id: "2026-11-10-bloco-notas-planilhas",
    data: "2026-11-10",
    titulo: "Bloco de notas: planilhas e documentos",
    texto: "O bloco de notas virou a central dos seus arquivos: além dos cadernos, crie planilhas como no Google Sheets (fórmulas, abas, formatação, filtro, Excel) e documentos como no Word. Excel e Word abertos ali viram planilha e documento.",
    onde: { rotulo: "Mapeamentos → Bloco de notas", caminho: "/mapeamentos/bloco-notas" },
  },
  {
    id: "2026-11-10-menu-favoritos",
    data: "2026-11-10",
    titulo: "Menu: marque as telas que você mais usa",
    texto: "Toque no tijolo ao lado de qualquer tela do menu e ela vai para o grupo Favoritos, no topo. Os favoritos valem no celular e no computador; toque no tijolo de novo para tirar.",
  },
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
