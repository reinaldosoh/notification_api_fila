# Webhook Queue API

Substituto simples e auto-hospedado para o fluxo de webhooks do n8n, feito pra rodar no EasyPanel.

- Você **cria um webhook via API** (uma requisição só) → recebe uma URL pública tipo `https://seu-dominio.com/w/abc123`.
- Coloca essa URL na **machine** (ou em qualquer serviço que envie eventos).
- Cada evento que chega é **enfileirado** e **processado 1 por vez por webhook** (FIFO), depois encaminhado para o **destino configurado** (ex.: seu Supabase Edge Function / Postgrest).
- Cidades diferentes têm **filas independentes**, rodando em paralelo entre si — você não precisa mais duplicar fluxo por cidade no n8n.
- Tem **dashboard visual** em `/admin/queues` (Bull Board) com histórico, retries e jobs em tempo real, parecido com a tela de executions do n8n.

---

## Stack

- Node.js 20 + TypeScript + Fastify
- BullMQ + Redis (fila com retry exponencial)
- Postgres (config dos webhooks + histórico de entregas)
- Docker + docker-compose (pronto pra EasyPanel)

## Arquitetura

```
Machine ──POST──► /w/:id ──► Postgres (delivery queued)
                              │
                              ▼
                       BullMQ (1 fila por webhook, concurrency=1)
                              │
                              ▼
                       Worker ── POST ──► destination_url (Supabase, etc)
                              │
                              ▼
                       Postgres (delivery succeeded/failed)
```

---

## Rodando local

```bash
cp .env.example .env      # edite API_KEY e ADMIN_PASSWORD
docker compose up -d
```

A API fica em `http://localhost:3000`.
O dashboard em `http://localhost:3000/admin/queues` (login: `admin` / `ADMIN_PASSWORD`).

---

## Deploy no EasyPanel

1. Crie um novo projeto no EasyPanel.
2. Adicione três serviços:
   - **Postgres** (template nativo do EasyPanel) — anote user/pass/host.
   - **Redis** (template nativo do EasyPanel).
   - **App** apontando para este repositório (Build: Dockerfile).
3. No serviço App, configure as variáveis de ambiente (copie do `.env.example`):
   - `API_KEY` → gere uma chave forte (`openssl rand -hex 32`).
   - `ADMIN_PASSWORD` → senha do dashboard de filas.
   - `PUBLIC_BASE_URL` → URL pública do app (ex.: `https://webhook.seudominio.com`).
   - `DATABASE_URL` → string do Postgres do EasyPanel.
   - `REDIS_URL` → `redis://NOME_DO_SERVICO_REDIS:6379`.
4. Configure um domínio no App e ative HTTPS.
5. Deploy. A migração roda automaticamente no start do container.

---

## API

### Autenticação

- Rotas administrativas (`/admin/*`) exigem header `X-API-Key: <sua API_KEY>`.
- Rota pública de ingestão (`POST /w/:id`) não exige auth (o próprio ID aleatório funciona como token).
- Dashboard (`/admin/queues`) usa Basic Auth com `ADMIN_USER` / `ADMIN_PASSWORD`.

### Criar webhook

```bash
curl -X POST https://seu-dominio.com/admin/webhooks \
  -H "X-API-Key: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cidade São Paulo",
    "destination_url": "https://xxx.supabase.co/functions/v1/ingest-corridas",
    "destination_headers": {
      "Authorization": "Bearer SEU_TOKEN_SUPABASE"
    }
  }'
```

Resposta:

```json
{
  "id": "V1StGXR8_Z5jdHi6",
  "name": "Cidade São Paulo",
  "destination_url": "https://xxx.supabase.co/functions/v1/ingest-corridas",
  "active": true,
  "webhook_url": "https://seu-dominio.com/w/V1StGXR8_Z5jdHi6"
}
```

Pegue o `webhook_url` e configure na machine.

### Listar webhooks

```bash
curl https://seu-dominio.com/admin/webhooks -H "X-API-Key: SUA_API_KEY"
```

### Atualizar / ativar / desativar

```bash
curl -X PATCH https://seu-dominio.com/admin/webhooks/V1StGXR8_Z5jdHi6 \
  -H "X-API-Key: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "active": false }'
```

### Deletar

```bash
curl -X DELETE https://seu-dominio.com/admin/webhooks/V1StGXR8_Z5jdHi6 \
  -H "X-API-Key: SUA_API_KEY"
```

### Histórico de entregas (igual à tela de executions do n8n)

```bash
curl "https://seu-dominio.com/admin/webhooks/V1StGXR8_Z5jdHi6/deliveries?limit=50" \
  -H "X-API-Key: SUA_API_KEY"
```

Filtrar por status:

```bash
curl "https://seu-dominio.com/admin/webhooks/V1StGXR8_Z5jdHi6/deliveries?status=failed" \
  -H "X-API-Key: SUA_API_KEY"
```

### Detalhe de uma entrega

```bash
curl https://seu-dominio.com/admin/deliveries/42 \
  -H "X-API-Key: SUA_API_KEY"
```

### Ingestão (a machine chama aqui)

```
POST https://seu-dominio.com/w/V1StGXR8_Z5jdHi6
Content-Type: application/json

{ "events": [...] }
```

A API responde `202 Accepted` na hora e processa em background.

---

## Como funciona a fila

- Cada webhook tem **sua própria fila Redis** (`wh:<id>`).
- Cada fila tem **concurrency = 1** → processa um evento por vez **daquele** webhook.
- Filas de webhooks diferentes rodam **em paralelo** entre si.
- Se a entrega falhar (destino retornou erro, timeout, etc):
  - Retry com backoff exponencial (2s, 4s, 8s, 16s, 32s por padrão).
  - Máximo de tentativas configurável via `DELIVERY_MAX_ATTEMPTS` (padrão 5).
  - Depois disso a entrega fica marcada como `failed` no Postgres e visível no dashboard.

---

## Variáveis de ambiente

Veja `.env.example`. Principais:

| Nome | Descrição |
|------|-----------|
| `PUBLIC_BASE_URL` | URL pública da API (usada para montar `webhook_url`) |
| `API_KEY` | Chave para rotas `/admin/*` |
| `ADMIN_USER` / `ADMIN_PASSWORD` | Login do dashboard Bull Board |
| `DATABASE_URL` | String de conexão Postgres |
| `REDIS_URL` | String de conexão Redis |
| `DELIVERY_TIMEOUT_MS` | Timeout por tentativa de entrega |
| `DELIVERY_MAX_ATTEMPTS` | Quantas vezes tentar entregar antes de marcar como falha |
