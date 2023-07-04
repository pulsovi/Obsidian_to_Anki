import { AnkiConnectNote } from './interfaces/note-interface'
import { basename, extname } from 'path'
import { Converter } from 'showdown'
import type { CachedMetadata } from 'obsidian'
import * as c from './constants'

import showdownHighlight from 'showdown-highlight'

interface Link {
	/** The original text of the link */
	original: string
	/** The target string in the parsed link */
	target: string;
	/** The anchor string in the parsed link */
	anchor: string;
	/** The alias string in the parsed link */
	alias?: string;
	/** The title string in the parsed link */
	title?: string;
}

const ANKI_MATH_REGEXP:RegExp = /(\\\[[\s\S]*?\\\])|(\\\([\s\S]*?\\\))/g
const HIGHLIGHT_REGEXP:RegExp = /==(.*?)==/g

const MATH_REPLACE:string = "OBSTOANKIMATH"
const INLINE_CODE_REPLACE:string = "OBSTOANKICODEINLINE"
const DISPLAY_CODE_REPLACE:string = "OBSTOANKICODEDISPLAY"

const CLOZE_REGEXP:RegExp = /(?:(?<!{){(?:c?(\d+)[:|])?(?!{))((?:[^\n][\n]?)+?)(?:(?<!})}(?!}))/g

const IMAGE_EXTS: string[] = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg", ".tiff"]
const AUDIO_EXTS: string[] = [".wav", ".m4a", ".flac", ".mp3", ".wma", ".aac", ".webm"]

const PARA_OPEN:string = "<p>"
const PARA_CLOSE:string = "</p>"

let cloze_unset_num: number = 1

let converter: Converter = new Converter({
	simplifiedAutoLink: true,
	literalMidWordUnderscores: true,
	tables: true, tasklists: true,
	simpleLineBreaks: true,
	requireSpaceBeforeHeadingText: true,
	extensions: [showdownHighlight]
})

function escapeHtml(unsafe: string): string {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }

/** Convert Markdown to HTML */
export class FormatConverter {
	file_path: string
	file_cache: CachedMetadata
	vault_name: string
	detectedMedia: Set<string>

	constructor(file_cache: CachedMetadata, file_path: string, vault_name: string) {
		this.vault_name = vault_name
		this.file_cache = file_cache
		this.file_path = file_path
		this.detectedMedia = new Set()
	}

	getUrlFromLink(link: string, anchor?: string): string {
		const file = link || this.file_path
		anchor = anchor ? `#${anchor}` : ''
		return "obsidian://open?vault=" + encodeURIComponent(this.vault_name) + String.raw`&file=` + encodeURIComponent(`${file}${anchor}`)
	}

	format_note_with_url(note: AnkiConnectNote, url: string, field: string): void {
		note.fields[field] += '<br><a href="' + url + '" class="obsidian-link">Obsidian</a>'
	}

	format_note_with_frozen_fields(note: AnkiConnectNote, frozen_fields_dict: Record<string, Record<string, string>>): void {
		for (let field in note.fields) {
			note.fields[field] += frozen_fields_dict[note.modelName][field]
		}
	}

	obsidian_to_anki_math(note_text: string): string {
		return note_text.replace(
				c.OBS_DISPLAY_MATH_REGEXP, "\\[$1\\]"
		).replace(
			c.OBS_INLINE_MATH_REGEXP,
			"\\($1\\)"
		)
	}

	cloze_repl(_1: string, match_id: string, match_content: string): string {
		if (match_id == undefined) {
			let result = "{{c" + cloze_unset_num.toString() + "::" + match_content + "}}"
			cloze_unset_num += 1
			return result
		}
		let result = "{{c" + match_id + "::" + match_content + "}}"
		return result
	}

	curly_to_cloze(text: string): string {
		/*Change text in curly brackets to Anki-formatted cloze.*/
		text = text.replace(CLOZE_REGEXP, this.cloze_repl)
		cloze_unset_num = 1
		return text
	}

	getAndFormatMedias(note_text: string): string {
		if (!(this.file_cache.hasOwnProperty("embeds"))) {
			return note_text
		}
		for (let embed of this.file_cache.embeds) {
			if (note_text.includes(embed.original)) {
				this.detectedMedia.add(embed.link)
				if (AUDIO_EXTS.includes(extname(embed.link))) {
					note_text = note_text.replace(new RegExp(c.escapeRegex(embed.original), "g"), "[sound:" + basename(embed.link) + "]")
				} else if (IMAGE_EXTS.includes(extname(embed.link))) {
					note_text = note_text.replace(
						new RegExp(c.escapeRegex(embed.original), "g"),
						'<img src="' + basename(embed.link) + '" alt="' + embed.displayText + '">'
					)
				} else {
					console.warn("Unsupported extension: ", extname(embed.link))
				}
			}
		}
		return note_text
	}

	formatLinks(note_text: string): string {
		if (!(this.file_cache.hasOwnProperty("links"))) {
			return note_text
		}
		for (let cacheLink of this.file_cache.links) {
			const link = this.parseLink(cacheLink.original)
			const { original, target, anchor } = link
			const displayText = this.getLinkDisplayText(link)
			note_text = note_text.replace(new RegExp(c.escapeRegex(original), "g"), '<a href="' + this.getUrlFromLink(target, anchor) + '">' + displayText + "</a>")
		}
		return note_text
	}

	parseLink(original: string): Link {
		const linkRe = {
			wikilink: /^\[\[(?<target>[^[|#]*)(?:#(?<anchor>[^[|]*))?(?:\|(?<alias>[^\]]*))?\]\]$/u,
			mdlinkbr: /^\[(?<alias>(?:[^\]\\]|\\\]|\\[^\]])*)\]\(<(?<target>[^#>"]*)(?:#(?<anchor>[^>"]*))?(?: "(?<title>[^>]*)")?>\)$/u,
			mdlinkns: /^\[(?<alias>(?:[^\]\\]|\\\]|\\[^\]])*)\]\((?<target>[^ #\)]*)(?:#(?<anchor>[^\) ]*))?(?: "(?<title>[^>]*)")?\)$/u,
		}
		for (let re of Object.values(linkRe)) {
			const match = original.match(re)
			if (match) return { original, ...match.groups } as Link
		}
		throw new Error('Cannot parse this link: ' + original)
	}

	getLinkDisplayText (link: Link) {
		if (link.alias) return link.alias
		return `${link.target}${link.target && link.anchor ? ' > ' : ''}${link.anchor}`
	}

	censor(note_text: string, regexp: RegExp, mask: string): [string, string[]] {
		/*Take note_text and replace every match of regexp with mask, simultaneously adding it to a string array*/
		let matches: string[] = []
		for (let match of note_text.matchAll(regexp)) {
			matches.push(match[0])
		}
		return [note_text.replace(regexp, mask), matches]
	}

	decensor(note_text: string, mask:string, replacements: string[], escape: boolean): string {
		for (let replacement of replacements) {
			note_text = note_text.replace(
				mask, escape ? escapeHtml(replacement) : replacement
			)
		}
		return note_text
	}

	format(note_text: string, cloze: boolean, highlights_to_cloze: boolean): string {
		console.info('formatter.format', { note_text, cloze, highlights_to_cloze });
		note_text = this.obsidian_to_anki_math(note_text)
		//Extract the parts that are anki math
		let math_matches: string[]
		let inline_code_matches: string[]
		let display_code_matches: string[]
		const add_highlight_css: boolean = note_text.match(c.OBS_DISPLAY_CODE_REGEXP) ? true : false;
		[note_text, math_matches] = this.censor(note_text, ANKI_MATH_REGEXP, MATH_REPLACE);
		[note_text, display_code_matches] = this.censor(note_text, c.OBS_DISPLAY_CODE_REGEXP, DISPLAY_CODE_REPLACE);
		[note_text, inline_code_matches] = this.censor(note_text, c.OBS_CODE_REGEXP, INLINE_CODE_REPLACE);
		if (cloze) {
			if (highlights_to_cloze) {
				note_text = note_text.replace(HIGHLIGHT_REGEXP, "{$1}")
			}
			note_text = this.curly_to_cloze(note_text)
		}
		note_text = this.getAndFormatMedias(note_text)
		note_text = this.formatLinks(note_text)
		//Special for formatting highlights now, but want to avoid any == in code
		note_text = note_text.replace(HIGHLIGHT_REGEXP, String.raw`<mark>$1</mark>`)
		note_text = this.decensor(note_text, DISPLAY_CODE_REPLACE, display_code_matches, false)
		note_text = this.decensor(note_text, INLINE_CODE_REPLACE, inline_code_matches, false)
		note_text = converter.makeHtml(note_text)
		note_text = this.decensor(note_text, MATH_REPLACE, math_matches, true).trim()
		// Remove unnecessary paragraph tag - see ../tests/format.test.ts
		note_text = note_text.replace(/^<p>((?:[^<]|<[^p]|<p[^>])*)<\/p>$/u, '$1');
		if (add_highlight_css) {
			note_text = '<link href="' + c.CODE_CSS_URL + '" rel="stylesheet">' + note_text
		}
		return note_text
	}
}
