/* ============================================================
   Obra de Cora · a casa que sobe no scroll
   Uma maquete em WebGL que passa pelas quatro etapas que a empresa
   vende: o traço da planta, a estrutura (com elétrica e hidráulica),
   a alvenaria e o acabamento com marcenaria e luz acesa.
   Quem manda no tempo é o app.js, que chama cena.set(t) com t de 0 a 1.

   Esse arquivo é a fonte. O site carrega o empacotado em
   site/js/cena.js (ver package.json, "npm run build").
   ============================================================ */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const GRAU = Math.PI / 180;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const janela = (t, a, b) => clamp((t - a) / (b - a));
const suave = t => t * t * (3 - 2 * t);
const saida = t => 1 - Math.pow(1 - t, 3);
const mola = t => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const mix = (a, b, t) => a + (b - a) * t;

const COR = {
  fundo: 0x0b0a08,
  ouro: 0xe1d9a5,
  linha: 0xdcc27c,
  agua: 0x49c4cf,
  fio: 0xffb04a,
  concreto: 0x8d887c,
  tijolo: 0xa8775c,
  branco: 0xe9e2d2,
  pedra: 0x38332d,
  madeira: 0x93704f,
  madeiraEscura: 0x5e4630,
  tecido: 0xd6c9b0,
  metal: 0x1d1b18,
  gramado: 0x2c3a2b,
  folha: 0x27322a,
  piso: 0x4a453d,
  lote: 0x161412
};

/* ---------- linhas douradas ----------
   Linha de WebGL tem 1px e some no celular. Aqui cada linha é uma
   caixinha fina, então tem espessura de verdade e dá pra "desenhar"
   esticando do começo até o fim. */
class Linhas {
  constructor(cor, forca = 1) {
    this.it = [];
    this.mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(cor).multiplyScalar(forca), transparent: true
    });
    this.g = -1;
  }
  add(a, b, t0 = 0, t1 = 1, larg = 0.05, alt = larg) {
    this.it.push({ a: new THREE.Vector3(...a), b: new THREE.Vector3(...b), t0, t1, larg, alt });
    return this;
  }
  /* sequência de pontos, cada trecho entra depois do anterior */
  caminho(pts, t0, t1, larg, alt) {
    const n = pts.length - 1, d = (t1 - t0) / n;
    for (let i = 0; i < n; i++) this.add(pts[i], pts[i + 1], t0 + d * i, t0 + d * (i + 1), larg, alt);
    return this;
  }
  ret(x0, x1, z0, z1, y, t0, t1, larg, alt) {
    return this.caminho([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [x0, y, z0]], t0, t1, larg, alt);
  }
  tracejado(a, b, t0, t1, larg, alt, cheio = 0.42, vao = 0.3) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const len = A.distanceTo(B), dir = B.clone().sub(A).normalize();
    const n = Math.max(1, Math.round(len / (cheio + vao)));
    const passo = len / n;
    for (let i = 0; i < n; i++) {
      const p = A.clone().addScaledVector(dir, passo * i);
      const q = p.clone().addScaledVector(dir, passo * (cheio / (cheio + vao)));
      const k0 = t0 + (t1 - t0) * (i / n), k1 = t0 + (t1 - t0) * ((i + 1) / n);
      this.add(p.toArray(), q.toArray(), k0, k1, larg, alt);
    }
    return this;
  }
  arco(cx, cz, r, a0, a1, y, t0, t1, larg, alt, seg = 12) {
    const pts = [];
    for (let i = 0; i <= seg; i++) {
      const a = mix(a0, a1, i / seg) * GRAU;
      pts.push([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r]);
    }
    return this.caminho(pts, t0, t1, larg, alt);
  }
  /* as 12 arestas de um volume: base, prumos, topo */
  arestas([x0, x1, y0, y1, z0, z1], t0, t1, e = 0.05) {
    const d = t1 - t0, a = t0, b = t0 + d * 0.3, c = t0 + d * 0.62;
    this.ret(x0, x1, z0, z1, y0, a, b + d * 0.05, e, e);
    for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) this.add([x, y0, z], [x, y1, z], b, c + d * 0.08, e, e);
    this.ret(x0, x1, z0, z1, y1, c, t1, e, e);
    return this;
  }
  build(pai) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0.5, 0, 0);
    const X = new THREE.Vector3(1, 0, 0);
    for (const it of this.it) {
      const dir = it.b.clone().sub(it.a);
      it.len = dir.length();
      it.q = new THREE.Quaternion().setFromUnitVectors(X, dir.normalize());
    }
    this.mesh = new THREE.InstancedMesh(geo, this.mat, this.it.length);
    this.mesh.frustumCulled = false;
    pai.add(this.mesh);
    this.set(0);
    return this;
  }
  set(g) {
    if (g === this.g) return;
    this.g = g;
    const m = new THREE.Matrix4(), s = new THREE.Vector3();
    for (let i = 0; i < this.it.length; i++) {
      const it = this.it[i];
      const p = saida(janela(g, it.t0, it.t1));
      if (p <= 0) s.set(0, 0, 0); else s.set(Math.max(it.len * p, 1e-4), it.alt, it.larg);
      m.compose(it.a, it.q, s);
      this.mesh.setMatrixAt(i, m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  alfa(o) {
    this.mat.opacity = o;
    this.mesh.visible = o > 0.003;
  }
}

/* ---------- volumes ----------
   Todo sólido do mesmo material vai num InstancedMesh só. Cada peça
   sabe de qual etapa depende (v) e em que pedaço dela aparece. */
class Solidos {
  constructor(mat, o = {}) {
    this.mat = mat; this.o = o; this.it = [];
  }
  add(b, v, t0 = 0, t1 = 1, modo = 'y') {
    this.it.push({ b, v, t0, t1, modo, p: -1 });
    return this;
  }
  build(pai) {
    const geo = this.o.geo || new THREE.BoxGeometry(1, 1, 1);
    const m = this.mesh = new THREE.InstancedMesh(geo, this.mat, this.it.length);
    m.castShadow = this.o.sombra !== false;
    m.receiveShadow = this.o.recebe !== false;
    m.frustumCulled = false;
    if (this.o.ordem != null) m.renderOrder = this.o.ordem;
    pai.add(m);
    return this;
  }
  update(vars) {
    const m = new THREE.Matrix4(), pos = new THREE.Vector3(), s = new THREE.Vector3(), q = new THREE.Quaternion();
    let mudou = false;
    for (let i = 0; i < this.it.length; i++) {
      const it = this.it[i];
      const p = it.v ? suave(janela(vars[it.v], it.t0, it.t1)) : 1;
      if (p === it.p) continue;
      it.p = p; mudou = true;
      const [x0, x1, y0, y1, z0, z1] = it.b;
      let sx = x1 - x0, sy = y1 - y0, sz = z1 - z0;
      let px = (x0 + x1) / 2, py = (y0 + y1) / 2, pz = (z0 + z1) / 2;
      /* escala quase zero num eixo só dá divisão por zero na normal, e o
         pixel inválido vira um retângulo preto quando passa pelo brilho */
      if (p < 0.001) { sx = sy = sz = 0; }
      else if (it.modo === 'y') { sy *= p; py = y0 + sy / 2; }
      else if (it.modo === 'y-') { sy *= p; py = y1 - sy / 2; }
      else if (it.modo === 'x') { sx *= p; px = x0 + sx / 2; }
      else if (it.modo === 'x-') { sx *= p; px = x1 - sx / 2; }
      else if (it.modo === 'z') { sz *= p; pz = z0 + sz / 2; }
      else if (it.modo === 'pop') { const k = mola(p); sx *= k; sy *= k; sz *= k; py = y0 + sy / 2; }
      m.compose(pos.set(px, py, pz), q, s.set(sx, sy, sz));
      this.mesh.setMatrixAt(i, m);
    }
    if (mudou) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

function suportado() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch (e) { return false; }
}

/* calma = a pessoa pediu menos movimento no sistema. A casa continua
   subindo porque quem move é o scroll dela, mas some tudo que anda
   sozinho: o traço que se desenha, o balanço da câmera e o mouse. */
function criar({ canvas, rotulos, qualidade, calma = false }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COR.fundo);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.22;

  const camera = new THREE.PerspectiveCamera(27, 1, 1, 400);

  /* ---------- luz ---------- */
  const ceu = new THREE.HemisphereLight(0xdfe6f0, 0x2a241c, 0.85);
  scene.add(ceu);
  const sol = new THREE.DirectionalLight(0xfff0dc, 2.25);
  sol.position.set(-15, 24, 17);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 80 });
  sol.shadow.bias = -0.0004;
  sol.shadow.normalBias = 0.04;
  sol.shadow.radius = 3;
  scene.add(sol);
  const COR_DIA = new THREE.Color(0xfff0dc), COR_NOITE = new THREE.Color(0x7c93c9);

  const luzSala = new THREE.PointLight(0xffbf7a, 0, 16, 1.8);
  luzSala.position.set(-1.4, 1.9, 0.1);
  const luzSuite = new THREE.PointLight(0xffc587, 0, 16, 1.8);
  luzSuite.position.set(-4.4, 5.0, 0.2);
  const luzEscritorio = new THREE.PointLight(0xffc587, 0, 14, 1.8);
  luzEscritorio.position.set(0.5, 5.0, 0.2);
  const luzPiscina = new THREE.PointLight(0x4fd0dc, 0, 12, 1.8);
  luzPiscina.position.set(-5.8, 1.1, 5.8);
  const luzVaranda = new THREE.PointLight(0xffc587, 0, 10, 1.8);
  luzVaranda.position.set(-5.9, 2.5, 0);
  scene.add(luzSala, luzSuite, luzEscritorio, luzPiscina, luzVaranda);

  /* ---------- materiais ---------- */
  const fosco = (cor, o = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.92, metalness: 0, ...o });
  const mLote = fosco(COR.lote, { roughness: 1 });
  const mConcreto = fosco(COR.concreto);
  const mBranco = fosco(COR.tijolo);
  const mPedra = fosco(COR.tijolo);
  const mTorre = fosco(COR.tijolo);
  const mMadeira = fosco(COR.madeira, { roughness: 0.75 });
  const mMadeiraEsc = fosco(COR.madeiraEscura, { roughness: 0.8 });
  const mTecido = fosco(COR.tecido, { roughness: 1 });
  const mMetal = fosco(COR.metal, { roughness: 0.5, metalness: 0.6 });
  const mDeck = fosco(0x7d5d42, { roughness: 0.85 });
  const mPiso = fosco(COR.piso);
  const mGramado = fosco(COR.gramado, { roughness: 1 });
  const mFolha = fosco(COR.folha, { roughness: 1 });
  const mVidro = new THREE.MeshStandardMaterial({
    color: 0xa9c1cc, roughness: 0.42, metalness: 0.15, transparent: true, opacity: 0, depthWrite: false
  });
  const mAgua = new THREE.MeshStandardMaterial({
    color: 0x1f8a99, roughness: 0.5, metalness: 0, emissive: 0x2fb7c6, emissiveIntensity: 0.12,
    transparent: true, opacity: 0.94
  });
  const mLed = new THREE.MeshStandardMaterial({ color: 0x2a251d, emissive: 0xffc98a, emissiveIntensity: 0 });
  const mBrilho = new THREE.MeshBasicMaterial({
    color: 0xffb060, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
  });
  /* cada parede nasce cor de tijolo e ganha a cor final no acabamento */
  const pintura = [
    [mConcreto, new THREE.Color(COR.concreto), new THREE.Color(COR.branco), 0, 0.7],
    [mBranco, new THREE.Color(COR.tijolo), new THREE.Color(COR.branco), 0.1, 0.8],
    [mPedra, new THREE.Color(COR.tijolo), new THREE.Color(COR.pedra), 0.25, 0.9],
    [mTorre, new THREE.Color(COR.tijolo), new THREE.Color(COR.madeira), 0.4, 1]
  ];

  const mundo = new THREE.Group();
  scene.add(mundo);

  /* ---------- o terreno ---------- */
  const lote = new THREE.Mesh(new THREE.BoxGeometry(21.2, 0.5, 16.2), mLote);
  lote.position.y = -0.25;
  lote.receiveShadow = true;
  mundo.add(lote);

  /* malha de 1 em 1 metro, como papel milimetrado */
  let malha;
  {
    const p = [];
    for (let x = -10; x <= 10; x++) p.push(x, 0.006, -8.1, x, 0.006, 8.1);
    for (let z = -8; z <= 8; z++) p.push(-10.6, 0.006, z, 10.6, 0.006, z);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    malha = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: COR.ouro, transparent: true, opacity: 0.07, depthWrite: false }));
    mundo.add(malha);
  }

  /* poça de luz embaixo da maquete */
  {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(214,190,140,.22)');
    gr.addColorStop(0.4, 'rgba(214,190,140,.06)');
    gr.addColorStop(1, 'rgba(214,190,140,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(58, 58),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.55 }));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -0.52;
    mundo.add(halo);
  }

  /* ---------- medidas da casa (metros) ---------- */
  const A = [-4.5, 6, 0, 3, -3.5, 2.5];        // térreo: sala e garagem
  const B = [-7, 3, 3, 6.4, -3.5, 3.5];        // pavimento de cima, em balanço
  const C = [3, 6, 3, 7.6, -3.5, 0.5];         // caixa da escada
  const PISC = [-8.5, -3.2, 4.2, 7.4];         // x0 x1 z0 z1

  /* ---------- 1. o traço: planta baixa no chão ---------- */
  const y0 = 0.03, lw = 0.06, lh = 0.014;
  const planta = new Linhas(COR.linha, 1.75);
  planta.ret(-10.6, 10.6, -8.1, 8.1, y0, 0, 0.5, 0.035, lh);
  planta.ret(A[0], A[1], A[4], A[5], y0, 0.08, 0.5, lw, lh);
  planta.ret(A[0] + 0.25, 1.5, A[4] + 0.25, A[5] - 0.25, y0, 0.16, 0.56, 0.04, lh);
  planta.ret(1.75, A[1] - 0.25, A[4] + 0.25, A[5] - 0.25, y0, 0.2, 0.6, 0.04, lh);
  /* cozinha, no fundo da sala */
  planta.caminho([[-4.25, y0, -0.9], [-2.9, y0, -0.9]], 0.3, 0.5, 0.04, lh);
  planta.caminho([[-2.1, y0, -0.9], [-2.1, y0, -3.25]], 0.34, 0.56, 0.04, lh);
  planta.arco(-2.1, -0.9, 0.8, 90, 180, y0, 0.44, 0.62, 0.028, lh);
  planta.add([-2.1, y0, -0.9], [-2.1, y0, -0.1], 0.44, 0.56, 0.028, lh);
  /* porta de entrada */
  planta.arco(1.4, 2.25, 0.9, 180, 270, y0, 0.48, 0.66, 0.028, lh);
  planta.add([1.4, y0, 2.25], [1.4, y0, 1.35], 0.48, 0.6, 0.028, lh);
  /* escada */
  for (let i = 0; i < 11; i++) planta.add([2.1 + i * 0.3, y0, -3.25], [2.1 + i * 0.3, y0, -2.2], 0.4 + i * 0.012, 0.56 + i * 0.012, 0.028, lh);
  planta.add([2.1, y0, -2.2], [5.1, y0, -2.2], 0.44, 0.66, 0.028, lh);
  planta.caminho([[2.3, y0, -2.72], [4.9, y0, -2.72], [4.7, y0, -2.92]], 0.52, 0.72, 0.028, lh);
  /* carro na garagem */
  planta.caminho([[2.9, y0, -1.5], [3.15, y0, -1.75], [4.45, y0, -1.75], [4.7, y0, -1.5], [4.7, y0, 1.7], [4.45, y0, 1.95], [3.15, y0, 1.95], [2.9, y0, 1.7], [2.9, y0, -1.5]], 0.5, 0.82, 0.028, lh);
  planta.add([3.0, y0, -0.8], [4.6, y0, -0.8], 0.66, 0.8, 0.028, lh);
  planta.add([3.0, y0, 1.1], [4.6, y0, 1.1], 0.68, 0.82, 0.028, lh);
  /* sofá, tapete, mesa de jantar */
  planta.ret(-3.6, -1.0, -0.2, 0.7, y0, 0.54, 0.76, 0.028, lh);
  planta.add([-3.6, y0, 0.05], [-1.0, y0, 0.05], 0.62, 0.78, 0.028, lh);
  planta.ret(-2.75, -1.75, 1.05, 1.55, y0, 0.6, 0.8, 0.028, lh);
  planta.ret(-0.45, 0.95, -2.6, -0.95, y0, 0.58, 0.8, 0.028, lh);
  /* piscina e deck */
  planta.ret(PISC[0], PISC[1], PISC[2], PISC[3], y0, 0.3, 0.7, lw, lh);
  planta.ret(PISC[0] + 0.22, PISC[1] - 0.22, PISC[2] + 0.22, PISC[3] - 0.22, y0, 0.4, 0.78, 0.028, lh);
  planta.ret(-9.3, -2.3, 3.5, 8.0, y0, 0.46, 0.84, 0.028, lh);
  for (let i = 0; i < 4; i++) planta.add([-8.3 + i * 0.3, y0, 4.42], [-8.3 + i * 0.3, y0, 5.3], 0.6 + i * 0.02, 0.76 + i * 0.02, 0.028, lh);
  /* projeção do pavimento de cima, tracejada como manda a norma */
  planta.tracejado([B[0], y0, B[4]], [B[1], y0, B[4]], 0.55, 0.75, 0.03, lh);
  planta.tracejado([B[1], y0, B[4]], [B[1], y0, B[5]], 0.62, 0.82, 0.03, lh);
  planta.tracejado([B[1], y0, B[5]], [B[0], y0, B[5]], 0.7, 0.9, 0.03, lh);
  planta.tracejado([B[0], y0, B[5]], [B[0], y0, B[4]], 0.78, 1, 0.03, lh);
  planta.build(mundo);

  /* cotas: aparecem quando a pessoa começa a rolar */
  const cotas = new Linhas(COR.linha, 1.15);
  const tique = (x, z, t) => cotas.add([x - 0.2, y0, z + 0.2], [x + 0.2, y0, z - 0.2], t, t + 0.25, 0.035, lh);
  cotas.add([A[0], y0, -5.3], [A[1], y0, -5.3], 0, 0.55, 0.03, lh);
  for (const x of [A[0], 1.62, A[1]]) { cotas.add([x, y0, -3.75], [x, y0, -5.55], 0.05, 0.5, 0.022, lh); tique(x, -5.3, 0.3); }
  cotas.add([7.5, y0, A[4]], [7.5, y0, A[5]], 0.2, 0.7, 0.03, lh);
  for (const z of [A[4], A[5]]) { cotas.add([6.25, y0, z], [7.75, y0, z], 0.22, 0.6, 0.022, lh); tique(7.5, z, 0.45); }
  cotas.add([PISC[0], y0, 8.6], [PISC[1], y0, 8.6], 0.4, 0.9, 0.03, lh);
  for (const x of [PISC[0], PISC[1]]) { cotas.add([x, y0, 7.6], [x, y0, 8.85], 0.42, 0.8, 0.022, lh); tique(x, 8.6, 0.65); }
  cotas.build(mundo);

  /* ---------- 2. engenharia: aramado, elétrica e hidráulica ---------- */
  const arame = new Linhas(COR.linha, 1.6);
  /* um dedo pra fora do volume, senão o arame briga com a parede no mesmo plano */
  const folga = v => [v[0] - 0.04, v[1] + 0.04, v[2], v[3] + 0.04, v[4] - 0.04, v[5] + 0.04];
  arame.arestas(folga(A), 0, 0.62);
  arame.arestas(folga(B), 0.2, 0.86);
  arame.arestas(folga(C), 0.4, 1);
  arame.build(mundo);

  /* o volume em fantasma desde o primeiro segundo, pra silhueta já existir */
  const fantasma = new THREE.Group();
  for (const v of [A, B, C]) {
    const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(v[1] - v[0], v[3] - v[2], v[5] - v[4]));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: COR.ouro, transparent: true, opacity: 0.13, depthWrite: false }));
    l.position.set((v[0] + v[1]) / 2, (v[2] + v[3]) / 2, (v[4] + v[5]) / 2);
    fantasma.add(l);
  }
  mundo.add(fantasma);

  const hidro = new Linhas(COR.agua, 1.5);
  hidro.caminho([[-5.8, 0.2, 4.3], [-5.8, 0.2, 3.1], [-4.0, 0.2, 3.1], [-4.0, 0.2, -3.0], [-4.0, 5.9, -3.0]], 0, 0.6, 0.07);
  hidro.caminho([[-4.0, 3.5, -3.0], [2.4, 3.5, -3.0], [2.4, 0.3, -3.0]], 0.4, 0.85, 0.07);
  hidro.caminho([[-4.0, 5.9, -3.0], [-6.4, 5.9, -3.0], [-6.4, 5.9, -1.2]], 0.55, 1, 0.07);
  hidro.caminho([[-4.0, 0.9, -1.6], [-4.0, 0.9, -3.0]], 0.3, 0.5, 0.07);
  hidro.build(mundo);

  const eletrica = new Linhas(COR.fio, 1.5);
  eletrica.caminho([[5.6, 0.3, 2.2], [5.6, 2.75, 2.2], [-4.2, 2.75, 2.2]], 0, 0.5, 0.06);
  eletrica.caminho([[1.62, 2.75, 2.2], [1.62, 5.95, 2.2], [-6.6, 5.95, 2.2]], 0.3, 0.8, 0.06);
  eletrica.caminho([[1.62, 5.95, 2.2], [1.62, 5.95, -3.0], [4.5, 5.95, -3.0], [4.5, 7.2, -3.0]], 0.55, 1, 0.06);
  for (const [x, t] of [[-3.4, 0.4], [-1.2, 0.46], [0.6, 0.52]]) eletrica.add([x, 2.75, 2.2], [x, 1.25, 2.2], t, t + 0.2, 0.06);
  for (const [x, t] of [[-5.4, 0.72], [-3.0, 0.78], [-0.6, 0.84]]) eletrica.add([x, 5.95, 2.2], [x, 4.5, 2.2], t, t + 0.16, 0.06);
  eletrica.build(mundo);

  /* ---------- estrutura: lajes e pilares ---------- */
  const estrutura = new Solidos(mConcreto);
  estrutura.add([-4.7, 6.2, 0, 0.15, -3.7, 2.7], 'S', 0, 0.2, 'x');
  const P = 0.14;
  const pilares = (lista, ya, yb, t0, t1) => lista.forEach(([x, z], i) => {
    const k = t0 + (t1 - t0 - 0.12) * (i / Math.max(1, lista.length - 1));
    estrutura.add([x - P, x + P, ya, yb, z - P, z + P], 'S', k, k + 0.12, 'y');
  });
  pilares([[-4.36, -3.36], [-4.36, 2.36], [-1.5, -3.36], [1.62, -3.36], [1.62, 2.36], [5.86, -3.36], [5.86, 2.36]], 0.15, 3.0, 0.14, 0.4);
  for (const z of [-3.2, 3.2]) estrutura.add([-6.8, -6.6, 0, 3.0, z - 0.1, z + 0.1], 'S', 0.34, 0.46, 'y');
  estrutura.add([-4.7, 6.2, 2.85, 3.0, -3.7, 2.7], 'S', 0.4, 0.56, 'x');
  estrutura.add([-7, 3, 3.0, 3.3, -3.5, 3.5], 'S', 0.44, 0.62, 'x-');
  pilares([[-6.86, -3.36], [-6.86, 3.36], [-2.1, -3.36], [2.86, -3.36], [2.86, 3.36]], 3.3, 6.1, 0.58, 0.78);
  pilares([[3.14, -3.36], [5.86, -3.36], [3.14, 0.36], [5.86, 0.36]], 3.0, 7.4, 0.6, 0.86);
  estrutura.add([-7.15, 3.15, 6.1, 6.4, -3.65, 3.65], 'S', 0.78, 0.94, 'x');
  estrutura.add([2.9, 6.1, 7.4, 7.6, -3.6, 0.6], 'S', 0.86, 1, 'x');
  estrutura.build(mundo);

  /* ---------- 3. a obra: alvenaria ---------- */
  const paredesPedra = new Solidos(mPedra);
  paredesPedra.add([-4.5, 6, 0.15, 2.85, -3.5, -3.25], 'W', 0, 0.3);
  paredesPedra.add([5.75, 6, 0.15, 2.85, -3.25, 2.5], 'W', 0.06, 0.36);
  paredesPedra.add([1.5, 1.75, 0.15, 2.85, -3.25, 2.5], 'W', 0.1, 0.4);
  paredesPedra.add([1.75, 5.75, 2.4, 2.85, 2.25, 2.5], 'W', 0.3, 0.44);
  paredesPedra.add([-2.2, -2.0, 0.15, 2.85, -3.25, -0.9], 'W', 0.14, 0.42);
  paredesPedra.build(mundo);

  const paredesBrancas = new Solidos(mBranco);
  paredesBrancas.add([-7, 3, 3.3, 6.1, -3.5, -3.25], 'W', 0.42, 0.72);
  paredesBrancas.add([-7, -6.75, 3.3, 6.1, -3.25, 3.5], 'W', 0.48, 0.78);
  paredesBrancas.add([2.75, 3, 3.3, 6.1, -3.25, 3.5], 'W', 0.52, 0.82);
  paredesBrancas.add([-2.2, -2.0, 3.3, 6.1, -3.25, 1.4], 'W', 0.56, 0.84);
  paredesBrancas.build(mundo);

  const torre = new Solidos(mTorre);
  torre.add([3, 6, 3.0, 7.4, -3.5, 0.5], 'W', 0.6, 1);
  torre.build(mundo);

  /* ---------- 4. acabamento ---------- */
  const vidros = new Solidos(mVidro, { sombra: false, recebe: false, ordem: 5 });
  vidros.add([-4.4, 1.5, 0.15, 2.85, 2.38, 2.42], null);
  vidros.add([-4.42, -4.38, 0.15, 2.85, -3.25, 2.4], null);
  vidros.add([-6.75, 2.75, 3.3, 6.1, 2.3, 2.34], null);
  vidros.add([-6.75, 0.15, 3.3, 4.3, 3.4, 3.43], null);
  vidros.build(mundo);

  const esquadrias = new Solidos(mMetal);
  for (const x of [-4.4, -2.9, -1.45, 0]) esquadrias.add([x - 0.03, x + 0.03, 0.15, 2.85, 2.36, 2.44], 'F', 0, 0.3);
  for (const z of [-1.35, 0.5]) esquadrias.add([-4.44, -4.36, 0.15, 2.85, z - 0.03, z + 0.03], 'F', 0.05, 0.35);
  for (const x of [-4.4, -2.0, 0.4]) esquadrias.add([x - 0.03, x + 0.03, 3.3, 6.1, 2.28, 2.36], 'F', 0.1, 0.4);
  esquadrias.add([-6.75, 0.15, 4.3, 4.34, 3.38, 3.45], 'F', 0.2, 0.5, 'x');
  esquadrias.build(mundo);

  /* ripado de madeira na fachada, e o portão da garagem */
  const ripas = new Solidos(mMadeira);
  for (let i = 0; i < 12; i++) {
    const x = 0.32 + i * 0.215;
    ripas.add([x, x + 0.1, 3.3, 6.1, 3.34, 3.48], 'F', 0.1 + i * 0.045, 0.34 + i * 0.045, 'y-');
  }
  for (let i = 0; i < 12; i++) {
    const y = 0.17 + i * 0.186;
    ripas.add([1.77, 5.73, y, y + 0.165, 2.3, 2.38], 'F', 0.05 + i * 0.03, 0.25 + i * 0.03, 'x');
  }
  /* frisos na caixa da escada */
  for (let i = 0; i < 13; i++) {
    const x = 3.1 + i * 0.225;
    if (x > 4.25 && x < 4.75) continue;
    ripas.add([x, x + 0.11, 3.05, 7.38, 0.5, 0.56], 'F', 0.3 + i * 0.03, 0.55 + i * 0.03, 'y');
  }
  ripas.build(mundo);

  /* marcenaria */
  const moveisMadeira = new Solidos(mMadeira);
  moveisMadeira.add([-4.2, -2.25, 0.15, 2.7, -3.25, -2.9], 'M', 0.0, 0.3, 'y');      // armário da cozinha
  moveisMadeira.add([-1.95, 1.45, 0.15, 2.7, -3.25, -2.95], 'M', 0.08, 0.38, 'y');   // estante da sala
  moveisMadeira.add([-0.45, 0.95, 0.82, 0.9, -2.6, -0.95], 'M', 0.3, 0.5, 'pop');    // tampo da mesa
  moveisMadeira.add([-2.75, -1.75, 0.15, 0.48, 1.05, 1.55], 'M', 0.36, 0.56, 'pop'); // mesa de centro
  moveisMadeira.add([-6.3, -2.6, 3.3, 5.4, -3.25, -3.1], 'M', 0.42, 0.7, 'y');       // cabeceira
  moveisMadeira.add([-1.8, 2.6, 3.3, 5.9, -3.25, -2.9], 'M', 0.5, 0.78, 'y');        // estante do escritório
  moveisMadeira.add([-0.6, 1.6, 4.0, 4.07, -1.4, -0.7], 'M', 0.66, 0.86, 'pop');     // bancada
  moveisMadeira.add([-6.45, -5.15, 0.84, 0.9, -1.3, 1.3], 'M', 0.6, 0.84, 'pop');    // mesa da varanda
  moveisMadeira.build(mundo);

  const moveisEscuros = new Solidos(mMadeiraEsc);
  moveisEscuros.add([-0.3, -0.2, 0.15, 0.82, -2.45, -2.35], 'M', 0.3, 0.5);
  moveisEscuros.add([0.7, 0.8, 0.15, 0.82, -2.45, -2.35], 'M', 0.3, 0.5);
  moveisEscuros.add([-0.3, -0.2, 0.15, 0.82, -1.2, -1.1], 'M', 0.3, 0.5);
  moveisEscuros.add([0.7, 0.8, 0.15, 0.82, -1.2, -1.1], 'M', 0.3, 0.5);
  moveisEscuros.add([-4.2, -2.25, 0.9, 0.96, -2.9, -2.3], 'M', 0.14, 0.4, 'x');      // bancada da cozinha
  moveisEscuros.add([-0.5, -0.42, 3.3, 4.0, -1.35, -0.75], 'M', 0.66, 0.86);
  moveisEscuros.add([1.42, 1.5, 3.3, 4.0, -1.35, -0.75], 'M', 0.66, 0.86);
  moveisEscuros.add([-5.86, -5.74, 0.1, 0.84, -1.0, -0.88], 'M', 0.6, 0.8);
  moveisEscuros.add([-5.86, -5.74, 0.1, 0.84, 0.88, 1.0], 'M', 0.6, 0.8);
  moveisEscuros.build(mundo);

  const estofados = new Solidos(mTecido);
  estofados.add([-3.6, -1.0, 0.15, 0.58, -0.2, 0.7], 'M', 0.2, 0.44, 'pop');         // sofá
  estofados.add([-3.6, -1.0, 0.58, 0.95, -0.2, 0.06], 'M', 0.26, 0.48, 'pop');
  estofados.add([-3.6, -3.3, 0.58, 0.85, 0.06, 0.7], 'M', 0.28, 0.5, 'pop');
  estofados.add([-3.9, -0.6, 0.15, 0.17, 0.2, 2.0], 'M', 0.16, 0.36, 'x');           // tapete
  estofados.add([-5.6, -3.5, 3.3, 3.85, -3.05, -0.9], 'M', 0.5, 0.74, 'pop');        // cama
  estofados.add([-5.5, -3.6, 3.85, 4.0, -3.0, -2.5], 'M', 0.56, 0.78, 'pop');
  estofados.build(mundo);

  /* perfis de LED: é o que acende no fim */
  const leds = new Solidos(mLed, { sombra: false, recebe: false });
  for (const z of [-1.7, -0.4, 0.9]) leds.add([-3.9, 1.0, 2.8, 2.84, z - 0.03, z + 0.03], 'M', 0.4, 0.7, 'x');
  for (const z of [-1.5, 0.4]) leds.add([-6.2, 2.2, 6.04, 6.08, z - 0.03, z + 0.03], 'M', 0.6, 0.9, 'x');
  leds.add([-6.7, 2.7, 6.03, 6.08, 3.18, 3.26], 'M', 0.7, 1, 'x');                   // sanca da varanda
  for (const y of [1.0, 1.75, 2.45]) leds.add([-1.9, 1.4, y, y + 0.035, -2.96, -2.92], 'M', 0.3, 0.6, 'x');
  for (const y of [4.2, 5.0, 5.7]) leds.add([-1.7, 2.5, y, y + 0.035, -2.91, -2.87], 'M', 0.7, 0.95, 'x');
  leds.add([-6.3, -2.6, 5.42, 5.47, -3.22, -3.12], 'M', 0.6, 0.86, 'x');             // fita da cabeceira
  leds.add([4.35, 4.65, 3.5, 7.0, 0.5, 0.53], 'M', 0.5, 0.9, 'y');                   // rasgo de luz da escada
  leds.add([-6.9, -4.6, 2.93, 2.97, -0.05, 0.05], 'M', 0.7, 1, 'x');                 // varanda gourmet
  for (const x of [-8.9, -7.1, -5.3, -3.5]) leds.add([x, x + 0.25, 0.14, 0.18, 7.78, 7.84], 'L', 0.7, 0.95, 'x');
  leds.build(mundo);

  /* ---------- o entorno ---------- */
  const deck = new Solidos(mDeck);
  deck.add([-9.3, -2.3, 0, 0.14, 3.5, 4.2], 'L', 0, 0.35, 'x');
  deck.add([-9.3, -8.5, 0, 0.14, 4.2, 7.4], 'L', 0.1, 0.4, 'z');
  deck.add([-3.2, -2.3, 0, 0.14, 4.2, 7.4], 'L', 0.14, 0.44, 'z');
  deck.add([-9.3, -2.3, 0, 0.14, 7.4, 8.0], 'L', 0.2, 0.55, 'x');
  deck.build(mundo);

  const pisos = new Solidos(mPiso);
  pisos.add([-7.3, -4.7, 0, 0.1, -3.7, 3.5], 'L', 0.05, 0.4, 'z');
  pisos.add([-4.7, 1.7, 0, 0.1, 2.7, 3.5], 'L', 0.1, 0.4, 'x');
  pisos.add([1.75, 5.75, 0, 0.05, 2.7, 8.1], 'L', 0.15, 0.5, 'z');
  pisos.build(mundo);

  const gramado = new Solidos(mGramado, { sombra: false });
  gramado.add([6.3, 10.6, 0, 0.035, -8.1, 8.1], 'L', 0.2, 0.6, 'z');
  gramado.add([-10.6, 6.3, 0, 0.035, -8.1, -4.3], 'L', 0.25, 0.65, 'x');
  gramado.add([-10.6, -7.4, 0, 0.035, -4.3, 3.4], 'L', 0.3, 0.65, 'z');
  gramado.add([-2.2, 1.65, 0, 0.035, 3.6, 8.1], 'L', 0.35, 0.7, 'z');
  gramado.build(mundo);

  const agua = new Solidos(mAgua, { sombra: false });
  agua.add([PISC[0], PISC[1], 0.0, 0.085, PISC[2], PISC[3]], 'L', 0.45, 0.8, 'y');
  agua.build(mundo);

  /* árvores de maquete: tronco fino, copa escura e um aramado dourado
     por cima, na mesma língua das linhas da planta */
  const troncos = new Solidos(mMetal);
  const copas = new Solidos(mFolha, { geo: new THREE.IcosahedronGeometry(0.5, 2) });
  const aramados = [];
  const mArvore = new THREE.LineBasicMaterial({ color: COR.linha, transparent: true, opacity: 0, depthWrite: false });
  const geoArvore = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.53, 1));
  const arvore = (x, z, alt, raio, t0) => {
    troncos.add([x - 0.06, x + 0.06, 0, alt, z - 0.06, z + 0.06], 'L', t0, t0 + 0.22);
    copas.add([x - raio, x + raio, alt - raio * 0.5, alt + raio * 1.3, z - raio, z + raio], 'L', t0 + 0.14, t0 + 0.4, 'pop');
    const l = new THREE.LineSegments(geoArvore, mArvore);
    l.position.set(x, alt + raio * 0.4, z);
    l.scale.set(raio * 2, raio * 1.8, raio * 2);
    mundo.add(l);
    aramados.push(l);
  };
  arvore(8.3, 5.2, 2.7, 1.5, 0.5);
  arvore(5.2, -6.6, 4.2, 1.2, 0.55);
  arvore(8.6, -5.2, 1.9, 1.05, 0.6);
  arvore(9.3, 0.4, 1.5, 0.8, 0.58);
  troncos.build(mundo);
  copas.build(mundo);

  /* canteiro baixo na frente da sala */
  const canteiro = new Solidos(mFolha);
  canteiro.add([-2.1, 1.5, 0.03, 0.34, 3.7, 4.15], 'L', 0.6, 0.9, 'x');
  canteiro.build(mundo);

  /* clarão quente atrás do vidro: a luz da casa escapando pra fora */
  const brilhos = new THREE.Group();
  const cartao = (w, h, x, y, z, ry = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mBrilho);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    brilhos.add(m);
  };
  cartao(5.9, 2.7, -1.45, 1.5, 2.3);
  cartao(5.6, 2.7, -4.3, 1.5, -0.4, -Math.PI / 2);
  cartao(9.5, 2.8, -2.0, 4.7, 2.2);
  mundo.add(brilhos);

  const todos = [estrutura, paredesPedra, paredesBrancas, torre, vidros, esquadrias, ripas,
    moveisMadeira, moveisEscuros, estofados, leds, deck, pisos, gramado, agua, troncos, copas, canteiro];

  /* ---------- rótulos da planta (HTML por cima do canvas) ---------- */
  const etiquetas = [
    ['ESTAR', -2.3, 1.9], ['COZINHA', -3.2, -2.0], ['JANTAR', 0.25, -0.35], ['GARAGEM', 3.8, 0.15],
    ['PISCINA', -5.85, 5.9], ['DECK', -2.75, 6.6],
    ['10,50', 0.75, -5.85, 1], ['6,00', 8.2, -0.5, 1], ['5,30', -5.85, 9.15, 1]
  ].map(([txt, x, z, cota]) => {
    const el = document.createElement('span');
    el.className = 'rot' + (cota ? ' rot-cota' : '');
    el.textContent = txt;
    rotulos && rotulos.appendChild(el);
    return { el, v: new THREE.Vector3(x, 0.05, z) };
  });

  /* ---------- pós: o brilho das linhas e das luzes ---------- */
  let composer = null, bloom = null, baixa = qualidade === 'baixa';
  const alvo = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  function montarPos() {
    composer = new EffectComposer(renderer, alvo);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.4, 0.65, 0.9);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }
  if (!baixa) montarPos();

  /* ---------- câmera ----------
     t, azimute, elevação, distância, alvo x y z */
  const ROTA = [
    [0.00, -16, 57, 54, -0.4, 0.0, 0.6],
    [0.20, -30, 41, 49, -0.5, 1.4, 0.4],
    [0.45, -44, 25, 45, -0.6, 2.9, 0.2],
    [0.72, -22, 17, 43, -0.8, 3.1, 0.3],
    [1.00, -36, 9.5, 40, -1.1, 3.0, 0.6]
  ];
  function rota(t) {
    let i = 0;
    while (i < ROTA.length - 2 && t > ROTA[i + 1][0]) i++;
    const a = ROTA[i], b = ROTA[i + 1];
    const k = suave(janela(t, a[0], b[0]));
    return a.map((v, j) => mix(v, b[j], k));
  }

  let W = 1, H = 1, aspecto = 1, dpr = 1;
  function medir() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    aspecto = W / H;
    const celular = W < 760;
    dpr = Math.min(window.devicePixelRatio || 1, baixa ? 1 : (celular ? 1.75 : 2));
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    if (composer) { composer.setPixelRatio(dpr); composer.setSize(W, H); }
    camera.aspect = aspecto;
    /* no computador a casa fica à direita do texto, no celular acima dele */
    if (aspecto > 1.15) camera.setViewOffset(W, H, -W * 0.18, H * 0.015, W, H);
    else camera.setViewOffset(W, H, 0, H * 0.18, W, H);
    camera.updateProjectionMatrix();
  }

  /* ---------- estado ---------- */
  let alvoT = 0, t = 0, intro = 0, t0 = 0, rodando = false, raf = 0;
  let mx = 0, my = 0, mxa = 0, mya = 0;
  let quadros = 0, somaMs = 0, antes = 0, medindo = qualidade == null;
  const V = { S: 0, W: 0, F: 0, M: 0, L: 0 };
  const tmp = new THREE.Vector3();

  function aplicar(agora) {
    const seg = agora / 1000;

    /* planta: desenha sozinha quando a página abre */
    planta.set(suave(intro));
    planta.alfa(1 - janela(t, 0.7, 0.82));
    cotas.set(janela(t, 0.025, 0.15));
    cotas.alfa(1 - janela(t, 0.62, 0.74));
    malha.material.opacity = 0.075 - 0.045 * janela(t, 0.72, 0.9);

    const pArame = janela(t, 0.17, 0.37);
    arame.set(pArame);
    arame.alfa(1 - janela(t, 0.68, 0.8));
    const fo = 0.13 * intro * (1 - janela(t, 0.17, 0.3));
    fantasma.visible = fo > 0.002;
    fantasma.children.forEach(l => { l.material.opacity = fo; });

    const pTubos = janela(t, 0.33, 0.46), aTubos = 1 - janela(t, 0.55, 0.66);
    hidro.set(pTubos); hidro.alfa(aTubos);
    eletrica.set(janela(t, 0.35, 0.47)); eletrica.alfa(aTubos);

    V.S = janela(t, 0.23, 0.46);
    V.W = janela(t, 0.45, 0.71);
    V.F = janela(t, 0.75, 0.9);
    V.M = janela(t, 0.79, 0.94);
    V.L = janela(t, 0.74, 0.93);
    for (const s of todos) s.update(V);

    const pinta = janela(t, 0.71, 0.83);
    for (const [m, de, para, a, b] of pintura) m.color.lerpColors(de, para, suave(janela(pinta, a, b)));

    mVidro.opacity = 0.2 * suave(janela(t, 0.76, 0.86));
    vidros.mesh.visible = mVidro.opacity > 0.003;

    /* a noite cai e a casa acende */
    const n = suave(janela(t, 0.86, 0.99));
    sol.intensity = mix(2.25, 0.6, n);
    sol.color.lerpColors(COR_DIA, COR_NOITE, n);
    ceu.intensity = mix(0.85, 0.36, n);
    scene.environmentIntensity = mix(0.22, 0.1, n);
    mLed.emissiveIntensity = 2.6 * n;
    luzSala.intensity = 15 * n;
    luzSuite.intensity = 9 * n;
    luzEscritorio.intensity = 8 * n;
    luzVaranda.intensity = 5 * n;
    luzPiscina.intensity = 6 * n;
    mAgua.emissiveIntensity = 0.12 + n * (0.5 + (calma ? 0 : 0.05 * Math.sin(seg * 1.7)));
    mBrilho.opacity = 0.04 * n;
    mArvore.opacity = 0.34 * suave(janela(V.L, 0.75, 1)) * (1 - 0.4 * n);
    for (const l of aramados) l.visible = mArvore.opacity > 0.003;
    brilhos.visible = n > 0.01;
    if (bloom) bloom.strength = mix(0.4, 0.5, n);

    /* câmera */
    const [, az, el, dist, tx, ty, tz] = rota(t);
    mxa += (mx - mxa) * 0.05; mya += (my - mya) * 0.05;
    const vai = calma ? 0 : 1;
    const a = (az + vai * (Math.sin(seg * 0.22) * 1.6 + mxa * 5)) * GRAU;
    const e = clamp(el + vai * (Math.sin(seg * 0.17) * 0.5 - mya * 2.5), 4, 80) * GRAU;
    const d = dist * Math.max(1, 0.92 / aspecto);
    camera.position.set(tx + d * Math.sin(a) * Math.cos(e), ty + d * Math.sin(e), tz + d * Math.cos(a) * Math.cos(e));
    camera.lookAt(tx, ty, tz);
    camera.updateMatrixWorld();

    /* rótulos */
    const or = janela(t, 0.03, 0.1) * (1 - janela(t, 0.16, 0.21));
    if (rotulos) rotulos.style.opacity = or.toFixed(3);
    if (or > 0.01) {
      for (const r of etiquetas) {
        tmp.copy(r.v).project(camera);
        r.el.style.transform = `translate(${((tmp.x * 0.5 + 0.5) * W).toFixed(1)}px,${((-tmp.y * 0.5 + 0.5) * H).toFixed(1)}px) translate(-50%,-50%)`;
      }
    }
  }

  function quadro(agora) {
    raf = requestAnimationFrame(quadro);
    if (!t0) t0 = agora;
    intro = calma ? 1 : clamp((agora - t0 - 350) / 2400);
    const dt = alvoT - t;
    t = calma || Math.abs(dt) < 0.0004 ? alvoT : t + dt * 0.11;
    aplicar(agora);
    if (composer) composer.render(); else renderer.render(scene, camera);

    /* se o aparelho não dá conta, tira o brilho e a resolução extra */
    if (medindo) {
      if (antes) { somaMs += agora - antes; quadros++; }
      antes = agora;
      if (quadros === 50) {
        medindo = false;
        if (somaMs / quadros > 36) reduzir();
      }
    }
  }

  function reduzir() {
    baixa = true;
    composer = null; bloom = null;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    sol.shadow.mapSize.set(1024, 1024);
    if (sol.shadow.map) { sol.shadow.map.dispose(); sol.shadow.map = null; }
    medir();
  }

  function mouse(e) {
    mx = (e.clientX / innerWidth) * 2 - 1;
    my = (e.clientY / innerHeight) * 2 - 1;
  }
  if (!calma && matchMedia('(hover: hover) and (pointer: fine)').matches) addEventListener('pointermove', mouse, { passive: true });

  medir();
  aplicar(0);

  return {
    set(v) { alvoT = clamp(v); },
    /* pula direto pro ponto, sem amortecer (usado quando a animação está desligada) */
    fixar(v) { alvoT = t = clamp(v); intro = 1; t0 = -1e6; aplicar(performance.now()); if (composer) composer.render(); else renderer.render(scene, camera); },
    medir,
    rodar(sim) {
      if (sim === rodando) return;
      rodando = sim;
      if (sim) { antes = 0; raf = requestAnimationFrame(quadro); } else cancelAnimationFrame(raf);
    },
    get t() { return t; }
  };
}

window.CenaObra = { criar, suportado };
