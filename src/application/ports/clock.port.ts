/** Abstrae la obtención de la hora actual. Los use cases nunca llaman `new Date()` directamente. */
export interface Clock {
  now(): Date;
}
