import { t } from '@lingui/core/macro';

export const getStandardApplicationDescription =
  (): string => t`The base data model every OS20 workspace runs on.

#### What "foundation" means

Every OS20 workspace starts with this set of objects. They define the shape of your CRM, including relationships, activity, and reporting. Everything else, including marketplace apps, AI agents, and custom objects, plugs into them.

#### Included objects
- **People & Companies**: contact and account records
- **Opportunities**: your sales pipeline
- **Notes & Tasks**: activity and follow-ups
- **Workflows & Dashboards**: automation and reporting

Remove this app and the rest of OS20 has nothing to hang off.

#### Build your own app

Extend OS20 with your own objects, fields, logic functions, or AI skills. Scaffold a new app in one command:

\`\`\`bash
npx create-os20-app@latest my-os20-app
\`\`\`

Then inside the folder:

\`\`\`bash
cd my-os20-app
yarn os20 dev
\`\`\`

See the [Getting Started guide](https://os20.xyz/developers/extend/apps/getting-started) for the full walkthrough, and [Building Apps](https://os20.xyz/developers/extend/apps/building) for the \`defineApplication\` / \`defineEntity\` APIs.`;
