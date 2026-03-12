// useParserWorker.ts - Lazily instantiated singleton Comlink worker proxy for parser calls
import { wrap, type Remote } from 'comlink';
import type { ParserWorkerApi } from '../workers/parser.worker';

let _worker: Worker | null = null;
let _proxy: Remote<ParserWorkerApi> | null = null;

export function useParserWorker(): Remote<ParserWorkerApi> {
  if (!_proxy) {
    _worker = new Worker(new URL('../workers/parser.worker.ts', import.meta.url), { type: 'module' });
    _proxy = wrap<ParserWorkerApi>(_worker);
  }
  return _proxy;
}
