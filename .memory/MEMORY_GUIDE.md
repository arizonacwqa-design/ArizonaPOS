# Memory Usage Guide — For AI Assistants

## Purpose
This directory (`/pos/.memory/`) is the **persistent system memory** for the Arizona Car World POS system. It exists so every AI session has access to the same complete understanding of business rules, architecture, and operational constraints — regardless of context window or conversation history.

## Rules for AI Modifying This System

### 1. READ BEFORE CHANGE
Before making any code change to the POS system, you MUST read:
- `MEMORY_GUIDE.md` — this file (reminders)
- The relevant rule file(s) in `rules/` that apply to your change
- `known-issues.md` — to avoid reintroducing fixed bugs
- `project.md` — for overall context

### 2. NEVER OVERWRITE FULL FILES
Do NOT rewrite an entire `.memory/` file unless the system itself has undergone a fundamental rewrite. Instead:
- Read the existing file first
- Add or update only the relevant section
- Preserve existing content and structure

### 3. LOG ALL CHANGES WITH IMPACT ASSESSMENT
Every modification to the POS system (code, config, or memory) must be logged with:
- **Business impact** — What changes for the shop staff or customers?
- **Financial impact** — Does revenue, cost, or pricing change?
- **Inventory impact** — Does stock tracking change?

### 4. CROSS-REFERENCE, DON'T DUPLICATE
Rule files should reference existing `.memory/` files where possible. For example, instead of repeating the database schema in a rule file, reference `database-schema.md`.

### 5. NO SECRETS IN MEMORY
Never store API keys, tokens, passwords, or any sensitive credentials in `.memory/`. Environment variables and secrets belong in `.env` (which is gitignored).

### 6. UPDATE ORDER
When making a system change, update files in this order:
1. `rules/` files that govern the changed logic
2. `known-issues.md` if fixing or discovering a bug
3. `todo.md` if completing or adding tasks
4. `changelog.md` — log the change
5. Source code

## File Structure

```
.memory/
├── MEMORY_GUIDE.md          ← This file
├── project.md               ← System overview, users, features, tech stack
├── architecture.md          ← System architecture, data flow, auth, permissions
├── billing-flow.md          ← POS billing step-by-step flow
├── inventory.md             ← Stock types, operations, barcode scanning
├── database-schema.md       ← Tables, functions, RLS, migrations
├── decisions.md             ← Architecture decisions with rationale
├── known-issues.md          ← Known bugs and limitations
├── todo.md                  ← Pending tasks and improvements
├── automation.md            ← n8n workflow integration docs
├── changelog.md             ← Git history and milestone log
├── failure-response.md      ← Failure response protocol (8-step SOP)
└── rules/
    ├── billing-rules.md     ← POS billing business rules
    ├── discount-logic.md    ← Discount calculation rules
    ├── tax-rules.md         ← Tax configuration rules
    ├── invoice-format.md    ← Invoice layout and content rules
    ├── stock-deduction.md   ← Inventory deduction rules
    ├── payment-methods.md   ← Payment method rules
    └── refund-rules.md      ← Refund policy and process

rules/ (project root, strict enforcement)
├── billing.md               ← Strict billing system rules
└── inventory.md             ← Strict inventory management rules
```

## Key Source File Reference

| Logic | File |
|-------|------|
| POS billing component | `src/pages/POS.jsx` |
| Cart & billing math | `src/lib/pos.js` |
| Discount/tax calculation | `src/lib/pos.js` → `calcBillingTotals()` |
| Stock validation | `src/lib/pos.js` → `validateCartStock()` |
| Customer upsert | `src/lib/customers.js` → `upsertCustomerFromSale()` |
| Permissions | `src/lib/permissions.js` |
| Constants (payment methods, categories, tax rate) | `src/lib/constants.js` |
| Invoice thermal component | `src/components/ThermalInvoice.jsx` |
| Invoice A4 component | `src/components/A4Invoice.jsx` |
| Invoice PDF generation | `src/lib/invoicePdf.js` |
| Invoice share (WhatsApp) | `src/lib/share.js` |
| WhatsApp Monitor dashboard | `src/pages/WhatsAppMonitor.jsx` |
| Inventory page | `src/pages/Inventory.jsx` |
| Purchases page | `src/pages/Purchases.jsx` |
| Database triggers | `supabase/schema.sql` |
| Atomic sale RPC | `supabase/migrations/006_pos_security_atomicity.sql` |

## Question to Ask Before Every Change

1. Which business rule does this change affect? (check `rules/`)
2. Have I read the current state of that rule and the affected source code?
3. What is the business, financial, and inventory impact?
4. Does this affect invoice formatting, payment handling, or stock tracking?
5. Does this affect admin vs employee permissions?
6. Does this require a database migration or RLS policy change?
7. Have I updated `.memory/` files to reflect this change?
