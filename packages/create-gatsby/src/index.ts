import Enquirer from "enquirer"
import cmses from "./cmses.json"
import language from "./language.json"
import styles from "./styles.json"
import features from "./features.json"
import { initStarter, getPackageManager, gitSetup } from "./init-starter"
import { installPlugins } from "./install-plugins"
import c from "ansi-colors"
import path from "path"
import { plugin } from "./components/plugin"
import { makePluginConfigQuestions } from "./plugin-options-form"
import { center, wrap } from "./components/utils"
import { stripIndent } from "common-tags"
import { trackCli } from "./tracking"
import crypto from "crypto"
import { reporter } from "./reporter"
import { setSiteMetadata } from "./site-metadata"
import { makeNpmSafe } from "./utils"
import { parseArgs } from "./parse-args"
import { validateProjectName, generateQuestions } from "./questions"

const sha256 = (str: string): string =>
  crypto.createHash(`sha256`).update(str).digest(`hex`)

const md5 = (str: string): string =>
  crypto.createHash(`md5`).update(str).digest(`hex`)

/**
 * Hide string on windows (for emojis)
 */
const w = (input: string): string => (process.platform === `win32` ? `` : input)

const DEFAULT_STARTERS: Record<keyof typeof language, string> = {
  js: `https://github.com/gatsbyjs/gatsby-starter-minimal.git`,
  ts: `https://github.com/gatsbyjs/gatsby-starter-minimal-ts.git`, // TODO - Create
}

interface IAnswers {
  name: string
  project: string
  language: keyof typeof language
  styling?: keyof typeof styles
  cms?: keyof typeof cmses
  features?: Array<keyof typeof features>
}

/**
 * Interface for plugin JSON files
 */
interface IPluginEntry {
  /**
   * Message displayed in the menu when selecting the plugin
   */
  message: string
  /**
   * Extra NPM packages to install
   */
  dependencies?: Array<string>
  /**
   * Items are either the plugin name, or the plugin name and key, separated by a colon (":")
   * This allows duplicate entries for plugins such as gatsby-source-filesystem.
   */
  plugins?: Array<string>
  /**
   * Keys must match plugin names or name:key combinations from the plugins array
   */
  options?: PluginConfigMap
}

export type PluginMap = Record<string, IPluginEntry>

export type PluginConfigMap = Record<string, Record<string, unknown>>

export interface IArgs {
  flags: {
    yes: boolean
    ts: boolean
  }
  siteDirectory: string
}

export async function run(): Promise<void> {
  const { flags, siteDirectory } = parseArgs(process.argv.slice(2))

  trackCli(`CREATE_GATSBY_START`)

  const { version } = require(`../package.json`)

  reporter.info(c.grey(`create-gatsby version ${version}`))

  reporter.info(
    `


${center(c.blueBright.bold.underline(`Welcome to Gatsby!`))}


`
  )

  if (!flags.yes) {
    reporter.info(
      wrap(
        `This command will generate a new Gatsby site for you in ${c.bold(
          process.cwd()
        )} with the setup you select. ${c.white.bold(
          `Let's answer some questions:\n\n`
        )}`,
        process.stdout.columns
      )
    )
  }

  const enquirer = new Enquirer<IAnswers>()

  enquirer.use(plugin)

  let data
  let siteName
  if (!flags.yes) {
    ;({ name: siteName } = await enquirer.prompt({
      type: `textinput`,
      name: `name`,
      message: `What would you like to call your site?`,
      initial: `My Gatsby Site`,
      format: (value: string): string => c.cyan(value),
    } as any))

    data = await enquirer.prompt(
      generateQuestions(makeNpmSafe(siteName), flags.yes)
    )
  } else {
    const warn = await validateProjectName(siteDirectory)
    if (typeof warn === `string`) {
      reporter.warn(warn)
      return
    }
    siteName = siteDirectory
    data = await enquirer.prompt(
      generateQuestions(makeNpmSafe(siteDirectory), flags.yes)[0]
    )
  }

  data.project = data.project.trim()

  trackCli(`CREATE_GATSBY_SELECT_OPTION`, {
    name: `project_name`,
    valueString: sha256(data.project),
  })
  trackCli(`CREATE_GATSBY_SELECT_OPTION`, {
    name: `LANGUAGE`,
    valueString: sha256(data.project),
  })
  trackCli(`CREATE_GATSBY_SELECT_OPTION`, {
    name: `CMS`,
    valueString: data.cms || `none`,
  })
  trackCli(`CREATE_GATSBY_SELECT_OPTION`, {
    name: `CSS_TOOLS`,
    valueString: data.styling || `none`,
  })
  trackCli(`CREATE_GATSBY_SELECT_OPTION`, {
    name: `PLUGIN`,
    valueStringArray: data.features || [],
  })

  const messages: Array<string> = [
    `${w(`🛠  `)}Create a new Gatsby site in the folder ${c.magenta(
      data.project
    )}`,
  ]

  const plugins: Array<string> = []
  const packages: Array<string> = []
  let pluginConfig: PluginConfigMap = {}

  if (data.cms && data.cms !== `none`) {
    messages.push(
      `${w(`📚 `)}Install and configure the plugin for ${c.magenta(
        cmses[data.cms].message
      )}`
    )
    const extraPlugins = cmses[data.cms].plugins || []
    plugins.push(data.cms, ...extraPlugins)
    packages.push(
      data.cms,
      ...(cmses[data.cms].dependencies || []),
      ...extraPlugins
    )
    pluginConfig = { ...pluginConfig, ...cmses[data.cms].options }
  }

  if (data.styling && data.styling !== `none`) {
    messages.push(
      `${w(`🎨 `)}Get you set up to use ${c.magenta(
        styles[data.styling].message
      )} for styling your site`
    )
    const extraPlugins = styles[data.styling].plugins || []

    plugins.push(data.styling, ...extraPlugins)
    packages.push(
      data.styling,
      ...(styles[data.styling].dependencies || []),
      ...extraPlugins
    )
    pluginConfig = { ...pluginConfig, ...styles[data.styling].options }
  }

  if (data.features?.length) {
    messages.push(
      `${w(`🔌 `)}Install ${data.features
        ?.map((feat: string) => c.magenta(feat))
        .join(`, `)}`
    )
    plugins.push(...data.features)
    const featureDependencies = data.features?.map(featureKey => {
      const extraPlugins = features[featureKey].plugins || []
      plugins.push(...extraPlugins)
      return [
        // Spread in extra dependencies
        ...(features[featureKey].dependencies || []),
        // Spread in plugins
        ...extraPlugins,
      ]
    })
    const flattenedDependencies = ([] as Array<string>).concat.apply(
      [],
      featureDependencies
    ) // here until we upgrade to node 11 and can use flatMap

    packages.push(...data.features, ...flattenedDependencies)
    // Merge plugin options
    pluginConfig = data.features.reduce((prev, key) => {
      return { ...prev, ...features[key].options }
    }, pluginConfig)
  }

  const config = makePluginConfigQuestions(plugins)
  if (config.length) {
    reporter.info(
      `\nGreat! A few of the selections you made need to be configured. Please fill in the options for each plugin now:\n`
    )

    trackCli(`CREATE_GATSBY_SET_PLUGINS_START`)

    const enquirer = new Enquirer<Record<string, Record<string, unknown>>>()
    enquirer.use(plugin)

    pluginConfig = { ...pluginConfig, ...(await enquirer.prompt(config)) }

    trackCli(`CREATE_GATSBY_SET_PLUGINS_STOP`)
  }
  if (!flags.yes) {
    reporter.info(`

${c.bold(`Thanks! Here's what we'll now do:`)}

    ${messages.join(`\n    `)}
  `)

    const { confirm } = await new Enquirer<{ confirm: boolean }>().prompt({
      type: `confirm`,
      name: `confirm`,
      initial: `Yes`,
      message: `Shall we do this?`,
      format: value => (value ? c.greenBright(`Yes`) : c.red(`No`)),
    })

    if (!confirm) {
      trackCli(`CREATE_GATSBY_CANCEL`)

      reporter.info(`OK, bye!`)
      return
    }
  }

  await initStarter(
    DEFAULT_STARTERS[data.language || `js`],
    data.project,
    packages.map((plugin: string) => plugin.split(`:`)[0]),
    siteName
  )

  reporter.success(`Created site in ${c.green(data.project)}`)

  const fullPath = path.resolve(data.project)

  if (plugins.length) {
    reporter.info(`${w(`🔌 `)}Setting-up plugins...`)
    await installPlugins(plugins, pluginConfig, fullPath, [])
  }
  await setSiteMetadata(fullPath, `title`, siteName)

  await gitSetup(data.project)

  const pm = await getPackageManager()
  const runCommand = pm === `npm` ? `npm run` : `yarn`

  reporter.info(
    stripIndent`
    ${w(`🎉  `)}Your new Gatsby site ${c.bold(
      siteName
    )} has been successfully created
    at ${c.bold(fullPath)}.
    `
  )
  reporter.info(`Start by going to the directory with\n
  ${c.magenta(`cd ${data.project}`)}
  `)

  reporter.info(`Start the local development server with\n
  ${c.magenta(`${runCommand} develop`)}
  `)

  reporter.info(`See all commands at\n
  ${c.blueBright(`https://www.gatsbyjs.com/docs/gatsby-cli/`)}
  `)

  const siteHash = md5(fullPath)
  trackCli(`CREATE_GATSBY_SUCCESS`, { siteHash })
}

process.on(`exit`, exitCode => {
  trackCli(`CREATE_GATSBY_END`, { exitCode })

  if (exitCode === -1) {
    trackCli(`CREATE_GATSBY_ERROR`)
  }
})
