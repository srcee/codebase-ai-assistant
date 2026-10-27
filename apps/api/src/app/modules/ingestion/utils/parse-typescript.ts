import * as ts from 'typescript';

const COMPILER_OPTIONS: ts.CompilerOptions = {
  allowJs: true,
  jsx: ts.JsxEmit.Preserve,
  target: ts.ScriptTarget.ESNext,
};

/** Returns the syntax tree, or undefined when the file has syntax errors. Never touches the filesystem. */
export function parseTypeScript(
  text: string,
  extension: string,
): ts.SourceFile | undefined {
  const fileName = `source${extension}`;
  const { diagnostics } = ts.transpileModule(text, {
    fileName,
    reportDiagnostics: true,
    compilerOptions: COMPILER_OPTIONS,
  });
  if (diagnostics?.length) return undefined;
  return ts.createSourceFile(fileName, text, ts.ScriptTarget.ESNext, false);
}
