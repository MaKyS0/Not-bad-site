/**
 * Tool Registry: binds catalog metadata to lazily loaded implementation modules.
 *
 * Every *.ts file in a category folder (except catalog.ts and lib/ helpers) is
 * a candidate component. Vite turns each into its own chunk, so opening a tool
 * only downloads the code that tool needs.
 */
import type { ToolMeta, ToolModule } from './types';
import { TOOLS, toolById } from './catalog';

const modules = import.meta.glob<ToolModule>(['./*/*.ts', '!./*/catalog.ts', '!./types.ts']);

export interface RegisteredTool extends ToolMeta {
  load: () => Promise<ToolModule>;
}

function bind(meta: ToolMeta): RegisteredTool {
  const key = `./${meta.component}.ts`;
  const loader = modules[key];
  return {
    ...meta,
    load: async () => {
      if (!loader) throw new Error(`Tool module not found: ${meta.component}`);
      return loader();
    },
  };
}

export const registry: RegisteredTool[] = TOOLS.map(bind);

export function getTool(id: string): RegisteredTool | undefined {
  const meta = toolById(id);
  return meta ? bind(meta) : undefined;
}

/** Used by tests/dev checks: every catalog entry must point at an existing module. */
export function missingModules(): string[] {
  return TOOLS.filter((t) => !modules[`./${t.component}.ts`]).map((t) => t.id);
}
