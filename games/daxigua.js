/* ============================================================
   合成大西瓜 —— 游戏核心
   物理：Matter.js  |  绘制：Canvas 2D 手绘水果
   ============================================================ */
(function () {
  'use strict';

  var M = Matter;
  var Engine = M.Engine, Composite = M.Composite, Bodies = M.Bodies, Body = M.Body, Events = M.Events;

  /* ---------------- 常量 ---------------- */
  var W = 440, H = 660;
  var LEFT = 30, RIGHT = 410, TOP = 100, FLOOR = 640;
  var DANGER_Y = 144;
  var DROP_Y = 54;
  var MAX_IDX = 10;
  var TAU = Math.PI * 2;
  var PTS = [1, 3, 6, 10, 15, 21, 28, 36, 45, 60];
  var SPAWN_POOL = [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 4];

  var FRUITS = [
    { n: '樱桃',  r: 16,  base: '#e01b3c', hi: '#ff9aa8', dark: '#96081f', type: 'cherry' },
    { n: '草莓',  r: 23,  base: '#f0344b', hi: '#ffa1ad', dark: '#a80f26', type: 'strawberry' },
    { n: '葡萄',  r: 30,  base: '#8b5cf6', hi: '#cbb9ff', dark: '#4f27a3', type: 'grape' },
    { n: '橘子',  r: 38,  base: '#ff8a1f', hi: '#ffc887', dark: '#c25a06', type: 'orange' },
    { n: '柿子',  r: 46,  base: '#ff6b1a', hi: '#ffb974', dark: '#b83d05', type: 'persimmon' },
    { n: '苹果',  r: 55,  base: '#e8352e', hi: '#ffa094', dark: '#96160f', type: 'apple' },
    { n: '梨',    r: 64,  base: '#c3d94a', hi: '#ecf7a4', dark: '#7f9418', type: 'pear' },
    { n: '水蜜桃', r: 74, base: '#ff9bb0', hi: '#ffd6de', dark: '#dd5779', type: 'peach' },
    { n: '菠萝',  r: 84,  base: '#f4b81c', hi: '#ffe491', dark: '#a97604', type: 'pineapple' },
    { n: '哈密瓜', r: 95, base: '#8ec63f', hi: '#d3eda1', dark: '#547f16', type: 'melon' },
    { n: '西瓜',  r: 107, base: '#2fa84f', hi: '#8ad79a', dark: '#145229', type: 'watermelon' }
  ];

  /* ---------------- 工具 ---------------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function el(id) { return document.getElementById(id); }

  var LS_BEST = 'suika.best.v1';
  var LS_CUSTOM = 'suika.custom.v1';
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  /* ---------------- 画布 ---------------- */
  var canvas = el('game');
  var ctx = canvas.getContext('2d');
  var dpr = 1;

  function setupCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  setupCanvas();
  window.addEventListener('resize', setupCanvas);

  /* ---------------- 水果绘制 ---------------- */
  var custom = { img: null, src: null, mode: 'cover' };

  function ballFill(g, r, f) {
    var grd = g.createRadialGradient(-r * 0.32, -r * 0.4, r * 0.04, 0, 0, r * 1.1);
    grd.addColorStop(0, f.hi);
    grd.addColorStop(0.52, f.base);
    grd.addColorStop(1, f.dark);
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fillStyle = grd; g.fill();
  }

  function rimAndGloss(g, r) {
    g.beginPath(); g.arc(0, 0, r, 0, TAU);
    g.lineWidth = Math.max(1, r * 0.045);
    g.strokeStyle = 'rgba(60,30,20,0.10)'; g.stroke();

    g.beginPath();
    g.ellipse(-r * 0.33, -r * 0.42, r * 0.31, r * 0.17, -0.62, 0, TAU);
    g.fillStyle = 'rgba(255,255,255,0.44)'; g.fill();

    g.beginPath();
    g.ellipse(-r * 0.10, -r * 0.62, r * 0.11, r * 0.06, -0.5, 0, TAU);
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.fill();
  }

  function fillBall(g, r, f) { ballFill(g, r, f); rimAndGloss(g, r); }

  function leaf(g, x, y, size, rot, color) {
    g.save();
    g.translate(x, y); g.rotate(rot);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(size * 0.78, -size * 0.64, size * 1.6, 0);
    g.quadraticCurveTo(size * 0.78, size * 0.52, 0, 0);
    g.fillStyle = color; g.fill();
    g.beginPath();
    g.moveTo(size * 0.08, 0); g.lineTo(size * 1.42, -size * 0.02);
    g.strokeStyle = 'rgba(255,255,255,0.32)';
    g.lineWidth = Math.max(0.6, size * 0.07); g.stroke();
    g.restore();
  }

  function stem(g, r, color) {
    g.save();
    g.strokeStyle = color || '#6b4226';
    g.lineWidth = Math.max(1.2, r * 0.13);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, -r * 0.86);
    g.quadraticCurveTo(r * 0.06, -r * 1.22, r * 0.26, -r * 1.28);
    g.stroke();
    g.restore();
  }

  function drawFruitBody(g, idx, r) {
    var f = FRUITS[idx];
    var k, a, s;

    switch (f.type) {
      case 'cherry':
        fillBall(g, r, f);
        stem(g, r);
        leaf(g, r * 0.22, -r * 1.24, r * 0.28, -0.5, '#4caf50');
        break;

      case 'strawberry': {
        fillBall(g, r, f);
        var seeds = [[-0.42, -0.28], [0.36, -0.32], [0.02, -0.04], [-0.5, 0.16],
                     [0.48, 0.1], [-0.26, 0.44], [0.3, 0.42], [0.0, 0.64]];
        g.fillStyle = '#ffe9a8';
        for (k = 0; k < seeds.length; k++) {
          s = seeds[k];
          g.beginPath();
          g.ellipse(s[0] * r, s[1] * r, r * 0.055, r * 0.085, 0, 0, TAU);
          g.fill();
        }
        for (k = -2; k <= 2; k++) {
          leaf(g, -r * 0.05, -r * 0.76, r * 0.28, -Math.PI / 2 + k * 0.52, '#3aa851');
        }
        break;
      }

      case 'grape': {
        var pts = [[0, -0.5], [-0.44, -0.28], [0.44, -0.28], [0, -0.02],
                   [-0.44, 0.26], [0.44, 0.26], [0, 0.5], [-0.22, 0.72], [0.22, 0.72]];
        var br = r * 0.31;
        for (k = 0; k < pts.length; k++) {
          var cx = pts[k][0] * r, cy = pts[k][1] * r;
          var grd = g.createRadialGradient(cx - br * 0.4, cy - br * 0.45, br * 0.08, cx, cy, br * 1.15);
          grd.addColorStop(0, '#cdbcff');
          grd.addColorStop(0.55, '#8b5cf6');
          grd.addColorStop(1, '#52289f');
          g.beginPath(); g.arc(cx, cy, br, 0, TAU); g.fillStyle = grd; g.fill();
        }
        g.save();
        g.strokeStyle = '#6b4226'; g.lineWidth = Math.max(1.1, r * 0.11); g.lineCap = 'round';
        g.beginPath(); g.moveTo(0, -r * 0.66); g.quadraticCurveTo(r * 0.1, -r * 1.0, r * 0.34, -r * 1.06);
        g.stroke(); g.restore();
        leaf(g, r * 0.3, -r * 1.02, r * 0.26, -0.45, '#5cb85c');
        break;
      }

      case 'orange': {
        fillBall(g, r, f);
        g.save();
        g.globalAlpha = 0.16; g.strokeStyle = '#fff';
        g.lineWidth = Math.max(1, r * 0.05);
        for (k = 0; k < 8; k++) {
          a = k * Math.PI / 4 + 0.2;
          g.beginPath();
          g.moveTo(Math.cos(a) * r * 0.12, Math.sin(a) * r * 0.12);
          g.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
          g.stroke();
        }
        g.restore();
        g.beginPath(); g.arc(0, -r * 0.88, r * 0.09, 0, TAU); g.fillStyle = '#7a4a1c'; g.fill();
        leaf(g, r * 0.04, -r * 0.86, r * 0.26, -0.42, '#43a047');
        break;
      }

      case 'persimmon': {
        fillBall(g, r, f);
        g.save();
        g.translate(0, -r * 0.6);
        g.fillStyle = '#3f7d3a';
        for (k = 0; k < 4; k++) {
          g.save(); g.rotate(k * Math.PI / 2 + 0.4);
          g.beginPath(); g.ellipse(r * 0.3, 0, r * 0.32, r * 0.14, 0, 0, TAU); g.fill();
          g.restore();
        }
        g.beginPath(); g.arc(0, 0, r * 0.1, 0, TAU); g.fillStyle = '#2f5f2c'; g.fill();
        g.restore();
        break;
      }

      case 'apple': {
        fillBall(g, r, f);
        stem(g, r, '#6b4226');
        leaf(g, r * 0.26, -r * 1.18, r * 0.26, -0.55, '#4caf50');
        g.beginPath();
        g.arc(0, -r * 0.88, r * 0.17, 0.2, Math.PI - 0.2);
        g.strokeStyle = 'rgba(110,16,16,0.32)';
        g.lineWidth = r * 0.055; g.stroke();
        break;
      }

      case 'pear': {
        var pg = g.createRadialGradient(-r * 0.3, -r * 0.25, r * 0.08, 0, 0, r * 1.15);
        pg.addColorStop(0, f.hi);
        pg.addColorStop(0.55, f.base);
        pg.addColorStop(1, f.dark);
        g.beginPath();
        g.moveTo(0, -r * 0.92);
        g.bezierCurveTo(r * 0.52, -r * 0.92, r * 0.56, -r * 0.34, r * 0.74, r * 0.12);
        g.bezierCurveTo(r * 0.98, r * 0.78, r * 0.52, r * 1.0, 0, r * 1.0);
        g.bezierCurveTo(-r * 0.52, r * 1.0, -r * 0.98, r * 0.78, -r * 0.74, r * 0.12);
        g.bezierCurveTo(-r * 0.56, -r * 0.34, -r * 0.52, -r * 0.92, 0, -r * 0.92);
        g.closePath();
        g.fillStyle = pg; g.fill();
        g.lineWidth = Math.max(1, r * 0.045); g.strokeStyle = 'rgba(60,30,20,0.10)'; g.stroke();
        g.beginPath();
        g.ellipse(-r * 0.32, r * 0.3, r * 0.24, r * 0.15, -0.5, 0, TAU);
        g.fillStyle = 'rgba(255,255,255,0.42)'; g.fill();
        g.beginPath();
        g.strokeStyle = '#8a6b28'; g.lineWidth = Math.max(1.2, r * 0.1); g.lineCap = 'round';
        g.moveTo(0, -r * 0.86);
        g.quadraticCurveTo(r * 0.04, -r * 1.14, r * 0.18, -r * 1.2);
        g.stroke();
        leaf(g, r * 0.16, -r * 1.16, r * 0.24, -0.5, '#5cb85c');
        break;
      }

      case 'peach': {
        fillBall(g, r, f);
        g.beginPath();
        g.moveTo(0, -r * 0.76);
        g.quadraticCurveTo(-r * 0.3, r * 0.02, r * 0.02, r * 0.86);
        g.strokeStyle = 'rgba(214,96,124,0.38)';
        g.lineWidth = Math.max(1, r * 0.07); g.lineCap = 'round'; g.stroke();
        leaf(g, r * 0.14, -r * 1.0, r * 0.28, -0.48, '#4caf50');
        break;
      }

      case 'pineapple': {
        ballFill(g, r, f);
        g.save();
        g.beginPath(); g.arc(0, 0, r, 0, TAU); g.clip();
        g.strokeStyle = 'rgba(168,108,8,0.26)';
        g.lineWidth = Math.max(0.8, r * 0.028);
        for (k = -4; k <= 4; k++) {
          var off = k * r * 0.3;
          g.beginPath(); g.moveTo(-r, off); g.lineTo(r, off + r * 1.5); g.stroke();
          g.beginPath(); g.moveTo(-r, off); g.lineTo(r, off - r * 1.5); g.stroke();
        }
        g.restore();
        rimAndGloss(g, r);
        g.save();
        g.fillStyle = '#3f9e4a';
        for (k = -2; k <= 2; k++) {
          g.save();
          g.translate(0, -r * 0.88); g.rotate(k * 0.44);
          g.beginPath();
          g.moveTo(-r * 0.09, 0);
          g.quadraticCurveTo(-r * 0.04, -r * 0.42, r * 0.05, -r * 0.64);
          g.quadraticCurveTo(r * 0.13, -r * 0.3, r * 0.09, 0);
          g.closePath(); g.fill();
          g.restore();
        }
        g.restore();
        break;
      }

      case 'melon': {
        ballFill(g, r, f);
        g.save();
        g.beginPath(); g.arc(0, 0, r, 0, TAU); g.clip();
        g.strokeStyle = 'rgba(84,132,34,0.2)'; g.lineWidth = r * 0.07;
        for (k = -3; k <= 3; k++) {
          var xx = k * r * 0.3;
          g.beginPath();
          g.moveTo(xx, -r);
          g.quadraticCurveTo(xx * 1.35, 0, xx, r);
          g.stroke();
        }
        g.strokeStyle = 'rgba(255,255,255,0.45)';
        g.lineWidth = Math.max(0.7, r * 0.026);
        for (k = -3; k <= 3; k++) {
          g.beginPath();
          g.moveTo(-r, k * r * 0.34);
          g.bezierCurveTo(-r * 0.3, (k * 0.34 - 0.42) * r, r * 0.3, (k * 0.34 + 0.42) * r, r, k * r * 0.34);
          g.stroke();
        }
        g.restore();
        rimAndGloss(g, r);
        break;
      }

      case 'watermelon': {
        var wg = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.05);
        wg.addColorStop(0, '#71d189');
        wg.addColorStop(0.62, '#2e9d55');
        wg.addColorStop(1, '#145d2b');
        g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fillStyle = wg; g.fill();

        g.save();
        g.beginPath(); g.arc(0, 0, r, 0, TAU); g.clip();
        g.fillStyle = 'rgba(17,80,40,0.5)';
        for (k = -3; k <= 3; k++) {
          var sx = k * r * 0.44;
          g.beginPath();
          g.moveTo(sx, -r * 1.1);
          g.bezierCurveTo(sx * 1.3, -r * 0.4, sx * 1.3, r * 0.4, sx, r * 1.1);
          g.lineTo(sx + r * 0.11, r * 1.1);
          g.bezierCurveTo(sx * 1.3 + r * 0.11, r * 0.4, sx * 1.3 + r * 0.11, -r * 0.4, sx + r * 0.11, -r * 1.1);
          g.closePath(); g.fill();
        }
        g.restore();

        var fg = g.createRadialGradient(-r * 0.14, -r * 0.2, r * 0.05, 0, 0, r * 0.8);
        fg.addColorStop(0, '#ff9393');
        fg.addColorStop(0.62, '#f8404e');
        fg.addColorStop(1, '#cf1930');
        g.beginPath(); g.arc(0, 0, r * 0.8, 0, TAU); g.fillStyle = fg; g.fill();
        g.beginPath(); g.arc(0, 0, r * 0.8, 0, TAU);
        g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = r * 0.045; g.stroke();

        var sd = [[-0.34, -0.3], [0.32, -0.34], [0.02, 0.02], [-0.44, 0.14],
                  [0.42, 0.14], [-0.18, 0.44], [0.24, 0.46]];
        g.fillStyle = '#38120f';
        for (k = 0; k < sd.length; k++) {
          g.save();
          g.translate(sd[k][0] * r, sd[k][1] * r);
          g.rotate(sd[k][0] * 2);
          g.beginPath(); g.ellipse(0, 0, r * 0.052, r * 0.08, 0, 0, TAU); g.fill();
          g.restore();
        }

        g.beginPath();
        g.ellipse(-r * 0.34, -r * 0.42, r * 0.28, r * 0.16, -0.6, 0, TAU);
        g.fillStyle = 'rgba(255,255,255,0.34)'; g.fill();
        break;
      }
    }
  }

  function drawCustomBall(g, r) {
    var img = custom.img;
    g.save();
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.clip();
    if (custom.mode === 'contain') {
      g.fillStyle = '#fffdf8';
      g.fillRect(-r, -r, r * 2, r * 2);
      var pad = 0.9;
      var sc = Math.min((r * 2 * pad) / img.width, (r * 2 * pad) / img.height);
      var cw = img.width * sc, ch = img.height * sc;
      g.drawImage(img, -cw / 2, -ch / 2, cw, ch);
    } else {
      var s2 = Math.max((r * 2) / img.width, (r * 2) / img.height);
      var w2 = img.width * s2, h2 = img.height * s2;
      g.drawImage(img, -w2 / 2, -h2 / 2, w2, h2);
    }
    var lg = g.createLinearGradient(0, -r, 0, r * 0.35);
    lg.addColorStop(0, 'rgba(255,255,255,0.26)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg;
    g.fillRect(-r, -r, r * 2, r * 2);
    g.restore();

    g.beginPath(); g.arc(0, 0, r * 0.985, 0, TAU);
    g.lineWidth = Math.max(1.5, r * 0.055);
    g.strokeStyle = 'rgba(255,255,255,0.72)'; g.stroke();
    g.beginPath(); g.arc(0, 0, r, 0, TAU);
    g.lineWidth = Math.max(1, r * 0.02);
    g.strokeStyle = 'rgba(90,60,45,0.16)'; g.stroke();
  }

  function drawFruitAt(g, x, y, idx, angle, scale) {
    var f = FRUITS[idx];
    var r = f.r * (scale || 1);
    g.save();
    g.translate(x, y);

    // 柔和的外围投影（与形状无关，任何轮廓都适用）
    g.save();
    g.scale(1, 0.94);
    var sg = g.createRadialGradient(0, r * 0.14, r * 0.55, 0, r * 0.14, r * 1.16);
    sg.addColorStop(0, 'rgba(126,84,54,0.20)');
    sg.addColorStop(0.62, 'rgba(126,84,54,0.10)');
    sg.addColorStop(1, 'rgba(126,84,54,0)');
    g.beginPath();
    g.arc(0, r * 0.14, r * 1.16, 0, TAU);
    g.fillStyle = sg;
    g.fill();
    g.restore();

    if (idx === MAX_IDX && custom.img) {
      drawCustomBall(g, r);
    } else {
      g.save();
      g.rotate(angle || 0);
      drawFruitBody(g, idx, r);
      g.restore();
    }
    g.restore();
  }

  /* ---------------- 音效 ---------------- */
  var audio = { ac: null, muted: false };

  function ensureAudio() {
    if (audio.muted) return null;
    if (!audio.ac) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { audio.ac = new AC(); } catch (e) { return null; }
    }
    if (audio.ac.state === 'suspended') audio.ac.resume();
    return audio.ac;
  }

  function tone(freq, dur, type, vol, delay) {
    var ac = ensureAudio();
    if (!ac) return;
    var t0 = ac.currentTime + (delay || 0);
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.09, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(t0); o.stop(t0 + dur + 0.04);
  }

  function sfx(kind, lv) {
    if (audio.muted) return;
    if (kind === 'drop') { tone(160, 0.09, 'sine', 0.05); }
    else if (kind === 'merge') {
      var f = 260 + lv * 42;
      tone(f, 0.16, 'triangle', 0.075);
      tone(f * 1.5, 0.13, 'sine', 0.045, 0.03);
    } else if (kind === 'boom') {
      tone(220, 0.22, 'sawtooth', 0.05);
      tone(110, 0.34, 'sine', 0.07, 0.04);
    } else if (kind === 'over') {
      tone(330, 0.18, 'sine', 0.06);
      tone(247, 0.22, 'sine', 0.06, 0.14);
      tone(165, 0.4, 'sine', 0.07, 0.3);
    } else if (kind === 'win') {
      tone(523, 0.16, 'triangle', 0.07);
      tone(659, 0.16, 'triangle', 0.07, 0.1);
      tone(784, 0.28, 'triangle', 0.08, 0.2);
    }
  }

  /* ---------------- 物理世界 ---------------- */
  var engine = Engine.create({
    positionIterations: 8,
    velocityIterations: 6,
    constraintIterations: 3,
    enableSleeping: false
  });
  engine.gravity.y = 1.15;

  var wallOpts = { isStatic: true, friction: 0.6, frictionStatic: 0.8, restitution: 0.02 };
  Composite.add(engine.world, [
    Bodies.rectangle((LEFT + RIGHT) / 2, FLOOR + 26, (RIGHT - LEFT) + 140, 52, wallOpts),
    Bodies.rectangle(LEFT - 26, (TOP + FLOOR) / 2, 52, (FLOOR - TOP) + 90, wallOpts),
    Bodies.rectangle(RIGHT + 26, (TOP + FLOOR) / 2, 52, (FLOOR - TOP) + 90, wallOpts)
  ]);

  var state = {
    running: false,
    over: false,
    score: 0,
    display: 0,
    best: 0,
    heldIdx: null,
    nextIdx: null,
    aimX: W / 2,
    cooldown: 0,
    time: 0,
    shake: 0,
    maxLevel: 0,
    merged: 0,
    particles: [],
    popups: [],
    toast: null
  };

  // 一键演示状态：target 是罐内当前最大的水果，下一次投放就瞄准它
  var demo = {
    active: false,
    done: false,
    queue: [],
    target: null,
    since: 0,
    total: 11
  };

  function createFruit(idx, x, y) {
    var f = FRUITS[idx];
    var b = Bodies.circle(x, y, f.r, {
      restitution: 0.16,
      friction: 0.42,
      frictionStatic: 0.6,
      frictionAir: 0.006,
      density: 0.0016,
      slop: 0.015,
      label: 'fruit'
    });
    b.gd = { level: idx, removed: false, age: 0, above: 0, pop: 0 };
    Composite.add(engine.world, b);
    return b;
  }

  var merges = [];

  Events.on(engine, 'collisionStart', function (ev) {
    if (!state.running || state.over) return;
    var ps = ev.pairs;
    for (var i = 0; i < ps.length; i++) {
      var a = ps[i].bodyA, b = ps[i].bodyB;
      var ga = a.gd, gb = b.gd;
      if (!ga || !gb || ga.removed || gb.removed) continue;
      if (ga.level !== gb.level) continue;
      ga.removed = true;
      gb.removed = true;
      merges.push(a, b);
    }
  });

  function randSpawn() {
    return SPAWN_POOL[Math.floor(Math.random() * SPAWN_POOL.length)];
  }

  function addScore(n) {
    state.score += n;
    if (demo.active) return; // 演示分不计入最高分
    if (state.score > state.best) {
      state.best = state.score;
      lsSet(LS_BEST, String(state.best));
      if (bestEl) bestEl.textContent = String(state.best);
    }
  }

  function burst(x, y, color, n, power) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU;
      var sp = (0.6 + Math.random() * 1.5) * (power || 2.2);
      state.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.8,
        r: 1.6 + Math.random() * 3.2,
        life: 1,
        decay: 0.012 + Math.random() * 0.018,
        color: color
      });
    }
  }

  function popup(x, y, text, color) {
    state.popups.push({ x: x, y: y, text: text, color: color || '#ff3d3d', life: 1 });
  }

  function processMerges() {
    while (merges.length >= 2) {
      var a = merges.shift(), b = merges.shift();
      var level = a.gd.level;
      var x = (a.position.x + b.position.x) / 2;
      var y = (a.position.y + b.position.y) / 2;
      var sp = { x: (a.velocity.x + b.velocity.x) / 2, y: (a.velocity.y + b.velocity.y) / 2 };

      Composite.remove(engine.world, a);
      Composite.remove(engine.world, b);

      burst(x, y, FRUITS[level].hi, 8 + level * 2, 2);
      burst(x, y, FRUITS[level].base, 5 + level, 2.6);

      if (level >= MAX_IDX) {
        addScore(300);
        popup(x, y - 10, '+300', '#e01b3c');
        burst(x, y, '#ffd166', 26, 4.4);
        state.shake = 12;
        sfx('boom');
        continue;
      }

      var nl = level + 1;
      var nb = createFruit(nl, x, y);
      Body.setVelocity(nb, { x: sp.x * 0.35, y: sp.y * 0.35 - 0.9 });
      nb.gd.pop = 0.001;

      var gain = PTS[level];
      addScore(gain);
      popup(x, y - 6, '+' + gain, FRUITS[nl].base);
      sfx('merge', nl);
      state.shake = Math.max(state.shake, 2 + nl * 0.7);

      if (nl > state.maxLevel) state.maxLevel = nl;

      if (nl === MAX_IDX) {
        state.toast = { text: '大西瓜诞生！', t: 1.6 };
        burst(x, y, '#ffd166', 30, 4.6);
        sfx('win');
      }
    }
  }

  function checkGameOver() {
    if (state.over || demo.active) return;
    var bodies = Composite.allBodies(engine.world);
    var dead = false;
    for (var i = 0; i < bodies.length; i++) {
      var b = bodies[i];
      if (!b.gd || b.gd.removed) continue;
      b.gd.age += 1 / 60;
      var sp = Math.sqrt(b.velocity.x * b.velocity.x + b.velocity.y * b.velocity.y);
      var above = (b.position.y - FRUITS[b.gd.level].r) < DANGER_Y;
      if (above && b.gd.age > 0.8 && sp < 2.6) b.gd.above += 1000 / 60;
      else b.gd.above = Math.max(0, b.gd.above - 26);
      if (b.gd.above > 1150) dead = true;
    }
    if (dead) endGame();
  }

  /* ---------------- 流程控制 ---------------- */
  var scoreEl = el('score'), bestEl = el('best');
  var overlay = el('overlay'), startCard = el('startCard'), overCard = el('overCard');

  function resetWorld() {
    var bodies = Composite.allBodies(engine.world).slice();
    for (var i = 0; i < bodies.length; i++) {
      if (bodies[i].gd) Composite.remove(engine.world, bodies[i]);
    }
    merges.length = 0;
    state.particles.length = 0;
    state.popups.length = 0;
    state.toast = null;
  }

  function startGame() {
    resetWorld();
    demo.active = false;
    demo.done = false;
    demo.queue.length = 0;
    demo.target = null;
    state.running = true;
    state.over = false;
    state.score = 0;
    state.display = 0;
    state.time = 0;
    state.shake = 0;
    state.maxLevel = 0;
    state.merged = 0;
    state.cooldown = 0.25;
    state.aimX = W / 2;
    state.heldIdx = randSpawn();
    state.nextIdx = randSpawn();
    scoreEl.textContent = '0';
    bestEl.textContent = String(state.best);
    overlay.classList.remove('show');
    syncDemoBtn();
    drawNext();
  }

  function endGame() {
    state.over = true;
    state.running = false;
    sfx('over');
    state.shake = 10;
    el('finalScore').textContent = String(state.score);
    el('overBest').textContent = String(state.best);
    el('maxFruitTip').textContent = state.maxLevel > 0
      ? '最大合成到「' + FRUITS[state.maxLevel].n + '」'
      : '还没合成出水果';
    overCard.classList.remove('hidden');
    startCard.classList.add('hidden');
    overlay.classList.add('show');
    bestEl.textContent = String(state.best);
  }

  function heldY(r) { return Math.max(DROP_Y, r * 0.96 + 4); }

  function drop() {
    if (!state.running || state.over || demo.active) return;
    if (state.cooldown > 0 || state.heldIdx === null) return;
    var f = FRUITS[state.heldIdx];
    var x = clamp(state.aimX, LEFT + f.r + 1, RIGHT - f.r - 1);
    var b = createFruit(state.heldIdx, x, heldY(f.r));
    Body.setVelocity(b, { x: 0, y: 1.6 });
    Body.setAngularVelocity(b, (Math.random() - 0.5) * 0.05);
    sfx('drop');

    state.heldIdx = state.nextIdx;
    state.nextIdx = randSpawn();
    state.cooldown = 0.36;
    drawNext();
  }

  /* ---------------- 一键演示 ----------------
     原理：罐里始终只保留一个"正在长大"的水果。
     先放两颗樱桃合成草莓，随后每投放一颗同级水果就吃掉它、升一级。
     11 次投放走完整条链，全部依赖真实物理碰撞，不是假动画。 */

  function demoHighest() {
    var bs = Composite.allBodies(engine.world), best = null;
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i];
      if (!b.gd || b.gd.removed) continue;
      if (!best || b.gd.level > best.gd.level) best = b;
    }
    return best;
  }

  function demoCalm() {
    var bs = Composite.allBodies(engine.world);
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i];
      if (!b.gd || b.gd.removed) continue;
      if (b.speed > 1.5 || Math.abs(b.angularVelocity) > 0.14) return false;
    }
    return true;
  }

  function demoDropNext() {
    var lv = demo.queue.shift();
    var f = FRUITS[lv];
    var tx = (demo.target && !demo.target.gd.removed) ? demo.target.position.x : W / 2;
    var x = clamp(tx, LEFT + f.r + 2, RIGHT - f.r - 2);
    var b = createFruit(lv, x, heldY(f.r));
    Body.setVelocity(b, { x: 0, y: 2.4 });
    Body.setAngularVelocity(b, 0);
    sfx('drop');
    demo.since = 0;
    if (demo.queue.length) {
      state.nextIdx = demo.queue[0];
      drawNext();
    }
  }

  function syncDemoBtn() {
    var btn = el('demoBtn');
    if (!btn) return;
    btn.classList.toggle('on', demo.active);
    btn.title = demo.active ? '停止演示' : '一键演示：自动合成出大西瓜';
    btn.setAttribute('aria-label', demo.active ? '停止演示' : '一键演示');
  }

  function startDemo() {
    resetWorld();
    demo.active = true;
    demo.done = false;
    demo.queue = [0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    demo.target = null;
    demo.since = 0;
    demo.total = demo.queue.length;

    state.running = true;
    state.over = false;
    state.time = 0;
    state.score = 0;
    state.display = 0;
    state.shake = 0;
    state.maxLevel = 0;
    state.cooldown = 0;
    state.aimX = W / 2;
    state.heldIdx = null;
    state.nextIdx = demo.queue[0];
    state.particles.length = 0;
    state.popups.length = 0;
    state.toast = null;

    scoreEl.textContent = '0';
    bestEl.textContent = String(state.best);
    overCard.classList.add('hidden');
    startCard.classList.remove('hidden');
    overlay.classList.remove('show');
    syncDemoBtn();
    drawNext();
  }

  function stopDemo() {
    demo.active = false;
    demo.done = false;
    demo.queue.length = 0;
    demo.target = null;
    resetWorld();
    state.running = false;
    state.over = false;
    state.heldIdx = null;
    state.score = 0;
    state.display = 0;
    scoreEl.textContent = '0';
    startCard.classList.remove('hidden');
    overCard.classList.add('hidden');
    overlay.classList.add('show');
    syncDemoBtn();
    drawNext();
  }

  // 演示结束：西瓜留在罐里当"奖杯"，玩家从这里接着玩
  function finishDemo() {
    demo.active = false;
    demo.done = true;
    demo.target = null;
    demo.queue.length = 0;
    state.score = 0;
    state.display = 0;
    state.maxLevel = 0;
    scoreEl.textContent = '0';
    state.heldIdx = randSpawn();
    state.nextIdx = randSpawn();
    state.cooldown = 0.9;
    state.toast = { text: '演示完成 · 该你上场了', t: 2.8 };
    syncDemoBtn();
    drawNext();
  }

  function demoTick(dts) {
    if (!demo.active) return;
    demo.since += dts;
    demo.target = demoHighest();

    if (!demo.queue.length) {
      // 等西瓜稳住、庆祝特效播完再收尾
      if (demo.since > 2.0 && demoCalm()) finishDemo();
      else if (demo.since > 3.6) finishDemo();
      return;
    }

    if (demo.since < 0.45) return;              // 最小间隔，避免两颗叠在一起
    if (!demoCalm() && demo.since < 2.2) return; // 等上一颗落稳再投
    demoDropNext();
  }

  /* ---------------- 渲染 ---------------- */
  function jarPath() {
    var rad = 36;
    ctx.beginPath();
    ctx.moveTo(LEFT, TOP - 8);
    ctx.lineTo(LEFT, FLOOR - rad);
    ctx.quadraticCurveTo(LEFT, FLOOR, LEFT + rad, FLOOR);
    ctx.lineTo(RIGHT - rad, FLOOR);
    ctx.quadraticCurveTo(RIGHT, FLOOR, RIGHT, FLOOR - rad);
    ctx.lineTo(RIGHT, TOP - 8);
  }

  // 内容裁剪区：左右跟随罐壁，顶部延伸到画布外（水果从上方落下时不会被切掉）
  function clipPath() {
    var rad = 36;
    ctx.beginPath();
    ctx.moveTo(LEFT, -60);
    ctx.lineTo(LEFT, FLOOR - rad);
    ctx.quadraticCurveTo(LEFT, FLOOR, LEFT + rad, FLOOR);
    ctx.lineTo(RIGHT - rad, FLOOR);
    ctx.quadraticCurveTo(RIGHT, FLOOR, RIGHT, FLOOR - rad);
    ctx.lineTo(RIGHT, -60);
    ctx.closePath();
  }

  function drawJarBg() {
    ctx.save();
    clipPath();
    ctx.clip();
    // 顶部透明、底部渐实的玻璃感，避免出现生硬的横向边线
    var g = ctx.createLinearGradient(0, TOP - 40, 0, FLOOR);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.35, 'rgba(255,251,242,0.28)');
    g.addColorStop(0.7, 'rgba(255,246,232,0.52)');
    g.addColorStop(1, 'rgba(255,238,219,0.82)');
    ctx.fillStyle = g;
    ctx.fillRect(LEFT - 2, TOP - 40, (RIGHT - LEFT) + 4, (FLOOR - TOP) + 60);
    ctx.restore();
  }

  function drawJarLines() {
    // 罐壁：顶部渐隐，底部渐实，看起来像一只敞口的玻璃罐
    var wg = ctx.createLinearGradient(0, TOP - 30, 0, FLOOR);
    wg.addColorStop(0, 'rgba(255,255,255,0)');
    wg.addColorStop(0.16, 'rgba(255,255,255,0.55)');
    wg.addColorStop(0.42, 'rgba(255,255,255,0.95)');
    wg.addColorStop(1, 'rgba(255,255,255,1)');

    var tg = ctx.createLinearGradient(0, TOP - 30, 0, FLOOR);
    tg.addColorStop(0, 'rgba(196,150,124,0)');
    tg.addColorStop(0.2, 'rgba(196,150,124,0.12)');
    tg.addColorStop(1, 'rgba(186,136,108,0.34)');

    ctx.save();
    jarPath();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = wg;
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = tg;
    ctx.stroke();
    ctx.restore();

    // 罐底柔光阴影
    ctx.save();
    clipPath(); ctx.clip();
    var fg = ctx.createRadialGradient((LEFT + RIGHT) / 2, FLOOR, 8, (LEFT + RIGHT) / 2, FLOOR, (RIGHT - LEFT) * 0.62);
    fg.addColorStop(0, 'rgba(186,136,108,0.22)');
    fg.addColorStop(1, 'rgba(186,136,108,0)');
    ctx.fillStyle = fg;
    ctx.fillRect(LEFT, FLOOR - 90, RIGHT - LEFT, 90);
    ctx.restore();
  }

  function drawDanger() {
    var near = false;
    var bodies = Composite.allBodies(engine.world);
    for (var i = 0; i < bodies.length; i++) {
      var b = bodies[i];
      if (!b.gd || b.gd.removed) continue;
      if (b.gd.above > 60) { near = true; break; }
    }
    var pulse = 0.5 + 0.5 * Math.sin(state.time * 7);
    ctx.save();
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = near
      ? 'rgba(255,70,60,' + (0.5 + pulse * 0.45) + ')'
      : 'rgba(255,110,80,0.28)';
    ctx.beginPath();
    ctx.moveTo(LEFT + 8, DANGER_Y);
    ctx.lineTo(RIGHT - 8, DANGER_Y);
    ctx.stroke();
    ctx.restore();
  }

  function drawFruits() {
    var bodies = Composite.allBodies(engine.world);
    var list = [];
    for (var i = 0; i < bodies.length; i++) {
      if (bodies[i].gd && !bodies[i].gd.removed) list.push(bodies[i]);
    }
    list.sort(function (a, b) { return a.position.y - b.position.y; });
    for (var j = 0; j < list.length; j++) {
      var b = list[j];
      var gd = b.gd;
      var sc = 1;
      if (gd.pop > 0 && gd.pop < 1) {
        gd.pop += 0.1;
        var t = Math.min(1, gd.pop);
        sc = 0.72 + 0.32 * t - 0.04 * Math.sin(t * Math.PI);
      } else if (gd.pop >= 1) {
        gd.pop = 0;
      }
      drawFruitAt(ctx, b.position.x, b.position.y, gd.level, b.angle, sc);
    }
  }

  function drawParticles() {
    for (var i = 0; i < state.particles.length; i++) {
      var p = state.particles[i];
      ctx.globalAlpha = Math.max(0, p.life) * 0.9;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.4 + p.life * 0.8), 0, TAU);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawHeld() {
    if (!state.running || state.over || state.cooldown > 0 || state.heldIdx === null) return;
    var f = FRUITS[state.heldIdx];
    var x = clamp(state.aimX, LEFT + f.r + 1, RIGHT - f.r - 1);
    var hy = heldY(f.r);

    ctx.save();
    ctx.setLineDash([7, 10]);
    ctx.lineDashOffset = -state.time * 34;
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = 'rgba(255,120,90,0.26)';
    ctx.beginPath();
    ctx.moveTo(x, hy + f.r + 8);
    ctx.lineTo(x, FLOOR - 10);
    ctx.stroke();
    ctx.restore();

    drawFruitAt(ctx, x, hy, state.heldIdx, Math.sin(state.time * 2.2) * 0.06, 0.95);
  }

  function drawPopups() {
    for (var i = 0; i < state.popups.length; i++) {
      var p = state.popups[i];
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life * 1.6);
      ctx.font = '800 18px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    }
  }

  function drawToast() {
    if (!state.toast) return;
    var t = state.toast.t;
    var a = Math.min(1, t * 1.8);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var y = TOP + 52 - (1 - Math.min(1, t / 1.6)) * 8;
    ctx.font = '800 22px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeText(state.toast.text, W / 2, y);
    var g = ctx.createLinearGradient(0, y - 14, 0, y + 14);
    g.addColorStop(0, '#ff8a3d');
    g.addColorStop(1, '#e01b3c');
    ctx.fillStyle = g;
    ctx.fillText(state.toast.text, W / 2, y);
    ctx.restore();
  }

  function drawDemoBadge() {
    if (!demo.active) return;
    var lv = (demo.target && !demo.target.gd.removed) ? demo.target.gd.level : -1;
    var label = lv >= 0 ? ('演示中 · 当前「' + FRUITS[lv].n + '」') : '演示中 · 准备投放';
    var p = demo.total ? (demo.total - demo.queue.length) / demo.total : 0;
    p = clamp(p, 0, 1);

    // 顶部渐隐压条：水果从它后面落下来，不会被浮块挡住
    var g = ctx.createLinearGradient(0, 0, 0, 36);
    g.addColorStop(0, 'rgba(255,248,240,0.97)');
    g.addColorStop(0.68, 'rgba(255,248,240,0.9)');
    g.addColorStop(1, 'rgba(255,248,240,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, 36);

    var pad = 26;
    ctx.fillStyle = 'rgba(255,110,70,0.15)';
    ctx.fillRect(pad, 28, W - pad * 2, 2.5);
    ctx.fillStyle = 'rgba(255,92,58,0.85)';
    ctx.fillRect(pad, 28, (W - pad * 2) * p, 2.5);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 11.5px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
    var tw = ctx.measureText(label).width;
    ctx.fillStyle = '#c2391f';
    ctx.fillText(label, W / 2 + 6, 14.5);
    ctx.restore();

    var pulse = 0.5 + 0.5 * Math.sin(state.time * 4.2);
    ctx.beginPath();
    ctx.arc(W / 2 - tw / 2 - 8, 14.5, 3, 0, TAU);
    ctx.fillStyle = 'rgba(255,72,48,' + (0.3 + pulse * 0.65).toFixed(3) + ')';
    ctx.fill();
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    if (state.shake > 0.3) {
      ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }

    drawJarBg();

    ctx.save();
    clipPath();
    ctx.clip();
    drawFruits();
    drawParticles();
    ctx.restore();

    drawJarLines();
    drawDanger();
    drawHeld();
    drawPopups();
    drawToast();
    drawDemoBadge();
  }

  /* ---------------- 主循环 ---------------- */
  var STEP = 1000 / 60;
  var acc = 0;
  var lastT = 0;

  function loop(now) {
    if (!lastT) lastT = now;
    var dt = now - lastT;
    lastT = now;
    if (dt > 200) dt = 200;

    if (state.running && !state.over) {
      acc += dt;
      var guard = 0;
      while (acc >= STEP && guard < 5) {
        Engine.update(engine, STEP);
        processMerges();
        checkGameOver();
        demoTick(STEP / 1000);
        acc -= STEP;
        guard++;
        state.time += STEP / 1000;
        if (state.cooldown > 0) state.cooldown -= STEP / 1000;
      }
      if (guard >= 5) acc = 0;
    }

    // 特效
    var dts = dt / 1000;
    for (var i = state.particles.length - 1; i >= 0; i--) {
      var p = state.particles[i];
      p.x += p.vx * dts * 60;
      p.y += p.vy * dts * 60;
      p.vy += 0.12 * dts * 60;
      p.vx *= 0.985;
      p.life -= p.decay * dts * 60;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (var j = state.popups.length - 1; j >= 0; j--) {
      var q = state.popups[j];
      q.y -= 42 * dts;
      q.life -= 0.9 * dts;
      if (q.life <= 0) state.popups.splice(j, 1);
    }
    if (state.toast) {
      state.toast.t -= dts;
      if (state.toast.t <= 0) state.toast = null;
    }
    state.shake *= 0.9;

    // 分数滚动
    if (state.display !== state.score) {
      var diff = state.score - state.display;
      if (Math.abs(diff) < 1) state.display = state.score;
      else state.display += diff * 0.2;
      scoreEl.textContent = String(Math.round(state.display));
    }

    render();
    requestAnimationFrame(loop);
  }

  /* ---------------- 小尺寸预览 ---------------- */
  var nextCv = el('next');
  function drawNext() {
    var g = nextCv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, 72, 72);
    var idx = state.nextIdx;
    if (idx === null || idx === undefined) return;
    var k = 30 / FRUITS[idx].r;
    g.save();
    g.translate(36, 36);
    g.scale(k, k);
    drawFruitAt(g, 0, 0, idx, 0, 1);
    g.restore();
  }

  var previewCv = el('preview');
  function drawPreview() {
    var g = previewCv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, 176, 176);
    var k = 76 / FRUITS[MAX_IDX].r;
    g.save();
    g.translate(88, 88);
    g.scale(k, k);
    drawFruitAt(g, 0, 0, MAX_IDX, 0, 1);
    g.restore();
  }

  /* ---------------- 自定义西瓜 ---------------- */
  var dz = el('dz'), fileInput = el('fileInput'), dzHint = el('dzHint'), fitSeg = el('fitSeg');

  var hintTimer = null;
  function hint(text) {
    dzHint.textContent = text;
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(function () {
      dzHint.textContent = 'PNG / JPG / WebP，图片只保存在本机浏览器';
    }, 3200);
  }

  function saveCustom() {
    if (!custom.src) { lsDel(LS_CUSTOM); return true; }
    return lsSet(LS_CUSTOM, JSON.stringify({ src: custom.src, mode: custom.mode }));
  }

  function applyCustom(src, mode, persist) {
    if (mode) custom.mode = mode;
    custom.src = src || null;
    if (!src) {
      custom.img = null;
      drawPreview();
      return;
    }
    var img = new Image();
    img.onload = function () {
      custom.img = img;
      drawPreview();
      if (!persist) return;
      var ok = saveCustom();
      hint(ok ? '已应用：游戏里的大西瓜已换成这张图'
              : '已应用（图片较大，未能保存到本机）');
    };
    img.onerror = function () { hint('图片加载失败，换一张试试'); };
    img.src = src;
  }

  function loadFile(file) {
    if (!file || !/^image\//.test(file.type)) { hint('请选择图片文件'); return; }
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      var max = 560;
      var s = Math.min(1, max / Math.max(img.width, img.height));
      var w = Math.max(1, Math.round(img.width * s));
      var h = Math.max(1, Math.round(img.height * s));
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      var cc = c.getContext('2d');
      cc.drawImage(img, 0, 0, w, h);
      var data;
      try {
        data = c.toDataURL('image/png');
        if (data.length > 1300000) data = c.toDataURL('image/jpeg', 0.86);
      } catch (e) {
        hint('这张图片无法处理，换一张试试');
        return;
      }
      applyCustom(data, null, true);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      hint('图片读取失败，换一张试试');
    };
    img.src = url;
  }

  dz.addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function (e) {
    if (e.target.files && e.target.files[0]) loadFile(e.target.files[0]);
    fileInput.value = '';
  });

  ['dragenter', 'dragover'].forEach(function (t) {
    dz.addEventListener(t, function (e) {
      e.preventDefault();
      dz.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach(function (t) {
    dz.addEventListener(t, function (e) {
      e.preventDefault();
      dz.classList.remove('dragover');
    });
  });
  dz.addEventListener('drop', function (e) {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadFile(e.dataTransfer.files[0]);
    }
  });

  window.addEventListener('paste', function (e) {
    var items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf('image') === 0) {
        loadFile(items[i].getAsFile());
        break;
      }
    }
  });

  fitSeg.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('button') : null;
    if (!btn) return;
    var mode = btn.getAttribute('data-mode');
    if (!mode || mode === custom.mode) return;
    custom.mode = mode;
    var bs = fitSeg.querySelectorAll('button');
    for (var i = 0; i < bs.length; i++) {
      bs[i].classList.toggle('on', bs[i].getAttribute('data-mode') === mode);
    }
    drawPreview();
    saveCustom();
  });

  el('resetImg').addEventListener('click', function () {
    custom.img = null;
    custom.src = null;
    custom.mode = 'cover';
    lsDel(LS_CUSTOM);
    var bs = fitSeg.querySelectorAll('button');
    for (var i = 0; i < bs.length; i++) {
      bs[i].classList.toggle('on', bs[i].getAttribute('data-mode') === 'cover');
    }
    drawPreview();
    hint('已恢复默认西瓜');
  });

  /* ---------------- 输入 ---------------- */
  function toLogical(e) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (W / rect.width),
      y: (e.clientY - rect.top) * (H / rect.height)
    };
  }

  var pressing = false;

  canvas.addEventListener('pointerdown', function (e) {
    if (!state.running || state.over || demo.active) return;
    pressing = true;
    state.aimX = toLogical(e).x;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    ensureAudio();
  });

  canvas.addEventListener('pointermove', function (e) {
    if (!state.running || state.over || demo.active) return;
    state.aimX = toLogical(e).x;
  });

  canvas.addEventListener('pointerup', function (e) {
    if (!pressing) return;
    pressing = false;
    state.aimX = toLogical(e).x;
    drop();
  });

  canvas.addEventListener('pointercancel', function () { pressing = false; });

  window.addEventListener('keydown', function (e) {
    if (demo.active && e.key === 'Escape') { stopDemo(); return; }
    if (!state.running || state.over || demo.active) return;
    if (e.key === 'ArrowLeft') { state.aimX = clamp(state.aimX - 16, LEFT, RIGHT); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { state.aimX = clamp(state.aimX + 16, LEFT, RIGHT); e.preventDefault(); }
    else if (e.code === 'Space' || e.key === ' ') { drop(); e.preventDefault(); }
  });

  function bindDemoBtn(id) {
    var b = el(id);
    if (!b) return;
    b.addEventListener('click', function () {
      ensureAudio();
      if (id === 'demoBtn' && demo.active) { stopDemo(); return; }
      startDemo();
    });
  }
  bindDemoBtn('demoBtn');
  bindDemoBtn('demoStartBtn');
  bindDemoBtn('demoOverBtn');

  el('startBtn').addEventListener('click', function () {
    ensureAudio();
    state.best = Number(lsGet(LS_BEST) || 0) || state.best;
    startGame();
  });
  el('againBtn').addEventListener('click', function () {
    overCard.classList.add('hidden');
    startCard.classList.add('hidden');
    startGame();
  });
  el('restartBtn').addEventListener('click', function () {
    if (!state.running && !state.over) return;
    startGame();
  });

  el('soundBtn').addEventListener('click', function () {
    audio.muted = !audio.muted;
    el('soundWave').classList.toggle('hide', audio.muted);
    el('soundMute').classList.toggle('hide', !audio.muted);
    if (!audio.muted) { ensureAudio(); tone(520, 0.1, 'sine', 0.06); }
  });

  /* ---------------- 合成链 ---------------- */
  (function buildChain() {
    var box = el('chain');
    var html = '';
    for (var i = 0; i < FRUITS.length; i++) {
      var cls = 'chip' + (i === MAX_IDX ? ' last' : '');
      html += '<span class="' + cls + '"><i style="background:' + FRUITS[i].base + '"></i>' + FRUITS[i].n + '</span>';
    }
    box.innerHTML = html;
  })();

  /* ---------------- 启动 ---------------- */
  (function init() {
    var b = Number(lsGet(LS_BEST) || 0);
    if (!isNaN(b) && b > 0) { state.best = b; bestEl.textContent = String(b); }

    var raw = lsGet(LS_CUSTOM);
    if (raw) {
      try {
        var o = JSON.parse(raw);
        if (o && o.src) {
          custom.mode = o.mode === 'contain' ? 'contain' : 'cover';
          var bs = fitSeg.querySelectorAll('button');
          for (var i = 0; i < bs.length; i++) {
            bs[i].classList.toggle('on', bs[i].getAttribute('data-mode') === custom.mode);
          }
          applyCustom(o.src, custom.mode);
        }
      } catch (e) {}
    }

    drawPreview();
    syncDemoBtn();
    state.nextIdx = randSpawn();
    drawNext();
    requestAnimationFrame(loop);
  })();
})();
