"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Bot, MessageSquare, Send, ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react';
import { askCopilot } from '@/api/client';
import { Cell, OptimizeResult } from '@/api/contract';

export interface CopilotDockProps {
  currentResult: OptimizeResult | null;
  selectedCell: Cell | null;
}

export const CopilotDock: React.FC<CopilotDockProps> = ({ currentResult, selectedCell }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string }>>([
    {
      sender: 'assistant',
      text: 'Hello. I am the UrjaSetu Climate Copilot. Ask me how this optimization allocates greening, what evidence underpins the rankings, or query selected zone heat data. (Demo mode: responses cite verified plan figures).',
    },
  ]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || isLoading) return;

    const userText = query.trim();
    setQuery('');
    setMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setIsLoading(true);

    try {
      const reply = await askCopilot(userText, {
        result: currentResult || undefined,
        selectedCell,
      });
      setMessages((prev) => [...prev, { sender: 'assistant', text: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: 'Sorry, could not query the copilot model. Please verify API connection.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {isOpen ? (
        <div className="w-[340px] sm:w-[380px] bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col h-[460px] animate-in slide-in-from-bottom-2 duration-150">
          {/* Header */}
          <div className="p-3.5 bg-[#14212B] text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#0F5C63] flex items-center justify-center">
                <Bot className="w-4 h-4 text-emerald-300" />
              </div>
              <div>
                <span className="text-xs font-bold block">Climate Copilot</span>
                <span className="text-[10px] text-slate-300 block">
                  Citing model card &amp; optimization run
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Collapse copilot"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs bg-slate-50/50">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] p-2.5 rounded-xl leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-[#0F5C63] text-white rounded-br-none'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-xs'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 p-2.5 rounded-xl text-slate-500 flex items-center gap-2 text-xs">
                  <Sparkles className="w-3.5 h-3.5 animate-spin text-[#0F5C63]" />
                  <span>Synthesizing plan evidence...</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Prompts */}
          <div className="px-3 py-1.5 border-t border-slate-200 bg-white flex gap-1.5 overflow-x-auto text-[11px]">
            <button
              onClick={() => {
                setQuery('Summarize cooling numbers for current plan');
              }}
              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Plan summary
            </button>
            <button
              onClick={() => {
                setQuery(
                  selectedCell
                    ? `Explain cooling estimate for ${selectedCell.id}`
                    : 'Explain how heat excess is calculated'
                );
              }}
              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {selectedCell ? `About ${selectedCell.id}` : 'Explain heat excess'}
            </button>
          </div>

          {/* Input field */}
          <form
            onSubmit={handleSend}
            className="p-2.5 border-t border-slate-200 bg-white flex items-center gap-2"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about cooling numbers or zones..."
              className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus-visible:ring-1 focus-visible:ring-[#0F5C63]"
            />
            <button
              type="submit"
              disabled={!query.trim() || isLoading}
              className="p-2 rounded-lg bg-[#0F5C63] text-white disabled:opacity-50 hover:bg-[#0A3E43] transition-colors cursor-pointer"
              aria-label="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2.5 bg-[#14212B] text-white rounded-full shadow-xl hover:bg-[#1E303D] transition-all cursor-pointer group hover:scale-105"
          aria-label="Open Climate Copilot Assistant"
        >
          <div className="w-5 h-5 rounded-full bg-[#0F5C63] flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-emerald-300" />
          </div>
          <span className="text-xs font-semibold">Climate Copilot</span>
          <ChevronUp className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
        </button>
      )}
    </div>
  );
};

export interface CoachMarksProps {
  onDismiss: () => void;
}

export const CoachMarks: React.FC<CoachMarksProps> = ({ onDismiss }) => {
  const [step, setStep] = useState(1);

  const steps = [
    {
      title: 'Step 1: Explore Surface Heat Burden',
      body: 'The map shows 250m satellite pixels combining land surface temperature and population density. Click any grid cell to view its evidence dossier.',
    },
    {
      title: 'Step 2: Adjust Budget & Run Optimizer',
      body: 'Use the left panel to set available greening hectares and target canopy index. The algorithm selects highest-cooling zones across 30 model ensemble seeds.',
    },
    {
      title: 'Step 3: Defend Your Decisions With TruthChips',
      body: 'Every single number is marked with Measured (satellite), Modelled (AI range), or Assumed (planning input). Download a signed dossier anytime.',
    },
  ];

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      onDismiss();
    }
  };

  return (
    <div
      role="region"
      aria-label="Welcome Guide"
      className="fixed bottom-20 left-6 z-40 max-w-sm bg-white rounded-2xl border-2 border-[#0F5C63] shadow-2xl p-4 animate-in fade-in duration-200"
    >
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F5C63]">
          Quick Tour ({step} of 3)
        </span>
        <button
          onClick={onDismiss}
          className="p-1 rounded text-slate-400 hover:text-slate-700"
          aria-label="Dismiss guide"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <h4 className="text-sm font-bold text-[#14212B] mb-1">
        {steps[step - 1].title}
      </h4>
      <p className="text-xs text-slate-600 leading-relaxed mb-4">
        {steps[step - 1].body}
      </p>

      <div className="flex items-center justify-between">
        <button
          onClick={onDismiss}
          className="text-xs text-slate-500 hover:text-slate-800 font-medium"
        >
          Skip tour
        </button>
        <button
          onClick={handleNext}
          className="px-3 py-1.5 rounded-lg bg-[#0F5C63] text-white text-xs font-semibold hover:bg-[#0A3E43] transition-colors cursor-pointer"
        >
          {step === 3 ? 'Got it, let’s plan' : 'Next tip →'}
        </button>
      </div>
    </div>
  );
};
