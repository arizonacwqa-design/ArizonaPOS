#!/bin/bash
# ArizonaPOS Critical Bug Fixes Commit Script
# Run this in Git Bash or Terminal

cd "c:\Users\Q\OneDrive\Desktop\ArizonaPOS.worktrees\agents-file-read-implementation"

echo "=========================================="
echo "ArizonaPOS Bug Fix Commit"
echo "=========================================="
echo ""

echo "1️⃣  Checking git status..."
git status --short
echo ""

echo "2️⃣  Staging all changes..."
git add -A
echo "✅ Changes staged"
echo ""

echo "3️⃣  Creating commit..."
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

if [ $? -eq 0 ]; then
  echo "✅ Commit successful!"
  echo ""
  
  echo "4️⃣  Latest commit:"
  git log -1 --oneline
  echo ""
  git log -1 --format=fuller
  echo ""
  
  echo "5️⃣  Repository status:"
  git status
  echo ""
  
  echo "=========================================="
  echo "✨ All fixes committed successfully!"
  echo "=========================================="
else
  echo "❌ Commit failed"
  git status
  exit 1
fi
