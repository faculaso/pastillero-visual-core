export type AdultoMayorStackParamList = {
  PastilleroVirtual: undefined;
  MiSemana: undefined;
};

export type CuidadorStackParamList = {
  CuidadorHome: undefined;
  RegisterTreatment: { suggestedHour?: number } | undefined;
  AdherenceDashboard: { treatmentId: string };
};

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};
