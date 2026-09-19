import { memo, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { JsonBlock } from '@x1a0f3n9/dsh-client-ui-primitives'
import type { ConversationLocationDataStore, ConversationTurnDataMap } from '@x1a0f3n9/dsh-client-ui-conversation/client'
import type { ChatNodeOwnerProps, ChatViewSlotProps } from '../contract/slots.ts'
import type { ChatNode } from '../contract/chat-nodes.ts'
import { TURN_PROCESS_INDEPENDENT_KINDS } from '../contract/turn-process.ts'
import { storedTurnProcessEntry } from '../stores.ts'
import { useSearchableHidden } from './searchable-hidden.ts'
import { UserMessageFallbackView } from './MessageItem.tsx'
import css from './ChatView.module.css'

interface ChatNodeSeatProps extends ChatNodeOwnerProps {
  readonly nodeKey: string
  readonly useChatNode: ChatViewSlotProps['useChatNode']
  readonly useChatNodeProcess: ChatViewSlotProps['useChatNodeProcess']
  readonly historyIncomplete: boolean
  readonly compactTranscript: boolean
  readonly useStore: ChatViewSlotProps['useStore']
  readonly actions: ChatViewSlotProps['actions']
  readonly renderSlot: ChatViewSlotProps['renderSlot']
  readonly t: ChatViewSlotProps['t']
}

type RoutedChatNodeOwner = {
  [Kind in ChatNode['kind']]: ChatNodeOwnerProps & { readonly node: ChatNode<Kind> }
}[ChatNode['kind']]

function turnDataOf(node: ChatNode | undefined): ConversationLocationDataStore<ConversationTurnDataMap> | undefined {
  const location = node?.location
  return location?.kind === 'turn' || location?.kind === 'step' ? location.turn.data : undefined
}

function turnOf(node: ChatNode | undefined): number | undefined {
  const location = node?.location
  return location?.kind === 'turn' || location?.kind === 'step' ? location.turn.turn : undefined
}

function isUserStyleChatNode(node: ChatNode): node is ChatNode<'user' | 'steering'> {
  return node.kind === 'user' || node.kind === 'steering'
}

/** Admitted steering reuses the user keyed occupant; the seat wrapper keeps kind steering. */
function chatNodeRendererKey(node: ChatNode): ChatNode['kind'] {
  return isUserStyleChatNode(node) ? 'user' : node.kind
}

/** User and steering rows stay ordinary bubbles when the keyed renderer is absent. */
function chatNodeFallback(
  owner: RoutedChatNodeOwner,
  t: ChatViewSlotProps['t'],
): ReactNode {
  if (isUserStyleChatNode(owner.node)) {
    return (
      <UserMessageFallbackView
        node={owner.node}
        renderMessageImages={owner.renderMessageImages}
        openFile={owner.openFile}
        openSkill={owner.openSkill}
        t={t}
      />
    )
  }
  return (
    <JsonBlock
      label={t('message.unknownSurface', { type: owner.node.kind })}
      payload={owner.node.data}
      truncatedLabel={total => t('json.truncated', { total })}
    />
  )
}

/** Subscribe, apply Turn-process visibility, and dispatch one stable Context key. */
export const ChatNodeSeat = memo(function ChatNodeSeat({
  nodeKey, useChatNode, useChatNodeProcess, historyIncomplete, compactTranscript,
  cwd, openFile, openSkill, inspectCall, forkAt,
  loadImage, renderMessageImages, fileMentions, useStore, actions, renderSlot, t,
}: ChatNodeSeatProps) {
  const node = useChatNode(nodeKey)
  const routedNode = node as ChatNode | undefined
  const turn = turnOf(routedNode)
  const processPresentation = useChatNodeProcess(nodeKey)
  const processSpec = processPresentation?.spec
  const storedEntry = useStore(state => processSpec === undefined
    ? undefined
    : storedTurnProcessEntry(state, processSpec.turn))
  const processEntry = processSpec !== undefined
    && processSpec.answerStep !== null
    && storedEntry?.answerStep === processSpec.answerStep
    ? storedEntry
    : undefined
  const processOpen = processEntry !== undefined
  const setOpen = useCallback((open: boolean) => {
    if (processSpec !== undefined && processSpec.answerStep !== null) {
      actions.setTurnProcessOpen(processSpec.turn, processSpec.answerStep, open)
    }
  }, [actions, processSpec])
  const processWindowReady = processSpec !== undefined
    && processPresentation !== undefined
    && compactTranscript
    && processSpec.answerAnchorSeq !== null
    && processPresentation.turn === processSpec.turn
    && processPresentation.turnClosed
    && !historyIncomplete
  const processMember = routedNode !== undefined
    && processWindowReady
    && !TURN_PROCESS_INDEPENDENT_KINDS.has(routedNode.kind)
    && routedNode.anchorSeq >= processSpec.processStartSeq
    && routedNode.anchorSeq < processSpec.answerAnchorSeq
  const processAnswer = routedNode !== undefined
    && processWindowReady
    && routedNode.kind === 'assistant-step'
    && routedNode.data.step === processSpec.answerStep
  const ownsDisclosure = routedNode?.kind === 'turn-process' || processAnswer
  const foldable = processWindowReady
    && (processMember || (ownsDisclosure
      && (processPresentation.hasExternalProcess || processSpec.inlineReasoning)))
  const turnProcess = useMemo(() => processSpec === undefined
    ? undefined
    : {
      spec: processSpec,
      foldable,
      open: processOpen,
      setOpen,
    }, [
    foldable, processOpen, processSpec, setOpen,
  ])
  const controllerInactive = routedNode?.kind === 'turn-process'
    && !foldable
  const compactAnswer = processAnswer
    && foldable
    && processPresentation.compactAnswer
    && !processOpen
  const processHidden = controllerInactive || (foldable && processMember && !processOpen)
  const revealProcess = useCallback(() => {
    if (processMember) setOpen(true)
  }, [processMember, setOpen])
  const wrapperRef = useSearchableHidden(processHidden, revealProcess)
  const owner = useMemo<ChatNodeOwnerProps | null>(() => node === undefined
    ? null
    : {
      cwd,
      openFile,
      openSkill,
      inspectCall,
      forkAt,
      loadImage,
      renderMessageImages,
      fileMentions,
      turnProcess,
    }, [
    node, cwd, openFile, openSkill, inspectCall, forkAt,
    loadImage, renderMessageImages, fileMentions, turnProcess,
  ])
  if (routedNode === undefined || owner === null) return null
  const turnData = turnDataOf(routedNode)
  // User-style nodes share the user keyed occupant; other kinds keep their
  // discriminant. TypeScript does not distribute an object containing a union
  // into a union of objects itself.
  const routedOwner = { ...owner, node: routedNode } as RoutedChatNodeOwner
  return (
    <div
      ref={wrapperRef}
      className={css.flowItem}
      data-chat-anchor-key={routedNode.key}
      data-chat-flow-key={routedNode.key}
      data-chat-flow-kind={routedNode.kind}
      data-chat-turn={turn}
      data-turn-process-member={processMember || undefined}
      data-turn-process-hidden={processHidden || undefined}
      data-turn-process-answer={compactAnswer || undefined}
    >
      {renderSlot('conversation.chat.node', routedOwner, {
        entryKey: chatNodeRendererKey(routedNode),
        hookContext: turnData,
        fallback: chatNodeFallback(routedOwner, t),
      })}
    </div>
  )
})
