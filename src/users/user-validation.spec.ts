import { validateNewUser } from './user-validation';

describe('validateNewUser', () => {
  it('normaliza nombre y correo', () => {
    expect(
      validateNewUser({
        name: '  Martín ',
        email: ' Martin@QuadraCount.dev ',
        password: 'quadra123',
      }),
    ).toEqual({
      name: 'Martín',
      email: 'martin@quadracount.dev',
      password: 'quadra123',
    });
  });

  it('rechaza un correo inválido', () => {
    expect(
      validateNewUser({
        name: 'A',
        email: 'sin-arroba',
        password: 'quadra123',
      }),
    ).toBe('El correo no es válido');
  });

  it('rechaza una contraseña corta', () => {
    expect(
      validateNewUser({ name: 'A', email: 'a@b.cl', password: 'corta' }),
    ).toBe('La contraseña debe tener al menos 8 caracteres');
  });

  it('rechaza un nombre vacío', () => {
    expect(
      validateNewUser({ name: '   ', email: 'a@b.cl', password: 'quadra123' }),
    ).toBe('El nombre no puede estar vacío');
  });
});
