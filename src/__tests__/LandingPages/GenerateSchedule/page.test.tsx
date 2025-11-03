import { render, screen, fireEvent } from '@testing-library/react';
import GenerateSchedule from '../../../app/LandingPages/GenerateSchedule/page';
import { vi } from 'vitest';

describe('GenerateSchedule Component', () => {
  beforeEach(() => {
    console.error = vi.fn();
  });

  it('should log API error and throw error on failed API call', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ detail: 'Unknown error' }),
      })
    );

    await expect(handleGenerateSchedule()).rejects.toThrow('Unknown error');
    expect(console.error).toHaveBeenCalledWith('API Error:', { detail: 'Unknown error' });
  });

  it('should log server error and throw error on 500 response', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      })
    );

    await expect(handleGenerateSchedule()).rejects.toThrow('Server error: 500');
    expect(console.error).toHaveBeenCalledWith('API Error:', {});
  });
});