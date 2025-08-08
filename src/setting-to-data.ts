import { PluginSettings, ParsedSettings } from './interfaces/settings-interface'
import { App } from 'obsidian'
import * as AnkiConnect from './anki'
import { ID_REGEXP_STR } from './note'
import { escapeRegex } from './constants'

/**
 * Converts raw plugin settings to a format usable by the rest of the application.
 *
 * This function is the main entry point for parameter transformation.
 * It is called when the plugin is initialized and whenever parameters are modified.
 *
 * @param app - The Obsidian App instance
 * @param settings - The raw plugin settings (interface PluginSettings)
 * @param fields_dict - Dictionary of available fields per note type
 * @returns A Promise resolved with the transformed parameters (interface ParsedSettings)
 */
export async function settingToData(
  app: App,
  settings: PluginSettings,
  fields_dict: Record<string, string[]>
): Promise<ParsedSettings> {
  let result: ParsedSettings = <ParsedSettings>{}

  //Some processing required
  result.vault_name = app.vault.getName()
  result.fields_dict = fields_dict
  result.custom_regexps = settings.CUSTOM_REGEXPS
  result.file_link_fields = settings.FILE_LINK_FIELDS
  result.context_fields = settings.CONTEXT_FIELDS
  result.folder_decks = settings.FOLDER_DECKS
  result.folder_tags = settings.FOLDER_TAGS
  result.template = {
    deckName: settings.Defaults.Deck,
    modelName: '',
    fields: {},
    options: {
      allowDuplicate: false,
      duplicateScope: 'deck',
    },
    tags: [settings.Defaults.Tag],
  }
  result.EXISTING_IDS = (await AnkiConnect.invoke('findNotes', { query: '' })) as number[]

  //RegExp section
  result.FROZEN_REGEXP = new RegExp(
    escapeRegex(settings.Syntax['Frozen Fields Line']) + String.raw` - (.*?):\n((?:[^\n][\n]?)+)`,
    'g'
  )
  result.DECK_REGEXP = new RegExp(
    String.raw`^` + escapeRegex(settings.Syntax['Target Deck Line']) + String.raw`(?:\n|: )(.*)`,
    'm'
  )
  result.TAG_REGEXP = new RegExp(
    String.raw`^` + escapeRegex(settings.Syntax['File Tags Line']) + String.raw`(?:\n|: )(.*)`,
    'm'
  )
  result.NOTE_REGEXP = new RegExp(
    String.raw`^` +
      escapeRegex(settings.Syntax['Begin Note']) +
      String.raw`\n([\s\S]*?\n)` +
      escapeRegex(settings.Syntax['End Note']),
    'gm'
  )
  result.INLINE_REGEXP = new RegExp(
    escapeRegex(settings.Syntax['Begin Inline Note']) +
      String.raw`(.*?)` +
      escapeRegex(settings.Syntax['End Inline Note']),
    'g'
  )
  result.EMPTY_REGEXP = new RegExp(
    escapeRegex(settings.Syntax['Delete Note Line']) + ID_REGEXP_STR,
    'g'
  )

  //Just a simple transfer
  result.curly_cloze = settings.Defaults.CurlyCloze
  result.highlights_to_cloze = settings.Defaults['CurlyCloze - Highlights to Clozes']
  result.add_file_link = settings.Defaults['Add File Link']
  result.comment = settings.Defaults['ID Comments']
  result.add_context = settings.Defaults['Add Context']
  result.add_obs_tags = settings.Defaults['Add Obsidian Tags']
  result.ignored_file_globs = settings.IGNORED_FILE_GLOBS ?? []

  result.markdown_format = settings.Defaults['Markdown Formatting']

  return result
}
