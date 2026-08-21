/**
 * Medication: proyección de solo-lectura del catálogo Vademécum/ANMAT
 * (CU-01 pasos 2-5, RF-01). No es un agregado mutable del sistema: se
 * referencia por `medicationId` desde `Treatment`, nunca se edita localmente.
 */
export interface Medication {
  readonly id: string; // id del vademécum, no UUID propio
  readonly name: string;
  readonly activeIngredient: string;
  readonly laboratory: string;
  readonly presentation: string; // p.ej. "Comprimidos 500mg x30"
  readonly barcode?: string;
}
