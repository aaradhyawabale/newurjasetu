"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  Trash2,
  MapPin,
  Route,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Info,
  ShieldAlert,
  Layers,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { Drawer } from "../ui/Drawer";
import {
  CopilotChatContext,
  CopilotChatMessage,
} from "@/server/ai/gemini-advisor";

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  context: CopilotChatContext;
}

export const CopilotDrawer: React.FC<CopilotDrawerProps> = ({
  isOpen,
  onClose,
  context,
}) => {
  const [messages, setMessages] = useState<CopilotChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const city = context.studyArea || "Pune Urban Study Area (PMC)";
  const infraType = context.infrastructureType || "Civic Infrastructure";
  const roadCollision = context.validation?.conflicts?.find(
    (c) => c.category === "road_collision" || c.category === "major_road"
  );
  const roadAccess = context.validation?.roadAccess;
  const officialContext = context.validation?.officialPlanningContext;

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const quickPrompts = [
    {
      label: "Check Road Collision",
      prompt: "Is this proposed building overlapping an existing road or road right-of-way?",
    },
    {
      label: "Road Access Analysis",
      prompt: "Does this site have direct road access, and what preliminary access road is required?",
    },
    {
      label: "Official DP & UDCPR Rules",
      prompt: "Which official planning documents and Maharashtra UDCPR 2020 rules apply to this facility?",
    },
    {
      label: "Simple Citizen Explanation",
      prompt: "Explain whether this site is suitable or has problems in simple plain language for a citizen.",
    },
    {
      label: "Missing Information",
      prompt: "What critical data is missing or unverified before construction decisions can be made?",
    },
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    setError(null);
    setInputValue("");

    const newMessages: CopilotChatMessage[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          context,
          history: messages,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to get Copilot response");
      }

      setMessages([
        ...newMessages,
        { role: "assistant", content: data.data.reply },
      ]);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearHistory = () => {
    setMessages([]);
    setError(null);
  };

  // Helper to format assistant response with clean markdown structure
  const renderFormattedReply = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("### ")) {
        return (
          <h4 key={idx} className="font-bold text-stone-900 mt-2 mb-1 text-xs uppercase tracking-wider">
            {trimmed.replace("### ", "")}
          </h4>
        );
      }
      if (trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
        return (
          <h3 key={idx} className="font-bold text-stone-900 mt-3 mb-1 text-sm">
            {trimmed.replace(/^#+\s*/, "")}
          </h3>
        );
      }
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const bulletText = trimmed.substring(2);
        return (
          <li key={idx} className="ml-4 list-disc text-stone-700 text-xs my-0.5 leading-relaxed">
            {renderBoldText(bulletText)}
          </li>
        );
      }
      if (/^\d+\.\s/.test(trimmed)) {
        const numText = trimmed.replace(/^\d+\.\s/, "");
        return (
          <li key={idx} className="ml-4 list-decimal text-stone-700 text-xs my-0.5 leading-relaxed">
            {renderBoldText(numText)}
          </li>
        );
      }
      if (trimmed === "") {
        return <div key={idx} className="h-1.5" />;
      }
      return (
        <p key={idx} className="text-stone-700 text-xs my-1 leading-relaxed">
          {renderBoldText(trimmed)}
        </p>
      );
    });
  };

  const renderBoldText = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold text-stone-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="AI Planning Assistant & Siting Copilot"
      subtitle="Interactive urban infrastructure advisory grounded in active GIS evidence and Maharashtra statutory regulations"
      size="lg"
    >
      <div className="flex flex-col h-[calc(100vh-140px)] justify-between">
        {/* Top Active Grounding Pill Strip */}
        <div className="p-3 bg-stone-50 rounded-panel border border-stone-200 flex flex-col gap-2 shrink-0 mb-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-stone-500 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-purple-600" />
              Active Geospatial Grounding
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-purple-50 text-purple-700 border border-purple-200">
              gemini-3.5-flash-lite
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-white border border-stone-200 text-stone-700">
              <MapPin className="w-2.5 h-2.5 text-stone-500" />
              {city}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-white border border-stone-200 text-stone-700">
              <Layers className="w-2.5 h-2.5 text-stone-500" />
              {infraType}
              {context.placement && ` (${Math.round(context.placement.areaM2)} m²)`}
            </span>
            {roadCollision ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-red-50 border border-red-200 text-red-700 font-medium">
                <AlertTriangle className="w-2.5 h-2.5 text-red-600" />
                Road Overlap Detected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                No Road Overlap
              </span>
            )}
            {roadAccess && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-stone-100 border border-stone-200 text-stone-700">
                <Route className="w-2.5 h-2.5 text-amber-600" />
                {roadAccess.requiresNewAccessRoad
                  ? `Preliminary Access (${Math.round(roadAccess.distanceM || 0)}m)`
                  : `Direct Road (${Math.round(roadAccess.distanceM || 0)}m)`}
              </span>
            )}
            {officialContext && officialContext.masterPlan && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-blue-50 border border-blue-200 text-blue-700">
                <BookOpen className="w-2.5 h-2.5 text-blue-600" />
                {officialContext.masterPlan}
              </span>
            )}
          </div>
        </div>

        {/* Message Thread Area */}
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4">
          {/* Welcome Message */}
          <div className="p-3.5 bg-purple-50/60 rounded-panel border border-purple-200 text-xs flex gap-3 text-stone-800">
            <div className="w-7 h-7 rounded-full bg-purple-700 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-stone-900">UrjaSetu Planning Assistant</span>
                <span className="text-[10px] font-mono text-stone-400">Ready</span>
              </div>
              <p className="text-stone-700 leading-relaxed">
                Welcome! I am your AI Siting Copilot, directly grounded in UrjaSetu&apos;s GIS engine for{" "}
                <strong>{city}</strong>. I can answer spatial queries regarding road network overlaps, preliminary
                access road alignments, and statutory building guidelines under the <strong>Maharashtra UDCPR 2020</strong>.
              </p>
              <div className="pt-1 flex items-center gap-1.5 text-[10px] text-stone-500 font-mono">
                <ShieldAlert className="w-3 h-3 text-stone-400 shrink-0" />
                <span>Responses are decision-support guidance, not statutory municipal building sanctions.</span>
              </div>
            </div>
          </div>

          {/* Quick Prompt Chips */}
          {messages.length === 0 && (
            <div className="flex flex-col gap-1.5 my-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400 font-semibold">
                Suggested Questions
              </span>
              <div className="flex flex-wrap gap-1.5">
                {quickPrompts.map((qp, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSendMessage(qp.prompt)}
                    className="text-left text-xs px-2.5 py-1.5 rounded-lg bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 hover:text-stone-900 transition-colors flex items-center gap-1.5 shadow-2xs group"
                  >
                    <span>{qp.label}</span>
                    <ArrowRight className="w-3 h-3 text-stone-400 group-hover:text-purple-600 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conversation Messages */}
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-full bg-purple-700 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <Sparkles className="w-3 h-3" />
                </div>
              )}
              <div
                className={`p-3.5 rounded-panel max-w-[85%] text-xs shadow-2xs ${
                  msg.role === "user"
                    ? "bg-stone-900 text-white rounded-br-none"
                    : "bg-white border border-stone-200 text-stone-800 rounded-bl-none"
                }`}
              >
                {msg.role === "user" ? (
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div>{renderFormattedReply(msg.content)}</div>
                )}
              </div>
            </div>
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 p-3 bg-purple-50/40 rounded-panel border border-purple-100 text-xs text-purple-900 w-fit">
              <Loader2 className="w-3.5 h-3.5 text-purple-600 animate-spin" />
              <span>Analyzing spatial data & statutory regulations...</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 rounded-panel border border-red-200 text-xs text-red-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold">Copilot Error: </span>
                <span>{error}</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input & Action Bar */}
        <div className="pt-3 border-t border-stone-200 flex flex-col gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask about ${infraType} siting, road overlap, access, or UDCPR 2020...`}
              disabled={isLoading}
              className="flex-1 px-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-purple-600 bg-white"
            />
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputValue.trim()}
              className="px-3 py-2 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-medium transition-colors shadow-2xs disabled:opacity-50 flex items-center gap-1.5"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Ask</span>
            </button>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                title="Clear conversation"
                className="p-2 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-500 hover:text-stone-800 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between text-[10px] text-stone-400 font-mono">
            <span>Press Enter to send</span>
            <span>UrjaSetu Spatial Intelligence</span>
          </div>
        </div>
      </div>
    </Drawer>
  );
};
