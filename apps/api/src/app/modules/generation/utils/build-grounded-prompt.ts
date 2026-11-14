import { randomUUID } from 'node:crypto';
import type { ContentKind, Locator } from '@codebase-ai/contracts';
import type { ChatMessage } from '../../inference/types/chat-message';
import { GROUNDED_SYSTEM_PROMPT } from '../constants/grounded-system-prompt';
import type { EvidenceItem } from '../types/evidence-item';
import type {
  ConversationTurn,
  GroundedAnswerInput,
} from '../types/grounded-answer-input';
import { formatLocator } from './format-locator';

export interface HistoryBudget {
  maxTurns: number;
  maxChars: number;
}

const KIND_LABELS: Record<ContentKind, string> = {
  code: 'code',
  prose: 'prose',
  table_rows: 'table rows',
  schema_entity: 'schema entity',
  image_description: 'image description (generated text, not the image)',
};

// Metadata comes from file names and headings, so it must not break the block layout.
const singleLine = (value: string): string =>
  value.replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ').trim();

function columnsLine(locator: Locator): string[] {
  return locator.kind === 'table_rows' && locator.columns.length > 0
    ? [`columns: ${singleLine(locator.columns.join(' | '))}`]
    : [];
}

function evidenceBlock(
  item: EvidenceItem,
  index: number,
  token: string,
): string {
  const n = index + 1;
  return [
    `<<<EVIDENCE ${n} id=${token}>>>`,
    `kind: ${KIND_LABELS[item.contentKind]}`,
    `source: ${singleLine(item.sourceName)}`,
    `path: ${singleLine(item.relativePath)}`,
    `location: ${singleLine(formatLocator(item.locator))}`,
    ...columnsLine(item.locator),
    '---',
    item.content,
    `<<<END EVIDENCE ${n} id=${token}>>>`,
  ].join('\n');
}

/** Keeps the newest turns that fit both limits; a turn is kept whole or dropped. */
export function trimHistory(
  history: readonly ConversationTurn[],
  budget: HistoryBudget,
): ConversationTurn[] {
  const kept: ConversationTurn[] = [];
  let characters = 0;
  for (const turn of [...history].reverse()) {
    if (kept.length >= budget.maxTurns) break;
    const size = turn.question.length + turn.answer.length;
    if (characters + size > budget.maxChars) break;
    kept.unshift(turn);
    characters += size;
  }
  return kept;
}

/** Evidence size is bounded by the retrieval context budget; history by `budget`. */
export function buildGroundedPrompt(
  input: GroundedAnswerInput,
  budget: HistoryBudget,
  token: string = randomUUID(),
): ChatMessage[] {
  const history = trimHistory(input.history, budget).flatMap(
    (turn): ChatMessage[] => [
      { role: 'user', content: turn.question },
      { role: 'assistant', content: turn.answer },
    ],
  );
  const evidence = input.evidence.map((item, index) =>
    evidenceBlock(item, index, token),
  );
  return [
    { role: 'system', content: GROUNDED_SYSTEM_PROMPT },
    ...history,
    {
      role: 'user',
      content: [
        `Evidence boundary token: ${token}`,
        '',
        ...evidence.flatMap((block) => [block, '']),
        'Question:',
        input.question,
      ].join('\n'),
    },
  ];
}
