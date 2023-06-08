import EventEmitter from "events";
import { Statement as SqliteStatement } from "sqlite3";
import { wrapper } from "./util";

export class Statement extends EventEmitter {
  readonly _statement: SqliteStatement;
  constructor(statement?: SqliteStatement) {
    super();
    this._statement = statement || new SqliteStatement();
  }
  async bind(params: unknown[] = []) {
    await wrapper<void>(cb => this._statement.bind(...params, cb));
    return this;
  }

  async reset() {
    await wrapper<void>(cb => this._statement.reset(cb));
    return this;
  }

  async finalize() {
    await wrapper<void>(cb => this._statement.finalize(cb));
    return this;
  }

  async run(params: unknown[] = []) {
    await wrapper<void>(cb => this._statement.run(...params, cb));
    return this;
  }

  async get<T>(params: unknown[] = []) {
    return await wrapper<T>(cb => this._statement.get<T>(cb));
  }

  async all<T>(params: unknown[] = []) {
    return await wrapper<T[]>(cb => this._statement.all<T>(cb));
  }

  each<T>(params: unknown[] = []) {
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

    this._statement.each<T>(
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
}
