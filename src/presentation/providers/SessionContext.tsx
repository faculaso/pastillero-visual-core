import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { availableRoles, type UserRole } from '../../domain';
import type { AuthUser } from '../../application';
import { useUseCases } from './UseCasesProvider';

export type { UserRole };

export interface Session {
  /** El rol ACTIVO — con cuál de sus roles entró esta vez, no "el rol de la cuenta". */
  readonly role: UserRole;
  /**
   * Como ADULTO_MAYOR, su propio id. Como CUIDADOR, el paciente que eligió
   * gestionar en esta vuelta — vacío hasta que elija uno en `MisPacientes`.
   */
  readonly patientId: string;
  /** Nombre del paciente activo, para los títulos. Solo tiene sentido como CUIDADOR. */
  readonly patientName: string | null;
  readonly caregiverId: string;
  /** Id de la cuenta, independiente del rol activo (como Cuidador, `patientId` es de otra persona). */
  readonly userId: string;
  readonly displayName: string | null;
  /** Los roles que esta cuenta tiene prendidos. Uno solo = nunca se le pregunta al entrar. */
  readonly availableRoles: readonly UserRole[];
}

/**
 * Cuenta autenticada que todavía no eligió con qué rol entrar. Mientras
 * esto no sea `null`, `session` es `null` — `RootNavigator` muestra el
 * selector en vez de un stack.
 */
export interface PendingRoleChoice {
  readonly userId: string;
  readonly displayName: string | null;
  readonly roles: readonly UserRole[];
}

export type AuthActionErrorCode =
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_EMAIL_ALREADY_IN_USE'
  | 'INVITE_CODE_INVALID'
  | 'CANNOT_LINK_TO_SELF'
  | 'INVITE_CODE_ALREADY_USED'
  | 'TOO_MANY_CAREGIVERS'
  | 'PASSWORD_LEAKED'
  | 'RECOVERY_CODE_INVALID'
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
  /** No `null` cuando hay que preguntar con qué rol entrar (o se pidió cambiar de rol). */
  readonly roleChoice: PendingRoleChoice | null;
  signUp(params: SignUpParams): Promise<AuthActionResult>;
  signIn(email: string, password: string): Promise<AuthActionResult>;
  signOut(): Promise<void>;
  /** No requiere sesión activa — se llama desde el login, antes de autenticar. */
  requestPasswordReset(email: string): Promise<AuthActionResult>;
  /** Cierra el reseteo con el código del mail. Tampoco requiere sesión previa. */
  completePasswordReset(email: string, code: string, newPassword: string): Promise<AuthActionResult>;
  /** CUIDADOR ya logueado, sin paciente vinculado todavía (p. ej. tipeó mal el código al registrarse) — redime uno nuevo y refresca `session.patientId`. */
  linkPatient(inviteCode: string): Promise<AuthActionResult>;
  /** Entra con uno de los roles disponibles — solo tiene efecto con `roleChoice` pendiente. */
  chooseRole(role: UserRole): Promise<void>;
  /** Vuelve al selector sin cerrar sesión. Sirve también con un solo rol: desde ahí se activa el otro. */
  switchRole(): void;
  /** Suma un rol a la cuenta (el mismo mail pasa a servir para los dos). */
  enableRole(role: UserRole): Promise<AuthActionResult>;
  /** CUIDADOR: fija a cuál de sus pacientes está gestionando. Sin esto, `patientId` queda vacío. */
  selectPatient(patient: { readonly id: string; readonly displayName: string | null }): void;
  /** Vuelve a "ningún paciente elegido", para que la home del Cuidador liste a todos otra vez. */
  clearSelectedPatient(): void;
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
 * Resolución de `patientId`/`caregiverId` según el rol ACTIVO:
 *  - ADULTO_MAYOR: `patientId` = su propio id de usuario. No usa `caregiverId`
 *    en ningún consumidor actual, así que queda vacío.
 *  - CUIDADOR: `caregiverId` = su propio id. `patientId` arranca VACÍO y lo
 *    llena `selectPatient()` cuando la persona elige a quién gestionar en
 *    `MisPacientesScreen`. Antes se autoelegía el primer vínculo, y un
 *    cuidador con dos personas a cargo solo veía a una, sin ningún aviso de
 *    que la otra existía.
 *
 * Una cuenta puede tener los DOS roles prendidos. En ese caso autenticarse
 * no alcanza para armar una sesión: falta saber con cuál entra hoy. Ahí
 * `session` queda en `null` y se expone `roleChoice`, que `RootNavigator`
 * traduce en el selector. Con un solo rol no se pregunta nada.
 */
export function SessionProvider({ children, initialRole, initialPatientId }: SessionProviderProps): React.JSX.Element {
  const { auth, redeemInviteCode, getProfile, leakedPasswordCheck, enableRole: enableRoleUseCase } = useUseCases();
  const [session, setSession] = useState<Session | null>(
    initialRole
      ? {
          role: initialRole,
          patientId: initialPatientId ?? TEST_PATIENT_ID,
          patientName: null,
          caregiverId: TEST_CAREGIVER_ID,
          userId: initialRole === 'CUIDADOR' ? TEST_CAREGIVER_ID : (initialPatientId ?? TEST_PATIENT_ID),
          displayName: null,
          availableRoles: [initialRole],
        }
      : null,
  );
  const [roleChoice, setRoleChoice] = useState<PendingRoleChoice | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready'>(initialRole ? 'ready' : 'loading');
  // Evita reconciliar la invitación pendiente más de una vez por sesión activa.
  const reconciledInviteFor = useRef<string | null>(null);

  /**
   * Arma la sesión para un rol ya elegido. Separado de `resolveSession`
   * porque el mismo trabajo (reconciliar la invitación pendiente, resolver
   * el paciente) hace falta tanto al entrar solo con un rol como al elegir
   * uno en el selector.
   */
  async function activateRole(
    userId: string,
    role: UserRole,
    roles: readonly UserRole[],
    displayName: string | null,
  ): Promise<void> {
    if (role === 'CUIDADOR' && reconciledInviteFor.current !== userId) {
      reconciledInviteFor.current = userId;
      const pendingCode = await auth.getPendingInviteCode();
      if (pendingCode) {
        await redeemInviteCode.execute({ caregiverId: userId, inviteCode: pendingCode });
        await auth.clearPendingInviteCode();
      }
    }

    // Como CUIDADOR no se elige paciente acá: eso es una decisión de la
    // persona, no algo que se deduzca del orden de los vínculos.
    const patientId = role === 'CUIDADOR' ? '' : userId;
    const caregiverId = role === 'CUIDADOR' ? userId : '';

    setRoleChoice(null);
    setSession({ role, patientId, patientName: null, caregiverId, userId, displayName, availableRoles: roles });
    setStatus('ready');
  }

  async function resolveSession(user: AuthUser): Promise<void> {
    const profileResult = await getProfile.execute({ userId: user.id });
    const profile = profileResult.ok ? profileResult.value.profile : null;
    if (!profile) {
      // El trigger que crea `profiles` corre en la misma transacción del
      // signUp, así que esto no debería pasar en uso normal — pero si
      // pasa (cuenta huérfana, o todavía no hay fila), no hay sesión útil
      // que armar.
      setSession(null);
      setRoleChoice(null);
      setStatus('ready');
      return;
    }

    const roles = availableRoles(profile);
    if (roles.length > 1) {
      // Cuenta con los dos roles: entrar no alcanza, falta elegir cuál.
      setSession(null);
      setRoleChoice({ userId: user.id, displayName: profile.displayName, roles });
      setStatus('ready');
      return;
    }

    // `availableRoles` nunca devuelve vacío, pero el índice no se lo prueba a TS.
    await activateRole(user.id, roles[0] ?? profile.role, roles, profile.displayName);
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
        setRoleChoice(null);
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
    // FAIL-OPEN: solo frena si el servicio dice que SÍ está filtrada. Si no
    // se pudo consultar (sin red, servicio caído), se sigue con el alta —
    // dejar a alguien sin poder crear su cuenta porque un servicio ajeno no
    // contesta es peor que aceptarle una contraseña mediocre.
    const leaked = await leakedPasswordCheck.isLeaked(params.password);
    if (leaked.ok && leaked.value) return { ok: false, errorCode: 'PASSWORD_LEAKED' };

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
    setRoleChoice(null);
  }

  async function requestPasswordReset(email: string): Promise<AuthActionResult> {
    const result = await auth.resetPasswordForEmail(email);
    if (!result.ok) return { ok: false, errorCode: mapErrorCode(result.error.code) };
    return { ok: true };
  }

  async function chooseRole(role: UserRole): Promise<void> {
    if (!roleChoice || !roleChoice.roles.includes(role)) return;
    setStatus('loading');
    await activateRole(roleChoice.userId, role, roleChoice.roles, roleChoice.displayName);
  }

  /**
   * No cierra sesión ni toca Supabase: solo vuelve a poner la app en
   * "todavía no elegiste rol". Se ofrece también con un solo rol prendido,
   * porque el selector es el lugar desde donde se activa el otro.
   */
  function switchRole(): void {
    if (!session) return;
    setRoleChoice({ userId: session.userId, displayName: session.displayName, roles: session.availableRoles });
    setSession(null);
  }

  async function enableRole(role: UserRole): Promise<AuthActionResult> {
    const userId = roleChoice?.userId ?? session?.userId;
    if (!userId) return { ok: false, errorCode: 'UNKNOWN' };

    const result = await enableRoleUseCase.execute({ userId, role });
    if (!result.ok) return { ok: false, errorCode: mapErrorCode(result.error.code) };

    const roles = availableRoles(result.value.profile);
    // El rol recién activado todavía no tiene nada adentro (un Cuidador sin
    // pacientes, un Adulto Mayor sin tratamientos), así que no se entra solo:
    // se actualiza el selector y la persona elige.
    setRoleChoice((current) =>
      current
        ? { ...current, roles }
        : { userId, displayName: result.value.profile.displayName, roles },
    );
    setSession(null);
    return { ok: true };
  }

  function selectPatient(patient: { readonly id: string; readonly displayName: string | null }): void {
    setSession((current) =>
      current ? { ...current, patientId: patient.id, patientName: patient.displayName } : current,
    );
  }

  function clearSelectedPatient(): void {
    setSession((current) => (current ? { ...current, patientId: '', patientName: null } : current));
  }

  /**
   * Redime un código y listo. Ya NO elige paciente activo: quién se gestiona
   * lo decide la persona en `MisPacientesScreen`, que se recarga al volver a
   * tener foco y muestra al recién vinculado en la lista.
   */
  async function completePasswordReset(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<AuthActionResult> {
    const result = await auth.completePasswordReset(email, code, newPassword);
    if (!result.ok) return { ok: false, errorCode: mapErrorCode(result.error.code) };
    return { ok: true };
  }

  async function linkPatient(inviteCode: string): Promise<AuthActionResult> {
    if (!session || session.role !== 'CUIDADOR') return { ok: false, errorCode: 'UNKNOWN' };

    const result = await redeemInviteCode.execute({
      caregiverId: session.caregiverId,
      inviteCode: inviteCode.trim().toUpperCase(),
    });
    if (!result.ok) return { ok: false, errorCode: mapErrorCode(result.error.code) };
    return { ok: true };
  }

  const value: SessionContextValue = {
    session,
    status,
    roleChoice,
    signUp,
    signIn,
    signOut,
    linkPatient,
    requestPasswordReset,
    completePasswordReset,
    chooseRole,
    switchRole,
    enableRole,
    selectPatient,
    clearSelectedPatient,
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

function mapErrorCode(code: string): AuthActionErrorCode {
  if (
    code === 'AUTH_INVALID_CREDENTIALS' ||
    code === 'AUTH_EMAIL_ALREADY_IN_USE' ||
    code === 'INVITE_CODE_INVALID' ||
    code === 'CANNOT_LINK_TO_SELF' ||
    code === 'INVITE_CODE_ALREADY_USED' ||
    code === 'TOO_MANY_CAREGIVERS' ||
    code === 'RECOVERY_CODE_INVALID'
  ) {
    return code;
  }
  return 'UNKNOWN';
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession() debe usarse dentro de <SessionProvider>');
  return context;
}
