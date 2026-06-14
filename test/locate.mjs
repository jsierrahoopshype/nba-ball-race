import MatterPkg from 'matter-js'; globalThis.Matter=MatterPkg;
const { createRNG } = await import('../js/rng.js');
const { buildCourse } = await import('../js/course.js');
const rng=createRNG(1124861776);
const course=buildCourse(rng);
// list obstacle bodies near the two trap y-bands
function near(ylo,yhi){
  const xs=course.bodies.filter(b=>b.position.y>ylo&&b.position.y<yhi&&b.label!=='wall');
  return xs.map(b=>`${b.label} @(${Math.round(b.position.x)},${Math.round(b.position.y)}) ang=${(b.angle).toFixed(2)}`);
}
console.log('--- bodies near y=2000-2350 (zigzag zone) ---');
console.log(near(2000,2350).slice(0,14).join('\n'));
console.log('\n--- bodies near y=4550-5150 (plinko zone) ---');
console.log(near(4550,5150).slice(0,16).join('\n'));
