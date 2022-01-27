import colors from "ansi-colors"
import { reporter } from "./reporter"

interface IArgs {
  flags: {
    yes: boolean
    ts: boolean
  }
  siteDirectory: string
}

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
            reporter.warn(`Found unknown argument "${arg}", ignoring.`)
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
