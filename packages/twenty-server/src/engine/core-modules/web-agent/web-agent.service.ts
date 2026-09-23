import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { Os20SecretCipherService } from 'src/engine/core-modules/os20-secrets/os20-secret-cipher.service';

import { resolveAndValidateHostname } from 'src/engine/core-modules/secure-http-client/utils/resolve-and-validate-hostname.util';

import { WebAgentConnectionEntity } from './web-agent.entity';
import { LocalIdentityService } from 'src/engine/core-modules/os20-identity/os20-identity.service';
import { type SourceLeadCandidate } from 'src/engine/core-modules/lead-generation/interfaces/lead-source.interface';

const FETCH_TIMEOUT_MS = 60000;
const TEST_TIMEOUT_MS = 10000;

export type WebAgentCapabilities = { name?: string; lead_fetch?: boolean };

export type WebAgentDto = {
  id: string;
  name: string;
  baseUrl: string;
  allowPrivateNetwork: boolean;
  enabled: boolean;
  hasKey: boolean;
  capabilities: WebAgentCapabilities | null;
  lastTestedAt: Date | null;
};

@Injectable()
export class WebAgentService {
  constructor(
    private readonly localIdentityService: LocalIdentityService,
    @InjectRepository(WebAgentConnectionEntity)
    private readonly connectionRepository: Repository<WebAgentConnectionEntity>,
    private readonly secretCipher: Os20SecretCipherService,
  ) {}

  private normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.replace(/\/+$/, '');
  }

  private parseCapabilities(raw: string | null): WebAgentCapabilities | null {
    if (!raw) return null;

    try {
      return JSON.parse(raw) as WebAgentCapabilities;
    } catch {
      return null;
    }
  }

  toDto(connection: WebAgentConnectionEntity): WebAgentDto {
    return {
      id: connection.id,
      name: connection.name,
      baseUrl: connection.baseUrl,
      allowPrivateNetwork: connection.allowPrivateNetwork,
      enabled: connection.enabled,
      hasKey: Boolean(connection.encryptedKey),
      capabilities: this.parseCapabilities(connection.capabilities),
      lastTestedAt: connection.lastTestedAt,
    };
  }

  async list(): Promise<WebAgentDto[]> {
    const connections = await this.connectionRepository.find({
      where: { workspaceId: this.localIdentityService.getWorkspaceId() },
      order: { createdAt: 'ASC' },
    });

    return connections.map((connection) => this.toDto(connection));
  }

  async getById(id: string): Promise<WebAgentConnectionEntity | null> {
    return this.connectionRepository.findOne({
      where: { id, workspaceId: this.localIdentityService.getWorkspaceId() },
    });
  }

  async create(input: {
    name: string;
    baseUrl: string;
    apiKey: string;
    allowPrivateNetwork?: boolean;
  }): Promise<WebAgentDto> {
    const workspaceId = this.localIdentityService.getWorkspaceId();
    const { encrypted, iv } = this.secretCipher.encrypt(
      input.apiKey || '',
      workspaceId,
    );

    const connection = this.connectionRepository.create({
      workspaceId,
      name: input.name,
      baseUrl: this.normalizeBaseUrl(input.baseUrl),
      encryptedKey: encrypted,
      iv,
      allowPrivateNetwork: input.allowPrivateNetwork ?? false,
      enabled: true,
    });

    await this.connectionRepository.save(connection);

    return this.toDto(connection);
  }

  async update(
    id: string,
    input: {
      name?: string;
      baseUrl?: string;
      apiKey?: string;
      allowPrivateNetwork?: boolean;
      enabled?: boolean;
    },
  ): Promise<WebAgentDto> {
    const connection = await this.getById(id);

    if (!connection) throw new Error(`Web agent ${id} not found`);

    if (input.name !== undefined) connection.name = input.name;
    if (input.baseUrl !== undefined)
      connection.baseUrl = this.normalizeBaseUrl(input.baseUrl);
    if (input.allowPrivateNetwork !== undefined)
      connection.allowPrivateNetwork = input.allowPrivateNetwork;
    if (input.enabled !== undefined) connection.enabled = input.enabled;
    if (input.apiKey) {
      const { encrypted, iv } = this.secretCipher.encrypt(
        input.apiKey,
        connection.workspaceId,
      );

      connection.encryptedKey = encrypted;
      connection.iv = iv;
    }

    await this.connectionRepository.save(connection);

    return this.toDto(connection);
  }

  async delete(id: string): Promise<void> {
    const connection = await this.getById(id);

    if (!connection) throw new Error(`Web agent ${id} not found`);

    await this.connectionRepository.delete(id);
  }

  private async call(
    connection: WebAgentConnectionEntity,
    path: string,
    options: { method: 'GET' | 'POST'; body?: unknown; timeoutMs: number },
  ): Promise<{ status: number; data: unknown }> {
    const url = `${this.normalizeBaseUrl(connection.baseUrl)}${path}`;
    const secret = this.secretCipher.decrypt(
      connection.encryptedKey,
      connection.iv,
      connection.workspaceId,
    );

    await resolveAndValidateHostname(
      url,
      undefined,
      connection.allowPrivateNetwork,
    );

    // No redirects: the hostname was validated above, a redirect target was not.
    const response = await fetch(url, {
      method: options.method,
      redirect: 'manual',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(options.timeoutMs),
    });

    const text = await response.text();
    let data: unknown = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    return { status: response.status, data };
  }

  async test(id: string): Promise<{
    ok: boolean;
    capabilities?: WebAgentCapabilities | null;
    error?: string;
  }> {
    const connection = await this.getById(id);

    if (!connection) throw new Error(`Web agent ${id} not found`);

    try {
      const { status, data } = await this.call(connection, '/', {
        method: 'GET',
        timeoutMs: TEST_TIMEOUT_MS,
      });

      if (status !== 200) {
        throw new Error(`Agent responded with HTTP ${status}`);
      }

      const capabilities =
        data && typeof data === 'object'
          ? (data as Partial<WebAgentCapabilities>)
          : {};

      connection.capabilities = JSON.stringify({
        name: capabilities.name,
        lead_fetch: Boolean(capabilities.lead_fetch),
      });
      connection.lastTestedAt = new Date();
      await this.connectionRepository.save(connection);

      return {
        ok: true,
        capabilities: this.parseCapabilities(connection.capabilities),
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async fetchLeads(
    id: string,
    criteria: Record<string, unknown>,
  ): Promise<SourceLeadCandidate[]> {
    const connection = await this.getById(id);

    if (!connection) throw new Error(`Web agent ${id} not found`);
    if (!connection.enabled) throw new Error(`Web agent ${id} is disabled`);

    const { status, data } = await this.call(connection, '/lead-fetch', {
      method: 'POST',
      body: { icp: criteria },
      timeoutMs: FETCH_TIMEOUT_MS,
    });

    if (status !== 200) {
      throw new Error(
        `Web agent responded with HTTP ${status}: ${
          data && typeof data === 'object'
            ? JSON.stringify(data).slice(0, 300)
            : String(data)
        }`,
      );
    }

    const response = (data ?? {}) as { leads?: unknown[] };

    return (response.leads ?? []).map((raw, index) =>
      this.toLeadCandidate(connection, raw, index),
    );
  }

  private toLeadCandidate(
    connection: WebAgentConnectionEntity,
    raw: unknown,
    index: number,
  ): SourceLeadCandidate {
    const lead =
      raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const companyName = String(lead.companyName ?? lead.name ?? '').trim();
    const title = String(
      lead.title ?? lead.companyName ?? lead.name ?? '',
    ).trim();

    return {
      id: String(lead.id ?? `${connection.id}-${index}`),
      sourceId: `web-agent-${connection.id}`,
      platform: connection.name,
      title: title || 'Unnamed company',
      companyName: companyName || title || 'Unnamed company',
      industry: lead.industry ? String(lead.industry) : undefined,
      location: lead.location ? String(lead.location) : undefined,
      website: lead.website ? String(lead.website) : undefined,
      phone: lead.phone ? String(lead.phone) : undefined,
      email: lead.email ? String(lead.email) : undefined,
      rating:
        typeof lead.rating === 'number'
          ? lead.rating
          : lead.rating !== undefined
            ? Number(lead.rating)
            : undefined,
      snippet: lead.snippet ? String(lead.snippet) : undefined,
      url: lead.url ? String(lead.url) : undefined,
    };
  }
}
