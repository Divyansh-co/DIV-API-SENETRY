import { TestRun, TestRunCreateRequest, TestResult, ReportSummary } from '../types';

const API_BASE = '/api/v1';

export async function createTestRun(payload: TestRunCreateRequest): Promise<TestRun> {
  const res = await fetch(`${API_BASE}/testrun`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create test run' }));
    throw new Error(err.detail || `Error: ${res.status}`);
  }
  return res.json();
}

export async function getTestRun(id: string): Promise<TestRun> {
  const res = await fetch(`${API_BASE}/testruns/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch test run ${id}`);
  }
  return res.json();
}

export async function getTestResults(
  id: string,
  filters?: {
    status?: string;
    category?: string;
    severity?: string;
    endpoint?: string;
    limit?: number;
    offset?: number;
  }
): Promise<TestResult[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.category) params.append('category', filters.category);
  if (filters?.severity) params.append('severity', filters.severity);
  if (filters?.endpoint) params.append('endpoint', filters.endpoint);
  if (filters?.limit) params.append('limit', String(filters.limit));
  if (filters?.offset) params.append('offset', String(filters.offset));

  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/testruns/${id}/results${query}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch results for test run ${id}`);
  }
  return res.json();
}

export async function getReportSummary(id: string): Promise<ReportSummary> {
  const res = await fetch(`${API_BASE}/reports/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch report summary for test run ${id}`);
  }
  return res.json();
}

export async function getTestHistory(limit = 20): Promise<TestRun[]> {
  const res = await fetch(`${API_BASE}/history?limit=${limit}`);
  if (!res.ok) {
    throw new Error('Failed to fetch test history');
  }
  return res.json();
}

export function getReportHtmlUrl(id: string): string {
  return `${API_BASE}/reports/${id}/html`;
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch('/health');
    return res.ok;
  } catch {
    return false;
  }
}
