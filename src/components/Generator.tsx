import React, { useState, useEffect } from 'react';
import { generateCompletion } from '../lib/ai';
import {
  clearPendingComposeContext,
  getPendingComposeContext,
  saveHistoryItem
} from '../lib/storage';
import {
  COMMENT_SYSTEM_PROMPT, buildCommentUserPrompt,
  REPLY_SYSTEM_PROMPT, buildReplyUserPrompt,
  MESSAGE_SYSTEM_PROMPT, buildMessageUserPrompt
} from '../lib/prompts';
import { RefreshCw, Copy, Check, Target, PenTool, AlignLeft, BookmarkPlus } from 'lucide-react';

export const Generator: React.FC = () => {
  const [mode, setMode] = useState<'comment' | 'reply' | 'message'>('comment');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [savedDraftIndex, setSavedDraftIndex] = useState<string | null>(null);

  // Context State
  const [contextText, setContextText] = useState('');
  const [contextUrl, setContextUrl] = useState('');

  // Options State
  const [tone, setTone] = useState('Professional');
  const [intent, setIntent] = useState('Add value');
  const [professionalism, setProfessionalism] = useState('High');
  const [length, setLength] = useState('Medium');
  const [userInstructions, setUserInstructions] = useState('');

  useEffect(() => {
    let cancelled = false;

    const applyPendingContext = async () => {
      const pending = await getPendingComposeContext();
      const isFreshPending = pending && Date.now() - pending.timestamp < 30 * 60 * 1000;

      if (isFreshPending && !cancelled) {
        setMode(pending.mode);
        setContextUrl(pending.url || '');
        setContextText(pending.contextText || '');
        setUserInstructions(pending.mode === 'reply' ? pending.commentText || '' : '');
        await clearPendingComposeContext();
        return true;
      }

      if (pending) {
        await clearPendingComposeContext();
      }

      return false;
    };

    const hydrateContext = async () => {
      const usedPendingContext = await applyPendingContext();
      if (usedPendingContext || cancelled) {
        return;
      }

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (cancelled || !tabs[0]?.id) {
          return;
        }

        setContextUrl(tabs[0].url || '');
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: 'GET_PAGE_CONTEXT' },
          (response) => {
            if (!cancelled && response?.success && response.data) {
              setContextText(response.data.content || '');
            }
          }
        );
      });
    };

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes.pendingComposeContext?.newValue) {
        applyPendingContext();
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    hydrateContext();

    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const handleGenerate = async () => {
    if (!contextText.trim() && mode !== 'message') {
      setError("No context found. Please paste the post content or ensure you are on a LinkedIn post.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      let systemPrompt = '';
      let userPrompt = '';

      if (mode === 'comment') {
        systemPrompt = COMMENT_SYSTEM_PROMPT;
        userPrompt = buildCommentUserPrompt(contextText, tone, professionalism, intent) + `\nRequested Length: ${length}`;
      } else if (mode === 'reply') {
        systemPrompt = REPLY_SYSTEM_PROMPT;
        userPrompt = buildReplyUserPrompt(contextText, userInstructions, tone) + `\nRequested Length: ${length}`;
      } else if (mode === 'message') {
        systemPrompt = MESSAGE_SYSTEM_PROMPT;
        userPrompt = buildMessageUserPrompt(contextText, intent, userInstructions) + `\nProfessionalism: ${professionalism}\nRequested Length: ${length}`;
      }

      const responseText = await generateCompletion(systemPrompt, userPrompt);

      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : responseText;
        const parsed = JSON.parse(jsonStr);
        setResults(parsed);
      } catch (e) {
        setError("Failed to parse AI response. It might not be in the expected format.");
      }

    } catch (err: any) {
      setError(err.message || "An error occurred during generation.");
    } finally {
      setLoading(false);
    }
  };

  const copyResult = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(key);
    saveHistoryItem({ type: mode, content: text, url: contextUrl });
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const saveDraft = async (text: string, key: string) => {
    setSavedDraftIndex(key);
    await saveHistoryItem({ type: mode, content: "[DRAFT] " + text, url: contextUrl });
    setTimeout(() => setSavedDraftIndex(null), 2000);
  };

  const renderCommentResults = () => {
    if (!results) return null;
    return (
      <div className="space-y-4 mt-4">
        {['short', 'medium', 'strong'].map((category) => (
          results[category] && Array.isArray(results[category]) ? (
            <div key={category} className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-gray-500">{category} Comments</h4>
              {results[category].map((comment: string, i: number) => (
                <div key={`${category}-${i}`} className="bg-white p-3 rounded border text-sm group relative">
                  <p className="pr-16 text-gray-800">{comment}</p>
                  <div className="absolute top-2 right-2 flex gap-1">
                    <button
                      onClick={() => saveDraft(comment, `${category}-${i}`)}
                      title="Save as Draft"
                      className="p-1.5 text-gray-400 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 rounded transition"
                    >
                      {savedDraftIndex === `${category}-${i}` ? <Check size={16} className="text-green-600"/> : <BookmarkPlus size={16} />}
                    </button>
                    <button
                      onClick={() => copyResult(comment, `${category}-${i}`)}
                      title="Copy & Save to History"
                      className="p-1.5 text-gray-400 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 rounded transition"
                    >
                      {copiedIndex === `${category}-${i}` ? <Check size={16} className="text-green-600"/> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null
        ))}
      </div>
    );
  };

  const renderSingleResults = () => {
    if (!results) return null;
    return (
      <div className="space-y-3 mt-4">
        {Object.entries(results).map(([key, value]) => (
          typeof value === 'string' && (
            <div key={key} className="bg-white p-3 rounded border text-sm group relative">
              <h4 className="text-xs font-semibold uppercase text-gray-500 mb-1">{key.replace('_', ' ')}</h4>
              <p className="pr-16 text-gray-800 whitespace-pre-wrap">{value}</p>
              <div className="absolute top-2 right-2 flex gap-1">
                <button
                  onClick={() => saveDraft(value, key)}
                  title="Save as Draft"
                  className="p-1.5 text-gray-400 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 rounded transition"
                >
                  {savedDraftIndex === key ? <Check size={16} className="text-green-600"/> : <BookmarkPlus size={16} />}
                </button>
                <button
                  onClick={() => copyResult(value, key)}
                  title="Copy & Save to History"
                  className="p-1.5 text-gray-400 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 rounded transition"
                >
                  {copiedIndex === key ? <Check size={16} className="text-green-600"/> : <Copy size={16} />}
                </button>
              </div>
            </div>
          )
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex bg-gray-200 p-1 rounded-lg">
        {[
          { id: 'comment', label: 'Post' },
          { id: 'reply', label: 'Reply' },
          { id: 'message', label: 'Message' }
        ].map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id as any)}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              mode === m.id ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 space-y-3">
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
            <AlignLeft size={16} />
            {mode === 'message' ? 'Profile Context' : 'Post Context'}
          </label>
          <textarea
            value={contextText}
            onChange={(e) => setContextText(e.target.value)}
            className="w-full h-24 border border-gray-300 rounded p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder={mode === 'message' ? "Paste profile details here..." : "Paste post content here..."}
          />
        </div>

        {mode === 'reply' && (
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
               Comment to Reply To
            </label>
            <textarea
              value={userInstructions}
              onChange={(e) => setUserInstructions(e.target.value)}
              className="w-full h-16 border border-gray-300 rounded p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Paste the comment..."
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
              <PenTool size={16} /> Tone
            </label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full border border-gray-300 rounded p-1.5 text-sm"
            >
              <option>Professional</option>
              <option>Direct</option>
              <option>Friendly</option>
              <option>Insightful</option>
              <option>Supportive</option>
              <option>Thought-provoking</option>
              <option>Casual</option>
              <option>Humorous</option>
            </select>
          </div>

          {(mode === 'comment' || mode === 'message') && (
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                <Target size={16} /> Intent
              </label>
              <select
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                className="w-full border border-gray-300 rounded p-1.5 text-sm"
              >
                {mode === 'comment' ? (
                  <>
                    <option>Add value</option>
                    <option>Agree</option>
                    <option>Ask a question</option>
                    <option>Different perspective</option>
                  </>
                ) : (
                  <>
                    <option>Introduction</option>
                    <option>Networking</option>
                    <option>Collaboration</option>
                    <option>Job outreach</option>
                    <option>Appreciation</option>
                    <option>Follow-up</option>
                    <option>Warm message</option>
                    <option>Cold message</option>
                  </>
                )}
              </select>
            </div>
          )}

          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
               Level
            </label>
            <select
              value={professionalism}
              onChange={(e) => setProfessionalism(e.target.value)}
              className="w-full border border-gray-300 rounded p-1.5 text-sm"
            >
              <option>High</option>
              <option>Standard</option>
              <option>Casual</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
               Length
            </label>
            <select
              value={length}
              onChange={(e) => setLength(e.target.value)}
              className="w-full border border-gray-300 rounded p-1.5 text-sm"
            >
              <option>Short</option>
              <option>Medium</option>
              <option>Long</option>
            </select>
          </div>
        </div>

        {mode === 'message' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
               Specific Instructions
            </label>
            <input
              type="text"
              value={userInstructions}
              onChange={(e) => setUserInstructions(e.target.value)}
              className="w-full border border-gray-300 rounded p-2 text-sm"
              placeholder="e.g. Mention we both went to MIT..."
            />
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded transition disabled:bg-blue-300"
        >
          {loading ? <RefreshCw className="animate-spin" size={18} /> : <Target size={18} />}
          {loading ? 'Generating...' : 'Generate'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded border border-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-4">
        {mode === 'comment' ? renderCommentResults() : renderSingleResults()}
      </div>
    </div>
  );
};
