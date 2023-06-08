import { Database as SqliteDatabase, OPEN_READWRITE, RunResult, Statement as SqliteStatement, OPEN_FULLMUTEX, OPEN_CREATE } from "sqlite3";
import { wrapper } from "./util";
import { EventEmitter } from "stream";
import { Statement } from "./statement";

export class Database extends EventEmitter {
  readonly _database: SqliteDatabase;

  constructor(fileName: ":memory:", mode?: number, callback?: (e: Error | null) => void);
  constructor(fileName: ":memory:", callback?: (e: Error | null) => void);
  constructor(fileName: string, mode?: number, callback?: (e: Error | null) => void);
  constructor(fileName: string, callback?: (e: Error | null) => void);
  constructor(fileName: string, mode?: number | ((e: Error | null) => void), callback?: (e: Error | null) => void) {
    super();

    if (typeof mode === "function") {
      callback = mode;
      mode = OPEN_READWRITE | OPEN_CREATE | OPEN_FULLMUTEX;
    }
    mode ??= OPEN_READWRITE | OPEN_CREATE | OPEN_FULLMUTEX;
    callback ??= () => {};
    this._database = new SqliteDatabase(fileName, mode, callback);
    const oldEmit = this._database.emit.bind(this._database);
    this._database.emit = (event: string, listener: (...args: any[]) => void) => {
      this.emit(event, listener);
      return oldEmit(event, listener);
    };
  }

  close() {
    return wrapper<void>(cb => this._database.close(cb));
  }

  async serialize() {
    await wrapper<void>(cb => this._database.serialize(cb as () => void));
  }

  async parallelize() {
    await wrapper<void>(cb => this._database.parallelize(cb as () => void));
  }

  async run(sql: string, params: unknown[] = []) {
    await wrapper<void>(cb => this._database.run(sql, params, cb));
    return this;
  }

  async get<T>(sql: string, params: unknown[] = []) {
    return await wrapper<T>(cb => this._database.get<T>(sql, params, cb));
  }

  async all<T>(sql: string, params: unknown[] = []) {
    return await wrapper<T[]>(cb => this._database.all<T>(sql, params, cb));
  }

  async exec(sql: string) {
    await wrapper<void>(cb => this._database.exec(sql, cb));
  }

  each<T>(sql: string, params: unknown[] = []) {
    const emitter = new EventEmitter();
    const queue: T[] = [];
    let end = false;
    const iterator: AsyncIterator<T> = {
      async next(): Promise<IteratorResult<T>> {
        if (end)
          return {
            done: true,
            value: null
          };
        if (queue.length === 0)
          await new Promise(resolve => {
            emitter.once("row", resolve);
            emitter.once("end", resolve);
          });
        return !end
          ? {
              value: queue.shift()!
            }
          : {
              done: true,
              value: null
            };
      }
    };

    this._database.each<T>(
      sql,
      params,
      (e, row) => {
        if (e) throw e;
        queue.push(row);
        emitter.emit("row");
      },
      e => {
        if (e) throw e;
        end = true;
        emitter.emit("end");
      }
    );

    return iterator;
  }

  prepare(sql: string): Statement;
  prepare(sql: string, params?: any): Statement {
    const stmnt = this._database.prepare(sql, params);
    return new Statement(stmnt);
  }

  configure(option: "busyTimeout", value: number): void;
  configure(option: "limit", id: number, value: number): void;
  configure(...a: [string, ...([number, number] | [number])]) {
    //@ts-expect-error not tuple
    this._database.configure(...a);
  }

  on(event: "trace", listener: (sql: string) => void): this;
  on(event: "profile", listener: (sql: string, time: number) => void): this;
  on(event: "change", listener: (type: string, database: string, table: string, rowid: number) => void): this;
  on(event: "error", listener: (err: Error) => void): this;
  on(event: "open" | "close", listener: () => void): this;
  on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  async loadExtension(filename: string) {
    await wrapper<void>(cb => this._database.loadExtension(filename, cb));
  }

  interrupt() {
    this._database.interrupt();
  }
}
