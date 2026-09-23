import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { act, fireEvent, render } from '@testing-library/react';
import { type ReactNode } from 'react';
import { SOURCE_LOCALE } from 'twenty-shared/translations';

import { LeadSourceProviderCard } from '@/os20-lead-sources/components/LeadSourceProviderCard';
import { LEAD_SOURCE_PROVIDERS } from '@/os20-lead-sources/constants/LeadSourceProviders';
import { messages } from '~/locales/generated/en';

i18n.load({
  [SOURCE_LOCALE]: messages,
});
i18n.activate(SOURCE_LOCALE);

jest.mock('@/ui/input/components/SettingsTextInput', () => ({
  SettingsTextInput: () => <input />,
}));

const Wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider i18n={i18n}>{children}</I18nProvider>
);

const placesProvider = LEAD_SOURCE_PROVIDERS.find(
  (provider) => provider.id === 'google_places',
)!;

const renderCard = (
  props: Partial<Parameters<typeof LeadSourceProviderCard>[0]> = {},
) =>
  render(
    <LeadSourceProviderCard
      provider={placesProvider}
      maskedKey="AIza****1234"
      isSaving={false}
      hasError={false}
      onSave={jest.fn()}
      onDelete={jest.fn()}
      // oxlint-disable-next-line react/jsx-props-no-spreading
      {...props}
    />,
    { wrapper: Wrapper },
  );

describe('LeadSourceProviderCard test button', () => {
  it('is hidden without onTest or without a saved key', () => {
    expect(renderCard().queryByText('Test')).toBeNull();
    expect(
      renderCard({ maskedKey: undefined, onTest: jest.fn() }).queryByText(
        'Test',
      ),
    ).toBeNull();
  });

  it('shows the result count when the key works', async () => {
    const onTest = jest.fn().mockResolvedValue({ ok: true, resultCount: 1 });
    const { getByText, findByRole } = renderCard({ onTest });

    await act(async () => {
      fireEvent.click(getByText('Test'));
    });

    expect(onTest).toHaveBeenCalledTimes(1);
    expect((await findByRole('status')).textContent).toBe(
      'Key works. 1 result returned.',
    );
  });

  it('shows the server error when the key fails', async () => {
    const onTest = jest.fn().mockResolvedValue({
      ok: false,
      resultCount: 0,
      error: 'API key not valid.',
    });
    const { getByText, findByRole } = renderCard({ onTest });

    await act(async () => {
      fireEvent.click(getByText('Test'));
    });

    expect((await findByRole('status')).textContent).toBe('API key not valid.');
  });
});
