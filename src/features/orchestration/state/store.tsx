"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

export type OrchestrationPhase = "discovery" | "development" | "testing" | "completed";

export type ProjectTask = {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in-progress" | "completed";
  assignedTo?: string; // agentId
};

export type OrchestrationState = {
  phase: OrchestrationPhase;
  tasks: ProjectTask[];
  activeAgentId: string | null;
  history: {
    fromAgentId: string;
    toAgentId: string;
    timestamp: number;
    taskId: string;
  }[];
};

type Action =
  | { type: "setPhase"; phase: OrchestrationPhase }
  | { type: "addTask"; task: ProjectTask }
  | { type: "updateTask"; taskId: string; patch: Partial<ProjectTask> }
  | { type: "setActiveAgent"; agentId: string | null }
  | { type: "recordHandover"; from: string; to: string; taskId: string };

const initialState: OrchestrationState = {
  phase: "discovery",
  tasks: [],
  activeAgentId: null,
  history: [],
};

const reducer = (state: OrchestrationState, action: Action): OrchestrationState => {
  switch (action.type) {
    case "setPhase":
      return { ...state, phase: action.phase };
    case "addTask":
      return { ...state, tasks: [...state.tasks, action.task] };
    case "updateTask":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId ? { ...t, ...action.patch } : t
        ),
      };
    case "setActiveAgent":
      return { ...state, activeAgentId: action.agentId };
    case "recordHandover":
      return {
        ...state,
        history: [
          ...state.history,
          {
            fromAgentId: action.from,
            toAgentId: action.to,
            taskId: action.taskId,
            timestamp: Date.now(),
          },
        ],
      };
    default:
      return state;
  }
};

type OrchestrationContextValue = {
  state: OrchestrationState;
  dispatch: React.Dispatch<Action>;
};

const OrchestrationContext = createContext<OrchestrationContextValue | null>(null);

export const OrchestrationProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);

  return (
    <OrchestrationContext.Provider value={value}>
      {children}
    </OrchestrationContext.Provider>
  );
};

export const useOrchestration = () => {
  const ctx = useContext(OrchestrationContext);
  if (!ctx) {
    throw new Error("OrchestrationProvider is missing.");
  }
  return ctx;
};
