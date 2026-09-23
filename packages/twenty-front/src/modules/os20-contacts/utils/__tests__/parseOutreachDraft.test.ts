import { parseOutreachDraft } from '@/os20-contacts/utils/parseOutreachDraft';

describe('parseOutreachDraft', () => {
  it('trims subject and body', () => {
    expect(parseOutreachDraft({ subject: ' Hi ', body: ' Body \n' })).toEqual({
      subject: 'Hi',
      body: 'Body',
    });
  });

  it('rejects payloads without text', () => {
    expect(parseOutreachDraft(null)).toBeNull();
    expect(parseOutreachDraft({ subject: 1, body: null })).toBeNull();
    expect(parseOutreachDraft({ body: 'Only body' })).toEqual({
      subject: '',
      body: 'Only body',
    });
  });
});
