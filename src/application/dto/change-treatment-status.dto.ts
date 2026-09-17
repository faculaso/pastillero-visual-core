import type { Treatment, TreatmentStatus } from '../../domain';

export interface ChangeTreatmentStatusInput {
  readonly treatmentId: string;
  /** ACT-02: solo el cuidador dueño puede pausar, reanudar o dar de baja. */
  readonly requestingCaregiverId: string;
  readonly newStatus: TreatmentStatus;
}

export interface ChangeTreatmentStatusOutput {
  readonly treatment: Treatment;
  /**
   * Cuántas alarmas futuras se apagaron (al pausar o dar de baja) o se
   * volvieron a programar (al reanudar). Es el dato que dice si la acción
   * REALMENTE sirvió: cambiar el estado en la base sin tocar las alarmas
   * deja el teléfono sonando por un remedio suspendido.
   */
  readonly alarmsAffected: number;
  /**
   * Tomas cuya alarma no se pudo tocar. Best-effort, igual que en el resto
   * de los use cases: el cambio de estado ya quedó persistido y no se
   * revierte por esto, pero la pantalla tiene que poder avisarlo.
   */
  readonly alarmWarnings: readonly string[];
}
