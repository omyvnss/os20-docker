import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { Status } from 'twenty-ui/data-display';
import { IconSend, IconTrash } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { H2Title } from 'twenty-ui/typography';

import { Os20SegmentedControl } from '@/os20-email/components/Os20SegmentedControl';
import { OS20_SMTP_PRESETS } from '@/os20-email/constants/Os20SmtpPresets';
import { useOs20EmailSender } from '@/os20-email/hooks/useOs20EmailSender';
import { type Os20EmailSenderStatus } from '@/os20-email/types/Os20EmailSenderStatus';
import { type Os20SmtpForm } from '@/os20-email/types/Os20SmtpForm';
import { type Os20SmtpPresetId } from '@/os20-email/types/Os20SmtpPresetId';
import { applyOs20SmtpPreset } from '@/os20-email/utils/applyOs20SmtpPreset';
import { buildOs20SmtpPayload } from '@/os20-email/utils/buildOs20SmtpPayload';
import { detectOs20SmtpPreset } from '@/os20-email/utils/detectOs20SmtpPreset';
import { formatOs20Sender } from '@/os20-email/utils/formatOs20Sender';
import { getOs20SmtpFormError } from '@/os20-email/utils/getOs20SmtpFormError';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';

const StyledCard = styled.div`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledRow = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[3]};
  justify-content: space-between;
`;

const StyledSenderName = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  overflow-wrap: anywhere;
`;

const StyledMuted = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledHint = styled.p`
  background-color: ${themeCssVariables.background.transparent.lighter};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledGrid = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[3]};
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
`;

const StyledActions = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledMessage = styled.span<{ isError: boolean }>`
  color: ${({ isError }) =>
    isError
      ? themeCssVariables.font.color.danger
      : themeCssVariables.color.green};
  font-size: ${themeCssVariables.font.size.sm};
`;

type Feedback = { isError: boolean; text: string } | null;

const EMPTY_FORM: Os20SmtpForm = applyOs20SmtpPreset(
  {
    presetId: 'custom',
    host: '',
    port: '587',
    secure: false,
    username: '',
    password: '',
    fromName: '',
    fromEmail: '',
    dailyLimit: '30',
  },
  'gmail',
);

const formFromStatus = (status: Os20EmailSenderStatus): Os20SmtpForm => {
  if (status.sender === null) {
    return { ...EMPTY_FORM, dailyLimit: String(status.dailyLimit) };
  }

  const { sender } = status;

  return {
    presetId: detectOs20SmtpPreset(sender.host),
    host: sender.host,
    port: String(sender.port),
    secure: sender.secure,
    username: sender.username,
    password: '',
    fromName: sender.fromName ?? '',
    fromEmail: sender.fromEmail,
    dailyLimit: String(status.dailyLimit),
  };
};

export const SettingsEmailSending = () => {
  const { t, i18n } = useLingui();
  const { status, isLoading, save, remove, sendTest } = useOs20EmailSender();

  const [form, setForm] = useState<Os20SmtpForm>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<Feedback>(null);
  const [testFeedback, setTestFeedback] = useState<Feedback>(null);

  useEffect(() => {
    if (status !== null) setForm(formFromStatus(status));
  }, [status]);

  const isConnected = status?.connected === true && status.sender !== null;
  const preset = OS20_SMTP_PRESETS.find(
    (option) => option.id === form.presetId,
  );

  const update = (patch: Partial<Os20SmtpForm>) =>
    setForm((previous) => ({ ...previous, ...patch }));

  const handleSave = async () => {
    const formError = getOs20SmtpFormError(form, {
      hasSavedPassword:
        isConnected && status?.sender?.fromEmail === form.fromEmail.trim(),
    });

    if (formError !== null) {
      setSaveFeedback({ isError: true, text: formError });

      return;
    }

    setIsSaving(true);
    setSaveFeedback(null);
    setTestFeedback(null);

    const result = await save(buildOs20SmtpPayload(form));

    setIsSaving(false);
    setSaveFeedback(
      result.ok
        ? {
            isError: false,
            text: t`Saved. The connection to your server works.`,
          }
        : { isError: true, text: result.error },
    );
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestFeedback(null);

    const result = await sendTest();

    setIsTesting(false);
    setTestFeedback(
      result.ok
        ? { isError: false, text: result.message ?? t`Test email sent.` }
        : { isError: true, text: result.error },
    );
  };

  const handleRemove = async () => {
    setIsRemoving(true);

    const result = await remove();

    setIsRemoving(false);
    setTestFeedback(null);
    setSaveFeedback(
      result.ok
        ? { isError: false, text: t`Sender removed.` }
        : { isError: true, text: result.error },
    );
  };

  const presetOptions = OS20_SMTP_PRESETS.map((option) => ({
    value: option.id,
    label: i18n._(option.label),
  }));

  const securityOptions: { value: 'ssl' | 'starttls'; label: string }[] = [
    { value: 'ssl', label: t`SSL/TLS` },
    { value: 'starttls', label: t`STARTTLS` },
  ];

  return (
    <SettingsPageLayout
      title={t`Email sending`}
      links={[
        { children: t`Workspace`, href: getSettingsPath(SettingsPath.General) },
        { children: t`Email sending` },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          <H2Title
            title={t`Sender`}
            description={t`Outreach is sent from your own email account over SMTP. Your password is encrypted in your workspace and never shown again.`}
          />
          <StyledCard>
            {isLoading && status === null ? (
              <StyledMuted>{t`Loading...`}</StyledMuted>
            ) : isConnected && status?.sender ? (
              <>
                <StyledRow>
                  <div>
                    <StyledSenderName>
                      {formatOs20Sender(status.sender)}
                    </StyledSenderName>
                    <StyledMuted>
                      {`${status.sender.host}:${status.sender.port}`}
                    </StyledMuted>
                  </div>
                  <Status color="green" text={t`Connected`} />
                </StyledRow>
                <StyledMuted>
                  {t`${status.sentToday} of ${status.dailyLimit} outreach emails sent today.`}
                </StyledMuted>
                <StyledActions>
                  <Button
                    size="small"
                    variant="secondary"
                    Icon={IconSend}
                    title={isTesting ? t`Sending...` : t`Send test email`}
                    onClick={handleTest}
                    disabled={isTesting}
                  />
                  <Button
                    size="small"
                    variant="secondary"
                    accent="danger"
                    Icon={IconTrash}
                    title={t`Remove`}
                    onClick={handleRemove}
                    disabled={isRemoving}
                  />
                  {testFeedback && (
                    <StyledMessage role="status" isError={testFeedback.isError}>
                      {testFeedback.text}
                    </StyledMessage>
                  )}
                </StyledActions>
              </>
            ) : (
              <StyledRow>
                <StyledMuted>
                  {t`No sender connected. Outreach can only be copied or opened in your mail app.`}
                </StyledMuted>
                <Status color="gray" text={t`Not connected`} />
              </StyledRow>
            )}
          </StyledCard>
        </Section>

        <Section>
          <H2Title
            title={isConnected ? t`Update SMTP settings` : t`Connect SMTP`}
            description={t`Pick your provider to fill in the server details.`}
          />
          <StyledCard>
            <Os20SegmentedControl<Os20SmtpPresetId>
              label={t`Provider`}
              options={presetOptions}
              value={form.presetId}
              onChange={(presetId) =>
                setForm((previous) => applyOs20SmtpPreset(previous, presetId))
              }
              disabled={isSaving}
            />
            {preset && <StyledHint>{i18n._(preset.hint)}</StyledHint>}

            <StyledGrid>
              <SettingsTextInput
                instanceId="os20-smtp-from-email"
                label={t`From email`}
                placeholder="you@company.com"
                value={form.fromEmail}
                onChange={(fromEmail) => update({ fromEmail })}
                autoComplete="email"
                fullWidth
              />
              <SettingsTextInput
                instanceId="os20-smtp-from-name"
                label={t`From name`}
                placeholder={t`Your name`}
                value={form.fromName}
                onChange={(fromName) => update({ fromName })}
                fullWidth
              />
              <SettingsTextInput
                instanceId="os20-smtp-host"
                label={t`SMTP host`}
                placeholder="smtp.example.com"
                value={form.host}
                onChange={(host) => update({ host, presetId: 'custom' })}
                fullWidth
              />
              <SettingsTextInput
                instanceId="os20-smtp-port"
                label={t`Port`}
                type="number"
                value={form.port}
                onChange={(port) =>
                  update({
                    port,
                    secure:
                      port === '465'
                        ? true
                        : port === '587'
                          ? false
                          : form.secure,
                  })
                }
                fullWidth
              />
              <SettingsTextInput
                instanceId="os20-smtp-username"
                label={t`Username`}
                placeholder={t`Defaults to the from email`}
                value={form.username}
                onChange={(username) => update({ username })}
                autoComplete="off"
                fullWidth
              />
              <SettingsTextInput
                instanceId="os20-smtp-password"
                label={form.presetId === 'resend' ? t`API key` : t`Password`}
                type="password"
                placeholder={
                  isConnected
                    ? t`Leave empty to keep the saved one`
                    : form.presetId === 'gmail'
                      ? t`16 character app password`
                      : ''
                }
                value={form.password}
                onChange={(password) => update({ password })}
                autoComplete="new-password"
                fullWidth
              />
              <SettingsTextInput
                instanceId="os20-smtp-daily-limit"
                label={t`Daily limit`}
                type="number"
                value={form.dailyLimit}
                onChange={(dailyLimit) => update({ dailyLimit })}
                fullWidth
              />
            </StyledGrid>

            <Os20SegmentedControl<'ssl' | 'starttls'>
              label={t`Security`}
              options={securityOptions}
              value={form.secure ? 'ssl' : 'starttls'}
              onChange={(value) => update({ secure: value === 'ssl' })}
              disabled={isSaving}
            />

            <StyledActions>
              <Button
                variant="primary"
                accent="blue"
                title={
                  isSaving ? t`Checking connection...` : t`Save and connect`
                }
                onClick={handleSave}
                disabled={isSaving}
              />
              {saveFeedback && (
                <StyledMessage role="status" isError={saveFeedback.isError}>
                  {saveFeedback.text}
                </StyledMessage>
              )}
            </StyledActions>
          </StyledCard>
        </Section>
      </SettingsPageContainer>
    </SettingsPageLayout>
  );
};
