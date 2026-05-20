import { useState } from 'react';
import { Database, Download, Upload, Clock } from 'lucide-react';
import {
  exportDatabaseBackup,
  saveBackupWithDialog,
  parseBackupFile,
  importDatabaseBackup,
  markAutoBackupDone,
  shouldRunAutoBackup,
} from '@/lib/backup';

export default function Backup() {
  const [status, setStatus] = useState('');
  const [importing, setImporting] = useState(false);

  async function handleExport() {
    setStatus('Exporting…');
    try {
      const payload = await exportDatabaseBackup();
      const result = await saveBackupWithDialog(payload);
      markAutoBackupDone();
      setStatus(result?.success ? `Backup saved: ${result.path || 'download'}` : 'Export complete');
    } catch (e) {
      setStatus(e.message || 'Export failed');
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('Import will upsert records by ID. Continue?')) {
      e.target.value = '';
      return;
    }
    setImporting(true);
    setStatus('Importing…');
    try {
      const text = await file.text();
      const backup = parseBackupFile(text);
      const results = await importDatabaseBackup(backup, {
        onProgress: (table, n, total) => setStatus(`Importing ${table} (${n}/${total})…`),
      });
      const ok = Object.values(results).filter((r) => r.inserted > 0).length;
      setStatus(`Import finished — ${ok} tables updated`);
    } catch (err) {
      setStatus(err.message || 'Import failed');
    }
    setImporting(false);
    e.target.value = '';
  }

  const autoDue = shouldRunAutoBackup();

  return (
    <div className="p-8 animate-fade-in">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-gold-500 mb-1">Admin</p>
        <h1 className="text-3xl font-display text-gold-400 flex items-center gap-3">
          <Database className="text-gold-500" />
          Backup System
        </h1>
        <p className="text-luxury-muted mt-1">Export and import your POS database</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-luxury">
          <h2 className="text-lg font-semibold text-gold-400 mb-3 flex items-center gap-2">
            <Download size={20} /> Export Backup
          </h2>
          <p className="text-sm text-luxury-muted mb-4">
            Downloads JSON with inventory, sales, customers, expenses, and more.
          </p>
          <button type="button" onClick={handleExport} className="btn-gold flex items-center gap-2">
            <Download size={18} /> Export Now
          </button>
        </div>

        <div className="card-luxury">
          <h2 className="text-lg font-semibold text-gold-400 mb-3 flex items-center gap-2">
            <Upload size={20} /> Import Backup
          </h2>
          <p className="text-sm text-luxury-muted mb-4">
            Restore from a previously exported JSON file (admin only).
          </p>
          <label className="btn-outline flex items-center justify-center gap-2 cursor-pointer">
            <Upload size={18} />
            {importing ? 'Importing…' : 'Choose JSON File'}
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImport}
              disabled={importing}
            />
          </label>
        </div>

        <div className="card-luxury md:col-span-2">
          <h2 className="text-lg font-semibold text-gold-400 mb-3 flex items-center gap-2">
            <Clock size={20} /> Daily Auto Backup
          </h2>
          <p className="text-sm text-luxury-muted">
            When you sign in as admin, the app prompts for a daily backup if 24 hours have passed.
            {autoDue ? (
              <span className="block mt-2 text-amber-400">A backup is recommended today.</span>
            ) : (
              <span className="block mt-2 text-green-400/80">Last backup within 24 hours.</span>
            )}
          </p>
        </div>
      </div>

      {status && (
        <p className="mt-6 text-sm text-gold-400 bg-gold-600/10 border border-gold-600/20 rounded-lg p-4">
          {status}
        </p>
      )}
    </div>
  );
}
