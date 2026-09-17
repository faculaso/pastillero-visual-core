import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../config/supabase-config';

/**
 * Sin un tope explícito, una petición a un servidor inalcanzable se queda
 * colgada hasta el timeout del sistema — medido en el emulador, cerca de
 * medio minuto de spinner antes de que el respaldo local pudiera entrar.
 * El usuario no distingue "sin conexión" de "la app se colgó".
 *
 * Diez segundos es holgado para una red móvil lenta y corto para que caer
 * al respaldo se sienta inmediato.
 */
const REQUEST_TIMEOUT_MS = 10_000;

function fetchConTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/**
 * Cliente único de Supabase para toda la app. `persistSession` (vía
 * `AsyncStorage`) es lo que hace que la sesión sobreviva a reiniciar la
 * app — sin esto, cada apertura pediría loguearse de nuevo.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: { fetch: fetchConTimeout },
});

/**
 * El refresh automático del token de Supabase no sabe de por sí que la
 * app pasó a segundo plano en RN (no hay un `document` al que escuchar) —
 * sin esto sigue reintentando refrescar mientras el usuario tiene la app
 * minimizada, y no retoma prolijamente al volver. Patrón recomendado por
 * la propia documentación de `@supabase/supabase-js` para React Native.
 */
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
