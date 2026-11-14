export type SourceKind = 'code_repository' | 'document_collection';

export type ContentKind =
  | 'code'
  | 'prose'
  | 'table_rows'
  | 'schema_entity'
  | 'image_description';

/** 1-based, inclusive line range. */
export interface LinesLocator {
  kind: 'lines';
  startLine: number;
  endLine: number;
}

export interface SectionLocator {
  kind: 'section';
  headingPath: string[];
  page?: number;
}

export interface PageLocator {
  kind: 'page';
  page: number;
}

export interface TableRowsLocator {
  kind: 'table_rows';
  sheet?: string;
  tableIndex?: number;
  rowStart: number;
  rowEnd: number;
  columns: string[];
}

export interface SchemaEntityLocator {
  kind: 'schema_entity';
  entity: string;
  path?: string;
}

export interface ImageLocator {
  kind: 'image';
  frame?: string;
  region?: string;
}

/** Where a chunk sits inside its file; stored as jsonb and shared by search results and citations. */
export type Locator =
  | LinesLocator
  | SectionLocator
  | PageLocator
  | TableRowsLocator
  | SchemaEntityLocator
  | ImageLocator;

export type LocatorKind = Locator['kind'];
