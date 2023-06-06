import { FormatConverter } from '../src/format';

test('format trim para', () => {
  const formatter = new FormatConverter({}, '', '');
  expect(formatter.format('<p>test1</p>', false, false)).toBe('test1');
});

test('format not trim consecutive para', () => {
  const formatter = new FormatConverter({}, '', '');
  expect(formatter.format('<p>test2</p><p>test2</p>', false, false)).toBe('<p>test2</p>\n<p>test2</p>');
});

test('format not trim wrapped tags', () => {
  const formatter = new FormatConverter({}, '', '');
  expect(formatter.format('<p>test3</p>test3<p>test3</p>', false, false))
    .toBe('<p>test3</p>\n<p>test3<p>test3</p></p>');
  expect(formatter.format('<p>test4<p>test4</p>test4<p>test4</p>test4</p>', false, false))
    .toBe('<p>test4<p>test4</p>test4<p>test4</p>test4</p>');
});
