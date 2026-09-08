import React, { useState } from 'react';
import {
  Sparkles,
  Upload,
  Globe,
  Key,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  FileCode,
  Terminal,
  Layers
} from 'lucide-react';
import { createTestRun } from '../services/api';
import { TestRun } from '../types';

const SAMPLE_DEMO_SPEC = `{
  "openapi": "3.0.0",
  "info": {
    "title": "Sample E-Commerce & Account API",
    "version": "2.1.0",
    "description": "Demo REST API with intentional contract discrepancies and tenant data access"
  },
  "paths": {
    "/api/v1/users/{user_id}": {
      "get": {
        "summary": "Get user by ID",
        "parameters": [
          { "name": "user_id", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "responses": {
          "200": {
            "description": "User found",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": ["id", "username", "email"],
                  "properties": {
                    "id": { "type": "integer" },
                    "username": { "type": "string" },
                    "email": { "type": "string" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/v1/profiles/{user_id}": {
      "get": {
        "summary": "Get user profile with bio",
        "parameters": [
          { "name": "user_id", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "responses": {
          "200": {
            "description": "Profile info",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": ["id", "bio"],
                  "properties": {
                    "id": { "type": "integer" },
                    "bio": { "type": "string" }
                  },
                  "additionalProperties": false
                }
              }
            }
          }
        }
      }
    },
    "/api/v1/invoices/{invoice_id}": {
      "get": {
        "summary": "Get invoice by ID",
        "parameters": [
          { "name": "invoice_id", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "responses": {
          "200": {
            "description": "Invoice details",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": ["id", "owner_id", "amount", "status"],
                  "properties": {
                    "id": { "type": "integer" },
                    "owner_id": { "type": "integer" },
                    "amount": { "type": "number" },
                    "status": { "type": "string" }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}`;

interface NewTestRunProps {
  onRunCreated: (run: TestRun) => void;
}

export const NewTestRun: React.FC<NewTestRunProps> = ({ onRunCreated }) => {
  const [targetUrl, setTargetUrl] = useState('http://localhost:8001');
  const [specInputMode, setSpecInputMode] = useState<'raw' | 'url'>('raw');
  const [specContent, setSpecContent] = useState(SAMPLE_DEMO_SPEC);
  const [specUrl, setSpecUrl] = useState('');

  // Credentials for Multi-tenant isolation testing
  const [accountAName, setAccountAName] = useState('Tenant A (Primary)');
  const [accountAAuth, setAccountAAuth] = useState('Bearer demo_alice_token_123');
  const [accountAResources, setAccountAResources] = useState('{"user_id": 1, "invoice_id": 101}');

  const [accountBName, setAccountBName] = useState('Tenant B (Attacker / Peer)');
  const [accountBAuth, setAccountBAuth] = useState('Bearer demo_bob_token_456');
  const [accountBResources, setAccountBResources] = useState('{"user_id": 2, "invoice_id": 102}');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setSpecContent(event.target.result);
        setSpecInputMode('raw');
      }
    };
    reader.readAsText(file);
  };

  const loadDemoPreset = () => {
    setTargetUrl('http://localhost:8001');
    setSpecInputMode('raw');
    setSpecContent(SAMPLE_DEMO_SPEC);
    setAccountAName('Tenant A (Alice)');
    setAccountAAuth('Bearer alice_token_secure_99');
    setAccountAResources('{"user_id": 1, "invoice_id": 101}');
    setAccountBName('Tenant B (Bob)');
    setAccountBAuth('Bearer bob_token_secure_44');
    setAccountBResources('{"user_id": 2, "invoice_id": 102}');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let resA = {};
      let resB = {};
      try {
        if (accountAResources.trim()) resA = JSON.parse(accountAResources);
      } catch {
        throw new Error('Account A Resource IDs must be valid JSON (e.g. {"user_id": 1})');
      }
      try {
        if (accountBResources.trim()) resB = JSON.parse(accountBResources);
      } catch {
        throw new Error('Account B Resource IDs must be valid JSON (e.g. {"user_id": 2})');
      }

      const headersA: Record<string, string> = {};
      if (accountAAuth) headersA['Authorization'] = accountAAuth;

      const headersB: Record<string, string> = {};
      if (accountBAuth) headersB['Authorization'] = accountBAuth;

      const payload = {
        target_base_url: targetUrl.trim(),
        spec_content: specInputMode === 'raw' ? specContent : undefined,
        spec_url: specInputMode === 'url' ? specUrl.trim() : undefined,
        account_a: {
          name: accountAName,
          headers: headersA,
          resource_ids: resA,
        },
        account_b: {
          name: accountBName,
          headers: headersB,
          resource_ids: resB,
        },
      };

      const newRun = await createTestRun(payload);
      onRunCreated(newRun);
    } catch (err: any) {
      setError(err.message || 'Failed to start test run');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      {/* Translucent Hero Banner with Living Network Defense Copy */}
      <div className="mb-8 card p-6 sm:p-8 rounded-3xl relative overflow-hidden backdrop-blur-xl border border-cyan-400/25 shadow-2xl">
        <div className="max-w-2xl relative z-10">
          <div className="text-[11px] sm:text-xs uppercase tracking-widest font-mono text-[#7FD4FF] mb-2 font-bold flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[#7FD4FF] animate-ping" />
            // APISENTRY LIVING DEFENSE NETWORK
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-[#EAE8F5] tracking-tight mb-3 leading-tight">
            Reimagining defense for the autonomous era
          </h1>
          <p className="text-sm sm:text-base text-[#A9A6C4] leading-relaxed mb-6">
            A living network that watches, connects, and adapts — visualized in real time. Configure your OpenAPI 3.x specification and test accounts to audit contract conformance and multi-tenant data isolation.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={loadDemoPreset}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl btn-primary text-xs font-bold shadow-lg shadow-cyan-500/25"
            >
              <Sparkles className="w-4 h-4 text-white" />
              <span>Load Demo Target Preset</span>
            </button>
            <div className="px-3.5 py-2 rounded-xl btn-secondary text-xs font-mono text-cyan-300 flex items-center gap-2 border border-cyan-400/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Fibonacci Mesh Telemetry Active</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-950/40 backdrop-blur-md border border-red-500/40 text-rose-300 text-sm flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
          <div>
            <strong className="font-semibold text-bone">Configuration Error:</strong> {error}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Target API Base URL */}
        <div className="card rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-obsidian border border-bronze-hairline flex items-center justify-center">
              <Globe className="w-4 h-4 text-bronze" />
            </div>
            <h2 className="text-base font-bold text-bone">1. Target API Base URL</h2>
          </div>
          <p className="text-sm text-warmash mb-4">
            The live server URL where your REST API is currently hosted and reachable.
          </p>
          <input
            type="url"
            required
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="http://localhost:8001 or https://api.example.com"
            className="w-full px-4 py-3 rounded-xl bg-obsidian border border-bronze-hairline text-bone text-sm focus:outline-none focus:border-bronze font-mono transition"
          />
        </div>

        {/* Step 2: OpenAPI Specification Input */}
        <div className="card rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-obsidian border border-bronze-hairline flex items-center justify-center">
                <FileCode className="w-4 h-4 text-bronze" />
              </div>
              <h2 className="text-base font-bold text-bone">2. OpenAPI / Swagger 3.x Specification</h2>
            </div>

            <div className="flex items-center gap-1.5 bg-obsidian p-1 rounded-xl border border-bronze-hairline text-xs">
              <button
                type="button"
                onClick={() => setSpecInputMode('raw')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  specInputMode === 'raw'
                    ? 'bg-bronze text-obsidian font-bold'
                    : 'text-warmash hover:text-bone'
                }`}
              >
                JSON / YAML Text
              </button>
              <button
                type="button"
                onClick={() => setSpecInputMode('url')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  specInputMode === 'url'
                    ? 'bg-bronze text-obsidian font-bold'
                    : 'text-warmash hover:text-bone'
                }`}
              >
                Remote Spec URL
              </button>
            </div>
          </div>

          {specInputMode === 'raw' ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-warmash font-mono">OpenAPI JSON / YAML Editor</span>
                <label className="cursor-pointer text-xs font-semibold text-bronze hover:text-bronze-highlight flex items-center gap-1.5 transition">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Spec File (.json / .yaml)</span>
                  <input
                    type="file"
                    accept=".json,.yaml,.yml"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <textarea
                rows={10}
                required
                value={specContent}
                onChange={(e) => setSpecContent(e.target.value)}
                placeholder="Paste OpenAPI 3.x JSON or YAML here..."
                className="w-full px-4 py-3 rounded-xl bg-obsidian border border-bronze-hairline text-bone text-xs font-mono leading-relaxed focus:outline-none focus:border-bronze transition"
              />
            </div>
          ) : (
            <div>
              <p className="text-sm text-warmash mb-2">
                Enter URL to OpenAPI JSON/YAML endpoint (e.g. <code>http://localhost:8001/openapi.json</code>):
              </p>
              <input
                type="url"
                required={specInputMode === 'url'}
                value={specUrl}
                onChange={(e) => setSpecUrl(e.target.value)}
                placeholder="http://localhost:8001/openapi.json"
                className="w-full px-4 py-3 rounded-xl bg-obsidian border border-bronze-hairline text-bone text-sm focus:outline-none focus:border-bronze font-mono transition"
              />
            </div>
          )}
        </div>

        {/* Step 3: Multi-Tenant Test Credentials */}
        <div className="card rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-lg bg-obsidian border border-bronze-hairline flex items-center justify-center">
              <Key className="w-4 h-4 text-bronze" />
            </div>
            <h2 className="text-base font-bold text-bone">3. Multi-Tenant Test Credentials (Data Isolation Check)</h2>
          </div>
          <p className="text-sm text-warmash mb-5">
            APISentry uses Account A and Account B to verify that one tenant cannot access another tenant's resources (BOLA / Multi-Tenant Data Leakage check).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Account A */}
            <div className="p-5 rounded-xl bg-obsidian border border-bronze-hairline">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-bronze uppercase tracking-wider">Account A (Primary)</span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-obsidian-surface text-warmash border border-bronze-hairline font-mono">Resource Owner</span>
              </div>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-warmash mb-1 text-sm">Tenant Name / Label</label>
                  <input
                    type="text"
                    value={accountAName}
                    onChange={(e) => setAccountAName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-obsidian border border-bronze-hairline text-bone text-xs focus:outline-none focus:border-bronze"
                  />
                </div>
                <div>
                  <label className="block text-warmash mb-1 text-sm">Authorization Header</label>
                  <input
                    type="text"
                    value={accountAAuth}
                    onChange={(e) => setAccountAAuth(e.target.value)}
                    placeholder="Bearer token_xyz..."
                    className="w-full px-3 py-2 rounded-lg bg-obsidian border border-bronze-hairline text-bone font-mono text-xs focus:outline-none focus:border-bronze"
                  />
                </div>
                <div>
                  <label className="block text-warmash mb-1 text-sm">Resource IDs (JSON object)</label>
                  <input
                    type="text"
                    value={accountAResources}
                    onChange={(e) => setAccountAResources(e.target.value)}
                    placeholder='{"user_id": 1, "invoice_id": 101}'
                    className="w-full px-3 py-2 rounded-lg bg-obsidian border border-bronze-hairline text-bone font-mono text-xs focus:outline-none focus:border-bronze"
                  />
                </div>
              </div>
            </div>

            {/* Account B */}
            <div className="p-5 rounded-xl bg-obsidian border border-bronze-hairline">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-bronze-deep uppercase tracking-wider">Account B (Peer / Attacker)</span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-obsidian-surface text-warmash border border-bronze-hairline font-mono">Cross-Tenant Probe</span>
              </div>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-warmash mb-1 text-sm">Tenant Name / Label</label>
                  <input
                    type="text"
                    value={accountBName}
                    onChange={(e) => setAccountBName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-obsidian border border-bronze-hairline text-bone text-xs focus:outline-none focus:border-bronze"
                  />
                </div>
                <div>
                  <label className="block text-warmash mb-1 text-sm">Authorization Header</label>
                  <input
                    type="text"
                    value={accountBAuth}
                    onChange={(e) => setAccountBAuth(e.target.value)}
                    placeholder="Bearer token_abc..."
                    className="w-full px-3 py-2 rounded-lg bg-obsidian border border-bronze-hairline text-bone font-mono text-xs focus:outline-none focus:border-bronze"
                  />
                </div>
                <div>
                  <label className="block text-warmash mb-1 text-sm">Resource IDs (JSON object)</label>
                  <input
                    type="text"
                    value={accountBResources}
                    onChange={(e) => setAccountBResources(e.target.value)}
                    placeholder='{"user_id": 2, "invoice_id": 102}'
                    className="w-full px-3 py-2 rounded-lg bg-obsidian border border-bronze-hairline text-bone font-mono text-xs focus:outline-none focus:border-bronze"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Execution Button (Brushed Bronze fill with Obsidian text hitting 9.8:1 contrast) */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-4 px-6 rounded-xl text-obsidian font-bold text-base flex items-center justify-center gap-3 transition-all duration-200 disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-obsidian border-t-transparent rounded-full animate-spin" />
                <span>Synthesizing Test Battery & Launching Audit Probes...</span>
              </>
            ) : (
              <>
                <span className="font-extrabold tracking-wide">Generate Test Battery & Start API Audit</span>
                <ArrowRight className="w-5 h-5 text-obsidian" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
