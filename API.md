# API Reference — Webhook Queue API

Base URL: `https://reinaldo-api.sw5bxa.easypanel.host`

---

## Autenticação

### Rotas administrativas (`/admin/*`)

Todas exigem o header:

```
X-API-Key: 5eb861539ba7b10877830791f3bd7a1afc8f2d94fee57919f4b18be74a4fbc48
```

### Rota de ingestão (`/w/:id`)

**Pública**. O próprio ID do webhook (gerado aleatoriamente) funciona como token.

### Dashboard (`/admin/queues`)

Basic Auth:
- Usuário: `admin`
- Senha: `qSlgEavq10MfltBzbeY0aoGc6KNQ4`

---

## 1. Criar webhook

```bash
curl -X POST https://reinaldo-api.sw5bxa.easypanel.host/admin/webhooks \
  -H "X-API-Key: 5eb861539ba7b10877830791f3bd7a1afc8f2d94fee57919f4b18be74a4fbc48" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cidade São Paulo",
    "destination_url": "https://xxx.supabase.co/functions/v1/eventos",
    "destination_headers": {
      "Authorization": "Bearer SEU_TOKEN_SUPABASE"
    }
  }'
```

**Resposta `201`:**

```json
{
  "id": "V1StGXR8_Z5jdHi6",
  "name": "Cidade São Paulo",
  "destination_url": "https://xxx.supabase.co/functions/v1/eventos",
  "destination_headers": { "Authorization": "Bearer ..." },
  "active": true,
  "created_at": "2026-04-20T22:00:00.000Z",
  "updated_at": "2026-04-20T22:00:00.000Z",
  "webhook_url": "https://reinaldo-api.sw5bxa.easypanel.host/w/V1StGXR8_Z5jdHi6"
}
```

**Campos:**
| Campo | Obrigatório | Descrição |
|---|---|---|
| `name` | sim | Nome da cidade/webhook |
| `destination_url` | sim | URL que receberá os eventos (ex.: sua Edge Function do Supabase) |
| `destination_headers` | não | Headers HTTP extras enviados ao destino (ex.: Authorization) |
| `active` | não | `true` (padrão) ou `false` para criar desativado |

---

## 2. Listar webhooks

```bash
curl https://reinaldo-api.sw5bxa.easypanel.host/admin/webhooks \
  -H "X-API-Key: 5eb861539ba7b10877830791f3bd7a1afc8f2d94fee57919f4b18be74a4fbc48"
```

Retorna array com todos os webhooks + `webhook_url`.

---

## 3. Detalhar um webhook

```bash
curl https://reinaldo-api.sw5bxa.easypanel.host/admin/webhooks/ID_AQUI \
  -H "X-API-Key: 5eb861539ba7b10877830791f3bd7a1afc8f2d94fee57919f4b18be74a4fbc48"
```

---

## 4. Atualizar webhook (PATCH)

Pode atualizar qualquer campo individualmente. Campos não enviados permanecem iguais.

### Mudar nome

```bash
curl -X PATCH https://reinaldo-api.sw5bxa.easypanel.host/admin/webhooks/ID_AQUI \
  -H "X-API-Key: 5eb861539ba7b10877830791f3bd7a1afc8f2d94fee57919f4b18be74a4fbc48" \
  -H "Content-Type: application/json" \
  -d '{"name":"Cidade Rio de Janeiro"}'
```

### Mudar URL de destino

```bash
curl -X PATCH https://reinaldo-api.sw5bxa.easypanel.host/admin/webhooks/ID_AQUI \
  -H "X-API-Key: 5eb861539ba7b10877830791f3bd7a1afc8f2d94fee57919f4b18be74a4fbc48" \
  -H "Content-Type: application/json" \
  -d '{"destination_url":"https://novo-destino.com/hook"}'
```

### Atualizar headers enviados ao destino

```bash
curl -X PATCH https://reinaldo-api.sw5bxa.easypanel.host/admin/webhooks/ID_AQUI \
  -H "X-API-Key: 5eb861539ba7b10877830791f3bd7a1afc8f2d94fee57919f4b18be74a4fbc48" \
  -H "Content-Type: application/json" \
  -d '{"destination_headers":{"Authorization":"Bearer NOVO_TOKEN","X-Tenant":"spo"}}'
```

### Desativar webhook (para de processar eventos, mas mantém histórico)

```bash
curl -X PATCH https://reinaldo-api.sw5bxa.easypanel.host/admin/webhooks/ID_AQUI \
  -H "X-API-Key: 5eb861539ba7b10877830791f3bd7a1afc8f2d94fee57919f4b18be74a4fbc48" \
  -H "Content-Type: application/json" \
  -d '{"active":false}'
```

### Reativar webhook

```bash
curl -X PATCH https://reinaldo-api.sw5bxa.easypanel.host/admin/webhooks/ID_AQUI \
  -H "X-API-Key: 5eb861539ba7b10877830791f3bd7a1afc8f2d94fee57919f4b18be74a4fbc48" \
  -H "Content-Type: application/json" \
  -d '{"active":true}'
```

---

## 5. Deletar webhook

Apaga o webhook, remove a fila, apaga histórico de entregas.

```bash
curl -X DELETE https://reinaldo-api.sw5bxa.easypanel.host/admin/webhooks/ID_AQUI \
  -H "X-API-Key: 5eb861539ba7b10877830791f3bd7a1afc8f2d94fee57919f4b18be74a4fbc48"
```

**Resposta:** `204 No Content` (corpo vazio).

### Exemplo pra deletar o `sL7-0HDnLm30l1PD`:

```bash
curl -i -X DELETE https://reinaldo-api.sw5bxa.easypanel.host/admin/webhooks/sL7-0HDnLm30l1PD \
  -H "X-API-Key: 5eb861539ba7b10877830791f3bd7a1afc8f2d94fee57919f4b18be74a4fbc48"
```

### Deletar TODOS os webhooks

```bash
curl -s https://reinaldo-api.sw5bxa.easypanel.host/admin/webhooks \
  -H "X-API-Key: 5eb861539ba7b10877830791f3bd7a1afc8f2d94fee57919f4b18be74a4fbc48" \
  | grep -oE '"id":"[^"]+"' \
  | cut -d'"' -f4 \
  | while read id; do
      curl -s -X DELETE "https://reinaldo-api.sw5bxa.easypanel.host/admin/webhooks/$id" \
        -H "X-API-Key: 5eb861539ba7b10877830791f3bd7a1afc8f2d94fee57919f4b18be74a4fbc48"
      echo "deletado: $id"
    done
```

---

## 6. Enviar evento (ingestão da machine)

Essa é a URL que você cola na machine. Sem autenticação.

```bash
curl -X POST https://reinaldo-api.sw5bxa.easypanel.host/w/ID_DO_WEBHOOK \
  -H "Content-Type: application/json" \
  -d '{
    "events": [
      {
        "client_id": 14809551,
        "date_time": "2026-04-20 15:30:27",
        "event_data": { "request_id": 693446673 },
        "event_type": "solicitacao_passageiro_app_cancelada_pelo_cliente"
      }
    ]
  }'
```

**Resposta `202 Accepted`:**

```json
{
  "accepted": true,
  "delivery_id": 42,
  "webhook_id": "V1StGXR8_Z5jdHi6"
}
```

A API retorna **imediatamente** 202. O processamento e reenvio ao `destination_url` acontecem em background, um por vez (fila FIFO por webhook).

### Respostas possíveis

| Status | Significado |
|---|---|
| `202 Accepted` | Enfileirado com sucesso |
| `404 Not Found` | Webhook não existe (id inválido) |
| `409 Conflict` | Webhook existe mas está `active:false` |

---

## 7. Histórico de entregas de um webhook

```bash
curl "https://reinaldo-api.sw5bxa.easypanel.host/admin/webhooks/ID_AQUI/deliveries?limit=50" \
  -H "X-API-Key: 5eb861539ba7b10877830791f3bd7a1afc8f2d94fee57919f4b18be74a4fbc48"
```

**Query params:**
| Param | Padrão | Descrição |
|---|---|---|
| `limit` | 50 | Máximo 500 |
| `status` | —  | Filtrar: `queued` / `processing` / `succeeded` / `failed` |

### Só falhas

```bash
curl "https://reinaldo-api.sw5bxa.easypanel.host/admin/webhooks/ID_AQUI/deliveries?status=failed&limit=100" \
  -H "X-API-Key: 5eb861539ba7b10877830791f3bd7a1afc8f2d94fee57919f4b18be74a4fbc48"
```

**Resposta (array):**

```json
[
  {
    "id": 42,
    "status": "succeeded",
    "attempt": 1,
    "response_status": 200,
    "error": null,
    "created_at": "2026-04-20T22:30:00Z",
    "started_at": "2026-04-20T22:30:00Z",
    "finished_at": "2026-04-20T22:30:01Z"
  }
]
```

---

## 8. Detalhe de uma entrega (com body completo)

```bash
curl https://reinaldo-api.sw5bxa.easypanel.host/admin/deliveries/DELIVERY_ID \
  -H "X-API-Key: 5eb861539ba7b10877830791f3bd7a1afc8f2d94fee57919f4b18be74a4fbc48"
```

Retorna o registro completo: `request_body`, `request_headers` (o que veio da machine), `response_status`, `response_body` (o que o destino respondeu), `error` se falhou.

---

## 9. Health / Ready

```bash
curl https://reinaldo-api.sw5bxa.easypanel.host/health
# {"ok":true}

curl https://reinaldo-api.sw5bxa.easypanel.host/ready
# {"ok":true}  (verifica Postgres + Redis)
```

---

## Dashboard visual

```
https://reinaldo-api.sw5bxa.easypanel.host/admin/queues
```

Login Basic Auth: `admin` / `qSlgEavq10MfltBzbeY0aoGc6KNQ4`

Mostra:
- Todas as filas (uma por webhook) com contador de tarefas
- Abas **Ativo / Em espera / Completo / Erro / Atrasado / Pausado**
- Clica no nome da fila pra ver jobs individuais, retries, logs, etc.

---

## Fluxo completo (exemplo real)

```bash
# 1. Cria webhook pra uma cidade
curl -X POST https://reinaldo-api.sw5bxa.easypanel.host/admin/webhooks \
  -H "X-API-Key: 5eb861539ba7b10877830791f3bd7a1afc8f2d94fee57919f4b18be74a4fbc48" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Goiania",
    "destination_url": "https://xxx.supabase.co/functions/v1/eventos-goiania"
  }'

# Resposta traz webhook_url:
# https://reinaldo-api.sw5bxa.easypanel.host/w/AbCdEf123456

# 2. Cola esse webhook_url na machine

# 3. Machine começa a mandar eventos → caem em /w/AbCdEf123456 →
#    são enfileirados → processados 1 por vez → reenviados pra Supabase
#    Acompanha em /admin/queues
```

---

## Campos do banco (referência)

### Tabela `webhooks`
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | TEXT (16 chars) | ID único gerado |
| `name` | TEXT | Nome/cidade |
| `destination_url` | TEXT | URL de reenvio |
| `destination_headers` | JSONB | Headers extras |
| `active` | BOOLEAN | Se tá processando |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### Tabela `deliveries`
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | BIGSERIAL | Autoincrement |
| `webhook_id` | TEXT | FK pro webhook |
| `status` | TEXT | queued / processing / succeeded / failed |
| `attempt` | INT | Tentativa atual |
| `request_body` | JSONB | O que a machine mandou |
| `request_headers` | JSONB | Headers da requisição |
| `response_status` | INT | Status HTTP do destino |
| `response_body` | TEXT | Resposta do destino (primeiros 10KB) |
| `error` | TEXT | Mensagem de erro se falhou |
| `created_at` | — | |
| `started_at` | — | |
| `finished_at` | — | |
