import { loadChatQuestionSet } from './chat-questions';
import { loadQuestionSet } from './eval-questions';

describe('chat question set', () => {
  it('uses unique ids that do not clash with the answerable set', () => {
    const chat = loadChatQuestionSet();
    const answerable = loadQuestionSet();
    const ids = [
      ...answerable.questions.map((question) => question.id),
      ...chat.unanswerable.map((question) => question.id),
    ];

    expect(new Set(ids).size).toBe(ids.length);
    expect(chat.answerableQuestionSet).toBe('questions.v1.json');
    expect(chat.corpus).toBe(answerable.corpus);
  });
});
