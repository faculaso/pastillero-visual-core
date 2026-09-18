import { describe, it, expect, vi, afterEach } from 'vitest';
import { HibpLeakedPasswordCheck } from '../../../src/infrastructure/services/hibp-leaked-password-check';
import { sha1Hex } from '../../../src/infrastructure/services/sha1';

/** SHA-1 de 'password123', la contraseña filtrada por excelencia. */
const HASH = sha1Hex('password123');
const PREFIX = HASH.slice(0, 5);
const SUFFIX = HASH.slice(5);

function fakeFetch(body: string, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    text: async () => body,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HibpLeakedPasswordCheck', () => {
  it('manda SOLO los 5 primeros caracteres del hash, nunca la contraseña', async () => {
    const fetchSpy = fakeFetch(`${SUFFIX}:42\r\n`);
    vi.stubGlobal('fetch', fetchSpy);

    await new HibpLeakedPasswordCheck().isLeaked('password123');

    const [url] = fetchSpy.mock.calls[0]!;
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${PREFIX}`);
    // La garantía de privacidad, escrita como test: ni la contraseña ni el
    // hash completo pueden aparecer en la URL.
    expect(url).not.toContain('password123');
    expect(url).not.toContain(SUFFIX);
  });

  it('pide relleno para que ni el tamaño de la respuesta insinúe nada', async () => {
    const fetchSpy = fakeFetch('');
    vi.stubGlobal('fetch', fetchSpy);

    await new HibpLeakedPasswordCheck().isLeaked('password123');

    const [, init] = fetchSpy.mock.calls[0]!;
    expect(init.headers['Add-Padding']).toBe('true');
  });

  it('reconoce una contraseña filtrada cuando su final de hash está en la lista', async () => {
    vi.stubGlobal('fetch', fakeFetch(`0000AAAA:3\r\n${SUFFIX}:12345\r\nFFFFBBBB:7\r\n`));

    const result = await new HibpLeakedPasswordCheck().isLeaked('password123');

    expect(result.ok && result.value).toBe(true);
  });

  it('una contraseña que no está en la lista pasa', async () => {
    vi.stubGlobal('fetch', fakeFetch('0000AAAA:3\r\nFFFFBBBB:7\r\n'));

    const result = await new HibpLeakedPasswordCheck().isLeaked('password123');

    expect(result.ok && result.value).toBe(false);
  });

  /**
   * Con `Add-Padding` la respuesta trae entradas inventadas de conteo cero.
   * Tomarlas por buenas rechazaría contraseñas perfectamente sanas.
   */
  it('las entradas de relleno (conteo 0) NO cuentan como filtración', async () => {
    vi.stubGlobal('fetch', fakeFetch(`${SUFFIX}:0\r\n`));

    const result = await new HibpLeakedPasswordCheck().isLeaked('password123');

    expect(result.ok && result.value).toBe(false);
  });

  it('compara sin distinguir mayúsculas: el servicio podría cambiar el formato', async () => {
    vi.stubGlobal('fetch', fakeFetch(`${SUFFIX.toLowerCase()}:99\r\n`));

    const result = await new HibpLeakedPasswordCheck().isLeaked('password123');

    expect(result.ok && result.value).toBe(true);
  });

  it('si el servicio responde un error HTTP, devuelve Err y no un falso "está limpia"', async () => {
    vi.stubGlobal('fetch', fakeFetch('', false, 503));

    const result = await new HibpLeakedPasswordCheck().isLeaked('password123');

    expect(result.ok).toBe(false);
  });

  it('sin red devuelve Err — el que llama decide seguir, no este módulo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network request failed')));

    const result = await new HibpLeakedPasswordCheck().isLeaked('password123');

    expect(result.ok).toBe(false);
  });
});
