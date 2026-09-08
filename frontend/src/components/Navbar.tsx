import React from 'react';
import {
  ShieldCheck,
  PlayCircle,
  Activity,
  ListFilter,
  Grid,
  TrendingUp,
  FileDown,
  Circle
} from 'lucide-react';
import { TestRun } from '../types';

export type TabType = 'new' | 'live' | 'results' | 'map' | 'trends' | 'export';

interface NavbarProps {
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
  activeRun: TestRun | null;
  backendOnline: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  activeRun,
  backendOnline,
}) => {
  const isRunning = activeRun?.status === 'RUNNING';

  const navItems = [
    { id: 'new', label: 'New Test Run', icon: PlayCircle },
    { id: 'live', label: 'Live Progress', icon: Activity, badge: isRunning ? 'RUNNING' : undefined },
    { id: 'results', label: 'Results Table', icon: ListFilter, count: activeRun?.total_tests },
    { id: 'map', label: 'Endpoint Map', icon: Grid },
    { id: 'trends', label: 'Trends', icon: TrendingUp },
    { id: 'export', label: 'Report Export', icon: FileDown },
  ];

  return (
    <header className="glass-panel sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Product Title */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => setCurrentTab('new')}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/25 border border-emerald-300/40 group-hover:scale-105 transition-transform duration-200">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-[#ECFDF5]">
                  APISentry
                </span>
                <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-950/60 text-[#00E599] border border-[#00E599]/35 backdrop-blur-md shadow-sm flex items-center gap-1.5 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00E599] animate-pulse" />
                  DEFENSE NETWORK
                </span>
              </div>
              <p className="text-[11px] text-[#94A3B8] font-mono flex items-center gap-1.5 mt-0.5">
                <span>API Conformance &amp; Multi-Tenant Isolation</span>
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id as TabType)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 relative ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-600/80 to-teal-500/80 text-white font-bold backdrop-blur-md shadow-md shadow-emerald-500/25 border border-emerald-300/40'
                      : 'text-[#94A3B8] hover:text-[#ECFDF5] hover:bg-emerald-500/10 backdrop-blur-sm border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#00E599]'}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Side Controls */}
          <div className="flex items-center gap-3">
            {/* Active Run pill */}
            {activeRun && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-xl card text-xs backdrop-blur-md border border-emerald-400/25">
                <span className="text-[#94A3B8] font-medium">Run:</span>
                <span className="font-mono text-[#00E599] font-bold truncate max-w-[100px]" title={activeRun.id}>
                  {activeRun.id.slice(0, 8)}...
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase ${
                    activeRun.status === 'COMPLETED'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : activeRun.status === 'RUNNING'
                      ? 'bg-emerald-500/20 text-[#00E599] animate-pulse border border-[#00E599]/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {activeRun.status}
                </span>
              </div>
            )}

            {/* Backend Status indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full card text-[11px] font-mono backdrop-blur-md border border-emerald-400/25">
              <Circle
                className={`w-2.5 h-2.5 fill-current ${
                  backendOnline ? 'text-emerald-400 shadow-sm' : 'text-rose-500'
                }`}
              />
              <span className="text-[#94A3B8] hidden sm:inline font-medium">
                {backendOnline ? 'Telemetry Active' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
