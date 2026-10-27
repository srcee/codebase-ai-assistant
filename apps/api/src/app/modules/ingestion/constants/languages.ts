import type { LanguageDefinition } from '../types/language-definition';

// Formats that commonly hold unquoted secrets (YAML, TOML, INI, properties, XML, .env) are left out on purpose.
export const LANGUAGES = [
  // Symbol-aware chunking
  {
    id: 'typescript',
    extensions: ['.ts', '.tsx', '.mts', '.cts'],
    chunking: 'typescript',
  },
  {
    id: 'javascript',
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
    chunking: 'typescript',
  },

  // Line chunking
  { id: 'json', extensions: ['.json'], chunking: 'lines' },
  { id: 'markdown', extensions: ['.md', '.mdx'], chunking: 'lines' },
  { id: 'python', extensions: ['.py', '.pyi'], chunking: 'lines' },
  { id: 'go', extensions: ['.go'], chunking: 'lines' },
  { id: 'java', extensions: ['.java'], chunking: 'lines' },
  { id: 'kotlin', extensions: ['.kt', '.kts'], chunking: 'lines' },
  { id: 'scala', extensions: ['.scala'], chunking: 'lines' },
  { id: 'groovy', extensions: ['.groovy', '.gradle'], chunking: 'lines' },
  { id: 'rust', extensions: ['.rs'], chunking: 'lines' },
  { id: 'csharp', extensions: ['.cs'], chunking: 'lines' },
  { id: 'c', extensions: ['.c', '.h'], chunking: 'lines' },
  {
    id: 'cpp',
    extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx'],
    chunking: 'lines',
  },
  { id: 'swift', extensions: ['.swift'], chunking: 'lines' },
  { id: 'dart', extensions: ['.dart'], chunking: 'lines' },
  { id: 'ruby', extensions: ['.rb'], chunking: 'lines' },
  { id: 'php', extensions: ['.php'], chunking: 'lines' },
  { id: 'perl', extensions: ['.pl', '.pm'], chunking: 'lines' },
  { id: 'lua', extensions: ['.lua'], chunking: 'lines' },
  { id: 'r', extensions: ['.r'], chunking: 'lines' },
  { id: 'julia', extensions: ['.jl'], chunking: 'lines' },
  { id: 'elixir', extensions: ['.ex', '.exs'], chunking: 'lines' },
  { id: 'erlang', extensions: ['.erl', '.hrl'], chunking: 'lines' },
  { id: 'haskell', extensions: ['.hs'], chunking: 'lines' },
  { id: 'clojure', extensions: ['.clj', '.cljs', '.cljc'], chunking: 'lines' },
  { id: 'zig', extensions: ['.zig'], chunking: 'lines' },
  { id: 'shell', extensions: ['.sh', '.bash', '.zsh'], chunking: 'lines' },
  { id: 'powershell', extensions: ['.ps1', '.psm1'], chunking: 'lines' },
  { id: 'sql', extensions: ['.sql'], chunking: 'lines' },
  { id: 'html', extensions: ['.html', '.htm'], chunking: 'lines' },
  {
    id: 'css',
    extensions: ['.css', '.scss', '.sass', '.less'],
    chunking: 'lines',
  },
  { id: 'vue', extensions: ['.vue'], chunking: 'lines' },
  { id: 'svelte', extensions: ['.svelte'], chunking: 'lines' },
  { id: 'graphql', extensions: ['.graphql', '.gql'], chunking: 'lines' },
  { id: 'protobuf', extensions: ['.proto'], chunking: 'lines' },
  { id: 'terraform', extensions: ['.tf'], chunking: 'lines' },
  {
    id: 'dockerfile',
    extensions: ['.dockerfile'],
    filenames: ['dockerfile'],
    chunking: 'lines',
  },
  {
    id: 'makefile',
    extensions: ['.mk'],
    filenames: ['makefile', 'gnumakefile'],
    chunking: 'lines',
  },
] as const satisfies readonly LanguageDefinition[];
