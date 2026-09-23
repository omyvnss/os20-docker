import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { fireEvent, render } from '@testing-library/react';
import { type ReactNode } from 'react';
import { SOURCE_LOCALE } from 'twenty-shared/translations';
import { SettingsPath } from 'twenty-shared/types';

import { LeadsSearchBar } from '@/os20-leads/components/LeadsSearchBar';
import { messages } from '~/locales/generated/en';

i18n.load({
  [SOURCE_LOCALE]: messages,
});
i18n.activate(SOURCE_LOCALE);

const mockNavigateSettings = jest.fn();

jest.mock('~/hooks/useNavigateSettings', () => ({
  useNavigateSettings: () => mockNavigateSettings,
}));

jest.mock('@/ui/input/components/SettingsTextInput', () => ({
  SettingsTextInput: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <input
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

const Wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider i18n={i18n}>{children}</I18nProvider>
);

describe('LeadsSearchBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('submits the query with a clamped count', () => {
    const onSearch = jest.fn();
    const { getByLabelText, getByText } = render(
      <LeadsSearchBar
        isSearching={false}
        missingAiKey={false}
        missingSourceKey={false}
        onSearch={onSearch}
      />,
      { wrapper: Wrapper },
    );

    fireEvent.change(getByLabelText('Industry or keywords'), {
      target: { value: 'dentists' },
    });
    fireEvent.change(getByLabelText('Location'), {
      target: { value: 'Austin' },
    });
    fireEvent.change(getByLabelText('Count'), { target: { value: '80' } });
    fireEvent.click(getByText('Find leads'));

    expect(onSearch).toHaveBeenCalledWith({
      query: 'dentists',
      location: 'Austin',
      count: 25,
    });
  });

  it('disables search and links to settings when keys are missing', () => {
    const onSearch = jest.fn();
    const { getByLabelText, getByText } = render(
      <LeadsSearchBar
        isSearching={false}
        missingAiKey
        missingSourceKey
        onSearch={onSearch}
      />,
      { wrapper: Wrapper },
    );

    fireEvent.change(getByLabelText('Industry or keywords'), {
      target: { value: 'dentists' },
    });
    fireEvent.click(getByText('Find leads'));
    fireEvent.click(getByText('AI Providers'));
    fireEvent.click(getByText('Lead Sources'));

    expect(onSearch).not.toHaveBeenCalled();
    expect(mockNavigateSettings).toHaveBeenNthCalledWith(
      1,
      SettingsPath.AIProviders,
    );
    expect(mockNavigateSettings).toHaveBeenNthCalledWith(
      2,
      SettingsPath.WebSearchApis,
    );
  });
});
