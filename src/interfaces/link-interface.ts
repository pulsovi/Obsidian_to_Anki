export interface Link {
  /** The start position of the link text in the text */
  start: number

  /** The end position of the link text in the text */
  end: number

  /** The target string in the parsed link */
  target: string

  /** The anchor string in the parsed link */
  anchor: string

  /** The alias string in the parsed link */
  alias?: string

  /** The title string in the parsed link */
  title?: string

  /** Is the link embed link */
  isEmbed: boolean

  /** The full original link string */
  original: string
}
