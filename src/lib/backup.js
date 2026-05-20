import { supabase } from '@/lib/supabase';

const BACKUP_TABLES = [
  'profiles',
  'inventory_items',
  'services',
  'inventory_purchases',
  'sales',
  'sale_items',
  'operating_expenses',
  'customers',
];

const AUTO_BACKUP_KEY = 'acw_pos_last_backup';
const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export async function exportDatabaseBackup() {
  const payload = {
    version: 1,
    exported_at: new Date().toISOString(),
    app: 'Arizona Car World POS',
    tables: {},
  };

  for (const table of BACKUP_TABLES) {
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      payload.tables[table] = { error: error.message, rows: [] };
    } else {
      payload.tables[table] = { rows: data || [] };
    }
  }

  return payload;
}

export function downloadBackupJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `arizona-pos-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function saveBackupWithDialog(payload) {
  const json = JSON.stringify(payload, null, 2);
  const defaultName = `arizona-pos-backup-${new Date().toISOString().slice(0, 10)}.json`;

  if (window.electronAPI?.saveBackupFile) {
    return window.electronAPI.saveBackupFile(json, defaultName);
  }

  downloadBackupJson(payload, defaultName);
  return { success: true, path: defaultName };
}

export function parseBackupFile(text) {
  const data = JSON.parse(text);
  if (!data?.tables || typeof data.tables !== 'object') {
    throw new Error('Invalid backup file format');
  }
  return data;
}

/**
 * Atomic restore via the `restore_backup` Postgres RPC.
 * Function body is a single transaction: any failure rolls back every row.
 * Covers inventory_items, services, customers, operating_expenses.
 */
export async function importDatabaseBackup(backup, { onProgress } = {}) {
  onProgress?.('restore_backup', 1, 1);
  const { data, error } = await supabase.rpc('restore_backup', { p_payload: backup });

  if (error) {
    if (error.code === 'PGRST202' || /restore_backup/i.test(error.message || '')) {
      throw new Error(
        'Database not migrated yet. Admin must run supabase/migrations/006_pos_security_atomicity.sql.'
      );
    }
    throw new Error(error.message || 'Backup restore failed');
  }

  const results = {};
  for (const table of Object.keys(backup.tables)) {
    const requested = backup.tables[table]?.rows?.length || 0;
    const restored = Number(data?.[table] || 0);
    results[table] = restored > 0
      ? { inserted: restored }
      : { inserted: 0, skipped: requested === 0, error: requested > 0 ? 'not restored (table not handled by RPC)' : undefined };
  }
  return results;
}

export function shouldRunAutoBackup() {
  const last = localStorage.getItem(AUTO_BACKUP_KEY);
  if (!last) return true;
  return Date.now() - Number(last) > AUTO_BACKUP_INTERVAL_MS;
}

export function markAutoBackupDone() {
  localStorage.setItem(AUTO_BACKUP_KEY, String(Date.now()));
}

export async function runAutoBackupIfDue(isAdmin) {
  if (!isAdmin || !shouldRunAutoBackup()) return null;
  try {
    const payload = await exportDatabaseBackup();
    await saveBackupWithDialog(payload);
    markAutoBackupDone();
    return payload;
  } catch (e) {
    console.warn('Auto backup failed:', e);
    return null;
  }
}
