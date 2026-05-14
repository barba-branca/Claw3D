"use client";

import React from "react";
import { useOrchestration, type OrchestrationPhase } from "../state/store";
import { useAgentStore } from "@/features/agents/state/store";
import { 
  ClipboardList, 
  Code2, 
  ShieldCheck, 
  ChevronRight, 
  Activity,
  User 
} from "lucide-react";
import { clsx } from "clsx";

export const OrchestrationPanel = () => {
  const { state, dispatch } = useOrchestration();
  const { state: agentState, dispatch: agentDispatch } = useAgentStore();

  const phases: { id: OrchestrationPhase; label: string; icon: any }[] = [
    { id: "discovery", label: "PM (Requirements)", icon: ClipboardList },
    { id: "development", label: "Dev (Coding)", icon: Code2 },
    { id: "testing", label: "QA (Testing)", icon: ShieldCheck },
  ];

  const handleManualSwap = (phase: OrchestrationPhase) => {
    dispatch({ type: "setPhase", phase });
    
    // Logic to select the relevant role-based agent
    const roleMap: Record<OrchestrationPhase, string> = {
      discovery: "PM_Agent",
      development: "dev-agent",
      testing: "qa-agent",
      completed: "PM_Agent"
    };

    const targetAgent = agentState.agents.find(a => a.name === roleMap[phase]);
    if (targetAgent) {
      agentDispatch({ type: "selectAgent", agentId: targetAgent.agentId });
    }
  };

  const handleSwitchToLocal = () => {
    const localAgent = agentState.agents.find(a => a.name === "OpenClaw_Local");
    if (localAgent) {
      agentDispatch({ type: "selectAgent", agentId: localAgent.agentId });
      // If we are in discovery phase, we definitely want this one
      dispatch({ type: "setActiveAgent", agentId: localAgent.agentId });
    }
  };

  return (
    <div className="fixed top-24 right-6 w-80 z-50">
      <div className="backdrop-blur-xl bg-black/40 border border-white/10 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Activity className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Fleet Orchestration</h3>
            <p className="text-white/40 text-[10px] uppercase tracking-wider">Multi-Agent Workflow</p>
          </div>
        </div>

        {/* Phase Stepper */}
        <div className="space-y-4 relative">
          {phases.map((phase, idx) => {
            const isActive = state.phase === phase.id;
            const isCompleted = phases.findIndex(p => p.id === state.phase) > idx;
            const Icon = phase.icon;

            return (
              <div key={phase.id} className="relative group">
                {/* Connecting Line */}
                {idx < phases.length - 1 && (
                  <div className={clsx(
                    "absolute left-5 top-10 w-0.5 h-6 transition-colors duration-500",
                    isCompleted ? "bg-blue-500/50" : "bg-white/5"
                  )} />
                )}

                <button
                  onClick={() => handleManualSwap(phase.id)}
                  className={clsx(
                    "w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-300 border",
                    isActive 
                      ? "bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]" 
                      : "bg-white/5 border-transparent hover:bg-white/10"
                  )}
                >
                  <div className={clsx(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500",
                    isActive ? "bg-blue-500 text-white" : isCompleted ? "bg-green-500/20 text-green-400" : "bg-white/5 text-white/40"
                  )}>
                    {isCompleted ? <ShieldCheck className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>

                  <div className="text-left">
                    <span className={clsx(
                      "block text-xs font-medium",
                      isActive ? "text-white" : "text-white/40"
                    )}>
                      {phase.label}
                    </span>
                    {isActive && (
                      <span className="text-[10px] text-blue-400 animate-pulse flex items-center gap-1">
                        <Activity className="w-3 h-3" /> Active
                      </span>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>

        {/* Active Task (Simplified) */}
        <div className="mt-8 pt-6 border-t border-white/5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] text-white/40 uppercase tracking-widest">Active Task</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px]">IN PROGRESS</span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <p className="text-xs text-white/80 leading-relaxed">
              Refactoring the gateway to support remote liteLLM providers...
            </p>
          </div>
        </div>

        {/* Action Bar */}
        <div className="mt-6 flex gap-2">
            <button 
              onClick={handleSwitchToLocal}
              className="flex-1 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors flex items-center justify-center gap-2"
            >
                <User className="w-4 h-4" /> Use Local OpenClaw
            </button>
        </div>

      </div>

      {/* Decorative Blur and Light */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/10 blur-[80px] -z-10 rounded-full" />
    </div>
  );
};
