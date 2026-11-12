const assert = require('assert');
const Awards = require('../js/awards.js');
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('✓ ' + name); }
function p(o) { return Object.assign({ name: 'x', emoji: '🙂', avatar: 0, color: '#888', isBot: false, gone: false, kills: 0, pct: 0, deaths: 0 }, o); }

test('two rounds: kills, pct and deaths sum; rounds==2', function () {
  var t = Awards.empty();
  t = Awards.addRound(t, [p({ key: 'a', name: 'א', emoji: '🦊', kills: 2, pct: 15.5, deaths: 1 })]);
  t = Awards.addRound(t, [p({ key: 'a', name: 'א', emoji: '🦊', kills: 3, pct: 10.2, deaths: 0 })]);
  assert.equal(t.a.kills, 5);
  assert.equal(t.a.pct, 25.7);
  assert.equal(t.a.deaths, 1);
  assert.equal(t.a.rounds, 2);
});

test('ties: shared kills king and shared territory king', function () {
  var t = Awards.addRound(Awards.empty(), [
    p({ key: 'a', name: 'א', emoji: '🦊', kills: 5, pct: 20, deaths: 1 }),
    p({ key: 'b', name: 'ב', emoji: '🐯', kills: 5, pct: 20, deaths: 1 })
  ]);
  var aw = Awards.awards(Awards.present(t, ['a', 'b']));
  assert.equal(aw.kills.length, 2);
  assert.equal(aw.territory.length, 2);
  assert.equal(aw.double.length, 2);
});

test('double champ stays in both king lists plus double', function () {
  var t = Awards.addRound(Awards.empty(), [
    p({ key: 'a', name: 'א', emoji: '🦊', kills: 10, pct: 50, deaths: 0 }),
    p({ key: 'b', name: 'ב', emoji: '🐯', kills: 2, pct: 10, deaths: 1 })
  ]);
  var aw = Awards.awards(Awards.present(t, ['a', 'b']));
  assert.equal(aw.kills.length, 1); assert.equal(aw.kills[0].key, 'a');
  assert.equal(aw.territory.length, 1); assert.equal(aw.territory[0].key, 'a');
  assert.equal(aw.double.length, 1); assert.equal(aw.double[0].key, 'a');
  assert.equal(aw.undefeated.length, 1); assert.equal(aw.undefeated[0].key, 'a');
});

test('undefeated: several people; hidden when nobody has 0 deaths', function () {
  var t = Awards.addRound(Awards.empty(), [
    p({ key: 'a', kills: 1, pct: 10, deaths: 0 }),
    p({ key: 'b', kills: 1, pct: 10, deaths: 0 }),
    p({ key: 'c', kills: 1, pct: 10, deaths: 2 })
  ]);
  var aw = Awards.awards(Awards.present(t, ['a', 'b', 'c']));
  assert.equal(aw.undefeated.length, 2);
  t = Awards.addRound(t, [
    p({ key: 'a', kills: 0, pct: 8, deaths: 1 }),
    p({ key: 'b', kills: 0, pct: 8, deaths: 1 }),
    p({ key: 'c', kills: 0, pct: 8, deaths: 1 })
  ]);
  aw = Awards.awards(Awards.present(t, ['a', 'b', 'c']));
  assert.equal(aw.undefeated.length, 0);
});

test('mid-join: only rounds played are accumulated', function () {
  var t = Awards.addRound(Awards.empty(), [p({ key: 'a', kills: 2, pct: 10, deaths: 0 })]);
  t = Awards.addRound(t, [
    p({ key: 'a', kills: 1, pct: 5, deaths: 0 }),
    p({ key: 'b', name: 'ב', kills: 3, pct: 20, deaths: 1 })
  ]);
  assert.equal(t.a.rounds, 2); assert.equal(t.a.kills, 3); assert.equal(t.a.pct, 15);
  assert.equal(t.b.rounds, 1); assert.equal(t.b.kills, 3); assert.equal(t.b.pct, 20);
});

test('lobby reset: empty() clears previous totals and awards', function () {
  var t = Awards.addRound(Awards.empty(), [p({ key: 'a', kills: 4, pct: 30, deaths: 0 })]);
  t = Awards.empty();
  var list = Awards.present(t, ['a']);
  var aw = Awards.awards(list);
  assert.deepEqual(t, {});
  assert.deepEqual(list, []);
  assert.deepEqual(aw, { kills: [], territory: [], double: [], undefeated: [] });
});

test('gone player: totals kept, not listed, not awarded; remaining player gets the king', function () {
  var t = Awards.addRound(Awards.empty(), [
    p({ key: 'a', name: 'א', emoji: '🦊', kills: 10, pct: 50, deaths: 0 }),
    p({ key: 'b', name: 'ב', emoji: '🐯', kills: 3, pct: 12, deaths: 1 })
  ]);
  assert.ok(t.a && t.a.kills === 10);
  var list = Awards.present(t, ['b']);
  assert.equal(list.length, 1); assert.equal(list[0].key, 'b');
  var aw = Awards.awards(list);
  assert.equal(aw.kills.length, 1); assert.equal(aw.kills[0].key, 'b');
  assert.equal(aw.territory.length, 1); assert.equal(aw.territory[0].key, 'b');
  assert.equal(aw.double.length, 1); assert.equal(aw.double[0].key, 'b');
});

test('all-zero kills: omit kills king; territory still awarded', function () {
  var aw = Awards.awards(Awards.present(Awards.addRound(Awards.empty(), [
    p({ key: 'a', kills: 0, pct: 15, deaths: 0 })
  ]), ['a']));
  assert.equal(aw.kills.length, 0);
  assert.equal(aw.territory.length, 1);
  assert.equal(aw.double.length, 0);
  assert.equal(aw.undefeated.length, 1);
});

test('all-zero territory: omit territory king', function () {
  var aw = Awards.awards(Awards.present(Awards.addRound(Awards.empty(), [
    p({ key: 'a', kills: 2, pct: 0, deaths: 0 })
  ]), ['a']));
  assert.equal(aw.kills.length, 1);
  assert.equal(aw.territory.length, 0);
  assert.equal(aw.double.length, 0);
});

test('bots included in totals and awards', function () {
  var t = Awards.addRound(Awards.empty(), [
    p({ key: 'bot:0', name: 'שועל 🤖', emoji: '🦊', isBot: true, kills: 4, pct: 30, deaths: 0 })
  ]);
  assert.equal(t['bot:0'].isBot, true);
  var aw = Awards.awards(Awards.present(t, ['bot:0']));
  assert.equal(aw.kills[0].key, 'bot:0');
  assert.equal(aw.territory[0].key, 'bot:0');
  assert.equal(aw.double[0].key, 'bot:0');
  assert.equal(aw.undefeated[0].key, 'bot:0');
});

test('same key continues totals; a new key starts fresh', function () {
  var t = Awards.addRound(Awards.empty(), [p({ key: 'peer-a', kills: 2, pct: 10, deaths: 1 })]);
  t = Awards.addRound(t, [
    p({ key: 'peer-a', kills: 1, pct: 5, deaths: 0 }),
    p({ key: 'peer-b', name: 'חדש', kills: 3, pct: 12, deaths: 0 })
  ]);
  assert.equal(t['peer-a'].kills, 3); assert.equal(t['peer-a'].rounds, 2); assert.equal(t['peer-a'].deaths, 1);
  assert.equal(t['peer-b'].kills, 3); assert.equal(t['peer-b'].rounds, 1); assert.equal(t['peer-b'].deaths, 0);
});

test('duplicate key in one entries array is one round; kills/deaths merge, pct from the live entry', function () {
  var t = Awards.addRound(Awards.empty(), [
    p({ key: 'a', name: 'א', emoji: '🦊', kills: 1, pct: 5, deaths: 1, gone: true }),
    p({ key: 'a', name: 'א', emoji: '🦊', kills: 2, pct: 10, deaths: 0, gone: false })
  ]);
  assert.equal(t.a.rounds, 1);
  assert.equal(t.a.kills, 3);
  assert.equal(t.a.deaths, 1);
  assert.equal(t.a.pct, 10);
});

test('pct float 10.1+10.2 === 20.3', function () {
  var t = Awards.addRound(Awards.empty(), [p({ key: 'a', pct: 10.1 })]);
  t = Awards.addRound(t, [p({ key: 'a', pct: 10.2 })]);
  assert.equal(t.a.pct, 20.3);
});

test('addRound does not mutate inputs', function () {
  var src = { a: { key: 'a', name: 'א', emoji: '🦊', avatar: 0, color: '#888', isBot: false, kills: 1, pct: 4, deaths: 0, rounds: 1 } };
  var entries = [p({ key: 'a', kills: 2, pct: 3, deaths: 1 })];
  var before = JSON.stringify(src), beforeE = JSON.stringify(entries);
  var out = Awards.addRound(src, entries);
  assert.equal(JSON.stringify(src), before);
  assert.equal(JSON.stringify(entries), beforeE);
  assert.equal(out.a.kills, 3);
  assert.equal(src.a.kills, 1);
});

console.log(checks + ' award tests passed');
