# QA geral, inventário do Lugia e virada (E24)

Estado em **06/10/2026**. Legenda: ✅ verificado (teste automatizado ou navegador com API simulada) · 🔶 depende de ambiente real/pessoa (não verificado) · ⛔ pendência.

## 1. Roteiro de QA

> O que pude fazer sem o Railway e sem celular está marcado ✅. Tudo o que depende do backend publicado, de login real ou de aparelho está 🔶 e precisa ser executado e assinado pelo Nicolas.

| # | Item | Situação | Como foi / como fazer |
|---|---|---|---|
| 1 | Login, logout e expiração por inatividade | 🔶 | Backend ✅ (testes JWT/SecurityConfig). Tela de login (E05, PR frontend #57) **ainda não mesclada**: falta a configuração do Railway. Roteiro: entrar, recarregar, ficar parado > 30 min, sair. |
| 2 | Todas as rotas da API exigem token | ✅ | `VarreduraRotasSemTokenTest` percorre todas as rotas dos controllers (arquivos, fotos e PDFs inclusos) e exige 401. Só `POST /auth/login` e `GET /nord-tool/health` são públicas. Repetir uma vez contra o Railway após ligar `NORD_SECURITY_ENABLED=true`. |
| 3 | Telas existentes após o login (Home, Entregas, Apartamentos, Dashboard, Controle de chaves, Cronograma, Configurações) | 🔶 | Build/lint/testes ✅; navegação autenticada só após o item 1. |
| 4 | Apartamentos: filtros, modal, termos, fotos | ✅/🔶 | Filtros, modal e termos testados em navegador (mocks) nas etapas E03/E09/E10; **fotos de celular iOS/Android e PDF lado a lado aberto no celular: 🔶** (exigem aparelho real). |
| 5 | Casamento completo (Dashboard, Fornecedores, Convidados, Marcos) | ✅ | Testado em navegador com API simulada em cada etapa (otimista/rollback, filtros, modais). **Contra o backend real: 🔶.** |
| 6 | Importação de convidados (.xlsx) | ✅/🔶 | Backend: testes do handler; frontend: relatório de rejeitados em navegador (mock). Rodar uma planilha de ~50 linhas no dev: 🔶. |
| 7 | Anexos de fornecedor | ✅/🔶 | Listar/abrir/excluir em mock e testes de serviço; anexar um arquivo real no dev: 🔶. |
| 8 | Caixinha completa (lançamentos, marcações, conflito 409, comprovantes PDF, exportação) | ✅/🔶 | 409 em marcação e exclusão, idempotência de criação e fila de comprovantes verificados em navegador (mock com versões) e em testes do backend (226 passando). **Exportação XLSX** só coberta por teste das linhas; baixar o arquivo e abrir no Excel: 🔶. Segundo navegador editando a mesma linha contra o backend real: 🔶. |
| 9 | Exportar tudo do Casamento (backup em planilha) | ✅/🔶 | Montagem das abas coberta por teste; botão no cabeçalho do Casamento. Baixar e abrir o arquivo: 🔶. |
| 10 | Backup do Postgres | ⛔ | Rotina de backup no Railway **não configurada por mim** (acesso é seu). Ver seção 3. |

## 2. Desempenho e capacidade (a medir no ambiente real)

Nada disto pôde ser medido sem o ambiente publicado; fica como roteiro:

- Tamanho do banco com ~50 apartamentos com fotos (`SELECT pg_size_pretty(pg_database_size(current_database()))` e por tabela `arquivo_armazenado`).
- Memória do backend (`-Xmx512m`) com 3 uploads simultâneos de PDF de 15 MB.
- Tempo de gerar o PDF lado a lado com 20 fotos (roda no navegador).
- Limites vigentes: termo 15 MB / **80 páginas**, imagens 5 MB, contratos do casamento 15 MB, comprovantes da Caixinha 5 MB; multipart 50 MB.

## 3. Segurança e operação

- ✅ Rotas protegidas (item 2 acima). ✅ Sem segredos reais no código (revisado): só as senhas do banco de **desenvolvimento local** em arquivos de exemplo.
- 🔶 Variáveis no Railway: `NORD_JWT_SECRET`, `NORD_ADMIN_*` (primeiro acesso), depois `NORD_SECURITY_ENABLED=true`.
- ⛔ **Remover `NORD_ADMIN_PASSWORD`** (e `NORD_ADMIN_*`) do Railway após o primeiro login.
- ⛔ Backup do Postgres no Railway (snapshots/`pg_dump` agendado) e teste de restauração.
- Dados pessoais/financeiros (Casamento, Caixinha, contratos, comprovantes) saem com `Cache-Control: no-store`.

## 4. Inventário do que ainda vive só no Lugia

| Módulo do Lugia | Já migrado? | O que falta | Plano |
|---|---|---|---|
| **Casamento** | Módulo ✅ (E13–E18). Dados: scripts prontos (E19), **não executados** | CSVs da planilha `Wedding Day - *` e conferir a ordem das colunas; rodar no dev; conferir totais | Nicolas exporta os CSVs → rodar `MIGRACAO/casamento/` no dev → comparar a conferência com o Lugia → repetir em produção |
| **Caixinha** | Módulo ✅ (E20–E22). Dados: scripts prontos (E23), **não executados** | CSV da aba `Caixinha - Lançamentos`; **decisão sobre os PDFs antigos do Drive (a/b/c, não decidida)** | Idem; registrar a decisão no `MIGRACAO/caixinha/README.md` |
| **ContrlKey** (chaves/ferramentas/colaboradores/requisições) | Módulo já existia no NordTool; existe importação histórica (`DML/03.importacao_historica_controle_chaves_dml.sql`) | **Confirmar com o Nicolas** se os dados atuais do Lugia já foram para o NordTool | Comparar contagens (chaves, ferramentas, colaboradores, requisições abertas) entre Lugia e NordTool |
| **Entrega DAT** | Termos/fotos novos já funcionam no NordTool (E07–E12) | Termos e fotos já anexados no Lugia (Google Drive) **não** foram migrados | **Perguntar ao Nicolas**: trazer o histórico (script que baixe do Drive e envie pela API de termos) ou deixar o histórico só no Lugia/Drive |
| **Demandas** | Já implementado como **Cronograma semanal** (`pages/Cronograma_semanal.tsx`; data/prazo agora também aparece na Rotina) | Conferir se as demandas atuais da aba `Demandas - Registros` (título, detalhe, categoria, status, prazo, tag, notas, responsável) já estão no Cronograma e se falta alguma função | **Perguntar ao Nicolas**; se houver demandas só no Lugia, registrar como pendência de **migração de dados** (não de módulo) |

**O Lugia só deve ser desligado quando todas as linhas acima estiverem sem pendência.**

## 5. Virada do Casamento e da Caixinha (sequência)

1. Congelar edições no Lugia.
2. Rodar `MIGRACAO/casamento/` e `MIGRACAO/caixinha/` (repositório `nord-tool-scripts-sql`) no dev e conferir (diferença 0).
3. Repetir em produção; comparar com a tela do Lugia.
4. Ocultar os módulos "Casamento" e "Caixinha" nas Configurações gerais do Lugia (mantém os dados como backup).
5. Exportar tudo (planilhas) como backup inicial.

## 6. Pendências abertas (resumo)

- ⛔ PR frontend #57 (login) aguardando a configuração do Railway; depois ligar `NORD_SECURITY_ENABLED=true` e remover `NORD_ADMIN_*`.
- ⛔ CSVs do Lugia (Casamento e Caixinha) + confirmação da ordem das colunas.
- ⛔ Decisão sobre os PDFs antigos da Caixinha e sobre o histórico da Entrega DAT.
- ⛔ Backup do Postgres no Railway.
- 🔶 Roteiro de QA em aparelho real (fotos iOS/Android, PDF no celular) e medições da seção 2.
- Assinatura do Nicolas no checklist final.
