import { type OrchestrationPhase, type ProjectTask } from "../state/store";

export type HandoverTag = "PM" | "Dev" | "QA" | "Completed";

export const extractHandoverTag = (text: string): HandoverTag | null => {
  const match = text.match(/HANDOVER:\s*(PM|Dev|QA|Completed)/i);
  if (!match) return null;
  return (match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase()) as HandoverTag;
};

export const getPhaseFromTag = (tag: HandoverTag): OrchestrationPhase => {
  switch (tag) {
    case "PM":
      return "discovery";
    case "Dev":
      return "development";
    case "QA":
      return "testing";
    case "Completed":
      return "completed";
  }
};

export const handleOutputHandover = (
  agentId: string,
  output: string,
  onHandover: (from: string, tag: HandoverTag) => void
) => {
  const tag = extractHandoverTag(output);
  if (tag) {
    onHandover(agentId, tag);
  }
};
