import { buildTestLead } from '@/os20-leads/testing/buildTestLead';
import { mapLeadToCompanyInput } from '@/os20-leads/utils/mapLeadToCompanyInput';

describe('mapLeadToCompanyInput', () => {
  it('maps name and a normalized https domain', () => {
    expect(
      mapLeadToCompanyInput(
        buildTestLead({ company: ' Acme ', domain: 'WWW.acme.com' }),
      ),
    ).toEqual({
      name: 'Acme',
      domainName: { primaryLinkUrl: 'https://acme.com', primaryLinkLabel: '' },
    });
  });

  it('omits the domain when the lead has no website', () => {
    expect(
      mapLeadToCompanyInput(
        buildTestLead({
          company: 'Corner Cafe',
          domain: undefined,
          companyUrl: '',
        }),
      ),
    ).toEqual({ name: 'Corner Cafe' });
  });
});
