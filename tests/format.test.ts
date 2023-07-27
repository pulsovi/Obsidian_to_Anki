import type { App } from 'obsidian';

import { FormatConverter } from '../src/format';

const app = {} as unknown as App;

test('format trim para', () => {
  const formatter = new FormatConverter({}, '', '');
  expect(formatter.format({
    note_text: '<p>test1</p>',
    cloze: false,
    highlights_to_cloze: false,
    app,
  })).toBe('test1');
});

test('format not trim consecutive para', () => {
  const formatter = new FormatConverter({}, '', '');
  expect(formatter.format({
    note_text: '<p>test2</p><p>test2</p>',
    cloze: false,
    highlights_to_cloze: false,
    app,
  })).toBe('<p>test2</p>\n<p>test2</p>');
});

test('format not trim wrapped tags', () => {
  const formatter = new FormatConverter({}, '', '');
  expect(formatter.format({
    note_text: '<p>test3</p>test3<p>test3</p>',
    cloze: false,
    highlights_to_cloze: false,
    app,
  }))
    .toBe('<p>test3</p>\n<p>test3<p>test3</p></p>');
  expect(formatter.format({
    note_text: '<p>test4<p>test4</p>test4<p>test4</p>test4</p>',
    cloze: false,
    highlights_to_cloze: false,
    app,
  }))
    .toBe('<p>test4<p>test4</p>test4<p>test4</p>test4</p>');
});

test('format trim paragraph with other tags inside it', () => {
  const formatter = new FormatConverter({}, '', '');
  expect(formatter.format({
    note_text: '<p><a href="foo">test1</a></p>',
    cloze: false,
    highlights_to_cloze: false,
    app,
  })).toBe('<a href="foo">test1</a>');
})
