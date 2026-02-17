import { z } from 'zod';

// Schema di validazione per il login
export const loginSchema = z.object({
  username: z.string()
    .min(1, 'Il campo email è obbligatorio')
    .email('Inserisci un indirizzo email valido'),
  password: z.string()
    .min(1, 'Il campo password è obbligatorio')
    .min(8, 'La password deve essere lunga almeno 8 caratteri'),
});

// Schema di validazione per il reset password
export const resetPasswordSchema = z.object({
  newPassword: z.string()
    .min(8, 'La password deve essere lunga almeno 8 caratteri'),
  confirmPassword: z.string()
    .min(1, 'La conferma della password è obbligatoria'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Le password non corrispondono",
  path: ["confirmPassword"],
});

// Schema di validazione per il recupero password
export const forgotPasswordSchema = z.object({
  email: z.string()
    .min(1, 'Il campo email è obbligatorio')
    .email('Inserisci un indirizzo email valido'),
});

// Schema di validazione per la conferma del codice
export const confirmCodeSchema = z.object({
  code: z.string()
    .min(6, 'Il codice deve essere di 6 caratteri')
    .max(6, 'Il codice deve essere di 6 caratteri'),
  newPassword: z.string()
    .min(8, 'La password deve essere lunga almeno 8 caratteri'),
  confirmPassword: z.string()
    .min(1, 'La conferma della password è obbligatoria'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Le password non corrispondono",
  path: ["confirmPassword"],
});

// Tipi derivati dagli schemi
export type LoginFormData = z.infer<typeof loginSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ConfirmCodeFormData = z.infer<typeof confirmCodeSchema>;
