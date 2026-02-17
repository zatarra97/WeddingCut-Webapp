import { z } from 'zod';

/** Numero in formato E.164 (es. +393331234567) richiesto da Cognito */
const phoneE164 = z
  .string()
  .min(1, 'Il telefono è obbligatorio')
  .regex(/^\+[0-9]{10,15}$/, 'Inserisci il numero in formato internazionale (es. +393331234567)');

export const registrationSchema = z.object({
  nomeCompleto: z
    .string()
    .min(1, 'Il nome completo è obbligatorio')
    .max(256, 'Nome troppo lungo'),
  telefono: phoneE164,
  email: z
    .string()
    .min(1, 'L\'email è obbligatoria')
    .email('Inserisci un indirizzo email valido'),
  password: z
    .string()
    .min(8, 'La password deve essere lunga almeno 8 caratteri'),
  confirmPassword: z.string().min(1, 'Conferma la password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Le password non corrispondono',
  path: ['confirmPassword'],
});

export const confirmRegistrationSchema = z.object({
  code: z
    .string()
    .min(6, 'Il codice è di 6 caratteri')
    .max(6, 'Il codice è di 6 caratteri'),
});

export type RegistrationFormData = z.infer<typeof registrationSchema>;
export type ConfirmRegistrationFormData = z.infer<typeof confirmRegistrationSchema>;
