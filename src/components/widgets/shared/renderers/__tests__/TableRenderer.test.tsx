import { describe, it, expect } from 'vitest';
import { createNumberFormatter } from '../TableRenderer';

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
});
