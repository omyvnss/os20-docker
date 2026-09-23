import {
  DOCUMENTATION_BASE_URL,
  type DocumentationPath,
} from 'twenty-shared/constants';

// OS20's documentation lives in the GitHub README; there are no per-page docs.
export const getDocumentationUrl = (_options?: {
  locale?: string | null;
  path?: DocumentationPath | string;
}): string => `${DOCUMENTATION_BASE_URL}#readme`;
