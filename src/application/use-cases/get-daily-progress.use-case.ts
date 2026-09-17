import {
  Ok,
  type Result,
  DoseStatus,
  type DomainError,
  type DoseRepository,
  type TreatmentRepository,
} from '../../domain';
import type { UseCase } from '../core/use-case';
import type { Clock } from '../ports/clock.port';
import type { GetDailyProgressInput, GetDailyProgressOutput } from '../dto/get-daily-progress.dto';

/**
 * Query de solo lectura para la barra de progreso diaria en
 * `PastilleroVirtualScreen` ("2 de 3 tomas completadas"). Deliberadamente
 * separada de `GetPendingDosesForPatientUseCase` — esa solo trae PENDING
 * (lo que hay que mostrar/confirmar); esta necesita TODAS las tomas del
 * día, incluidas las ya tomadas, para poder contar el total.
 *
 * Cuenta SOLO tomas de tratamientos activos, igual que las otras dos
 * lecturas de dosis. Un tratamiento cancelado o pausado conserva sus dosis
 * PENDING ya generadas, así que sin este filtro el denominador incluía
 * tomas que la pantalla no muestra: se veía "1 de 8" con siete tomas
 * listadas, un total que el usuario no puede alcanzar nunca.
 */
export class GetDailyProgressUseCase implements UseCase<GetDailyProgressInput, GetDailyProgressOutput> {
  constructor(
    private readonly doseRepository: DoseRepository,
    private readonly treatmentRepository: TreatmentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: GetDailyProgressInput): Promise<Result<GetDailyProgressOutput, DomainError>> {
    const date = input.date ?? this.clock.now();

    const dosesResult = await this.doseRepository.findAllByPatientAndDate(input.patientId, date);
    if (!dosesResult.ok) return dosesResult;

    const treatmentsResult = await this.treatmentRepository.findActiveByPatient(input.patientId);
    if (!treatmentsResult.ok) return treatmentsResult;
    const activos = new Set(treatmentsResult.value.map((t) => t.id));

    const doses = dosesResult.value.filter((d) => activos.has(d.treatmentId));
    const totalScheduled = doses.length;
    const totalTaken = doses.filter((d) => d.status === DoseStatus.TAKEN).length;

    return Ok({ totalScheduled, totalTaken });
  }
}
