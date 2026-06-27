import { useEffect, useRef, useCallback } from 'react';
import { SCAN_TIMEOUT } from '../lib/constants';

export function useBarcodeScanner(onScan) {
  const bufferRef = useRef('');
  const timerRef = useRef(null);

  const reset = useCallback(() => {
    bufferRef.current = '';
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Enter') {
        const code = bufferRef.current;
        if (code) {
          onScan?.(code);
          reset();
        }
        return;
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(reset, SCAN_TIMEOUT);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      reset();
    };
  }, [onScan, reset]);
}
