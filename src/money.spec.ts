import { formatMoney } from './money';

describe('formatMoney', () => {
  it('usa punto de miles y signo menos', () => {
    expect(formatMoney(8000)).toBe('$8.000');
    expect(formatMoney(-8000)).toBe('−$8.000');
    expect(formatMoney(1234567)).toBe('$1.234.567');
    expect(formatMoney(0)).toBe('$0');
  });
});
