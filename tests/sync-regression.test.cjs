const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = fs.readFileSync(path.resolve(__dirname, '../js/training-planner-core.js'), 'utf8');

test('workout sync queue is only cleared when the acknowledged revision still matches', () => {
  assert.match(core, /function clearWorkoutSyncQueue\(date,expectedUpdatedAt=null\)/);
  assert.match(core, /queued\.updatedAt!==expectedUpdatedAt\)return false/);
  assert.match(core, /clearWorkoutSyncQueue\(row\.date,row\.updated_at\)/);
  assert.match(core, /clearWorkoutSyncQueue\(saveKey,updatedAt\)/);
  assert.match(core, /clearWorkoutSyncQueue\(key,updatedAt\)/);
});

test('rapid edits receive monotonic per-day revisions and stale failures cannot replace newer queue entries', () => {
  assert.match(core, /function nextWorkoutUpdatedAt\(key\)/);
  assert.match(core, /previous\+1/);
  assert.match(core, /priorTime>nextTime\)return/);
});

test('sync does not clear a pending revision without matching it to the local revision', () => {
  assert.match(core, /if\(!upload\.some\(row=>row\.date===date\)\)\{const meta=readWorkoutMeta\(date\);if\(meta\?\.updatedAt\)clearWorkoutSyncQueue\(date,meta\.updatedAt\)\}/);
});
