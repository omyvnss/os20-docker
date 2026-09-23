import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render } from '@testing-library/react';
import { type ReactNode } from 'react';
import { SOURCE_LOCALE } from 'twenty-shared/translations';

import { EmailStatusChip } from '@/os20-contacts/components/EmailStatusChip';
import { messages } from '~/locales/generated/en';

i18n.load({ [SOURCE_LOCALE]: messages });
i18n.activate(SOURCE_LOCALE);

const Wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider i18n={i18n}>{children}</I18nProvider>
);

describe('EmailStatusChip', () => {
  it('renders a focusable label that explains the status', () => {
    const { getByRole, getByText } = render(
      <EmailStatusChip status="VERIFIED" />,
      { wrapper: Wrapper },
    );

    const anchor = getByRole('img');

    expect(getByText('Verified')).toBeInTheDocument();
    expect(anchor).toHaveAttribute('tabindex', '0');
    expect(anchor).toHaveAttribute(
      'aria-label',
      'Verified. The mail server accepted this address.',
    );
  });

  it('explains guessed emails', () => {
    const { getByRole } = render(<EmailStatusChip status="GUESSED" />, {
      wrapper: Wrapper,
    });

    expect(getByRole('img').getAttribute('aria-label')).toContain(
      'not confirmed',
    );
  });
});
