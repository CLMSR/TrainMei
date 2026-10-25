const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = fs.readFileSync(path.resolve(__dirname, '../js/training-planner-core.js'), 'utf8');

test('app startup does not rerun full bootstrap on token refresh or repeated auth events', () => {
  assert.match(core, /appInitializedUserId\s*===\s*currentUser\.id/);
  assert.match(core, /event==='SIGNED_IN'[\s\S]*session\?\.user\?\.id!==appInitializedUserId[\s\S]*startApp\(\)/);
  assert.doesNotMatch(core, /onAuthStateChange\(\(\)=>startApp\(\)\)/);
});

test('workout open remains in-app navigation and does not invoke page reload', () => {
  assert.match(core, /if\(act==='open-today'\)openDay\(todayKey\(\)\)/);
  assert.doesNotMatch(core, /location\.reload\s*\(/);
});
