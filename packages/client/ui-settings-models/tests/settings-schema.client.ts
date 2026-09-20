import { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { SettingsSchemaService } from '@x1a0f3n9/dsh-client-ui-settings/src/client/schema.ts'
import { createSettingsSchemaOperations } from '../src/client/schema-operations.ts'

/**
 * Host `retryPolicy` is a union. A plain object schema defaults a missing
 * field to `{}`, then fails the required `mode` and blocks DeepSeek Apply.
 */
export const RetryPolicyConfig = Schema.union([
  Schema.object({
    mode: Schema.const('normal').required(),
    maxRetries: Schema.number().step(1).min(0),
    backoff: Schema.object({
      initialDelayMs: Schema.number(),
      maxDelayMs: Schema.number(),
    }),
  }),
  Schema.object({
    mode: Schema.const('always').required(),
    backoff: Schema.object({
      initialDelayMs: Schema.number(),
      maxDelayMs: Schema.number(),
    }),
  }),
])

/** Stateless schema operations used by settings-model component fixtures. */
export const settingsSchema = createSettingsSchemaOperations(new SettingsSchemaService(new Context()))
