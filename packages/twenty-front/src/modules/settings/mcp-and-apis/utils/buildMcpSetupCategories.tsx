import { t } from '@lingui/core/macro';

import ClaudeLogo from '@/settings/mcp-and-apis/assets/mcp-clients/claude-color.png';
import OpenAiLogo from '@/settings/mcp-and-apis/assets/mcp-clients/openai.svg';
import { McpClientLogo } from '@/settings/mcp-and-apis/components/McpClientLogo';
import { MCP_SETUP } from '@/settings/mcp-and-apis/constants/McpSetup';
import { type McpSetupCategory } from '@/settings/mcp-and-apis/types/McpSetup';
import {
  buildClaudeInstallLink,
} from '@/settings/mcp-and-apis/utils/mcpSetup';

type BuildMcpSetupCategoriesParams = {
  isHttpsInstallLinkEnabled: boolean;
  mcpServerUrl: string;
};

export const buildMcpSetupCategories = ({
  isHttpsInstallLinkEnabled,
  mcpServerUrl,
}: BuildMcpSetupCategoriesParams): McpSetupCategory[] => [
  {
    title: t`Quick install`,
    description: t`Open a maintained integration or prefill clients that accept MCP install links.`,
    showManualConfigurationAfter: true,
    cards: [
      {
        title: t`ChatGPT`,
        badge: t`Official app`,
        description: t`Open OS20's official ChatGPT integration for your workspace.`,
        ctaLabel: t`Open`,
        href: MCP_SETUP.chatGptTwentyAppUrl,
        logo: <McpClientLogo src={OpenAiLogo} invertInDarkMode />,
      },
      {
        title: t`Claude`,
        badge: t`Preset link`,
        description: t`Open Claude with the OS20 connector name and MCP URL prefilled.`,
        ctaLabel: t`Install`,
        disabledTooltip: t`Claude install links require an HTTPS MCP URL.`,
        href: isHttpsInstallLinkEnabled
          ? buildClaudeInstallLink(mcpServerUrl)
          : undefined,
        isDisabled: !isHttpsInstallLinkEnabled,
        logo: <McpClientLogo src={ClaudeLogo} />,
        tooltipId: MCP_SETUP.tooltipIds.claudeInstallDisabled,
      },
    ],
  },
];
