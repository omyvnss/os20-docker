import { z } from 'zod';

export const SearchHelpCenterInputZodSchema = z.object({
  query: z
    .string()
    .describe('The search query to find relevant help articles about OS20'),
});

export type SearchHelpCenterInput = z.infer<
  typeof SearchHelpCenterInputZodSchema
>;
