/* Aurora Hunt — the living sky.
 * A full-viewport WebGL fragment shader paints procedural aurora curtains and stars.
 * Curtain brightness follows the live Kp index, so the page background is itself a forecast.
 * Degrades to a static CSS gradient without WebGL, and to a single still frame
 * when the visitor prefers reduced motion. */
(() => {
  'use strict';
  const canvas = document.getElementById('sky');
  if (!canvas) return;
  const root = document.documentElement;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
  if (!gl) { root.classList.add('no-webgl'); return; }

  const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime, uPower, uScroll, uLight;
uniform vec3 uBg;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
}
float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 4; i++){ v += a * noise(p); p = p * 2.03 + vec2(11.3, 7.1); a *= .5; } return v; }

// One curtain: a slow wandering lower edge with fine vertical rays fading upward.
vec3 curtain(vec2 uv, float seed, float height, float gain){
  float t = uTime;
  float x = uv.x * 1.25 + seed * 9.7;
  float warp = fbm(vec2(x * .8 + t * .035, seed + t * .02));
  float base = height + (warp - .5) * .42 + sin(x * 1.7 + t * .06 + seed * 4.) * .04;
  float d = uv.y - base;
  float len = .2 + .42 * fbm(vec2(x * 1.6 - t * .03, seed * 3.1));
  float rays = .45 + .55 * noise(vec2(x * 26. + warp * 9., t * .22 + seed));
  rays *= .7 + .3 * noise(vec2(x * 90., seed + t * .5));
  float body = smoothstep(len, 0., d) * smoothstep(-.012, .004, d);
  float a = pow(body, 1.7) * rays * gain;
  float k = clamp(d / len, 0., 1.);
  vec3 col = mix(vec3(.16, 1., .52), vec3(.12, .78, .86), smoothstep(.2, .6, k));
  col = mix(col, vec3(.52, .32, 1.), smoothstep(.5, 1., k));
  col += vec3(1., .22, .5) * smoothstep(.1, 0., k) * .55 * uPower;
  return col * a;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = vec2(uv.x * uRes.x / uRes.y, uv.y + uScroll * .18);
  float fade = mix(1., .42, smoothstep(0., 1., uScroll));
  float g = (.5 + uPower) * fade;

  vec3 aur = curtain(p, 1., .34, g) + curtain(p * vec2(1.3, 1.) + 3., 2.3, .48, g * .75) + curtain(p * vec2(.8, 1.) - 5., 4.1, .58, g * .5);
  float glow = fbm(vec2(p.x * .7 + uTime * .01, 2.)) * smoothstep(.15, .7, uv.y) * smoothstep(1.15, .5, uv.y);
  aur += vec3(.05, .32, .24) * glow * g * .55;

  vec3 col;
  if (uLight > .5) {
    float a = clamp(dot(aur, vec3(.4)) * .9, 0., .6);
    vec3 ink = mix(vec3(.05, .55, .42), vec3(.42, .3, .8), smoothstep(.3, .9, uv.y + (aur.b - aur.g) * .4));
    col = mix(uBg, ink, a * .55);
  } else {
    vec2 sp = gl_FragCoord.xy / 2.4;
    vec2 cell = floor(sp);
    float star = step(.9965, hash(cell)) * smoothstep(.7, 0., length(fract(sp) - .5));
    star *= .55 + .45 * sin(uTime * (1. + hash(cell + 3.) * 2.5) + hash(cell + 7.) * 6.28);
    vec3 sky = uBg + vec3(.0, .012, .03) * uv.y;
    col = sky + vec3(.82, .88, 1.) * star * (1. - clamp(dot(aur, vec3(.6)), 0., 1.)) * fade + aur;
    col *= 1. - .35 * length(uv - .5);
  }
  col += (hash(gl_FragCoord.xy + uTime) - .5) / 128.; // dither away banding
  gl_FragColor = vec4(col, 1.);
}`;

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
  const program = gl.createProgram();
  if (!vs || !fs) { root.classList.add('no-webgl'); return; }
  gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { root.classList.add('no-webgl'); return; }
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = Object.fromEntries(['uRes', 'uTime', 'uPower', 'uScroll', 'uLight', 'uBg'].map((name) => [name, gl.getUniformLocation(program, name)]));

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let power = 0.3, targetPower = 0.3, scroll = 0, light = false, raf = 0, last = 0, clock = Math.random() * 600, scale = 0.7;
  let slowFrames = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * scale;
    const w = Math.max(2, Math.round(canvas.clientWidth * dpr)), hgt = Math.max(2, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== hgt) { canvas.width = w; canvas.height = hgt; gl.viewport(0, 0, w, hgt); }
  }
  function draw(now) {
    raf = 0;
    const dt = Math.min(0.1, (now - last) / 1000 || 0.016);
    last = now;
    if (!reduced.matches) clock += dt;
    power += (targetPower - power) * Math.min(1, dt * 0.8);
    // Adapt resolution if the GPU struggles.
    if (dt > 0.045) { slowFrames += 1; if (slowFrames > 20 && scale > 0.4) { scale -= 0.15; slowFrames = 0; resize(); } } else if (slowFrames > 0) slowFrames -= 1;
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uTime, clock);
    gl.uniform1f(U.uPower, power);
    gl.uniform1f(U.uScroll, scroll);
    gl.uniform1f(U.uLight, light ? 1 : 0);
    if (light) gl.uniform3f(U.uBg, 0.953, 0.937, 0.902); else gl.uniform3f(U.uBg, 0.016, 0.024, 0.047);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduced.matches && !document.hidden) raf = requestAnimationFrame(draw);
  }
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(draw); } };

  const syncTheme = () => { light = root.dataset.theme === 'light'; kick(); };
  window.addEventListener('resize', () => { resize(); kick(); }, { passive: true });
  window.addEventListener('scroll', () => { scroll = Math.min(1, window.scrollY / Math.max(1, window.innerHeight)); if (reduced.matches) kick(); }, { passive: true });
  document.addEventListener('visibilitychange', kick);
  document.addEventListener('aurora:theme', syncTheme);
  document.addEventListener('aurora:weather', (event) => {
    const kp = Number(event.detail?.kp);
    if (Number.isFinite(kp)) { targetPower = 0.12 + Math.min(9, Math.max(0, kp)) / 9 * 1.1; if (reduced.matches) { power = targetPower; kick(); } }
  });
  reduced.addEventListener?.('change', kick);
  canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); root.classList.add('no-webgl'); });

  resize();
  syncTheme();
  root.classList.add('has-sky');
})();
