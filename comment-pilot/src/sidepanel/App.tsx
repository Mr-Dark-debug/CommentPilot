import React, { useState } from 'react';
import { Settings } from '../components/Settings';
import { Generator } from '../components/Generator';
import { History } from '../components/History';
import { Settings as SettingsIcon, Zap, Clock } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'generate' | 'history' | 'settings'>('generate');

  return (
    <div className="flex flex-col h-screen bg-[#f3f2ef]">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-md text-white">
            <Zap size={18} />
          </div>
          <h1 className="text-lg font-bold text-gray-900">CommentPilot</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4">
        {activeTab === 'generate' && <Generator />}
        {activeTab === 'history' && <History />}
        {activeTab === 'settings' && <Settings />}
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t flex justify-around p-2 sticky bottom-0">
        <button
          onClick={() => setActiveTab('generate')}
          className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
            activeTab === 'generate' ? 'text-blue-600' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Zap size={20} />
          <span className="text-[10px] font-medium mt-1">Generate</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
            activeTab === 'history' ? 'text-blue-600' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Clock size={20} />
          <span className="text-[10px] font-medium mt-1">History</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
            activeTab === 'settings' ? 'text-blue-600' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <SettingsIcon size={20} />
          <span className="text-[10px] font-medium mt-1">Settings</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
