import { DatabaseSync } from "node:sqlite";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ensure } from "../core/errors.js";

export class Store {
  db!: DatabaseSync;
  lockPath: string;
  private lockId = randomUUID();
  constructor(public directory: string) {
    mkdirSync(directory, { recursive: true });
    this.lockPath = path.join(directory, "process.lock");
    if (existsSync(this.lockPath)) {
      const lock = JSON.parse(readFileSync(this.lockPath, "utf8"));
      let alive = true;
      try {
        process.kill(lock.pid, 0);
      } catch (e: any) {
        if (e.code === "ESRCH") alive = false;
      }
      ensure(
        !alive,
        "project_locked",
        "Another process owns this review data directory",
        409,
      );
      unlinkSync(this.lockPath);
    }
    writeFileSync(
      this.lockPath,
      JSON.stringify({ pid: process.pid, id: this.lockId }),
      { flag: "wx", mode: 0o600 },
    );
    try {
      this.db = new DatabaseSync(path.join(directory, "review.sqlite"));
      const version = (this.db.prepare("PRAGMA user_version").get() as any)
        .user_version;
      ensure(
        version <= 1,
        "future_database",
        "This database requires a newer package",
      );
      this.db.exec(
        "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(kind,id)); CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, body TEXT NOT NULL, created INTEGER NOT NULL); PRAGMA user_version=1;",
      );
    } catch (e) {
      this.db!?.close();
      this.unlock();
      throw e;
    }
  }
  get<T = any>(kind: string, id: string): T | undefined {
    const r = this.db
      .prepare("SELECT body FROM records WHERE kind=? AND id=?")
      .get(kind, id) as any;
    return r ? JSON.parse(r.body) : undefined;
  }
  all<T = any>(kind: string): T[] {
    return this.db
      .prepare("SELECT body FROM records WHERE kind=? ORDER BY rowid")
      .all(kind)
      .map((r: any) => JSON.parse(r.body));
  }
  put<T extends { id: string }>(kind: string, value: T) {
    this.db
      .prepare(
        "INSERT INTO records VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET body=excluded.body",
      )
      .run(kind, value.id, JSON.stringify(value));
  }
  delete(kind: string, id: string) {
    this.db.prepare("DELETE FROM records WHERE kind=? AND id=?").run(kind, id);
  }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const v = fn();
      this.db.exec("COMMIT");
      return v;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  event(type: string, data: unknown) {
    this.db
      .prepare("INSERT INTO events(type,body,created) VALUES (?,?,?)")
      .run(type, JSON.stringify(data), Date.now());
  }
  cursor() {
    return Number(
      (
        this.db
          .prepare("SELECT coalesce(max(id),0) AS id FROM events")
          .get() as any
      ).id,
    );
  }
  events(cursor: number) {
    const min = Number(
      (
        this.db
          .prepare("SELECT coalesce(min(id),0) AS id FROM events")
          .get() as any
      ).id,
    );
    if (cursor > 0 && min > cursor + 1)
      return { resyncRequired: true, events: [], nextCursor: this.cursor() };
    const events = this.db
      .prepare("SELECT * FROM events WHERE id>? ORDER BY id LIMIT 500")
      .all(cursor)
      .map((r: any) => ({
        id: Number(r.id),
        type: r.type,
        data: JSON.parse(r.body),
        created: r.created,
      }));
    return {
      resyncRequired: false,
      events,
      nextCursor: events.at(-1)?.id ?? cursor,
    };
  }
  private unlock() {
    if (
      existsSync(this.lockPath) &&
      JSON.parse(readFileSync(this.lockPath, "utf8")).id === this.lockId
    )
      unlinkSync(this.lockPath);
  }
  close() {
    this.db.close();
    this.unlock();
  }
}
