import {
  Ok,
  type Result,
  type DomainError,
  type Dose,
  type Treatment,
  type Profile,
  type UserRole,
  type PatientInviteLink,
  type DoseRepository,
  type TreatmentRepository,
  type ProfileRepository,
  type PairingRepository,
} from '../../../domain';
import type { SnapshotCache } from '../../../application';

/**
 * Envuelve un repositorio remoto y le da respaldo local de solo lectura.
 *
 * Si la lectura remota anda, se guarda y se devuelve. Si falla —sin red, o
 * el proyecto de Supabase dormido, que ya nos pasó— se sirve lo último que
 * se supo. Solo si tampoco hay nada guardado se propaga el error original.
 *
 * Las ESCRITURAS pasan derecho, sin tocar. Confirmar una toma sin red y
 * reenviarla después es un problema distinto y más grande (necesita cola,
 * reintentos y resolución de conflictos); esto resuelve el desastre más
 * inmediato, que era abrir la app sin conexión y no ver NADA: ni qué
 * pastilla tomar, después de que sonó la alarma.
 */
abstract class OfflineFallback {
  constructor(protected readonly cache: SnapshotCache) {}

  protected async cachedRead<T>(
    key: string,
    read: () => Promise<Result<T, DomainError>>,
  ): Promise<Result<T, DomainError>> {
    const result = await read();
    if (result.ok) {
      // No se espera: guardar el respaldo nunca debe demorar la pantalla.
      void this.cache.write(key, result.value);
      return result;
    }

    const cached = await this.cache.read<T>(key);
    if (cached !== null) return Ok(cached);
    return result;
  }
}

/** Clave estable por día local — dos lecturas del mismo día comparten respaldo. */
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export class OfflineFallbackDoseRepository extends OfflineFallback implements DoseRepository {
  constructor(
    private readonly remote: DoseRepository,
    cache: SnapshotCache,
  ) {
    super(cache);
  }

  findPendingByPatientAndDate(patientId: string, date: Date): Promise<Result<readonly Dose[], DomainError>> {
    return this.cachedRead(`doses:pending:${patientId}:${dayKey(date)}`, () =>
      this.remote.findPendingByPatientAndDate(patientId, date),
    );
  }

  findAllByPatientAndDate(patientId: string, date: Date): Promise<Result<readonly Dose[], DomainError>> {
    return this.cachedRead(`doses:all:${patientId}:${dayKey(date)}`, () =>
      this.remote.findAllByPatientAndDate(patientId, date),
    );
  }

  findByPatientInRange(patientId: string, from: Date, to: Date): Promise<Result<readonly Dose[], DomainError>> {
    return this.cachedRead(`doses:range:${patientId}:${dayKey(from)}:${dayKey(to)}`, () =>
      this.remote.findByPatientInRange(patientId, from, to),
    );
  }

  findByTreatmentInRange(treatmentId: string, from: Date, to: Date): Promise<Result<readonly Dose[], DomainError>> {
    return this.cachedRead(`doses:treatment:${treatmentId}:${dayKey(from)}:${dayKey(to)}`, () =>
      this.remote.findByTreatmentInRange(treatmentId, from, to),
    );
  }

  findById(id: string): Promise<Result<Dose | null, DomainError>> {
    return this.cachedRead(`dose:${id}`, () => this.remote.findById(id));
  }

  // --- Escrituras: sin respaldo, van derecho al remoto ---

  createSlots(doses: readonly Dose[]): Promise<Result<readonly Dose[], DomainError>> {
    return this.remote.createSlots(doses);
  }

  confirmDose(doseId: string, confirmedAt: Date): Promise<Result<Dose, DomainError>> {
    return this.remote.confirmDose(doseId, confirmedAt);
  }

  confirmDoseWithStockDecrement(
    ...args: Parameters<DoseRepository['confirmDoseWithStockDecrement']>
  ): ReturnType<DoseRepository['confirmDoseWithStockDecrement']> {
    return this.remote.confirmDoseWithStockDecrement(...args);
  }

  markMissed(doseId: string): Promise<Result<Dose, DomainError>> {
    return this.remote.markMissed(doseId);
  }
}

export class OfflineFallbackTreatmentRepository extends OfflineFallback implements TreatmentRepository {
  constructor(
    private readonly remote: TreatmentRepository,
    cache: SnapshotCache,
  ) {
    super(cache);
  }

  findById(id: string): Promise<Result<Treatment | null, DomainError>> {
    return this.cachedRead(`treatment:${id}`, () => this.remote.findById(id));
  }

  findActiveByPatient(patientId: string): Promise<Result<readonly Treatment[], DomainError>> {
    return this.cachedRead(`treatments:active:${patientId}`, () => this.remote.findActiveByPatient(patientId));
  }

  findAllByCaregiver(caregiverId: string): Promise<Result<readonly Treatment[], DomainError>> {
    return this.cachedRead(`treatments:caregiver:${caregiverId}`, () =>
      this.remote.findAllByCaregiver(caregiverId),
    );
  }

  // --- Escrituras ---

  create(treatment: Treatment): Promise<Result<Treatment, DomainError>> {
    return this.remote.create(treatment);
  }

  createWithInitialDoses(
    ...args: Parameters<TreatmentRepository['createWithInitialDoses']>
  ): ReturnType<TreatmentRepository['createWithInitialDoses']> {
    return this.remote.createWithInitialDoses(...args);
  }

  update(treatment: Treatment): Promise<Result<Treatment, DomainError>> {
    return this.remote.update(treatment);
  }

  delete(id: string): Promise<Result<void, DomainError>> {
    return this.remote.delete(id);
  }
}

/**
 * El más importante de los tres, aunque parezca el más chico.
 *
 * `SessionContext.resolveSession` pide el perfil para saber el rol, y si no
 * lo consigue hace `setSession(null)` — es decir, TE DESLOGUEA. El código
 * trataba "no llegué al servidor" igual que "esta cuenta no tiene perfil".
 * Sin red, entonces, la app no mostraba un pastillero viejo: mostraba la
 * pantalla de login. Para un adulto mayor que no se acuerda la contraseña
 * eso es casi irrecuperable.
 */
export class OfflineFallbackProfileRepository extends OfflineFallback implements ProfileRepository {
  constructor(
    private readonly remote: ProfileRepository,
    cache: SnapshotCache,
  ) {
    super(cache);
  }

  findById(id: string): Promise<Result<Profile | null, DomainError>> {
    return this.cachedRead(`profile:${id}`, () => this.remote.findById(id));
  }

  /** Escritura: sin red no hay nada que servir de respaldo. */
  enableRole(userId: string, role: UserRole): Promise<Result<Profile, DomainError>> {
    return this.remote.enableRole(userId, role);
  }
}

export class OfflineFallbackPairingRepository extends OfflineFallback implements PairingRepository {
  constructor(
    private readonly remote: PairingRepository,
    cache: SnapshotCache,
  ) {
    super(cache);
  }

  findLinkedPatientsByCaregiver(caregiverId: string): Promise<Result<readonly string[], DomainError>> {
    return this.cachedRead(`pairing:${caregiverId}`, () =>
      this.remote.findLinkedPatientsByCaregiver(caregiverId),
    );
  }

  /** Vincular es una escritura contra el servidor: sin red no hay nada que servir de respaldo. */
  redeemInviteCode(inviteCode: string, caregiverId: string): Promise<Result<PatientInviteLink, DomainError>> {
    return this.remote.redeemInviteCode(inviteCode, caregiverId);
  }
}
