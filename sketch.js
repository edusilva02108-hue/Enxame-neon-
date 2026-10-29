// ============================================
//  ENXAME NEON - sobrevivência com tiro automático (p5.js)
//  Arraste o dedo (ou mouse / WASD / setas) para mover.
//  A nave atira sozinha. Sobreviva, colete cristais,
//  suba de nível e escolha melhorias!
// ============================================

// ---------- CONFIGURAÇÃO DE MONETIZAÇÃO (edite aqui) ----------
const CONFIG = {
  chavePix: "ba4f78da-dd87-44c5-a166-a3dd3cae71f5", // o botão "Apoiar" copia essa chave
  linkApoio: "https://SEU-LINK-DE-APOIO-AQUI",      // usado só se a chavePix estiver vazia ou começar com "SUA-"
  anuncioACada: 3,            // anúncio de tela cheia a cada X partidas
  segundosParaContinuar: 20,  // tempo mínimo de partida para oferecer "continuar vendo anúncio"
};

// Gancho de anúncios: defina window.chamarAnuncio no index.html com o SDK que usar.
// tipo: "intersticial" ou "recompensado". Chame aoTerminar() quando o anúncio acabar.
function mostrarAnuncio(tipo, aoTerminar) {
  if (window.chamarAnuncio) window.chamarAnuncio(tipo, aoTerminar);
  else aoTerminar(); // sem SDK ainda: segue o jogo normalmente
}

// ---------- Dados do jogo ----------
const MAX_INIMIGOS = 140;

const TIPOS = {
  normal: { r: 12, hp: 24,   vel: 68,  dano: 10, xp: 1,  cor: 340 },
  rapido: { r: 9,  hp: 12,   vel: 118, dano: 8,  xp: 1,  cor: 55 },
  tanque: { r: 21, hp: 90,   vel: 44,  dano: 18, xp: 4,  cor: 275 },
  chefe:  { r: 48, hp: 1400, vel: 52,  dano: 28, xp: 30, cor: 0 },
};

const MELHORIAS = [
  { id: "cad", nome: "Disparo Rápido",     desc: "+25% de velocidade de tiro",        cor: 50,  max: 8,  aplicar: () => { st.cadencia *= 1.25; } },
  { id: "dan", nome: "Mais Dano",          desc: "+30% de dano nos tiros",            cor: 0,   max: 10, aplicar: () => { st.dano *= 1.3; } },
  { id: "mul", nome: "Tiro Múltiplo",      desc: "+1 projétil a cada disparo",        cor: 200, max: 4,  aplicar: () => { st.multi += 1; } },
  { id: "per", nome: "Perfuração",         desc: "Tiros atravessam +1 inimigo",       cor: 280, max: 4,  aplicar: () => { st.perfura += 1; } },
  { id: "vel", nome: "Botas Velozes",      desc: "+12% de velocidade de movimento",   cor: 150, max: 5,  aplicar: () => { st.vel *= 1.12; } },
  { id: "ima", nome: "Ímã de Cristais",    desc: "Atrai cristais de mais longe",      cor: 180, max: 4,  aplicar: () => { st.ima *= 1.5; } },
  { id: "vid", nome: "Vida Extra",         desc: "+30 de vida máxima e cura 50",      cor: 350, max: 6,  aplicar: () => { st.hpMax += 30; st.hp = Math.min(st.hpMax, st.hp + 50); } },
  { id: "lam", nome: "Lâminas Giratórias", desc: "Lâminas orbitam e cortam inimigos", cor: 30,  max: 6,  aplicar: () => { st.laminas += 1; } },
  { id: "reg", nome: "Regeneração",        desc: "Recupera vida aos poucos",          cor: 120, max: 5,  aplicar: () => { st.regen += 0.7; } },
];
const CURA = { id: "cura", nome: "Cura Total", desc: "Recupera toda a sua vida", cor: 120, max: 999, aplicar: () => { st.hp = st.hpMax; } };

// ---------- Estado ----------
let estado = "menu"; // menu | jogando | upgrade | fim
let jogador, st;
let inimigos = [], tiros = [], gemas = [], particulas = [], textos = [];
let cam = { x: 0, y: 0 };
let tempo = 0, abates = 0, nivel = 1, xp = 0, xpProx = 9, pendentes = 0;
let pegos = {}, opcoes = [];
let acumSpawn = 0, proxChefe = 60, nChefes = 0;
let tremor = 0, flashDano = 0;
let aviso = { txt: "", ate: 0 };
let recorde = 0, novoRecorde = false, partidas = 0, usouContinuar = false;
let zoom = 1, ui = 1;
let joy = { ativo: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
let toqueConhecido = {};
let ultimoClique = 0;
let avisoPix = 0;
let usouTeclado = false;
let somLigado = true, audioCtx = null, ultimoSom = 0;

// ---------- Setup ----------
function setup() {
  pixelDensity(Math.min(1.5, window.devicePixelRatio || 1));
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 1);
  textFont("Trebuchet MS");
  try {
    recorde = parseInt(localStorage.getItem("enxameNeonRecorde")) || 0;
    somLigado = localStorage.getItem("enxameNeonSom") !== "0";
  } catch (e) {}
  ajustar();
  resetarMundo();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  ajustar();
}

function ajustar() {
  const m = Math.min(width, height);
  zoom = constrain(m / 460, 0.7, 1.6);
  ui = constrain(m / 450, 0.7, 1.8);
}

function statsIniciais() {
  return { hpMax: 100, hp: 100, vel: 150, dano: 12, cadencia: 2.4, multi: 1, perfura: 0, alcance: 340, ima: 80, laminas: 0, regen: 0 };
}

function resetarMundo() {
  jogador = { x: 0, y: 0, r: 14, dir: 0, mira: 0, cd: 0, inv: 0, ang: 0 };
  st = statsIniciais();
  inimigos = []; tiros = []; gemas = []; particulas = []; textos = [];
  cam.x = 0; cam.y = 0;
  tempo = 0; abates = 0; nivel = 1; xp = 0; xpProx = 6; pendentes = 0;
  pegos = {}; opcoes = [];
  acumSpawn = 1; proxChefe = 60; nChefes = 0;
  tremor = 0; flashDano = 0;
  joy.ativo = false;
}

function novaPartida() {
  resetarMundo();
  jogador.inv = 1;
  usouContinuar = false;
  novoRecorde = false;
  estado = "jogando";
}

// ---------- Loop principal ----------
function draw() {
  const dt = Math.min(deltaTime / 1000, 0.05);

  if (estado === "jogando") atualizar(dt);
  else if (estado === "menu") atualizarMenu(dt);
  else if (estado === "fim") atualizarEfeitos(dt);
  tremor *= Math.exp(-12 * dt);

  background(240, 60, 9);
  desenharMundo();
  desenharHUD();
  desenharTelas();
  desenharBotaoSom();
  desenharAvisoPix();
}

function atualizarMenu(dt) {
  cam.x += 25 * dt;
  cam.y += 10 * dt;
  if (Math.random() < 0.3) {
    particulas.push({
      x: cam.x + random(-width / 2, width / 2) / zoom,
      y: cam.y + random(-height / 2, height / 2) / zoom,
      vx: random(-10, 10), vy: random(-30, -8), vida: 2, max: 2, cor: random(160, 340), t: random(3, 8),
    });
  }
  atualizarEfeitos(dt);
}

// ---------- Atualização do jogo ----------
function atualizar(dt) {
  tempo += dt;

  // movimento
  const [dx, dy] = direcaoMov();
  jogador.x += dx * st.vel * dt;
  jogador.y += dy * st.vel * dt;
  if (dx || dy) jogador.dir = Math.atan2(dy, dx);
  jogador.inv = Math.max(0, jogador.inv - dt);
  st.hp = Math.min(st.hpMax, st.hp + st.regen * dt);
  const k = 1 - Math.exp(-8 * dt);
  cam.x += (jogador.x - cam.x) * k;
  cam.y += (jogador.y - cam.y) * k;

  gerarInimigos(dt);
  atirar(dt);
  moverTiros(dt);
  moverInimigos(dt);
  atualizarLaminas(dt);
  colisoesTiros();
  atualizarGemas(dt);
  atualizarEfeitos(dt);

  inimigos = inimigos.filter((e) => !e.morto);
  tiros = tiros.filter((b) => b.vida > 0);
  gemas = gemas.filter((g) => !g.morta);
}

function direcaoMov() {
  let dx = 0, dy = 0;
  if (joy.ativo) {
    const vx = joy.x - joy.ox, vy = joy.y - joy.oy;
    const R = 70 * ui;
    const d = Math.hypot(vx, vy);
    if (d > 6) {
      const m = Math.min(d, R) / R;
      dx = (vx / d) * m;
      dy = (vy / d) * m;
    }
  } else {
    if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) dx -= 1;
    if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) dx += 1;
    if (keyIsDown(UP_ARROW) || keyIsDown(87)) dy -= 1;
    if (keyIsDown(DOWN_ARROW) || keyIsDown(83)) dy += 1;
    if (dx || dy) {
      usouTeclado = true;
      const m = Math.hypot(dx, dy);
      dx /= m; dy /= m;
    }
  }
  return [dx, dy];
}

// ---------- Inimigos ----------
function posBorda() {
  const a = random(TWO_PI);
  const hw = width / 2 / zoom + 50, hh = height / 2 / zoom + 50;
  const t = 1 / Math.max(Math.abs(Math.cos(a)) / hw, Math.abs(Math.sin(a)) / hh);
  let ox = Math.cos(a) * t, oy = Math.sin(a) * t;
  const d = Math.hypot(ox, oy);
  if (d > 520) { ox *= 520 / d; oy *= 520 / d; }
  return { x: jogador.x + ox, y: jogador.y + oy };
}

function sortearTipo() {
  const r = Math.random();
  if (tempo > 45 && r < 0.18) return "tanque";
  if (tempo > 15 && r < 0.3) return "rapido";
  return "normal";
}

function criarInimigo(tipo) {
  const T = TIPOS[tipo];
  const p = posBorda();
  const mult = (1 + tempo / 80) * (tipo === "chefe" ? 1 + nChefes * 0.7 : 1);
  inimigos.push({
    tipo, x: p.x, y: p.y, r: T.r,
    hp: T.hp * mult, hpMax: T.hp * mult,
    vel: T.vel * (1 + Math.min(tempo / 400, 0.35)) * random(0.9, 1.1),
    dano: T.dano, xp: T.xp, cor: T.cor,
    desvio: random(-0.5, 0.5),
    flash: 0, idade: 0, lamCd: 0, kx: 0, ky: 0, morto: false,
  });
}

function gerarInimigos(dt) {
  acumSpawn += dt;
  const intervalo = Math.max(0.25, 0.9 - tempo * 0.005);
  while (acumSpawn >= intervalo) {
    acumSpawn -= intervalo;
    const qtd = 1 + Math.floor(tempo / 70);
    for (let i = 0; i < qtd && inimigos.length < MAX_INIMIGOS; i++) criarInimigo(sortearTipo());
  }
  if (tempo >= proxChefe) {
    criarInimigo("chefe");
    nChefes++;
    proxChefe += 90;
    mostrarAviso("CHEFE CHEGANDO!");
    tremor = Math.max(tremor, 8);
    tocar("chefe");
  }
}

function moverInimigos(dt) {
  for (const e of inimigos) {
    e.idade += dt;
    e.flash = Math.max(0, e.flash - dt);
    e.lamCd -= dt;
    const dx = jogador.x - e.x, dy = jogador.y - e.y;
    const d = Math.hypot(dx, dy) || 1;

    if (d > 800) { // ficou longe demais: reaparece na borda
      const p = posBorda();
      e.x = p.x; e.y = p.y;
      continue;
    }

    const ang = Math.atan2(dy, dx) + e.desvio * Math.min(1, d / 220);
    e.x += Math.cos(ang) * e.vel * dt + e.kx * dt;
    e.y += Math.sin(ang) * e.vel * dt + e.ky * dt;
    const f = Math.exp(-8 * dt);
    e.kx *= f; e.ky *= f;

    if (e.idade > 0.4 && jogador.inv <= 0 && d < e.r + jogador.r) ferir(e.dano);
  }
}

// ---------- Tiros ----------
function atirar(dt) {
  jogador.cd = Math.max(0, jogador.cd - dt);

  let alvo = null, melhor = st.alcance * st.alcance;
  for (const e of inimigos) {
    if (e.morto || e.idade < 0.2) continue;
    const d2 = (e.x - jogador.x) ** 2 + (e.y - jogador.y) ** 2;
    if (d2 < melhor) { melhor = d2; alvo = e; }
  }
  if (!alvo) { jogador.mira = jogador.dir; return; }

  const base = Math.atan2(alvo.y - jogador.y, alvo.x - jogador.x);
  jogador.mira = base;
  if (jogador.cd > 0) return;

  for (let i = 0; i < st.multi; i++) {
    const ang = base + (i - (st.multi - 1) / 2) * 0.17;
    tiros.push({
      x: jogador.x, y: jogador.y,
      vx: Math.cos(ang) * 560, vy: Math.sin(ang) * 560,
      vida: 0.8, perf: st.perfura, hits: [], dano: st.dano,
    });
  }
  jogador.cd = 1 / st.cadencia;
}

function moverTiros(dt) {
  for (const b of tiros) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vida -= dt;
  }
}

function colisoesTiros() {
  for (const b of tiros) {
    if (b.vida <= 0) continue;
    for (const e of inimigos) {
      if (e.morto || b.hits.includes(e)) continue;
      const rr = e.r + 4;
      const dx = e.x - b.x, dy = e.y - b.y;
      if (dx * dx + dy * dy < rr * rr) {
        causarDano(e, b.dano, b.vx, b.vy);
        b.hits.push(e);
        if (b.perf > 0) b.perf--;
        else { b.vida = 0; break; }
      }
    }
  }
}

function atualizarLaminas(dt) {
  if (!st.laminas) return;
  jogador.ang += 3.2 * dt;
  for (let i = 0; i < st.laminas; i++) {
    const a = jogador.ang + (i * TWO_PI) / st.laminas;
    const bx = jogador.x + Math.cos(a) * 62;
    const by = jogador.y + Math.sin(a) * 62;
    for (const e of inimigos) {
      if (e.morto || e.lamCd > 0) continue;
      const rr = e.r + 9;
      const dx = e.x - bx, dy = e.y - by;
      if (dx * dx + dy * dy < rr * rr) {
        e.lamCd = 0.35;
        causarDano(e, st.dano * 0.7, Math.cos(a + HALF_PI), Math.sin(a + HALF_PI));
      }
    }
  }
}

function causarDano(e, d, vx, vy) {
  e.hp -= d;
  e.flash = 0.08;
  const m = Math.hypot(vx, vy) || 1;
  const kb = e.tipo === "chefe" ? 30 : e.tipo === "tanque" ? 90 : 160;
  e.kx += (vx / m) * kb;
  e.ky += (vy / m) * kb;
  if (textos.length < 25) textos.push({ x: e.x + random(-6, 6), y: e.y - e.r, txt: Math.round(d), vida: 0.5 });
  if (e.hp <= 0 && !e.morto) matar(e);
}

function matar(e) {
  e.morto = true;
  abates++;
  explosao(e.x, e.y, e.cor, e.tipo === "chefe" ? 40 : 8);
  if (e.tipo === "chefe") {
    for (let i = 0; i < 10; i++) gemas.push({ x: e.x + random(-30, 30), y: e.y + random(-30, 30), v: 3, tipo: "xp", vel: 200 });
    gemas.push({ x: e.x, y: e.y, v: 60, tipo: "vida", vel: 200 });
    tremor = Math.max(tremor, 10);
    mostrarAviso("CHEFE DERROTADO!");
  } else {
    if (gemas.length > 250) ganharXP(e.xp);
    else gemas.push({ x: e.x, y: e.y, v: e.xp, tipo: "xp", vel: 200 });
    if (Math.random() < 0.015 && gemas.length < 250) gemas.push({ x: e.x + 8, y: e.y, v: 20, tipo: "vida", vel: 200 });
  }
  tocar("abate");
}

// ---------- Dano no jogador ----------
function ferir(d) {
  if (estado !== "jogando") return;
  st.hp -= d;
  jogador.inv = 0.6;
  tremor = Math.max(tremor, 6);
  flashDano = 0.25;
  explosao(jogador.x, jogador.y, 0, 8);
  tocar("dano");
  if (st.hp <= 0) morrer();
}

function pontuacao() {
  return Math.floor(tempo) * 5 + abates * 10;
}

function morrer() {
  st.hp = 0;
  estado = "fim";
  partidas++;
  tremor = 14;
  joy.ativo = false;
  explosao(jogador.x, jogador.y, 170, 50);
  tocar("morte");
  const pts = pontuacao();
  if (pts > recorde) {
    recorde = pts;
    novoRecorde = true;
    try { localStorage.setItem("enxameNeonRecorde", recorde); } catch (e) {}
  }
}

function continuarPartida() {
  usouContinuar = true;
  st.hp = st.hpMax * 0.6;
  jogador.inv = 2.5;
  for (const e of inimigos) {
    if (e.morto) continue;
    const d = Math.hypot(e.x - jogador.x, e.y - jogador.y);
    if (d < 320) {
      if (e.tipo === "chefe") {
        e.kx += ((e.x - jogador.x) / (d || 1)) * 600;
        e.ky += ((e.y - jogador.y) / (d || 1)) * 600;
      } else {
        e.morto = true;
        explosao(e.x, e.y, e.cor, 4);
      }
    }
  }
  inimigos = inimigos.filter((e) => !e.morto);
  estado = "jogando";
  tocar("nivel");
}

// ---------- Cristais, XP e melhorias ----------
function atualizarGemas(dt) {
  for (const g of gemas) {
    const dx = jogador.x - g.x, dy = jogador.y - g.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < st.ima) g.puxar = true;
    if (g.puxar) {
      g.vel += 700 * dt;
      g.x += (dx / d) * g.vel * dt;
      g.y += (dy / d) * g.vel * dt;
    }
    if (d < jogador.r + 8) coletar(g);
  }
}

function coletar(g) {
  if (g.morta) return;
  g.morta = true;
  if (g.tipo === "xp") ganharXP(g.v);
  else {
    st.hp = Math.min(st.hpMax, st.hp + g.v);
    textos.push({ x: jogador.x, y: jogador.y - 20, txt: "+" + g.v + " vida", vida: 0.9 });
  }
}

function ganharXP(v) {
  xp += v;
  while (xp >= xpProx) {
    xp -= xpProx;
    nivel++;
    xpProx = 4 + nivel * 3;
    pendentes++;
  }
  if (pendentes > 0 && estado === "jogando") abrirMelhorias();
}

function abrirMelhorias() {
  pendentes--;
  let pool = MELHORIAS.filter((m) => (pegos[m.id] || 0) < m.max);
  pool.sort(() => Math.random() - 0.5);
  opcoes = pool.slice(0, 3);
  while (opcoes.length < 3) opcoes.push(CURA);
  estado = "upgrade";
  joy.ativo = false;
  tocar("nivel");
}

function escolher(i) {
  const m = opcoes[i];
  if (!m) return;
  m.aplicar();
  pegos[m.id] = (pegos[m.id] || 0) + 1;
  jogador.inv = Math.max(jogador.inv, 1);
  estado = "jogando";
  if (pendentes > 0) abrirMelhorias();
}

// ---------- Efeitos ----------
function explosao(x, y, cor, qtd) {
  for (let i = 0; i < qtd && particulas.length < 350; i++) {
    const a = random(TWO_PI), v = random(40, 260), vida = random(0.3, 0.7);
    particulas.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida, max: vida, cor, t: random(3, 7) });
  }
}

function atualizarEfeitos(dt) {
  for (const p of particulas) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.exp(-3 * dt);
    p.vy *= Math.exp(-3 * dt);
    p.vida -= dt;
  }
  particulas = particulas.filter((p) => p.vida > 0);
  for (const t of textos) { t.y -= 30 * dt; t.vida -= dt; }
  textos = textos.filter((t) => t.vida > 0);
  flashDano = Math.max(0, flashDano - dt);
}

function mostrarAviso(txt) {
  aviso = { txt, ate: millis() + 2200 };
}

// ---------- Som (WebAudio simples, sem arquivos) ----------
function iniciarAudio() {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  } catch (e) {}
}

function bip(freq, dur, tipo, vol, ate) {
  if (!somLigado || !audioCtx) return;
  try {
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t);
    if (ate) o.frequency.exponentialRampToValueAtTime(Math.max(30, ate), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(t);
    o.stop(t + dur);
  } catch (e) {}
}

function tocar(nome) {
  const t = millis();
  if (nome === "abate") {
    if (t - ultimoSom < 70) return;
    ultimoSom = t;
    bip(520 + random(0, 200), 0.07, "square", 0.025, 200);
  } else if (nome === "dano") bip(160, 0.18, "sawtooth", 0.05, 60);
  else if (nome === "nivel") {
    bip(440, 0.12, "triangle", 0.06);
    setTimeout(() => bip(660, 0.12, "triangle", 0.06), 110);
    setTimeout(() => bip(880, 0.18, "triangle", 0.06), 220);
  } else if (nome === "chefe") bip(90, 0.5, "sawtooth", 0.07, 40);
  else if (nome === "morte") bip(300, 0.7, "sawtooth", 0.07, 40);
}

function alternarSom() {
  somLigado = !somLigado;
  try { localStorage.setItem("enxameNeonSom", somLigado ? "1" : "0"); } catch (e) {}
}

// ---------- Desenho do mundo ----------
function desenharMundo() {
  push();
  translate(width / 2, height / 2);
  scale(zoom);
  const sx = tremor > 0.3 ? random(-tremor, tremor) : 0;
  const sy = tremor > 0.3 ? random(-tremor, tremor) : 0;
  translate(-cam.x + sx, -cam.y + sy);

  desenharGrade();
  desenharGemas();
  desenharInimigos();
  desenharTiros();
  if (estado !== "menu") {
    desenharLaminas();
    desenharJogador();
  }
  desenharParticulas();
  desenharTextos();
  pop();

  if (flashDano > 0) {
    noStroke();
    fill(0, 90, 100, flashDano * 0.9);
    rect(0, 0, width, height);
  }
}

function desenharGrade() {
  const G = 80;
  const hw = width / 2 / zoom + G, hh = height / 2 / zoom + G;
  const x0 = Math.floor((cam.x - hw) / G) * G;
  const y0 = Math.floor((cam.y - hh) / G) * G;
  stroke(230, 60, 45, 0.35);
  strokeWeight(1.5);
  for (let x = x0; x < cam.x + hw; x += G) line(x, cam.y - hh, x, cam.y + hh);
  for (let y = y0; y < cam.y + hh; y += G) line(cam.x - hw, y, cam.x + hw, y);
  noStroke();
}

function desenharGemas() {
  noStroke();
  rectMode(CENTER);
  for (const g of gemas) {
    if (g.tipo === "xp") {
      fill(185, 70, 100);
      push();
      translate(g.x, g.y);
      rotate(frameCount * 0.05);
      rect(0, 0, 8, 8);
      pop();
    } else {
      fill(350, 80, 100);
      circle(g.x, g.y, 15);
      fill(0, 0, 100);
      rect(g.x, g.y, 9, 3);
      rect(g.x, g.y, 3, 9);
    }
  }
}

function desenharInimigos() {
  noStroke();
  for (const e of inimigos) {
    const a = Math.min(1, e.idade / 0.4);
    const f = e.flash > 0;
    fill(f ? 0 : e.cor, f ? 0 : 75, 100, a);
    circle(e.x, e.y, e.r * 2);
    fill(e.cor, 80, 45, a);
    circle(e.x, e.y, e.r * 1.1);
    // olhos virados para o jogador
    const ang = Math.atan2(jogador.y - e.y, jogador.x - e.x);
    const ex = Math.cos(ang) * e.r * 0.4, ey = Math.sin(ang) * e.r * 0.4;
    const px = -Math.sin(ang) * e.r * 0.3, py = Math.cos(ang) * e.r * 0.3;
    fill(0, 0, 100, a);
    circle(e.x + ex + px, e.y + ey + py, e.r * 0.35);
    circle(e.x + ex - px, e.y + ey - py, e.r * 0.35);
    // barra de vida (tanque e chefe)
    if ((e.tipo === "chefe" || e.tipo === "tanque") && e.hp < e.hpMax) {
      const w = e.r * 2;
      fill(0, 0, 0, 0.6);
      rect(e.x, e.y - e.r - 8, w, 5);
      fill(0, 80, 100);
      rect(e.x - (w - w * (e.hp / e.hpMax)) / 2, e.y - e.r - 8, w * (e.hp / e.hpMax), 5);
    }
  }
}

function desenharTiros() {
  for (const b of tiros) {
    stroke(55, 60, 100);
    strokeWeight(4);
    line(b.x, b.y, b.x - b.vx * 0.025, b.y - b.vy * 0.025);
    noStroke();
    fill(55, 20, 100);
    circle(b.x, b.y, 7);
  }
  noStroke();
}

function desenharLaminas() {
  if (!st.laminas) return;
  noFill();
  stroke(30, 50, 100, 0.15);
  strokeWeight(2);
  circle(jogador.x, jogador.y, 124);
  noStroke();
  fill(30, 90, 100);
  for (let i = 0; i < st.laminas; i++) {
    const a = jogador.ang + (i * TWO_PI) / st.laminas;
    circle(jogador.x + Math.cos(a) * 62, jogador.y + Math.sin(a) * 62, 18);
  }
}

function desenharJogador() {
  if (estado === "fim") return;
  const piscar = jogador.inv > 0 && Math.floor(millis() / 80) % 2 === 0;
  const al = piscar ? 0.4 : 1;
  push();
  translate(jogador.x, jogador.y);
  drawingContext.shadowBlur = 25;
  drawingContext.shadowColor = "rgba(80,255,220,0.9)";
  noStroke();
  fill(170, 60, 100, al);
  circle(0, 0, jogador.r * 2);
  rotate(jogador.mira);
  fill(0, 0, 100, al);
  triangle(jogador.r + 9, 0, jogador.r - 4, -6, jogador.r - 4, 6);
  drawingContext.shadowBlur = 0;
  fill(170, 80, 40, al);
  circle(0, 0, jogador.r);
  pop();
}

function desenharParticulas() {
  noStroke();
  for (const p of particulas) {
    const k = p.vida / p.max;
    fill(p.cor, 60, 100, k);
    circle(p.x, p.y, p.t * k + 1);
  }
}

function desenharTextos() {
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(13);
  noStroke();
  for (const t of textos) {
    fill(0, 0, 100, constrain(t.vida * 2, 0, 1));
    text(t.txt, t.x, t.y);
  }
}

// ---------- HUD e telas ----------
function fmtTempo(s) {
  const m = Math.floor(s / 60), c = Math.floor(s % 60);
  return m + ":" + (c < 10 ? "0" : "") + c;
}

function btnLargura() {
  return Math.min(320 * ui, width * 0.92);
}

function desenharHUD() {
  if (estado === "menu") return;
  noStroke();
  rectMode(CORNER);

  // barra de XP
  fill(0, 0, 100, 0.12);
  rect(0, 0, width, 8 * ui);
  fill(185, 80, 100);
  rect(0, 0, width * constrain(xp / xpProx, 0, 1), 8 * ui);

  // vida
  const bx = 14 * ui, by = 22 * ui, bw = Math.min(150 * ui, width * 0.36), bh = 16 * ui;
  const r = constrain(st.hp / st.hpMax, 0, 1);
  fill(0, 0, 100, 0.15);
  rect(bx, by, bw, bh, bh / 2);
  if (r > 0) {
    fill(r * 110, 80, 100);
    rect(bx, by, Math.max(bh, bw * r), bh, bh / 2);
  }
  fill(0, 0, 100);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(12 * ui);
  text(Math.ceil(st.hp) + " / " + st.hpMax, bx + bw / 2, by + bh / 2 + 1);
  textAlign(LEFT, TOP);
  textSize(14 * ui);
  text("Nível " + nivel, bx, by + bh + 6 * ui);

  // tempo e abates
  textAlign(CENTER, TOP);
  textSize(28 * ui);
  text(fmtTempo(tempo), width / 2, 20 * ui);
  textAlign(RIGHT, TOP);
  textSize(16 * ui);
  text("Abates: " + abates, width - 14 * ui, 24 * ui);

  // aviso (chefe etc.)
  if (millis() < aviso.ate) {
    const p = 1 + Math.sin(millis() * 0.02) * 0.08;
    textAlign(CENTER, CENTER);
    textSize(32 * ui * p);
    fill(0, 90, 100);
    text(aviso.txt, width / 2, height * 0.22);
  }

  // joystick
  if (estado === "jogando" && joy.ativo) {
    const R = 70 * ui;
    const vx = joy.x - joy.ox, vy = joy.y - joy.oy;
    const d = Math.hypot(vx, vy);
    const m = d > R ? R / d : 1;
    noFill();
    stroke(0, 0, 100, 0.25);
    strokeWeight(3 * ui);
    circle(joy.ox, joy.oy, R * 2);
    noStroke();
    fill(0, 0, 100, 0.35);
    circle(joy.ox + vx * m, joy.oy + vy * m, 56 * ui);
  }

  // dica no começo
  if (estado === "jogando" && tempo < 7 && !joy.ativo && !usouTeclado) {
    const a = 0.6 + Math.sin(millis() * 0.006) * 0.3;
    fill(0, 0, 100, a);
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    textSize(20 * ui);
    text("Arraste o dedo para mover.\nA nave atira sozinha!", width / 2, height * 0.8);
  }
}

function desenharTelas() {
  noStroke();
  rectMode(CORNER);
  if (estado === "menu") desenharMenu();
  else if (estado === "upgrade") desenharUpgrade();
  else if (estado === "fim") desenharFim();
}

function desenharMenu() {
  textAlign(CENTER, CENTER);
  fill(0, 0, 100);
  textStyle(BOLD);
  textSize(52 * ui);
  text("ENXAME NEON", width / 2, height * 0.26);
  fill(170, 60, 100);
  textSize(16 * ui);
  text("SOBREVIVA AO ENXAME", width / 2, height * 0.26 + 40 * ui);
  textStyle(NORMAL);
  textSize(18 * ui);
  fill(0, 0, 100, 0.85);
  text("Arraste o dedo para mover.\nA nave atira sozinha.\nColete cristais e fique mais forte!", width / 2, height * 0.42);
  botaoPulsante("TOQUE PARA JOGAR", height * 0.6, 150);
  fill(50, 60, 100);
  textSize(18 * ui);
  text("Recorde: " + recorde + " pontos", width / 2, height * 0.72);
  fill(330, 50, 100);
  textSize(16 * ui);
  text("♥ Apoie o criador", width / 2, height * 0.88);
}

function layoutCartas() {
  const n = opcoes.length, r = [];
  if (width > height * 1.2) {
    const w = Math.min(width * 0.3, 260 * ui), h = 170 * ui, gap = 14 * ui;
    const total = n * w + (n - 1) * gap;
    for (let i = 0; i < n; i++) r.push({ x: width / 2 - total / 2 + w / 2 + i * (w + gap), y: height * 0.56, w, h });
  } else {
    const w = Math.min(width * 0.9, 440 * ui), h = 96 * ui, gap = 14 * ui;
    const total = n * h + (n - 1) * gap;
    const y0 = height * 0.58 - total / 2 + h / 2;
    for (let i = 0; i < n; i++) r.push({ x: width / 2, y: y0 + i * (h + gap), w, h });
  }
  return r;
}

function desenharUpgrade() {
  fill(0, 0, 0, 0.65);
  rect(0, 0, width, height);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  fill(50, 80, 100);
  textSize(44 * ui);
  text("NÍVEL " + nivel + "!", width / 2, height * 0.14);
  fill(0, 0, 100, 0.85);
  textStyle(NORMAL);
  textSize(18 * ui);
  text("Escolha uma melhoria", width / 2, height * 0.14 + 38 * ui);

  const L = layoutCartas();
  for (let i = 0; i < opcoes.length; i++) {
    const m = opcoes[i], c = L[i];
    const x0 = c.x - c.w / 2, y0 = c.y - c.h / 2;
    fill(m.cor, 60, 28, 0.95);
    stroke(m.cor, 70, 100);
    strokeWeight(2.5 * ui);
    rect(x0, y0, c.w, c.h, 14 * ui);
    noStroke();
    fill(m.cor, 70, 100);
    rect(x0, y0 + 10 * ui, 6 * ui, c.h - 20 * ui, 3 * ui);
    fill(0, 0, 100);
    textAlign(LEFT, TOP);
    textStyle(BOLD);
    textSize(21 * ui);
    text(m.nome, x0 + 20 * ui, y0 + 12 * ui, c.w - 30 * ui, 30 * ui);
    textStyle(NORMAL);
    textSize(15 * ui);
    fill(0, 0, 100, 0.85);
    text(m.desc, x0 + 20 * ui, y0 + 42 * ui, c.w - 30 * ui, c.h - 50 * ui);
    if (m.max < 999) {
      fill(m.cor, 40, 100);
      textSize(13 * ui);
      textAlign(RIGHT, TOP);
      text((pegos[m.id] || 0) + "/" + m.max, x0 + c.w - 12 * ui, y0 + 12 * ui);
    }
  }
}

function botoesFim() {
  const l = [];
  if (!usouContinuar && tempo >= CONFIG.segundosParaContinuar) {
    l.push({ id: "continuar", txt: "▶ CONTINUAR (ver anúncio)", cor: 50 });
  }
  l.push({ id: "novo", txt: "JOGAR DE NOVO", cor: 150 });
  l.push({ id: "apoio", txt: "♥ APOIAR O CRIADOR", cor: 330 });
  l.forEach((b, i) => (b.y = height * 0.6 + i * 62 * ui));
  return l;
}

function desenharFim() {
  fill(0, 0, 0, 0.6);
  rect(0, 0, width, height);
  textAlign(CENTER, CENTER);
  fill(0, 80, 100);
  textStyle(BOLD);
  textSize(46 * ui);
  text("VOCÊ CAIU", width / 2, height * 0.17);
  fill(0, 0, 100);
  textSize(22 * ui);
  text("Sobreviveu " + fmtTempo(tempo) + "   |   Abates: " + abates, width / 2, height * 0.27);
  textSize(30 * ui);
  text(pontuacao() + " pontos", width / 2, height * 0.35);
  fill(50, 70, 100);
  textSize(20 * ui);
  text(novoRecorde ? "NOVO RECORDE!" : "Recorde: " + recorde, width / 2, height * 0.43);
  for (const b of botoesFim()) botaoPulsante(b.txt, b.y, b.cor);
}

function botaoPulsante(txt, y, cor) {
  const s = 1 + Math.sin(frameCount * 0.08) * 0.04;
  push();
  translate(width / 2, y);
  scale(s);
  rectMode(CENTER);
  noStroke();
  fill(cor, 70, 95);
  rect(0, 0, btnLargura(), 52 * ui, 26 * ui);
  fill(0, 0, 10);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(18 * ui);
  text(txt, 0, 2);
  pop();
}

function btnSom() {
  return { x: width - 40 * ui, y: estado === "menu" ? 30 * ui : 62 * ui, w: 64 * ui, h: 26 * ui };
}

function desenharBotaoSom() {
  const b = btnSom();
  push();
  rectMode(CENTER);
  noStroke();
  fill(0, 0, 100, 0.12);
  rect(b.x, b.y, b.w, b.h, b.h / 2);
  fill(0, 0, 100, somLigado ? 0.9 : 0.5);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(12 * ui);
  text(somLigado ? "SOM: ON" : "SOM: OFF", b.x, b.y + 1);
  pop();
}

function desenharAvisoPix() {
  if (millis() > avisoPix) return;
  push();
  rectMode(CENTER);
  textAlign(CENTER, CENTER);
  noStroke();
  fill(0, 0, 0, 0.88);
  rect(width / 2, height * 0.5, Math.min(width * 0.92, 480 * ui), 120 * ui, 16 * ui);
  fill(150, 60, 100);
  textStyle(BOLD);
  textSize(22 * ui);
  text("Chave Pix copiada! ♥", width / 2, height * 0.5 - 28 * ui);
  fill(0, 0, 100);
  textSize(Math.min(17 * ui, (width * 0.9) / 24));
  text(CONFIG.chavePix, width / 2, height * 0.5 + 8 * ui);
  textStyle(NORMAL);
  textSize(14 * ui);
  fill(0, 0, 100, 0.7);
  text("Cole no app do seu banco. Obrigado!", width / 2, height * 0.5 + 38 * ui);
  pop();
}

// ---------- Entrada (toque, mouse e teclado) ----------
function abrirApoio() {
  const chave = CONFIG.chavePix;
  if (chave && !chave.startsWith("SUA-")) {
    try { navigator.clipboard.writeText(chave); } catch (e) {}
    avisoPix = millis() + 4000;
  } else {
    window.open(CONFIG.linkApoio, "_blank");
  }
}

function jogarDeNovo() {
  if (partidas % CONFIG.anuncioACada === 0) mostrarAnuncio("intersticial", novaPartida);
  else novaPartida();
}

function acertou(x, y, cx, cy, w, h) {
  return Math.abs(x - cx) < w / 2 && Math.abs(y - cy) < h / 2;
}

function apertou(x, y, id) {
  iniciarAudio();
  const sb = btnSom();

  if (estado === "jogando") {
    if (acertou(x, y, sb.x, sb.y, sb.w + 12, sb.h + 12)) {
      if (millis() - ultimoClique > 200) { ultimoClique = millis(); alternarSom(); }
      return;
    }
    if (!joy.ativo) joy = { ativo: true, id, ox: x, oy: y, x, y };
    return;
  }

  if (millis() - ultimoClique < 200) return;
  ultimoClique = millis();

  if (acertou(x, y, sb.x, sb.y, sb.w + 12, sb.h + 12)) { alternarSom(); return; }

  if (estado === "menu") {
    if (acertou(x, y, width / 2, height * 0.88, 240 * ui, 44 * ui)) abrirApoio();
    else novaPartida();
  } else if (estado === "upgrade") {
    const L = layoutCartas();
    for (let i = 0; i < L.length; i++) {
      if (acertou(x, y, L[i].x, L[i].y, L[i].w, L[i].h)) { escolher(i); return; }
    }
  } else if (estado === "fim") {
    for (const b of botoesFim()) {
      if (acertou(x, y, width / 2, b.y, btnLargura(), 52 * ui)) {
        if (b.id === "continuar") mostrarAnuncio("recompensado", continuarPartida);
        else if (b.id === "novo") jogarDeNovo();
        else abrirApoio();
        return;
      }
    }
  }
}

function moveu(x, y, id) {
  if (!joy.ativo || joy.id !== id) return;
  joy.x = x;
  joy.y = y;
  // joystick "flutuante": a base acompanha o dedo se ele se afastar demais
  const R = 70 * ui;
  const vx = x - joy.ox, vy = y - joy.oy;
  const d = Math.hypot(vx, vy);
  if (d > R * 1.5) {
    const k = (d - R * 1.5) / d;
    joy.ox += vx * k;
    joy.oy += vy * k;
  }
}

function soltou(id) {
  if (joy.id === id) joy.ativo = false;
}

function touchStarted() {
  for (const t of touches) {
    if (!toqueConhecido[t.id]) {
      toqueConhecido[t.id] = true;
      apertou(t.x, t.y, t.id);
    }
  }
  return false;
}

function touchMoved() {
  for (const t of touches) moveu(t.x, t.y, t.id);
  return false;
}

function touchEnded() {
  const ids = new Set(touches.map((t) => t.id));
  for (const id in toqueConhecido) {
    if (!ids.has(Number(id))) {
      delete toqueConhecido[id];
      soltou(Number(id));
    }
  }
  return false;
}

function mousePressed() { apertou(mouseX, mouseY, "mouse"); return false; }
function mouseDragged() { moveu(mouseX, mouseY, "mouse"); return false; }
function mouseReleased() { soltou("mouse"); return false; }

function keyPressed() {
  iniciarAudio();
  if (estado === "upgrade") {
    const i = parseInt(key) - 1;
    if (i >= 0 && i < opcoes.length) escolher(i);
    return false;
  }
  if (estado === "menu" && (key === " " || keyCode === ENTER)) { novaPartida(); return false; }
  if (estado === "fim" && keyCode === ENTER) { jogarDeNovo(); return false; }
  if (key === " ") return false; // evita rolar a página
}
