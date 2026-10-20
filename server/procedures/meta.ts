import * as meta from '../repo/meta'
import type { Handler } from './support'
import { argString } from './support'
import type { ProcedureName } from '@/data/contract'

export const handlers: Partial<Record<ProcedureName, Handler>> = {
  'meta.getAll': (ctx) => meta.getAll(ctx.db),

  'meta.set': (ctx, args) => {
    const key = argString(args, 0, 'key')
    const value = argString(args, 1, 'value')
    meta.set(ctx.db, key, value)
    return null
  },
}
