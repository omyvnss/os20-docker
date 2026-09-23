import { ActionToolProvider } from 'src/engine/core-modules/tool-provider/providers/action-tool.provider';
import { type ToolProviderContext } from 'src/engine/core-modules/tool-provider/interfaces/tool-provider-context.type';

const tool = () => ({ execute: jest.fn(async () => ({ success: true })) });

const buildProvider = () => {
  const tools = {
    http: tool(),
    sendEmail: tool(),
    draftEmail: tool(),
    codeInterpreter: tool(),
  };
  const permissionsService = { hasToolPermission: jest.fn(async () => true) };
  const provider = new (ActionToolProvider as unknown as new (
    ...args: unknown[]
  ) => ActionToolProvider)(
    tools.http,
    tools.sendEmail,
    tools.draftEmail,
    tool(),
    tool(),
    tools.codeInterpreter,
    tool(),
    tool(),
    tool(),
    tool(),
    { isEnabled: () => true },
    permissionsService,
    { getI18nInstance: () => ({ _: (value: string) => value }) },
  );

  return { provider, tools };
};

const context = {
  workspaceId: 'workspace',
  userId: 'user',
  rolePermissionConfig: {},
} as unknown as ToolProviderContext;

describe('ActionToolProvider unsafe AI tools', () => {
  const previous = process.env.OS20_AI_UNSAFE_TOOLS;

  afterEach(() => {
    process.env.OS20_AI_UNSAFE_TOOLS = previous;
  });

  it.each(['http_request', 'send_email', 'code_interpreter'])(
    'refuses to run %s unless OS20_AI_UNSAFE_TOOLS is true',
    async (toolName) => {
      delete process.env.OS20_AI_UNSAFE_TOOLS;
      const { provider, tools } = buildProvider();

      await expect(
        provider.executeStaticTool(toolName, {}, context),
      ).rejects.toThrow('turned off in OS20');
      expect(tools.http.execute).not.toHaveBeenCalled();
      expect(tools.sendEmail.execute).not.toHaveBeenCalled();
      expect(tools.codeInterpreter.execute).not.toHaveBeenCalled();
    },
  );

  it('still lets the agent draft emails', async () => {
    delete process.env.OS20_AI_UNSAFE_TOOLS;
    const { provider, tools } = buildProvider();

    await provider.executeStaticTool('draft_email', {}, context);

    expect(tools.draftEmail.execute).toHaveBeenCalled();
  });

  it('runs the tools when explicitly enabled', async () => {
    process.env.OS20_AI_UNSAFE_TOOLS = 'true';
    const { provider, tools } = buildProvider();

    await provider.executeStaticTool('send_email', {}, context);

    expect(tools.sendEmail.execute).toHaveBeenCalled();
  });
});
