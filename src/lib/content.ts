export type ContentKind = 'home' | 'section' | 'post';
export type ContentLayout = 'list' | 'timeline' | 'feed' | 'grid' | 'table';
export type ContentSort = 'create' | 'update' | 'title';

export type ContentOptions = {
  pinned: boolean;
  showInMenu: boolean;
  showInFooter: boolean;
  showChildren: boolean;
  showNestedNotes: boolean;
  showBreadcrumbs: boolean;
  showNoteNavigation: boolean;
  showNoteFooter: boolean;
  showNoteMetadata: boolean;
  sortBy: ContentSort;
  layout: ContentLayout;
  previewProps: string[];
};

export type ContentSummary = {
  route: string;
  title: string;
  summary: string;
  created: string | null;
  updated: string | null;
  tags: string[];
  kind: ContentKind;
  parentRoute: string | null;
  hidden: boolean;
  properties: Record<string, string>;
  options: ContentOptions;
};

export type ContentRecord = ContentSummary & {
  sourcePath: string | null;
  html: string;
  wordCount: number;
  readingMinutes: number;
};

export type ContentListingEntry = ContentSummary & {
  html?: string;
};

export type SearchEntry = {
  route: string;
  href: string;
  title: string;
  text: string;
  summary: string;
  tags: string[];
  kind: ContentKind;
  created: string | null;
};

export type ArchiveGroup = {
  key: string;
  label: string;
  entries: ContentSummary[];
};

export type TagGroup = {
  tag: string;
  slug: string;
  entries: ContentSummary[];
};
