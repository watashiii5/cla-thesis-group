import { describe, it, expect, vi } from 'vitest';
import { handleGenerateSchedule } from '../../../app/LandingPages/GenerateSchedule/page';

describe('handleGenerateSchedule', () => {
    it('should return data on successful API response', async () => {
        const mockResponse = { data: 'some data' };
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue(mockResponse),
        });

        const result = await handleGenerateSchedule();
        expect(result).toEqual(mockResponse);
    });

    it('should handle API error response correctly', async () => {
        const mockErrorResponse = { detail: 'Unknown error' };
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            json: vi.fn().mockResolvedValue(mockErrorResponse),
        });

        await expect(handleGenerateSchedule()).rejects.toThrow('Unknown error');
    });

    it('should handle server error response correctly', async () => {
        const mockErrorResponse = { error: 'Failed to insert schedule_batches' };
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            json: vi.fn().mockResolvedValue(mockErrorResponse),
        });

        await expect(handleGenerateSchedule()).rejects.toThrow('Failed to insert schedule_batches');
    });
});