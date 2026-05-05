import React, { useEffect, useState } from 'react';
import { getHistory, HistoryItem } from '../lib/storage';
import { ExternalLink, Copy, MessageSquare } from 'lucide-react';

export const History: React.FC = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    getHistory().then(setHistory);
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (history.length === 0) {
    return <div className="p-8 text-center text-gray-500">No history yet.</div>;
  }

  return (
    <div className="space-y-4">
      {history.map((item) => (
        <div key={item.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 text-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 text-blue-700 px-2 py-1 rounded">
              <MessageSquare size={12} /> {item.type}
            </span>
            <span className="text-xs text-gray-400">
              {new Date(item.timestamp).toLocaleDateString()}
            </span>
          </div>
          <div className="text-gray-800 mb-3 whitespace-pre-wrap">{item.content}</div>
          <div className="flex justify-between items-center border-t pt-2">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 text-xs"
            >
              <ExternalLink size={14} /> View Context
            </a>
            <button
              onClick={() => copyToClipboard(item.content)}
              className="text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 text-xs bg-gray-100 px-2 py-1 rounded transition"
            >
              <Copy size={14} /> Copy
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
