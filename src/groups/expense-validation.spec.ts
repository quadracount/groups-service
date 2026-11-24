import { validateExpense, type ExpenseInput } from './expense-validation';

const members = ['u-martin', 'u-camila', 'u-sofia', 'u-diego'];

// Gasto de las "45 lucas" del plan
const mercaderia: ExpenseInput = {
  description: '  Mercadería y útiles de aseo ',
  amount: 45000,
  paid_by: 'u-martin',
  shares: [
    { user_id: 'u-martin', amount: 12500 },
    { user_id: 'u-camila', amount: 12500 },
    { user_id: 'u-sofia', amount: 12500 },
    { user_id: 'u-diego', amount: 7500 },
  ],
  source: 'ASSISTANT',
};

describe('validateExpense', () => {
  it('acepta un gasto cuyas partes suman el total', () => {
    expect(validateExpense(mercaderia, members)).toEqual({
      ...mercaderia,
      description: 'Mercadería y útiles de aseo',
    });
  });

  it('usa MANUAL si no viene source', () => {
    const result = validateExpense({ ...mercaderia, source: '' }, members);
    expect(result).toMatchObject({ source: 'MANUAL' });
  });

  it('rechaza partes que no suman el total', () => {
    const shares = mercaderia.shares.slice(0, 3);
    expect(validateExpense({ ...mercaderia, shares }, members)).toBe(
      'Las partes suman $37500 y el total es $45000',
    );
  });

  it('rechaza montos con decimales', () => {
    expect(
      typeof validateExpense({ ...mercaderia, amount: 45000.5 }, members),
    ).toBe('string');
  });

  it('rechaza a quien no es miembro', () => {
    expect(
      validateExpense({ ...mercaderia, paid_by: 'u-intruso' }, members),
    ).toBe('Quien pagó tiene que ser miembro del grupo');
  });

  it('rechaza un miembro repetido en la división', () => {
    const shares = [
      { user_id: 'u-martin', amount: 22500 },
      { user_id: 'u-martin', amount: 22500 },
    ];
    expect(typeof validateExpense({ ...mercaderia, shares }, members)).toBe(
      'string',
    );
  });
});
