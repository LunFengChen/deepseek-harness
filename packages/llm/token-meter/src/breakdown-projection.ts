/**
 * Heuristic composition of the current retained surface, independent of route
 * image pricing and provider usage. Positional entries preserve system-prompt
 * classification across replacements without retaining historical messages.
 */

import { z } from 'zod'
import { canonicalHeader, deriveEventMessage, isSurfaceEvent, SessionSeq } from '@x1a0f3n9/dsh-session'
import type { Session } from '@x1a0f3n9/dsh-session'
import type { ProjectionDefinition } from '@x1a0f3n9/dsh-session-projection'
import { estimateToolsTokens } from './estimate.ts'
import { commitSurfaceTokens, planSurfaceTokens, priceCurrentSurfaceNode } from './surface-fold.ts'
// Import for the `contextBreakdown` SessionProjectionStateMap key merge.
import type {} from './projection.ts'

declare module '@x1a0f3n9/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    contextBreakdown: ContextBreakdownState
  }
}

const tokenCount = z.number().int().nonnegative()
const sessionSeq = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).transform(SessionSeq)

const breakdownSchema = z.object({
  systemTokens: tokenCount,
  toolsTokens: tokenCount,
  messageTokens: tokenCount,
}).strict()

/** Plain-JSON checkpoint: one compact entry per retained surface position. */
const contextBreakdownStateSchema = z.object({
  nodes: z.array(z.object({
    seq: sessionSeq,
    heuristicTokens: tokenCount,
    system: z.boolean(),
  }).strict()),
  breakdown: breakdownSchema,
}).strict()
type ContextBreakdownState = z.infer<typeof contextBreakdownStateSchema>
type ContextBreakdownNode = ContextBreakdownState['nodes'][number]

/** Classify the last nonempty system node as system tokens; every other price is a message. */
function breakdownFromNodes(
  nodes: readonly ContextBreakdownNode[],
  toolsTokens: number,
): ContextBreakdownState['breakdown'] {
  const systemTokens = nodes.findLast(node => node.system && node.heuristicTokens > 0)?.heuristicTokens ?? 0
  const messageTokens = nodes.reduce((total, node) => total + node.heuristicTokens, 0) - systemTokens
  return { systemTokens, toolsTokens, messageTokens }
}

/**
 * Price the current surface without replaying dropped replace ranges.
 * @param session - windowed Session whose current nodes remain in the live tail or prefixHot.
 * @returns host state for the current surface and latest request header.
 * @throws when a current surface node is missing from the live window or is not a surface event.
 */
function bootstrapWindowedBreakdown(session: Session): ContextBreakdownState {
  const nodes: ContextBreakdownNode[] = []
  for (const seq of session.surface.nodes) {
    // oxlint-disable-next-line typescript/no-deprecated -- Current surface nodes stay in the live tail or prefixHot.
    const event = session.eventAt(seq)
    if (event === undefined || !isSurfaceEvent(event)) {
      throw new Error(`contextBreakdown cannot price surface node ${String(seq)} missing from the live window`)
    }
    nodes.push({
      seq,
      heuristicTokens: priceCurrentSurfaceNode(seq, deriveEventMessage(event)).heuristicTokens,
      system: event.type === 'system/message',
    })
  }
  return {
    nodes,
    breakdown: breakdownFromNodes(nodes, estimateToolsTokens(session.requestHeader())),
  }
}

/**
 * Context composition with the last nonempty surviving system in surface
 * order classified as system tokens; all other visible prices are messages.
 * Replacements use the measurement planner, not shadow-price claims. State
 * and surface transitions cost O(current retained surface), not O(log length).
 * Tools are priced from the latest request header. No route pricing applies.
 */
export const contextBreakdownProjectionDefinition = {
  key: 'contextBreakdown',
  stateVersion: 5,
  stateSchema: contextBreakdownStateSchema,
  init: (): ContextBreakdownState => ({
    nodes: [],
    breakdown: { systemTokens: 0, toolsTokens: 0, messageTokens: 0 },
  }),
  bootstrapWindowed: bootstrapWindowedBreakdown,
  apply: (state, event) => {
    if (event.type === 'request/header') {
      const toolsTokens = estimateToolsTokens(canonicalHeader(event.data.header))
      return toolsTokens === state.breakdown.toolsTokens
        ? state
        : { ...state, breakdown: { ...state.breakdown, toolsTokens } }
    }
    if (!isSurfaceEvent(event)) return state
    const plan = planSurfaceTokens(state.nodes, event)
    const nodes = [...state.nodes]
    commitSurfaceTokens(nodes, {
      ...plan,
      node: { seq: event.seq, heuristicTokens: plan.tokens, system: event.type === 'system/message' },
    })
    const systemTokens = nodes.findLast(node => node.system && node.heuristicTokens > 0)?.heuristicTokens ?? 0
    const messageTokens = state.breakdown.systemTokens + state.breakdown.messageTokens + plan.deltaTokens - systemTokens
    const breakdown = systemTokens === state.breakdown.systemTokens && messageTokens === state.breakdown.messageTokens
      ? state.breakdown
      : { systemTokens, toolsTokens: state.breakdown.toolsTokens, messageTokens }
    return { nodes, breakdown }
  },
  wire: {
    viewSchema: breakdownSchema,
    view: state => state.breakdown,
  },
} satisfies ProjectionDefinition<'contextBreakdown', ContextBreakdownState>
