/* Apollo hero: one WebGL fragment shader draws three things.
   1. A glowing, spinning gravity well (fbm spiral arms in log-polar space, lensed stars).
   2. The Apollo mark at its centre: the ring and slash, shaded as glossy 3D tubes.
   3. A blue Earth inside the ring (NASA textures, re-coloured), turning slowly, with Islamabad marked.
   Scrolling zooms the camera through the ring into the globe; the page sets the target with setZoom(). */
export function vortex(canvas, opts = {}) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  const deriv = gl.getExtension('OES_standard_derivatives');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const fs = `${deriv ? '#extension GL_OES_standard_derivatives : enable' : ''}
precision highp float;
uniform vec2 R;uniform float T;uniform vec2 M;uniform float S;uniform float Z;uniform float L;
uniform vec2 G;uniform vec3 H;uniform float READY;
uniform sampler2D DAY;uniform sampler2D WAT;uniform sampler2D NIT;
float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fb(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
${deriv ? 'float fw(float x){return fwidth(x);}' : 'float fw(float x){return 0.;}'}
const vec3 LD=vec3(-.52,.58,.63);
vec3 tube(vec3 nrm){                                   /* glossy brand-blue tube shading */
  vec3 l=normalize(LD);float d=dot(nrm,l);
  float sp=pow(max(dot(reflect(-l,nrm),vec3(0.,0.,1.)),0.),28.);
  vec3 c=vec3(0.,.533,1.)*(.62+.5*max(d,0.))+vec3(0.,.1,.3)*min(d,0.);
  return c+vec3(.75,.9,1.)*sp*.85;
}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*R)/R.y;
  uv-=vec2(0.,S);uv+=M*.012;
  float px=1./(R.y*Z);
  vec2 p=uv/Z;
  float r=length(p);
  float u=L/242.5;                                     /* logo units: the supplied mark is 554 px across */
  float rc=221.25*u,hw=21.25*u,rg=138.*u,rh=200.*u;

  vec3 col=vec3(0.);
  /* ---- gravity well (skipped inside the hole) ---- */
  if(r>rh-.01){
    float a=atan(p.y,p.x);
    float lr=log(r+1e-4);
    float sw=a+T*.22-1.6*lr;
    vec2 q=vec2(cos(sw),sin(sw));
    float arms=fb(q*2.1+vec2(lr*1.7+T*.32,lr*.9))*.72+fb(q*3.7+vec2(-lr*2.3,T*.24+lr))*.5;
    float k=rh/.105;
    float band=exp(-pow((r-.21*k)/(.16*k),2.))+.35*exp(-pow((r-.42*k)/(.25*k),2.));
    float disk=smoothstep(rh,rh+.03,r)*band;
    float g=pow(arms,2.2)*disk*2.6;
    vec3 deep=vec3(.0,.10,.32),mid=vec3(.0,.45,1.),hot=vec3(.72,.9,1.);
    col=mix(deep,mid,clamp(g,0.,1.));col=mix(col,hot,clamp(g-.85,0.,1.));
    col*=g;
    col+=vec3(0.,.25,.75)*.22*exp(-r*2.2/k);
    float kk=1.+.012*k*k/(r*r+.002*k*k);
    vec2 sp=uv*kk/Z+vec2(T*.004,0.);
    float st=0.;
    for(int l=0;l<2;l++){
      vec2 c=sp*(260.+float(l)*170.)*Z;
      float s=h(floor(c)+float(l)*7.);
      float tw=.6+.4*sin(T*2.+s*60.);
      st+=step(.9965,s)*tw*smoothstep(.5,.0,length(fract(c)-.5));
    }
    col+=vec3(.75,.88,1.)*st*smoothstep(rh+.02,rh+.25,r);
    col*=smoothstep(rh-.004,rh+.008,r);
    col=1.-exp(-col*1.35);
  }
  /* soft blue haze inside the hole, then the globe's atmosphere */
  col+=vec3(0.,.04,.12)*(1.-smoothstep(rh*.6,rh,r));
  col+=vec3(.05,.45,1.)*.55*exp(-max(r-rg,0.)/(rg*.09))*step(rg,r)*(1.-smoothstep(rh*.92,rh,r));

  /* ---- blue globe ---- */
  vec2 gq=p/rg;float d2=dot(gq,gq);
  if(d2<1.04){
    float z=sqrt(max(1.-d2,0.));
    vec3 nv=vec3(gq,z);
    float ct=cos(G.y),st2=sin(G.y),cy=cos(G.x),sy=sin(G.x);
    vec3 w=vec3(nv.x,nv.y*ct+nv.z*st2,-nv.y*st2+nv.z*ct);          /* tilt */
    w=vec3(w.x*cy+w.z*sy,w.y,-w.x*sy+w.z*cy);                      /* yaw */
    float lat=asin(clamp(w.y,-1.,1.)),lon=atan(w.x,w.z);
    float uA=fract(lon/6.2831853+.5),uB=fract(lon/6.2831853)-.5;
    float uu=fw(uA)<=fw(uB)+1e-6?uA:uB;                            /* no seam at the date line */
    vec2 tc=vec2(uu,.5-lat/3.14159265);
    vec3 day=texture2D(DAY,tc).rgb;float water=texture2D(WAT,tc).r;vec3 nit=texture2D(NIT,tc).rgb;
    float land=(1.-smoothstep(.35,.65,water))*READY;
    vec3 l=normalize(LD);float dif=dot(nv,l);float lit=smoothstep(-.15,.55,dif);
    float lum=dot(day,vec3(.3,.59,.11));
    vec3 ocean=mix(vec3(.004,.04,.13),vec3(.02,.22,.58),lit);
    vec3 ground=mix(vec3(.03,.27,.78),vec3(.34,.64,1.),smoothstep(.15,.75,lum))*(.22+.85*lit);
    vec3 gc=mix(ocean,ground,land);
    gc+=vec3(.5,.8,1.)*pow(max(dot(reflect(-l,nv),vec3(0.,0.,1.)),0.),36.)*(1.-land)*.75;
    float city=dot(nit,vec3(.33));
    gc+=vec3(.55,.85,1.)*pow(city,1.6)*1.8*(1.-smoothstep(-.25,.15,dif))*READY;
    /* graticule every 15 degrees */
    float la=lat/.2617994,lo=lon/.2617994;
    float gl1=abs(fract(la-.5)-.5)/max(fw(la),1e-4),gl2=abs(fract(lo-.5)-.5)/max(fw(lo),1e-4);
    gc+=vec3(.45,.75,1.)*(1.-min(min(gl1,gl2),1.))*.13*z;
    gc+=vec3(.25,.62,1.)*pow(1.-z,2.6)*.9;                           /* rim light */
    /* Islamabad */
    if(H.z>0.){
      float dd=length(p-H.xy*rg)/px;
      float pulse=fract(T*.6);
      gc+=vec3(1.)*smoothstep(4.5,2.,dd);
      gc+=vec3(.6,.85,1.)*smoothstep(2.,0.,abs(dd-(6.+pulse*26.)))*(1.-pulse)*.9;
    }
    float edge=1.-smoothstep(1.-1.5*px/rg,1.,sqrt(d2));
    col=mix(col,gc,edge);
  }

  /* ---- the mark: ring and slash as 3D tubes ---- */
  float dR=abs(r-rc)-hw;
  vec2 dir=vec2(-.70710678,.70710678);
  float sgn=dot(p,dir)<0.?-1.:1.;
  vec2 fq=p*sgn;
  float th=clamp(dot(fq,dir),236.*u,314.*u);
  vec2 off=fq-dir*th;
  float dS=length(off)-21.*u;
  float dm=min(dR,dS);
  float cover=1.-smoothstep(-px,px,dm);
  if(dm<4.*px+.06){
    vec3 nrm;
    if(dR<dS){float k=clamp((r-rc)/hw,-1.,1.);nrm=vec3(normalize(p+1e-6)*k,sqrt(max(1.-k*k,0.)));}
    else{vec2 o=off/(21.*u);float k=clamp(length(o),0.,1.);nrm=vec3(sgn*normalize(o+1e-6)*k,sqrt(max(1.-k*k,0.)));}
    vec3 mc=tube(nrm);
    float ang=atan(p.y,p.x);
    mc+=vec3(.7,.9,1.)*pow(max(cos(ang-T*.9),0.),40.)*.55*step(dR,dS);  /* light running round the ring */
    col=mix(col,mc,cover);
    col+=vec3(0.,.42,1.)*exp(-max(dm,0.)/(L*.09))*.28*(1.-cover);
  }
  col*=1.-smoothstep(.55,1.15,length((gl_FragCoord.xy-.5*R)/R.y))*smoothstep(3.,1.,Z);
  gl_FragColor=vec4(col,1.);
}`;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(o)); return o; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {}; for (const k of ['R', 'T', 'M', 'S', 'Z', 'L', 'G', 'H', 'READY', 'DAY', 'WAT', 'NIT']) U[k] = gl.getUniformLocation(pr, k);

  /* textures: a 1x1 placeholder until the images arrive */
  let ready = 0, loaded = 0;
  const tex = (unit, src) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    if (!src) return;
    const im = new Image(); im.decoding = 'async';
    im.onload = () => {
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (++loaded === 3) ready = 1;
      go();
    };
    im.src = src;
  };
  const tx = opts.textures || {};
  tex(0, tx.day); tex(1, tx.water); tex(2, tx.night);
  gl.uniform1i(U.DAY, 0); gl.uniform1i(U.WAT, 1); gl.uniform1i(U.NIT, 2);

  const scale = opts.scale || .85;
  const D2R = Math.PI / 180, HQ = opts.hq || { lat: 33.6844, lon: 73.0479 };
  let w = 0, hgt = 0, vis = true, raf = 0, t0 = performance.now();
  let shift = opts.shift ?? .12, zoom = 1, ztarget = 1, sTarget = shift, rdy = 0;
  const m = { x: 0, y: 0, tx: 0, ty: 0 };
  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5) * scale;
    const nw = Math.max(1, Math.round(canvas.clientWidth * dpr)), nh = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (nw !== w || nh !== hgt) { w = canvas.width = nw; hgt = canvas.height = nh; gl.viewport(0, 0, w, hgt); }
  }
  const logo = () => opts.logo || (w / hgt < .8 ? .125 : .15);
  /* zoom that makes the globe cover the whole viewport */
  const zmax = () => { if (!w) size(); const a = w / hgt; return 1.12 * Math.hypot(a / 2, .5) / (138 / 242.5 * logo()); };
  function frame(now) {
    raf = 0; size();
    const t = reduce ? 12 : (now - t0) / 1000 + 12;
    m.x += (m.tx - m.x) * .05; m.y += (m.ty - m.y) * .05;
    zoom += (ztarget - zoom) * .14; shift += (sTarget - shift) * .14;
    rdy += (ready - rdy) * .06;
    /* the globe turns slowly, then swings Islamabad to the centre as you zoom in */
    const pull = Math.min(1, Math.max(0, (zoom - 1.15) / 2.5));
    const spin = HQ.lon * D2R + 0.9 * Math.sin(t * .07) + t * .03;
    let dl = ((spin - HQ.lon * D2R) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
    const yaw = HQ.lon * D2R + dl * (1 - pull * pull * (3 - 2 * pull));
    const tilt = (14 + (HQ.lat - 14) * pull) * D2R;
    /* Islamabad in view space (inverse of the shader's tilt then yaw) */
    const la = HQ.lat * D2R, lo = HQ.lon * D2R;
    let x = Math.cos(la) * Math.sin(lo), y = Math.sin(la), z = Math.cos(la) * Math.cos(lo);
    [x, z] = [x * Math.cos(yaw) - z * Math.sin(yaw), x * Math.sin(yaw) + z * Math.cos(yaw)];
    [y, z] = [y * Math.cos(tilt) - z * Math.sin(tilt), y * Math.sin(tilt) + z * Math.cos(tilt)];
    gl.uniform2f(U.R, w, hgt); gl.uniform1f(U.T, t); gl.uniform2f(U.M, m.x, m.y);
    gl.uniform1f(U.S, shift); gl.uniform1f(U.Z, zoom); gl.uniform1f(U.L, logo());
    gl.uniform2f(U.G, yaw, tilt); gl.uniform3f(U.H, x, y, z); gl.uniform1f(U.READY, rdy);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const settling = Math.abs(ztarget - zoom) > .001 || Math.abs(ready - rdy) > .01;
    if (vis && !document.hidden && (!reduce || settling)) raf = requestAnimationFrame(frame);
  }
  const go = () => { if (!raf) raf = requestAnimationFrame(frame); };
  new IntersectionObserver(e => { vis = e[0].isIntersecting; if (vis) go(); }).observe(canvas);
  addEventListener('resize', go);
  document.addEventListener('visibilitychange', go);
  addEventListener('pointermove', e => { m.tx = (e.clientX / innerWidth - .5) * 2; m.ty = -(e.clientY / innerHeight - .5) * 2; }, { passive: true });
  go();
  return {
    go,
    /* fixed framing, for stills */
    setZoom(z, s = 0) { ztarget = zoom = z; sTarget = shift = s; go(); },
    /* p: 0 = resting, 1 = fully zoomed into the globe */
    setProgress(p) {
      const e = Math.min(1, Math.max(0, (p - .04) / .84));
      const s = e * e * (3 - 2 * e);
      ztarget = Math.exp(Math.log(zmax()) * s);
      sTarget = (opts.shift ?? .12) * (1 - Math.min(1, s * 2.2));
      go();
    },
  };
}
