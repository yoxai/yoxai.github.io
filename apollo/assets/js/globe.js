/* Apollo — interactive Earth in plain WebGL (no libraries).
   NASA Blue Marble day map, city lights on the night side, ocean glint, drifting clouds, an atmosphere rim,
   and glowing arcs from Islamabad to partner locations. Drag to turn it. */

const DEG = Math.PI / 180;

function mat4Persp(fov, asp, n, f) {
  const t = 1 / Math.tan(fov / 2), nf = 1 / (n - f);
  return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0];
}
function mul(a, b) { const o = new Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; }
function rotY(a) { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; }
function rotX(a) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; }
function trans(z) { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, z, 1]; }
function apply(m, v) { return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14], m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15]]; }
/* lat/lon → unit vector; u=0 at lon −180 so it matches an equirectangular texture */
function ll(lat, lon, r = 1) { const la = lat * DEG, lo = lon * DEG; return [r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo)]; }

export function globe(box, { textures, places, hq }) {
  const canvas = box.querySelector('canvas');
  const gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true });
  if (!gl) { box.classList.add('no-gl'); return null; }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(o)); return o; };
  const prog = (v, f) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, v)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, f)); gl.linkProgram(p); return p; };

  /* ---- sphere ---- */
  const LAT = 64, LON = 128, pos = [], uv = [], idx = [];
  for (let i = 0; i <= LAT; i++) {
    const v = i / LAT, la = (90 - v * 180) * DEG;
    for (let j = 0; j <= LON; j++) {
      const u = j / LON, lo = (u * 360 - 180) * DEG;
      pos.push(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)); uv.push(u, v);
    }
  }
  for (let i = 0; i < LAT; i++) for (let j = 0; j < LON; j++) { const a = i * (LON + 1) + j, b = a + LON + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const buf = (data, T = Float32Array, tgt = gl.ARRAY_BUFFER) => { const b = gl.createBuffer(); gl.bindBuffer(tgt, b); gl.bufferData(tgt, new T(data), gl.STATIC_DRAW); return b; };
  const bPos = buf(pos), bUv = buf(uv), bIdx = buf(idx, Uint16Array, gl.ELEMENT_ARRAY_BUFFER), nIdx = idx.length;

  const vsEarth = `attribute vec3 p;attribute vec2 t;uniform mat4 P,V;uniform float S;varying vec2 vT;varying vec3 vN,vW;
void main(){vec4 w=V*vec4(p*S,1.);vT=t;vN=mat3(V)*p;vW=w.xyz;gl_Position=P*w;}`;
  const fsEarth = `precision mediump float;uniform sampler2D D,N,W;uniform vec3 L;varying vec2 vT;varying vec3 vN,vW;
void main(){vec3 n=normalize(vN),v=normalize(-vW);float d=dot(n,L);
  float day=smoothstep(-.18,.32,d);
  vec3 c=texture2D(D,vT).rgb;c=pow(c,vec3(1.08))*1.12;
  vec3 lights=texture2D(N,vT).rgb;lights=pow(lights,vec3(1.6))*vec3(1.,.86,.62)*2.2;
  float w=texture2D(W,vT).r;
  vec3 hh=normalize(L+v);float spec=pow(max(dot(n,hh),0.),42.)*w*.65;
  vec3 col=c*(.06+.98*max(d,0.))*day+lights*(1.-day)+vec3(.55,.75,1.)*spec*day;
  float fr=pow(1.-max(dot(n,v),0.),3.);
  col+=vec3(.18,.52,1.)*fr*(.25+.95*smoothstep(-.3,.6,d));
  col=mix(col,col*vec3(.86,.93,1.08),.35);
  gl_FragColor=vec4(col,1.);}`;
  const fsCloud = `precision mediump float;uniform sampler2D C;uniform vec3 L;uniform float O;varying vec2 vT;varying vec3 vN,vW;
void main(){vec3 n=normalize(vN);float d=dot(n,L);float a=texture2D(C,vT+vec2(O,0.)).r;
  float lit=smoothstep(-.2,.5,d);gl_FragColor=vec4(vec3(.95,.98,1.)*lit*a*.85,a*.85*(.15+.85*lit));}`;
  const vsHalo = `attribute vec3 p;uniform mat4 P,V;uniform float S;varying vec3 vN,vW;
void main(){vec4 w=V*vec4(p*S,1.);vN=mat3(V)*p;vW=w.xyz;gl_Position=P*w;}`;
  const fsHalo = `precision mediump float;varying vec3 vN,vW;
void main(){vec3 n=normalize(vN),v=normalize(-vW);float f=1.-abs(dot(n,v));float a=pow(f,5.)*1.3;gl_FragColor=vec4(vec3(.25,.6,1.)*a,a);}`;
  const vsPts = `attribute vec3 p;attribute float k;uniform mat4 P,V;uniform float T,Z;varying float vA,vK;
void main(){vec4 w=V*vec4(p,1.);vec3 n=normalize(mat3(V)*normalize(p));float face=dot(n,normalize(-w.xyz));
  vK=k;float head=fract(k-T*.32);float pulse=smoothstep(.0,.06,head)*smoothstep(.22,.06,head);
  vA=smoothstep(-.08,.12,face)*(.28+1.6*pulse);gl_PointSize=Z*(1.3+2.4*pulse);gl_Position=P*w;}`;
  const fsPts = `precision mediump float;varying float vA,vK;
void main(){vec2 c=gl_PointCoord-.5;float d=length(c);float a=smoothstep(.5,.0,d)*vA;gl_FragColor=vec4(vec3(.55,.82,1.)*a+vec3(.4)*a*a,a);}`;
  const vsDot = `attribute vec3 p;attribute float s;uniform mat4 P,V;uniform float T,Z;varying float vA,vS;
void main(){vec4 w=V*vec4(p,1.);vec3 n=normalize(mat3(V)*normalize(p));float face=dot(n,normalize(-w.xyz));
  vA=smoothstep(-.02,.15,face);vS=s;gl_PointSize=Z*(s>1.5?11.:8.)*(1.+.25*sin(T*3.+p.x*9.));gl_Position=P*w;}`;
  const fsDot = `precision mediump float;varying float vA,vS;
void main(){float d=length(gl_PointCoord-.5);float core=smoothstep(.22,.1,d),ring=smoothstep(.5,.38,d)*smoothstep(.3,.42,d);
  vec3 c=vS>1.5?vec3(1.):vec3(.6,.85,1.);float a=(core+ring*.7)*vA;gl_FragColor=vec4(c*a,a);}`;

  const pE = prog(vsEarth, fsEarth), pC = prog(vsEarth, fsCloud), pH = prog(vsHalo, fsHalo), pP = prog(vsPts, fsPts), pD = prog(vsDot, fsDot);

  /* ---- arcs as luminous point trails ---- */
  const arcP = [], arcK = [];
  const A = ll(hq.lat, hq.lon);
  places.forEach((pl, pi) => {
    const B = ll(pl.lat, pl.lon), dot = Math.min(1, Math.max(-1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])), om = Math.acos(dot), N = Math.max(40, Math.round(om * 140));
    for (let i = 0; i <= N; i++) {
      const f = i / N, s1 = Math.sin((1 - f) * om) / Math.sin(om), s2 = Math.sin(f * om) / Math.sin(om);
      const h = 1 + Math.sin(Math.PI * f) * (.035 + om * .05);
      arcP.push((A[0] * s1 + B[0] * s2) * h, (A[1] * s1 + B[1] * s2) * h, (A[2] * s1 + B[2] * s2) * h);
      arcK.push(f + pi * .17);
    }
  });
  const bArc = buf(arcP), bArcK = buf(arcK), nArc = arcK.length;
  const dotP = [], dotS = [];
  [hq, ...places].forEach((pl, i) => { dotP.push(...ll(pl.lat, pl.lon, 1.004)); dotS.push(i === 0 ? 2 : 1); });
  const bDot = buf(dotP), bDotS = buf(dotS);

  /* ---- textures ---- */
  function tex(src, unit) {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([4, 18, 40, 255]));
    const im = new Image(); im.decoding = 'async';
    im.onload = () => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
      gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); loaded++; go(); };
    im.src = src; return t;
  }
  let loaded = 0;
  tex(textures.day, 0); tex(textures.night, 1); tex(textures.water, 2); tex(textures.clouds, 3);

  /* ---- labels ---- */
  const labels = [hq, ...places].map((pl, i) => {
    const el = document.createElement('div'); el.className = 'glabel' + (i === 0 ? ' hq' : '');
    el.innerHTML = `<i></i>${pl.name}<em>${pl.note}</em>`; box.appendChild(el); return { el, v: ll(pl.lat, pl.lon, 1.02), dx: pl.dx || 0, dy: pl.dy || 0 };
  });

  /* ---- state & interaction ---- */
  let yaw = -hq.lon * DEG + .35, pitch = hq.lat * DEG * .55, vy = 0, vx = 0, drag = null, vis = false, raf = 0, t0 = performance.now(), last = t0, idle = 0;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); idle = 0; });
  canvas.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
    vy = dx * .006; vx = dy * .004; yaw += vy; pitch = Math.max(-1.1, Math.min(1.1, pitch + vx)); go(); });
  const end = () => { drag = null; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);

  let W = 0, H = 0;
  function size() { const dpr = Math.min(devicePixelRatio || 1, 2), w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr); if (w !== W || h !== H) { W = canvas.width = w; H = canvas.height = h; gl.viewport(0, 0, W, H); } return dpr; }

  function bindSphere(p) {
    const a = gl.getAttribLocation(p, 'p'); gl.bindBuffer(gl.ARRAY_BUFFER, bPos); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 0, 0);
    const t = gl.getAttribLocation(p, 't'); if (t >= 0) { gl.bindBuffer(gl.ARRAY_BUFFER, bUv); gl.enableVertexAttribArray(t); gl.vertexAttribPointer(t, 2, gl.FLOAT, false, 0, 0); }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bIdx);
  }
  function frame(now) {
    raf = 0; const dpr = size(); const dt = Math.min(.05, (now - last) / 1000); last = now; const T = (now - t0) / 1000;
    if (!drag && !reduce) { idle += dt; vy *= .94; vx *= .9; yaw += vy + dt * .05 * Math.min(1, idle / 2); pitch += (hq.lat * DEG * .55 - pitch) * .01 * Math.min(1, idle / 3); }
    const P = mat4Persp(28 * DEG, W / H, .1, 20), V = mul(trans(-4.6), mul(rotX(pitch), rotY(yaw)));
    const L = (() => { const l = [-.55, .45, .7]; const m = Math.hypot(...l); return l.map(x => x / m); })();
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.disable(gl.BLEND);
    /* earth */
    gl.useProgram(pE); bindSphere(pE);
    gl.uniformMatrix4fv(gl.getUniformLocation(pE, 'P'), false, P); gl.uniformMatrix4fv(gl.getUniformLocation(pE, 'V'), false, V);
    gl.uniform1f(gl.getUniformLocation(pE, 'S'), 1); gl.uniform3fv(gl.getUniformLocation(pE, 'L'), L);
    gl.uniform1i(gl.getUniformLocation(pE, 'D'), 0); gl.uniform1i(gl.getUniformLocation(pE, 'N'), 1); gl.uniform1i(gl.getUniformLocation(pE, 'W'), 2);
    gl.cullFace(gl.BACK); gl.drawElements(gl.TRIANGLES, nIdx, gl.UNSIGNED_SHORT, 0);
    /* clouds */
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    gl.useProgram(pC); bindSphere(pC);
    gl.uniformMatrix4fv(gl.getUniformLocation(pC, 'P'), false, P); gl.uniformMatrix4fv(gl.getUniformLocation(pC, 'V'), false, V);
    gl.uniform1f(gl.getUniformLocation(pC, 'S'), 1.008); gl.uniform3fv(gl.getUniformLocation(pC, 'L'), L);
    gl.uniform1i(gl.getUniformLocation(pC, 'C'), 3); gl.uniform1f(gl.getUniformLocation(pC, 'O'), T * .0025);
    gl.drawElements(gl.TRIANGLES, nIdx, gl.UNSIGNED_SHORT, 0);
    /* atmosphere halo */
    gl.useProgram(pH); bindSphere(pH);
    gl.uniformMatrix4fv(gl.getUniformLocation(pH, 'P'), false, P); gl.uniformMatrix4fv(gl.getUniformLocation(pH, 'V'), false, V); gl.uniform1f(gl.getUniformLocation(pH, 'S'), 1.11);
    gl.blendFunc(gl.ONE, gl.ONE); gl.cullFace(gl.FRONT); gl.drawElements(gl.TRIANGLES, nIdx, gl.UNSIGNED_SHORT, 0); gl.cullFace(gl.BACK);
    /* arcs + markers */
    gl.disable(gl.DEPTH_TEST); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(pP);
    let a = gl.getAttribLocation(pP, 'p'); gl.bindBuffer(gl.ARRAY_BUFFER, bArc); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 0, 0);
    let k = gl.getAttribLocation(pP, 'k'); gl.bindBuffer(gl.ARRAY_BUFFER, bArcK); gl.enableVertexAttribArray(k); gl.vertexAttribPointer(k, 1, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(gl.getUniformLocation(pP, 'P'), false, P); gl.uniformMatrix4fv(gl.getUniformLocation(pP, 'V'), false, V);
    gl.uniform1f(gl.getUniformLocation(pP, 'T'), T); gl.uniform1f(gl.getUniformLocation(pP, 'Z'), dpr * 1.6);
    gl.drawArrays(gl.POINTS, 0, nArc); gl.disableVertexAttribArray(k);
    gl.useProgram(pD);
    a = gl.getAttribLocation(pD, 'p'); gl.bindBuffer(gl.ARRAY_BUFFER, bDot); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 0, 0);
    const s = gl.getAttribLocation(pD, 's'); gl.bindBuffer(gl.ARRAY_BUFFER, bDotS); gl.enableVertexAttribArray(s); gl.vertexAttribPointer(s, 1, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(gl.getUniformLocation(pD, 'P'), false, P); gl.uniformMatrix4fv(gl.getUniformLocation(pD, 'V'), false, V);
    gl.uniform1f(gl.getUniformLocation(pD, 'T'), T); gl.uniform1f(gl.getUniformLocation(pD, 'Z'), dpr);
    gl.drawArrays(gl.POINTS, 0, dotS.length); gl.disableVertexAttribArray(s); gl.depthMask(true);
    /* html labels follow their markers */
    const PV = mul(P, V), cw = canvas.clientWidth, ch = canvas.clientHeight, ctr = apply(V, [0, 0, 0]);
    labels.forEach(l => {
      const w = apply(V, l.v), c = apply(PV, l.v);
      const x = (c[0] / c[3] * .5 + .5) * cw, y = (-c[1] / c[3] * .5 + .5) * ch;
      const nx = w[0] - ctr[0], ny = w[1] - ctr[1], nz = w[2] - ctr[2];      /* surface normal in view space */
      const facing = -(nx * w[0] + ny * w[1] + nz * w[2]) / (Math.hypot(nx, ny, nz) * Math.hypot(w[0], w[1], w[2]));
      l.el.style.transform = `translate(${x + 10 + l.dx}px,${y - 12 + l.dy}px)`;
      l.el.style.opacity = facing > .2 ? 1 : 0;
    });
    if (vis && !document.hidden && (!reduce || loaded < 4)) raf = requestAnimationFrame(frame);
  }
  function go() { if (!raf) raf = requestAnimationFrame(frame); }
  new IntersectionObserver(e => { vis = e[0].isIntersecting; if (vis) { last = performance.now(); go(); } }, { rootMargin: '120px' }).observe(box);
  document.addEventListener('visibilitychange', go);
  addEventListener('resize', go);
  return { go };
}
