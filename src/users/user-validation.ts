export const MIN_PASSWORD_LENGTH = 8;

export interface NewUser {
  name: string;
  email: string;
  password: string;
}

/** Correo en minúsculas y sin espacios, para que "Martin@X.dev" y "martin@x.dev" sean el mismo. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Valida y normaliza los datos de registro. Devuelve un mensaje de error si algo no sirve. */
export function validateNewUser(input: NewUser): NewUser | string {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  if (!name) return 'El nombre no puede estar vacío';
  if (name.length > 60) return 'El nombre puede tener hasta 60 caracteres';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'El correo no es válido';
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`;
  }
  return { name, email, password: input.password };
}
