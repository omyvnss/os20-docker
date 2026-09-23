import { type TagColor } from 'twenty-ui/data-display';

export const getLeadScoreColor = (score: number): TagColor => {
  if (score >= 70) return 'green';
  if (score >= 40) return 'orange';

  return 'gray';
};
