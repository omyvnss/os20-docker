import { FeatureFlagKey, SettingsPath } from 'twenty-shared/types';

import { currentUserState } from '@/auth/states/currentUserState';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { supportChatState } from '@/client-config/states/supportChatState';
import { usePermissionFlagMap } from '@/settings/roles/hooks/usePermissionFlagMap';
import { getDocumentationUrl } from '@/support/utils/getDocumentationUrl';
import {
  type NavigationDrawerItemIndentationLevel,
  type NavigationDrawerItemModifier,
} from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { t } from '@lingui/core/macro';
import { isNonEmptyString } from '@sniptt/guards';
import {
  IconApps,
  IconAt,
  IconCalendarEvent,
  IconColorSwatch,
  type IconComponent,
  IconHelpCircle,
  IconHierarchy2,
  IconLayout,
  IconMail,
  IconMessage,
  IconMessageCircle,
  IconPlug,
  IconRobot,
  IconServer,
  IconSettings,
  IconSparkles,
  IconUserCircle,
  IconUsers,
  IconSearch,
} from 'twenty-ui/icon';
import { PermissionFlagType } from '~/generated-metadata/graphql';

export type SettingsNavigationSection = {
  label: string;
  items: SettingsNavigationItem[];
  isAdvanced?: boolean;
};

export type SettingsNavigationItem = {
  label: string;
  path?: SettingsPath;
  onClick?: () => void;
  Icon: IconComponent;
  indentationLevel?: NavigationDrawerItemIndentationLevel;
  matchSubPages?: boolean;
  isHidden?: boolean;
  subItems?: SettingsNavigationItem[];
  isAdvanced?: boolean;
  modifier?: NavigationDrawerItemModifier;
};

const useSettingsNavigationItems = (): SettingsNavigationSection[] => {
  const supportChat = useAtomStateValue(supportChatState);
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);

  const currentUser = useAtomStateValue(currentUserState);
  const isAdminEnabled =
    (currentUser?.canImpersonate || currentUser?.canAccessFullAdminPanel) ??
    false;
  const isSupportChatConfigured =
    supportChat?.supportDriver === 'FRONT' &&
    isNonEmptyString(supportChat.supportFrontChatId);

  const permissionMap = usePermissionFlagMap();
  const isEmailGroupFeatureEnabled = useIsFeatureEnabled(
    FeatureFlagKey.IS_EMAIL_GROUP_ENABLED,
  );
  return [
    {
      label: t`User`,
      items: [
        {
          label: t`Profile`,
          path: SettingsPath.ProfilePage,
          Icon: IconUserCircle,
        },
        {
          label: t`Experience`,
          path: SettingsPath.Experience,
          Icon: IconColorSwatch,
        },
        {
          label: t`Accounts`,
          path: SettingsPath.Accounts,
          Icon: IconAt,
          isHidden: !permissionMap[PermissionFlagType.CONNECTED_ACCOUNTS],
          subItems: [
            {
              label: t`Emails`,
              path: SettingsPath.AccountsEmails,
              Icon: IconMail,
              isHidden: !permissionMap[PermissionFlagType.CONNECTED_ACCOUNTS],
              indentationLevel: 2,
            },
            {
              label: t`Calendars`,
              path: SettingsPath.AccountsCalendars,
              Icon: IconCalendarEvent,
              isHidden: !permissionMap[PermissionFlagType.CONNECTED_ACCOUNTS],
              indentationLevel: 2,
            },
          ],
        },
      ],
    },
    {
      label: t`Workspace`,
      items: [
        {
          label: t`General`,
          path: SettingsPath.General,
          Icon: IconSettings,
          isHidden: !permissionMap[PermissionFlagType.WORKSPACE],
        },
        {
          label: t`Data model`,
          path: SettingsPath.Objects,
          Icon: IconHierarchy2,
          isHidden: !permissionMap[PermissionFlagType.DATA_MODEL],
        },
        {
          label: t`Layout`,
          path: SettingsPath.Layout,
          Icon: IconLayout,
          isHidden: !permissionMap[PermissionFlagType.LAYOUTS],
        },
        {
          label: t`Members`,
          path: SettingsPath.WorkspaceMembersPage,
          Icon: IconUsers,
          isHidden: !permissionMap[PermissionFlagType.WORKSPACE_MEMBERS],
        },
        {
          label: t`MCP & APIs`,
          path: SettingsPath.ApiWebhooks,
          Icon: IconPlug,
          isHidden: !permissionMap[PermissionFlagType.API_KEYS_AND_WEBHOOKS],
        },
        // TODO: Re-enable when integrations page is ready
        // {
        //   label: t`Integrations`,
        //   path: SettingsPath.Integrations,
        //   Icon: IconApps,
        //   isHidden: !permissionMap[PermissionFlagType.API_KEYS_AND_WEBHOOKS],
        // },
        {
          label: t`Apps`,
          path: SettingsPath.Applications,
          Icon: IconApps,
          isHidden: !permissionMap[PermissionFlagType.APPLICATIONS],
        },
        {
          label: t`AI`,
          path: SettingsPath.AI,
          Icon: IconSparkles,
          isHidden: !permissionMap[PermissionFlagType.AI_SETTINGS],
        },
        {
          label: t`AI Providers`,
          path: SettingsPath.AIProviders,
          Icon: IconRobot,
        },
        {
          label: t`Web Search APIs`,
          path: SettingsPath.WebSearchApis,
          Icon: IconSearch,
        },
        {
          label: t`Communication`,
          path: SettingsPath.WorkspaceCommunications,
          Icon: IconMessageCircle,
          isHidden:
            !isEmailGroupFeatureEnabled ||
            !permissionMap[PermissionFlagType.WORKSPACE],
        },
      ],
    },
    {
      label: t`Other`,
      items: [
        {
          label: t`Admin Panel`,
          path: SettingsPath.AdminPanel,
          Icon: IconServer,
          isHidden: !isAdminEnabled,
        },
        {
          label: t`Community`,
          path: SettingsPath.Community,
          Icon: IconUsers,
          isHidden: !permissionMap[PermissionFlagType.WORKSPACE],
        },
        {
          label: t`Support`,
          onClick: () => window.FrontChat?.('show'),
          Icon: IconMessage,
          isHidden: !isSupportChatConfigured,
        },
        {
          label: t`Documentation`,
          onClick: () =>
            window.open(
              getDocumentationUrl({ locale: currentWorkspaceMember?.locale }),
              '_blank',
            ),
          Icon: IconHelpCircle,
        },
      ],
    },
  ];
};

export { useSettingsNavigationItems };
