/**
 * Role-based permissions for Arizona Car World POS.
 * Admin: full access. Employee: POS + read-only inventory/reports/customers.
 */

export const PERMISSIONS = {
  admin: {
    dashboard: true,
    pos: true,
    inventory: { read: true, write: true },
    purchases: true,
    services: true,
    reports: { all: true, expenses: true },
    expenses: true,
    customers: true,
    bookings: true,
    backup: true,
    settings: true,
  },
  employee: {
    dashboard: true,
    pos: true,
    inventory: { read: true, write: false },
    purchases: false,
    services: false,
    reports: { all: false, expenses: false },
    expenses: false,
    customers: { read: true, write: false },
    bookings: true,
    backup: false,
    settings: true,
  },
};

export function getPermissions(role) {
  return PERMISSIONS[role === 'admin' ? 'admin' : 'employee'] || PERMISSIONS.employee;
}

export function can(role, feature) {
  const perms = getPermissions(role);
  const val = perms[feature];
  if (val === true || val === false) return val;
  if (typeof val === 'object') return Boolean(val.read || val.all);
  return false;
}

export function canWriteInventory(role) {
  return getPermissions(role).inventory?.write === true;
}

export function canViewExpenses(role) {
  return role === 'admin' || getPermissions(role).expenses === true;
}
