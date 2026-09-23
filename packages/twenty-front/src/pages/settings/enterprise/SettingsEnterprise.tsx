import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { SET_ENTERPRISE_KEY } from '@/settings/enterprise/graphql/mutations/setEnterpriseKey';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';
import { useLoadCurrentUser } from '@/users/hooks/useLoadCurrentUser';
import { useMutation } from '@apollo/client/react';
import { Button } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { H2Title } from 'twenty-ui/typography';
import { isGraphqlErrorOfType } from '~/utils/is-graphql-error-of-type.util';

const RELEASE_ENTERPRISE_BINDING_CONFIRMATION_MODAL_ID =
  'release-enterprise-binding-confirmation-modal';

type SubscriptionStatus = {
  status: string | null;
};

export const SettingsEnterprise = () => {
  const { t } = useLingui();
  const { enqueueErrorSnackBar, enqueueSuccessSnackBar } = useSnackBar();
  const { loadCurrentUser } = useLoadCurrentUser();
  const [enterpriseKey, setEnterpriseKey] = useState('');
  const [isActivating, setIsActivating] = useState(false);

  const [setEnterpriseKeyMutation] = useMutation<{
    setEnterpriseKey: {
      isValid: boolean;
      licensee: string | null;
      expiresAt: string | null;
      subscriptionId: string | null;
    };
  }>(SET_ENTERPRISE_KEY);

  const handleSetKey = async () => {
    if (!enterpriseKey.trim()) {
      return;
    }

    setIsActivating(true);

    try {
      const { data } = await setEnterpriseKeyMutation({
        variables: { enterpriseKey: enterpriseKey.trim() },
      });

      if (data?.setEnterpriseKey.isValid) {
        enqueueSuccessSnackBar({
          message: t`Enterprise key activated successfully`,
        });
        setEnterpriseKey('');
        await loadCurrentUser();
      } else {
        enqueueErrorSnackBar({
          message: t`Invalid enterprise key. Please check your key or contact support.`,
        });
      }
    } catch (error) {
      if (
        isGraphqlErrorOfType(error, 'ENTERPRISE_KEY_BOUND_TO_ANOTHER_SERVER')
      ) {
        enqueueErrorSnackBar({
          message: t`This enterprise key is already bound to another server. Please release it first or use a different key.`,
          options: { duration: 10000 },
        });
      } else if (
        isGraphqlErrorOfType(error, 'ENTERPRISE_MISSING_SERVER_ID') ||
        isGraphqlErrorOfType(
          error,
          'ENTERPRISE_DEV_REQUIRES_ACTIVE_PRODUCTION',
        ) ||
        isGraphqlErrorOfType(error, 'ENTERPRISE_DEV_SLOT_IN_USE') ||
        isGraphqlErrorOfType(error, 'ENTERPRISE_VALIDITY_TOKEN_RATE_LIMITED')
      ) {
        enqueueErrorSnackBar({
          message: t`Could not activate key: ${error.message}`,
          options: { duration: 10000 },
        });
      } else {
        enqueueErrorSnackBar({
          message: t`Failed to activate enterprise key. Please contact support.`,
        });
      }
    } finally {
      setIsActivating(false);
    }
  };

  const activateKeySection = (
    <>
      <Section>
        <H2Title
          title={t`Enterprise Key`}
          description={t`If you have a signed enterprise key, enter it below to activate advanced features. This is optional — all enterprise features are free in this build.`}
        />
        <div style={{ display: 'flex', gap: themeCssVariables.spacing[3] }}>
          <SettingsTextInput
            instanceId="enterprise-key-input"
            value={enterpriseKey}
            onChange={(value) => setEnterpriseKey(value)}
            placeholder={t`Paste your enterprise key here`}
            style={{ flex: 1, maxWidth: 500 }}
          />
          <Button
            title={isActivating ? t`Activating...` : t`Activate key`}
            variant="primary"
            accent="blue"
            onClick={() => handleSetKey()}
            disabled={isActivating || !enterpriseKey.trim()}
          />
        </div>
      </Section>
    </>
  );

  return (
    <SettingsPageLayout links={[{ children: t`Enterprise` }]}>
      <Section>
        <H2Title
          title={t`Enterprise Features`}
          description={t`All enterprise features are enabled (SSO, row-level security, audit logs, etc.).`}
        />
      </Section>
      {activateKeySection}
    </SettingsPageLayout>
  );
};
