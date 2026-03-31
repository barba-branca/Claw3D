"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { AgentState } from "@/features/agents/state/store";
import type { OfficeStandupController } from "@/features/office/hooks/useOfficeStandupController";
import {
  createCronJob,
  formatCronSchedule,
  listCronJobs,
  removeCronJob,
  runCronJobNow,
  sortCronJobsByUpdatedAt,
  type CronJobCreateInput,
  type CronJobSummary,
} from "@/lib/cron/types";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError } from "@/lib/gateway/GatewayClient";

type TemplateDefinition = {
  id: string;
  name: string;
  description: string;
  buildInput: (agent: AgentState, customName: string) => CronJobCreateInput;
};

const PLAYBOOK_TEMPLATES: TemplateDefinition[] = [
  {
    id: "daily-briefing",
    name: "Briefing Matinal Diário",
    description: "Todos os dias às 9h. Resuma as prioridades, impedimentos e o que mudou durante a noite.",
    buildInput: (agent, customName) => ({
      name: customName || "Daily Morning Briefing",
      agentId: agent.agentId,
      sessionKey: agent.sessionKey,
      enabled: true,
      schedule: { kind: "cron", expr: "0 9 * * *" },
      sessionTarget: "main",
      wakeMode: "now",
      payload: {
        kind: "agentTurn",
        message:
          "Crie um briefing matinal conciso para o QG. Resuma as prioridades atuais, trabalhos bloqueados, mudanças notáveis recentes e as próximas ações recomendadas.",
        thinking: "high",
      },
    }),
  },
  {
    id: "nightly-code-review",
    name: "Resumo Noturno de Revisão de Código",
    description: "Toda noite à meia-noite. Revise o dia e resuma mudanças arriscadas ou regressões.",
    buildInput: (agent, customName) => ({
      name: customName || "Nightly Code Review Digest",
      agentId: agent.agentId,
      sessionKey: agent.sessionKey,
      enabled: true,
      schedule: { kind: "cron", expr: "0 0 * * *" },
      sessionTarget: "main",
      wakeMode: "now",
      payload: {
        kind: "agentTurn",
        message:
          "Revise o trabalho mais recente disponível para você e produza um resumo de mudanças arriscadas, perguntas não resolvidas e recomendações de acompanhamento para a equipe.",
        thinking: "high",
      },
    }),
  },
  {
    id: "hourly-health-check",
    name: "Verificação de Saúde Horária",
    description: "A cada 60 minutos. Relate a saúde da execução, falhas e qualquer coisa que precise de intervenção.",
    buildInput: (agent, customName) => ({
      name: customName || "Hourly Health Check",
      agentId: agent.agentId,
      sessionKey: agent.sessionKey,
      enabled: true,
      schedule: { kind: "every", everyMs: 60 * 60 * 1000 },
      sessionTarget: "main",
      wakeMode: "now",
      payload: {
        kind: "agentTurn",
        message:
          "Execute uma verificação de saúde. Resuma seu status atual, erros, tarefas bloqueadas, aprovações pendentes e se um humano precisa intervir.",
        thinking: "medium",
      },
    }),
  },
  {
    id: "weekly-progress-report",
    name: "Relatório de Progresso Semanal",
    description: "Toda segunda-feira às 8h. Reúna as vitórias, trabalhos inacabados e próximos passos.",
    buildInput: (agent, customName) => ({
      name: customName || "Weekly Progress Report",
      agentId: agent.agentId,
      sessionKey: agent.sessionKey,
      enabled: true,
      schedule: { kind: "cron", expr: "0 8 * * 1" },
      sessionTarget: "main",
      wakeMode: "now",
      payload: {
        kind: "agentTurn",
        message:
          "Escreva um relatório de progresso semanal para o QG. Inclua o trabalho concluído, trabalho inacabado, riscos e os próximos passos mais importantes.",
        thinking: "high",
      },
    }),
  },
  {
    id: "continuous-monitor",
    name: "Monitoramento Contínuo",
    description: "A cada 15 minutos. Observe desvios, falhas silenciosas ou qualquer coisa incomum.",
    buildInput: (agent, customName) => ({
      name: customName || "Continuous Monitor",
      agentId: agent.agentId,
      sessionKey: agent.sessionKey,
      enabled: true,
      schedule: { kind: "every", everyMs: 15 * 60 * 1000 },
      sessionTarget: "main",
      wakeMode: "now",
      payload: {
        kind: "agentTurn",
        message:
          "Monitore seu contexto atual e relate apenas se detectar comportamento incomum, progresso bloqueado, falhas repetidas ou oportunidades que precisam de atenção.",
        thinking: "medium",
      },
    }),
  },
];

const formatRelativeDateTime = (timestampMs?: number) => {
  if (!timestampMs || !Number.isFinite(timestampMs)) return "Desconhecido";
  return new Date(timestampMs).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function PlaybooksPanel({
  client,
  status,
  agents,
  standup,
}: {
  client: GatewayClient;
  status: GatewayStatus;
  agents: AgentState[];
  standup: OfficeStandupController;
}) {
  const [jobs, setJobs] = useState<CronJobSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [nameOverride, setNameOverride] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [runBusyJobId, setRunBusyJobId] = useState<string | null>(null);
  const [deleteBusyJobId, setDeleteBusyJobId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const agentById = useMemo(
    () => new Map(agents.map((agent) => [agent.agentId, agent])),
    [agents]
  );

  const activeTemplate = useMemo(
    () => PLAYBOOK_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId]
  );
  const [standupAgentId, setStandupAgentId] = useState("");
  const [standupCronExpr, setStandupCronExpr] = useState("0 9 * * 1-5");
  const [standupTimezone, setStandupTimezone] = useState("UTC");
  const [standupSpeakerSeconds, setStandupSpeakerSeconds] = useState("8");
  const [standupAutoOpenBoard, setStandupAutoOpenBoard] = useState(true);
  const [standupScheduleEnabled, setStandupScheduleEnabled] = useState(false);
  const [jiraEnabled, setJiraEnabled] = useState(false);
  const [jiraBaseUrl, setJiraBaseUrl] = useState("");
  const [jiraEmail, setJiraEmail] = useState("");
  const [jiraApiToken, setJiraApiToken] = useState("");
  const [jiraApiTokenConfigured, setJiraApiTokenConfigured] = useState(false);
  const [jiraProjectKey, setJiraProjectKey] = useState("");
  const [jiraJql, setJiraJql] = useState("");
  const [manualTask, setManualTask] = useState("");
  const [manualBlockers, setManualBlockers] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [manualJiraAssignee, setManualJiraAssignee] = useState("");

  useEffect(() => {
    if (!standup.config) return;
    setStandupScheduleEnabled(standup.config.schedule.enabled);
    setStandupCronExpr(standup.config.schedule.cronExpr);
    setStandupTimezone(standup.config.schedule.timezone);
    setStandupSpeakerSeconds(String(standup.config.schedule.speakerSeconds));
    setStandupAutoOpenBoard(standup.config.schedule.autoOpenBoard);
    setJiraEnabled(standup.config.jira.enabled);
    setJiraBaseUrl(standup.config.jira.baseUrl);
    setJiraEmail(standup.config.jira.email);
    setJiraApiToken(standup.config.jira.apiToken);
    setJiraApiTokenConfigured(standup.config.jira.apiTokenConfigured);
    setJiraProjectKey(standup.config.jira.projectKey);
    setJiraJql(standup.config.jira.jql);
  }, [standup.config]);

  useEffect(() => {
    if (standupAgentId || agents.length === 0) return;
    setStandupAgentId(agents[0]?.agentId ?? "");
  }, [agents, standupAgentId]);

  useEffect(() => {
    if (!standup.config || !standupAgentId) return;
    const manual = standup.config.manualByAgentId[standupAgentId];
    setManualTask(manual?.currentTask ?? "");
    setManualBlockers(manual?.blockers ?? "");
    setManualNote(manual?.note ?? "");
    setManualJiraAssignee(manual?.jiraAssignee ?? "");
  }, [standup.config, standupAgentId]);

  const loadJobs = useCallback(async () => {
    if (status !== "connected") {
      setJobs([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await listCronJobs(client, { includeDisabled: true });
      setJobs(sortCronJobsByUpdatedAt(result.jobs));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao carregar playbooks.";
      setError(message);
      if (!isGatewayDisconnectLikeError(err)) {
        console.error(message);
      }
    } finally {
      setLoading(false);
    }
  }, [client, status]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const handleCreate = useCallback(async () => {
    if (!activeTemplate) return;
    const agent = agentById.get(selectedAgentId);
    if (!agent) {
      setError("Escolha um agente antes de iniciar um playbook.");
      return;
    }

    setCreateBusy(true);
    setError(null);
    setActionMessage(null);
    try {
      await createCronJob(client, activeTemplate.buildInput(agent, nameOverride.trim()));
      setActionMessage(`Criado "${nameOverride.trim() || activeTemplate.name}".`);
      setSelectedTemplateId(null);
      setSelectedAgentId("");
      setNameOverride("");
      await loadJobs();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create playbook.";
      setError(message);
    } finally {
      setCreateBusy(false);
    }
  }, [activeTemplate, agentById, client, loadJobs, nameOverride, selectedAgentId]);

  const handleRunNow = useCallback(
    async (jobId: string) => {
      setRunBusyJobId(jobId);
      setError(null);
      setActionMessage(null);
      try {
        const result = await runCronJobNow(client, jobId);
        setActionMessage(result.ok ? "Playbook acionado." : "Falha ao acionar playbook.");
        await loadJobs();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao executar playbook.");
      } finally {
        setRunBusyJobId(null);
      }
    },
    [client, loadJobs]
  );

  const handleDelete = useCallback(
    async (jobId: string) => {
      setDeleteBusyJobId(jobId);
      setError(null);
      setActionMessage(null);
      try {
        const result = await removeCronJob(client, jobId);
        setActionMessage(result.ok && result.removed ? "Playbook removido." : "O playbook não foi removido.");
        await loadJobs();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao excluir playbook.");
      } finally {
        setDeleteBusyJobId(null);
      }
    },
    [client, loadJobs]
  );

  const handleSaveStandupConfig = useCallback(async () => {
    setError(null);
    setActionMessage(null);
    try {
      await standup.saveConfig({
        schedule: {
          enabled: standupScheduleEnabled,
          cronExpr: standupCronExpr.trim() || "0 9 * * 1-5",
          timezone: standupTimezone.trim() || "UTC",
          speakerSeconds: Number(standupSpeakerSeconds) || 8,
          autoOpenBoard: standupAutoOpenBoard,
        },
        jira: {
          enabled: jiraEnabled,
          baseUrl: jiraBaseUrl.trim(),
          email: jiraEmail.trim(),
          apiToken: jiraApiToken.trim(),
          projectKey: jiraProjectKey.trim().toUpperCase(),
          jql: jiraJql.trim(),
        },
      });
      setActionMessage("Configurações de standup salvas.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar configurações de standup.");
    }
  }, [
    jiraApiToken,
    jiraBaseUrl,
    jiraEmail,
    jiraEnabled,
    jiraJql,
    jiraProjectKey,
    standup,
    standupAutoOpenBoard,
    standupCronExpr,
    standupScheduleEnabled,
    standupSpeakerSeconds,
    standupTimezone,
  ]);

  const handleSaveManualNotes = useCallback(async () => {
    if (!standupAgentId) {
      setError("Escolha um agente antes de salvar as notas de standup.");
      return;
    }
    setError(null);
    setActionMessage(null);
    try {
      await standup.updateManualEntry(standupAgentId, {
        jiraAssignee: manualJiraAssignee.trim() || null,
        currentTask: manualTask.trim(),
        blockers: manualBlockers.trim(),
        note: manualNote.trim(),
      });
      setActionMessage("Notas de standup salvas.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar notas de standup.");
    }
  }, [
    manualBlockers,
    manualJiraAssignee,
    manualNote,
    manualTask,
    standup,
    standupAgentId,
  ]);

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="border-b border-cyan-500/10 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/70">
              Roteiros (Playbooks)
            </div>
            <div className="mt-1 font-mono text-[11px] text-white/40">
              Lance agendamentos reutilizáveis para todo o QG.
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadJobs()}
            className="rounded border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-200 transition-colors hover:border-cyan-400/40 hover:text-cyan-100"
          >
            Atualizar
          </button>
        </div>
        {error ? <div className="mt-2 font-mono text-[11px] text-rose-300">{error}</div> : null}
        {actionMessage ? (
          <div className="mt-2 font-mono text-[11px] text-emerald-300">{actionMessage}</div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-cyan-500/10 px-4 py-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
            Tarefas Ativas
          </div>
          <div className="mt-3 space-y-2">
            {loading ? (
              <div className="font-mono text-[11px] text-white/40">Carregando tarefas agendadas.</div>
            ) : jobs.length === 0 ? (
              <div className="font-mono text-[11px] text-white/35">Nenhum playbook ativo ainda.</div>
            ) : (
              jobs.map((job) => {
                const agentName = agentById.get(job.agentId ?? "")?.name || job.agentId || "Unknown";
                return (
                  <div
                    key={job.id}
                    className="rounded border border-white/8 bg-white/[0.03] px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-white/85">
                          {job.name}
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-white/45">{agentName}</div>
                      </div>
                      <div className="shrink-0 rounded border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-200">
                        {job.state.lastStatus ?? "pronto"}
                      </div>
                    </div>

                    <div className="mt-3 space-y-1 font-mono text-[11px] text-white/65">
                      <div>{formatCronSchedule(job.schedule)}</div>
                      <div>Próxima execução: {formatRelativeDateTime(job.state.nextRunAtMs)}</div>
                      <div>Última execução: {formatRelativeDateTime(job.state.lastRunAtMs)}</div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleRunNow(job.id)}
                        disabled={runBusyJobId === job.id || deleteBusyJobId === job.id}
                        className="rounded border border-amber-500/25 bg-amber-500/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-amber-200 transition-colors hover:border-amber-400/50 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {runBusyJobId === job.id ? "Executando" : "Executar agora"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(job.id)}
                        disabled={deleteBusyJobId === job.id || runBusyJobId === job.id}
                        className="rounded border border-rose-500/25 bg-rose-500/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-rose-200 transition-colors hover:border-rose-400/50 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deleteBusyJobId === job.id ? "Excluindo" : "Excluir"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="rounded border border-emerald-500/15 bg-emerald-500/[0.05] px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-200/85">
                  Standup Automatizada
                </div>
                <div className="mt-1 font-mono text-[11px] leading-5 text-white/50">
                  Configure a reunião diária, fonte do Jira e quadro de notas manuais.
                </div>
              </div>
              <button
                type="button"
                onClick={() => void standup.startMeeting("manual")}
                className="rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-100 transition-colors hover:border-emerald-400/50 hover:text-white"
              >
                Iniciar agora
              </button>
            </div>

            <div className="mt-3 grid gap-3">
              <label className="flex items-center gap-2 font-mono text-[11px] text-white/75">
                <input
                  type="checkbox"
                  checked={standupScheduleEnabled}
                  onChange={(event) => setStandupScheduleEnabled(event.target.checked)}
                />
                Habilitar standup agendada.
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                  Expressão Cron
                </span>
                <input
                  value={standupCronExpr}
                  onChange={(event) => setStandupCronExpr(event.target.value)}
                  className="rounded border border-white/10 bg-black/50 px-2 py-2 font-mono text-[11px] text-white/80 outline-none"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                  Fuso horário
                </span>
                <input
                  value={standupTimezone}
                  onChange={(event) => setStandupTimezone(event.target.value)}
                  className="rounded border border-white/10 bg-black/50 px-2 py-2 font-mono text-[11px] text-white/80 outline-none"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                  Segundos por orador
                </span>
                <input
                  value={standupSpeakerSeconds}
                  onChange={(event) => setStandupSpeakerSeconds(event.target.value)}
                  className="rounded border border-white/10 bg-black/50 px-2 py-2 font-mono text-[11px] text-white/80 outline-none"
                />
              </label>

              <label className="flex items-center gap-2 font-mono text-[11px] text-white/75">
                <input
                  type="checkbox"
                  checked={standupAutoOpenBoard}
                  onChange={(event) => setStandupAutoOpenBoard(event.target.checked)}
                />
                Abrir automaticamente o quadro de standup quando uma reunião começar.
              </label>

              <label className="flex items-center gap-2 font-mono text-[11px] text-white/75">
                <input
                  type="checkbox"
                  checked={jiraEnabled}
                  onChange={(event) => setJiraEnabled(event.target.checked)}
                />
                Habilitar fonte do Jira.
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                  URL base do Jira
                </span>
                <input
                  value={jiraBaseUrl}
                  onChange={(event) => setJiraBaseUrl(event.target.value)}
                  placeholder="https://company.atlassian.net"
                  className="rounded border border-white/10 bg-black/50 px-2 py-2 font-mono text-[11px] text-white/80 outline-none placeholder:text-white/20"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                  E-mail do Jira
                </span>
                <input
                  value={jiraEmail}
                  onChange={(event) => setJiraEmail(event.target.value)}
                  className="rounded border border-white/10 bg-black/50 px-2 py-2 font-mono text-[11px] text-white/80 outline-none"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                  Token da API do Jira
                </span>
                <input
                  type="password"
                  value={jiraApiToken}
                  onChange={(event) => {
                    setJiraApiToken(event.target.value);
                    setJiraApiTokenConfigured(event.target.value.trim().length > 0);
                  }}
                  placeholder={
                    jiraApiTokenConfigured ? "Armazenado no Studio. Digite para substituir." : ""
                  }
                  className="rounded border border-white/10 bg-black/50 px-2 py-2 font-mono text-[11px] text-white/80 outline-none"
                />
                {jiraApiTokenConfigured ? (
                  <span className="text-[10px] text-white/45">
                    Um token de API do Jira já está armazenado no servidor Studio.
                  </span>
                ) : null}
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                  Chave do projeto Jira
                </span>
                <input
                  value={jiraProjectKey}
                  onChange={(event) => setJiraProjectKey(event.target.value)}
                  className="rounded border border-white/10 bg-black/50 px-2 py-2 font-mono text-[11px] text-white/80 outline-none"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                  Sobrescrita de JQL do Jira
                </span>
                <textarea
                  value={jiraJql}
                  onChange={(event) => setJiraJql(event.target.value)}
                  rows={3}
                  className="rounded border border-white/10 bg-black/50 px-2 py-2 font-mono text-[11px] text-white/80 outline-none"
                />
              </label>

              <button
                type="button"
                onClick={() => void handleSaveStandupConfig()}
                disabled={standup.saving}
                className="rounded border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-100 transition-colors hover:border-emerald-400/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {standup.saving ? "Salvando configurações..." : "Salvar configurações de standup"}
              </button>
            </div>

            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                Entrada manual do quadro
              </div>
              <div className="mt-3 grid gap-3">
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                    Agente
                  </span>
                  <select
                    value={standupAgentId}
                    onChange={(event) => setStandupAgentId(event.target.value)}
                    className="rounded border border-white/10 bg-black/50 px-2 py-2 font-mono text-[11px] text-white/80 outline-none"
                  >
                    <option value="">Selecione um agente</option>
                    {agents.map((agent) => (
                      <option key={agent.agentId} value={agent.agentId}>
                        {agent.name || agent.agentId}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                    Dica de responsável do Jira
                  </span>
                  <input
                    value={manualJiraAssignee}
                    onChange={(event) => setManualJiraAssignee(event.target.value)}
                    className="rounded border border-white/10 bg-black/50 px-2 py-2 font-mono text-[11px] text-white/80 outline-none"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                    Tarefa atual
                  </span>
                  <input
                    value={manualTask}
                    onChange={(event) => setManualTask(event.target.value)}
                    className="rounded border border-white/10 bg-black/50 px-2 py-2 font-mono text-[11px] text-white/80 outline-none"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                    Impedimentos (Blockers)
                  </span>
                  <textarea
                    value={manualBlockers}
                    onChange={(event) => setManualBlockers(event.target.value)}
                    rows={3}
                    className="rounded border border-white/10 bg-black/50 px-2 py-2 font-mono text-[11px] text-white/80 outline-none"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                    Nota manual
                  </span>
                  <textarea
                    value={manualNote}
                    onChange={(event) => setManualNote(event.target.value)}
                    rows={4}
                    className="rounded border border-white/10 bg-black/50 px-2 py-2 font-mono text-[11px] text-white/80 outline-none"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void handleSaveManualNotes()}
                  className="rounded border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-100 transition-colors hover:border-cyan-400/50 hover:text-white"
                >
                  Salvar notas manuais
                </button>
              </div>
            </div>

            {standup.meeting ? (
              <div className="mt-4 rounded border border-white/8 bg-white/[0.03] px-3 py-3 font-mono text-[11px] text-white/65">
                <div>Status: {standup.meeting.phase}</div>
                <div>Participantes: {standup.meeting.participantOrder.length}</div>
                <div>
                  Orador atual: {standup.meeting.currentSpeakerAgentId ?? "Aguardando"}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
            Modelos
          </div>
          <div className="mt-3 space-y-2">
            {PLAYBOOK_TEMPLATES.map((template) => {
              const isSelected = template.id === selectedTemplateId;
              return (
                <div
                  key={template.id}
                  className={`rounded border px-3 py-3 transition-colors ${
                    isSelected
                      ? "border-cyan-400/30 bg-cyan-500/[0.06]"
                      : "border-white/8 bg-white/[0.03]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTemplateId((current) =>
                        current === template.id ? null : template.id
                      );
                      setError(null);
                      setActionMessage(null);
                    }}
                    className="w-full text-left"
                  >
                    <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-white/85">
                      {template.name}
                    </div>
                    <div className="mt-1 font-mono text-[11px] leading-5 text-white/50">
                      {template.description}
                    </div>
                  </button>

                  {isSelected ? (
                    <div className="mt-3 space-y-3 border-t border-cyan-500/10 pt-3">
                      <label className="flex flex-col gap-1">
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                          Agente
                        </span>
                        <select
                          value={selectedAgentId}
                          onChange={(event) => setSelectedAgentId(event.target.value)}
                          className="rounded border border-white/10 bg-black/50 px-2 py-2 font-mono text-[11px] text-white/80 outline-none"
                        >
                          <option value="">Selecione um agente</option>
                          {agents.map((agent) => (
                            <option key={agent.agentId} value={agent.agentId}>
                              {agent.name || agent.agentId}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                          Sobrescrita de nome
                        </span>
                        <input
                          value={nameOverride}
                          onChange={(event) => setNameOverride(event.target.value)}
                          placeholder={template.name}
                          className="rounded border border-white/10 bg-black/50 px-2 py-2 font-mono text-[11px] text-white/80 outline-none placeholder:text-white/20"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => void handleCreate()}
                        disabled={createBusy}
                        className="w-full rounded border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-100 transition-colors hover:border-cyan-400/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {createBusy ? "Criando playbook..." : "Lançar playbook"}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
