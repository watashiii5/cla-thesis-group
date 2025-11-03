import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../../components/Sidebar';

test('renders Sidebar component', () => {
    render(<Sidebar />);
    const linkElement = screen.getByText(/some sidebar text/i);
    expect(linkElement).toBeInTheDocument();
});

test('handles API error logging', async () => {
    console.error = jest.fn();
    const mockError = { detail: 'Failed to insert schedule_batches' };
    
    // Simulate the API call that results in an error
    await handleGenerateSchedule(mockError);
    
    expect(console.error).toHaveBeenCalledWith('API Error:', mockError);
});