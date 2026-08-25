import { Ok, Err, type Result, DomainErrors, type DomainError, DoseStatus } from '../../src/domain';
import type {
  Treatment,
  Dose,
  Medication,
  StockInfo,
  Dosage,
  TreatmentRepository,
  DoseRepository,
  StockRepository,
  MedicationCatalogRepository,
} from '../../src/domain';

/**
 * Store compartido en memoria. Los repos NO tienen estado propio: todos
 * leen/escriben este mismo objeto, replicando a propósito el diseño real
 * (StockRepository y TreatmentRepository apuntan a la misma fila SQL) para
 * que los tests de use cases detecten el mismo tipo de bugs de staleness
 * que detectarían contra SQLite real.
 */
export class InMemoryStore {
  readonly treatments = new Map<string, Treatment>();
  readonly doses = new Map<string, Dose>();
  readonly medications = new Map<string, Medication>();

  snapshot(): InMemoryStoreSnapshot {
    return {
      treatments: structuredClone([...this.treatments.entries()]),
      doses: structuredClone([...this.doses.entries()]),
      medications: structuredClone([...this.medications.entries()]),
    };
  }

  restore(snapshot: InMemoryStoreSnapshot): void {
    this.treatments.clear();
    for (const [k, v] of snapshot.treatments) this.treatments.set(k, v);
    this.doses.clear();
    for (const [k, v] of snapshot.doses) this.doses.set(k, v);
    this.medications.clear();
    for (const [k, v] of snapshot.medications) this.medications.set(k, v);
  }
}

interface InMemoryStoreSnapshot {
  readonly treatments: readonly (readonly [string, Treatment])[];
  readonly doses: readonly (readonly [string, Dose])[];
  readonly medications: readonly (readonly [string, Medication])[];
}

export class InMemoryTreatmentRepository implements TreatmentRepository {
  constructor(private readonly store: InMemoryStore) {}

  async create(treatment: Treatment): Promise<Result<Treatment, DomainError>> {
    this.store.treatments.set(treatment.id, treatment);
    return Ok(treatment);
  }

  async createWithInitialDoses(
    treatment: Treatment,
    doses: readonly Dose[],
  ): Promise<Result<{ treatment: Treatment; generatedDoses: readonly Dose[] }, DomainError>> {
    this.store.treatments.set(treatment.id, treatment);
    for (const dose of doses) this.store.doses.set(dose.id, dose);
    return Ok({ treatment, generatedDoses: doses });
  }

  async update(treatment: Treatment): Promise<Result<Treatment, DomainError>> {
    if (!this.store.treatments.has(treatment.id)) {
      return Err(DomainErrors.treatmentNotFound(treatment.id));
    }
    this.store.treatments.set(treatment.id, treatment);
    return Ok(treatment);
  }

  async findById(id: string): Promise<Result<Treatment | null, DomainError>> {
    return Ok(this.store.treatments.get(id) ?? null);
  }

  async findActiveByPatient(patientId: string): Promise<Result<readonly Treatment[], DomainError>> {
    return Ok(
      [...this.store.treatments.values()].filter(
        (t) => t.patientId === patientId && t.status === 'ACTIVE',
      ),
    );
  }

  async findAllByCaregiver(caregiverId: string): Promise<Result<readonly Treatment[], DomainError>> {
    return Ok([...this.store.treatments.values()].filter((t) => t.caregiverId === caregiverId));
  }

  async delete(id: string): Promise<Result<void, DomainError>> {
    this.store.treatments.delete(id);
    return Ok(undefined);
  }
}

export class InMemoryDoseRepository implements DoseRepository {
  constructor(private readonly store: InMemoryStore) {}

  async createSlots(doses: readonly Dose[]): Promise<Result<readonly Dose[], DomainError>> {
    for (const dose of doses) this.store.doses.set(dose.id, dose);
    return Ok(doses);
  }

  async findById(id: string): Promise<Result<Dose | null, DomainError>> {
    return Ok(this.store.doses.get(id) ?? null);
  }

  async findPendingByPatientAndDate(
    patientId: string,
    date: Date,
  ): Promise<Result<readonly Dose[], DomainError>> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const result = [...this.store.doses.values()].filter((d) => {
      const treatment = this.store.treatments.get(d.treatmentId);
      return (
        treatment?.patientId === patientId &&
        d.status === 'PENDING' &&
        d.scheduledAt >= dayStart &&
        d.scheduledAt <= dayEnd
      );
    });
    return Ok(result);
  }

  async findAllByPatientAndDate(
    patientId: string,
    date: Date,
  ): Promise<Result<readonly Dose[], DomainError>> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const result = [...this.store.doses.values()].filter((d) => {
      const treatment = this.store.treatments.get(d.treatmentId);
      return (
        treatment?.patientId === patientId &&
        d.scheduledAt >= dayStart &&
        d.scheduledAt <= dayEnd
      );
    });
    return Ok(result);
  }

  async findByTreatmentInRange(
    treatmentId: string,
    from: Date,
    to: Date,
  ): Promise<Result<readonly Dose[], DomainError>> {
    const result = [...this.store.doses.values()].filter(
      (d) => d.treatmentId === treatmentId && d.scheduledAt >= from && d.scheduledAt <= to,
    );
    return Ok(result);
  }

  async findByPatientInRange(
    patientId: string,
    from: Date,
    to: Date,
  ): Promise<Result<readonly Dose[], DomainError>> {
    const result = [...this.store.doses.values()]
      .filter((d) => {
        const treatment = this.store.treatments.get(d.treatmentId);
        return treatment?.patientId === patientId && d.scheduledAt >= from && d.scheduledAt <= to;
      })
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
    return Ok(result);
  }

  async confirmDose(
    doseId: string,
    confirmedAt: Date,
    quantityTaken?: Dosage,
  ): Promise<Result<Dose, DomainError>> {
    const dose = this.store.doses.get(doseId);
    if (!dose) return Err(DomainErrors.doseNotFound(doseId));
    if (dose.status !== 'PENDING') return Err(DomainErrors.doseAlreadyConfirmed(doseId));
    const updated: Dose = { ...dose, status: DoseStatus.TAKEN, confirmedAt, quantityTaken };
    this.store.doses.set(doseId, updated);
    return Ok(updated);
  }

  async markMissed(doseId: string): Promise<Result<Dose, DomainError>> {
    const dose = this.store.doses.get(doseId);
    if (!dose) return Err(DomainErrors.doseNotFound(doseId));
    if (dose.status !== DoseStatus.PENDING) {
      return Err(DomainErrors.invalidStatusTransition(dose.status, 'MISSED'));
    }
    const updated: Dose = { ...dose, status: DoseStatus.MISSED };
    this.store.doses.set(doseId, updated);
    return Ok(updated);
  }

  async confirmDoseWithStockDecrement(
    doseId: string,
    confirmedAt: Date,
    quantityTaken: Dosage,
  ): Promise<Result<{ dose: Dose; stock: StockInfo }, DomainError>> {
    const dose = this.store.doses.get(doseId);
    if (!dose) return Err(DomainErrors.doseNotFound(doseId));
    if (dose.status !== 'PENDING') return Err(DomainErrors.doseAlreadyConfirmed(doseId));

    const treatment = this.store.treatments.get(dose.treatmentId);
    if (!treatment) return Err(DomainErrors.treatmentNotFound(dose.treatmentId));
    if (treatment.stock.currentQuantity - quantityTaken.amount < 0) {
      return Err(DomainErrors.insufficientStock(dose.treatmentId));
    }

    const updatedDose: Dose = { ...dose, status: DoseStatus.TAKEN, confirmedAt, quantityTaken };
    this.store.doses.set(doseId, updatedDose);

    const updatedStock: StockInfo = {
      ...treatment.stock,
      currentQuantity: treatment.stock.currentQuantity - quantityTaken.amount,
    };
    this.store.treatments.set(dose.treatmentId, { ...treatment, stock: updatedStock });

    return Ok({ dose: updatedDose, stock: updatedStock });
  }
}

export class InMemoryStockRepository implements StockRepository {
  constructor(private readonly store: InMemoryStore) {}

  async getStock(treatmentId: string): Promise<Result<StockInfo, DomainError>> {
    const treatment = this.store.treatments.get(treatmentId);
    if (!treatment) return Err(DomainErrors.treatmentNotFound(treatmentId));
    return Ok(treatment.stock);
  }

  async decrement(treatmentId: string, quantity: number): Promise<Result<StockInfo, DomainError>> {
    const treatment = this.store.treatments.get(treatmentId);
    if (!treatment) return Err(DomainErrors.treatmentNotFound(treatmentId));
    if (treatment.stock.currentQuantity - quantity < 0) {
      return Err(DomainErrors.insufficientStock(treatmentId));
    }
    const updatedStock: StockInfo = {
      ...treatment.stock,
      currentQuantity: treatment.stock.currentQuantity - quantity,
    };
    this.store.treatments.set(treatmentId, { ...treatment, stock: updatedStock });
    return Ok(updatedStock);
  }

  async updateStock(treatmentId: string, newQuantity: number): Promise<Result<StockInfo, DomainError>> {
    const treatment = this.store.treatments.get(treatmentId);
    if (!treatment) return Err(DomainErrors.treatmentNotFound(treatmentId));
    const updatedStock: StockInfo = { ...treatment.stock, currentQuantity: newQuantity };
    this.store.treatments.set(treatmentId, { ...treatment, stock: updatedStock });
    return Ok(updatedStock);
  }

  async findCriticalStockTreatments(
    caregiverId: string,
  ): Promise<Result<readonly Treatment[], DomainError>> {
    const result = [...this.store.treatments.values()].filter((t) => {
      if (t.caregiverId !== caregiverId || t.status !== 'ACTIVE') return false;
      if (t.stock.dailyConsumption <= 0) return false;
      const daysRemaining = t.stock.currentQuantity / t.stock.dailyConsumption;
      return daysRemaining <= t.stock.criticalThresholdDays;
    });
    return Ok(result);
  }
}

export class InMemoryMedicationCatalogRepository implements MedicationCatalogRepository {
  constructor(private readonly store: InMemoryStore) {}

  async searchByText(query: string): Promise<Result<readonly Medication[], DomainError>> {
    const lower = query.toLowerCase();
    return Ok(
      [...this.store.medications.values()].filter(
        (m) => m.name.toLowerCase().includes(lower) || m.activeIngredient.toLowerCase().includes(lower),
      ),
    );
  }

  async searchByBarcode(barcode: string): Promise<Result<Medication | null, DomainError>> {
    return Ok([...this.store.medications.values()].find((m) => m.barcode === barcode) ?? null);
  }

  async findById(id: string): Promise<Result<Medication | null, DomainError>> {
    return Ok(this.store.medications.get(id) ?? null);
  }

  async listAll(limit = 50): Promise<Result<readonly Medication[], DomainError>> {
    return Ok(
      [...this.store.medications.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, limit),
    );
  }
}
