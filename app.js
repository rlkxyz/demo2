/* ============================================================
   Obra de Cora · comportamento da página
   O scroll manda em três coisas: a casa 3D do topo (cena.js), a frase
   do propósito que acende palavra por palavra e a galeria da Mansão
   Costa Verde, que anda de lado. O resto é filtro, visor de fotos,
   comparador e o formulário que abre o WhatsApp.
   ============================================================ */
(() => {
'use strict';

const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const janela = (t, a, b) => clamp((t - a) / (b - a));
const REDUZIDO = matchMedia('(prefers-reduced-motion: reduce)').matches;
const raiz = document.documentElement;
const ZAP = '5521983608787';

/* ---------- a casa que sobe ---------- */
const constr = $('#inicio');
const hero = $('#hero');
const etapas = $$('.etapa').map(el => ({ el, de: +el.dataset.de, ate: +el.dataset.ate }));
const regua = $('#regua');
const reguaBtns = $$('button', regua);
const carimboNum = $('#carimboNum'), carimboNome = $('#carimboNome');
const dica = $('#dica');
const topo = $('#topo');
const zap = $('#zap');

/* em que ponto do scroll cada etapa começa, e o que o carimbo mostra */
const FASES = [
  [0.00, '01/04', 'Planta baixa · térreo'],
  [0.20, '02/04', 'Estrutura e instalações'],
  [0.45, '03/04', 'Alvenaria'],
  [0.72, '04/04', 'Acabamento e marcenaria']
];

let cena = null;
const temGL = !!(window.CenaObra && CenaObra.suportado());
if (temGL) {
  try {
    const q = new URLSearchParams(location.search).get('q');
    cena = CenaObra.criar({ canvas: $('#cena'), rotulos: $('#rotulos'), qualidade: q || undefined, calma: REDUZIDO });
    raiz.classList.add('cena-ok');
  } catch (e) { cena = null; }
}
/* sem WebGL o topo vira uma página comum, com foto no lugar da cena.
   Com "reduzir movimento" ligado a casa continua, porque só anda com o
   scroll da pessoa. O que para é o que se mexe sozinho. */
const ESTATICO = !cena;
if (ESTATICO) raiz.classList.add('estatico', 'sem-gl');

let faseAtual = -1;
function constrAtualiza() {
  if (ESTATICO) return 1;
  const r = constr.getBoundingClientRect();
  const t = clamp(-r.top / (r.height - innerHeight));
  cena.set(t);

  const oh = 1 - janela(t, 0.02, 0.065);
  hero.style.opacity = oh;
  hero.style.visibility = oh < 0.01 ? 'hidden' : 'visible';
  hero.style.setProperty('--dy', (-(1 - oh) * 40) + 'px');

  for (const e of etapas) {
    const f = 0.024;
    const o = janela(t, e.de, e.de + f) * (1 - janela(t, e.ate - f, e.ate));
    e.el.style.opacity = o;
    e.el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
    e.el.style.setProperty('--dy', ((1 - janela(t, e.de, e.de + f)) * 30 - janela(t, e.ate - f, e.ate) * 30) + 'px');
  }

  regua.style.setProperty('--t', t.toFixed(4));
  let fase = 0;
  for (let i = 0; i < FASES.length; i++) if (t >= FASES[i][0]) fase = i;
  if (fase !== faseAtual) {
    faseAtual = fase;
    carimboNum.textContent = FASES[fase][1];
    carimboNome.textContent = FASES[fase][2];
    reguaBtns.forEach((b, i) => b.classList.toggle('ativa', i === fase));
  }
  raiz.classList.toggle('constr-on', t > 0.045);
  dica.classList.toggle('some', t > 0.012);
  return t;
}

/* cada marca da régua fica na altura em que a etapa começa */
reguaBtns.forEach((b, i) => b.style.setProperty('--em', (FASES[i][0] * 100) + '%'));
reguaBtns.forEach(b => b.addEventListener('click', () => {
  const total = constr.offsetHeight - innerHeight;
  scrollTo({ top: constr.offsetTop + total * +b.dataset.ir, behavior: REDUZIDO ? 'auto' : 'smooth' });
}));

if (cena && !ESTATICO) {
  /* só desenha a cena enquanto ela está na tela e a aba está aberta */
  let naTela = true;
  const liga = () => cena.rodar(naTela && !document.hidden);
  new IntersectionObserver(es => { naTela = es[0].isIntersecting; liga(); }).observe(constr);
  document.addEventListener('visibilitychange', liga);
  liga();
}

/* ---------- topo ---------- */
let ultimoY = 0;
function topoAtualiza(t) {
  const y = scrollY;
  const depois = t >= 0.999 || ESTATICO && y > innerHeight * 0.6;
  topo.classList.toggle('solido', depois || (ESTATICO && y > 30));
  /* some descendo e volta subindo, mas só depois da casa */
  if (depois && y > ultimoY + 6) topo.classList.add('some');
  else if (y < ultimoY - 6 || !depois) topo.classList.remove('some');
  ultimoY = y;
  zap.classList.toggle('aparece', depois && !noContato);
}
/* no contato e no rodapé o botão flutuante só atrapalha: o formulário já está ali */
let noContato = false;
if ('IntersectionObserver' in window) {
  new IntersectionObserver(es => { noContato = es[0].isIntersecting; zap.classList.toggle('aparece', !noContato && topo.classList.contains('solido')); }, { rootMargin: '0px 0px -30% 0px' }).observe($('#contato'));
}

/* ---------- menu do celular ---------- */
const menuBtn = $('#menuBtn');
function menu(abre) {
  raiz.classList.toggle('menu-aberto', abre);
  raiz.classList.toggle('trava', abre);
  menuBtn.setAttribute('aria-expanded', abre);
  menuBtn.setAttribute('aria-label', abre ? 'Fechar menu' : 'Abrir menu');
}
menuBtn.addEventListener('click', () => menu(!raiz.classList.contains('menu-aberto')));
$$('#menu a').forEach(a => a.addEventListener('click', () => menu(false)));

/* ---------- entrada das seções ---------- */
if ('IntersectionObserver' in window && !REDUZIDO) {
  const io = new IntersectionObserver(es => {
    for (const e of es) if (e.isIntersecting) { e.target.classList.add('visto'); io.unobserve(e.target); }
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  $$('.rev, .prancha').forEach(el => io.observe(el));
} else {
  $$('.rev, .prancha').forEach(el => el.classList.add('visto'));
}

/* ---------- propósito: a frase acende conforme a pessoa lê ---------- */
const frase = $('#frase');
let palavras = [];
(function quebraFrase() {
  const andar = no => {
    for (const filho of [...no.childNodes]) {
      if (filho.nodeType === 3) {
        const frag = document.createDocumentFragment();
        filho.textContent.split(/(\s+)/).forEach(p => {
          if (!p.trim()) { frag.append(p); return; }
          const s = document.createElement('span');
          s.className = 'pal';
          s.textContent = p;
          frag.append(s);
        });
        filho.replaceWith(frag);
      } else andar(filho);
    }
  };
  andar(frase);
  palavras = $$('.pal', frase);
})();
let acesas = -1;
function fraseAtualiza() {
  const r = frase.getBoundingClientRect();
  if (r.bottom < -200 || r.top > innerHeight + 200) return;
  const p = janela(innerHeight * 0.88 - r.top, 0, r.height + innerHeight * 0.38);
  const n = Math.round(p * palavras.length);
  if (n === acesas) return;
  acesas = n;
  palavras.forEach((el, i) => el.classList.toggle('acesa', i < n));
}

/* ---------- serviços ---------- */
const servItens = $$('#servLista li');
const servFotos = $$('#servVitrine img');
const servNum = $('#servNum');
function servico(i) {
  servItens.forEach((li, k) => li.classList.toggle('ativa', k === i));
  servFotos.forEach((im, k) => im.classList.toggle('ativa', k === i));
  servNum.textContent = String(i + 1).padStart(2, '0');
}
servItens.forEach((li, i) => {
  li.tabIndex = 0;
  li.addEventListener('pointerenter', () => servico(i));
  li.addEventListener('focus', () => servico(i));
  li.addEventListener('click', () => servico(i));
});

/* ---------- Mansão Costa Verde: scroll vertical vira horizontal ---------- */
const mansao = $('#mansao');
const faixa = $('#mansaoFaixa');
let mansaoSobra = 0, mansaoDedo = false;
function mansaoMede() {
  mansaoDedo = innerWidth < 900 || matchMedia('(hover: none)').matches;
  mansao.classList.toggle('dedo', mansaoDedo);
  $('.m-dica', mansao).firstChild.textContent = mansaoDedo ? 'Arraste para o lado ' : 'Continue rolando ';
  if (mansaoDedo) {
    mansao.style.height = '';
    faixa.style.transform = '';
    return;
  }
  mansaoSobra = Math.max(0, faixa.scrollWidth - innerWidth);
  /* a faixa anda mais rápido que o scroll, senão a pessoa rola sete telas pra ver uma obra */
  mansao.style.height = (innerHeight + mansaoSobra * 0.6) + 'px';
}
function mansaoAtualiza() {
  if (mansaoDedo) return;
  const r = mansao.getBoundingClientRect();
  if (r.bottom < -100 || r.top > innerHeight + 100) return;
  const p = clamp(-r.top / Math.max(1, r.height - innerHeight));
  faixa.style.transform = `translate3d(${(-p * mansaoSobra).toFixed(1)}px,0,0)`;
}
/* foto que está lá na frente da faixa só carregaria quando chegasse na
   tela. Quando a seção se aproxima, carrega todas de uma vez. */
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => {
    if (!es[0].isIntersecting) return;
    $$('img', mansao).forEach(im => { im.loading = 'eager'; });
    io.disconnect();
  }, { rootMargin: '120% 0px' });
  io.observe(mansao);
}

/* ---------- comparador: projeto x entrega ---------- */
const compara = $('#compara');
const compRange = $('#compRange');
const PARES = {
  1: ['img/obras/nutri-projeto-1.webp', 'Consultório no projeto 3D', 'img/obras/nutri-entregue-1.webp', 'Consultório entregue, em foto'],
  2: ['img/obras/nutri-projeto-2.webp', 'Recepção no projeto 3D', 'img/obras/nutri-entregue-2.webp', 'Recepção entregue, em foto']
};
const compPoe = v => compara.style.setProperty('--p', v + '%');
compRange.addEventListener('input', () => compPoe(compRange.value));
$$('.compara-abas button').forEach(b => b.addEventListener('click', () => {
  $$('.compara-abas button').forEach(o => o.setAttribute('aria-selected', o === b));
  const [a, altA, d, altD] = PARES[b.dataset.par];
  const antes = $('#compAntes'), depois = $('#compDepois');
  antes.src = a; antes.alt = altA;
  depois.src = d; depois.alt = altD;
  compRange.value = 50; compPoe(50);
}));
/* quando aparece na tela, o fio balança uma vez pra mostrar que arrasta */
if ('IntersectionObserver' in window && !REDUZIDO) {
  const io = new IntersectionObserver(es => {
    if (!es[0].isIntersecting) return;
    io.disconnect();
    const ini = performance.now();
    const passo = agora => {
      const k = (agora - ini) / 1700;
      if (k >= 1 || compRange.matches(':active')) { compPoe(compRange.value); return; }
      compPoe(50 + Math.sin(k * Math.PI * 2) * 16 * (1 - k));
      requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  }, { threshold: 0.6 });
  io.observe(compara);
}

/* ---------- casa: miniatura troca a foto grande ---------- */
const casaGrande = $('#casaGrande');
const casaMinis = $$('#casaMinis button');
casaGrande.dataset.i = 0;
casaMinis.forEach((b, i) => b.addEventListener('click', () => {
  if (b.classList.contains('ativa')) return;
  casaMinis.forEach(o => o.classList.toggle('ativa', o === b));
  casaGrande.dataset.i = i;
  const img = $('img', casaGrande);
  casaGrande.classList.add('troca');
  const pre = new Image();
  pre.onload = pre.onerror = () => {
    img.src = b.dataset.src;
    img.alt = $('img', b).alt;
    casaGrande.classList.remove('troca');
  };
  pre.src = b.dataset.src;
}));

/* ---------- portfólio ----------
   [id, categoria, largura e altura da miniatura, tipo]
   tipo p = imagem do projeto 3D, f = foto de obra entregue */
const CATS = [
  ['todos', 'Todos'], ['fachada', 'Fachada'], ['sala', 'Sala'], ['cozinha', 'Cozinha'],
  ['quarto', 'Quarto'], ['banheiro', 'Banheiro'], ['gourmet', 'Área gourmet'],
  ['office', 'Home office'], ['comercial', 'Comercial'], ['pronta', 'Obra pronta']
];
const NOME = Object.fromEntries(CATS);
const PORT = [
  [519, 'fachada', 760, 428, 'p'], [551, 'fachada', 760, 428, 'p'], [516, 'fachada', 760, 428, 'p'],
  [521, 'fachada', 760, 570, 'p'], [1016, 'fachada', 760, 760, 'p'], [540, 'fachada', 760, 760, 'p'],
  [250, 'sala', 760, 424, 'p'], [312, 'sala', 760, 760, 'p'], [326, 'sala', 760, 760, 'p'],
  [248, 'sala', 760, 428, 'p'], [299, 'sala', 760, 760, 'p'], [321, 'sala', 760, 760, 'p'],
  [572, 'cozinha', 760, 424, 'p'], [577, 'cozinha', 760, 760, 'p'], [604, 'cozinha', 760, 570, 'p'],
  [607, 'cozinha', 760, 760, 'p'], [586, 'cozinha', 760, 428, 'p'], [585, 'cozinha', 760, 760, 'p'],
  [403, 'quarto', 760, 426, 'p'], [450, 'quarto', 760, 760, 'p'], [498, 'quarto', 760, 760, 'p'],
  [412, 'quarto', 760, 570, 'p'], [491, 'quarto', 760, 428, 'p'], [1312, 'quarto', 760, 570, 'f'],
  [752, 'banheiro', 760, 760, 'p'], [773, 'banheiro', 760, 760, 'p'], [775, 'banheiro', 760, 760, 'p'],
  [754, 'banheiro', 606, 760, 'p'], [796, 'banheiro', 436, 760, 'p'], [1246, 'banheiro', 570, 760, 'f'],
  [810, 'gourmet', 760, 428, 'p'], [806, 'gourmet', 760, 506, 'p'], [811, 'gourmet', 760, 570, 'p'],
  [834, 'gourmet', 608, 760, 'p'], [835, 'gourmet', 760, 592, 'p'], [825, 'gourmet', 760, 760, 'p'],
  [350, 'office', 760, 518, 'p'], [352, 'office', 760, 760, 'p'], [356, 'office', 760, 570, 'p'], [378, 'office', 760, 570, 'p'],
  [704, 'comercial', 760, 428, 'p'], [686, 'comercial', 760, 380, 'p'], [680, 'comercial', 760, 608, 'p'],
  [671, 'comercial', 760, 334, 'p'], [693, 'comercial', 760, 608, 'p'], [1046, 'comercial', 760, 742, 'f'],
  [1189, 'pronta', 570, 760, 'f'], [1192, 'pronta', 570, 760, 'f'], [1202, 'pronta', 570, 760, 'f'],
  [1273, 'pronta', 760, 570, 'f'], [1296, 'pronta', 570, 760, 'f'], [1240, 'pronta', 570, 760, 'f'],
  [1247, 'pronta', 570, 760, 'f'], [1284, 'pronta', 570, 760, 'f']
].map(([id, cat, w, h, tipo]) => ({ id, cat, w, h, tipo }));

/* em "Todos" os ambientes vêm alternados, senão seriam seis fachadas seguidas */
const TODOS = (() => {
  const filas = CATS.slice(1).map(([c]) => PORT.filter(p => p.cat === c));
  const out = [];
  for (let i = 0; filas.some(f => f[i]); i++) for (const f of filas) if (f[i]) out.push(f[i]);
  return out;
})();
const doFiltro = c => c === 'todos' ? TODOS : c === 'pronta' ? PORT.filter(p => p.tipo === 'f') : PORT.filter(p => p.cat === c);
const rotuloTipo = p => p.tipo === 'f' ? 'Obra entregue' : 'Projeto 3D';
const legenda = p => `${p.cat === 'pronta' ? 'Obra pronta' : NOME[p.cat]} · ${rotuloTipo(p)}`;

const portFiltros = $('#portFiltros'), portGrade = $('#portGrade'), portMais = $('#portMais');
const LOTE = () => innerWidth < 700 ? 8 : 12;
let filtro = 'todos', mostrando = 0, lista = [];

const portIO = 'IntersectionObserver' in window && !REDUZIDO
  ? new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visto'); portIO.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -4% 0px' })
  : null;

function portMonta(mais) {
  if (!mais) { portGrade.textContent = ''; mostrando = 0; lista = doFiltro(filtro); }
  const ate = Math.min(lista.length, mostrando + LOTE());
  for (let i = mostrando; i < ate; i++) {
    const p = lista[i];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'port-item';
    b.style.transitionDelay = ((i - mostrando) % 3) * 70 + 'ms';
    b.innerHTML = `<img src="img/portfolio/${p.id}-s.webp" width="${p.w}" height="${p.h}" loading="lazy" alt="${legenda(p).replace(' · ', ', ').toLowerCase()}">` +
      `<span class="leg"><span>${p.cat === 'pronta' ? 'Obra pronta' : NOME[p.cat]}</span><span class="selo ${p.tipo === 'f' ? 's-f' : 's-p'}">${rotuloTipo(p)}</span></span>`;
    b.addEventListener('click', () => visor(lista.map(q => ({ src: `img/portfolio/${q.id}.webp`, leg: legenda(q) })), i, b));
    portGrade.append(b);
    if (portIO) portIO.observe(b); else b.classList.add('visto');
  }
  mostrando = ate;
  portMais.hidden = mostrando >= lista.length;
}
CATS.forEach(([c, nome]) => {
  const n = doFiltro(c).length;
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('aria-pressed', c === filtro);
  b.innerHTML = `${nome}<sup>${n}</sup>`;
  b.addEventListener('click', () => {
    if (filtro === c) return;
    filtro = c;
    $$('button', portFiltros).forEach(o => o.setAttribute('aria-pressed', o === b));
    portMonta(false);
  });
  portFiltros.append(b);
});
portMais.addEventListener('click', () => portMonta(true));
portMonta(false);

/* ---------- visor de fotos ---------- */
const lb = $('#lb'), lbImg = $('#lbImg'), lbLeg = $('#lbLeg'), lbCont = $('#lbCont');
let lbLista = [], lbI = 0, lbVolta = null;
function lbMostra(i) {
  lbI = (i + lbLista.length) % lbLista.length;
  const it = lbLista[lbI];
  lbImg.classList.add('troca');
  const pre = new Image();
  pre.onload = pre.onerror = () => {
    lbImg.src = it.src;
    lbImg.alt = it.leg;
    lbImg.classList.remove('troca');
  };
  pre.src = it.src;
  lbLeg.textContent = it.leg;
  lbCont.textContent = String(lbI + 1).padStart(2, '0') + ' / ' + String(lbLista.length).padStart(2, '0');
  /* adianta a próxima */
  const prox = lbLista[(lbI + 1) % lbLista.length];
  if (prox) new Image().src = prox.src;
}
function visor(itens, i, origem) {
  lbLista = itens; lbVolta = origem || document.activeElement;
  lb.hidden = false;
  raiz.classList.add('trava');
  requestAnimationFrame(() => lb.classList.add('aberto'));
  lbMostra(i);
  $('#lbX').focus();
}
function lbFecha() {
  lb.classList.remove('aberto');
  raiz.classList.remove('trava');
  setTimeout(() => { lb.hidden = true; lbImg.removeAttribute('src'); }, 350);
  if (lbVolta && lbVolta.focus) lbVolta.focus();
}
$('#lbX').addEventListener('click', lbFecha);
$('#lbAnt').addEventListener('click', () => lbMostra(lbI - 1));
$('#lbProx').addEventListener('click', () => lbMostra(lbI + 1));
lb.addEventListener('click', e => { if (e.target === lb || e.target.classList.contains('lb-fig')) lbFecha(); });
addEventListener('keydown', e => {
  if (lb.hidden) { if (e.key === 'Escape') menu(false); return; }
  if (e.key === 'Escape') lbFecha();
  else if (e.key === 'ArrowLeft') lbMostra(lbI - 1);
  else if (e.key === 'ArrowRight') lbMostra(lbI + 1);
  else if (e.key === 'Tab') {
    /* o foco não sai do visor */
    const alvos = [$('#lbX'), $('#lbAnt'), $('#lbProx')];
    const k = alvos.indexOf(document.activeElement);
    e.preventDefault();
    alvos[(k + (e.shiftKey ? -1 : 1) + alvos.length) % alvos.length].focus();
  }
});
/* arrastar com o dedo troca de foto */
let toqueX = null;
lb.addEventListener('touchstart', e => { toqueX = e.touches[0].clientX; }, { passive: true });
lb.addEventListener('touchend', e => {
  if (toqueX == null) return;
  const dx = e.changedTouches[0].clientX - toqueX;
  toqueX = null;
  if (Math.abs(dx) > 50) lbMostra(lbI + (dx < 0 ? 1 : -1));
}, { passive: true });

/* fotos das obras: cada grupo abre no visor */
const grupo = g => $$(`[data-lb="${g}"], [data-lbi="${g}"]`).map(el => ({ src: el.dataset.src, leg: el.dataset.leg }));
$$('[data-lb]').forEach(el => el.addEventListener('click', () => {
  const g = el.dataset.lb;
  visor(grupo(g), $$(`[data-lb="${g}"]`).indexOf(el), el);
}));
casaGrande.addEventListener('click', () => visor(grupo('casa'), +casaGrande.dataset.i, casaGrande));

/* ---------- avaliações ---------- */
const trilho = $('#avalTrilho'), avalAnt = $('#avalAnt'), avalProx = $('#avalProx');
const passoAval = () => {
  const c = $('.depo', trilho);
  return c ? c.getBoundingClientRect().width + 18 : 400;
};
avalAnt.addEventListener('click', () => trilho.scrollBy({ left: -passoAval(), behavior: REDUZIDO ? 'auto' : 'smooth' }));
avalProx.addEventListener('click', () => trilho.scrollBy({ left: passoAval(), behavior: REDUZIDO ? 'auto' : 'smooth' }));
function avalBotoes() {
  avalAnt.disabled = trilho.scrollLeft < 8;
  avalProx.disabled = trilho.scrollLeft > trilho.scrollWidth - trilho.clientWidth - 8;
}
trilho.addEventListener('scroll', avalBotoes, { passive: true });
avalBotoes();

/* ---------- formulário: monta a mensagem e abre o WhatsApp ---------- */
const form = $('#form'), formErro = $('#formErro');
form.addEventListener('submit', e => {
  e.preventDefault();
  const d = new FormData(form);
  const nome = (d.get('nome') || '').trim();
  const tel = (d.get('telefone') || '').trim();
  const falta = [['#fNome', nome.length < 2], ['#fTel', tel.replace(/\D/g, '').length < 8]];
  falta.forEach(([s, ruim]) => $(s).classList.toggle('erro', ruim));
  const primeiro = falta.find(f => f[1]);
  formErro.hidden = !primeiro;
  if (primeiro) { $(primeiro[0]).focus(); return; }

  const linhas = ['Olá! Vim pelo site da Obra de Cora.', '', `*Nome:* ${nome}`, `*Telefone:* ${tel}`];
  const extra = [['E-mail', d.get('email')], ['Local do imóvel', d.get('local')], ['O que desejo fazer', d.getAll('desejo').join(', ')], ['Mensagem', d.get('mensagem')]];
  for (const [rot, v] of extra) if (v && String(v).trim()) linhas.push(`*${rot}:* ${String(v).trim()}`);
  window.open(`https://wa.me/${ZAP}?text=${encodeURIComponent(linhas.join('\n'))}`, '_blank', 'noopener');
});
$$('#fNome, #fTel').forEach(el => el.addEventListener('input', () => { el.classList.remove('erro'); formErro.hidden = true; }));

/* ---------- laço do scroll ---------- */
let pedido = false;
function quadro() {
  pedido = false;
  const t = constrAtualiza();
  topoAtualiza(t);
  fraseAtualiza();
  mansaoAtualiza();
}
const pede = () => { if (!pedido) { pedido = true; requestAnimationFrame(quadro); } };
addEventListener('scroll', pede, { passive: true });

let larguraAntes = innerWidth;
addEventListener('resize', () => {
  /* no celular a barra do navegador some e volta: isso muda a altura,
     não a largura, e não precisa remedir a galeria */
  if (cena) cena.medir();
  if (innerWidth !== larguraAntes || !mansaoDedo) { larguraAntes = innerWidth; mansaoMede(); }
  pede();
});
addEventListener('load', () => { mansaoMede(); pede(); });

$('#ano').textContent = new Date().getFullYear();
mansaoMede();
quadro();
requestAnimationFrame(() => raiz.classList.add('pronto'));
})();
