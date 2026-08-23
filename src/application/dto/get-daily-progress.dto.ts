export interface GetDailyProgressInput {
  readonly patientId: string;
  /** Default: hoy (ver Clock inyectado en el use case). */
  readonly date?: Date;
}

export interface GetDailyProgressOutput {
  readonly totalScheduled: number;
  readonly totalTaken: number;
}
