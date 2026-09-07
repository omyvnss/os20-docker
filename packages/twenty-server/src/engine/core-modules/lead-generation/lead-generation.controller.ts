import { Controller, Post, Body, Get, Param } from '@nestjs/common';

import { LeadGenerationService } from './services/lead-generation.service';
import { LeadSourcesService } from './services/lead-sources.service';
import {
  type IdealCustomerProfile,
  type Lead,
} from './interfaces/lead-generation.interface';
import {
  type LeadSourceCriteria,
} from './interfaces/lead-source.interface';

@Controller('lead-generation')
export class LeadGenerationController {
  constructor(
    private readonly leadGenService: LeadGenerationService,
    private readonly leadSourcesService: LeadSourcesService,
  ) {}

  @Get('sources')
  async getSources() {
    return this.leadSourcesService.getCatalog();
  }

  @Get('leads')
  async getSavedLeads() {
    return this.leadGenService.getSavedLeads();
  }

  @Post('sources-search')
  async searchSource(
    @Body() body: { sourceId: string; criteria: LeadSourceCriteria },
  ) {
    return this.leadSourcesService.search(body.sourceId, body.criteria);
  }

  @Post('find')
  async findLeads(
    @Body() body: { icp: IdealCustomerProfile; model?: string },
  ) {
    const { leads, searchQuery } = await this.leadGenService.findLeads(
      body.icp,
      body.model,
    );

    return {
      success: true,
      searchQuery,
      totalFound: leads.length,
      leads,
    };
  }

  @Post('outreach')
  async generateOutreach(
    @Body()
    body: {
      lead: Lead;
      icp: IdealCustomerProfile;
      model?: string;
    },
  ) {
    const message = await this.leadGenService.generateOutreach(
      body.lead,
      body.icp,
      body.model,
    );

    return {
      success: true,
      message,
    };
  }

  @Post('outreach/bulk')
  async generateBulkOutreach(
    @Body()
    body: {
      leads: Lead[];
      icp: IdealCustomerProfile;
      model?: string;
    },
  ) {
    const results = await this.leadGenService.generateBulkOutreach(
      body.leads,
      body.icp,
      body.model,
    );

    return {
      success: true,
      totalGenerated: results.length,
      messages: results,
    };
  }
}
