import { render, screen, fireEvent } from '@testing-library/react';
import MenuBar from '../../components/MenuBar';

test('hello world!', () => {
    render(<MenuBar />);
    const linkElement = screen.getByText(/hello world/i);
    expect(linkElement).toBeInTheDocument();
});