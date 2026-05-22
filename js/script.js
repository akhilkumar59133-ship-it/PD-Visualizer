
"use strict";

/* =====================================================================
   SINGLE-SESSION ADMIN LOCK
   Strategy: one active token in localStorage.
   - On login  → write { token, ts } to LS_SESSION key.
   - My tab    → stores MY token in a tab-local var (_myToken).
   - Heartbeat → refreshes ts every HEARTBEAT_MS so other tabs know
                 this session is still alive.
   - storage event → fires in all OTHER tabs when LS changes;
                 if MY token no longer matches the stored one, I was
                 kicked — force-logout immediately.
   - SESSION_TIMEOUT_MS → if ts is stale (tab crashed / closed without
                 logout), treat the session as expired.
===================================================================== */
const LS_SESSION       = 'pd_admin_session';
const HEARTBEAT_MS     = 15_000;   // refresh timestamp every 15 s
const SESSION_TIMEOUT  = 60_000;   // session expires after 60 s idle

let _myToken    = null;   // token that belongs to THIS tab
let _heartbeatT = null;   // setInterval handle

/** Generate a random session token */
function mkToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Read raw session object from localStorage */
function readSession() {
  try { return JSON.parse(localStorage.getItem(LS_SESSION)); } catch(e) { return null; }
}

/** Write session object */
function writeSession(token) {
  localStorage.setItem(LS_SESSION, JSON.stringify({ token, ts: Date.now() }));
}

/** Remove session from localStorage */
function clearSession() {
  localStorage.removeItem(LS_SESSION);
}

/** Is there a living session that isn't ours? */
function foreignSessionActive() {
  const s = readSession();
  if (!s) return false;
  if (Date.now() - s.ts > SESSION_TIMEOUT) return false;  // expired/stale
  return s.token !== _myToken;   // someone else
}

/** Start heartbeat — keeps our session alive */
function startHeartbeat() {
  stopHeartbeat();
  _heartbeatT = setInterval(() => {
    if (_myToken) writeSession(_myToken);
  }, HEARTBEAT_MS);
}
function stopHeartbeat() {
  if (_heartbeatT) { clearInterval(_heartbeatT); _heartbeatT = null; }
}

/** Called when another tab's login kicks us out */
function onKickedOut() {
  _myToken = null;
  stopHeartbeat();
  // hide dashboard, show login
  document.getElementById('loginSec').classList.remove('hidden');
  document.getElementById('dashSec').classList.add('hidden');
  document.getElementById('prevSec').classList.add('hidden');
  document.getElementById('uname').value = '';
  document.getElementById('pword').value = '';
  // show "you were kicked" message
  const b = document.getElementById('sessionBlockedBanner');
  const m = document.getElementById('sessionBlockedMsg');
  m.innerHTML = 'Your session was ended because another admin logged in.<br>Only one admin can be active at a time.';
  b.classList.remove('hidden');
  checkSessionUI();
  alert('\u26A0\uFE0F You have been logged out — another admin session started.');
}

/** Listen for localStorage changes in other tabs */
window.addEventListener('storage', (e) => {
  if (e.key !== LS_SESSION) return;
  if (!_myToken) return;          // we're not logged in, nothing to protect
  const s = readSession();
  if (!s || s.token !== _myToken) {
    onKickedOut();
  }
});

/* =====================================================================
   INPUT VALIDATION
===================================================================== */
function showValPopup(fieldLabel, entered, min, max, unit) {
  const unitStr = unit ? ' ' + unit : '';
  document.getElementById('valMsg').innerHTML =
    '<strong>' + fieldLabel + '</strong> must be between ' +
    '<strong>' + min + unitStr + '</strong> and <strong>' + max + unitStr + '</strong>.<br>' +
    'You entered: <strong style="color:#d62020;">' + entered + unitStr + '</strong>';
  document.getElementById('valOverlay').style.display = 'flex';
}

function closeValPopup(e) {
  if (e && e.target !== document.getElementById('valOverlay')) return;
  document.getElementById('valOverlay').style.display = 'none';
}

function validateField(el, min, max, label, unit) {
  const val = parseFloat(el.value);
  if (isNaN(val) || val < min || val > max) {
    el.classList.add('input-error');
    showValPopup(label, isNaN(val) ? el.value : val, min, max, unit);
    return false;
  }
  el.classList.remove('input-error');
  return true;
}

function validateAllFields() {
  const checks = [
    { id: 'aGap',      min: 0, max: 20,  label: 'Gap Distance', unit: 'mm'  },
    { id: 'aPressure', min: 0, max: 10,  label: 'Pressure',     unit: 'MPa' },
    { id: 'aEr',       min: 0, max: 50,  label: 'εr',           unit: ''    },
    { id: 'aVrms',     min: 0, max: 20,  label: 'Vrms',         unit: 'kV'  }
  ];
  for (const c of checks) {
    const el = document.getElementById(c.id);
    if (!validateField(el, c.min, c.max, c.label, c.unit)) {
      el.focus();
      return false;
    }
  }
  return true;
}

/* =====================================================================
   DATA
===================================================================== */
const DOC = {
  AIR_0091: {
    Copper:        { er:28.11, Ca:5.3124e-12, Cb:1.885e-11, Cc:1.25e-11,  Vrms:2.217, PDIV_kV:2.259, Qavg:13.46, Qpk:576.1, Ncyc:20, computed:false },
    Aluminium:     { er:7.9,   Ca:5.3124e-12, Cb:1.885e-11, Cc:3.514e-14, Vrms:3.375, PDIV_kV:3.63,  Qavg:10.27, Qpk:388.4, Ncyc:15, computed:false },
    Polypropylene: { er:2.2,   Ca:7.708e-10,  Cb:1.112e-10, Cc:2.44e-11,  Vrms:1.776, PDIV_kV:2.134, Qavg:13.80, Qpk:444.0, Ncyc:20, computed:true  },
    Teflon:        { er:2.1,   Ca:7.708e-10,  Cb:1.112e-10, Cc:2.335e-11, Vrms:1.813, PDIV_kV:2.182, Qavg:13.30, Qpk:419.5, Ncyc:20, computed:true  }
  },
  AIR_01: {
    Copper:        { er:28.11, Ca:5.3124e-12, Cb:1.885e-11, Cc:1.25e-11,  Vrms:2.486, PDIV_kV:2.737, Qavg:13.57, Qpk:511.5, Ncyc:20, computed:false },
    Aluminium:     { er:7.9,   Ca:5.3124e-12, Cb:1.885e-11, Cc:3.514e-14, Vrms:2.955, PDIV_kV:3.2,   Qavg:13.68, Qpk:458.1, Ncyc:16, computed:false },
    Polypropylene: { er:2.2,   Ca:7.708e-10,  Cb:1.112e-10, Cc:2.44e-11,  Vrms:4.534, PDIV_kV:4.875, Qavg:2.17,  Qpk:76.8,  Ncyc:9,  computed:true  },
    Teflon:        { er:2.1,   Ca:7.708e-10,  Cb:1.112e-10, Cc:2.335e-11, Vrms:4.636, PDIV_kV:4.985, Qavg:2.05,  Qpk:72.6,  Ncyc:9,  computed:true  }
  },
  CO2SF6_01: {
    Copper:        { er:28.11, Ca:5.3124e-12, Cb:1.885e-11, Cc:1.25e-11,  Vrms:2.546, PDIV_kV:2.81,  Qavg:30.88, Qpk:413.3, Ncyc:18, computed:false },
    Aluminium:     { er:7.9,   Ca:5.3124e-12, Cb:1.885e-11, Cc:3.514e-14, Vrms:6.064, PDIV_kV:6.335, Qavg:20.52, Qpk:245.0, Ncyc:10, computed:false },
    Polypropylene: { er:2.2,   Ca:7.708e-10,  Cb:1.112e-10, Cc:2.44e-11,  Vrms:8.975, PDIV_kV:9.651, Qavg:9.48,  Qpk:119.7, Ncyc:4,  computed:true  },
    Teflon:        { er:2.1,   Ca:7.708e-10,  Cb:1.112e-10, Cc:2.335e-11, Vrms:9.179, PDIV_kV:9.870, Qavg:8.96,  Qpk:113.0, Ncyc:4,  computed:true  }
  },
  N2SF6_01: {
    Copper:        { er:28.11, Ca:5.20e-12,   Cb:1.897e-11, Cc:1.25e-11,  Vrms:2.116, PDIV_kV:2.610, Qavg:15.07, Qpk:383.7, Ncyc:18, computed:false },
    Aluminium:     { er:7.9,   Ca:5.324e-12,  Cb:1.897e-11, Cc:3.514e-14, Vrms:2.532, PDIV_kV:2.613, Qavg:15.07, Qpk:460.6, Ncyc:16, computed:false },
    Polypropylene: { er:2.2,   Ca:7.71e-10,   Cb:1.112e-11, Cc:2.44e-11,  Vrms:3.702, PDIV_kV:3.981, Qavg:0.68,  Qpk:18.9,  Ncyc:9,  computed:true  },
    Teflon:        { er:2.1,   Ca:7.71e-10,   Cb:1.112e-11, Cc:2.335e-11, Vrms:3.786, PDIV_kV:4.071, Qavg:0.66,  Qpk:18.3,  Ncyc:9,  computed:true  }
  },
  HFC_N2: {
    Copper:        { er:28.11, Ca:5.3124e-12, Cb:1.885e-11, Cc:1.25e-11,  Vrms:2.680, PDIV_kV:2.950, Qavg:28.10, Qpk:390.5, Ncyc:17, computed:true  },
    Aluminium:     { er:7.9,   Ca:5.3124e-12, Cb:1.885e-11, Cc:3.514e-14, Vrms:5.820, PDIV_kV:6.120, Qavg:18.90, Qpk:232.0, Ncyc:10, computed:true  },
    Polypropylene: { er:2.2,   Ca:7.708e-10,  Cb:1.112e-10, Cc:2.44e-11,  Vrms:9.210, PDIV_kV:9.900, Qavg:8.80,  Qpk:115.0, Ncyc:4,  computed:true  },
    Teflon:        { er:2.1,   Ca:7.708e-10,  Cb:1.112e-10, Cc:2.335e-11, Vrms:9.420, PDIV_kV:10.12, Qavg:8.30,  Qpk:108.5, Ncyc:4,  computed:true  }
  }
};

const GAS_LBL = {
  CO2SF6_01:'CO\u2082:SF\u2086 ',
  N2SF6_01: 'N\u2082:SF\u2086',
  AIR_0091: 'Air ',
  AIR_01:   'Air',
  HFC_N2:   'HFC-227ea:N\u2082'
};

const SPIKES_COPPER=[
  [0.0005,-1.12],[0.0010,-1.71],[0.0013,-1.08],[0.0017,-0.76],[0.0021,-0.85],[0.0025,-1.54],[0.0029,+2.24],[0.0032,+0.88],
  [0.0036,-0.86],[0.0043,-0.94],[0.0048,+0.97],[0.0049,-2.52],[0.0055,-0.86],[0.0059,-1.75],[0.0066,+0.88],[0.0069,+0.91],
  [0.0076,-1.32],[0.0079,+0.94],[0.0080,-2.73],[0.0082,+1.18],[0.0083,-1.11],[0.0084,+3.26],[0.0088,+1.32],[0.0094,-0.86],
  [0.0100,-1.38],[0.0106,+1.09],[0.0110,+0.94],[0.0114,-1.62],[0.0118,-1.71],[0.0122,-0.91],[0.0126,-1.17],[0.0128,+1.03],
  [0.0129,-1.92],[0.0135,+1.21],[0.0140,+0.91],[0.0141,-0.86],[0.0147,-0.86],[0.0153,+1.06],[0.0157,+1.75],[0.0158,-6.27],
  [0.0159,+2.06],[0.0161,+1.12],[0.0165,+0.85],[0.0171,+1.00],[0.0174,-0.95],[0.0178,+1.19],[0.0182,-1.38],[0.0186,+0.82],
  [0.0186,-1.92],[0.0188,-1.29],[0.0190,+0.88],[0.0191,-1.47],[0.0195,-1.80],[0.0200,+2.87],[0.0204,-0.79],[0.0209,+1.04],
  [0.0214,+0.97],[0.0220,-0.78],[0.0223,+1.09],[0.0226,+1.03],[0.0230,+0.84],[0.0233,+0.84],[0.0238,-1.20],[0.0239,+4.50],
  [0.0240,-1.17],[0.0242,+0.82],[0.0244,+0.82],[0.0245,-2.04],[0.0250,+0.78],[0.0254,-0.84],[0.0258,+0.99],[0.0264,+0.85],
  [0.0267,-1.05],[0.0271,+1.00],[0.0277,-1.01],[0.0280,+0.85],[0.0282,+2.27],[0.0285,-1.14],[0.0289,-1.15],[0.0292,+2.09],
  [0.0299,+0.88],[0.0299,-0.80],[0.0300,+0.85],[0.0301,-2.10],[0.0306,+1.05],[0.0310,+2.24],[0.0315,+2.21],[0.0321,-1.74],
  [0.0324,-1.95],[0.0327,-1.78],[0.0330,+1.18],[0.0335,-1.17],[0.0339,+0.75],[0.0342,-0.80],[0.0347,+3.14],[0.0351,+0.82],
  [0.0351,-2.01],[0.0353,-1.44],[0.0356,-1.50],[0.0359,+0.82],[0.0362,-0.85],[0.0366,+0.94],[0.0369,+1.57],[0.0372,-0.95],
  [0.0372,+2.33],[0.0375,-0.81],[0.0378,-0.79],[0.0381,+1.21],[0.0382,-5.44],[0.0382,+1.18],[0.0386,+2.02],[0.0390,-0.86],
  [0.0390,+1.00],[0.0393,-1.02]
];
const SPIKES_ALUMINIUM=[
  [0.0006,+3.32],[0.0009,-4.20],[0.0013,-0.90],[0.0017,+1.48],[0.0020,-1.44],[0.0025,+0.81],[0.0031,+2.98],[0.0036,+1.50],
  [0.0040,-1.18],[0.0047,-1.40],[0.0051,+0.87],[0.0055,-0.99],[0.0059,-1.71],[0.0064,-2.00],[0.0068,+1.22],[0.0071,-4.10],
  [0.0075,+3.32],[0.0081,-1.42],[0.0088,-1.24],[0.0092,-2.37],[0.0096,-1.83],[0.0099,-0.88],[0.0104,-1.98],[0.0110,-1.01],
  [0.0114,+1.03],[0.0120,-1.88],[0.0124,+0.84],[0.0128,-1.75],[0.0132,+1.17],[0.0136,-1.64],[0.0140,+1.31],[0.0146,+1.04],
  [0.0151,-1.04],[0.0155,+3.60],[0.0158,+2.48],[0.0164,+1.78],[0.0168,+0.97],[0.0171,-1.10],[0.0176,-0.87],[0.0180,-0.76],
  [0.0186,-1.08],[0.0189,+4.09],[0.0193,-1.08],[0.0199,-1.11],[0.0205,+2.67],[0.0210,+0.95],[0.0214,+1.13],[0.0218,-3.28],
  [0.0222,-0.84],[0.0226,+1.49],[0.0230,-0.77],[0.0233,+1.24],[0.0237,+2.83],[0.0240,+1.44],[0.0245,-1.43],[0.0249,+2.57],
  [0.0253,-0.94],[0.0256,-0.91],[0.0260,-2.18],[0.0266,-1.07],[0.0269,-1.56],[0.0273,+1.71],[0.0277,+1.31],[0.0280,-0.75],
  [0.0286,-1.25],[0.0291,-1.17],[0.0297,-4.53],[0.0302,+2.08],[0.0306,+1.34],[0.0312,+1.25],[0.0315,+1.94],[0.0318,-1.47],
  [0.0322,-1.64],[0.0325,+1.21],[0.0328,-1.77],[0.0332,-1.30],[0.0336,+1.08],[0.0341,+3.53],[0.0344,-1.87],[0.0347,-1.08],
  [0.0352,-0.80],[0.0358,+1.46],[0.0361,-1.19],[0.0364,+0.94],[0.0367,-1.08],[0.0373,+1.45],[0.0377,+1.45],[0.0382,+0.95],
  [0.0386,-1.16],[0.0390,-0.76],[0.0393,-1.57]
];
const SPIKES_POLYPROPYLENE=[
  [0.0006,+3.10],[0.0010,-1.29],[0.0017,-1.96],[0.0020,+1.55],[0.0026,-1.27],[0.0030,-0.84],[0.0034,-2.27],[0.0038,-4.31],
  [0.0042,+1.80],[0.0046,-1.04],[0.0052,+1.32],[0.0058,-1.49],[0.0062,+0.95],[0.0068,-1.14],[0.0072,+1.45],[0.0076,+0.81],
  [0.0079,-5.30],[0.0086,-0.84],[0.0092,+1.25],[0.0098,+1.88],[0.0103,-1.08],[0.0109,-4.18],[0.0113,+1.17],[0.0118,+1.22],
  [0.0124,+2.30],[0.0128,-0.90],[0.0133,-0.98],[0.0137,-1.28],[0.0141,-2.20],[0.0145,-1.99],[0.0150,-0.96],[0.0155,-2.29],
  [0.0159,+3.25],[0.0164,-2.76],[0.0168,+1.33],[0.0171,-1.95],[0.0175,-1.48],[0.0181,+1.32],[0.0186,+1.42],[0.0191,+1.37],
  [0.0197,-1.00],[0.0202,+0.85],[0.0205,-0.79],[0.0209,+0.89],[0.0212,+0.95],[0.0217,-1.06],[0.0222,-3.31],[0.0226,+2.29],
  [0.0229,-1.51],[0.0234,-2.66],[0.0238,-2.58],[0.0243,-1.54],[0.0247,-2.06],[0.0250,-1.35],[0.0255,-0.88],[0.0258,-0.77],
  [0.0261,+1.55],[0.0265,+0.77],[0.0271,-0.87],[0.0275,+0.99],[0.0279,-1.32],[0.0283,-3.06],[0.0288,-1.66],[0.0292,+1.69],
  [0.0297,-1.73],[0.0301,-1.52],[0.0304,-1.00],[0.0308,+0.78],[0.0313,+1.74],[0.0319,+1.00],[0.0324,-1.18],[0.0329,-3.35],
  [0.0332,+0.98],[0.0335,+2.94],[0.0339,+1.18],[0.0342,+4.05],[0.0345,-3.18],[0.0351,+1.95],[0.0355,+1.34],[0.0358,-3.18],
  [0.0361,-5.47],[0.0364,-0.84],[0.0370,+2.47],[0.0373,-1.93],[0.0378,+1.81],[0.0383,-2.19],[0.0386,+1.22],[0.0392,-1.80],
  [0.0395,-1.27]
];
const SPIKES_TEFLON=[
  [0.0007,-1.11],[0.0012,-0.81],[0.0015,-0.97],[0.0020,-1.48],[0.0026,+1.38],[0.0030,-2.13],[0.0034,+1.49],[0.0039,-3.38],
  [0.0043,-2.98],[0.0048,+1.18],[0.0052,+0.89],[0.0057,+4.67],[0.0063,+3.63],[0.0070,-3.10],[0.0075,+1.12],[0.0080,-0.82],
  [0.0084,-0.89],[0.0088,-1.48],[0.0092,-1.04],[0.0096,+1.61],[0.0102,+1.45],[0.0107,-2.39],[0.0112,+0.96],[0.0116,+1.47],
  [0.0120,-2.32],[0.0125,+2.40],[0.0130,+1.45],[0.0136,+1.56],[0.0140,-1.20],[0.0144,+2.03],[0.0149,-1.00],[0.0154,+1.03],
  [0.0159,-1.38],[0.0165,+1.34],[0.0169,+2.21],[0.0174,+2.92],[0.0178,-1.91],[0.0184,-1.79],[0.0188,+1.31],[0.0194,-0.84],
  [0.0198,-1.39],[0.0203,+1.46],[0.0206,+1.37],[0.0213,+1.43],[0.0218,+0.85],[0.0221,+1.05],[0.0225,-2.72],[0.0230,-1.23],
  [0.0236,-1.45],[0.0242,-1.23],[0.0248,+2.79],[0.0251,+3.43],[0.0255,-3.07],[0.0260,+0.93],[0.0263,+1.76],[0.0270,-0.90],
  [0.0274,-1.49],[0.0280,-1.87],[0.0285,+3.24],[0.0289,+1.97],[0.0294,-1.10],[0.0299,+1.35],[0.0303,-0.81],[0.0310,-1.46],
  [0.0315,+2.80],[0.0319,-1.59],[0.0324,-2.08],[0.0329,+3.40],[0.0332,-2.33],[0.0338,+0.90],[0.0342,-1.28],[0.0347,-1.40],
  [0.0350,-0.82],[0.0354,+5.32],[0.0357,+5.42],[0.0361,-1.75],[0.0364,-5.47],[0.0367,-1.00],[0.0373,-3.40],[0.0376,-2.88],
  [0.0379,-1.34],[0.0384,-1.19],[0.0387,-2.86],[0.0390,+0.86],[0.0393,+0.86]
];

const SPIKE_PROFILES={Copper:SPIKES_COPPER,Aluminium:SPIKES_ALUMINIUM,Polypropylene:SPIKES_POLYPROPYLENE,Teflon:SPIKES_TEFLON};

let _s=0;
function sr(v){_s=(v>>>0);}
function rr(){_s=(_s*1664525+1013904223)>>>0;return _s/0x100000000;}
function rn(){let u=1-rr(),v=rr();return Math.sqrt(-2*Math.log(u))*Math.cos(6.28318*v);}

const CU_REF=413.3;

function drawGraph(canvasId,boxId,Qpk,material){
  const canvas=document.getElementById(canvasId);
  const box=document.getElementById(boxId);
  if(!canvas||!box)return;
  const W=box.clientWidth||800,H=box.clientHeight||440;
  canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#07091a';ctx.fillRect(0,0,W,H);
  const ml=62,mr=16,mt=24,mb=44,pw=W-ml-mr,ph=H-mt-mb;
  const T=0.04,AB=-8,AT=6;
  const cX=t=>ml+(t/T)*pw;
  const cY=u=>{const c=Math.max(AB-0.05,Math.min(AT+0.05,u));return mt+ph*(1-(c-AB)/(AT-AB));};
  ctx.setLineDash([3,5]);ctx.strokeStyle='rgba(80,140,255,0.18)';ctx.lineWidth=0.6;
  for(let v=AB;v<=AT;v+=2){ctx.beginPath();ctx.moveTo(ml,cY(v));ctx.lineTo(ml+pw,cY(v));ctx.stroke();}
  for(let t=0;t<=T+1e-9;t+=0.005){ctx.beginPath();ctx.moveTo(cX(t),mt);ctx.lineTo(cX(t),mt+ph);ctx.stroke();}
  ctx.setLineDash([]);
  ctx.fillStyle='#7aaaf8';ctx.font='11px "Courier New",monospace';ctx.textAlign='left';
  ctx.fillText('\u00d710',2,mt+14);ctx.font='8px "Courier New",monospace';ctx.fillText('-10',24,mt+8);
  ctx.font='11px "Courier New",monospace';ctx.textAlign='right';
  for(let v=AB;v<=AT;v+=2){ctx.fillStyle='#7aaaf8';ctx.fillText(String(v),ml-6,cY(v)+4);}
  ctx.textAlign='center';
  for(let t=0;t<=T+1e-9;t+=0.005){
    ctx.fillStyle='#7aaaf8';ctx.font='10px "Courier New",monospace';
    ctx.fillText(t===0?'0':t.toFixed(3),cX(t),mt+ph+15);
  }
  const scale=Qpk/CU_REF;
  const spikes=SPIKE_PROFILES[material]||SPIKES_COPPER;
  const nS=pw*4,dtS=T/(nS-1);
  const sig=new Float64Array(nS);
  const na=(material==='Copper'||material==='Aluminium')?0.13:0.06;
  sr(0xFEDCBA98);
  let n1=0,n2=0,n3=0;
  for(let i=0;i<nS;i++){n1=0.90*n1+0.10*rn()*na;n2=0.82*n2+0.18*n1;n3=0.74*n3+0.26*n2;sig[i]=n3;}
  const sw=2.5,hw=Math.ceil(4*sw);
  spikes.forEach(([ts,val])=>{
    const ht=val*scale,iC=Math.round(ts/dtS);
    for(let i=Math.max(0,iC-hw);i<=Math.min(nS-1,iC+hw);i++){const d=i-iC;sig[i]+=ht*Math.exp(-(d*d)/(2*sw*sw));}
  });
  ctx.beginPath();ctx.strokeStyle='#4a8fff';ctx.lineWidth=1.1;
  for(let i=0;i<nS;i++){const x=ml+(i/(nS-1))*pw,y=cY(sig[i]);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}
  ctx.stroke();
  ctx.strokeStyle='rgba(100,160,255,0.25)';ctx.lineWidth=0.7;
  ctx.beginPath();ctx.moveTo(ml,cY(0));ctx.lineTo(ml+pw,cY(0));ctx.stroke();
  ctx.strokeStyle='#0f1a3a';ctx.lineWidth=1;ctx.strokeRect(ml,mt,pw,ph);
}

/* =====================================================================
   STATE & STORAGE
===================================================================== */
let graphs=[],pendingId=null,liveData=null;
const LS_KEY='pd_live_graph';
function saveLive(d){try{localStorage.setItem(LS_KEY,JSON.stringify(d));}catch(e){}}
function loadLive(){try{const r=localStorage.getItem(LS_KEY);return r?JSON.parse(r):null;}catch(e){return null;}}

function readNum(id,fallback){
  const el=document.getElementById(id);
  if(!el)return fallback;
  const v=parseFloat(el.value);
  return isNaN(v)?fallback:v;
}

function getEntry(){
  return DOC[document.getElementById('aGas').value]?.[document.getElementById('aMat').value]||null;
}

/* =====================================================================
   SESSION UI HELPER — updates login panel based on foreign session
===================================================================== */
function checkSessionUI() {
  const banner = document.getElementById('sessionBlockedBanner');
  const form   = document.getElementById('loginForm');
  if (foreignSessionActive()) {
    const s = readSession();
    document.getElementById('sessionBlockedMsg').innerHTML =
      'Another admin session is currently active.<br>' +
      'Session ID: <strong>' + s.token.slice(-8) + '</strong><br>' +
      'Only one admin can be logged in at a time.';
    banner.classList.remove('hidden');
    form.classList.add('hidden');
  } else {
    banner.classList.add('hidden');
    form.classList.remove('hidden');
  }
}

/* =====================================================================
   LOGIN / LOGOUT
===================================================================== */

/**
 * @param {boolean} force  — if true, overwrite any existing session
 */
function doLogin(force) {
  if (!force && foreignSessionActive()) {
    checkSessionUI();
    return;
  }
  if (document.getElementById('uname').value === 'admin' &&
      document.getElementById('pword').value === 'admin123') {
    // Create and register this tab's token
    _myToken = mkToken();
    writeSession(_myToken);
    startHeartbeat();
    // Update badge
    document.getElementById('sessionId').textContent = _myToken.slice(-8);
    document.getElementById('loginSec').classList.add('hidden');
    document.getElementById('dashSec').classList.remove('hidden');
    document.getElementById('sessionBlockedBanner').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
  } else {
    alert('\u274c Wrong credentials!');
  }
}

function forceLogin() {
  // Force-login: clear credentials check and attempt with force=true after re-validating password
  if (document.getElementById('uname').value === 'admin' &&
      document.getElementById('pword').value === 'admin123') {
    doLogin(true);
  } else {
    // Show the login form so they can enter credentials
    document.getElementById('sessionBlockedBanner').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
    alert('\u26A0\uFE0F Enter your credentials and click LOGIN to force-take the session.');
    // Patch the LOGIN button to force mode temporarily
    const btn = document.querySelector('.btn-login');
    btn.textContent = 'FORCE LOGIN & KICK OTHER SESSION';
    btn.style.background = 'linear-gradient(45deg,#c04010,#e06030)';
    btn.onclick = () => doLogin(true);
  }
}

function doLogout() {
  if (_myToken) {
    // Only clear session if it's still ours
    const s = readSession();
    if (s && s.token === _myToken) clearSession();
  }
  _myToken = null;
  stopHeartbeat();
  document.getElementById('loginSec').classList.remove('hidden');
  document.getElementById('dashSec').classList.add('hidden');
  document.getElementById('prevSec').classList.add('hidden');
  document.getElementById('uname').value = '';
  document.getElementById('pword').value = '';
  // Reset force-login button if it was changed
  const btn = document.querySelector('.btn-login');
  btn.textContent = 'LOGIN';
  btn.style.background = '';
  btn.onclick = () => doLogin(false);
  checkSessionUI();
}

/* =====================================================================
   GENERATE
===================================================================== */
function doGenerate(){
  if (!validateAllFields()) return;

  const mat      = document.getElementById('aMat').value;
  const gas      = document.getElementById('aGas').value;
  const gap      = readNum('aGap',      10);
  const pressure = readNum('aPressure', 0.1);
  const er       = readNum('aEr',       28.11);
  const vrms     = readNum('aVrms',     2.546);
  const d        = getEntry();
  const rb       = document.getElementById('resultBox');
  rb.classList.remove('hidden');

  if(!d){
    rb.innerHTML='<span style="color:#c00020;">No data available for '+mat+' @ '+GAS_LBL[gas]+'.</span>';
    document.getElementById('prevSec').classList.add('hidden');
    return;
  }

  const srcLabel = d.computed ? '\u2705 Computed via PD abc-circuit model:' : '\u2705 Values from MATLAB:';
  rb.innerHTML=
    '<strong style="color:#1a4fd6;">'+srcLabel+'</strong><br>'+
    'Media: <strong>'+GAS_LBL[gas]+'</strong> &nbsp;|&nbsp; Particle: <strong>'+mat+'</strong><br>'+
    'Gap: <strong>'+gap+' mm</strong> &nbsp;|&nbsp; Pressure: <strong>'+pressure+' MPa</strong>'+
    ' &nbsp;|&nbsp; \u03b5r: <strong>'+er+'</strong> &nbsp;|&nbsp; Vrms: <strong>'+vrms+' kV</strong><br>'+
    '<strong>PDIV = '+d.PDIV_kV+' kV</strong><br>'+
    '<strong>Q_peak = '+d.Qpk+' pC</strong><br>'+
    '<strong>Q_avg = '+d.Qavg+' pC</strong><br>'+
    'N_PD/cycle \u2248 '+d.Ncyc;

  const s=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  s('p_Pdiv',  d.PDIV_kV+' kV');
  s('p_Qpeak', d.Qpk+' pC');
  s('p_Qavg',  d.Qavg+' pC');
  s('p_Npd',   d.Ncyc);

  const pt=document.getElementById('prevTitle');
  if(pt) pt.textContent=mat+' | '+GAS_LBL[gas]+' | Gap='+gap+'mm | P='+pressure+'MPa'+(d.computed?' [Computed]':'');
  document.getElementById('prevSec').classList.remove('hidden');
  drawGraph('matCanvasP','matBoxP',d.Qpk,mat);

  const gid=Date.now().toString();
  graphs.unshift({id:gid,mat,gas,gap,thick:gap,pressure,er,vrms,d,approved:false});
  pendingId=gid;
  renderPending();
}

function setViewerLabels(mat,gas,d,gap,thick){
  const s=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  s('c_Pdiv',  d.PDIV_kV+' kV');
  s('c_Qpeak', d.Qpk+' pC');
  s('c_Qavg',  d.Qavg+' pC');
  s('c_Npd',   d.Ncyc);
  s('c_Mat',   mat+(d.computed?' *':''));
  s('c_Gas',   GAS_LBL[gas]);
  s('c_Gap',   (gap||10)+' mm');
  s('c_Thick', (thick||10)+' mm');
  s('cap_mat', mat);
  s('cap_gas', GAS_LBL[gas]);
  s('paramsLabel',
    mat+(d.computed?' [computed]':'')+' | '+GAS_LBL[gas]+
    ' | Gap='+(gap||10)+'mm | Thick='+(thick||10)+'mm'+
    ' | PDIV='+d.PDIV_kV+' kV | Q_peak='+d.Qpk+' pC | Q_avg='+d.Qavg+' pC | N/cycle='+d.Ncyc);
  const t=document.getElementById('graphTitle');
  if(t) t.innerHTML='Simulated Results of Q<sub>peak</sub> &middot; MATLAB Simulink &middot; '+GAS_LBL[gas]+' &middot; '+mat;
}

function showViewer(mat,gas,d,gap,thick){
  document.getElementById('statusBox').classList.add('hidden');
  document.getElementById('graphInfo').classList.remove('hidden');
  document.getElementById('viewerGraph').classList.remove('hidden');
  setViewerLabels(mat,gas,d,gap,thick);
  drawGraph('matCanvasV','matBoxV',d.Qpk,mat);
}

function doApprovePreview(){if(pendingId)doApprove(pendingId);}

function doApprove(id){
  const g=graphs.find(x=>x.id===id);if(!g)return;
  graphs.forEach(x=>x.approved=false);g.approved=true;
  document.getElementById('prevSec').classList.add('hidden');
  liveData={mat:g.mat,gas:g.gas,gap:g.gap,thick:g.thick,d:g.d};
  saveLive(liveData);
  showViewer(g.mat,g.gas,g.d,g.gap,g.thick);
  renderPending();
}

function renderPending(){
  const pend=graphs.filter(g=>!g.approved);
  const el=document.getElementById('pendList');
  if(!pend.length){el.innerHTML='<div style="padding:12px;color:#5a7aaa;text-align:center;">No pending graphs</div>';return;}
  el.innerHTML='<div class="pend-grid">'+pend.map(g=>
    '<div class="pend-card">'+
    '<div style="font-size:10px;color:#8aaad0;margin-bottom:3px;">ID \u2026'+g.id.slice(-6)+'</div>'+
    '<div class="pcard-tag">'+g.mat+(g.d.computed?' [C]':'')+' | '+GAS_LBL[g.gas]+'</div>'+
    '<div style="font-size:11px;color:#2a3a6a;margin:5px 0;line-height:1.7;">PDIV='+g.d.PDIV_kV+' kV<br>Q_peak='+g.d.Qpk+' pC | Q_avg='+g.d.Qavg+' pC | N/cyc='+g.d.Ncyc+'</div>'+
    '<button class="btn btn-approve" onclick="doApprove(\''+g.id+'\')">\u2705 APPROVE</button>'+
    '</div>').join('')+'</div>';
}

function toggleAdmin(){
  const p=document.getElementById('adminPanel');
  const open=p.classList.contains('open');
  document.body.style.overflow=open?'':'hidden';
  p.classList.toggle('open');
  if(!open && !_myToken) checkSessionUI();
}

let _rt;
window.addEventListener('resize',()=>{
  clearTimeout(_rt);
  _rt=setTimeout(()=>{if(liveData)showViewer(liveData.mat,liveData.gas,liveData.d,liveData.gap,liveData.thick);},180);
});

/* Clear session cleanly when tab/browser is closed */
window.addEventListener('beforeunload', () => {
  if (_myToken) {
    const s = readSession();
    if (s && s.token === _myToken) clearSession();
  }
});

(function restoreOnLoad(){
  const saved=loadLive();
  if(saved){
    const d=DOC[saved.gas]?.[saved.mat];
    if(d){
      liveData={mat:saved.mat,gas:saved.gas,gap:saved.gap||10,thick:saved.thick||10,d};
      showViewer(liveData.mat,liveData.gas,liveData.d,liveData.gap,liveData.thick);
    }
  }
})();
