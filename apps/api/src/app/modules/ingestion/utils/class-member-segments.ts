import * as ts from 'typescript';
import type { LineRange } from '../types/line-range';
import type { RangeSegment } from '../types/range-segment';
import { mergeSegments } from './merge-segments';

export type LineOf = (offset: number) => number;

/** First line of the node, including its JSDoc and any directly adjacent comments above it. */
export function startLineWithComments(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  lineOf: LineOf,
): number {
  let startLine = lineOf(node.getStart(sourceFile, true));
  const comments =
    ts.getLeadingCommentRanges(sourceFile.text, node.getFullStart()) ?? [];
  for (let index = comments.length - 1; index >= 0; index--) {
    const comment = comments[index];
    if (lineOf(comment.end) < startLine - 1) break;
    startLine = Math.min(startLine, lineOf(comment.pos));
  }
  return startLine;
}

export function endLineOf(node: ts.Node, lineOf: LineOf): number {
  return lineOf(node.getEnd() - 1);
}

function memberName(member: ts.ClassElement): string {
  if (ts.isConstructorDeclaration(member)) return 'constructor';
  if (ts.isClassStaticBlockDeclaration(member)) return 'static';
  const name = member.name;
  if (!name) return '[index]';
  if (
    ts.isIdentifier(name) ||
    ts.isPrivateIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text;
  }
  return '[computed]';
}

/** One segment per class member plus a header segment; the closing brace joins the last member. */
export function classMemberSegments(
  node: ts.ClassDeclaration,
  className: string,
  sourceFile: ts.SourceFile,
  lineOf: LineOf,
): LineRange[] {
  const members = node.members.filter(
    (member) => !ts.isSemicolonClassElement(member),
  );
  if (members.length === 0) return [];

  const classStart = startLineWithComments(node, sourceFile, lineOf);
  const classEnd = endLineOf(node, lineOf);
  const segments: RangeSegment[] = members.map((member, index) => ({
    startLine: startLineWithComments(member, sourceFile, lineOf),
    endLine:
      index === members.length - 1
        ? Math.max(classEnd, endLineOf(member, lineOf))
        : endLineOf(member, lineOf),
    symbolName: `${className}.${memberName(member)}`,
  }));

  const headerEnd = segments[0].startLine - 1;
  if (headerEnd >= classStart) {
    segments.push({
      startLine: classStart,
      endLine: headerEnd,
      symbolName: className,
    });
  }
  return mergeSegments(segments);
}
