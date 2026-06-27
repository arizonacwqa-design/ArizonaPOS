# TODO

## Priority: High

- [ ] **Stock History Log**: Add a table to track stock changes (who, when, why, delta) for audit trail.

## Priority: Medium

- [ ] **Arabic Translation Completion**: Many pages have gaps in Arabic translations (expense categories, booking statuses, error messages).
- [ ] **Pagination for All Tables**: Reports page tables (inventory usage, expenses) currently load all data without pagination.
- [ ] **Role-based UI Hiding**: Currently employee pages show "Only admins" message; consider redirecting instead.
- [ ] **Error Boundary Enhancement**: Global ErrorBoundary exists but should offer "report error" functionality.

## Priority: Low

- [ ] **Drag-and-drop Cart Reordering**: Allow reordering cart items before checkout.
- [ ] **Multi-currency Support**: Currently QAR-only via format.js locale setting.
- [ ] **Offline Mode**: No offline caching; requires Supabase connection at all times.
- [ ] **Email Invoice**: Send invoice PDF via email (currently WhatsApp-only for sharing).
- [ ] **Dark Mode for Invoice Print**: Currently prints in light theme only.
- [ ] **Service Inventory Link UI in POS**: Show which services have inventory links more prominently in the service selection grid.
- [ ] **Keyboard Shortcuts**: Add keyboard shortcuts for common POS actions (F1=New Sale, F2=Complete, etc.).
- [ ] **Testing**: No test files exist (no Jest/Vitest setup in package.json).

## Infrastructure

- [ ] **Automated Database Migrations**: Consider using Supabase migration runner (`supabase migration up`) instead of manual SQL paste.
- [ ] **CI/CD Pipeline**: No GitHub Actions for deploy; `npm run deploy` runs manually.
- [ ] **Environment-Specific Builds**: No .env.production / .env.development separation in config.
- [ ] **Monitor Low Stock Thresholds**: Add email/WhatsApp notification when stock drops below threshold.
