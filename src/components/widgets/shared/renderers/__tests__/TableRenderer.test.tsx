import { describe, it, expect } from 'vitest';
import { createNumberFormatter, dateStringFormatter } from '../TableRenderer';

describe('TableRenderer', () => {
  describe('createNumberFormatter', () => {
    it('should format numbers with 0 decimal places', () => {
      const formatter = createNumberFormatter(0);
      expect(formatter({ value: 3.14159 } as any)).toBe('3');
      expect(formatter({ value: 2.71828 } as any)).toBe('3');
      expect(formatter({ value: 1.5 } as any)).toBe('2');
    });

    it('should format numbers with 2 decimal places', () => {
      const formatter = createNumberFormatter(2);
      expect(formatter({ value: 3.14159 } as any)).toBe('3.14');
      expect(formatter({ value: 2.71828 } as any)).toBe('2.72');
      expect(formatter({ value: 1.5 } as any)).toBe('1.50');
    });

    it('should format numbers with 4 decimal places', () => {
      const formatter = createNumberFormatter(4);
      expect(formatter({ value: 3.14159265 } as any)).toBe('3.1416');
      expect(formatter({ value: 2.718281828 } as any)).toBe('2.7183');
    });

    it('should handle null and undefined values', () => {
      const formatter = createNumberFormatter(2);
      expect(formatter({ value: null } as any)).toBe('');
      expect(formatter({ value: undefined } as any)).toBe('');
    });

    it('should handle non-numeric values', () => {
      const formatter = createNumberFormatter(2);
      expect(formatter({ value: 'not a number' } as any)).toBe('not a number');
      expect(formatter({ value: '123.45' } as any)).toBe('123.45');
      expect(formatter({ value: true } as any)).toBe('true');
    });

    it('should handle zero', () => {
      const formatter = createNumberFormatter(2);
      expect(formatter({ value: 0 } as any)).toBe('0.00');
      expect(formatter({ value: -0 } as any)).toBe('0.00');
    });

    it('should handle negative numbers', () => {
      const formatter = createNumberFormatter(2);
      expect(formatter({ value: -3.14 } as any)).toBe('-3.14');
      expect(formatter({ value: -2.71828 } as any)).toBe('-2.72');
    });
  });

  describe('dateStringFormatter', () => {
    it('should format YYYY-MM-DD date correctly', () => {
      expect(dateStringFormatter({ value: '2021-06-29' } as any)).toBe('2021-06-29');
    });

    it('should format YYYY/MM/DD date correctly', () => {
      expect(dateStringFormatter({ value: '2021/06/29' } as any)).toBe('2021-06-29');
    });

    it('should format MM/DD/YYYY date correctly', () => {
      expect(dateStringFormatter({ value: '06/29/2021' } as any)).toBe('2021-06-29');
    });

    it('should format ISO string date correctly', () => {
      expect(dateStringFormatter({ value: '2021-06-29T14:30:00.000Z' } as any)).toBe('2021-06-29');
    });

    it('should format date with time correctly', () => {
      expect(dateStringFormatter({ value: '2021-06-29 14:30:00' } as any)).toBe('2021-06-29');
    });

    it('should format Chinese date format correctly', () => {
      expect(dateStringFormatter({ value: '2021年6月29日' } as any)).toBe('2021-06-29');
      expect(dateStringFormatter({ value: '2021年06月29日' } as any)).toBe('2021-06-29');
    });

    it('should handle Unix timestamp in milliseconds', () => {
      expect(dateStringFormatter({ value: '1624953600000' } as any)).toBe('2021-06-29');
    });

    it('should handle Unix timestamp in seconds', () => {
      expect(dateStringFormatter({ value: '1624953600' } as any)).toBe('2021-06-29');
    });

    it('should handle null and undefined values', () => {
      expect(dateStringFormatter({ value: null } as any)).toBe('');
      expect(dateStringFormatter({ value: undefined } as any)).toBe('');
      expect(dateStringFormatter({ value: '' } as any)).toBe('');
    });

    it('should return original value for invalid dates', () => {
      expect(dateStringFormatter({ value: 'not a date' } as any)).toBe('not a date');
      expect(dateStringFormatter({ value: '2021/13/32' } as any)).toBe('2021/13/32');
    });

    it('should NOT convert date to number format (regression test for bug)', () => {
      const result = dateStringFormatter({ value: '2021-06-29' } as any);
      expect(result).not.toBe('2021.00');
      expect(result).toBe('2021-06-29');
    });
  });
});
