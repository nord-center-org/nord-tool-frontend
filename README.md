## Nord Tool

To run the devserver:
```
npm install
npm run dev
```

### Configuração da API

A URL base da API vem de `VITE_API_BASE_URL`. Sem a variável, o app usa o backend publicado no Railway (fallback em `src/react-app/config/api.ts`).

Para desenvolvimento local, crie `.env.local` (não commitado):
```
VITE_API_BASE_URL=http://localhost:8081/api/v1/nord-tool
```

Todas as chamadas à API passam por `src/react-app/services/apiClient.ts` (`apiFetch` / `apiBlob`).

### Login e publicação

O app inteiro exige login (`/login`). O token (JWT) fica em memória e `sessionStorage`, é renovado enquanto há atividade e a sessão cai após o tempo de inatividade configurado no backend (padrão 30 min).

Variáveis do backend: `NORD_SECURITY_ENABLED`, `NORD_JWT_SECRET`, `NORD_ADMIN_EMAIL`, `NORD_ADMIN_NAME`, `NORD_ADMIN_PASSWORD`.

**Ordem de publicação em produção**
1. Backend com `NORD_SECURITY_ENABLED=false` e as variáveis do admin (após aplicar `db/scripts/001_auth.sql`).
2. Frontend com a tela de login.
3. Logar uma vez para conferir.
4. Mudar `NORD_SECURITY_ENABLED=true`.
