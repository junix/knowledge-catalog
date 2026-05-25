// Implements the documents layout (markdown files in directory)
//

import * as fs from 'node:fs';
import * as glob from 'glob';
import * as path from 'node:path';
import * as yaml from 'yaml';
import * as md from '../metadata';
import { CatalogLayout } from '../layout';
import { CatalogSource } from '../source';

const OVERVIEW_ASPECT_KEY = 'dataplex-types.global.overview';

export class DocumentsLayout implements CatalogLayout {

  private _catalogPath: string = '';
  private _source: CatalogSource;

  private readonly _index = new Map<string, string>();

  constructor(catalogPath: string, source: CatalogSource) {
    this._catalogPath = catalogPath;
    this._source = source;
  }

  async init(): Promise<void> {
    this._index.clear();

    if (!fs.existsSync(this._catalogPath)) {
      return;
    }

    const matches = await glob.glob('**/*.md', {
      cwd: this._catalogPath,
      absolute: true,
      nodir: true,
    });

    for (const localPath of matches) {
      try {
        const content = await fs.promises.readFile(localPath, 'utf8');
        const { frontmatter } = parseMarkdown(content);
        if (frontmatter) {
          const entry = yaml.parse(frontmatter);
          if (entry && entry.name) {
            this._index.set(entry.name, localPath);
          }
        }
      }
      catch (err) {
        // Skip unreadable/invalid files during indexing
      }
    }
  }

  entryExists(name: string): boolean {
    const entryPath = this._index.get(name);
    return !!entryPath && fs.existsSync(entryPath);
  }

  listEntries(): string[] {
    return Array.from(this._index.keys());
  }

  async loadEntry(name: string): Promise<md.Entry> {
    const entryPath = this._index.get(name);
    if (!entryPath || !fs.existsSync(entryPath)) {
      throw new Error(`Entry not found: ${name}`);
    }
    const content = await fs.promises.readFile(entryPath, 'utf8');
    const { frontmatter, body } = parseMarkdown(content);

    if (!frontmatter) {
      throw new Error(`Missing YAML frontmatter in Markdown file: ${entryPath}`);
    }
    const entry = yaml.parse(frontmatter) as md.Entry;
    
    const bodyTrimmed = body.trim();
    if (bodyTrimmed) {
      if (!entry.aspects) {
        entry.aspects = {};
      }
      if (!entry.aspects[OVERVIEW_ASPECT_KEY]) {
        entry.aspects[OVERVIEW_ASPECT_KEY] = {};
      }
      entry.aspects[OVERVIEW_ASPECT_KEY].content = bodyTrimmed;
      entry.aspects[OVERVIEW_ASPECT_KEY].contentType = 'MARKDOWN';
    }
    return entry;
  }

  async saveEntry(name: string, entry: md.Entry): Promise<void> {
    const entryPath = path.join(this._catalogPath, `${name}.md`);
    await fs.promises.mkdir(path.dirname(entryPath), { recursive: true });

    // Clone to avoid mutating original entry aspects
    const clonedEntry = JSON.parse(JSON.stringify(entry)) as md.Entry;
    let body = '';

    if (clonedEntry.aspects?.[OVERVIEW_ASPECT_KEY]) {
      const aspect = clonedEntry.aspects[OVERVIEW_ASPECT_KEY];
      if (aspect.content !== undefined) {
        body = aspect.content;
        delete aspect.content;
        delete aspect.contentType;
      }
    }

    const fileContent = toMarkdown(clonedEntry, body);

    await fs.promises.writeFile(entryPath, fileContent, 'utf8');
    this._index.set(name, entryPath);
  }

  async deleteEntry(name: string): Promise<void> {
    const entryPath = this._index.get(name);
    if (!entryPath || !fs.existsSync(entryPath)) {
      throw new Error(`Entry not found: ${name}`);
    }

    await fs.promises.unlink(entryPath);
    this._index.delete(name);
  }
}

export function parseMarkdown(content: string): { frontmatter: string; body: string } {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== '---') {
    return { frontmatter: '', body: content };
  }
  const endIndex = lines.indexOf('---', 1);
  if (endIndex === -1) {
    return { frontmatter: '', body: content };
  }

  const frontmatter = lines.slice(1, endIndex).join('\n');
  const body = lines.slice(endIndex + 1).join('\n');

  return { frontmatter, body };
}

export function toMarkdown(entry: md.Entry, content: string): string {
  const frontmatter = yaml.stringify(entry).trim();
  return `---\n${frontmatter}\n---\n${content}`;
}
