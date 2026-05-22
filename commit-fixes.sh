#!/bin/bash
cd "c:\Users\Q\OneDrive\Desktop\ArizonaPOS.worktrees\agents-file-read-implementation"

echo "=== Git Status Before ==="
git status

echo ""
echo "=== Staging Changes ==="
git add -A

echo ""
echo "=== Committing Changes ==="
git commit -m "fix: resolve 3 critical bugs in inventory and services

- BUG-002: Fix stock initialization logic reversal in InventoryAddForm.jsx:119
  Changed: 'stockAmount > 0 ? 0 : stockAmount' to 'stockAmount > 0 ? stockAmount : 0'
  Previously new inventory items were incorrectly initialized with 0 stock instead of the provided amount.

- BUG-008: Add validation for negative consumption_per_unit in Services.jsx:61-70
  Prevents services from accepting negative consumption values which would reverse inventory flow.
  Added client-side validation before database insert.

- BUG-006: Add error handling for rollback transaction in InventoryAddForm.jsx:150-156
  When purchase creation fails, properly catch and report both the purchase error and any rollback error.
  Prevents silent failures and provides meaningful error messages to user.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"

echo ""
echo "=== Latest Commit ==="
git log -1

echo ""
echo "=== Git Status After ==="
git status

echo ""
echo "✅ Commit Complete!"
