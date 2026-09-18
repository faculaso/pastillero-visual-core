/**
 * Los dos roles de la app — qué hace cada persona. Vive en dominio porque
 * gobierna invariantes reales (quién puede registrar un tratamiento, quién
 * lo confirma), no solo una preferencia de UI.
 */
export type UserRole = 'ADULTO_MAYOR' | 'CUIDADOR';

/**
 * Proyección de la fila `profiles` (Supabase) — la cuenta real de un
 * usuario autenticado.
 *
 * Un rol es una CAPACIDAD, no un valor excluyente: la misma cuenta puede
 * ser Adulto Mayor y Cuidador a la vez (`isPatient` + `isCaregiver`, ver
 * `supabase/migrations/0010_una_cuenta_dos_roles.sql`). `role` es solo con
 * cuál de los dos se creó la cuenta; para decidir qué puede hacer alguien
 * se miran los dos booleanos, nunca `role`.
 *
 * `inviteCode` existe cuando `isPatient` es true — es el código que el
 * Adulto Mayor le dicta a su Cuidador. Un Cuidador puro nunca tiene uno.
 */
export interface Profile {
  readonly id: string;
  readonly role: UserRole;
  readonly displayName: string | null;
  readonly inviteCode: string | null;
  readonly isPatient: boolean;
  readonly isCaregiver: boolean;
}

/** Los roles que esta cuenta puede usar hoy, en orden estable para la UI. */
export function availableRoles(profile: Profile): readonly UserRole[] {
  const roles: UserRole[] = [];
  if (profile.isPatient) roles.push('ADULTO_MAYOR');
  if (profile.isCaregiver) roles.push('CUIDADOR');
  // Un perfil sin ninguna capacidad no debería existir (lo impide un CHECK
  // en la base), pero un respaldo offline guardado por una versión anterior
  // a 0010 no tiene los booleanos: ahí `role` sigue siendo la mejor
  // respuesta posible, y es mejor que dejar a alguien sin entrar.
  return roles.length > 0 ? roles : [profile.role];
}
