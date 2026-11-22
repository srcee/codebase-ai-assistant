import type { DocumentChunk } from '../types/document-chunk';
import { chunkMarkdown } from './chunk-markdown';

const LIMITS = { chunkMaxChars: 2000, chunkOverlapChars: 200 };

const SPEC = [
  '---',
  'title: Roles',
  'owner: docs',
  '---',
  'Intro paragraph before any heading.',
  '',
  '# Roles',
  '',
  'Roles decide what a user may do.',
  '',
  '## Reviewer',
  '',
  'Reviewers approve **requests**.',
  '',
  '### Permissions',
  '',
  '| Permission | Allowed |',
  '| --- | --- |',
  '| Approve request | yes |',
  '| Delete project | no |',
  '',
  '## Admin',
  'Setext `Heading`',
  '----------------',
  '',
  '```text',
  '# not a heading',
  '```',
  '',
].join('\n');

const summary = (chunks: DocumentChunk[]) =>
  chunks.map((chunk) => ({
    title: chunk.title,
    contentKind: chunk.contentKind,
    locator: chunk.locator,
  }));

describe('chunkMarkdown', () => {
  it('chunks each section under its heading path and keeps tables as rows', () => {
    expect(summary(chunkMarkdown(SPEC, LIMITS))).toEqual([
      {
        title: null,
        contentKind: 'prose',
        locator: { kind: 'lines', startLine: 2, endLine: 5 },
      },
      {
        title: 'Roles',
        contentKind: 'prose',
        locator: { kind: 'section', headingPath: ['Roles'] },
      },
      {
        title: 'Roles > Reviewer',
        contentKind: 'prose',
        locator: { kind: 'section', headingPath: ['Roles', 'Reviewer'] },
      },
      {
        title: 'Roles > Reviewer > Permissions',
        contentKind: 'table_rows',
        locator: {
          kind: 'table_rows',
          tableIndex: 1,
          rowStart: 2,
          rowEnd: 3,
          columns: ['Permission', 'Allowed'],
        },
      },
      {
        title: 'Roles > Setext Heading',
        contentKind: 'prose',
        locator: {
          kind: 'section',
          headingPath: ['Roles', 'Setext Heading'],
        },
      },
    ]);
  });

  it('keeps front matter as text in the first chunk', () => {
    const [first] = chunkMarkdown(SPEC, LIMITS);
    expect(first.content).toBe(
      'title: Roles\nowner: docs\n\nIntro paragraph before any heading.',
    );
  });

  it('starts section content with the heading path and keeps the Markdown source', () => {
    const chunks = chunkMarkdown(SPEC, LIMITS);
    expect(chunks[2].content).toBe(
      'Roles > Reviewer\n\nReviewers approve **requests**.',
    );
    expect(chunks[4].content).toBe(
      'Roles > Setext Heading\n\n```text\n# not a heading\n```',
    );
  });

  it('splits a long section into windows that never cross a heading', () => {
    const paragraph = (index: number) =>
      `Paragraph ${index} explains how a reviewer approves a request step by step.`;
    const text = [
      '# Workflow',
      '',
      ...Array.from({ length: 12 }, (_, index) => [
        paragraph(index),
        '',
      ]).flat(),
      '# Glossary',
      '',
      'A request is a change waiting for approval.',
    ].join('\n');
    const chunks = chunkMarkdown(text, {
      chunkMaxChars: 300,
      chunkOverlapChars: 80,
    });

    const workflow = chunks.filter((chunk) => chunk.title === 'Workflow');
    expect(workflow.length).toBeGreaterThan(1);
    for (const chunk of workflow) {
      expect(chunk.content.length).toBeLessThanOrEqual(300);
      expect(chunk.content.startsWith('Workflow\n\n')).toBe(true);
      expect(chunk.content).not.toContain('Glossary');
      expect(chunk.content).not.toContain('A request is');
    }
    expect(workflow[1].content).toContain(
      workflow[0].content.split('\n\n').pop(),
    );
    expect(chunks[chunks.length - 1]).toMatchObject({
      title: 'Glossary',
      locator: { kind: 'section', headingPath: ['Glossary'] },
    });
  });

  it('pops headings by level and counts tables across the document', () => {
    const text = [
      '| A | B |',
      '|---|---|',
      '| 1 | 2 |',
      '# One',
      '## Two',
      'Body two.',
      '# Three',
      'Body three.',
      '| C |',
      '|---|',
      '| 3 |',
    ].join('\n');
    expect(summary(chunkMarkdown(text, LIMITS))).toEqual([
      {
        title: null,
        contentKind: 'table_rows',
        locator: expect.objectContaining({
          tableIndex: 1,
          columns: ['A', 'B'],
        }),
      },
      {
        title: 'One > Two',
        contentKind: 'prose',
        locator: { kind: 'section', headingPath: ['One', 'Two'] },
      },
      {
        title: 'Three',
        contentKind: 'prose',
        locator: { kind: 'section', headingPath: ['Three'] },
      },
      {
        title: 'Three',
        contentKind: 'table_rows',
        locator: expect.objectContaining({ tableIndex: 2, columns: ['C'] }),
      },
    ]);
  });

  it('names an empty heading and ignores thematic breaks', () => {
    const chunks = chunkMarkdown('#\n\nText.\n\n***\n', LIMITS);
    expect(chunks).toEqual([
      expect.objectContaining({
        content: '(untitled)\n\nText.',
        locator: { kind: 'section', headingPath: ['(untitled)'] },
      }),
    ]);
  });

  it('is deterministic and hashes the content', () => {
    const first = chunkMarkdown(SPEC, LIMITS);
    expect(chunkMarkdown(SPEC, LIMITS)).toEqual(first);
    expect(new Set(first.map((chunk) => chunk.chunkHash)).size).toBe(
      first.length,
    );
  });

  it('returns nothing for an empty document', () => {
    expect(chunkMarkdown('', LIMITS)).toEqual([]);
    expect(chunkMarkdown('# Only a heading\n', LIMITS)).toEqual([]);
  });
});
