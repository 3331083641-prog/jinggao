// Browser-only QA observer. Inspects the real R3F scene; never ships with the app.
export async function startHeroOrbitObservation(durationMs = 60000) {
  const url = performance.getEntriesByType('resource').map(r => r.name)
    .find(name => name.includes('/@react-three_fiber.js?'));
  if (!url) throw new Error('Live Vite/R3F module not found');
  const fiber = await import(url);
  const state = fiber._roots.get(document.querySelector('.three-hero canvas')).store.getState();
  const group = state.scene.getObjectByName('orbit-group');
  const meshes = [0, 1].map(i => state.scene.getObjectByName('orbit-nodes-' + i));
  const paths = [0, 1].map(i => state.scene.getObjectByName(i ? 'orbit-b' : 'orbit-a'));
  const tracks = paths.map(p => p.userData.curve);
  const point = tracks[0].getPointAt(0);
  const tube = paths.map(p => p.children.find(o => o.name === 'closed-orbit').geometry);
  const seams = tracks.map((curve, index) => {
    const position = tube[index].attributes.position;
    const ring = tube[index].parameters.radialSegments + 1;
    const last = position.count - ring;
    let tubeGap = 0;
    for (let i = 0; i < ring; i++) {
      tubeGap = Math.max(tubeGap, Math.hypot(position.getX(i)-position.getX(last+i),
        position.getY(i)-position.getY(last+i), position.getZ(i)-position.getZ(last+i)));
    }
    return {curveClosed: curve.closed, tubeClosed: tube[index].parameters.closed,
      positionGap: curve.getPointAt(0).distanceTo(curve.getPointAt(1)),
      tangentDot: curve.getTangentAt(0).dot(curve.getTangentAt(1)), tubeGap};
  });
  const start = performance.now(), startTime = group.userData.nodeTime;
  const startFrames = Number(document.querySelector('.three-hero').dataset.frames);
  const balls = meshes.flatMap((mesh, path) => mesh.userData.nodes.map((node, i) => ({
    path, i, phase: node.phase, period: node.period, samples: 0, wraps: 0,
    maxError: 0, maxStep: 0, maxStepRatio: 0, distance: 0, previous: null,
    previousPhase: null, previousTime: null,
  })));
  const report = {done:false, startedAt: new Date().toISOString(), durationMs,
    frames:0, seams, balls, errors:[], startTime, elapsedSceneSeconds:0, wallSeconds:0};
  window.__heroOrbitReport = report;
  function sample(now) {
    const time = group.userData.nodeTime;
    report.frames++;
    report.renderedFrames = Number(document.querySelector('.three-hero').dataset.frames)-startFrames;
    for (const ball of balls) {
      const array = meshes[ball.path].instanceMatrix.array, offset = ball.i * 16;
      const x = array[offset+12], y = array[offset+13], z = array[offset+14];
      const phase = (ball.phase + time / ball.period) % 1;
      tracks[ball.path].getPointAt(phase, point);
      ball.maxError = Math.max(ball.maxError, Math.hypot(x-point.x, y-point.y, z-point.z));
      if (ball.previous) {
        const step = Math.hypot(x-ball.previous[0], y-ball.previous[1], z-ball.previous[2]);
        const dt = time-ball.previousTime;
        if (dt > 0) {
          const allowed = tracks[ball.path].getLength() / ball.period * dt;
          ball.maxStepRatio = Math.max(ball.maxStepRatio, step / allowed);
        }
        ball.maxStep = Math.max(ball.maxStep, step);
        ball.distance += step;
        if (phase < ball.previousPhase) ball.wraps++;
      }
      ball.previous = [x,y,z]; ball.previousTime = time; ball.previousPhase = phase;
      ball.samples++;
    }
    report.wallSeconds = (now-start)/1000;
    report.elapsedSceneSeconds = time-startTime;
    if (report.wallSeconds*1000 >= durationMs && report.elapsedSceneSeconds >= 44) {
      report.done = true;
      report.averageFramesPerSecond = report.frames/report.wallSeconds;
      report.averageRenderedFramesPerSecond = report.renderedFrames/report.wallSeconds;
      for (const [i,seam] of seams.entries()) {
        if (!seam.curveClosed || !seam.tubeClosed || seam.positionGap>1e-8 ||
            seam.tubeGap>1e-6 || seam.tangentDot<.999) report.errors.push('Orbit '+i+' seam');
      }
      for (const ball of balls) {
        if (ball.maxError>1e-5 || ball.maxStepRatio>1.03 || ball.wraps<2 || ball.distance<5)
          report.errors.push('Ball '+ball.path+':'+ball.i+' motion');
      }
    } else if (report.wallSeconds > 120) {
      report.errors.push('Scene did not finish two cycles in 120 seconds'); report.done = true;
    } else requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
  return {started:true, sphereCount:balls.length, seams};
}
