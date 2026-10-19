export interface SharedCollection {
  shareId: string;
  name: string;
  apiIds: string[];
  createdAt: string;
}

export interface ApiSubmissionInput {
  name: string;
  documentationUrl: string;
  websiteUrl: string;
  category: string;
  description: string;
  pricingUrl?: string;
  termsUrl?: string;
  tags: string[];
  notes?: string;
}

export interface SubmissionReceipt {
  id: string;
  status: 'pending';
  createdAt: string;
}

export interface ReportReceipt {
  id: string;
  createdAt: string;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readData<T>(response: Response, isData: (value: unknown) => value is T): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('The API returned an invalid response.');
  }

  if (!response.ok) {
    const error = isRecord(payload) && isRecord(payload.error) ? payload.error : null;
    const message = error && typeof error.message === 'string' ? error.message : `Request failed (HTTP ${response.status}).`;
    throw new Error(message);
  }
  if (!isRecord(payload) || !isData(payload.data)) {
    throw new Error('The API returned an unexpected response shape.');
  }
  return payload.data;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isSharedCollection(value: unknown): value is SharedCollection {
  return isRecord(value)
    && typeof value.shareId === 'string'
    && typeof value.name === 'string'
    && isStringArray(value.apiIds)
    && typeof value.createdAt === 'string';
}

function isSubmissionReceipt(value: unknown): value is SubmissionReceipt {
  return isRecord(value)
    && typeof value.id === 'string'
    && value.status === 'pending'
    && typeof value.createdAt === 'string';
}

function isReportReceipt(value: unknown): value is ReportReceipt {
  return isRecord(value) && typeof value.id === 'string' && typeof value.createdAt === 'string';
}

export async function publishCollection(name: string, apiIds: string[]): Promise<SharedCollection> {
  const response = await fetch(`${API_BASE_URL}/api/v1/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, apiIds }),
  });
  return readData(response, isSharedCollection);
}

export async function getSharedCollection(shareId: string): Promise<SharedCollection> {
  const response = await fetch(`${API_BASE_URL}/api/v1/collections/${encodeURIComponent(shareId)}`);
  return readData(response, isSharedCollection);
}

export async function submitApi(input: ApiSubmissionInput): Promise<SubmissionReceipt> {
  const response = await fetch(`${API_BASE_URL}/api/v1/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return readData(response, isSubmissionReceipt);
}

export async function submitReport(input: { apiId: string; details: string; sourceUrl?: string }): Promise<ReportReceipt> {
  const response = await fetch(`${API_BASE_URL}/api/v1/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return readData(response, isReportReceipt);
}
