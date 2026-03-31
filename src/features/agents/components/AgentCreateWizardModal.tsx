"use client";

import { useMemo, useState } from "react";

import {
  AgentIdentityFields,
  type AgentIdentityValues,
} from "@/features/agents/components/AgentIdentityFields";
import { AgentAvatarEditorPanel } from "@/features/agents/components/AgentAvatarEditorPanel";
import {
  AGENT_FILE_META,
  AGENT_FILE_PLACEHOLDERS,
} from "@/lib/agents/agentFiles";
import {
  createEmptyPersonalityDraft,
  type PersonalityBuilderDraft,
} from "@/lib/agents/personalityBuilder";
import {
  createDefaultAgentAvatarProfile,
  type AgentAvatarProfile,
} from "@/lib/avatars/profile";
import { randomUUID } from "@/lib/uuid";

type AgentCreateWizardModalProps = {
  open: boolean;
  suggestedName?: string;
  busy?: boolean;
  submitError?: string | null;
  statusLine?: string | null;
  onClose: (createdAgentId: string | null) => void;
  onCreateAgent: (identity: AgentIdentityValues) => Promise<string | null>;
  onFinishWizard: (params: {
    agentId: string;
    draft: PersonalityBuilderDraft;
    profile: AgentAvatarProfile;
  }) => Promise<void>;
};

const stepClassName =
  "rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em]";

const inputClassName =
  "h-10 rounded-md border border-border/80 bg-background px-3 text-sm text-foreground outline-none";

const textAreaClassName =
  "min-h-[180px] w-full resize-y rounded-md border border-border/80 bg-background px-4 py-3 text-sm leading-6 text-foreground outline-none";

type WizardStepId =
  | "identity"
  | "avatar"
  | "SOUL.md"
  | "AGENTS.md"
  | "USER.md"
  | "TOOLS.md"
  | "MEMORY.md"
  | "HEARTBEAT.md";

const wizardSteps: Array<{ id: WizardStepId; label: string; hint: string }> = [
  {
    id: "identity",
    label: "Identidade",
    hint: "Crie o agente primeiro, depois preencha o restante passo a passo.",
  },
  {
    id: "avatar",
    label: "Avatar",
    hint: "Personalize a aparência no escritório antes de escrever o restante do perfil.",
  },
  {
    id: "SOUL.md",
    label: "Alma",
    hint: AGENT_FILE_META["SOUL.md"].hint,
  },
  {
    id: "AGENTS.md",
    label: "Agentes",
    hint: AGENT_FILE_META["AGENTS.md"].hint,
  },
  {
    id: "USER.md",
    label: "Usuário",
    hint: AGENT_FILE_META["USER.md"].hint,
  },
  {
    id: "TOOLS.md",
    label: "Ferramentas",
    hint: AGENT_FILE_META["TOOLS.md"].hint,
  },
  {
    id: "MEMORY.md",
    label: "Memória",
    hint: AGENT_FILE_META["MEMORY.md"].hint,
  },
  {
    id: "HEARTBEAT.md",
    label: "Pulsação",
    hint: AGENT_FILE_META["HEARTBEAT.md"].hint,
  },
];

const buildInitialDraft = (suggestedName: string): PersonalityBuilderDraft => {
  const draft = createEmptyPersonalityDraft();
  draft.identity.name = suggestedName.trim() || "New Agent";
  return draft;
};

const WizardField = ({
  label,
  value,
  placeholder,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) => (
  <label className="flex flex-col gap-2 text-xs text-muted-foreground">
    {label}
    <input
      className={inputClassName}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  </label>
);

const WizardTextAreaField = ({
  label,
  value,
  placeholder,
  disabled,
  rows = 6,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  onChange: (value: string) => void;
}) => (
  <label className="flex flex-col gap-2 text-xs text-muted-foreground">
    {label}
    <textarea
      className={textAreaClassName}
      value={value}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  </label>
);

export function AgentCreateWizardModal({
  open,
  suggestedName = "",
  busy = false,
  submitError = null,
  statusLine = null,
  onClose,
  onCreateAgent,
  onFinishWizard,
}: AgentCreateWizardModalProps) {
  const [step, setStep] = useState<WizardStepId>("identity");
  const [draft, setDraft] = useState<PersonalityBuilderDraft>(() =>
    buildInitialDraft(suggestedName),
  );
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const [draftAvatarProfile, setDraftAvatarProfile] = useState<AgentAvatarProfile>(() =>
    createDefaultAgentAvatarProfile(randomUUID()),
  );
  const [finishing, setFinishing] = useState(false);

  const canCreate = useMemo(() => draft.identity.name.trim().length > 0, [draft.identity.name]);
  const activeStepIndex = wizardSteps.findIndex((entry) => entry.id === step);
  const activeStep = wizardSteps[activeStepIndex] ?? wizardSteps[0];
  const isWorking = busy || finishing;
  const isFinalStep = step === "HEARTBEAT.md";
  const statusCopy = finishing ? "Saving the agent files and avatar." : statusLine;

  const updateDraft = <K extends keyof PersonalityBuilderDraft>(
    key: K,
    value: PersonalityBuilderDraft[K],
  ) => {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const advanceStep = async () => {
    if (step === "identity") {
      if (!canCreate || isWorking) return;
      if (!createdAgentId) {
        const agentId = await onCreateAgent({
          name: draft.identity.name,
          creature: draft.identity.creature,
          vibe: draft.identity.vibe,
          emoji: draft.identity.emoji,
        });
        if (!agentId) return;
        setCreatedAgentId(agentId);
      }
      setStep("avatar");
      return;
    }
    if (isFinalStep) {
      if (!createdAgentId || isWorking) return;
      setFinishing(true);
      try {
        await onFinishWizard({
          agentId: createdAgentId,
          draft,
          profile: draftAvatarProfile,
        });
      } finally {
        setFinishing(false);
      }
      return;
    }
    const nextStep = wizardSteps[activeStepIndex + 1];
    if (nextStep) {
      setStep(nextStep.id);
    }
  };

  const stepActionLabel =
    step === "identity" && !createdAgentId
      ? busy
        ? "Criando..."
        : "Criar e continuar"
      : isFinalStep
        ? isWorking
          ? "Salvando..."
          : "Finalizar assistente"
        : "Próximo";

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-background/84 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Create agent wizard"
      onClick={() => {
        if (!isWorking) {
          onClose(createdAgentId);
        }
      }}
    >
      <div
        className="ui-panel flex h-[min(92vh,980px)] w-full max-w-6xl flex-col overflow-hidden shadow-xs"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-border/40 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-mono text-[11px] font-semibold tracking-[0.06em] text-muted-foreground">
                Assistente de novo agente
              </div>
              <div className="mt-1 text-lg font-semibold text-foreground">
                Crie um agente passo a passo
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Comece com a identidade, depois construa o restante do perfil antes de finalizar.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="ui-btn-ghost px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isWorking}
                onClick={() => {
                  onClose(createdAgentId);
                }}
              >
                Fechar
              </button>
              {activeStepIndex > 0 ? (
                <button
                  type="button"
                  className="ui-btn-ghost px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isWorking}
                  onClick={() => {
                    const previousStep = wizardSteps[activeStepIndex - 1];
                    if (previousStep) {
                      setStep(previousStep.id);
                    }
                  }}
                >
                  Voltar
                </button>
              ) : null}
              <button
                type="button"
                className="ui-btn-primary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                disabled={(step === "identity" && !canCreate) || isWorking}
                onClick={() => {
                  void advanceStep();
                }}
              >
                {stepActionLabel}
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {wizardSteps.map((wizardStep, index) => {
              const complete = index < activeStepIndex;
              const active = wizardStep.id === step;
              return (
                <span
                  key={wizardStep.id}
                  className={`${stepClassName} ${
                    active
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : complete
                        ? "border-emerald-400/35 bg-emerald-500/10 text-foreground"
                        : "border-border/45 bg-background/40 text-muted-foreground"
                  }`}
                >
                  {index + 1}. {wizardStep.label}
                </span>
              );
            })}
          </div>
          <div className="mt-4 text-sm text-muted-foreground">{activeStep.hint}</div>
          {statusCopy ? (
            <div className="mt-4 rounded-md border border-border/45 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              {statusCopy}
            </div>
          ) : null}
          {submitError ? (
            <div className="ui-alert-danger mt-4 rounded-md px-3 py-2 text-xs">
              {submitError}
            </div>
          ) : null}
        </div>

        {step === "identity" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6">
            <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
              <section className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Identidade</h3>
                <div className="text-xs text-muted-foreground">
                  Confirm the live agent name first, then fill in the rest of `IDENTITY.md`.
                </div>
                <AgentIdentityFields
                  values={draft.identity}
                  disabled={isWorking}
                  onChange={(field, value) => {
                    updateDraft("identity", {
                      ...draft.identity,
                      [field]: value,
                    });
                  }}
                />
              </section>

              <div className="mt-6 rounded-xl border border-border/45 bg-muted/20 p-4 text-sm text-muted-foreground">
                Criar o agente neste passo o torna disponível no OpenClaw imediatamente para que o
                assistente possa salvar o perfil completo através do gateway nos passos seguintes.
              </div>
            </div>
          </div>
        ) : createdAgentId ? (
          <>
            {step === "avatar" ? (
              <AgentAvatarEditorPanel
                agentId={createdAgentId}
                agentName={draft.identity.name.trim() || "New Agent"}
                initialProfile={draftAvatarProfile}
                showActions={false}
                onDraftChange={(profile) => {
                  setDraftAvatarProfile(profile);
                }}
                onSave={async (profile) => {
                  setDraftAvatarProfile(profile);
                }}
              />
            ) : step === "SOUL.md" ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6">
                <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 pb-8">
                  <section className="space-y-3">
                    <h3 className="text-sm font-medium text-foreground">Alma</h3>
                    <div className="grid gap-4">
                      <WizardTextAreaField
                        label="Verdades fundamentais"
                        value={draft.soul.coreTruths}
                        placeholder="e.g. Protect the user's time. Prefer clarity over theatrics."
                        disabled={isWorking}
                        rows={5}
                        onChange={(value) => {
                          updateDraft("soul", { ...draft.soul, coreTruths: value });
                        }}
                      />
                      <WizardTextAreaField
                        label="Limites"
                        value={draft.soul.boundaries}
                        placeholder="e.g. Do not bluff. Say when something is uncertain."
                        disabled={isWorking}
                        rows={5}
                        onChange={(value) => {
                          updateDraft("soul", { ...draft.soul, boundaries: value });
                        }}
                      />
                      <WizardTextAreaField
                        label="Vibe"
                        value={draft.soul.vibe}
                        placeholder="e.g. Friendly, direct, and lightly playful."
                        disabled={isWorking}
                        rows={4}
                        onChange={(value) => {
                          updateDraft("soul", { ...draft.soul, vibe: value });
                        }}
                      />
                      <WizardTextAreaField
                        label="Continuidade"
                        value={draft.soul.continuity}
                        placeholder="e.g. Keep naming, preferences, and previous decisions consistent."
                        disabled={isWorking}
                        rows={4}
                        onChange={(value) => {
                          updateDraft("soul", { ...draft.soul, continuity: value });
                        }}
                      />
                    </div>
                  </section>
                </div>
              </div>
            ) : step === "USER.md" ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6">
                <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 pb-8">
                  <section className="space-y-3">
                    <h3 className="text-sm font-medium text-foreground">Usuário</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <WizardField
                        label="Nome"
                        value={draft.user.name}
                        placeholder="e.g. Luke"
                        disabled={isWorking}
                        onChange={(value) => {
                          updateDraft("user", { ...draft.user, name: value });
                        }}
                      />
                      <WizardField
                        label="Como chamá-los"
                        value={draft.user.callThem}
                        placeholder="e.g. Luke"
                        disabled={isWorking}
                        onChange={(value) => {
                          updateDraft("user", { ...draft.user, callThem: value });
                        }}
                      />
                      <WizardField
                        label="Pronomes"
                        value={draft.user.pronouns}
                        placeholder="e.g. he/him"
                        disabled={isWorking}
                        onChange={(value) => {
                          updateDraft("user", { ...draft.user, pronouns: value });
                        }}
                      />
                      <WizardField
                        label="Fuso horário"
                        value={draft.user.timezone}
                        placeholder="e.g. America/Chicago"
                        disabled={isWorking}
                        onChange={(value) => {
                          updateDraft("user", { ...draft.user, timezone: value });
                        }}
                      />
                      <div className="sm:col-span-2">
                        <WizardField
                          label="Notas"
                          value={draft.user.notes}
                          placeholder="e.g. Prefers concise answers and fast iteration."
                          disabled={isWorking}
                          onChange={(value) => {
                            updateDraft("user", { ...draft.user, notes: value });
                          }}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <WizardTextAreaField
                          label="Contexto"
                          value={draft.user.context}
                          placeholder="e.g. Building Claw3D, likes practical UI improvements, and wants direct feedback."
                          disabled={isWorking}
                          rows={7}
                          onChange={(value) => {
                            updateDraft("user", { ...draft.user, context: value });
                          }}
                        />
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6">
                <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 pb-8">
                  <section className="space-y-3">
                    <h3 className="text-sm font-medium text-foreground">{activeStep.label}</h3>
                    <div className="text-xs text-muted-foreground">{activeStep.hint}</div>
                    <textarea
                      className={`${textAreaClassName} min-h-[56vh] font-mono`}
                      value={
                        step === "AGENTS.md"
                          ? draft.agents
                          : step === "TOOLS.md"
                            ? draft.tools
                            : step === "MEMORY.md"
                              ? draft.memory
                              : step === "HEARTBEAT.md"
                                ? draft.heartbeat
                                : ""
                      }
                      placeholder={
                        AGENT_FILE_PLACEHOLDERS[
                          step as Extract<
                            WizardStepId,
                            "AGENTS.md" | "TOOLS.md" | "MEMORY.md" | "HEARTBEAT.md"
                          >
                        ]
                      }
                      disabled={isWorking}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        if (step === "AGENTS.md") {
                          updateDraft("agents", nextValue);
                          return;
                        }
                        if (step === "TOOLS.md") {
                          updateDraft("tools", nextValue);
                          return;
                        }
                        if (step === "MEMORY.md") {
                          updateDraft("memory", nextValue);
                          return;
                        }
                        if (step === "HEARTBEAT.md") {
                          updateDraft("heartbeat", nextValue);
                        }
                      }}
                    />
                  </section>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
