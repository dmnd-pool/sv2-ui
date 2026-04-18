import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import type { StepProps } from './types';
import type { SetupData } from './types';

const mocks = vi.hoisted(() => ({
  mockGetCurrentConfig: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('@/hooks/useControlApi', () => ({
  getCurrentConfig: mocks.mockGetCurrentConfig,
}));

vi.mock('wouter', () => ({
  useLocation: () => ['/setup', mocks.mockNavigate],
}));

function createStepMock(title: string, buttonLabel: string, nextUpdates?: Partial<StepProps['data']>) {
  return ({ data, updateData, onNext, onBack }: StepProps) => (
    <div>
      <h2>{title}</h2>
      <p>{`selected mode: ${data.mode ?? 'none'}`}</p>
      <p>{`selected mining mode: ${data.miningMode ?? 'none'}`}</p>
      <p>{`selected pool: ${data.pool?.name ?? 'none'}`}</p>
      <button
        type="button"
        onClick={() => {
          if (nextUpdates) {
            updateData(nextUpdates);
          }
          onNext();
        }}
      >
        {buttonLabel}
      </button>
      <button type="button" onClick={onBack}>
        step back
      </button>
    </div>
  );
}

vi.mock('./steps/MiningModeSelection', () => ({
  MiningModeSelection: createStepMock('Mining Mode', 'choose pool mining', { miningMode: 'pool' }),
}));

vi.mock('./steps/TemplateModeSelection', () => ({
  TemplateModeSelection: createStepMock('Template Mode', 'choose no-jd', { mode: 'no-jd' }),
}));

vi.mock('./steps/PoolConfigStep', () => ({
  PoolConfigStep: createStepMock('Pool Step', 'continue pool step'),
}));

vi.mock('./steps/BitcoinPrereqStep', () => ({
  BitcoinPrereqStep: createStepMock('Bitcoin Prereq', 'continue bitcoin prereq'),
}));

vi.mock('./steps/BitcoinSetup', () => ({
  BitcoinSetup: createStepMock('Bitcoin Setup', 'continue bitcoin setup'),
}));

vi.mock('./steps/HashrateStep', () => ({
  HashrateStep: createStepMock('Hashrate Step', 'continue hashrate step'),
}));

vi.mock('./steps/MiningIdentityStep', () => ({
  MiningIdentityStep: createStepMock('Identity Step', 'continue identity step'),
}));

vi.mock('./steps/ReviewStart', () => ({
  ReviewStart: createStepMock('Review Step', 'complete setup'),
}));

import { SetupWizard, computeSteps } from './SetupWizard';

describe('SetupWizard', () => {
  beforeEach(() => {
    mocks.mockGetCurrentConfig.mockResolvedValue(null);
    mocks.mockNavigate.mockReset();
  });

  it('computes wizard steps for each supported mode combination', () => {
    const base: SetupData = {
      miningMode: null,
      mode: null,
      pool: null,
      bitcoin: null,
      jdc: null,
      translator: null,
    };

    expect(computeSteps(base)).toEqual(['mining-mode']);

    expect(computeSteps({ ...base, miningMode: 'pool', mode: 'jd' })).toEqual([
      'mining-mode',
      'template-mode',
      'pool',
      'bitcoin-prereq',
      'bitcoin',
      'hashrate',
      'identity',
      'review',
    ]);

    expect(computeSteps({ ...base, miningMode: 'pool', mode: 'no-jd' })).toEqual([
      'mining-mode',
      'template-mode',
      'pool',
      'hashrate',
      'identity',
      'review',
    ]);

    expect(computeSteps({ ...base, miningMode: 'solo', mode: 'jd' })).toEqual([
      'mining-mode',
      'template-mode',
      'bitcoin-prereq',
      'bitcoin',
      'hashrate',
      'identity',
      'review',
    ]);

    expect(computeSteps({ ...base, miningMode: 'solo', mode: 'no-jd' })).toEqual([
      'mining-mode',
      'template-mode',
      'pool',
      'hashrate',
      'identity',
      'review',
    ]);
  });

  it('advances through the wizard and preserves step state on back navigation', async () => {
    render(<SetupWizard />);

    expect(await screen.findByRole('heading', { name: 'Mining Mode' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Switch to (dark|light) mode/i }));

    fireEvent.click(screen.getByRole('button', { name: 'choose pool mining' }));

    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 350);
      });
    });

    expect(screen.getByRole('heading', { name: 'Template Mode' })).toBeInTheDocument();
    expect(screen.getByText('selected mining mode: pool')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'choose no-jd' }));

    expect(screen.getByRole('heading', { name: 'Pool Step' })).toBeInTheDocument();
    expect(screen.getByText('selected mode: no-jd')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));

    expect(screen.getByRole('heading', { name: 'Template Mode' })).toBeInTheDocument();
    expect(screen.getByText('selected mode: no-jd')).toBeInTheDocument();
  });
});
