export type ContentKind = 'home' | 'section' | 'post';

export type ContentSummary = {
  route: string;
  title: string;
  summary: string;
  created: string | null;
  updated: string | null;
  tags: string[];
  kind: ContentKind;
  parentRoute: string | null;
};

export type ContentRecord = ContentSummary & {
  sourcePath: string | null;
  html: string;
  wordCount: number;
  readingMinutes: number;
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
