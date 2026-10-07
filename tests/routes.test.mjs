import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, PHYSICS } from '../dist/src/engine.js';
import { PADS } from '../dist/src/world.js';
const dt = 1/120;
function seek(game, x, y, landId = null) {
  const gear = landId !== null;
  if (game.ship.gear !== gear) game.toggleGear();
  for (let i = 0; i < 3600; i++) {
    const s = game.ship, dx = x - s.x, dy = y - s.y;
    const desiredX = Math.max(-110, Math.min(110, dx * 1.5));
    const desiredY = Math.max(-100, Math.min(55, (gear ? dy + 15 : dy) * 1.4));
    const controls = { left: !gear && s.vx > desiredX + .6, right: !gear && s.vx < desiredX - .6, up: s.vy > desiredY, down: false };
    game.step(dt, controls);
    if (game.phase !== 'playing') throw Error(`${game.events.at(-1)?.message} heading to ${x},${y}; ship ${JSON.stringify(s)}`);
    if (landId !== null && s.landed === landId) return;
    if (landId === null && Math.abs(dx) < 1.5 && Math.abs(dy) < 1.5 && Math.abs(s.vx) < 3 && Math.abs(s.vy) < 3) return;
  }
  throw Error(`Navigation timeout to ${x},${y}; ${JSON.stringify(game.ship)}`);
}
for (let target=1; target<=5; target++) test(`Fly top center → restaurant → pad ${target} → restaurant without teleporting or losing a life`, () => {
  const game = new Game(() => (target - .5)/5); game.start('casual');
  for (let i = 0; i < 360; i++) game.step(dt, { up: false, down: false, left: false, right: false });
  // Move clear of the observatory before descending toward the restaurant.
  seek(game,640,125); seek(game,428,125); seek(game,428,450); seek(game,428,538,0);
  for(let i=0;i<3600 && !game.order;i++) game.step(dt,{up:false,down:false,left:false,right:false});
  if(game.order.target !== target) throw Error('Unexpected destination');
  for(let i=0;i<60;i++) game.step(dt,{up:true,down:false,left:false,right:false});
  seek(game,428,125);
  const pad=PADS.find(p=>p.id===target), px=pad.x+pad.width/2;
  if(target===5) { seek(game,1248,125); seek(game,1248,520); seek(game,px,520); }
  else seek(game,px,Math.min(125,pad.y-100));
  seek(game,px,pad.y-PHYSICS.footY,target);
  for(let i=0;i<120;i++) game.step(dt,{up:false,down:false,left:false,right:false});
  if(game.delivered!==1 || game.lives!==3) throw Error('Delivery did not complete');
  for(let i=0;i<60;i++) game.step(dt,{up:true,down:false,left:false,right:false});
  if(target===5) { seek(game,px,520); seek(game,1248,520); seek(game,1248,125); }
  else seek(game,px,125);
  seek(game,428,125); seek(game,428,538,0);
  for(let i=0;i<120;i++) game.step(dt,{up:false,down:false,left:false,right:false});
  assert.equal(game.lives, 3);
  assert.equal(game.delivered, 1);
  assert.ok(game.bank > 0);
  assert.ok(game.order, 'The restaurant loads another order after the round trip');
});
