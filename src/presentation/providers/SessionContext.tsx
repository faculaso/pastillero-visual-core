import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { UserRole } from '../../domain';
import type { AuthUser } from '../../application';
import { useUseCases } from './UseCasesProvider';

export type { UserRole };

export interface Session {
  readonly role: UserRole;
  readonly patientId: string;
  readonly caregiverId: string;
}

export type AuthActionErrorCode =
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_EMAIL_ALREADY_IN_USE'
  | 'INVITE_CODE_INVALID'
  | 'UNKNOWN';

export interface AuthActionResult {
  readonly ok: boolean;
  readonly errorCode?: AuthActionErrorCode;
  /** `signUp()` con confirmación de email pendiente: la cuenta existe pero todavía no hay sesión activa. */
  readonly pendingEmailConfirmation?: boolean;
}

export interface SignUpParams {
  readonly email: string;
  readonly password: string;
  readonly role: UserRole;
  readonly displayName: string;
  /** Solo se usa si `role === 'CUIDADOR'`. */
  readonly inviteCode?: string;
}

interface SessionContextValue {
  readonly session: Session | null;
  readonly status: 'loading' | 'ready';
  signUp(params: SignUpParams): Promise<AuthActionResult>;
  signIn(email: string, password: string): Promise<AuthActionResult>;
  signOut(): Promise<void>;
  /** CUIDADOR ya logueado, sin paciente vinculado todavía (p. ej. tipeó mal el código al registrarse) — redime uno nuevo y refresca `session.patientId`. */
  linkPatient(inviteCode: string): Promise<AuthActionResult>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/** Ids sintéticos SOLO para `initialRole` (modo test) — nunca tocan Supabase. */
const TEST_PATIENT_ID = 'test-patient-1';
const TEST_CAREGIVER_ID = 'test-caregiver-1';

export interface SessionProviderProps {
  readonly children: React.ReactNode;
  /** Solo para tests: fuerza una sesión sintética sin pasar por Supabase Auth. */
  readonly initialRole?: UserRole;
  /** Solo para tests: pisa el `patientId` sintético (p. ej. `''` para simular un Cuidador sin vincular). Ignorado sin `initialRole`. */
  readonly initialPatientId?: string;
}

/**
 * Sesión real vía Supabase Auth (reemplaza el stub que fijaba IDs de demo
 * en memoria). Mantiene la MISMA forma de `Session`
 * (`role`/`patientId`/`caregiverId`) que ya consumían `RootNavigator`,
 * `AdultoMayorStack`, `RegisterTreatmentScreen` y `AdherenceDashboardScreen`
 * — solo cambia CÓMO se llena, no lo que exponen.
 *
 * Resolución de `patientId`/`caregiverId` por rol:
 *  - ADULTO_MAYOR: `patientId` = su propio id de usuario. No usa `caregiverId`
 *    en ningún consumidor actual, así que queda vacío.
 *  - CUIDADOR: `caregiverId` = su propio id. `patientId` = el primer
 *    paciente vinculado (`GetLinkedPatientUseCase`) — alcance MVP
 *    deliberado: un cuidador con más de un paciente vinculado solo ve el
 *    primero por ahora (ver `get-linked-patient.use-case.ts`). Si todavía
 *    no vinculó ninguno, queda vacío — `CuidadorHomeScreen` es quien debe
 *    mostrar el estado "vinculá a tu paciente" en ese caso.
 */
export function SessionProvider({ children, initialRole, initialPatientId }: SessionProviderProps): React.JSX.Element {
  const { auth, redeemInviteCode, getLinkedPatient, getProfile } = useUseCases();
  const [session, setSession] = useState<Session | null>(
    initialRole
      ? { role: initialRole, patientId: initialPatientId ?? TEST_PATIENT_ID, caregiverId: TEST_CAREGIVER_ID }
      : null,
  );
  const [status, setStatus] = useState<'loading' | 'ready'>(initialRole ? 'ready' : 'loading');
  // Evita reconciliar la invitación pendiente más de una vez por sesión activa.
  const reconciledInviteFor = useRef<string | null>(null);

  async function resolveSession(user: AuthUser): Promise<void> {
    const profileResult = await getProfile.execute({ userId: user.id });
    const profile = profileResult.ok ? profileResult.value.profile : null;
    if (!profile) {
      // El trigger que crea `profiles` corre en la misma transacción del
      // signUp, así que esto no debería pasar en uso normal — pero si
      // pasa (cuenta huérfana, o todavía no hay fila), no hay sesión útil
      // que armar.
      setSession(null);
      setStatus('ready');
      return;
    }

    if (profile.role === 'CUIDADOR' && reconciledInviteFor.current !== user.id) {
      reconciledInviteFor.current = user.id;
      const pendingCode = await auth.getPendingInviteCode();
      if (pendingCode) {
        await redeemInviteCode.execute({ caregiverId: user.id, inviteCode: pendingCode });
        await auth.clearPendingInviteCode();
      }
    }

    let patientId = user.id;
    let caregiverId = '';
    if (profile.role === 'CUIDADOR') {
      caregiverId = user.id;
      const linkedResult = await getLinkedPatient.execute({ caregiverId: user.id });
      patientId = linkedResult.ok ? (linkedResult.value.patientId ?? '') : '';
    }

    setSession({ role: profile.role, patientId, caregiverId });
    setStatus('ready');
  }

  useEffect(() => {
    if (initialRole) return; // Modo test: la sesión ya quedó fijada arriba, sin tocar Supabase.

    let cancelled = false;

    void auth.getSession().then((current) => {
      if (cancelled) return;
      if (current) {
        void resolveSession(current.user);
      } else {
        setSession(null);
        setStatus('ready');
      }
    });

    const unsubscribe = auth.onAuthStateChange((current) => {
      if (cancelled) return;
      if (current) {
        void resolveSession(current.user);
      } else {
        reconciledInviteFor.current = null;
        setSession(null);
        setStatus('ready');
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
    // Se suscribe una sola vez al montar — `auth`/`redeemInviteCode`/etc.
    // vienen del bundle de use cases, estable durante toda la vida de la app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRole]);

  async function signUp(params: SignUpParams): Promise<AuthActionResult> {
    const result = await auth.signUp({
      email: params.email,
      password: params.password,
      role: params.role,
      displayName: params.displayName,
      pendingInviteCode: params.role === 'CUIDADOR' ? params.inviteCode : undefined,
    });
    if (!result.ok) return { ok: false, errorCode: mapErrorCode(result.error.code) };
    if (!result.value.session) return { ok: true, pendingEmailConfirmation: true };
    // Con sesión inmediata (confirmación de email desactivada), `onAuthStateChange` ya dispara `resolveSession` solo.
    return { ok: true };
  }

  async function signIn(email: string, password: string): Promise<AuthActionResult> {
    const result = await auth.signIn(email, password);
    if (!result.ok) return { ok: false, errorCode: mapErrorCode(result.error.code) };
    return { ok: true };
  }

  async function signOut(): Promise<void> {
    await auth.signOut();
    setSession(null);
  }

  async function linkPatient(inviteCode: string): Promise<AuthActionResult> {
    if (!session || session.role !== 'CUIDADOR') return { ok: false, errorCode: 'UNKNOWN' };

    const result = await redeemInviteCode.execute({
      caregiverId: session.caregiverId,
      inviteCode: inviteCode.trim().toUpperCase(),
    });
    if (!result.ok) return { ok: false, errorCode: mapErrorCode(result.error.code) };

    const linkedResult = await getLinkedPatient.execute({ caregiverId: session.caregiverId });
    const patientId = linkedResult.ok ? (linkedResult.value.patientId ?? '') : '';
    setSession((current) => (current ? { ...current, patientId } : current));
    return { ok: true };
  }

  const value: SessionContextValue = { session, status, signUp, signIn, signOut, linkPatient };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

function mapErrorCode(code: string): AuthActionErrorCode {
  if (code === 'AUTH_INVALID_CREDENTIALS' || code === 'AUTH_EMAIL_ALREADY_IN_USE' || code === 'INVITE_CODE_INVALID') {
    return code;
  }
  return 'UNKNOWN';
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession() debe usarse dentro de <SessionProvider>');
  return context;
}
