import { Ok, type Result, DoseStatus, type DomainError, type DoseRepository } from '../../domain';
import type { UseCase } from '../core/use-case';
import type { Clock } from '../ports/clock.port';
import type { GetDailyProgressInput, GetDailyProgressOutput } from '../dto/get-daily-progress.dto';

/**
 * Query de solo lectura para la barra de progreso diaria en
 * `PastilleroVirtualScreen` ("2 de 3 tomas completadas"). Deliberadamente
 * separada de `GetPendingDosesForPatientUseCase` — esa solo trae PENDING
 * (lo que hay que mostrar/confirmar); esta necesita TODAS las tomas del
 * día, incluidas las ya tomadas, para poder contar el total.
 */
export class GetDailyProgressUseCase implements UseCase<GetDailyProgressInput, GetDailyProgressOutput> {
  constructor(
    private readonly doseRepository: DoseRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: GetDailyProgressInput): Promise<Result<GetDailyProgressOutput, DomainError>> {
    const date = input.date ?? this.clock.now();

    const dosesResult = await this.doseRepository.findAllByPatientAndDate(input.patientId, date);
    if (!dosesResult.ok) return dosesResult;

    const totalScheduled = dosesResult.value.length;
    const totalTaken = dosesResult.value.filter((d) => d.status === DoseStatus.TAKEN).length;

    return Ok({ totalScheduled, totalTaken });
  }
}
