import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

export interface SharedCollection {
  shareId: string;
  name: string;
  apiIds: string[];
  createdAt: string;
}

export class ApiVerseDatabase {
  readonly connection: DatabaseSync;

  constructor(databasePath = process.env.DATABASE_PATH ?? resolve(process.cwd(), 'backend/data/apiverse.sqlite')) {
    if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
    this.connection = new DatabaseSync(databasePath);
    this.connection.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS collections (
        share_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        api_ids TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        documentation_url TEXT NOT NULL,
        website_url TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        pricing_url TEXT,
        terms_url TEXT,
        tags_json TEXT NOT NULL,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS submissions_documentation_status
        ON submissions (documentation_url, status);
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        api_id TEXT NOT NULL,
        details TEXT NOT NULL,
        source_url TEXT,
        created_at TEXT NOT NULL
      );
    `);
  }

  createCollection(name: string, apiIds: string[]): SharedCollection {
    const collection: SharedCollection = {
      shareId: randomUUID(),
      name,
      apiIds,
      createdAt: new Date().toISOString(),
    };
    this.connection
      .prepare('INSERT INTO collections (share_id, name, api_ids, created_at) VALUES (?, ?, ?, ?)')
      .run(collection.shareId, collection.name, JSON.stringify(collection.apiIds), collection.createdAt);
    return collection;
  }

  getCollection(shareId: string): SharedCollection | undefined {
    const row = this.connection
      .prepare('SELECT share_id, name, api_ids, created_at FROM collections WHERE share_id = ?')
      .get(shareId) as { share_id: string; name: string; api_ids: string; created_at: string } | undefined;
    if (!row) return undefined;
    return {
      shareId: row.share_id,
      name: row.name,
      apiIds: JSON.parse(row.api_ids) as string[],
      createdAt: row.created_at,
    };
  }

  createSubmission(data: {
    name: string;
    documentationUrl: string;
    websiteUrl: string;
    category: string;
    description: string;
    pricingUrl: string | null;
    termsUrl: string | null;
    tags: string[];
    notes: string | null;
  }): { id: string; status: 'pending'; createdAt: string } {
    const submission = { id: randomUUID(), status: 'pending' as const, createdAt: new Date().toISOString() };
    this.connection
      .prepare(`INSERT INTO submissions
        (id, name, documentation_url, website_url, category, description, pricing_url, terms_url, tags_json, notes, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        submission.id,
        data.name,
        data.documentationUrl,
        data.websiteUrl,
        data.category,
        data.description,
        data.pricingUrl,
        data.termsUrl,
        JSON.stringify(data.tags),
        data.notes,
        submission.status,
        submission.createdAt,
      );
    return submission;
  }

  hasPendingSubmission(documentationUrl: string): boolean {
    return Boolean(
      this.connection
        .prepare("SELECT 1 FROM submissions WHERE documentation_url = ? AND status = 'pending' LIMIT 1")
        .get(documentationUrl),
    );
  }

  getSubmissionStatus(id: string): { id: string; status: string; createdAt: string } | undefined {
    const row = this.connection
      .prepare('SELECT id, status, created_at FROM submissions WHERE id = ?')
      .get(id) as { id: string; status: string; created_at: string } | undefined;
    return row ? { id: row.id, status: row.status, createdAt: row.created_at } : undefined;
  }

  createReport(data: { apiId: string; details: string; sourceUrl: string | null }): { id: string; createdAt: string } {
    const report = { id: randomUUID(), createdAt: new Date().toISOString() };
    this.connection
      .prepare('INSERT INTO reports (id, api_id, details, source_url, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(report.id, data.apiId, data.details, data.sourceUrl, report.createdAt);
    return report;
  }

  close(): void {
    this.connection.close();
  }
}
