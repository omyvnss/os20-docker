import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { fireEvent, render } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { type ReactNode } from 'react';
import { SOURCE_LOCALE } from 'twenty-shared/translations';
import { SettingsPath } from 'twenty-shared/types';

import { Os20FirstRunChecklist } from '@/os20-first-run/components/Os20FirstRunChecklist';
import { type Os20FirstRunStatus } from '@/os20-first-run/hooks/useOs20FirstRunStatus';
import {
  jotaiStore,
  resetJotaiStore,
} from '@/ui/utilities/state/jotai/jotaiStore';
import { messages } from '~/locales/generated/en';

i18n.load({
  [SOURCE_LOCALE]: messages,
});
i18n.activate(SOURCE_LOCALE);

const mockNavigateSettings = jest.fn();
const mockOpenAskAiPage = jest.fn();
const mockRefresh = jest.fn();
let mockStatus: Os20FirstRunStatus;

jest.mock('@/os20-first-run/hooks/useOs20FirstRunStatus', () => ({
  useOs20FirstRunStatus: () => ({ status: mockStatus, refresh: mockRefresh }),
}));

jest.mock('~/hooks/useNavigateSettings', () => ({
  useNavigateSettings: () => mockNavigateSettings,
}));

jest.mock('@/side-panel/hooks/useOpenAskAiPageInSidePanel', () => ({
  useOpenAskAiPageInSidePanel: () => ({ openAskAiPage: mockOpenAskAiPage }),
}));

const Wrapper = ({ children }: { children: ReactNode }) => (
  <JotaiProvider store={jotaiStore}>
    <I18nProvider i18n={i18n}>{children}</I18nProvider>
  </JotaiProvider>
);

describe('Os20FirstRunChecklist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetJotaiStore();
    mockStatus = {
      isLoaded: true,
      hasAiKey: false,
      hasSearchKey: false,
      hasPlacesKey: false,
      hasRunLeadSearch: false,
    };
  });

  it('renders nothing until the status is loaded', () => {
    mockStatus = { ...mockStatus, isLoaded: false };

    const { container } = render(<Os20FirstRunChecklist />, {
      wrapper: Wrapper,
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when every step is done', () => {
    mockStatus = {
      isLoaded: true,
      hasAiKey: true,
      hasSearchKey: true,
      hasPlacesKey: false,
      hasRunLeadSearch: true,
    };

    const { container } = render(<Os20FirstRunChecklist />, {
      wrapper: Wrapper,
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('links each open step to its destination', () => {
    const { getAllByText, getByText } = render(<Os20FirstRunChecklist />, {
      wrapper: Wrapper,
    });

    const [aiKeyButton, searchKeyButton] = getAllByText('Add key');

    fireEvent.click(aiKeyButton);
    fireEvent.click(searchKeyButton);
    fireEvent.click(getByText('Open Ask AI'));

    expect(mockNavigateSettings).toHaveBeenNthCalledWith(
      1,
      SettingsPath.AIProviders,
    );
    expect(mockNavigateSettings).toHaveBeenNthCalledWith(
      2,
      SettingsPath.WebSearchApis,
    );
    expect(mockOpenAskAiPage).toHaveBeenCalled();
  });

  it('hides the action for a completed step', () => {
    mockStatus = { ...mockStatus, hasAiKey: true };

    const { getAllByText } = render(<Os20FirstRunChecklist />, {
      wrapper: Wrapper,
    });

    expect(getAllByText('Add key')).toHaveLength(1);
  });
});
