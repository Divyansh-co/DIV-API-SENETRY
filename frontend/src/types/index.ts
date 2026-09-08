export interface TestAccount {
  name?: string;
  headers: Record<string, string>;
  resource_ids: Record<string, any>;
}

export interface TestRunCreateRequest {
  target_base_url: string;
  spec_content?: string;
  spec_url?: string;
  account_a?: TestAccount;
  account_b?: TestAccount;
}

export interface TestRun {
  id: string;
  target_base_url: string;
  spec_title?: string;
  spec_version?: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  warning_tests: number;
  compliance_score: number;
  started_at: string;
  completed_at?: string;
  error_message?: string;
}

export interface TestResult {
  id: string;
  test_run_id: string;
  endpoint_path: string;
  http_method: string;
  test_category: string;
  test_name: string;
  description: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  status_code_received?: number;
  duration_ms?: number;
  request_data?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    params?: Record<string, any>;
    body?: any;
  };
  response_data?: {
    status_code?: number;
    headers?: Record<string, string>;
    body?: any;
  };
  failure_reasons?: string[];
  remediation_hint?: string;
  created_at: string;
}

export interface CategoryStat {
  total: number;
  passed: number;
  failed: number;
  warning: number;
}

export interface ReportSummary {
  id: string;
  target_base_url: string;
  spec_title?: string;
  spec_version?: string;
  status: string;
  compliance_score: number;
  started_at: string;
  completed_at?: string;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  warning_tests: number;
  category_breakdown: Record<string, CategoryStat>;
  severity_breakdown: Record<string, number>;
  top_findings: TestResult[];
}
