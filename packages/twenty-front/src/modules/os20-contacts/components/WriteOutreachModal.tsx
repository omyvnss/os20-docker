import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { SettingsPath } from 'twenty-shared/types';
import {
  IconAlertTriangle,
  IconCopy,
  IconMail,
  IconRefresh,
  IconSend,
  IconSettings,
  IconSparkles,
} from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { ShimmeringText } from '@/ai/components/ShimmeringText';
import { EmailStatusChip } from '@/os20-contacts/components/EmailStatusChip';
import { Os20ContactsModalLayout } from '@/os20-contacts/components/Os20ContactsModalLayout';
import { OutreachToneSelector } from '@/os20-contacts/components/OutreachToneSelector';
import { useGenerateOutreach } from '@/os20-contacts/hooks/useGenerateOutreach';
import { type Os20EmailStatus } from '@/os20-contacts/types/Os20EmailStatus';
import { type Os20OutreachTone } from '@/os20-contacts/types/Os20OutreachTone';
import { buildMailtoUrl } from '@/os20-contacts/utils/buildMailtoUrl';
import { useOs20EmailSender } from '@/os20-email/hooks/useOs20EmailSender';
import { useSendOutreachEmail } from '@/os20-email/hooks/useSendOutreachEmail';
import { formatOs20Sender } from '@/os20-email/utils/formatOs20Sender';
import { getOs20OutreachSendBlock } from '@/os20-email/utils/getOs20OutreachSendBlock';
import { isRiskyOs20EmailStatus } from '@/os20-email/utils/isRiskyOs20EmailStatus';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';
import { TextArea } from '@/ui/input/components/TextArea';
import { useCopyToClipboard } from '~/hooks/useCopyToClipboard';
import { useNavigateSettings } from '~/hooks/useNavigateSettings';

const StyledRecipient = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  flex-wrap: wrap;
  font-size: ${themeCssVariables.font.size.md};
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledRecipientLabel = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
`;

const StyledControls = styled.div`
  align-items: flex-end;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[3]};
  justify-content: space-between;
`;

const StyledCallout = styled.div<{ isError: boolean }>`
  background-color: ${({ isError }) =>
    isError
      ? themeCssVariables.background.transparent.danger
      : themeCssVariables.background.transparent.lighter};
  border: 1px solid
    ${({ isError }) =>
      isError
        ? themeCssVariables.border.color.danger
        : themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledCalloutTitle = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledCalloutText = styled.p`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
`;

const StyledCalloutActions = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledPlaceholder = styled.div`
  border: 1px dashed ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.md};
  padding: ${themeCssVariables.spacing[6]} ${themeCssVariables.spacing[4]};
  text-align: center;
`;

const StyledConfirmRows = styled.dl`
  display: grid;
  gap: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[3]};
  grid-template-columns: max-content minmax(0, 1fr);
  margin: 0;
`;

const StyledConfirmLabel = styled.dt`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledConfirmValue = styled.dd`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
  overflow-wrap: anywhere;
`;

const StyledFooterNote = styled.span`
  align-items: center;
  display: inline-flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledEditor = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
`;

type WriteOutreachModalProps = {
  modalInstanceId: string;
  personId: string;
  personName: string;
  primaryEmail: string | null;
  emailStatus: Os20EmailStatus | null;
  onClose: () => void;
};

export const WriteOutreachModal = ({
  modalInstanceId,
  personId,
  personName,
  primaryEmail,
  emailStatus,
  onClose,
}: WriteOutreachModalProps) => {
  const { t } = useLingui();
  const navigateSettings = useNavigateSettings();
  const { copyToClipboard } = useCopyToClipboard();
  const { generateOutreach, isGenerating, error } = useGenerateOutreach();
  const { enqueueSuccessSnackBar } = useSnackBar();
  const {
    status: senderStatus,
    isLoading: isSenderLoading,
    applyQuota,
  } = useOs20EmailSender();
  const {
    sendOutreachEmail,
    isSending,
    error: sendError,
    clearError: clearSendError,
  } = useSendOutreachEmail();
  const [isConfirmingSend, setIsConfirmingSend] = useState(false);

  const [tone, setTone] = useState<Os20OutreachTone>('friendly');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [hasDraft, setHasDraft] = useState(false);

  const isEmpty = subject.trim().length === 0 && body.trim().length === 0;
  const canSendDraft = subject.trim().length > 0 && body.trim().length > 0;
  const sendBlock = getOs20OutreachSendBlock({
    status: senderStatus,
    isLoading: isSenderLoading,
    primaryEmail,
  });
  const isRiskyRecipient = isRiskyOs20EmailStatus(emailStatus);
  const sender = senderStatus?.sender ?? null;

  const handleGenerate = async () => {
    const draft = await generateOutreach({ personId, tone });

    if (draft === null) return;

    setSubject(draft.subject);
    setBody(draft.body);
    setHasDraft(true);
  };

  const handleCopy = () =>
    copyToClipboard(
      subject.trim() ? `${subject.trim()}\n\n${body}` : body,
      t`Email copied`,
    );

  const handleOpenInMailApp = () => {
    window.location.href = buildMailtoUrl({ to: primaryEmail, subject, body });
  };

  const handleOpenEmailSettings = () => {
    onClose();
    navigateSettings(SettingsPath.EmailSending);
  };

  const handleStartSend = () => {
    clearSendError();
    setIsConfirmingSend(true);
  };

  const handleConfirmSend = async () => {
    const result = await sendOutreachEmail({
      personId,
      subject: subject.trim(),
      body,
      confirm: isRiskyRecipient,
    });

    if (result === null) return;

    applyQuota(result.sentToday, result.remaining);
    setIsConfirmingSend(false);
    enqueueSuccessSnackBar({ message: t`Email sent to ${result.to}` });
    onClose();
  };

  const renderFooterStart = () => {
    if (sendBlock === 'NO_SENDER' && !isEmpty) {
      return (
        <StyledFooterNote>
          {t`Connect your email to send from OS20.`}
          <Button
            size="small"
            variant="tertiary"
            Icon={IconSettings}
            title={t`Email sending settings`}
            onClick={handleOpenEmailSettings}
          />
        </StyledFooterNote>
      );
    }

    if (primaryEmail === null && !isEmpty) {
      return t`No email on file. Add the recipient in your mail app.`;
    }

    if (sendBlock === 'LIMIT_REACHED') {
      return t`Daily sending limit reached. Try again tomorrow.`;
    }

    if (senderStatus?.connected === true) {
      const remaining = senderStatus.remaining;
      const dailyLimit = senderStatus.dailyLimit;

      return t`${remaining} of ${dailyLimit} sends left today`;
    }

    return undefined;
  };

  const handleOpenAiProviders = () => {
    onClose();
    navigateSettings(SettingsPath.AIProviders);
  };

  return (
    <Os20ContactsModalLayout
      modalInstanceId={modalInstanceId}
      title={t`Write outreach`}
      subtitle={t`A first email to ${personName}, written from what OS20 knows about them and their company.`}
      onClose={onClose}
      footer={
        <>
          <Button
            size="small"
            variant="secondary"
            Icon={IconCopy}
            title={t`Copy`}
            onClick={handleCopy}
            disabled={isEmpty}
          />
          <Button
            size="small"
            variant="secondary"
            Icon={IconMail}
            title={t`Open in mail app`}
            onClick={handleOpenInMailApp}
            disabled={isEmpty}
          />
          <Button
            size="small"
            variant="primary"
            accent="blue"
            Icon={IconSend}
            title={t`Send`}
            onClick={handleStartSend}
            isLoading={isSending}
            disabled={
              !canSendDraft ||
              sendBlock !== null ||
              isGenerating ||
              isSending ||
              isConfirmingSend
            }
          />
        </>
      }
      footerStart={renderFooterStart()}
    >
      <StyledRecipient>
        <StyledRecipientLabel>{t`To`}</StyledRecipientLabel>
        <span>{primaryEmail ?? t`No email on file`}</span>
        {emailStatus && <EmailStatusChip status={emailStatus} />}
      </StyledRecipient>

      <StyledControls>
        <OutreachToneSelector
          value={tone}
          onChange={setTone}
          disabled={isGenerating || isConfirmingSend}
        />
        <Button
          size="small"
          variant="primary"
          accent="blue"
          Icon={hasDraft ? IconRefresh : IconSparkles}
          title={hasDraft ? t`Rewrite` : t`Generate`}
          onClick={handleGenerate}
          isLoading={isGenerating}
          disabled={isGenerating || isConfirmingSend}
        />
      </StyledControls>

      {error !== null && error.isMissingAiKey && (
        <StyledCallout isError={false} role="alert">
          <StyledCalloutTitle>
            <IconSparkles size={16} />
            {t`Add an AI key to write emails`}
          </StyledCalloutTitle>
          <StyledCalloutText>
            {t`OS20 uses your own AI provider key. Add one in Settings, then come back and generate.`}
          </StyledCalloutText>
          <StyledCalloutActions>
            <Button
              size="small"
              variant="secondary"
              Icon={IconSettings}
              title={t`Open AI Providers`}
              onClick={handleOpenAiProviders}
            />
          </StyledCalloutActions>
        </StyledCallout>
      )}

      {error !== null && !error.isMissingAiKey && (
        <StyledCallout isError role="alert">
          <StyledCalloutTitle>
            <IconAlertTriangle size={16} />
            {t`Could not write the email`}
          </StyledCalloutTitle>
          <StyledCalloutText>{error.message}</StyledCalloutText>
        </StyledCallout>
      )}

      {!hasDraft && isGenerating && (
        <StyledPlaceholder role="status" aria-live="polite">
          <ShimmeringText>{t`Writing your email...`}</ShimmeringText>
        </StyledPlaceholder>
      )}

      {!hasDraft && !isGenerating && error === null && (
        <StyledPlaceholder>
          {t`Pick a tone and generate a draft. You can edit it before sending.`}
        </StyledPlaceholder>
      )}

      {isConfirmingSend && sender !== null && primaryEmail !== null && (
        <StyledCallout isError={isRiskyRecipient} role="alertdialog">
          <StyledCalloutTitle>
            {isRiskyRecipient ? (
              <IconAlertTriangle size={16} />
            ) : (
              <IconSend size={16} />
            )}
            {t`Send this email now?`}
          </StyledCalloutTitle>
          <StyledConfirmRows>
            <StyledConfirmLabel>{t`To`}</StyledConfirmLabel>
            <StyledConfirmValue>{primaryEmail}</StyledConfirmValue>
            <StyledConfirmLabel>{t`From`}</StyledConfirmLabel>
            <StyledConfirmValue>{formatOs20Sender(sender)}</StyledConfirmValue>
          </StyledConfirmRows>
          {isRiskyRecipient && (
            <StyledCalloutText>
              {emailStatus === 'INVALID'
                ? t`This address failed verification and will likely bounce. Bounces can hurt your sender reputation.`
                : t`This address was guessed, not verified. It may bounce.`}
            </StyledCalloutText>
          )}
          {sendError !== null && (
            <StyledCalloutText role="alert">{sendError}</StyledCalloutText>
          )}
          <StyledCalloutActions>
            <Button
              size="small"
              variant="secondary"
              title={t`Cancel`}
              onClick={() => setIsConfirmingSend(false)}
              disabled={isSending}
            />
            <Button
              size="small"
              variant="primary"
              accent={isRiskyRecipient ? 'danger' : 'blue'}
              Icon={IconSend}
              title={isRiskyRecipient ? t`Send anyway` : t`Send now`}
              onClick={handleConfirmSend}
              isLoading={isSending}
              disabled={isSending}
            />
          </StyledCalloutActions>
        </StyledCallout>
      )}

      {hasDraft && (
        <StyledEditor>
          <SettingsTextInput
            instanceId={`${modalInstanceId}-subject`}
            label={t`Subject`}
            value={subject}
            onChange={setSubject}
            disabled={isGenerating || isConfirmingSend}
            fullWidth
          />
          <TextArea
            textAreaId={`${modalInstanceId}-body`}
            label={t`Message`}
            value={body}
            onChange={setBody}
            disabled={isGenerating || isConfirmingSend}
            minRows={8}
            maxRows={16}
          />
        </StyledEditor>
      )}
    </Os20ContactsModalLayout>
  );
};
