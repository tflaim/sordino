// PROTOTYPE — one fragment shader per genre (GLSL ES 3.0). Each is a pure function of
// the arrival clock and the score uniforms; nothing here keeps state between frames,
// which is what makes every genre portable to a single raw WebGL program.
//
// Shared conventions
//   p        stage units (1 unit ≈ 280 px at 1280×800), origin at the focal point, y up
//   uT       seconds since the mute went in (frozen at the moment of Turn back)
//   uOn[k]   onset of beat k in seconds; uOn[0] = 0, uOn[uN] = uTotal (Bypass opens)
//   uTurn    seconds since Turn back, or −1
//   uStill   1 = Stillness / reduced motion: the composed still frame, nothing "now"
//   uDyn     dynamic ceiling: 1 normally, 0.8 when the budget is spent (never louder)
//   finish() caps luminance behind every text rectangle so text keeps AA contrast.
import type { GenreKey } from './score'

export const VERT = /* glsl */ `
precision highp float;
in vec3 position;
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`

const PRELUDE = /* glsl */ `
precision highp float;
uniform vec2 uRes;
uniform vec2 uFocus;
uniform float uScale;
uniform float uT;
uniform float uTotal;
uniform float uN;
uniform float uBeat;
uniform float uOn[17];
uniform float uTurn;
uniform float uDyn;
uniform float uStill;
uniform float uSpent;
uniform vec4 uSafe[8];
uniform float uBarY;    // GL y (px) of the action bar's top edge; the bar is opaque
out vec4 fragColor;

const float PI = 3.14159265;
const vec3 BG = vec3(0.1098, 0.0980, 0.0902);   // --bg #1c1917
const vec3 INK = vec3(0.918, 0.886, 0.843);     // --fg
const vec3 BRASS = vec3(0.800, 0.655, 0.400);   // --brass
float PX;                                        // one device pixel in stage units

float sat(float x) { return clamp(x, 0.0, 1.0); }
float easeIO(float x) { x = sat(x); return x * x * (3.0 - 2.0 * x); }
float easeOut(float x) { x = 1.0 - sat(x); return 1.0 - x * x * x; }
float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
float sdSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = sat(dot(pa, ba) / dot(ba, ba)); return length(pa - ba * h); }
float stroke(float d, float w) { return 1.0 - smoothstep(w - PX, w + PX, d); }
float halo(float d, float r) { return exp(-(d * d) / (r * r)); }

// Musical position in beats (continuous) on the score's own onsets.
float beatPos(float t) {
  if (t <= 0.0) return t / uBeat;
  for (int k = 1; k < 17; k++) {
    if (float(k) > uN) break;
    if (t < uOn[k]) return float(k - 1) + (t - uOn[k - 1]) / max(1e-3, uOn[k] - uOn[k - 1]);
  }
  return uN + (t - uTotal) / uBeat;
}

// The metronome arm: at an extreme on every onset (beat 0 = left), and on the last
// beat it does not tick: it comes to rest at the centre, the moment Bypass opens.
float armAngle(float bp, float amp) {
  if (bp >= uN) return 0.0;
  if (bp < 0.0) return -amp;
  float k = floor(bp), u = bp - k;
  float side = mod(k, 2.0) < 0.5 ? -1.0 : 1.0;
  if (k >= uN - 1.0) return side * amp * (1.0 - easeIO(u));
  return side * amp * cos(PI * u);
}

// A thin rod with a sliding weight, pivot below the stage centre.
float arm(vec2 p, float ang, float len, float w) {
  vec2 piv = vec2(0.0, -1.05);
  vec2 dir = vec2(sin(ang), cos(ang));
  float rod = sdSeg(p, piv, piv + dir * len);
  vec2 wc = piv + dir * len * 0.64;
  vec2 nrm = vec2(dir.y, -dir.x);
  float wt = sdSeg(p, wc - nrm * 0.045, wc + nrm * 0.045);
  return max(stroke(rod, w), stroke(wt, w * 2.6));
}

vec3 toLin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }

float safeMask(vec2 fc) {
  float m = 0.0;
  for (int i = 0; i < 8; i++) {
    vec4 r = uSafe[i];
    if (r.z <= r.x) continue;
    vec2 d = max(r.xy - fc, fc - r.zw);
    m = max(m, 1.0 - smoothstep(0.0, 0.14 * uScale, length(max(d, 0.0))));
  }
  return m;
}

// Static dither (never time-varying: that would be an ambient loop in disguise), a
// global ceiling that keeps the stage dark, and the AA cap behind text: muted text
// (#a89785, L = 0.3215) needs L_bg <= 0.0326 for 4.5:1; we cap at 0.026 (>= 4.8:1).
vec3 finish(vec3 col) {
  vec2 fc = gl_FragCoord.xy;
  col = max(col + (hash(fc) - 0.5) / 255.0, 0.0);
  vec3 lin = toLin(col);
  float L = dot(lin, vec3(0.2126, 0.7152, 0.0722));
  float cap = mix(0.16, 0.026, safeMask(fc));
  if (L > cap) lin *= cap / L;
  return toSrgb(lin);
}
`

const MAIN = /* glsl */ `
void main() {
  PX = 1.0 / uScale;
  vec2 p = (gl_FragCoord.xy - uFocus) / uScale;
  bool wide = uFocus.x > 0.6 * uRes.x;
  // Pixels nobody sees (under the opaque bar) or that the fade empties: plain ground.
  if (gl_FragCoord.y < uBarY - 2.0 || (wide && p.x < -1.75)) { fragColor = vec4(BG + (hash(gl_FragCoord.xy) - 0.5) / 255.0, 1.0); return; }
  vec3 c = stage(p);
  // Wide layouts: the stage lives right of the text column and fades out toward it.
  if (wide) c = mix(BG, c, smoothstep(-1.75, -1.0, p.x));
  fragColor = vec4(finish(c), 1.0);
}
`


// ============================================================== B · Baroque
// Two-part invention in D minor at the sixteenth. Voice 1 states the subject; voice 2
// answers it an octave below one beat later. The noteheads carry the line (a faint
// thread shows its contour), a ruling of sixteenth ticks is the motor. Terraced
// dynamics (f · p · f by beat), no rubato. Cadence: both voices land on D, the third
// between them is struck as F and raised to F♯ (tierce de Picardie), silver to brass.
const BAROQUE = /* glsl */ `
const float X0 = -0.95, X1 = 0.85;
const float SUBJ[16] = float[16](0., 1., 2., 3.,  4., 5., 6., 5.,  4., 3., 2., 1.,  2., 0., 1., -1.);
const float CAD1[4] = float[4](4., 2., 1., -1.);      // A F E C#  -> D
const float CAD2[4] = float[4](-5., -6., -3., -10.);  // F E A A,  -> D (V–I in the bass)

float deg1(int j) {
  int n4 = int(uN) * 4;
  if (j >= n4) return 0.0;
  if (j >= n4 - 4) return CAD1[j - (n4 - 4)];
  return SUBJ[j % 16] - float(j / 16);
}
float deg2(int j) {
  int n4 = int(uN) * 4;
  if (j >= n4) return -7.0;
  if (j >= n4 - 4) return CAD2[j - (n4 - 4)];
  return deg1(j - 4) - 7.0;
}
float degV(int v, int j) { return v == 1 ? deg1(j) : deg2(max(j, 4)); }
float yOf(float d) { return 0.20 + 0.032 * d; }

// Terraces by beat: forte, piano echo, forte. Steps, never hairpins.
float terrace(float b) { return (b < 0.4 * uN ? 1.0 : (b < 0.8 * uN ? 0.55 : 1.0)) * uDyn; }

vec3 stage(vec2 p) {
  float t = uT;
  bool still = uStill > 0.5;
  float bNow = still ? uN : beatPos(t);
  float qNow = bNow * 4.0;
  float q16 = uBeat / 4.0;
  float subito = uTurn >= 0.0 ? 0.35 : 1.0;      // Turn back: subito piano
  float cadT = still ? -1.0 : t - uTotal;
  float warm = easeIO((cadT - 0.12) / 0.40);     // minor -> major
  vec2 lc = vec2(0.55, 0.85);
  vec3 col = BG + vec3(0.050, 0.038, 0.022) * halo(length(p - lc), 1.25) * (1.0 + 0.3 * warm);
  float light = 0.75 + 0.25 * halo(length(p - lc), 1.4);
  vec3 silver1 = vec3(0.72, 0.76, 0.82), silver2 = vec3(0.60, 0.64, 0.71);

  col += INK * 0.09 * arm(p, armAngle(bNow, 0.26), 1.62, 0.0032) * subito;

  float slopeK = (uN * 4.0) / (X1 - X0);
  float q = (p.x - X0) * slopeK;
  float qEnd = uN * 4.0;

  if (p.y > -0.2 && p.y < 0.5) {
    for (int v = 1; v <= 2; v++) {
      float qStart = v == 1 ? 0.0 : 4.0;
      if (q < qStart - 0.5 || q > qEnd + 0.5) continue;
      float qc = clamp(q, qStart, qEnd);
      int j = int(floor(qc));
      float f = qc - float(j);
      float ya = yOf(degV(v, j)), yb = yOf(degV(v, j + 1));
      float y = mix(ya, yb, smoothstep(0.0, 1.0, f));
      float dydx = (yb - ya) * 6.0 * f * (1.0 - f) * slopeK;
      float d = abs(p.y - y) / sqrt(1.0 + dydx * dydx);
      // Beamed in fours: the thread joins the four sixteenths of a beat, with a breath between beats.
      float inside = step(qStart, q) * step(q, qEnd) * step(mod(qc, 4.0), 3.0);
      float shown = smoothstep(0.06, -0.02, q - qNow) * inside;
      float lv = terrace(q / 4.0) * light * subito;
      vec3 ink = mix(v == 1 ? silver1 : silver2, BRASS, warm * smoothstep(qEnd - 4.0, qEnd, q));
      col += ink * (stroke(d, 0.0018) * 0.26 + halo(d, 0.02) * 0.05) * lv * shown;

      // Noteheads, plucked: instant attack, quick decay to a sustain (harpsichord, not piano).
      int jn = int(floor(q + 0.5));
      if (jn >= int(qStart) && jn <= int(qEnd)) {
        vec2 c = vec2(X0 + float(jn) / slopeK, yOf(degV(v, jn)));
        float age = t - float(jn) * q16;
        if (still || age >= 0.0) {
          float pl = still ? 0.5 : 0.42 + 0.58 * exp(-age / (0.16 * sqrt(uBeat)));
          float dd = length(p - c);
          float last = step(qEnd - 0.5, float(jn));
          vec3 hc = mix(v == 1 ? INK : mix(INK, silver2, 0.35), BRASS, warm * last);
          col += hc * (stroke(dd, 0.0105) * 0.62 + halo(dd, 0.032) * 0.20) * pl * terrace(float(jn) / 4.0) * light * subito;
        }
      }
    }
  }

  // Motor: a ruling of sixteenth ticks; the whole bar is faintly there, the played part lit.
  float jt = floor(q + 0.5);
  if (jt >= 0.0 && jt <= qEnd && p.y > -0.47 && p.y < -0.33) {
    float x = X0 + jt / slopeK;
    float onBeat = mod(jt, 4.0) < 0.5 ? 1.0 : 0.0;
    float h = mix(0.026, 0.058, onBeat);
    float d = sdSeg(p, vec2(x, -0.42), vec2(x, -0.42 + h));
    float age = t - jt * q16;
    float lit = still ? 0.55 : (age >= 0.0 ? 0.45 + 0.55 * exp(-age / (0.12 * sqrt(uBeat))) : 0.0);
    float lv = still ? 0.8 : terrace(jt / 4.0);
    col += INK * stroke(d, mix(0.0026, 0.004, onBeat)) * (0.07 + 0.42 * lit * lv) * subito;
  }

  // Cadence: the final chord after the lines. D, F -> F#, D; struck, then held.
  if (cadT >= 0.0) {
    float x0 = X1 + 0.05, x1 = X1 + 0.19;
    float rise = easeIO((cadT - 0.12) / 0.25) * 0.016;   // a semitone = half a diatonic step
    for (int i = 0; i < 3; i++) {
      float y = i == 0 ? yOf(0.0) : (i == 1 ? yOf(-5.0) + rise : yOf(-7.0));
      float d = sdSeg(p, vec2(x0, y), vec2(x1, y));
      float strike = 0.55 + 0.45 * exp(-cadT / 0.2);
      col += mix(silver1, BRASS, warm) * (stroke(d, 0.0055) * 0.85 + halo(d, 0.04) * 0.22) * strike * uDyn * subito;
    }
  }
  return col;
}
`

// ============================================================== R · Romantic
// Nocturne. The cantilena is drawn at rubato speed: x is musical time, so the line
// advances evenly per beat but lingers or hurries on the clock (the same warped onsets
// as the beat dots). One long hairpin pp < mf is the lamp; pen pressure follows it.
// The left hand rolls one pedalled arpeggio per beat. Cadence: the appoggiatura sighs
// down onto the tonic exactly on the final beat, the swell peaks there, then morendo.
const ROMANTIC = /* glsl */ `
const float X0 = -0.95, X1 = 0.85;
const vec2 MEL[12] = vec2[12](
  vec2(0.00, 0.00), vec2(0.22, 0.07), vec2(0.30, 0.14), vec2(0.38, 0.32),
  vec2(0.58, 0.27), vec2(0.655, 0.32), vec2(0.685, 0.27), vec2(0.715, 0.225),
  vec2(0.745, 0.27), vec2(0.80, 0.14), vec2(0.87, 0.07), vec2(1.00, 0.00));
float melY(float u) {
  float y = MEL[0].y;
  for (int i = 1; i < 12; i++) {
    float w = i >= 5 && i <= 8 ? 0.014 : 0.04;     // legato; the turn is quicker
    y += (MEL[i].y - MEL[i - 1].y) * smoothstep(MEL[i].x - w, MEL[i].x + w, u);
  }
  return 0.02 + 1.1 * y;
}
float swell(float x) { return 0.22 + 0.78 * pow(easeIO(x), 1.2); }
float hairpin(float t) { return swell(t / uTotal) * (1.0 - 0.15 * easeIO((t - uTotal) / 0.6)) * uDyn; }

vec3 stage(vec2 p) {
  float t = uT;
  bool still = uStill > 0.5;
  float bNow = still ? uN : beatPos(t);
  float uNow = bNow / uN;
  float hp = still ? 0.6 * uDyn : hairpin(t);
  float tr = uTurn >= 0.0 ? easeOut(uTurn / 0.25) : 0.0;   // the sigh on Turn back
  float enter = still ? 1.0 : easeIO(t / 0.8);
  float span = X1 - X0;

  // Night above, the lamp to the upper right: the hairpin made visible.
  vec3 col = BG + vec3(0.000, 0.004, 0.020) * smoothstep(-0.6, 1.2, p.y);
  col += vec3(0.135, 0.100, 0.062) * halo(length((p - vec2(0.42, 0.62)) * vec2(1.0, 1.2)), 0.9) * hp * (1.0 - 0.5 * tr) * enter;

  col += INK * 0.07 * arm(p, armAngle(bNow, 0.24), 1.62, 0.0032) * (1.0 - 0.5 * tr);

  // Left hand: root, fifth, tenth, rolled, held by the pedal.
  if (p.y < -0.3) {
    for (int k = 0; k < 16; k++) {
      if (float(k) >= uN) break;
      vec2 prev = vec2(0.0);
      for (int i = 0; i < 3; i++) {
        float age = t - (uOn[k] + float(i) * 0.11 * sqrt(uBeat));
        if (!still && age < 0.0) break;
        vec2 c = vec2(X0 + span * (float(k) + 0.06 + float(i) * 0.13) / uN, -0.58 + float(i) * 0.07 + (i == 2 ? 0.035 : 0.0));
        float lv = (still ? 0.35 : 0.28 + 0.72 * exp(-age / (0.5 * uBeat))) * (0.45 + 0.55 * hp / uDyn) * uDyn * (1.0 - 0.5 * tr);
        float dd = length(p - c);
        col += vec3(0.80, 0.72, 0.62) * (stroke(dd, 0.0075) * 0.42 + halo(dd, 0.045) * 0.10) * lv;
        // the roll, slurred
        if (i > 0) col += vec3(0.80, 0.72, 0.62) * stroke(sdSeg(p, prev, c), 0.0014) * 0.16 * lv;
        prev = c;
      }
    }
  }

  // Right hand: the cantilena.
  float u = (p.x - X0) / span;
  if (u > -0.03 && u < 1.03 && p.y > -0.15 && p.y < 0.6) {
    float uc = clamp(u, 0.0, 1.0);
    float y = melY(uc);
    float e = 0.004;
    float dydx = (melY(uc + e) - y) / e / span;
    float d = abs(p.y - y) / sqrt(1.0 + dydx * dydx);
    if (u < 0.0 || u > 1.0) d = length(vec2((u < 0.0 ? -u : u - 1.0) * span, p.y - y));
    float shown = still ? 1.0 : smoothstep(0.010, -0.003, u - uNow);
    float press = (still ? 0.6 : swell(uc)) * uDyn;
    vec3 ink = mix(vec3(0.86, 0.80, 0.72), BRASS, 0.25);
    col += ink * (stroke(d, 0.0022 + 0.0032 * press) * (0.32 + 0.45 * press) + halo(d, 0.035) * 0.10 * press) * shown * (1.0 - 0.4 * tr);
  }
  // The voice itself: a pearl at the head of the line (drops a step on Turn back).
  if (!still) {
    float uh = clamp(uNow, 0.0, 1.0);
    vec2 h = vec2(X0 + span * uh, melY(uh) - 0.06 * tr);
    float dd = length(p - h);
    col += mix(INK, BRASS, 0.35) * (stroke(dd, 0.009) * 0.6 + halo(dd, 0.06) * 0.22) * (0.4 + 0.6 * hp) * (1.0 - 0.5 * tr) * enter;
  }
  return col;
}
`

// ============================================================== I · Impressionist
// Reflets dans l'eau. A water plane in perspective (ray–plane intersection); colour
// washes from value noise. Pitch class maps to a restrained arc of colour (sea green,
// slate blue, lilac, dusty rose), so on each beat the wash planes up a whole tone, like
// parallel chords, crossfading over most of the beat: the pulse is felt, not seen.
// One soft ripple per beat, alternating where the arm would tick. The arm itself is
// dissolved: only its reflection survives. Cadence: the water stills, the washes
// gather into one warm chord colour (added sixth), the reflection stands upright.
const IMPRESSIONIST = /* glsl */ `
vec3 hsl(float h, float s, float l) {
  vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}
vec3 tone(float pc) {
  float h = (160.0 + 180.0 * (0.5 - 0.5 * cos(2.0 * PI * pc / 12.0))) / 360.0;
  return hsl(h, 0.46, 0.34);
}

vec3 stage(vec2 p) {
  float t = uT;
  bool still = uStill > 0.5;
  float bNow = still ? 2.5 : beatPos(t);
  float cad = still ? 0.0 : easeIO((t - uTotal) / 0.6);
  float tr = uTurn >= 0.0 ? easeOut(uTurn / 0.25) : 0.0;
  float enter = still ? 1.0 : easeOut(t / 0.8);
  float blur = 1.0 - enter;                               // focus pull on the way in
  float cam = still ? 0.5 : easeIO(t / uTotal);           // the camera sinks toward the water
  float hy = 0.10 + 0.06 * cam;
  float bc = clamp(bNow, 0.0, uN);
  float k = min(floor(bc), uN - 1.0);
  float mk = easeIO((bc - k) / 0.7);
  float pcA = 2.0 * k, pcB = 2.0 * (k + 1.0);
  float ang = still ? 0.0 : armAngle(bNow, 0.22);
  float drift = still ? 0.12 : bc * 0.06;                 // washes move with the music, never after it
  vec3 penta = mix(tone(9.0), vec3(0.30, 0.25, 0.17), 0.55);
  vec3 chord = mix(mix(tone(pcA), tone(pcB), mk), penta, cad);
  vec3 col = BG;
  // The scene is a pool of light round the focus, not a band across the page.
  float pool = halo(length((p - vec2(0.05, -0.12)) * vec2(0.72, 1.0)), 1.05);
  float fade = enter * (1.0 - tr) * pool;

  // Mist on both sides of the horizon, tinted by the chord: no hard waterline.
  float h = p.y - hy;
  float mist = fbm(vec2(p.x * 1.8 + drift, h * 6.0) * (1.0 - 0.5 * blur)) * exp(-abs(h) * (h > 0.0 ? 3.5 : 9.0));
  col += chord * 0.42 * mist * fade;

  if (p.y < hy) {
    float dz = hy - p.y;
    float depth = 0.45 / (dz + 0.03);
    vec2 w = vec2(p.x * depth * 0.6, depth);
    float n1 = fbm(w * vec2(1.1, 0.7) * (1.0 - 0.5 * blur) + vec2(drift, 0.0));
    float n2 = fbm(w * vec2(0.6, 1.4) * (1.0 - 0.5 * blur) + vec2(4.7, -drift * 0.7));
    vec3 cA = mix(tone(pcA), tone(pcA + 4.0), n1);
    vec3 cB = mix(tone(pcB), tone(pcB + 4.0), n1);
    vec3 wash = mix(mix(cA, cB, mk), penta, cad);
    float near = smoothstep(0.0, 0.6, dz);
    // Deep water is cooler than the room, so the colour reads clean rather than muddy.
    col = mix(col, vec3(0.070, 0.078, 0.092), 0.75 * near * pool * enter);
    col += wash * 0.80 * (0.15 + 0.85 * n2 * n2 * 1.7) * near * fade;

    float rip = 0.0;
    if (!still) {
      for (int kk = 1; kk < 17; kk++) {
        if (float(kk) > uN) break;
        float age = t - uOn[kk];
        if (age <= 0.0) continue;
        float side = mod(float(kk), 2.0) < 0.5 ? -1.0 : 1.0;
        float r = length((w - vec2(side * 0.32, 1.7)) * vec2(1.0, 1.7));
        float front = age * 0.45 / sqrt(uBeat);
        rip += exp(-pow((r - front) * 15.0, 2.0)) * exp(-age / (1.3 * uBeat));
      }
      rip *= 1.0 - cad;
    }
    col += (wash * 1.2 + INK * 0.06) * rip * 0.55 * near * fade;

    // The arm's reflection: mirrored about the waterline, broken by the water.
    float wob = (noise(vec2(p.y * 36.0, 3.0)) - 0.5) * 0.05 * (1.0 - cad) * (0.4 + rip);
    float xr = dz * tan(ang);
    float colm = exp(-pow((p.x - xr + wob) / (0.018 + 0.03 * dz), 2.0)) * smoothstep(0.8, 0.0, dz);
    col += mix(vec3(0.55, 0.50, 0.45), BRASS, cad) * colm * 0.11 * fade;
  } else {
    // The arm, dissolved: only a haze where it stands.
    float d = sdSeg(p, vec2(0.0, hy), vec2(0.0, hy) + vec2(sin(ang), cos(ang)) * 1.25);
    col += vec3(0.6, 0.55, 0.5) * halo(d, 0.05) * 0.03 * fade;
  }
  col += penta * 0.5 * cad * halo(p.y - hy, 0.025) * smoothstep(1.3, 0.2, abs(p.x)) * (1.0 - tr);
  return col;
}
`

// ============================================================== J · Jazz
// Brushes on a snare head (a disc in perspective) under a warm spot; the left brush
// circles once every two beats, long–short (2:1 swing), leaving a grain trail; the
// right brush taps the backbeat on 2 and 4. A walking bass of dots, one per beat, with
// swung skip notes on the "and"; a chromatic pickup walks into beat 1. Beat 4 is the
// blue note (the flat five, B over F), in blue. The arm swings long–short. Cadence:
// tag (the last two notes echoed) and button (one hit on the tonic and the rim); the
// blue note bends up to brass. Turn back: a fall-off and the brushes stop.
const JAZZ = /* glsl */ `
const float X0 = -0.90, X1 = 0.80;
const float WALK[10] = float[10](0., 4., 5., 6., 7., 9., 7., 4., 3., 2.);  // F A Bb B C | D C A Ab G
const vec3 BLUE = vec3(0.45, 0.56, 0.86);
float wy(float st) { return -0.05 + 0.026 * st; }
float swing(float bp) { float k = floor(bp), u = bp - k; return k + (u < 2.0 / 3.0 ? 0.75 * u : 0.5 + 1.5 * (u - 2.0 / 3.0)); }

vec3 dotAt(vec2 p, vec2 c, float r, vec3 tint, float lv) {
  float dd = length(p - c);
  return tint * (stroke(dd, r) * 0.6 + halo(dd, 0.04) * 0.18) * lv;
}

vec3 stage(vec2 p) {
  float t = uT;
  bool still = uStill > 0.5;
  float bNow = still ? uN : beatPos(t);
  float cadT = still ? -1.0 : t - uTotal;
  float tr = uTurn >= 0.0 ? easeOut(uTurn / 0.3) : 0.0;
  float enter = still ? 1.0 : easeOut(t / 0.8);
  float span = X1 - X0;
  vec2 C = vec2(0.0, -0.60), R = vec2(0.58, 0.15);
  vec2 dq = (p - C) / R;
  float r = length(dq);
  float phi = atan(dq.y, dq.x);

  float spot = halo(length((p - vec2(0.12, -0.52)) * vec2(0.8, 1.3)), 0.75) * enter;
  vec3 col = BG + vec3(0.075, 0.048, 0.020) * spot * (1.0 - 0.5 * tr);
  float rimD = abs(r - 1.0) * R.y;
  col += vec3(0.75, 0.62, 0.42) * stroke(rimD, 0.0028) * 0.22 * spot;

  if (r < 1.0) {
    float phB = -PI * swing(clamp(bNow, 0.0, uN));     // brush angle, clockwise, long–short
    float behind = mod(phi - phB, 2.0 * PI);
    float fresh = still ? 0.0 : exp(-behind / 1.3);
    float g = noise(vec2(phi * 26.0, r * 9.0)) * noise(vec2(phi * 90.0, r * 40.0));
    float band = smoothstep(0.25, 0.4, r) * smoothstep(1.0, 0.85, r);
    float grain = g * band * (0.20 + 0.80 * fresh);
    float tap = 0.0;
    if (!still) {
      for (int k = 2; k < 17; k += 2) {
        if (float(k) > uN) break;
        float age = t - uOn[k];
        if (age < 0.0) continue;
        tap += exp(-age / (0.22 * sqrt(uBeat))) * halo(length(dq - vec2(0.45, 0.10)), 0.28);
      }
    }
    col += vec3(0.80, 0.68, 0.50) * (grain * 0.55 + tap * 0.18) * spot * (1.0 - 0.6 * tr);
  }
  // The arm is a brush: wires splayed on the head, the handle swinging long–short.
  {
    float ang = armAngle(swing(bNow), 0.24);
    vec2 dir = vec2(sin(ang), cos(ang));
    vec2 nrm = vec2(dir.y, -dir.x);
    vec2 piv = C + vec2(0.0, 0.02);
    float m = stroke(sdSeg(p, piv + dir * 0.30, piv + dir * 1.22), 0.0034);
    for (int i = -3; i <= 3; i++) m = max(m, stroke(sdSeg(p, piv + nrm * float(i) * 0.018, piv + dir * 0.30), 0.0012) * 0.8);
    col += INK * 0.09 * m * (1.0 - 0.5 * tr);
  }

  // Walking bass: one dot per beat, a faint thread through the walk.
  vec2 prev = vec2(0.0);
  for (int k = 1; k < 17; k++) {
    if (float(k) > uN) break;
    float age = t - uOn[k];
    if (!still && age < 0.0) break;
    vec2 c = vec2(X0 + span * float(k) / uN, wy(WALK[(k - 1) % 10]));
    bool blue = k % 4 == 0;
    float thump = still ? 0.0 : exp(-age / 0.12);
    if (blue && !still) c.y -= 0.012 * exp(-age / 0.12);          // the blue note bends into pitch
    float lv = (still ? 0.6 : 0.55 + 0.45 * thump) * uDyn;
    if (uTurn >= 0.0 && float(k) == floor(bNow)) { c.y -= 0.10 * tr; lv *= 1.0 - 0.8 * tr; }   // fall-off
    vec3 tint = blue ? mix(BLUE, BRASS, easeIO((cadT - 0.34) / 0.25)) : vec3(0.88, 0.80, 0.68);
    col += dotAt(p, c, 0.012 + 0.005 * thump, tint, lv);
    if (k > 1) col += vec3(0.8, 0.72, 0.6) * stroke(sdSeg(p, prev, c), 0.0016) * 0.10 * uDyn;
    prev = c;
  }
  // Swung skip notes on the "and" (2:1), chromatic approaches; the first is the pickup.
  for (int k = 1; k <= 5; k += 2) {
    if (float(k) > uN || (uSpent > 0.5 && k > 1)) break;
    float on = uOn[k - 1] + (2.0 / 3.0) * (uOn[k] - uOn[k - 1]);
    float age = t - on;
    if (!still && age < 0.0) continue;
    vec2 c = vec2(X0 + span * (float(k) - 1.0 / 3.0) / uN, wy(WALK[(k - 1) % 10] - 1.0));
    col += dotAt(p, c, 0.006, vec3(0.80, 0.72, 0.62), (still ? 0.35 : 0.30 + 0.4 * exp(-age / 0.1)) * uDyn);
  }
  // Tag and button.
  if (cadT > 0.0) {
    int n = int(uN);
    if (cadT > 0.08) col += dotAt(p, vec2(X1 + 0.05, wy(WALK[(n - 2) % 10])), 0.007, vec3(0.8, 0.72, 0.6), 0.5 * exp(-(cadT - 0.08) / 0.3) + 0.15);
    if (cadT > 0.18) col += dotAt(p, vec2(X1 + 0.10, wy(WALK[(n - 1) % 10])), 0.007, vec3(0.8, 0.72, 0.6), 0.5 * exp(-(cadT - 0.18) / 0.3) + 0.15);
    if (cadT > 0.34) {
      float hit = exp(-(cadT - 0.34) / 0.12);
      col += dotAt(p, vec2(X1 + 0.17, wy(0.0)), 0.013, BRASS, (0.55 + 0.45 * hit) * uDyn);
      col += BRASS * stroke(rimD, 0.0035) * (0.12 + 0.5 * hit) * uDyn;
    }
  }
  return col;
}
`

// ============================================================== M · Minimalist
// Piano Phase. Two rings of twelve lamps play the same twelve-note pattern (E F# B C#
// D F# E C# B F# D C#; lamp size follows pitch), one cycle per beat. Piano II fades in
// on the unison during beat 0, then pushes ahead and gains exactly one full cycle, so
// it drifts through every offset (the two heads part and close again) and locks with Piano I on the final beat, the moment Bypass opens. Lock: the
// rings close onto one radius and all twelve sound together, in brass. Turn back:
// stops dead.
const MINIMALIST = /* glsl */ `
const float PAT[12] = float[12](4., 6., 11., 13., 14., 6., 4., 13., 11., 6., 14., 13.);

vec3 stage(vec2 p) {
  float t = uT;
  bool still = uStill > 0.5;
  float cadT = still ? -1.0 : t - uTotal;
  float lock = still ? 0.0 : easeIO(cadT / 0.45);
  float tr = uTurn >= 0.0 ? 1.0 - exp(-uTurn / 0.06) : 0.0;
  float tc = clamp(t, 0.0, uTotal);
  float posA = tc / uBeat;
  float posB = tc <= uBeat ? tc / uBeat : 1.0 + (tc / uBeat - 1.0) * uN / (uN - 1.0);
  float cycB = tc <= uBeat ? uBeat : uBeat * (uN - 1.0) / uN;
  float inB = still ? 1.0 : easeIO(t / uBeat);
  float tau = 0.20 * uBeat;
  float rA = mix(0.48, 0.56, lock), rB = mix(0.64, 0.56, lock);
  float r = length(p);
  float a = atan(p.x, p.y);
  if (a < 0.0) a += 2.0 * PI;
  int j = int(mod(floor(a / (2.0 * PI) * 12.0 + 0.5), 12.0));
  float aj = float(j) / 12.0 * 2.0 * PI;
  vec3 col = BG + vec3(0.020, 0.017, 0.014) * halo(r, 0.9);
  vec3 ivory = vec3(0.90, 0.86, 0.80), cool = vec3(0.72, 0.76, 0.84);

  for (int ring = 0; ring < 2; ring++) {
    float R = ring == 0 ? rA : rB;
    float pos = ring == 0 ? posA : posB;
    float cyc = ring == 0 ? uBeat : cycB;
    float dd = length(p - R * vec2(sin(aj), cos(aj)));
    float size = 0.010 + 0.0010 * (PAT[j] - 4.0);
    float b;
    if (still) b = 0.32 + (j == 0 ? 0.12 : 0.0);
    else {
      float since = pos - float(j) / 12.0;
      b = since < 0.0 ? 0.0 : exp(-fract(since) * cyc / tau);
      if (j == 0 && ring == 0) b *= 1.35;                          // Piano I's downbeat: the count
      b = 0.08 + 0.92 * b;
      if (ring == 1) b *= inB;
      b = mix(b, 0.50 + 0.50 * exp(-max(cadT, 0.0) / 0.25), lock);
      b *= 1.0 - tr;
    }
    vec3 lc = mix(ring == 0 ? ivory : cool, BRASS, lock);
    col += lc * (stroke(dd, size) * 0.58 + halo(dd, 0.03) * 0.18) * b * uDyn;
  }
  return col;
}
`

const make = (body: string) => PRELUDE + body + MAIN

export const FRAGMENTS: Record<GenreKey, string> = {
  B: make(BAROQUE),
  R: make(ROMANTIC),
  I: make(IMPRESSIONIST),
  J: make(JAZZ),
  M: make(MINIMALIST),
}
