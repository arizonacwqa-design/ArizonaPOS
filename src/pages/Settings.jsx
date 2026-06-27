import { useState } from 'react';
import { useTranslation } from '@/lib/translations';
import { useLanguageStore } from '@/store/languageStore';
import { useThemeStore } from '@/store/themeStore';
import { companyInfo } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { Globe, Palette, Info, Phone, MapPin, Instagram, Trash2 } from 'lucide-react';

export default function Settings() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguageStore();
  const { theme, setTheme } = useThemeStore();
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const [archiveMsg, setArchiveMsg] = useState('');
  const [archiving, setArchiving] = useState('');

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-gold-400">
          {t('settings')}
        </h1>
        <p className="text-luxury-muted text-sm sm:text-base">
          {t('systemSettings')}
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Language Selection */}
        <div className="card-luxury space-y-4">
          <div className="flex items-center gap-3 border-b border-luxury-border pb-3">
            <Globe className="text-gold-400" size={22} />
            <h2 className="text-lg font-semibold text-white">{t('language')}</h2>
          </div>
          <p className="text-sm text-luxury-muted">
            {t('selectLanguage')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`p-4 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-2 ${
                language === 'en'
                  ? 'bg-gold-600/10 border-gold-500 text-gold-400 font-semibold'
                  : 'bg-luxury-slate/50 border-luxury-border text-gray-400 hover:border-gold-600/30'
              }`}
            >
              <span className="text-2xl">🇬🇧</span>
              <span>{t('english')}</span>
            </button>
            <button
              type="button"
              onClick={() => setLanguage('ar')}
              className={`p-4 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-2 ${
                language === 'ar'
                  ? 'bg-gold-600/10 border-gold-500 text-gold-400 font-semibold'
                  : 'bg-luxury-slate/50 border-luxury-border text-gray-400 hover:border-gold-600/30'
              }`}
              style={{ fontFamily: "'Cairo', sans-serif" }}
            >
              <span className="text-2xl">🇶🇦</span>
              <span>{t('qatariArabic')}</span>
            </button>
          </div>
        </div>

        {/* Theme Selection */}
        <div className="card-luxury space-y-4">
          <div className="flex items-center gap-3 border-b border-luxury-border pb-3">
            <Palette className="text-gold-400" size={22} />
            <h2 className="text-lg font-semibold text-white">{t('theme')}</h2>
          </div>
          <p className="text-sm text-luxury-muted">
            {t('theme')} preference
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`p-4 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-2 ${
                theme === 'light'
                  ? 'bg-gold-600/10 border-gold-500 text-gold-400 font-semibold'
                  : 'bg-luxury-slate/50 border-luxury-border text-gray-400 hover:border-gold-600/30'
              }`}
            >
              <span className="text-lg">☀️</span>
              <span>{t('lightMode')}</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`p-4 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-2 ${
                theme === 'dark'
                  ? 'bg-gold-600/10 border-gold-500 text-gold-400 font-semibold'
                  : 'bg-luxury-slate/50 border-luxury-border text-gray-400 hover:border-gold-600/30'
              }`}
            >
              <span className="text-lg">🌙</span>
              <span>{t('darkMode')}</span>
            </button>
          </div>
        </div>

        {/* Company details */}
        <div className="card-luxury md:col-span-2 space-y-4">
          <div className="flex items-center gap-3 border-b border-luxury-border pb-3">
            <Info className="text-gold-400" size={22} />
            <h2 className="text-lg font-semibold text-white">{t('companyDetails')}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            <div className="bg-luxury-slate/40 border border-luxury-border/50 p-4 rounded-xl flex items-start gap-3">
              <Info className="text-gold-500 shrink-0 mt-1" size={18} />
              <div>
                <p className="text-xs text-luxury-muted">Company Name</p>
                <p className="text-sm font-semibold text-white">{companyInfo.name}</p>
              </div>
            </div>
            <div className="bg-luxury-slate/40 border border-luxury-border/50 p-4 rounded-xl flex items-start gap-3">
              <MapPin className="text-gold-500 shrink-0 mt-1" size={18} />
              <div>
                <p className="text-xs text-luxury-muted">Address</p>
                <p className="text-sm font-semibold text-white truncate max-w-[200px]" title={companyInfo.address}>
                  {companyInfo.address}
                </p>
              </div>
            </div>
            <div className="bg-luxury-slate/40 border border-luxury-border/50 p-4 rounded-xl flex items-start gap-3">
              <Phone className="text-gold-500 shrink-0 mt-1" size={18} />
              <div>
                <p className="text-xs text-luxury-muted">Contacts</p>
                <p className="text-sm font-semibold text-white">
                  {companyInfo.phone || 'N/A'} {companyInfo.whatsapp && `(WA: ${companyInfo.whatsapp})`}
                </p>
              </div>
            </div>
            <div className="bg-luxury-slate/40 border border-luxury-border/50 p-4 rounded-xl flex items-start gap-3">
              <Instagram className="text-gold-500 shrink-0 mt-1" size={18} />
              <div>
                <p className="text-xs text-luxury-muted">Instagram</p>
                <p className="text-sm font-semibold text-white">{companyInfo.instagram}</p>
              </div>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="card-luxury md:col-span-2 space-y-4 mt-6">
            <div className="flex items-center gap-3 border-b border-luxury-border pb-3">
              <Trash2 className="text-red-400" size={22} />
              <h2 className="text-lg font-semibold text-white">Data Maintenance</h2>
            </div>
            <p className="text-sm text-luxury-muted">
              Archive old records to keep the system performant. These actions are irreversible.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                type="button"
                disabled={!!archiving}
                onClick={async () => {
                  setArchiving('services');
                  setArchiveMsg('');
                  const { data, error } = await supabase.rpc('archive_inactive_services');
                  setArchiving('');
                  if (error) setArchiveMsg('Error: ' + error.message);
                  else setArchiveMsg(`Archived ${data} inactive service(s).`);
                }}
                className="btn-outline inline-flex items-center gap-2"
              >
                {archiving === 'services' ? 'Archiving...' : 'Archive Inactive Services'}
              </button>
              <button
                type="button"
                disabled={!!archiving}
                onClick={async () => {
                  setArchiving('customers');
                  setArchiveMsg('');
                  const { data, error } = await supabase.rpc('archive_old_customers', { p_months: 12 });
                  setArchiving('');
                  if (error) setArchiveMsg('Error: ' + error.message);
                  else setArchiveMsg(`Archived ${data} old customer(s).`);
                }}
                className="btn-outline inline-flex items-center gap-2"
              >
                {archiving === 'customers' ? 'Archiving...' : 'Archive Old Customers (12mo)'}
              </button>
            </div>
            {archiveMsg && (
              <p className={`text-sm ${archiveMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
                {archiveMsg}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
