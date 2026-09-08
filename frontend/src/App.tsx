import React, { useState, useEffect } from 'react';
import { Navbar, TabType } from './components/Navbar';
import { NewTestRun } from './pages/NewTestRun';
import { LiveProgress } from './pages/LiveProgress';
import { ResultsTable } from './pages/ResultsTable';
import { EndpointMap } from './pages/EndpointMap';
import { Trends } from './pages/Trends';
import { ReportExport } from './pages/ReportExport';
import { AnimatedBackground } from './components/AnimatedBackground';
import { checkBackendHealth, getTestHistory } from './services/api';
import { TestRun } from './types';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<TabType>('new');
  const [activeRun, setActiveRun] = useState<TestRun | null>(null);
  const [endpointFilter, setEndpointFilter] = useState<string | undefined>(undefined);
  const [backendOnline, setBackendOnline] = useState(true);

  // Set default theme to Deep Obsidian & Brushed Bronze
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'obsidian-bronze');
    localStorage.setItem('apisentry_theme', 'obsidian-bronze');
  }, []);

  // Check health on mount and every 10s
  useEffect(() => {
    const check = async () => {
      const ok = await checkBackendHealth();
      setBackendOnline(ok);
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  // Try to load the most recent run on initial load
  useEffect(() => {
    const loadLatest = async () => {
      try {
        const history = await getTestHistory(1);
        if (history && history.length > 0) {
          setActiveRun(history[0]);
        }
      } catch (err) {
        console.error('No previous runs found:', err);
      }
    };
    loadLatest();
  }, []);

  const handleRunCreated = (run: TestRun) => {
    setActiveRun(run);
    setCurrentTab('live');
  };

  const handleSelectRun = (run: TestRun) => {
    setActiveRun(run);
    setCurrentTab('results');
  };

  const handleSelectEndpointFromMap = (path: string) => {
    setEndpointFilter(path);
    setCurrentTab('results');
  };

  return (
    <div className="min-h-screen text-bone flex flex-col font-sans selection:bg-bronze/30 selection:text-bone relative">
      {/* Reactive Particle Mesh Canvas (Idle drift, Lerp mouse repulsion, Scroll parallax) */}
      <AnimatedBackground />

      {/* Obsidian & Bronze Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          if (tab !== 'results') setEndpointFilter(undefined);
          setCurrentTab(tab);
        }}
        activeRun={activeRun}
        backendOnline={backendOnline}
      />

      {/* Main Content Area */}
      <main className="flex-1 relative z-10">
        {currentTab === 'new' && <NewTestRun onRunCreated={handleRunCreated} />}
        {currentTab === 'live' && (
          <LiveProgress
            runId={activeRun?.id || null}
            onNavigate={(tab) => setCurrentTab(tab)}
          />
        )}
        {currentTab === 'results' && (
          <ResultsTable
            runId={activeRun?.id || null}
            initialEndpointFilter={endpointFilter}
          />
        )}
        {currentTab === 'map' && (
          <EndpointMap
            run={activeRun}
            onSelectEndpoint={handleSelectEndpointFromMap}
          />
        )}
        {currentTab === 'trends' && <Trends onSelectRun={handleSelectRun} />}
        {currentTab === 'export' && <ReportExport run={activeRun} />}
      </main>

      {/* Persistent Obsidian & Bronze Footer */}
      <footer className="border-t border-bronze-hairline bg-obsidian py-4 px-6 text-center text-xs text-warmash font-mono transition-colors relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-bronze" />
            <span className="text-bone font-semibold">APISentry</span>
            <span className="text-warmash">&bull; API Contract & Data-Consistency Compliance Suite</span>
          </span>
          <span className="text-warmash font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-bronze" />
            <span>Deep Obsidian &amp; Brushed Bronze Edition</span>
          </span>
        </div>
      </footer>
    </div>
  );
};

export default App;
