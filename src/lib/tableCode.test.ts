import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseTableCode } from './tableCode';

test('parseTableCode', () => {
  assert.equal(parseTableCode('https://poker-chips.expo.app/table/b7and'), 'B7AND');
  assert.equal(parseTableCode('https://poker-chips--abc123.expo.app/table/B7AND?x=1'), 'B7AND');
  assert.equal(parseTableCode('  E2V6C '), 'E2V6C');
  assert.equal(parseTableCode('https://example.com/'), null);
  assert.equal(parseTableCode('hello world'), null);
});
