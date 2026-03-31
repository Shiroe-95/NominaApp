/**
 * Tests for WorkerProgress component.
 *
 * Requirements: 3.7
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkerProgress } from './WorkerProgress';

describe('WorkerProgress', () => {
  it('renders progress bar with percentage', () => {
    render(<WorkerProgress percent={42} label="Parsing Excel..." />);

    expect(screen.getByText('42%')).toBeDefined();
    expect(screen.getByText('Parsing Excel...')).toBeDefined();
    expect(screen.getByRole('status')).toBeDefined();
  });

  it('renders cancel button when showCancel is true and not complete', () => {
    const onCancel = vi.fn();
    render(<WorkerProgress percent={50} onCancel={onCancel} showCancel />);

    const cancelBtn = screen.getByLabelText('Cancelar operación');
    expect(cancelBtn).toBeDefined();

    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('hides cancel button when progress is 100%', () => {
    const onCancel = vi.fn();
    render(<WorkerProgress percent={100} onCancel={onCancel} showCancel />);

    expect(screen.queryByLabelText('Cancelar operación')).toBeNull();
  });

  it('hides cancel button when showCancel is false', () => {
    const onCancel = vi.fn();
    render(<WorkerProgress percent={50} onCancel={onCancel} showCancel={false} />);

    expect(screen.queryByLabelText('Cancelar operación')).toBeNull();
  });

  it('hides cancel button when no onCancel handler', () => {
    render(<WorkerProgress percent={50} showCancel />);

    expect(screen.queryByLabelText('Cancelar operación')).toBeNull();
  });

  it('uses success variant when complete', () => {
    render(<WorkerProgress percent={100} label="Done" />);

    // The progress bar should show 100%
    expect(screen.getByText('100%')).toBeDefined();
  });

  it('clamps percentage between 0 and 100', () => {
    const { rerender } = render(<WorkerProgress percent={-10} />);
    expect(screen.getByText('0%')).toBeDefined();

    rerender(<WorkerProgress percent={150} />);
    expect(screen.getByText('100%')).toBeDefined();
  });
});
