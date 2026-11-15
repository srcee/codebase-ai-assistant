import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChatQuestionSet } from './chat-questions';
import { evalRoot } from './eval-root';
import { loadQuestionSet } from './eval-questions';

describe('chat question set', () => {
  it('uses unique ids that do not clash with the answerable set', () => {
    const chat = loadChatQuestionSet();
    const answerable = loadQuestionSet();
    const ids = [
      ...answerable.questions.map((question) => question.id),
      ...chat.unanswerable.map((question) => question.id),
      ...chat.followUps.map((question) => question.id),
    ];

    expect(new Set(ids).size).toBe(ids.length);
    expect(chat.answerableQuestionSet).toBe('questions.v1.json');
    expect(chat.corpus).toBe(answerable.corpus);
  });

  it('points every follow-up range at existing lines that contain its anchor', () => {
    for (const followUp of loadChatQuestionSet().followUps) {
      for (const location of followUp.expected) {
        const lines = readFileSync(
          join(evalRoot(), 'corpus', location.path),
          'utf8',
        ).split(/\r?\n/);
        const inRange = lines
          .slice(location.startLine - 1, location.endLine)
          .join('\n');
        expect({
          id: followUp.id,
          found: inRange.includes(location.anchor),
        }).toEqual({ id: followUp.id, found: true });
      }
    }
  });
});
