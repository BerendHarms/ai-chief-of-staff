# Email webhook (SendGrid Inbound Parse)

This guide shows the fastest hackathon setup to auto-forward emails into the AI Chief of Staff dashboard using SendGrid Inbound Parse.

## Flow

1. SendGrid receives email at your inbound domain (e.g. `inbound.yourdomain.com`).
2. SendGrid POSTs the email to your server at `/api/webhooks/email`.
3. The server runs the full pipeline: Coordinator → Memory → Critic → Router → Summary.
4. The dashboard updates the knowledge graph, timeline, conflicts, and notifications.

## Webhook endpoint

- **URL:** `POST /api/webhooks/email`
- **Base URL:** Your server (e.g. `https://your-server.com` or `http://localhost:3001` for local dev)

### Payload (SendGrid Inbound Parse)

SendGrid posts `multipart/form-data` with fields like `from`, `to`, `subject`, `text`, `html`, `envelope`.
The server maps these into the email ingest pipeline and extracts a routing key from the recipient.

### Optional authentication

If you set a shared secret, the server rejects requests without it:

1. In `server/.env` set one of:
   - `WEBHOOK_SECRET=your-secret`
   - `OPENCLAW_WEBHOOK_TOKEN=your-secret`
2. Send the secret in the request:
   - **Preferred:** `Authorization: Bearer your-secret`
   - **Alternative:** header `x-webhook-secret: your-secret`

If neither env var is set, the webhook does not require auth (use only for local dev or trusted networks).

## SendGrid setup (fast path)

1. **Create an inbound parse domain** in SendGrid (Settings → Inbound Parse).
2. **Add the DNS MX record** for your inbound domain as instructed by SendGrid.
3. **Set the destination URL** to your server:
   - Example: `https://your-server.com/api/webhooks/email`
4. **Send a test email** to any address at that domain.

## Per-user routing

The server derives a `routeKey` from the recipient local-part:

- `team+alex@inbound.yourdomain.com` → `routeKey = "alex"`
- `team@inbound.yourdomain.com` → `routeKey = "team"`

The route key is included in the event metadata and participants list so the dashboard can associate it with a user/team node.

## Local testing (JSON fallback)

You can test locally by POSTing JSON instead of multipart:

```bash
curl -X POST http://localhost:3001/api/webhooks/email \
  -H "Content-Type: application/json" \
  -d '{
    "from": "sally@vendor.com",
    "to": "team+ops@inbound.yourdomain.com",
    "subject": "Contract update",
    "text": "Attached is the new draft for review."
  }'
```

## Troubleshooting

- **400 Missing or invalid email body**: SendGrid must include `text` or `html`. Ensure Inbound Parse is enabled.
- **401 Invalid or missing webhook secret**: Confirm `WEBHOOK_SECRET` and header value match.
- **No events in dashboard**: Verify the backend is running and reachable, and check server logs for `Email webhook ingest error`.
