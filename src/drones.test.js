const assert = require('node:assert/strict');
const test = require('node:test');
require('./drones.js');

const { optimize } = global.DroneOptimizer;

test('keeps useful drones in place and redeploys drones far from the new route', () => {
  const demand = {
    n: 3,
    nPath: 3,
    X: Float64Array.from([0, 1000, 2000]),
    Y: Float64Array.from([0, 0, 0]),
    W: Float64Array.from([10, 10, 10]),
    CAT: Uint8Array.from([0, 0, 0]),
    GI: Int32Array.from([0, 0, 0]),
    GJ: Int32Array.from([0, 0, 0]),
    step: 100
  };

  const result = optimize(
    demand,
    { small: 2, large: 0 },
    { small: 100, large: 200 },
    [
      { type: 'small', x: 0, y: 0 },
      { type: 'small', x: 100000, y: 100000 }
    ]
  );

  assert.equal(result.pilots.filter(({ status }) => status === 'maintained').length, 1);
  assert.equal(result.pilots.filter(({ status }) => status === 'redeployed').length, 1);
  assert.ok(result.pilots.some(({ status, x }) => status === 'maintained' && x === 0));
  assert.ok(result.pilots.some(({ status, x }) => status === 'redeployed' && x < 3000));
});

test('keeps locked drones at their chosen position and allows unlocked drones to move', () => {
  const demand = {
    n: 3,
    nPath: 3,
    X: Float64Array.from([0, 1000, 2000]),
    Y: Float64Array.from([0, 0, 0]),
    W: Float64Array.from([10, 10, 10]),
    CAT: Uint8Array.from([0, 0, 0]),
    GI: Int32Array.from([0, 0, 0]),
    GJ: Int32Array.from([0, 0, 0]),
    step: 100
  };

  const result = optimize(
    demand,
    { small: 2, large: 0 },
    { small: 100, large: 200 },
    [
      { id: 'locked-drone', type: 'small', x: 100000, y: 100000, locked: true },
      { id: 'movable-drone', type: 'small', x: 100000, y: 100000, locked: false }
    ]
  );

  const locked = result.pilots.find(({ id }) => id === 'locked-drone');
  const movable = result.pilots.find(({ id }) => id === 'movable-drone');
  assert.deepEqual([locked.x, locked.y], [100000, 100000]);
  assert.equal(locked.locked, true);
  assert.equal(movable.locked, false);
  assert.ok(movable.x < 3000);
});

test('rejects a fleet size smaller than its number of locked drones', () => {
  const demand = {
    n: 1,
    nPath: 1,
    X: Float64Array.from([0]),
    Y: Float64Array.from([0]),
    W: Float64Array.from([1]),
    CAT: Uint8Array.from([0]),
    GI: Int32Array.from([0]),
    GJ: Int32Array.from([0]),
    step: 100
  };

  assert.throws(
    () => optimize(demand, { small: 0, large: 0 }, undefined, [
      { type: 'small', x: 0, y: 0, locked: true }
    ]),
    /drones 1 km pour conserver tous les drones bloqués/
  );
});

test('moves an existing drone out of a disallowed sector and preserves its identity', () => {
  const demand = {
    n: 3,
    nPath: 3,
    X: Float64Array.from([0, 1000, 2000]),
    Y: Float64Array.from([0, 0, 0]),
    W: Float64Array.from([10, 10, 10]),
    CAT: Uint8Array.from([0, 0, 0]),
    GI: Int32Array.from([0, 0, 0]),
    GJ: Int32Array.from([0, 0, 0]),
    step: 100
  };

  const result = optimize(
    demand,
    { small: 1, large: 0 },
    { small: 100, large: 200 },
    [{ id: 'restricted-drone', type: 'small', x: 0, y: 0 }],
    (x) => x > 0
  );

  assert.equal(result.pilots.length, 1);
  assert.equal(result.pilots[0].id, 'restricted-drone');
  assert.equal(result.pilots[0].status, 'redeployed');
  assert.ok(result.pilots[0].x > 0);
});

test('rejects a locked drone in a disallowed sector', () => {
  const demand = {
    n: 2,
    nPath: 2,
    X: Float64Array.from([0, 1]),
    Y: Float64Array.from([0, 0]),
    W: Float64Array.from([1, 1]),
    CAT: Uint8Array.from([0, 0]),
    GI: Int32Array.from([0, 0]),
    GJ: Int32Array.from([0, 0]),
    step: 100
  };

  assert.throws(
    () => optimize(demand, { small: 1, large: 0 }, undefined, [
      { id: 'locked-drone', type: 'small', x: 0, y: 0, locked: true }
    ], (x) => x > 0),
    /TP bloqué se trouve dans un secteur inadapté/
  );
});
