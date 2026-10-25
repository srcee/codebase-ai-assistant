import * as ts from 'typescript';
import type { ChunkLimits, LineRange } from '../types/line-range';
import type { RangeSegment } from '../types/range-segment';
import {
  classMemberSegments,
  endLineOf,
  startLineWithComments,
  type LineOf,
} from './class-member-segments';
import { createLineIndex } from './create-line-index';
import { createRangeMeasure } from './measure-range';
import { mergeSegments } from './merge-segments';
import { parseTypeScript } from './parse-typescript';
import { splitIntoWindows } from './split-into-windows';
import { trimBlankEdges } from './trim-blank-edges';

function statementName(statement: ts.Statement): string | undefined {
  if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
    return statement.name?.text ?? 'default';
  }
  if (
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isEnumDeclaration(statement) ||
    ts.isModuleDeclaration(statement)
  ) {
    return statement.name.text;
  }
  if (ts.isExportAssignment(statement)) return 'default';
  if (ts.isVariableStatement(statement)) {
    const names = statement.declarationList.declarations.flatMap(
      (declaration) =>
        ts.isIdentifier(declaration.name) ? [declaration.name.text] : [],
    );
    return names.length > 0 ? names.join(', ') : undefined;
  }
  return undefined;
}

function symbolSegments(
  sourceFile: ts.SourceFile,
  lineOf: LineOf,
): RangeSegment[] {
  const segments: RangeSegment[] = [];
  for (const statement of sourceFile.statements) {
    const symbolName = statementName(statement);
    if (symbolName === undefined) continue;
    segments.push({
      startLine: startLineWithComments(statement, sourceFile, lineOf),
      endLine: endLineOf(statement, lineOf),
      symbolName,
      split: ts.isClassDeclaration(statement)
        ? () => classMemberSegments(statement, symbolName, sourceFile, lineOf)
        : undefined,
    });
  }
  return mergeSegments(segments);
}

/**
 * Line ranges for a TypeScript or JavaScript file: one per top-level symbol, class members when a class is
 * too large, and unnamed ranges for the code between symbols. Returns undefined when the file does not parse.
 */
export function typescriptRanges(
  text: string,
  lines: readonly string[],
  extension: string,
  limits: ChunkLimits,
): LineRange[] | undefined {
  const sourceFile = parseTypeScript(text, extension);
  if (!sourceFile) return undefined;

  const lineOf = createLineIndex(text);
  const measure = createRangeMeasure(lines);
  const segments = symbolSegments(sourceFile, lineOf);
  const ranges: LineRange[] = [];

  const addWithinLimit = (
    startLine: number,
    endLine: number,
    symbolName?: string,
  ): void => {
    if (measure(startLine, endLine) <= limits.chunkMaxChars) {
      const range = trimBlankEdges(lines, startLine, endLine, symbolName);
      if (range) ranges.push(range);
    } else {
      ranges.push(
        ...splitIntoWindows(lines, startLine, endLine, limits, symbolName),
      );
    }
  };

  let nextUncovered = 1;
  for (const segment of segments) {
    addWithinLimit(nextUncovered, segment.startLine - 1);
    nextUncovered = segment.endLine + 1;

    if (measure(segment.startLine, segment.endLine) <= limits.chunkMaxChars) {
      ranges.push(segment);
      continue;
    }
    const parts = segment.split?.() ?? [];
    if (parts.length === 0) {
      addWithinLimit(segment.startLine, segment.endLine, segment.symbolName);
      continue;
    }
    for (const part of parts) {
      addWithinLimit(part.startLine, part.endLine, part.symbolName);
    }
  }
  addWithinLimit(nextUncovered, lines.length);

  return ranges.map(({ startLine, endLine, symbolName }) =>
    symbolName === undefined
      ? { startLine, endLine }
      : { startLine, endLine, symbolName },
  );
}
