import { getPersonOutreachDetails } from '@/os20-contacts/utils/getPersonOutreachDetails';

describe('getPersonOutreachDetails', () => {
  it('reads name, primary email and email status', () => {
    expect(
      getPersonOutreachDetails({
        name: { firstName: 'Jane', lastName: ' Doe ' },
        emails: { primaryEmail: 'jane@acme.com' },
        emailStatus: 'GUESSED',
      }),
    ).toEqual({
      personName: 'Jane Doe',
      primaryEmail: 'jane@acme.com',
      emailStatus: 'GUESSED',
    });
  });

  it('handles missing records and unknown fields', () => {
    expect(getPersonOutreachDetails(undefined)).toEqual({
      personName: null,
      primaryEmail: null,
      emailStatus: null,
    });
    expect(
      getPersonOutreachDetails({
        name: { firstName: '', lastName: '' },
        emails: { primaryEmail: '' },
        emailStatus: 'MAYBE',
      }),
    ).toEqual({ personName: null, primaryEmail: null, emailStatus: null });
  });
});
