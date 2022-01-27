import c from "ansi-colors"
import { reporter } from "./reporter"
import type { IArgs } from "./index"

/**
 * Parse arguments without considering position. Both cases should work the same:
 * - `npm init gatsby hello-world -y`
 * - `npm init gatsby -y hello-world`
 */
export function parseArgs(args: Array<string>): IArgs {
  const { flags, siteDirectory } = args.reduce(
    (sortedArgs, arg) => {
      switch (arg) {
        case `-y`:
          sortedArgs.flags.yes = true
          break
        case `-tsc`:
          sortedArgs.flags.ts = true
          break
        default:
          if (arg.startsWith(`-`)) {
            reporter.warn(
              c.yellow(`Found unknown argument "${arg}", ignoring.`)
            )
            break
          }
          sortedArgs.siteDirectory = arg
      }
      return sortedArgs
    },
    {
      flags: {
        yes: false,
        ts: false,
      },
      siteDirectory: ``,
    }
  )

  return {
    flags,
    siteDirectory,
  }
}
