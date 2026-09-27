export type AdultoMayorStackParamList = {
  PastilleroVirtual: undefined;
  MiSemana: undefined;
  MisCuidadores: undefined;
  DiagnosticoAlarmas: undefined;
};

export type CuidadorStackParamList = {
  MisPacientes: undefined;
  CuidadorHome: undefined;
  RegisterTreatment: { suggestedHour?: number } | undefined;
  AdherenceDashboard: { treatmentId: string };
};

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};
