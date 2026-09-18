export type AdultoMayorStackParamList = {
  PastilleroVirtual: undefined;
  MiSemana: undefined;
  MisCuidadores: undefined;
};

export type CuidadorStackParamList = {
  CuidadorHome: undefined;
  RegisterTreatment: { suggestedHour?: number } | undefined;
  AdherenceDashboard: { treatmentId: string };
};

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};
