# Automation & n8n Workflow Integration

> **Status**: ⚠️ No n8n integration currently exists in this codebase.
> This document defines the architecture, rules, and proposed flows should n8n be connected.
> All WhatsApp notifications are currently handled client-side via direct `wa.me` links.

---

## Current State

| Feature | Current Implementation | File(s) |
|---------|----------------------|---------|
| WhatsApp invoice sharing | Client-side `wa.me` link via `openWhatsApp()` | `src/lib/share.js:48-54` |
| Invoice message builder | `buildInvoiceWhatsAppMessage()` creates plain text | `src/lib/share.js:15-40` |
| Webhooks | None | — |
| n8n workflows | None | — |
| Automation event log | None | — |
| Retry mechanism | None | — |

---

## Rules for n8n Integration

### Rule 1 — Never Break Existing Workflows

- Existing client-side `wa.me` sharing must continue working regardless of n8n integration
- n8n should be additive — triggered in parallel, not as a replacement
- If n8n is down, POS must continue functioning without degradation
- All new webhook calls must be wrapped in try/catch with graceful fallback

### Rule 2 — Always Validate Webhook Endpoints

- Webhook URLs must be validated before first use (syntax + reachability)
- Only HTTPS endpoints allowed (no HTTP)
- Endpoint responses must include a health-check signature or expected status code
- Invalid/unreachable endpoints must be flagged in the automation log, not crash the POS

### Rule 3 — Ensure Retry Mechanism Exists

- Every webhook call must implement at least 2 retries with exponential backoff
- Retry on: network timeout, 5xx server errors, rate-limit (429) responses
- Do NOT retry on: 4xx client errors (bad request, unauthorized)
- Max retry delay: 30 seconds
- After all retries exhausted: log failure, do NOT block POS operation

### Rule 4 — Log All Automation Events

- Every webhook dispatch must be logged: `event_type`, `target`, `status`, `response_code`, `duration_ms`, `timestamp`
- Failed dispatches must include error details and retry count
- Log storage: either a new `automation_log` DB table or structured application logs
- Logs must be accessible from an admin UI or exportable for debugging

---

## Proposed Architecture

```
┌──────────────────────────┐     HTTP/HTTPS     ┌──────────────────────┐
│   React POS (Browser)    │  ────────────────→  │   n8n Workflow       │
│                          │  (webhook with      │   Engine              │
│  Sale completed          │   JSON payload)     │                      │
│  → trigger webhook       │                     │  ┌────────────────┐  │
│  → continue UI flow      │                     │  │ WhatsApp Node  │  │
│    (no waiting)          │                     │  ├────────────────┤  │
│                          │                     │  │ Email Node     │  │
│  src/lib/n8n.js          │                     │  ├────────────────┤  │
│  (proposed)              │                     │  │ Inventory Sync │  │
│                          │                     │  └────────────────┘  │
└──────────────────────────┘                     └──────────────────────┘
```

### Proposed Client Module: `src/lib/n8n.js`

```js
// Proposed — not yet implemented
const N8N_WEBHOOK_BASE = import.meta.env.VITE_N8N_WEBHOOK_URL || '';

export async function dispatchAutomationEvent(eventType, payload) {
  if (!N8N_WEBHOOK_BASE) return; // n8n not configured
  // Fire-and-forget with retry — never block the POS
}
```

### Environment Variables (Proposed)
```
VITE_N8N_WEBHOOK_URL=https://n8n.example.com/webhook/pos
VITE_N8N_HEALTH_CHECK_ENABLED=true
VITE_N8N_RETRY_MAX_ATTEMPTS=3
VITE_N8N_RETRY_BASE_DELAY_MS=1000
```

---

## Proposed Event Payloads

### 1. Sale Completed

```
Event: sale.completed
Trigger: After create_sale() RPC succeeds
Endpoint: POST {base}/sale-completed
Payload:
{
  "event": "sale.completed",
  "timestamp": "2026-06-27T10:30:00Z",
  "workspace": "arizona-car-world",
  "data": {
    "invoice_number": "INV-1042",
    "customer_name": "...",
    "customer_phone": "...",
    "total_amount": 450.00,
    "payment_method": "card",
    "items": [
      { "service_name": "PPF Installation", "quantity": 1, "line_total": 350.00 },
      { "service_name": "Ceramic Coating", "quantity": 1, "line_total": 100.00 }
    ],
    "inventory_used": [
      { "item_name": "PPF Roll - Clear Gloss", "amount": 2.0, "unit": "m" }
    ]
  }
}
```

### 2. Low Stock Alert

```
Event: inventory.low_stock
Trigger: After sale completion (server-side check of current_stock vs threshold)
Endpoint: POST {base}/low-stock-alert
Payload:
{
  "event": "inventory.low_stock",
  "timestamp": "...",
  "data": {
    "items": [
      { "name": "PPF Roll - Clear Gloss", "current_stock": 4.0, "threshold": 10, "unit": "m" }
    ]
  }
}
```

### 3. Purchase Recorded

```
Event: inventory.purchase
Trigger: After inventory_purchases INSERT
Endpoint: POST {base}/purchase-recorded
Payload:
{
  "event": "inventory.purchase",
  "timestamp": "...",
  "data": {
    "bill_number": "SUP-2024-001",
    "supplier_name": "...",
    "item_name": "PPF Roll - Clear Gloss",
    "quantity_added": 15,
    "unit_cost": 120.00,
    "total_cost": 1800.00
  }
}
```

### 4. Daily Report Generated

```
Event: reports.daily_summary
Trigger: Scheduled (n8n cron) or manual
Endpoint: POST {base}/daily-summary
Payload:
{
  "event": "reports.daily_summary",
  "date": "2026-06-27",
  "data": {
    "total_sales": 12,
    "total_revenue": 3250.00,
    "total_expenses": 450.00,
    "net_profit": 2800.00,
    "top_service": "PPF Installation",
    "low_stock_items": 2
  }
}
```

---

## Proposed Workflow: WhatsApp Notifications

### Current (Client-Side)
```
Sale complete → buildInvoiceWhatsAppMessage() → openWhatsApp(phone, message) → wa.me link
```
- Manual — staff must click button
- Only works if customer phone is entered
- No automation possible

### Proposed (n8n + Client)
```
Sale complete → dispatchAutomationEvent('sale.completed', payload)
  → n8n receives webhook
  → n8n WhatsApp node sends formatted message to customer
  → n8n logs delivery status
  → n8n optionally sends summary to shop group chat
```

**Fallback**: If n8n fails, the existing client-side `wa.me` button still works for manual sharing.

---

## Proposed Workflow: Invoice Alerts

| Trigger | n8n Action | Recipient |
|---------|-----------|-----------|
| Sale > QAR 1000 | WhatsApp alert | Shop manager |
| 5+ sales in one hour | Group notification | Staff WhatsApp group |
| No sales for 2 hours (business hours) | Reminder | Manager |
| First sale of the day | Celebration message | Staff group |

---

## Proposed Workflow: Payment Confirmation

**Flow**:
1. Sale completed → webhook to n8n
2. n8n sends payment confirmation WhatsApp to customer with invoice summary
3. n8n optionally sends receipt email (if email captured)
4. n8n logs confirmation in automation_log

**Note**: Since POS has no payment gateway, "payment confirmation" is purely informational. The payment is assumed collected at POS.

---

## Proposed Workflow: Inventory Sync

### Use Cases
1. **Low stock threshold reached** → n8n sends alert WhatsApp to purchasing manager
2. **Daily inventory snapshot** → n8n exports inventory levels to Google Sheets or email
3. **Purchase order suggestion** → n8n calculates reorder quantities based on usage trends
4. **Multi-branch sync** → If multiple shops exist, n8n syncs inventory across branches

### Trigger Points
- After every sale (check if any item crossed threshold)
- Scheduled: daily at 8 AM (inventory snapshot)
- Manual: triggered from Reports page

---

## Workflow Modification Protocol

> **Before modifying any automation workflow, follow this process:**

### Step 1 — Show Plan

Document the proposed change in this format:

```
Workflow: <name>
Current behavior: <what happens today>
Proposed behavior: <what should happen after change>

Affected events:
- sale.completed
- inventory.low_stock
- inventory.purchase
- reports.daily_summary

New endpoints needed: <list>
Configuration changes: <env vars, webhook URLs>
```

### Step 2 — Impact Assessment

| Area | Impact |
|------|--------|
| POS performance | [None / Minor / Blocks UI] |
| Existing workflows | [None / Deprecates / Conflicts] |
| Data sent to n8n | [New fields / Changed format / Removed fields] |
| Fallback if n8n down | [Describe] |

### Step 3 — Ask Approval

```
→ Status: PENDING APPROVAL
→ Reviewers: <required>
→ Deploy plan: <staged or immediate>
→ Rollback plan: <how to revert>
```

---

## Proposed Database Table: `automation_log`

If logging is needed in the POS database (rather than n8n internal logs):

```sql
CREATE TABLE IF NOT EXISTS public.automation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  target_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'retried')),
  request_payload jsonb,
  response_code INTEGER,
  response_body TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  duration_ms INTEGER,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Implementation Order (Proposed)

| Phase | What | Depends On |
|-------|------|-----------|
| 1 | Create `src/lib/n8n.js` with dispatch + retry logic | None |
| 2 | Add `VITE_N8N_WEBHOOK_URL` to `.env.example` | Phase 1 |
| 3 | Wire webhook calls into `POS.jsx` completeSale() | Phase 1 |
| 4 | Wire low-stock check into POS and inventory pages | Phase 2 |
| 5 | Wire purchase flow | Phase 2 |
| 6 | Create `automation_log` table | Phase 1 |
| 7 | Configure n8n workflows (external — not in this repo) | Phase 1-6 |
| 8 | Add admin UI for automation log view | Phase 6 |

---

## Source Reference

| File | Purpose |
|------|---------|
| `src/lib/share.js` | Current client-side WhatsApp sharing (no webhooks) |
| `src/lib/constants.js` | Config constants (no n8n config currently) |
| `src/pages/POS.jsx` | Would wire sale.completed event |
| `src/pages/Purchases.jsx` | Would wire inventory.purchase event |
| `src/pages/Inventory.jsx` | Would wire low-stock alert event |
