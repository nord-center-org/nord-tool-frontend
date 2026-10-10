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

Todas as chamadas à API passam por `src/react-app/services/apiClient.ts` (`apiFetch` / `apiBlob`), que envia o token JWT e um
`X-Request-Id`, e lança `ApiError` (com `status` e `cdErro`; ex.: 409 = conflito de versão). Em erro 500 a mensagem traz o código
de correlação, o mesmo do log do backend.

### Login e sessão
- `/login` é a única tela pública; as demais ficam dentro de `RotaProtegida` (sem sessão → login, voltando à tela pedida).
- `components/AuthProvider.tsx` guarda a sessão em `sessionStorage` (por aba), renova o token 2 min antes de expirar se houve
  atividade e encerra a sessão quando a API responde 401 (token expirado ou revogado). Regras puras em `utils/sessao.ts`.
- O menu e as telas seguem as permissões efetivas devolvidas pelo login (`useAuth().pode(modulo, acao)`); quem decide de verdade é
  o backend (403).
- `/conta/senha` troca a senha (10 caracteres a 72 bytes); o backend encerra as outras sessões e devolve um token novo.
- O build injeta uma Content-Security-Policy (só scripts próprios; `connect-src` com a origem da API).

### Convenções
- Serviços em `src/react-app/services`, regras puras em `src/react-app/utils` (cada uma com `*.test.ts`, listado no script `test` do `package.json`).
- Tabelas usam o filtro padrão `ColumnFilter` + `useFiltrosColuna`.
- Financeiro: `pages/Financeiro.tsx` (abas Dashboard, Extrato e Investimentos em `components/financeiro/`); regras puras em `utils/financeiro*.ts` e `utils/investimentos.ts`. Gráfico da fatura é SVG próprio (sem biblioteca). Atalhos: `N` novo lançamento (Extrato), `←`/`→`/`T` meses (Dashboard). Exige o módulo `FINANCEIRO` no perfil (403 mostra aviso).
- Casamento e Caixinha usam atualização otimista com rollback (`useSincronizacao` / `executarOtimista`).
- Arquivos protegidos (PDF/imagem) são baixados com token e abertos via `abrirArquivoAutenticado` ou `ImagemAutenticada`.

### Documentos
- `docs/QA_E_VIRADA.md`: roteiro de QA, inventário do que ainda vive só no Lugia e plano de virada.
- Banco de dados e migrações de dados: repositório `nord-tool-scripts-sql`. Backend: `nord-tool-backend` (README com variáveis de ambiente).
