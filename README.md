## Nord Tool (frontend)

React 19 · Vite · Tailwind · TypeScript. Módulos: Apartamentos (termos de reprova, fotos, PDF lado a lado), Controle de chaves,
Cronograma semanal, Casamento, Caixinha e Financeiro (Gestão Individual: dashboard do mês, extrato e investimentos).

### Rodando
```
npm install
npm run dev      # servidor de desenvolvimento
npm run build    # tsc -b && vite build
npm run lint
npm test         # testes das funções puras (node --test)
```

### Configuração da API

A URL base da API vem de `VITE_API_BASE_URL`, **obrigatória no build** (`vite.config.ts` falha sem ela, para um build de produção nunca
apontar para o backend errado). Em `npm run dev`, sem a variável, o app usa o proxy do Vite (`/api` → `localhost:8081`).

Para desenvolvimento local, crie `.env.local` (não commitado):
```
VITE_API_BASE_URL=http://localhost:8081/api/v1/nord-tool
```

A Lugia (chat com Claude, ChatGPT e Gemini e o agente que executa pedidos) fica no backend, em `<API>/lugia`;
`VITE_LUGIA_BASE_URL` só é preciso para apontar para outro servidor. A tela exige a permissão `LUGIA` (Administração → Acessos);
o modo "Executar no NordTool" aparece para quem tem `ADMIN` no módulo e com o agente configurado no backend.

Todas as chamadas à API passam por `src/react-app/services/apiClient.ts` (`apiFetch` / `apiBlob`), que envia o token JWT e um
`X-Request-Id`, e lança `ApiError` (com `status` e `cdErro`; ex.: 409 = conflito de versão). Em erro 500 a mensagem traz o código
de correlação, o mesmo do log do backend.

### Pipeline e deploy no Railway
O `.github/workflows/pipeline.yml` faz uma checagem leve nos PRs para `develop` (Lint, Build & Testes e Secret Scanning), que
precisa passar antes do merge. A cada merge em `develop` (ou manualmente) roda o pipeline completo: as mesmas etapas, Análise de
Vulnerabilidades (`npm audit`, só alerta) e Container Image (build do `dockerfile` + Trivy, só alerta). O Resumo de Alertas junta
tudo e o job CD publica no Railway (`railway up`) só se as etapas bloqueantes passarem. O build no Railway continua usando as
variáveis do serviço (`VITE_API_BASE_URL` etc.).

No environment `develop` do GitHub (Settings → Environments, só a branch `develop` liberada): secret `RAILWAY_TOKEN` (Project Token
do ambiente `develop` no Railway) e variável `RAILWAY_SERVICE` = `nord_tool_frontend`. No serviço do Railway, o auto-deploy pelo
GitHub fica **desligado** (Settings → Source → Disable); senão ele publica sem esperar o pipeline e pede aprovação para commits de
quem não é membro do projeto.

### Login e sessão
- `/login` é a única tela pública; as demais ficam dentro de `RotaProtegida` (sem sessão → login, voltando à tela pedida).
- `components/AuthProvider.tsx` guarda a sessão em `sessionStorage` (por aba), renova o token 2 min antes de expirar se houve
  atividade e encerra a sessão quando a API responde 401 (token expirado ou revogado). Regras puras em `utils/sessao.ts`.
- O menu e as telas seguem as permissões efetivas devolvidas pelo login (`useAuth().pode(modulo, acao)`); quem decide de verdade é
  o backend (403).
- `/conta/senha` troca a senha (10 caracteres a 72 bytes); o backend encerra as outras sessões e devolve um token novo.
- O build injeta uma Content-Security-Policy (só scripts próprios; `connect-src` com a origem da API).

### Convenções
- Toda entrega visível acrescenta uma entrada no topo de `src/react-app/utils/novidades.ts`: o mascote Lugia Nexus anuncia na tela inicial o que mudou e onde ver (regra em `nord-center-infra-agent/policies/novidades.md`).
- Serviços em `src/react-app/services`, regras puras em `src/react-app/utils` (cada uma com `*.test.ts`, listado no script `test` do `package.json`).
- Tabelas usam o filtro padrão `ColumnFilter` + `useFiltrosColuna`.
- Financeiro: `pages/Financeiro.tsx` (abas Dashboard, Extrato e Investimentos em `components/financeiro/`); regras puras em `utils/financeiro*.ts` e `utils/investimentos.ts`. Gráfico da fatura é SVG próprio (sem biblioteca). Atalhos: `N` novo lançamento (Extrato), `←`/`→`/`T` meses (Dashboard). Exige o módulo `FINANCEIRO` no perfil (403 mostra aviso).
- Casamento e Caixinha usam atualização otimista com rollback (`useSincronizacao` / `executarOtimista`).
- Arquivos protegidos (PDF/imagem) são baixados com token e abertos via `abrirArquivoAutenticado` ou `ImagemAutenticada`.

### Documentos
- `docs/QA_E_VIRADA.md`: roteiro de QA, inventário do que ainda vive só no Lugia e plano de virada.
- Banco de dados e migrações de dados: repositório `nord-tool-scripts-sql`. Backend: `nord-tool-backend` (README com variáveis de ambiente).
