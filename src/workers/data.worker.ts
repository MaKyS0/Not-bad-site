/// <reference lib="webworker" />
/** Data worker: parses/formats very large JSON off the main thread. */
import { exposeHandlers } from './rpc';
import { formatJson } from '../tools/data/lib/json';

exposeHandlers({
  async formatJson(p: { text: string; indent: number | '\t'; sortKeys: boolean; minify: boolean }) {
    return { value: formatJson(p.text, p) };
  },
});
