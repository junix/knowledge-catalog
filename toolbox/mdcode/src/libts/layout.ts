// Defines the Catalog metadata layout abstraction.
//

import * as md from './metadata';
import * as src from './source';
import { StandardLayout } from './layouts/standard';
import { DocumentsLayout } from './layouts/documents';

export enum Layouts {
  STANDARD = 'standard',
  DOCUMENTS = 'documents'
}


export interface CatalogLayout {
  init(): Promise<void>;

  entryExists(name: string): boolean;
  listEntries(): string[];
  loadEntry(name: string): Promise<md.Entry>;
  saveEntry(name: string, entry: md.Entry): Promise<void>;
  deleteEntry(name: string): Promise<void>;
}


export function createLayout(layout: Layouts,
                             catalogPath: string,
                             source: src.CatalogSource): CatalogLayout {
  switch (layout) {
    case Layouts.STANDARD:
      return new StandardLayout(catalogPath, source);
    case Layouts.DOCUMENTS:
      return new DocumentsLayout(catalogPath, source);
    default:
      throw new Error(`Unknown layout type: ${layout}`);
  }
}
