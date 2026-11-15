export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  email_verified: boolean;
}

export interface Observation {
  id: number;
  ra_deg: number;
  dec_deg: number;
  target_name: string;
  notes: string;
  source: string;
  created_at: string;
}

export interface RegistrationInput {
  email: string;
  password: string;
  full_name: string;
  date_of_birth: string;
  terms_accepted: boolean;
}

export interface ObservationInput {
  ra_deg: number;
  dec_deg: number;
  target_name: string;
  notes?: string;
  source?: string;
}
