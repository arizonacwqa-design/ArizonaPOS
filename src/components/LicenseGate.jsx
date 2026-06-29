import { useState, useEffect, useCallback } from 'react';

const LS_KEY = 'acw_license_key';
const LS_MACHINE = 'acw_machine_id';
const VERIFY_URL = 'https://vdjhwmdzbjztiqhyrmai.supabase.co/functions/v1/verify-license';

function generateMachineId() {
  return crypto.randomUUID();
}

async function verifyLicense(licenseKey, machineId) {
  const res = await fetch(VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ license_key: licenseKey, machine_id: machineId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

function loadStoredKeys() {
  try {
    const key = localStorage.getItem(LS_KEY);
    const machine = localStorage.getItem(LS_MACHINE);
    return { licenseKey: key, machineId: machine };
  } catch {
    return { licenseKey: null, machineId: null };
  }
}

function storeKeys(licenseKey, machineId) {
  try {
    localStorage.setItem(LS_KEY, licenseKey);
    localStorage.setItem(LS_MACHINE, machineId);
  } catch {
  }
}

export default function LicenseGate({ children }) {
  const [state, setState] = useState('loading');
  const [inputKey, setInputKey] = useState('');
  const [error, setError] = useState('');

  const verifyStored = useCallback(async () => {
    const { licenseKey, machineId } = loadStoredKeys();
    if (!licenseKey || !machineId) {
      setState('entry');
      return;
    }
    try {
      const data = await verifyLicense(licenseKey, machineId);
      if (data.valid) {
        setState('verified');
      } else {
        localStorage.removeItem(LS_KEY);
        localStorage.removeItem(LS_MACHINE);
        setError(data.message || 'License verification failed');
        setState('entry');
      }
    } catch {
      setState('verified');
    }
  }, []);

  useEffect(() => {
    verifyStored();
  }, [verifyStored]);

  useEffect(() => {
    if (state !== 'verified') return;
    const interval = setInterval(async () => {
      const { licenseKey, machineId } = loadStoredKeys();
      if (!licenseKey || !machineId) return;
      try {
        const data = await verifyLicense(licenseKey, machineId);
        if (!data.valid) {
          localStorage.removeItem(LS_KEY);
          localStorage.removeItem(LS_MACHINE);
          setState('entry');
          setError(data.message || 'License expired or deactivated');
        }
      } catch {
      }
    }, 86400000);
    return () => clearInterval(interval);
  }, [state]);

  async function handleActivate() {
    const key = inputKey.trim();
    if (!key) {
      setError('Please enter a license key');
      return;
    }
    setError('');
    const machineId = generateMachineId();
    try {
      const data = await verifyLicense(key, machineId);
      if (data.valid) {
        storeKeys(key, machineId);
        setState('verified');
      } else {
        setError(data.message || 'Invalid license key');
      }
    } catch (err) {
      setError('Could not reach license server. Check your connection and try again.');
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      handleActivate();
    }
  }

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-luxury-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (state === 'verified') {
    return children;
  }

  return (
    <div className="min-h-screen bg-luxury-black flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-display font-bold text-gold-400">Arizona Car World</h1>
          <p className="text-lg text-luxury-muted mt-1">POS</p>
        </div>

        <div className="card-luxury p-8">
          <div className="space-y-5">
            <div>
              <label className="label-luxury" htmlFor="license-key">License Key</label>
              <input
                id="license-key"
                type="text"
                value={inputKey}
                onChange={(e) => { setInputKey(e.target.value); setError(''); }}
                onKeyDown={handleKeyDown}
                placeholder="Enter your license key"
                className="input-luxury"
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-950/20 border border-red-500/40 rounded-lg px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              onClick={handleActivate}
              className="btn-gold w-full text-base py-3"
            >
              Activate
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-luxury-muted mt-6">
          &copy; Arizona Car World. All rights reserved.
        </p>
      </div>
    </div>
  );
}
