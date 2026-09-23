import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { SOURCE_LOCALE } from 'twenty-shared/translations';

import { InformationBannerOs20Update } from '@/os20-updates/components/InformationBannerOs20Update';
import { type Os20UpdateStatus } from '@/os20-updates/types/Os20UpdateStatus';
import { OS20_UPDATE_DISMISSED_VERSION_KEY } from '@/os20-updates/utils/os20UpdateBannerDismissal';
import { messages } from '~/locales/generated/en';

i18n.load({ [SOURCE_LOCALE]: messages });
i18n.activate(SOURCE_LOCALE);

let mockStatus: Os20UpdateStatus | null = null;
const mockCopy = jest.fn();

jest.mock('@/os20-updates/hooks/useOs20UpdateStatus', () => ({
  useOs20UpdateStatus: () => ({ status: mockStatus, isLoaded: true }),
}));

jest.mock('~/hooks/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({ copyToClipboard: mockCopy }),
}));

const renderBanner = () =>
  render(
    <I18nProvider i18n={i18n}>
      <InformationBannerOs20Update />
    </I18nProvider>,
  );

describe('InformationBannerOs20Update', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockCopy.mockReset();
    mockStatus = {
      currentVersion: '2.37.0',
      latestVersion: '2.38.0',
      updateAvailable: true,
      releaseNotesUrl: 'https://github.com/omyvnss/os20/releases/tag/v2.38.0',
      checkedAt: '2026-09-22T00:00:00.000Z',
      checkEnabled: true,
    };
  });

  it('renders nothing when no update is available', () => {
    mockStatus = { ...mockStatus!, updateAvailable: false };

    const { container } = renderBanner();

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the notice and copies the update command', () => {
    renderBanner();

    expect(screen.getByText(/2\.38\.0 is available/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Copy command'));

    expect(mockCopy).toHaveBeenCalledWith(
      'npx os20-cli update',
      expect.any(String),
    );
  });

  it('hides after dismiss and remembers the version', () => {
    renderBanner();

    fireEvent.click(screen.getByLabelText('Dismiss update notice'));

    expect(screen.queryByText(/is available/)).not.toBeInTheDocument();
    expect(window.localStorage.getItem(OS20_UPDATE_DISMISSED_VERSION_KEY)).toBe(
      '2.38.0',
    );
  });

  it('stays hidden for a dismissed version but returns for a newer one', () => {
    window.localStorage.setItem(OS20_UPDATE_DISMISSED_VERSION_KEY, '2.38.0');

    const { container, unmount } = renderBanner();

    expect(container).toBeEmptyDOMElement();
    unmount();

    mockStatus = { ...mockStatus!, latestVersion: '2.39.0' };
    renderBanner();

    expect(screen.getByText(/2\.39\.0 is available/)).toBeInTheDocument();
  });
});
