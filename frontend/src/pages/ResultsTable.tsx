import React, { useState, useEffect } from 'react';
import {
  ListFilter,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  X,
  Code2,
  ChevronRight,
  ShieldAlert,
  ArrowUpDown,
  Copy,
  Check
} from 'lucide-react';
import { getTestResults } from '../services/api';
import { TestResult } from '../types';

interface ResultsTableProps {
  runId: string | null;
  initialEndpointFilter?: string;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ runId, initialEndpointFilter }) => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState<TestResult | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState(initialEndpointFilter || '');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialEndpointFilter) {
      setSearchQuery(initialEndpointFilter);
    }
  }, [initialEndpointFilter]);

  useEffect(() => {
    if (!runId) return;
    const fetchResults = async () => {
      setLoading(true);
      try {
        const data = await getTestResults(runId, { limit: 200 });
        setResults(data);
      } catch (err) {
        console.error('Failed to load test results:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [runId]);

  const filteredResults = results.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (severityFilter !== 'ALL' && r.severity !== severityFilter) return false;
    if (categoryFilter !== 'ALL' && r.test_category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchPath = r.endpoint_path.toLowerCase().includes(q);
      const matchName = r.test_name.toLowerCase().includes(q);
      const matchCat = r.test_category.toLowerCase().includes(q);
      if (!matchPath && !matchName && !matchCat) return false;
    }
    return true;
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!runId) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <div className="w-16 h-16 rounded-2xl card mx-auto flex items-center justify-center text-warmash mb-4 shadow-sm">
          <ListFilter className="w-8 h-8 text-bronze" />
        </div>
        <h2 className="text-xl font-bold text-bone mb-2">No Test Run Selected</h2>
        <p className="text-sm text-warmash mb-6">
          Start a new test run to inspect findings, schema discrepancies, and diagnostic logs.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Header & Stats Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-bronze-hairline pb-6">
        <div>
          <h1 className="text-2xl font-bold text-bone flex items-center gap-2">
            <span>Audit Findings &amp; Test Results</span>
          </h1>
          <p className="text-sm text-warmash mt-1">
            Showing <strong className="text-bone">{filteredResults.length}</strong> of {results.length} total test evaluations
          </p>
        </div>

        {/* Quick Filter Counts */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStatusFilter('FAIL')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
              statusFilter === 'FAIL'
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                : 'card text-warmash hover:text-rose-400'
            }`}
          >
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>{results.filter((r) => r.status === 'FAIL').length} Failures</span>
          </button>
          <button
            onClick={() => setStatusFilter('WARNING')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
              statusFilter === 'WARNING'
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'card text-warmash hover:text-amber-300'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>{results.filter((r) => r.status === 'WARNING').length} Warnings</span>
          </button>
          <button
            onClick={() => setStatusFilter('PASS')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
              statusFilter === 'PASS'
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'card text-warmash hover:text-emerald-400'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{results.filter((r) => r.status === 'PASS').length} Passed</span>
          </button>
          {statusFilter !== 'ALL' && (
            <button
              onClick={() => setStatusFilter('ALL')}
              className="text-xs text-bronze hover:text-bronze-highlight font-mono ml-1"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Filter Controls Toolbar */}
      <div className="card rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shadow-sm">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-warmash" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search endpoint or test name..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-obsidian border border-bronze-hairline text-xs text-bone placeholder-warmash/60 focus:outline-none focus:border-bronze"
          />
        </div>

        {/* Severity Filter */}
        <div>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-obsidian border border-bronze-hairline text-xs text-bone focus:outline-none focus:border-bronze"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        {/* Category Filter */}
        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-obsidian border border-bronze-hairline text-xs text-bone focus:outline-none focus:border-bronze"
          >
            <option value="ALL">All Categories</option>
            <option value="DATA_ISOLATION">Data Isolation (BOLA)</option>
            <option value="SCHEMA_CONFORMANCE">Schema Conformance</option>
            <option value="INPUT_VALIDATION">Input Validation (Type Checks)</option>
            <option value="UNDECLARED_FIELDS">Undeclared Request Fields</option>
            <option value="BOUNDARY_CHECK">Boundary &amp; Missing Body</option>
            <option value="RATE_LIMIT_CHECK">Rate Limit Headers</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-obsidian border border-bronze-hairline text-xs text-bone focus:outline-none focus:border-bronze"
          >
            <option value="ALL">All Statuses (Pass/Fail/Warn)</option>
            <option value="FAIL">Failures Only</option>
            <option value="WARNING">Warnings Only</option>
            <option value="PASS">Passed Only</option>
          </select>
        </div>
      </div>

      {/* Results Table */}
      <div className="card rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-bronze-hairline bg-obsidian text-[11px] font-bold text-warmash uppercase tracking-wider">
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Severity</th>
                <th className="py-3.5 px-4">Method &amp; Endpoint</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">HTTP Status</th>
                <th className="py-3.5 px-4">Duration</th>
                <th className="py-3.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bronze-hairline text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-warmash font-mono">
                    Loading findings...
                  </td>
                </tr>
              ) : filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-warmash font-mono">
                    No results matched the selected filters.
                  </td>
                </tr>
              ) : (
                filteredResults.map((r) => {
                  const isFail = r.status === 'FAIL';
                  const isWarn = r.status === 'WARNING';
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedResult(r)}
                      className="hover:bg-obsidian/50 transition cursor-pointer"
                    >
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-extrabold text-[10px] uppercase tracking-wider ${
                            isFail
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : isWarn
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          }`}
                        >
                          {isFail ? <XCircle className="w-3 h-3 text-rose-400" /> : isWarn ? <AlertTriangle className="w-3 h-3 text-amber-400" /> : <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                          <span>{r.status}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md ${
                            r.severity === 'CRITICAL'
                              ? 'text-rose-300 bg-rose-500/20 border border-rose-500/30'
                              : r.severity === 'HIGH'
                              ? 'text-amber-300 bg-amber-500/20 border border-amber-500/30'
                              : r.severity === 'MEDIUM'
                              ? 'text-yellow-300 bg-yellow-500/15'
                              : 'text-warmash bg-obsidian'
                          }`}
                        >
                          {r.severity}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              r.http_method === 'GET'
                                ? 'bg-blue-500/15 text-blue-300'
                                : r.http_method === 'POST'
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : r.http_method === 'DELETE'
                                ? 'bg-rose-500/15 text-rose-300'
                                : 'bg-amber-500/15 text-amber-300'
                            }`}
                          >
                            {r.http_method}
                          </span>
                          <span className="text-bone font-medium">{r.endpoint_path}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-warmash font-mono text-[11px]">
                        {r.test_category}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-bone">
                        {r.status_code_received ? (
                          <span className={r.status_code_received >= 500 ? 'text-rose-400 font-bold' : ''}>
                            {r.status_code_received}
                          </span>
                        ) : (
                          <span className="text-warmash">-</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-warmash">
                        {r.duration_ms !== undefined ? `${r.duration_ms}ms` : '-'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedResult(r);
                          }}
                          className="px-3 py-1 rounded-lg btn-secondary text-xs font-semibold flex items-center gap-1 ml-auto"
                        >
                          <span>Inspect</span>
                          <ChevronRight className="w-3.5 h-3.5 text-bronze" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal / Drawer */}
      {selectedResult && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
          <div className="card rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-bronze-hairline bg-obsidian flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-0.5 rounded-full text-[11px] font-extrabold uppercase ${
                    selectedResult.status === 'FAIL'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : selectedResult.status === 'WARNING'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {selectedResult.status}
                </span>
                <span className="font-mono text-xs text-warmash">
                  {selectedResult.severity} Severity
                </span>
                <span className="font-mono text-bone text-sm font-bold">
                  {selectedResult.http_method} {selectedResult.endpoint_path}
                </span>
              </div>
              <button
                onClick={() => setSelectedResult(null)}
                className="text-warmash hover:text-bone p-1 rounded-lg hover:bg-obsidian transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              <div>
                <h4 className="text-[11px] uppercase tracking-wider text-warmash font-bold mb-1">
                  Test Case
                </h4>
                <p className="text-bone text-sm font-semibold">{selectedResult.test_name}</p>
                <p className="text-warmash text-xs mt-1">{selectedResult.description}</p>
              </div>

              {/* Failure Explanations */}
              {selectedResult.failure_reasons && selectedResult.failure_reasons.length > 0 && (
                <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 space-y-2">
                  <div className="flex items-center gap-2 text-rose-300 font-bold">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <span>Discrepancy / Vulnerability Reasons:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-bone font-mono text-[11px]">
                    {selectedResult.failure_reasons.map((reason, idx) => (
                      <li key={idx} className="leading-relaxed">{reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Remediation Advice */}
              {selectedResult.remediation_hint && (
                <div className="p-4 rounded-xl bg-obsidian border border-bronze-hairline text-bone">
                  <strong className="text-bronze font-bold block mb-1">Remediation Suggestion:</strong>
                  <p className="text-xs leading-relaxed text-warmash">{selectedResult.remediation_hint}</p>
                </div>
              )}

              {/* Request & Response Snapshots */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] uppercase tracking-wider text-warmash font-bold flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-bronze" />
                    <span>Exact Probing Trace</span>
                  </h4>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        JSON.stringify(
                          { request: selectedResult.request_data, response: selectedResult.response_data },
                          null,
                          2
                        )
                      )
                    }
                    className="flex items-center gap-1 text-[11px] text-bronze hover:text-bronze-highlight font-mono transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied Trace' : 'Copy JSON Trace'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Request */}
                  <div className="bg-obsidian border border-bronze-hairline rounded-xl overflow-hidden">
                    <div className="bg-obsidian-surface px-3 py-1.5 border-b border-bronze-hairline text-[11px] font-mono text-warmash">
                      Request Snapshot
                    </div>
                    <pre className="p-3 font-mono text-[11px] text-warmash max-h-56 overflow-auto">
                      <code>{JSON.stringify(selectedResult.request_data, null, 2) || '{}'}</code>
                    </pre>
                  </div>

                  {/* Response */}
                  <div className="bg-obsidian border border-bronze-hairline rounded-xl overflow-hidden">
                    <div className="bg-obsidian-surface px-3 py-1.5 border-b border-bronze-hairline text-[11px] font-mono text-warmash flex items-center justify-between">
                      <span>Response Snapshot</span>
                      {selectedResult.status_code_received && (
                        <span className="font-bold text-bone">HTTP {selectedResult.status_code_received}</span>
                      )}
                    </div>
                    <pre className="p-3 font-mono text-[11px] text-warmash max-h-56 overflow-auto">
                      <code>{JSON.stringify(selectedResult.response_data, null, 2) || '{}'}</code>
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-bronze-hairline bg-obsidian flex justify-end">
              <button
                onClick={() => setSelectedResult(null)}
                className="px-4 py-2 rounded-xl btn-primary text-obsidian text-xs font-semibold"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
