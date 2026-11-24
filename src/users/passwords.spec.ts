import { hashPassword, verifyPassword } from './passwords';

describe('passwords', () => {
  it('verifica la contraseña correcta y rechaza otra', async () => {
    const { hash, salt } = await hashPassword('quadra123');
    expect(hash).not.toContain('quadra123');
    await expect(verifyPassword('quadra123', hash, salt)).resolves.toBe(true);
    await expect(verifyPassword('otra', hash, salt)).resolves.toBe(false);
  });

  it('usa una sal distinta cada vez', async () => {
    const a = await hashPassword('quadra123');
    const b = await hashPassword('quadra123');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
});
