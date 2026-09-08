import React, { useState, useEffect } from 'react';
import {
  FileDown,
  Printer,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  FileText,
  BarChart3,
  Layers
} from 'lucide-react';
import { getReportSummary, getReportHtmlUrl } from '../services/api';
import { ReportSummary, TestRun } from '../types';

interface ReportExportProps {
  run: TestRun | null;
}

export const ReportExport: React.FC<ReportExportProps> = ({ run }) => {
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!run?.id) return;
    const fetchReport = async () => {
      setLoading(true);
      try {
        const data = await getReportSummary(run.id);
        setReport(data);
      } catch (err) {
        console.error('Failed to load report summary:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [run?.id]);

  const handleOpenHtml = () => {
    if (!run) return;
    const url = getReportHtmlUrl(run.id);
    window.open(url, '_blank');
  };

  const handlePrintPdf = () => {
    if (!run) return;
    const url = getReportHtmlUrl(run.id);
    const win = window.open(url, '_blank');
    if (win) {
      win.focus();
      setTimeout(() => {
        win.print();
      }, 500);
    }
  };

  if (!run) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <div className="w-16 h-16 rounded-2xl card mx-auto flex items-center justify-center text-warmash mb-4 shadow-sm">
          <FileDown className="w-8 h-8 text-bronze" />
        </div>
        <h2 className="text-xl font-bold text-bone mb-2">No Test Run Selected</h2>
        <p className="text-sm text-warmash mb-6">
          Execute or select an audit run to preview and export professional compliance reports.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      {/* Header & Export Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-bronze-hairline pb-6">
        <div>
          <h1 className="text-2xl font-bold text-bone tracking-tight flex items-center gap-2">
            <span>Security &amp; Compliance Audit Deliverable</span>
          </h1>
          <p className="text-sm text-warmash mt-1">
            Export audit results as a standalone, client-ready report or print to PDF.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenHtml}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl btn-secondary text-xs font-bold transition shadow-sm"
          >
            <FileText className="w-4 h-4 text-bronze" />
            <span>Open HTML Report</span>
            <ExternalLink className="w-3.5 h-3.5 text-warmash" />
          </button>

          <button
            onClick={handlePrintPdf}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl btn-primary text-white text-xs font-bold shadow-sm transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-white" />
            <span>Download / Print PDF</span>
          </button>
        </div>
      </div>

      {/* Executive Report Card */}
      <div className="card rounded-2xl p-6 sm:p-8 shadow-sm space-y-8">
        {/* Top Meta Details */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-bronze-hairline">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-bold text-bronze bg-obsidian px-2.5 py-0.5 rounded-full border border-bronze-hairline font-mono">
                Audit Summary
              </span>
              <span className="text-xs text-warmash font-mono">
                {new Date(run.started_at).toLocaleDateString()}
              </span>
            </div>
            <h2 className="text-xl font-bold text-bone mt-2">
              {run.spec_title || 'API Security & Contract Audit'}
            </h2>
            <p className="text-xs text-warmash font-mono mt-1">
              Target: <strong className="text-bone">{run.target_base_url}</strong> &bull; Spec Version: {run.spec_version || '1.0.0'}
            </p>
          </div>

          <div className="text-right">
            <span className="text-[11px] uppercase tracking-wider text-warmash font-semibold block">
              Overall Compliance Score
            </span>
            {/* Focal Champagne Moment */}
            <div className="text-4xl font-extrabold font-mono mt-1 text-champagne">
              {run.compliance_score}%
            </div>
          </div>
        </div>

        {/* Severity Metrics Cards */}
        <div>
          <h3 className="text-xs font-bold text-warmash uppercase tracking-wider mb-3">
            Findings by Severity Rating
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-obsidian border border-red-500/30 shadow-sm">
              <span className="text-[11px] text-rose-400 font-bold uppercase tracking-wider block">
                Critical (BOLA / Leaks)
              </span>
              <span className="text-2xl font-extrabold text-rose-400 font-mono">
                {report?.severity_breakdown?.CRITICAL || 0}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-obsidian border border-amber-500/30 shadow-sm">
              <span className="text-[11px] text-amber-400 font-bold uppercase tracking-wider block">
                High (Crashes / Types)
              </span>
              <span className="text-2xl font-extrabold text-amber-400 font-mono">
                {report?.severity_breakdown?.HIGH || 0}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-obsidian border border-yellow-500/30 shadow-sm">
              <span className="text-[11px] text-yellow-400 font-bold uppercase tracking-wider block">
                Medium (Drift / Schemas)
              </span>
              <span className="text-2xl font-extrabold text-yellow-400 font-mono">
                {report?.severity_breakdown?.MEDIUM || 0}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-obsidian border border-bronze-hairline shadow-sm">
              <span className="text-[11px] text-warmash font-bold uppercase tracking-wider block">
                Low / Informational
              </span>
              <span className="text-2xl font-extrabold text-warmash font-mono">
                {report?.severity_breakdown?.LOW || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Category Breakdown Table */}
        {report?.category_breakdown && (
          <div>
            <h3 className="text-xs font-bold text-warmash uppercase tracking-wider mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-bronze" />
              <span>OWASP &amp; Contract Category Evaluation</span>
            </h3>

            <div className="border border-bronze-hairline rounded-xl overflow-hidden bg-obsidian">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-obsidian-surface border-b border-bronze-hairline text-[11px] font-bold text-warmash font-mono">
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Tests</th>
                    <th className="py-3 px-4">Passed</th>
                    <th className="py-3 px-4">Failures</th>
                    <th className="py-3 px-4">Warnings</th>
                    <th className="py-3 px-4 text-right">Pass Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bronze-hairline font-mono">
                  {Object.entries(report.category_breakdown).map(([cat, stat]) => {
                    const rate = Math.round((stat.passed / Math.max(stat.total, 1)) * 100);
                    return (
                      <tr key={cat} className="hover:bg-obsidian-surface/40">
                        <td className="py-3 px-4 text-bone font-medium">{cat}</td>
                        <td className="py-3 px-4 text-warmash">{stat.total}</td>
                        <td className="py-3 px-4 text-emerald-400 font-bold">{stat.passed}</td>
                        <td className="py-3 px-4 text-rose-400 font-bold">{stat.failed}</td>
                        <td className="py-3 px-4 text-amber-400">{stat.warning}</td>
                        <td className="py-3 px-4 text-right font-bold text-bone">{rate}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Top Critical Findings */}
        {report?.top_findings && report.top_findings.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-warmash uppercase tracking-wider mb-3 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Prioritized Issues Requiring Remediation</span>
            </h3>

            <div className="space-y-3">
              {report.top_findings.map((finding) => (
                <div
                  key={finding.id}
                  className="p-5 rounded-2xl bg-obsidian border border-bronze-hairline space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-mono">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded uppercase ${
                          finding.severity === 'CRITICAL'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {finding.severity}
                      </span>
                      <span className="text-bone font-bold">{finding.http_method} {finding.endpoint_path}</span>
                    </div>
                    <span className="text-[11px] font-mono text-warmash">{finding.test_category}</span>
                  </div>

                  <p className="text-sm text-bone">{finding.description}</p>

                  {finding.failure_reasons && (
                    <ul className="list-disc list-inside text-rose-400 font-mono text-[11px] space-y-0.5">
                      {finding.failure_reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}

                  {finding.remediation_hint && (
                    <div className="text-[11px] text-bronze-highlight font-sans bg-obsidian-surface p-3 rounded-xl border border-bronze-hairline mt-2">
                      <strong className="text-bone">Remediation:</strong> {finding.remediation_hint}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
