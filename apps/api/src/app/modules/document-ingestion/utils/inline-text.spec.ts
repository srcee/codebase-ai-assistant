import MarkdownIt from 'markdown-it';
import { inlineText } from './inline-text';

const markdown = new MarkdownIt();

const headingInline = (source: string) =>
  markdown.parse(source, {}).find((token) => token.type === 'inline');

describe('inlineText', () => {
  it('drops markup and keeps code spans', () => {
    expect(inlineText(headingInline('# Grant **admin** to `reviewer`'))).toBe(
      'Grant admin to reviewer',
    );
  });

  it('turns line breaks into single spaces', () => {
    expect(inlineText(headingInline('Approval\nworkflow\n===\n'))).toBe(
      'Approval workflow',
    );
  });

  it('keeps the alt text of an image and the text of a link', () => {
    expect(
      inlineText(
        headingInline('# ![Role matrix](matrix.png) [roles](roles.md)'),
      ),
    ).toBe('Role matrix roles');
  });

  it('is empty without a token', () => {
    expect(inlineText(undefined)).toBe('');
  });
});
