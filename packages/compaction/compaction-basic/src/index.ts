/**
 * Basic replay-aware compaction backend.
 *
 * @module @x1a0f3n9/dsh-compaction-basic
 */

import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { CompactionEngine, ManualCompactionError } from '@x1a0f3n9/dsh-compaction'
import type { CompactionResult, CompactionTrigger } from '@x1a0f3n9/dsh-compaction'
import type { Session, SessionSeq } from '@x1a0f3n9/dsh-session'
import { CONTEXT_WINDOW_EXCEEDED_CODE } from '@x1a0f3n9/dsh-llm'
import type { LlmCallConfig } from '@x1a0f3n9/dsh-llm'
import type { TokenMeasurement } from '@x1a0f3n9/dsh-token-meter'
import { assertNever } from '@x1a0f3n9/dsh-util-values'
import type { Agent, PreStepDecision } from '@x1a0f3n9/dsh-agent'
import type { CommandId } from '@x1a0f3n9/dsh-commands/brand'
// Type-only: makes the optional sibling service available to `ctx.get()`.
import type {} from '@x1a0f3n9/dsh-compaction-tool-result-pruner'
import {
  resolveCompactSpec,
  resolveConfig,
  resolveTargetPolicy,
  TargetPressureConfigError,
} from './config.ts'
import {
  assertNoActiveCompaction,
  compactSurfaceRegion,
  rangeLacksFoldableHistory,
  selectCompactableRange,
  SummaryDidNotShrinkError,
} from './region.ts'
import { summarizeWithLlm } from './summarizer.ts'
import type { SummarizationInput, SummaryResult } from './summarizer.ts'
import type {
  BasicCompactionConfig,
  ModelCompactPolicyConfig,
  ResolvedConfig,
} from './types.ts'

export type {
  BasicCompactionConfig,
  CompactionPolicyConfig,
  ModelCompactPolicyConfig,
  ResolvedCompactSpec,
  ResolvedConfig,
  ResolvedRetention,
  ResolvedTargetPolicy,
} from './types.ts'

/** Resolve the exact provider/model durably routed for the latest request. */
function routedTarget(
  session: Session,
): Pick<LlmCallConfig, 'provider' | 'model'> | undefined {
  const config = session.requestHeader()?.config
  if (config === undefined || config.provider.length === 0 || config.model.length === 0) {
    return undefined
  }
  return { provider: config.provider, model: config.model }
}

/**
 * Output tokens the routed request reserves, which the provider charges to the
 * same window as the prompt. The effective envelope's own cap wins; otherwise
 * the adapter's per-request default, which the adapter materializes when that
 * envelope omits one. No declared cap means no reservation.
 */
function reservedCompletionTokens(agent: Agent, defaultMaxTokens: number | undefined): number {
  const configured = agent.session.requestHeader()?.config.maxTokens
  return configured ?? defaultMaxTokens ?? 0
}

/** Newly aged-out history, excluding a leading compact-checkpoint prefix. */
function selectAgedOutRange(
  session: Session,
  measurement: TokenMeasurement,
  retainTokens: number,
): { start: SessionSeq; end: SessionSeq } | null {
  const foldable = selectCompactableRange(
    session,
    measurement,
    retainTokens,
    { skipCheckpointPrefix: true },
  )
  if (foldable === null || rangeLacksFoldableHistory(session, foldable)) return null
  return foldable
}

/**
 * Prefer newly aged-out history while occupancy stays under the window.
 * Past `occupancyWindow`, fold the largest compactable head — checkpoints
 * included — so skip-checkpoint cannot leave occupancy sitting behind a
 * tiny new-history slice. `allowCheckpointOnly` is the one-shot for an
 * already-replaced head; a later checkpoint-only span is that replacement.
 */
function selectOccupancyRange(
  session: Session,
  measurement: TokenMeasurement,
  retainTokens: number,
  occupancyWindow: number | undefined,
  allowCheckpointOnly: boolean,
): { start: SessionSeq; end: SessionSeq } | null {
  const overWindow = occupancyWindow !== undefined && measurement.totalTokens >= occupancyWindow
  if (!overWindow) return selectAgedOutRange(session, measurement, retainTokens)
  if (!allowCheckpointOnly) return selectAgedOutRange(session, measurement, 0)
  return selectCompactableRange(session, measurement, 0)
}

/** Resolve the conversation target used to select an optional policy override. */
function conversationTarget(
  agent: Agent,
): Pick<LlmCallConfig, 'provider' | 'model'> | undefined {
  const routed = routedTarget(agent.session)
  if (routed !== undefined) return routed
  if (agent.options.provider === undefined || agent.options.provider.length === 0
    || agent.options.model === undefined || agent.options.model.length === 0) return undefined
  return { provider: agent.options.provider, model: agent.options.model }
}

const thresholdRatioSchema = z.number()
const headroomTokensSchema = z.number().step(1).min(0)
const retainRatioSchema = z.number()
const retainTokensSchema = z.number().step(1).min(0)
const summarizationProviderSchema = z.string()
const summarizationModelSchema = z.string()
const maxTokensSchema = z.number().step(1).min(1)
const compactionRetriesSchema = z.number().step(1).min(0)
const maxOverflowRetriesSchema = z.number().step(1).min(0)

const modelPolicy: z<ModelCompactPolicyConfig> = z.object({
  provider: z.string().required(),
  model: z.string().required(),
  thresholdRatio: thresholdRatioSchema,
  headroomTokens: headroomTokensSchema,
  retainRatio: retainRatioSchema,
  retainTokens: retainTokensSchema,
  summarizationProvider: summarizationProviderSchema,
  summarizationModel: summarizationModelSchema,
  maxTokens: maxTokensSchema,
  compactionRetries: compactionRetriesSchema,
  maxOverflowRetries: maxOverflowRetriesSchema,
})

/**
 * Dependency-light compaction backend using `ctx.tokenMeter` for pressure,
 * retention, cited source events, and summary-convergence pricing.
 *
 * `summarize()` is the sole subclass customization hook; the replay and durable
 * mutation strategy stays fixed so every pricing decision uses the singleton
 * token meter.
 */
export class BasicCompactionEngine extends CompactionEngine {
  static inject = ['llm', 'tokenMeter', 'sessions']

  static Config: z<BasicCompactionConfig> = z.object({
    thresholdRatio: thresholdRatioSchema,
    headroomTokens: headroomTokensSchema,
    retainRatio: retainRatioSchema,
    retainTokens: retainTokensSchema,
    summarizationProvider: summarizationProviderSchema,
    summarizationModel: summarizationModelSchema,
    maxTokens: maxTokensSchema,
    compactionRetries: compactionRetriesSchema,
    maxOverflowRetries: maxOverflowRetriesSchema,
    modelPolicies: z.array(modelPolicy),
    auto: z.boolean(),
  })

  /** Resolved and validated compaction configuration. */
  readonly config: ResolvedConfig

  private readonly warnedPressureConfigTargets = new Set<string>()
  private readonly overflowRetries = new WeakMap<Agent, number>()
  private readonly overflowAgents = new WeakMap<Session, Agent>()

  constructor(ctx: Context, config: BasicCompactionConfig = {}) {
    super(ctx)
    this.config = resolveConfig(config)
    if (this.config.auto) this._registerAutomaticCompaction()
  }

  /**
   * Register automatic between-step pressure and model-request overflow
   * recovery. `compactIfNeeded` stays dynamically dispatched so subclass
   * overrides are honored at event time.
   */
  private _registerAutomaticCompaction(): void {
    const { ctx } = this
    const logResult = (result: CompactionResult, trigger: string): void => {
      ctx.logger.info(
        `compaction (${trigger}): shadowed ${result.shadowedSeqs.length} surface nodes `
        + `(seqs ${result.shadowedRange.start}-${result.shadowedRange.end}, `
        + `~${result.shadowedTokenCount} tokens)`,
      )
    }

    ctx.on('agent/pre-step', async (
      { agent, signal },
      next,
    ): Promise<PreStepDecision> => {
      if (!signal.aborted) {
        try {
          const result = await this.compactIfNeeded(agent, 'pressure', signal)
          if (result !== null) logResult(result, 'step pressure')
        } catch (error: unknown) {
          if (error instanceof TargetPressureConfigError) {
            if (!this.warnedPressureConfigTargets.has(error.targetKey)) {
              this.warnedPressureConfigTargets.add(error.targetKey)
              ctx.logger.warn(`step compaction failed: ${error.message}; continuing the turn`)
            }
          } else {
            const message = error instanceof Error ? error.message : String(error)
            ctx.logger.warn(`step compaction failed: ${message}; continuing the turn`)
          }
        }
      }
      if (signal.aborted) return next()
      const decision = await next()
      if (await this.occupancyBlocksSend(agent, signal)) {
        ctx.logger.warn(
          'occupancy is still at or past the configured context window after compaction; '
          + 'blocking the turn',
        )
        return { kind: 'reject' }
      }
      return decision
    })

    ctx.on('agent/request', async ({ agent, signal }, next) => {
      const config = await next()
      return this.capRequestMaxTokens(agent, config, signal)
    })

    ctx.on('agent/status', ({ agent, status }) => {
      if (status === 'idle') this.overflowRetries.delete(agent)
    })

    // A successful response starts a fresh overflow-recovery sequence even
    // when tool calls continue the same turn into another request.
    ctx.on('session/event', (session, event) => {
      if (event.type !== 'assistant/message') return
      const agent = this.overflowAgents.get(session)
      if (agent !== undefined) this.overflowRetries.delete(agent)
    })

    ctx.on('agent/request-error', async (
      { agent, failure, signal },
      next,
    ) => {
      if (failure.code !== CONTEXT_WINDOW_EXCEEDED_CODE || signal.aborted) return next()
      this.overflowAgents.set(agent.session, agent)
      const target = routedTarget(agent.session)
      if (target === undefined) return next()
      const policy = resolveTargetPolicy(this.config, target)
      const retries = this.overflowRetries.get(agent) ?? 0
      if (retries >= policy.maxOverflowRetries) return next()

      const generation = agent.session.surface.replaceGeneration
      let result: CompactionResult | null
      try {
        result = await this.compactIfNeeded(agent, 'context-overflow', signal)
      } catch (recoveryError: unknown) {
        const message = recoveryError instanceof Error ? recoveryError.message : String(recoveryError)
        // A model-free prune can land before later summary work fails. That
        // durable reduction is sufficient retry proof; do not discard it just
        // because the optional second phase threw. Cancellation still wins.
        // oxlint-disable-next-line typescript/no-unnecessary-condition -- the signal can abort while recovery is awaited.
        if (!signal.aborted && agent.session.surface.replaceGeneration > generation) {
          if (await this.occupancyBlocksSend(agent, signal)) {
            ctx.logger.warn(
              `context-overflow compaction failed after durable surface progress: ${message}; `
              + 'occupancy is still at or past the context window; preserving the original request error',
            )
            return next()
          }
          ctx.logger.warn(
            `context-overflow compaction failed after durable surface progress: ${message}; `
            + 'retrying from the replacement surface',
          )
          this.overflowRetries.set(agent, retries + 1)
          return { kind: 'retry' }
        }
        ctx.logger.warn(
          // oxlint-disable-next-line typescript/no-unnecessary-condition -- the signal can abort while recovery is awaited.
          `context-overflow compaction failed: ${message}; ${signal.aborted
            ? 'cancellation prevents retry'
            : 'preserving the original request error'}`,
        )
        return next()
      }
      // oxlint-disable-next-line typescript/no-unnecessary-condition -- the signal can abort while compaction is awaited.
      if (signal.aborted
        || agent.session.surface.replaceGeneration <= generation) return next()
      if (result !== null) logResult(result, 'context overflow recovery')
      if (await this.occupancyBlocksSend(agent, signal)) {
        ctx.logger.warn(
          'context-overflow compaction left occupancy at or past the context window; '
          + 'preserving the original request error',
        )
        return next()
      }
      this.overflowRetries.set(agent, retries + 1)
      return { kind: 'retry' }
    })
  }

  /**
   * Summarize the replayed conversation region through a direct one-shot
   * `ctx.llm.stream()` call whose prefix reuses the conversation's own system
   * prompt, tools, and messages so the provider's KV cache is not invalidated.
   * Override this sole hook for a template or remote summarizer.
   * @param input - replayed conversation prefix (system, tools, and leading messages) to condense.
   * @param agent - supplies routed-model history, fallback model, and session id.
   * @param signal - optional cancellation forwarded to the adapter.
   * @returns safe text summary blocks and the exact auxiliary call envelope and output.
   */
  protected async summarize(
    input: SummarizationInput,
    agent: Agent,
    signal?: AbortSignal,
  ): Promise<SummaryResult> {
    const target = conversationTarget(agent)
    const config = target === undefined
      ? this.config
      : resolveTargetPolicy(this.config, target)
    return summarizeWithLlm(this.ctx, config, input, agent, signal)
  }

  /**
   * Compact for replayed step-boundary pressure or provider-confirmed overflow.
   * Both triggers price the latest durable routed request envelope. Pressure
   * skips a compact-checkpoint-only span while occupancy stays under the
   * configured window, so a just-written replacement is not summarized again
   * until non-checkpoint history ages into the range. Occupancy at or past
   * that window force-folds once even when the span is checkpoint-only; a
   * later checkpoint-only span is the replacement and stops the loop.
   * Envelope leftovers cannot fold below the window. Overflow bypasses the
   * normal threshold, prefers newly aged-out history, and keeps folding until
   * occupancy is under the window or no useful span remains.
   * @param agent - agent whose latest durable routed request is measured.
   * @param trigger - normal step-boundary pressure or context-overflow recovery.
   * @param signal - live turn cancellation signal forwarded to summarization.
   * @returns the latest summary compaction result, or `null` when no summary ran.
   */
  override async compactIfNeeded(
    agent: Agent,
    trigger: CompactionTrigger,
    signal: AbortSignal,
  ): Promise<CompactionResult | null> {
    const target = routedTarget(agent.session)
    if (target === undefined) return null
    const policy = resolveTargetPolicy(this.config, target)
    const meter = this.ctx.tokenMeter
    let measurement = meter.measure(agent.session)
    switch (trigger) {
      case 'context-overflow':
        break
      case 'pressure':
        break
      /* v8 ignore next -- closed-union exhaustiveness guard */
      default:
        assertNever(trigger, 'compaction trigger')
    }

    // Pruning is optional so compaction-basic remains independently composable.
    // Overflow always qualifies; pressure first resolves the routed model's
    // capacity and checks its target-specific threshold.
    const prune = this.ctx.get('toolResultPruner')

    if (trigger === 'context-overflow') {
      if (prune !== undefined) {
        prune.pruneSession(agent.session)
        measurement = meter.measure(agent.session)
      }
      let occupancyWindow: number | undefined
      try {
        occupancyWindow = (await this.ctx.llm.resolveModelInfo(
          target.provider,
          target.model,
          signal,
        )).context?.contextWindow
      } catch {
        occupancyWindow = undefined
      }
      let allowCheckpointOnly = occupancyWindow !== undefined
        && measurement.totalTokens >= occupancyWindow
      const first = allowCheckpointOnly
        ? selectOccupancyRange(agent.session, measurement, 0, occupancyWindow, true)
        : (selectAgedOutRange(agent.session, measurement, 0)
          ?? selectCompactableRange(agent.session, measurement, 0))
      if (first === null) return null
      const firstFold = await this.compactRangeAllowingNoShrink(
        first,
        agent,
        signal,
        allowCheckpointOnly,
      )
      allowCheckpointOnly = false
      if (firstFold === null) return null
      let result = firstFold
      measurement = meter.measure(agent.session)
      if (occupancyWindow === undefined || measurement.totalTokens < occupancyWindow) {
        return result
      }
      let attempts = 1
      for (;;) {
        const range = selectOccupancyRange(
          agent.session,
          measurement,
          0,
          occupancyWindow,
          allowCheckpointOnly,
        )
        if (range === null) return result
        if (attempts > policy.compactionRetries) return result
        const folded = await this.compactRangeAllowingNoShrink(range, agent, signal, true)
        if (folded === null) return result
        result = folded
        attempts += 1
        measurement = meter.measure(agent.session)
        if (measurement.totalTokens < occupancyWindow) return result
      }
    }

    const info = await this.ctx.llm.resolveModelInfo(target.provider, target.model, signal)
    assertNoActiveCompaction(agent.session, 'automatic pressure compaction')
    const targetKey = `${target.provider}/${target.model}`
    if (info.context === undefined) {
      throw new TargetPressureConfigError(
        targetKey,
        `compaction-basic: no context capacity for ${targetKey}; `
        + 'configure contextWindow on that adapter model',
      )
    }
    const spec = resolveCompactSpec(
      policy,
      info.context.contextWindow,
      reservedCompletionTokens(agent, info.defaultMaxTokens),
    )
    if (measurement.totalTokens < spec.thresholdTokens) return null

    // Once pressure qualifies, land the model-free pass before choosing a
    // summary range, then remeasure through the singleton replay fold.
    if (prune !== undefined) {
      prune.pruneSession(agent.session)
      measurement = meter.measure(agent.session)
    }
    if (measurement.totalTokens < spec.thresholdTokens) return null

    let result: CompactionResult | null = null
    let attempts = 0
    let allowCheckpointOnly = measurement.totalTokens >= spec.contextWindow
    for (;;) {
      const range = selectOccupancyRange(
        agent.session,
        measurement,
        spec.retainTokens,
        spec.contextWindow,
        allowCheckpointOnly,
      )
      if (range === null) return result
      if (attempts > spec.compactionRetries) {
        throw new Error(
          `compaction still above threshold after ${spec.compactionRetries + 1} compaction attempts `
          + `(${measurement.totalTokens} estimated tokens >= threshold ${spec.thresholdTokens})`,
        )
      }
      const overWindow = measurement.totalTokens >= spec.contextWindow
      const folded = await this.compactRangeAllowingNoShrink(range, agent, signal, overWindow)
      allowCheckpointOnly = false
      if (folded === null) return result
      result = folded
      attempts += 1
      measurement = meter.measure(agent.session)
      if (measurement.totalTokens < spec.thresholdTokens) return result
    }
  }

  /**
   * Compact one inclusive positional range from the agent-owned surface using
   * the effective token meter for all retention and shrink pricing.
   * @param start - inclusive first surface-node seq.
   * @param end - inclusive last surface-node seq.
   * @param agent - owner of the target session, used by the summarizer.
   * @param signal - optional summarization cancellation signal.
   * @returns the successful durable compaction result.
   */
  override async compactRegion(
    start: SessionSeq,
    end: SessionSeq,
    agent: Agent,
    signal?: AbortSignal,
  ): Promise<CompactionResult> {
    return compactSurfaceRegion(
      this.regionDependencies(),
      agent.session,
      start,
      end,
      agent,
      { owner: 'current-turn', stability: 'whole-surface' },
      signal,
    )
  }

  /**
   * Force one useful idle-session compaction below the pressure threshold, and
   * resolve only after its standalone marker pair is durably checkpointed.
   * Leading checkpoints are skipped so `/compact` folds newly aged-out history.
   * When that skip leaves nothing, the remaining checkpoint-only span is still
   * folded — same fallback overflow uses — so occupancy over the window is not
   * stuck behind `No compactable history yet.` A model summary that does not
   * shrink lands the overflow stub when that stub is cheaper.
   * @param agent - idle agent whose next-turn admission this call reserves.
   * @param signal - cancellation scoped to this compaction request.
   * @param sourceCommandId - initiating command identity for presentation correlation.
   * @returns the committed result, or `null` when no safe useful range exists.
   */
  override compactNow(
    agent: Agent,
    signal: AbortSignal,
    sourceCommandId?: CommandId,
  ): Promise<CompactionResult | null> {
    signal.throwIfAborted()
    try {
      return agent.runMaintenance(async (agentSignal) => {
        const operationSignal = AbortSignal.any([agentSignal, signal])
        try {
          operationSignal.throwIfAborted()
          assertNoActiveCompaction(agent.session, 'manual compaction')
          const measurement = this.ctx.tokenMeter.measure(agent.session)
          const foldable = selectCompactableRange(
            agent.session,
            measurement,
            0,
            { skipCheckpointPrefix: true },
          )
          const range = foldable === null || rangeLacksFoldableHistory(agent.session, foldable)
            ? selectCompactableRange(agent.session, measurement, 0)
            : foldable
          if (range === null) return null
          return await compactSurfaceRegion(
            this.regionDependencies(),
            agent.session,
            range.start,
            range.end,
            agent,
            {
              owner: null,
              stability: 'selected-span',
              shrinkFallback: true,
              ...sourceCommandId === undefined ? {} : { sourceCommandId },
              flush: async () => {
                await this.ctx.sessions.flush(agent.session)
              },
            },
            operationSignal,
          )
        } catch (error: unknown) {
          if (agentSignal.aborted && operationSignal.reason === agentSignal.reason) {
            throw new ManualCompactionError(
              'cancelled',
              'manual compaction was cancelled',
              { cause: error },
            )
          }
          operationSignal.throwIfAborted()
          if (
            error instanceof ManualCompactionError
            && error.code === 'summary'
            && error.cause instanceof SummaryDidNotShrinkError
          ) {
            return null
          }
          throw error
        }
      })
    } catch (error: unknown) {
      throw new ManualCompactionError(
        'busy',
        'manual compaction requires an idle agent with no waking queued work',
        { cause: error },
      )
    }
  }

  /**
   * Fold one span. When occupancy is already past the window, a summary that
   * does not shrink is not a compaction failure — envelope leftovers cannot
   * get cheaper, and the send path rejects instead.
   */
  private async compactRangeAllowingNoShrink(
    range: { start: SessionSeq; end: SessionSeq },
    agent: Agent,
    signal: AbortSignal,
    allowNoShrink: boolean,
  ): Promise<CompactionResult | null> {
    try {
      return await this.compactRegion(range.start, range.end, agent, signal)
    } catch (error: unknown) {
      if (allowNoShrink && error instanceof SummaryDidNotShrinkError) return null
      throw error
    }
  }

  /**
   * True when the routed occupancy is already at or past the configured window.
   * Missing route or capacity metadata cannot decide, so those turns proceed.
   */
  private async occupancyBlocksSend(agent: Agent, signal: AbortSignal): Promise<boolean> {
    const target = routedTarget(agent.session)
    if (target === undefined) return false
    let occupancyWindow: number | undefined
    try {
      occupancyWindow = (await this.ctx.llm.resolveModelInfo(
        target.provider,
        target.model,
        signal,
      )).context?.contextWindow
    } catch {
      return false
    }
    if (occupancyWindow === undefined) return false
    return this.ctx.tokenMeter.measure(agent.session).totalTokens >= occupancyWindow
  }

  /**
   * Cap this request's output so occupancy plus maxTokens cannot exceed the
   * configured window. Recompute from AgentOptions or the adapter default each
   * call; a previous remaining-cap written into the envelope is not the user's
   * output budget. Remaining ≤ 0 leaves the config alone — pre-step reject
   * owns that turn.
   */
  private async capRequestMaxTokens(
    agent: Agent,
    config: LlmCallConfig,
    signal: AbortSignal,
  ): Promise<LlmCallConfig> {
    if (config.provider.length === 0 || config.model.length === 0) return config
    let info
    try {
      info = await this.ctx.llm.resolveModelInfo(config.provider, config.model, signal)
    } catch {
      return config
    }
    const occupancyWindow = info.context?.contextWindow
    if (occupancyWindow === undefined) return config
    const remaining = occupancyWindow - this.ctx.tokenMeter.measure(agent.session).totalTokens
    if (remaining <= 0) return config
    const requested = agent.options.maxTokens ?? info.defaultMaxTokens ?? config.maxTokens
    if (requested === undefined) return config
    const maxTokens = Math.min(requested, remaining)
    if (maxTokens === config.maxTokens) return config
    return { ...config, maxTokens }
  }

  /** Bind the effective token meter and dynamically dispatched summarizer hook. */
  private regionDependencies(): Parameters<typeof compactSurfaceRegion>[0] {
    return {
      meter: this.ctx.tokenMeter,
      summarize: (input, owner, abort) => this.summarize(input, owner, abort),
      recover: (error, agent, sourceEventSeqs, signal) => this.ctx.waterfall('compaction/summary-error', {
        session: agent.session,
        sourceEventSeqs,
        error,
        ...signal === undefined ? {} : { signal },
      }, () => false),
    }
  }
}

export default BasicCompactionEngine
