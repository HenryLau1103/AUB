import type { Validators } from './schema.js';

export interface ServerContext {
  root: string;
  validators: Validators;
}
