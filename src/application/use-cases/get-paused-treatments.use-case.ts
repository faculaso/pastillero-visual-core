import { Ok, type Result, type DomainError, TreatmentStatus, type TreatmentRepository } from '../../domain';
import type { UseCase } from '../core/use-case';
import type {
  GetPausedTreatmentsInput,
  GetPausedTreatmentsOutput,
  PausedTreatmentView,
} from '../dto/get-paused-treatments.dto';

/**
 * Los tratamientos en pausa del paciente, para poder VOLVER a ellos.
 *
 * Sin esto, pausar era una puerta de una sola dirección: el tratamiento
 * pausado desaparece del pastillero y del aviso de stock (que es
 * justamente lo que se le pide a una pausa), y entonces no queda ningún
 * camino en la app para abrirlo de nuevo. El botón "Reanudar" existía pero
 * era inalcanzable. Se descubrió pausando un tratamiento de verdad en el
 * emulador y no pudiendo volver a encontrarlo.
 *
 * Los dados de baja NO se listan a propósito: esa transición es final
 * (`VALID_TREATMENT_TRANSITIONS` no sale de CANCELLED) y una lista de
 * cosas muertas que no se pueden tocar solo estorba.
 */
export class GetPausedTreatmentsUseCase
  implements UseCase<GetPausedTreatmentsInput, GetPausedTreatmentsOutput>
{
  constructor(private readonly treatmentRepository: TreatmentRepository) {}

  async execute(input: GetPausedTreatmentsInput): Promise<Result<GetPausedTreatmentsOutput, DomainError>> {
    // `findActiveByPatient` no sirve acá por definición. `findAllByCaregiver`
    // es la única consulta que ve los estados no activos, y ya filtra por
    // el cuidador dueño: el filtro por paciente y estado se hace acá.
    const result = await this.treatmentRepository.findAllByCaregiver(input.caregiverId);
    if (!result.ok) return result;

    const treatments: PausedTreatmentView[] = result.value
      .filter((t) => t.patientId === input.patientId && t.status === TreatmentStatus.PAUSED)
      .map((t) => ({ treatmentId: t.id, medicationName: t.medication.name }));

    return Ok({ treatments });
  }
}
