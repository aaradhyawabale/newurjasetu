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
  Key,
  ChevronDown,
  ChevronUp,
  Compass,
  RotateCw,
  Maximize2,
  Undo2,
  Sliders,
} from "lucide-react";
import { Drawer } from "../ui/Drawer";
import {
  CopilotChatContext,
  CopilotChatMessage,
  CopilotAdjustment,
} from "@/server/ai/gemini-advisor";

interface ExtendedChatMessage extends CopilotChatMessage {
  modelUsed?: string;
  proposedAdjustment?: CopilotAdjustment | null;
  applied?: boolean;
  reverted?: boolean;
}

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  context: CopilotChatContext;
  onApplyAdjustment?: (adjustment: CopilotAdjustment) => Promise<boolean | void> | boolean | void;
  onUndoAdjustment?: () => Promise<boolean | void> | boolean | void;
  activePlacement?: any;
}

export const CopilotDrawer: React.FC<CopilotDrawerProps> = ({
  isOpen,
  onClose,
  context,
  onApplyAdjustment,
  onUndoAdjustment,
  activePlacement,
}) => {
  const [messages, setMessages] = useState<ExtendedChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gemini configuration state
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [configuredModel, setConfiguredModel] = useState<string>("gemini-2.5-flash");
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [saveKeySuccess, setSaveKeySuccess] = useState<string | null>(null);
  const [saveKeyError, setSaveKeyError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const city = context.studyArea || "Pune Urban Study Area (PMC)";
  const infraType = context.infrastructureType || "Civic Infrastructure";
  const roadCollision = context.validation?.conflicts?.find(
    (c) => c.category === "road_collision" || c.category === "major_road"
  );
  const roadAccess = context.validation?.roadAccess;
  const officialContext = context.validation?.officialPlanningContext;

  // Check Gemini status when drawer opens
  useEffect(() => {
    if (isOpen) {
      fetch("/api/copilot")
        .then((r) => r.json())
        .then((data) => {
          if (data && typeof data.configured === "boolean") {
            setIsConfigured(data.configured);
            if (data.model) setConfiguredModel(data.model);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

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
      label: "Align to Road & Clear Overlap",
      prompt: "Align this infrastructure to the road corridor and retract from any road overlaps.",
    },
    {
      label: "Move 30m North",
      prompt: "Move the infrastructure 30m north.",
    },
    {
      label: "Rotate 90°",
      prompt: "Rotate the infrastructure 90 degrees.",
    },
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
  ];

  const handleSaveKey = async () => {
    const key = apiKeyInput.trim();
    if (!key) return;

    setIsSavingKey(true);
    setSaveKeyError(null);
    setSaveKeySuccess(null);

    try {
      const res = await fetch("/api/copilot/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: key,
          model: configuredModel || "gemini-2.5-flash",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error?.message || "Failed to configure key");
      }

      setIsConfigured(true);
      setSaveKeySuccess("Gemini API Key activated and saved to your laptop (.env)!");
      setApiKeyInput("");
      setTimeout(() => {
        setShowKeyConfig(false);
        setSaveKeySuccess(null);
      }, 2500);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setSaveKeyError(errMsg);
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    setError(null);
    setInputValue("");

    const newMessages: ExtendedChatMessage[] = [
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
          fallbackToLocal: true, // Always fallback to local GIS rules engine so copilot NEVER breaks
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const errMsg =
          data.message ||
          data.error?.message ||
          (typeof data.error === "string" ? data.error : null) ||
          "Failed to get Copilot response";
        throw new Error(errMsg);
      }

      const adjustment = data.proposedAdjustment as CopilotAdjustment | null | undefined;
      let applied = false;
      if (adjustment && onApplyAdjustment) {
        if (adjustment.autoApply) {
          try {
            onApplyAdjustment(adjustment);
            applied = true;
          } catch {
            applied = false;
          }
        }
      }

      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: data.reply,
          modelUsed: data.modelUsed,
          proposedAdjustment: adjustment || null,
          applied,
        },
      ]);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualApplyAdjustment = async (index: number, adj: CopilotAdjustment) => {
    if (!onApplyAdjustment) return;
    try {
      await onApplyAdjustment(adj);
      setMessages((prev) =>
        prev.map((m, i) => (i === index ? { ...m, applied: true, reverted: false } : m))
      );
    } catch {
      // ignore
    }
  };

  const handleManualUndoAdjustment = async (index: number) => {
    if (!onUndoAdjustment) return;
    try {
      await onUndoAdjustment();
      setMessages((prev) =>
        prev.map((m, i) => (i === index ? { ...m, applied: false, reverted: true } : m))
      );
    } catch {
      // ignore
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
            <div className="flex items-center gap-2">
              {isConfigured ? (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-purple-600" />
                  {configuredModel}
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                  <Info className="w-2.5 h-2.5 text-amber-600" />
                  Local GIS Rules Engine
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowKeyConfig(!showKeyConfig)}
                className="text-[10px] font-medium text-purple-700 hover:text-purple-900 underline flex items-center gap-0.5"
              >
                <Key className="w-2.5 h-2.5" />
                <span>{isConfigured ? "API Key" : "Add Gemini Key"}</span>
                {showKeyConfig ? (
                  <ChevronUp className="w-2.5 h-2.5" />
                ) : (
                  <ChevronDown className="w-2.5 h-2.5" />
                )}
              </button>
            </div>
          </div>

          {/* Collapsible Key Configuration Card */}
          {showKeyConfig && (
            <div className="p-2.5 bg-purple-50/80 rounded-lg border border-purple-200 text-xs flex flex-col gap-2 my-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-purple-900 flex items-center gap-1">
                  <Key className="w-3 h-3 text-purple-700" />
                  Google Gemini API Configuration
                </span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-purple-700 hover:underline flex items-center gap-0.5"
                >
                  <span>Get Free Key (Google AI Studio)</span>
                  <ArrowRight className="w-2.5 h-2.5" />
                </a>
              </div>
              <p className="text-[11px] text-purple-800 leading-normal">
                Paste your Google Gemini API key to activate cloud conversational reasoning. (The key will be saved directly to your laptop&apos;s local <code>.env</code> file).
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Paste your key: AIzaSy..."
                  className="flex-1 px-2.5 py-1 text-xs bg-white border border-purple-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-600 font-mono"
                />
                <button
                  type="button"
                  onClick={handleSaveKey}
                  disabled={isSavingKey || !apiKeyInput.trim()}
                  className="px-3 py-1 bg-purple-700 hover:bg-purple-800 text-white font-medium rounded text-xs transition-colors disabled:opacity-50 flex items-center gap-1 shrink-0"
                >
                  {isSavingKey ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    "Save & Connect"
                  )}
                </button>
              </div>
              {saveKeySuccess && (
                <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>{saveKeySuccess}</span>
                </div>
              )}
              {saveKeyError && (
                <div className="text-[11px] text-red-700 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-red-600" />
                  <span>{saveKeyError}</span>
                </div>
              )}
            </div>
          )}

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
                <span className="text-[10px] font-mono text-stone-400">
                  {isConfigured ? "Gemini Live AI Ready" : "Local GIS Engine Ready"}
                </span>
              </div>
              <p className="text-stone-700 leading-relaxed">
                Welcome! I am your AI Siting Copilot, directly grounded in UrjaSetu&apos;s GIS engine for{" "}
                <strong>{city}</strong>. I can answer spatial queries regarding road network overlaps, preliminary
                access road alignments, and statutory building guidelines under the <strong>Maharashtra UDCPR 2020</strong>.
              </p>
              {!isConfigured && (
                <div className="mt-1 p-2 bg-amber-50 rounded border border-amber-200 text-amber-800 text-[11px] flex items-center justify-between">
                  <span>Running in <strong>Local GIS Planning Mode</strong>. No external API key required.</span>
                  <button
                    type="button"
                    onClick={() => setShowKeyConfig(true)}
                    className="underline text-amber-900 font-semibold hover:text-black ml-2 shrink-0"
                  >
                    Enable Gemini Cloud AI
                  </button>
                </div>
              )}
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
                  <div>
                    {msg.modelUsed === "local-gis-rules-engine" && (
                      <div className="mb-2 pb-1.5 border-b border-stone-100 flex items-center gap-1 text-[10px] font-mono text-amber-700">
                        <Info className="w-2.5 h-2.5 text-amber-600" />
                        <span>Synthesized by UrjaSetu Local GIS Rules Engine</span>
                      </div>
                    )}
                    {renderFormattedReply(msg.content)}

                    {/* Proposed Infrastructure Adjustment Card */}
                    {msg.proposedAdjustment && (
                      <div className="mt-3 p-3 bg-amber-50/90 border border-amber-200/90 rounded-xl shadow-xs">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 text-amber-900 font-semibold text-xs">
                            {msg.proposedAdjustment.actionType === "move" && <Compass className="w-3.5 h-3.5 text-amber-700" />}
                            {msg.proposedAdjustment.actionType === "rotate" && <RotateCw className="w-3.5 h-3.5 text-amber-700" />}
                            {msg.proposedAdjustment.actionType === "resize" && <Maximize2 className="w-3.5 h-3.5 text-amber-700" />}
                            {msg.proposedAdjustment.actionType === "snap_to_road" && <Route className="w-3.5 h-3.5 text-amber-700" />}
                            {msg.proposedAdjustment.actionType === "relocate_to_crossing" && <Layers className="w-3.5 h-3.5 text-amber-700" />}
                            {msg.proposedAdjustment.actionType === "custom" && <Sliders className="w-3.5 h-3.5 text-amber-700" />}
                            <span>Infrastructure Spatial Adjustment</span>
                          </div>
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 font-semibold">
                            {msg.proposedAdjustment.actionType.replace(/_/g, " ")}
                          </span>
                        </div>

                        <p className="text-xs text-stone-800 font-medium mb-2 leading-relaxed">
                          {msg.proposedAdjustment.summary}
                        </p>

                        {/* Metric diff comparison */}
                        <div className="grid grid-cols-2 gap-1.5 text-[11px] mb-2.5 bg-white/90 p-2 rounded-lg border border-amber-100">
                          {msg.proposedAdjustment.lat !== undefined && (
                            <div className="col-span-2">
                              <span className="text-stone-400 block text-[10px] uppercase font-semibold">Center Coordinates</span>
                              <span className="font-mono text-stone-700">
                                {context.placement?.lat?.toFixed(4) || "20.3506"}, {context.placement?.lng?.toFixed(4) || "74.3626"}
                                {" → "}
                                <span className="text-emerald-700 font-bold">
                                  {msg.proposedAdjustment.lat.toFixed(4)}, {msg.proposedAdjustment.lng?.toFixed(4)}
                                </span>
                              </span>
                            </div>
                          )}
                          {(msg.proposedAdjustment.lengthM !== undefined || msg.proposedAdjustment.widthM !== undefined) && (
                            <div>
                              <span className="text-stone-400 block text-[10px] uppercase font-semibold">Dimensions</span>
                              <span className="font-mono text-stone-700">
                                {context.placement?.lengthM || 100}m × {context.placement?.widthM || 50}m
                                {" → "}
                                <span className="text-emerald-700 font-bold">
                                  {msg.proposedAdjustment.lengthM ?? context.placement?.lengthM ?? 100}m × {msg.proposedAdjustment.widthM ?? context.placement?.widthM ?? 50}m
                                </span>
                              </span>
                            </div>
                          )}
                          {msg.proposedAdjustment.bearingDeg !== undefined && (
                            <div>
                              <span className="text-stone-400 block text-[10px] uppercase font-semibold">Orientation / Bearing</span>
                              <span className="font-mono text-stone-700">
                                {context.placement?.bearingDeg ?? 0}°
                                {" → "}
                                <span className="text-emerald-700 font-bold">{msg.proposedAdjustment.bearingDeg}°</span>
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Status & Action Buttons */}
                        {msg.applied ? (
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-amber-200/60">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Applied to Infrastructure Map</span>
                            </span>
                            {onUndoAdjustment && (
                              <button
                                type="button"
                                onClick={() => handleManualUndoAdjustment(idx)}
                                className="flex items-center gap-1 text-[11px] text-stone-600 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-300 rounded px-2 py-0.5 font-medium transition-colors cursor-pointer"
                              >
                                <Undo2 className="w-3 h-3 text-stone-500" />
                                <span>Undo</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-amber-200/60">
                            <button
                              type="button"
                              onClick={() => handleManualApplyAdjustment(idx, msg.proposedAdjustment!)}
                              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 active:scale-[0.99] rounded-lg shadow-2xs transition-all cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Apply Adjustment to Map</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
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
                <span className="font-semibold">Copilot Advisory: </span>
                <span>{error}</span>
                {error.includes("GEMINI_API_KEY") && (
                  <button
                    type="button"
                    onClick={() => setShowKeyConfig(true)}
                    className="block mt-1 font-medium underline text-red-900"
                  >
                    Click here to enter your Gemini API key
                  </button>
                )}
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
