import { describe, it, expect } from 'vitest';

describe('Example Test Suite', () => {
    it('should return true for true', () => {
        expect(true).toBe(true);
    });

    it('should add numbers correctly', () => {
        expect(1 + 1).toBe(2);
    });

    it('should subtract numbers correctly', () => {
        expect(5 - 3).toBe(2);
    });
});