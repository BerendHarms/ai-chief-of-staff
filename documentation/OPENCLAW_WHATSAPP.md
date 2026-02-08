# WhatsApp (OpenClaw) integration

This doc describes how to connect WhatsApp (via OpenClaw) to the AI Chief of Staff dashboard so that messages you send or receive are ingested into the knowledge graph and drive coordination (maps, graphs, notifications, conflicts).

## Flow

1. You send or receive a WhatsApp message (OpenClaw is connected to WhatsApp).
2. That message is forwarded to the Chief of Staff server (see options below).
3. The server runs the full pipeline: **Coordinator → Memory → Critic → Router → Summary**.
4. The knowledge graph, timeline, conflicts, and notifications update; the dashboard (and WebSocket clients) get the new state.

## Webhook endpoint

The server exposes a single endpoint that accepts WhatsApp-style messages and runs the same ingestion as the manual “Chat / WhatsApp” form:

- **URL:** `POST /api/webhooks/whatsapp`
- **Base URL:** Your server (e.g. `https://your-server.com` or `http://localhost:3001` for local dev).

### Payload (JSON)

Send a JSON body with at least a message. All fields except the message body are optional.

| Field          | Description                                      |
|----------------|--------------------------------------------------|
| `message`      | **Required.** Message text (also accepts `body`, `text`, `content`). |
| `sender`       | Who sent it (e.g. phone E.164 or name). Default: `"WhatsApp"`. |
| `from`         | Alias for `sender`.                              |
| `channel`      | `"direct"` or `"group"`. Default: `"direct"`.    |
| `participants` | Array of participant ids/names. Default: `[sender]`. |
| `timestamp`    | Optional; passed through to event metadata.     |

**Example (minimal):**

```json
{
  "message": "We should move the launch to next Tuesday.",
  "sender": "+15551234567"
}
```

**Example (with channel and participants):**

```json
{
  "message": "Team: please review the Q3 roadmap by EOD.",
  "from": "+15559876543",
  "channel": "group",
  "participants": ["+15551234567", "+15559876543"]
}
```

### Optional authentication

If you set a shared secret, the server will reject requests that don’t send it.

1. In `server/.env` set one of:
   - `WEBHOOK_SECRET=your-secret`
   - `OPENCLAW_WEBHOOK_TOKEN=your-secret`
2. Send the secret in the request:
   - **Preferred:** `Authorization: Bearer your-secret`
   - **Alternative:** header `x-webhook-secret: your-secret`

If neither env var is set, the webhook does not require auth (suitable for localhost or trusted networks only).

### Response

On success you get the same shape as `POST /api/ingest/chat`: `{ event, conflicts?, ... }`. On error you get `{ success: false, error: "..." }` with an appropriate status code (400, 401, 500).

---

## Connecting OpenClaw

OpenClaw does **not** send outbound HTTP requests when a WhatsApp message is received. You need to forward messages to the Chief of Staff yourself. Two practical options:

### Option A: OpenClaw agent tool (recommended)

Configure your OpenClaw agent so that when it receives a WhatsApp message, it also calls your Chief of Staff ingest URL. The agent can use the **web** tool (`web_fetch` or a custom HTTP tool) to POST the message to your webhook.

1. **Expose your server**  
   The Chief of Staff server must be reachable from the machine running the OpenClaw gateway (e.g. deploy it or use a tunnel like ngrok for local dev).

2. **Add instructions to your agent**  
   In the agent’s system prompt (e.g. SOUL or instructions), add something like:
   - “When you receive any WhatsApp message (inbound or outbound), after processing it, forward a copy to the Chief of Staff dashboard by calling the web tool to POST to `<YOUR_BASE_URL>/api/webhooks/whatsapp` with JSON: `{ \"message\": \"<message body>\", \"sender\": \"<sender phone or name>\", \"channel\": \"direct\" or \"group\" }`. Use the actual message and sender from the current turn.”

3. **Use the web tool to POST**  
   If your OpenClaw setup has a tool that can perform HTTP POST (e.g. `web_fetch` for GET or a custom “POST to URL” tool), configure it to allow POSTs to your server’s `/api/webhooks/whatsapp`. If the built-in web tool is GET-only, you may need a small custom tool or a bridge (see Option B).

4. **Optional: WEBHOOK_SECRET**  
   Set `WEBHOOK_SECRET` (or `OPENCLAW_WEBHOOK_TOKEN`) in the Chief of Staff server and pass it in the `Authorization: Bearer …` header when the agent calls the webhook.

### Option B: Bridge (e.g. n8n, Make, or a script)

If you prefer not to route every message through the OpenClaw agent:

- Use a **workflow tool** (n8n, Make, etc.) that can:
  - Get “new WhatsApp message” events (e.g. from OpenClaw’s APIs or from a custom listener you build), and
  - HTTP POST to `https://your-chief-of-staff-server/api/webhooks/whatsapp` with the payload above.
- Or run a **small bridge script** that subscribes to or polls OpenClaw (if it exposes message events) and POSTs each message to the webhook.

In all cases, the payload must include at least `message`; `sender`/`from` and `channel`/`participants` improve graph quality.

---

## Testing with curl

**1. Make sure the backend is running** (not just the React app):

```bash
cd server && npm start
```

You should see in the log: `POST /api/webhooks/whatsapp — WhatsApp/OpenClaw webhook`.

**2. Verify the webhook route** (GET returns JSON if the backend has the webhook):

```bash
curl http://localhost:3001/api/webhooks/whatsapp
```

Expected: `{"ok":true,"message":"WhatsApp/OpenClaw webhook...","post_url":"/api/webhooks/whatsapp"}`.  
If you get HTML like `Cannot POST /api/webhooks/whatsapp`, the process on port 3001 is not this backend (e.g. you only started the React app). Start the API from the `server/` directory as above.

**3. Send a test message** (POST):

Local (no auth):

```bash
curl -X POST http://localhost:3001/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"message": "Test from curl.", "sender": "+15551234567"}'
```

With auth:

```bash
curl -X POST http://localhost:3001/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret" \
  -d '{"message": "Test from curl.", "sender": "+15551234567"}'
```

If the server and dashboard are running, you should see a new event on the timeline and updated graph/notifications.

---

## Auto-push when you message yourself (or use a keyword)

You already have OpenClaw on WhatsApp. To have messages **automatically** forwarded to the dashboard when you message yourself (or when you use a trigger word), do the following.

### 1. Chief of Staff backend URL

- If the OpenClaw **gateway** runs on the **same machine** as the Chief of Staff server: use `http://localhost:3001` (or `http://127.0.0.1:3001`).
- If they are on different machines: use the reachable URL of the Chief of Staff server (e.g. `https://your-server.com` or an ngrok URL for local dev). The OpenClaw gateway must be able to HTTP POST to this URL.

### 2. Tell the OpenClaw agent to forward to the dashboard

Add instructions to your OpenClaw agent (in **SOUL.md** or your agent’s system prompt) so that it forwards certain messages to the Chief of Staff webhook. Two patterns:

**Option 1: Keyword trigger**  
When the user’s message starts with a trigger (e.g. `[ingest]` or `[dashboard]`), the agent should send that message to the dashboard and optionally confirm in chat.

**Option 2: Self-chat**  
When the user is messaging **themselves** (WhatsApp “Message yourself”), treat every message as something to forward to the dashboard (and optionally reply “Ingested to dashboard”).

Example addition to **SOUL.md** (adjust `CHIEF_OF_STAFF_URL` to your URL, e.g. `http://localhost:3001`):

```markdown
## Chief of Staff dashboard

When the user sends a message that either:
- starts with `[ingest]` or `[dashboard]`, or
- is in a self-chat (user messaging themselves),

you MUST forward the message to the AI Chief of Staff dashboard so it can update the company knowledge graph.

To forward:
1. Use the **exec** tool to run curl (or use another tool that can HTTP POST).
2. POST to: CHIEF_OF_STAFF_URL/api/webhooks/whatsapp
3. Body (JSON): {"message": "<the user's message text>", "sender": "<user phone or 'self'>"}
4. Content-Type: application/json

Example exec command (replace MESSAGE and SENDER with the actual content, escaped for shell):
curl -sS -X POST http://localhost:3001/api/webhooks/whatsapp -H "Content-Type: application/json" -d '{"message":"MESSAGE","sender":"SENDER"}'

After forwarding, you may briefly confirm in chat (e.g. "Sent to dashboard" or "Ingested.").
```

If your agent does not have the **exec** tool (or it’s disabled), you need another way to perform an HTTP POST (e.g. a custom OpenClaw skill or tool that calls your webhook). The dashboard only needs to receive a POST with the JSON body above.

### 3. Optional: webhook secret

If you set `WEBHOOK_SECRET` in `server/.env`, the agent must send it when calling the webhook. With curl:

```bash
curl -sS -X POST http://localhost:3001/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
  -d '{"message":"User message here","sender":"self"}'
```

Add the same `Authorization: Bearer YOUR_WEBHOOK_SECRET` to whatever tool or script the agent uses.

### 4. What you need from your OpenClaw gateway

- **Gateway URL/port:** Only if the Chief of Staff server runs on another machine; then you’ll use the Chief of Staff URL in SOUL, not the gateway URL.
- **No gateway config change** is required for the webhook itself; the flow is: WhatsApp → OpenClaw agent → agent (via SOUL) calls your dashboard URL.

If you want to restrict forwarding to a specific keyword (e.g. only `[ingest]`), keep that in SOUL and do not enable the self-chat rule. If you want every self-chat message to go to the dashboard, keep both the keyword and the self-chat condition in SOUL as above.

---

## Summary

- **Dashboard side:** Use `POST /api/webhooks/whatsapp` with a JSON body containing at least `message`; optionally protect it with `WEBHOOK_SECRET`.
- **OpenClaw side:** Either have the agent call this URL (via a web/custom tool) for each WhatsApp message you want ingested, or use a bridge that forwards messages to this endpoint. Once messages hit the webhook, the existing pipeline keeps the knowledge graph and company coordination (maps, graphs, conflicts, notifications) in sync.
