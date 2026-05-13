// Dataplex EntryGroup as Metadata Source
//

import * as gcp from '../gcp';


export class EntryGroupSource {
  readonly type: string;
  readonly name: string;
  readonly ingestedEntries: boolean;

  private readonly _name: string[];

  constructor(type: string, name: string) {
    this.type = type;
    this.name = name;
    this._name = name.split('.');
    this.ingestedEntries = this._name[2].startsWith('@');
  }

  async *entries(ctx: gcp.ApiContext): AsyncGenerator<gcp.Entry, void, unknown> {
    // Enumerate all entries in the EntryGroup

    const catalog = new gcp.CatalogClient(ctx);
    for await (const entry of catalog.listEntries(this._name[0], this._name[1], this._name[2])) {
      yield entry;
    }
  }

  localName(entry: gcp.Entry): string {
    // The local catalog uses the entry id as is

    const match = entry.name.match(/entryGroups\/([^/]+)\/entries\/(.+)$/);
    if (!match) {
      throw new Error(`Invalid entry name for EntryGroup: ${entry.name}`);
    }

    return match[2];
  }
}
