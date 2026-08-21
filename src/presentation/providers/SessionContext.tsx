import React, { createContext, useContext, useState } from 'react';

export type UserRole = 'ADULTO_MAYOR' | 'CUIDADOR';

export interface Session {
  readonly role: UserRole;
  /** En un dispositivo compartido (típico de esta app: el adulto mayor y el cuidador usan el mismo teléfono/tablet) ambos ids pueden coexistir. */
  readonly patientId: string;
  readonly caregiverId: string;
}

interface SessionContextValue {
  readonly session: Session | null;
  setRole(role: UserRole): void;
  clearSession(): void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * STUB explícito: no hay login real todavía. Para no bloquear la
 * navegación y las pantallas del Cuidador/Adulto Mayor en algo que no era
 * parte de este alcance, se fijan ids de demo y se deja `role` como lo
 * único que el usuario elige en `RoleSelectScreen`. Reemplazar por sesión
 * real (auth + onboarding de perfiles) antes de producción.
 */
const DEMO_PATIENT_ID = 'demo-patient-1';
const DEMO_CAREGIVER_ID = 'demo-caregiver-1';

export interface SessionProviderProps {
  readonly children: React.ReactNode;
  /** Solo para tests: fuerza un rol inicial sin pasar por RoleSelectScreen. */
  readonly initialRole?: UserRole;
}

export function SessionProvider({ children, initialRole }: SessionProviderProps): React.JSX.Element {
  const [role, setRoleState] = useState<UserRole | null>(initialRole ?? null);

  const value: SessionContextValue = {
    session: role ? { role, patientId: DEMO_PATIENT_ID, caregiverId: DEMO_CAREGIVER_ID } : null,
    setRole: (r: UserRole) => setRoleState(r),
    clearSession: () => setRoleState(null),
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession() debe usarse dentro de <SessionProvider>');
  return context;
}
