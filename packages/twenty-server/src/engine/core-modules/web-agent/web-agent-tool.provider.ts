import { Injectable } from '@nestjs/common';

import { z } from 'zod';

import { ToolCategory } from 'twenty-shared/ai';

import { type GenerateDescriptorOptions } from 'src/engine/core-modules/tool-provider/interfaces/generate-descriptor-options.type';
import { type ToolProvider } from 'src/engine/core-modules/tool-provider/interfaces/tool-provider.interface';
import { type ToolProviderContext } from 'src/engine/core-modules/tool-provider/interfaces/tool-provider-context.type';
import { type ToolDescriptor } from 'src/engine/core-modules/tool-provider/types/tool-descriptor.type';
import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';

import { WebAgentService } from './web-agent.service';

const TOOL_PREFIX = 'web_agent_';
const TOOL_SUFFIX = '_lead_fetch';

const leadFetchSchema = z.object({
  industry: z
    .string()
    .optional()
    .describe('Industry / sector of the companies to hunt for'),
  location: z
    .string()
    .optional()
    .describe('City, region or country to scope the search'),
  keywords: z
    .string()
    .optional()
    .describe('Space-separated keywords the businesses should relate to'),
  maxResults: z
    .number()
    .int()
    .positive()
    .max(50)
    .optional()
    .describe('Maximum number of leads to return (default 20)'),
});

@Injectable()
export class WebAgentToolProvider implements ToolProvider {
  readonly category: ToolCategory = ToolCategory.WEB_AGENT;

  constructor(private readonly webAgentService: WebAgentService) {}

  async isAvailable(context: ToolProviderContext): Promise<boolean> {
    return true;
  }

  async generateDescriptors(
    context: ToolProviderContext,
    options?: GenerateDescriptorOptions,
  ): Promise<(ToolIndexEntry | ToolDescriptor)[]> {
    const agents = (await this.webAgentService.list()).filter(
      (agent) => agent.enabled,
    );

    return agents.map((agent) => ({
      name: `${TOOL_PREFIX}${agent.id}${TOOL_SUFFIX}`,
      label: `Fetch leads — ${agent.name}`,
      description: `Ask your web agent "${agent.name}" to find real leads (companies and people with website, email and phone) matching an ideal customer profile. Returns a list of candidate companies that you can add to the CRM.`,
      category: this.category,
      executionRef: { kind: 'static', toolId: `${TOOL_PREFIX}${agent.id}${TOOL_SUFFIX}` },
      ...(options?.includeSchemas !== false && { inputSchema: leadFetchSchema }),
    }));
  }

  async executeStaticTool(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolProviderContext,
  ): Promise<ToolOutput> {
    const agentId = toolName
      .slice(TOOL_PREFIX.length, -TOOL_SUFFIX.length);

    try {
      const leads = await this.webAgentService.fetchLeads(agentId, args);

      return {
        success: true,
        message: `Found ${leads.length} lead(s) from the web agent`,
        result: { leads },
      };
    } catch (error) {
      return {
        success: false,
        message: `Web agent fetch failed`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}