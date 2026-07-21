export const SHOWCASE_BLOCK_TYPES = [
  'hero',
  'about',
  'credentials',
  'program-list',
  'contacts-cta',
] as const;

export type ShowcaseBlockType = (typeof SHOWCASE_BLOCK_TYPES)[number];

export interface ShowcaseBlockBase {
  id: string;
  schema_version: number;
  visible: boolean;
  order: number;
}

export interface HeroBlock extends ShowcaseBlockBase {
  type: 'hero';
  props: {
    headline: string;
    subheadline?: string | null;
    cta_label?: string | null;
    image_url?: string | null;
  };
}

export interface AboutBlock extends ShowcaseBlockBase {
  type: 'about';
  props: {
    heading: string;
    body: string;
  };
}

export interface CredentialsBlock extends ShowcaseBlockBase {
  type: 'credentials';
  props: {
    heading: string;
    items: readonly string[];
  };
}

export interface ProgramListBlock extends ShowcaseBlockBase {
  type: 'program-list';
  props: {
    heading: string;
    program_ids: readonly string[];
    show_prices: boolean;
  };
}

export interface ContactsCtaBlock extends ShowcaseBlockBase {
  type: 'contacts-cta';
  props: {
    heading: string;
    body?: string | null;
    cta_label: string;
  };
}

export type ShowcaseBlock =
  | HeroBlock
  | AboutBlock
  | CredentialsBlock
  | ProgramListBlock
  | ContactsCtaBlock;

export interface ShowcaseDocument {
  schema_version: number;
  blocks: readonly ShowcaseBlock[];
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: UnknownRecord, allowedKeys: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function isString(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.trim().length >= min && value.length <= max;
}

function isOptionalString(value: unknown, max: number): value is string | null | undefined {
  return value === undefined || value === null || isString(value, 1, max);
}

function isHttpUrl(value: unknown): value is string | null | undefined {
  if (value === undefined || value === null) {
    return true;
  }

  if (!isString(value, 1, 2048)) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function hasBlockBase(value: UnknownRecord): boolean {
  return (
    hasOnlyKeys(value, ['id', 'schema_version', 'visible', 'order', 'type', 'props']) &&
    isString(value['id'], 1, 80) &&
    /^[a-z0-9][a-z0-9-]*$/.test(value['id']) &&
    Number.isInteger(value['schema_version']) &&
    (value['schema_version'] as number) >= 1 &&
    typeof value['visible'] === 'boolean' &&
    Number.isInteger(value['order']) &&
    (value['order'] as number) >= 0
  );
}

function isHeroBlock(value: UnknownRecord): value is HeroBlock & UnknownRecord {
  const props = value['props'];
  return (
    value['type'] === 'hero' &&
    isRecord(props) &&
    hasOnlyKeys(props, ['headline', 'subheadline', 'cta_label', 'image_url']) &&
    isString(props['headline'], 1, 120) &&
    isOptionalString(props['subheadline'], 280) &&
    isOptionalString(props['cta_label'], 48) &&
    isHttpUrl(props['image_url'])
  );
}

function isAboutBlock(value: UnknownRecord): value is AboutBlock & UnknownRecord {
  const props = value['props'];
  return (
    value['type'] === 'about' &&
    isRecord(props) &&
    hasOnlyKeys(props, ['heading', 'body']) &&
    isString(props['heading'], 1, 100) &&
    isString(props['body'], 1, 2000)
  );
}

function isCredentialsBlock(value: UnknownRecord): value is CredentialsBlock & UnknownRecord {
  const props = value['props'];
  const items = isRecord(props) ? props['items'] : undefined;
  return (
    value['type'] === 'credentials' &&
    isRecord(props) &&
    hasOnlyKeys(props, ['heading', 'items']) &&
    isString(props['heading'], 1, 100) &&
    Array.isArray(items) &&
    items.length >= 1 &&
    items.length <= 12 &&
    items.every((item) => isString(item, 1, 300))
  );
}

function isProgramListBlock(value: UnknownRecord): value is ProgramListBlock & UnknownRecord {
  const props = value['props'];
  const programIds = isRecord(props) ? props['program_ids'] : undefined;
  return (
    value['type'] === 'program-list' &&
    isRecord(props) &&
    hasOnlyKeys(props, ['heading', 'program_ids', 'show_prices']) &&
    isString(props['heading'], 1, 100) &&
    Array.isArray(programIds) &&
    programIds.length <= 24 &&
    programIds.every((programId) => isString(programId, 1, 80)) &&
    typeof props['show_prices'] === 'boolean'
  );
}

function isContactsCtaBlock(value: UnknownRecord): value is ContactsCtaBlock & UnknownRecord {
  const props = value['props'];
  return (
    value['type'] === 'contacts-cta' &&
    isRecord(props) &&
    hasOnlyKeys(props, ['heading', 'body', 'cta_label']) &&
    isString(props['heading'], 1, 100) &&
    isOptionalString(props['body'], 500) &&
    isString(props['cta_label'], 1, 48)
  );
}

export function isShowcaseBlock(value: unknown): value is ShowcaseBlock {
  return (
    isRecord(value) &&
    hasBlockBase(value) &&
    (isHeroBlock(value) ||
      isAboutBlock(value) ||
      isCredentialsBlock(value) ||
      isProgramListBlock(value) ||
      isContactsCtaBlock(value))
  );
}

/**
 * Validates exactly the finite, versioned block registry shared with FastAPI.
 * There is intentionally no generic HTML/CSS/JS block type.
 */
export function isShowcaseDocument(value: unknown): value is ShowcaseDocument {
  if (!isRecord(value) || !Number.isInteger(value['schema_version'])) {
    return false;
  }

  const blocks = value['blocks'];
  return (
    (value['schema_version'] as number) >= 1 &&
    Array.isArray(blocks) &&
    blocks.length <= 40 &&
    blocks.every(isShowcaseBlock)
  );
}
