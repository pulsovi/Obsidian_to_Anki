/** Parse Markdown text */
import type { Link } from './interfaces/link-interface'

export class MdParser {
  private readonly content: string

  constructor (content: string) {
    this.content = content
  }

  public static parseLink (rawLink: string): Link {
    const wikilink = /(?<embed>!)?\[\[(?<target>[^[|#]*)(?:(?<anchor>#[^[|]*))?(?:\|(?<alias>[^\]]*))?\]\]/u
    const markdown = /(?<embed>!)?\[(?<alias>(?:[^\]\\]|\\\]|\\[^\]])*)\]\((?<target>[^ #\)]*)(?:(?<anchor>#[^\) ]*))?(?: "(?<title>[^>]*)")?\)/u
    const markdownWithBrackets = /(?<embed>!)?\[(?<alias>(?:[^\]\\]|\\\]|\\[^\]])*)\]\(<(?<target>[^#>"]*)(?:(?<anchor>#[^>"]*))?(?: "(?<title>[^>]*)")?>\)/u

    const match = rawLink.match(wikilink) ?? rawLink.match(markdownWithBrackets) ?? rawLink.match(markdown)
    if (!match) throw Object.assign(new Error('This string seem not to be a markdown link'), { details: [{ rawLink }]})

    const start = match.index || 0
    const end = start + match[0].length
    const { target, anchor, alias, title, embed } = match.groups
    return { target, anchor, alias, title, start, end, isEmbed: Boolean(embed) }
  }

  public getPortion (ref?: string | undefined): string {
    const refs = parsePortionRef(ref)
    if (!refs) return this.content
    if (refs.type === 'heading') {
      const headings = this.getHeadingLines()
        .map((headerString, id) => Object.assign(parseHeader(headerString), { position: id }))
      const candidates = headings.filter(heading => heading.slug === refs.id);
      const header = candidates.length <= 1 ? candidates[0] : candidates.reduce((ha, hb) => {
        if (!ha) return ha
        if (ha.level < hb.level) return ha
        if (hb.level < ha.level) return hb
        if (ha.position < hb.position) return ha
        return hb
      })
      if (!header) throw Object.assign(new Error(`Unable to find given header`), { details: [{ headings, ref, refs }] })
      const start = this.linePos(header.line).absolute + header.line.length
      const nextHeader = headings.find(headingItem => headingItem.position > header.position && headingItem.level <= header.level)
      const end = nextHeader ? this.linePos(nextHeader.line).absolute : Infinity
      const portion = this.content.slice(start, end).trim()
      console.log('getA', { ref, refs, headings, candidates, header, start, nextHeader, end, portion })
      if (!refs.subref) return portion
      return new MdParser(portion).getPortion(refs.subref)
    }
    throw new Error(`Unable to manage such ref ${JSON.stringify(refs)}`)
  }

  private getHeadings () {
    return this.getHeadingLines().map(parseHeader)
  }

  private getHeadingLines (): string[] {
    return this.content.split('\n').filter(line => (/^#+ /u).test(line))
  }

  /** find the position of given line in this.content */
  private linePos (line: string) {
    const lines = this.content.split('\n')
    const index = lines.indexOf(line)
    if (index === -1) throw Object.assign(new Error(`Unable to find given line`), [{ details: { content: this.content, line }}])
    const absolute = lines.slice(0, index).join('\n').length + (index ? 1 : 0)
    return { absolute, line: index, char: 0 }
  }
}

function parsePortionRef (ref?: string | undefined) {
  if (!ref) return null
  if (ref.startsWith('#')) {
    const type = 'heading'
    const id = ref.slice(1).replace(/[#|^].*$/u, '')
    const subref = ref.slice(1).replace(/^[^#|^]*/u, '')
    return { type, id, subref }
  }
  throw new Error(`Unable to parse this portion ref "${ref}"`)
}

function parseHeader (headerLine: string) {
  const match = headerLine.match(/^(?<level>#+) (?<text>.*)$/u)
  if (!match) throw new Error(`Unable to parse this header string "${headerLine}"`)
  const level = match.groups.level.length
  const { text } = match.groups
  const slug = text.replace(/\[|\||\]/gu, ' ').replace(/  /gu, ' ').trim()
  return { level, text, slug, line: headerLine }
}
