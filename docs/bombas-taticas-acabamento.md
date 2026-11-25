# Bombas Táticas v27

Melhoria da feature Games, branch `feature-games-v27`. O Nord Games abre o jogo; configurações do Bombas ficam no menu do próprio jogo. Os demais jogos preservam seus menus e regras.

## Entrega

- Menu próprio: campanha, continuar checkpoint, batalha, opções de arena/bots/dificuldade/vitórias/Copa e controles, conexão de celulares.
- Campanha cooperativa original A última centelha: nove fases em três regiões, três chefes, portal após derrotar inimigos, conclusão e checkpoint local. Inicia com três vidas extras compartilhadas; nova fase e 3.000 pontos dão uma reserva.
- Start permite entrar durante a fase por uma vida extra. Novos celulares recebem a configuração atual e ocupam uma vaga reservada; gamepads adicionais são detectados. Reconectar alguém que já joga não consome outra vida.
- Monstros: patrulha, caçador, saltador e cauteloso, com silhuetas e comportamentos diferentes. Chefes têm identidade de região, vida, ataques com pavio, lentidão de gelo ou bombas radiais.
- Ovos escondidos nas caixas viram montarias originais: Brasa arremessa uma bomba com B, Vento dispara com recarga e Pedra ativa proteção temporária. Cada montaria absorve um golpe, conserva o piloto vivo e desaparece; respeita colisões e não empilha ovos.
- Competitivo com revanche nas bordas: depois de cair, move o carrinho e lança com A; B muda a distância. Eliminar rival com essa bomba permite retornar com proteção curta. Escudo e aliado não dão retorno; morte súbita encerra a revanche.
- Arena 3D, avatar articulado, caminhada por distância real também no fallback 2D, placar/objetivos, três biomas, pavio/dono da bomba e aviso de impacto na morte súbita.
- Diagonal normalizada do joystick até a simulação, incluindo sala e gamepads; sair da bomba não trava na transição entre casas. Bots decidem no centro das casas e fogem após plantar.
- Solo tem meta garantida de moedas, vitória imediata e uma tentativa encerra a partida.

## Compatibilidade e decisões

Nenhuma dependência nova, arquivo de mídia ou serviço pago. Toda arte e som continuam gerados por código. Não são usados personagens ou recursos de jogos comerciais. A simulação é determinística a 60 Hz. Montarias, inimigos, vidas, revanche e fase estão no estado do espelho; itens escondidos permanecem privados do anfitrião. O backend continua transportando dados da entrada sem alterar sua API ou banco.

A moldura tem extensões opcionais para Start, vitória cooperativa e fim definitivo; os padrões dos demais jogos continuam iguais. O único cadastro de catálogo alterado é o Bombas. Os eixos opcionais preservam a direção cardinal dos outros jogos e mensagens antigas.

## Verificação e limites

Testes das regras incluem: entrada por uma vida sem reiniciar, falta de vida e reconexão, progressão/portal/final, tipos de monstros, ovos/habilidades/proteção/recarga/colisão, revanche/escudo/retorno, saída de bomba, diagonal, caminhada e metadados da sala. Build, lint e suíte completa são executados antes do merge; os resultados finais estão no PR e no pipeline.

Arena e campanha foram observadas no navegador local usando os mesmos componentes do produto. `qa/` é apenas entrada do servidor de desenvolvimento, não um segundo jogo nem rota publicada. O teste local do controle usa BroadcastChannel e não substitui homologação de WebSocket/WebRTC com aparelhos físicos. A conexão do navegador foi interrompida durante a conferência final; não afirmar homologação física ou qualidade comercial certificada. A publicação deve passar pelo pipeline de develop; não publicar diretamente no Railway ignorando os checks.
