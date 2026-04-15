
import { useState, useEffect, useRef } from "react";
import { auth, db, secondaryAuth } from './firebase.js'
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, onAuthStateChanged, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { collection, addDoc, onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDoc, query, orderBy } from 'firebase/firestore'

const INITIAL_INITIATIVES = [
  {
    id: 1, name: "Precificação Inteligente com IA",
    owner: "Rafael Ceschim", team: "Pricing & Costs",
    phase: "Piloto", ragStatus: "verde",
    roiEstimate: "R$ 3,2M/ano", progress: 68,
    risks: ["Integração SAP pendente aprovação TI"],
    blockers: [],
    description: "Calculadora de preços com regras tributárias automatizadas (ICMS, PIS/COFINS, IPI, ZFM) para MAO, IOS e CWB.",
    startDate: "2024-09-01", targetDate: "2025-06-30",
    lastUpdate: new Date(Date.now() - 3 * 86400000).toISOString(),
    checkIns: [{ date: "2025-03-20", note: "PPB rules funcionando nas 3 plantas", ragStatus: "verde", progress: 68 }]
  },
  {
    id: 2, name: "PriceRadar – Inteligência Competitiva",
    owner: "Rafael Ceschim", team: "Pricing & Costs",
    phase: "Escala", ragStatus: "verde",
    roiEstimate: "R$ 1,8M/ano", progress: 85,
    risks: ["Custo API crescente com volume"],
    blockers: [],
    description: "Monitoramento de preços de concorrentes com análise por IA e histórico de benchmarks. Deploy em produção no Vercel.",
    startDate: "2024-08-01", targetDate: "2025-04-30",
    lastUpdate: new Date(Date.now() - 1 * 86400000).toISOString(),
    checkIns: [{ date: "2025-03-25", note: "Deploy produção concluído. 47 análises geradas.", ragStatus: "verde", progress: 85 }]
  },
  {
    id: 3, name: "SAP Natural Language Interface",
    owner: "Rafael Ceschim", team: "TI / Custos",
    phase: "PoC", ragStatus: "amarelo",
    roiEstimate: "R$ 800K/ano", progress: 35,
    risks: ["Aprovação TI pendente", "Acesso OData SAP em análise"],
    blockers: ["API keys TI ainda não liberadas"],
    description: "Interface conversacional em português para consultas SAP via OData/RFC. Conceito 'Google para SAP'.",
    startDate: "2025-01-15", targetDate: "2025-08-31",
    lastUpdate: new Date(Date.now() - 12 * 86400000).toISOString(),
    checkIns: [{ date: "2025-03-15", note: "Protótipo browser-only pronto. TI analisando acesso.", ragStatus: "amarelo", progress: 35 }]
  },
  {
    id: 4, name: "Automação de Relatórios Fiscais",
    owner: "Ana Paula Dias", team: "Fiscal",
    phase: "Ideação", ragStatus: "amarelo",
    roiEstimate: "R$ 500K/ano", progress: 10,
    risks: ["Sem responsável técnico", "Escopo não validado"],
    blockers: ["Definição de escopo pendente"],
    description: "Geração automática de relatórios SPED e ECF com validação via IA para redução de retrabalho.",
    startDate: "2025-02-01", targetDate: "2025-12-31",
    lastUpdate: new Date(Date.now() - 21 * 86400000).toISOString(),
    checkIns: []
  },
  {
    id: 5, name: "Detecção de Anomalias em Custos",
    owner: "Carlos Mendes", team: "Controladoria",
    phase: "PoC", ragStatus: "vermelho",
    roiEstimate: "R$ 1,2M/ano", progress: 20,
    risks: ["Falta de dados históricos limpos", "Data scientist não alocado"],
    blockers: ["Projeto parado há 3 semanas"],
    description: "Modelo ML para identificar desvios em custos de produção antes do fechamento mensal.",
    startDate: "2024-11-01", targetDate: "2025-07-31",
    lastUpdate: new Date(Date.now() - 22 * 86400000).toISOString(),
    checkIns: [{ date: "2025-03-05", note: "Sem progresso. Aguardando alocação de recurso.", ragStatus: "vermelho", progress: 20 }]
  }
];

const PHASES = ["Ideação", "PoC", "Piloto", "Escala"];
const RAG = { verde: "#3CDBC0", amarelo: "#F5A623", vermelho: "#E05252" };
const RAG_LABEL = { verde: "No Prazo", amarelo: "Atenção", vermelho: "Em Risco" };
const PHASE_C = { "Ideação": "#A7A8AA", "PoC": "#3CDBC0", "Piloto": "#F5A623", "Escala": "#22d3a0" };

// Auth helpers
const ADMIN = { email: "rceschim@positivo.com.br", name: "Rafael Ceschim", role: "admin" };

function daysSince(iso) { return Math.floor((Date.now() - new Date(iso)) / 86400000); }
function stale(i) { const d = daysSince(i.lastUpdate); return d > 14 ? "s" : d > 7 ? "a" : "f"; }

const ACTION_LABEL = { create: "Criou", edit: "Editou", delete: "Excluiu", "check-in": "Fez check-in em" };
const ACTION_CLS = { create: "al-create", edit: "al-edit", delete: "al-del", "check-in": "al-ci" };
const ROLE_LABEL = { admin: "Admin", gestor: "Gestor", viewer: "Visualizador" };
const ROLE_CLS = { admin: "rb-admin", gestor: "rb-gestor", viewer: "rb-viewer" };

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --blk:#2C2A29;--gd:#53565A;--gm:#777A7D;--gl:#A7A8AA;
  --cy:#3CDBC0;--cy2:rgba(60,219,192,.14);--cyg:rgba(60,219,192,.4);
  --warn:#F5A623;--danger:#E05252;
  --s1:#1E1C1B;--s2:#252321;--s3:#2E2C2B;
  --bd:rgba(255,255,255,.07);--bd2:rgba(255,255,255,.13);
  --tx:#FFFFFF;--tx2:#C8CACC;--tx3:#A7A8AA;
  --f:'Montserrat',Arial,sans-serif;--r:10px;
}
body{font-family:var(--f);background:var(--blk);color:var(--tx);-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:var(--blk)}::-webkit-scrollbar-thumb{background:var(--gd);border-radius:3px}

/* HEADER */
.hd{height:56px;background:var(--s1);border-bottom:1px solid var(--bd);display:flex;align-items:center;justify-content:space-between;padding:0 22px;position:sticky;top:0;z-index:100}
.brand{display:flex;align-items:center;gap:12px}
.logo{display:flex;align-items:center;gap:5px;font-size:13px;font-weight:800;color:var(--tx);letter-spacing:-.3px}
.plus{color:var(--cy);font-size:17px;font-weight:900;filter:drop-shadow(0 0 7px var(--cyg));line-height:1}
.ia-chip{display:inline-block;background:var(--cy);color:var(--blk);font-size:9px;font-weight:900;padding:1px 5px;border-radius:3px;letter-spacing:.6px;vertical-align:middle}
.hsep{width:1px;height:22px;background:var(--bd2)}
.hsub{font-size:11px;font-weight:500;color:var(--tx3)}
.hactions{display:flex;gap:8px;align-items:center}

/* BUTTONS */
.btn{font-family:var(--f);font-weight:700;font-size:12px;padding:7px 16px;border-radius:6px;border:none;cursor:pointer;transition:all .14s;display:inline-flex;align-items:center;gap:6px;letter-spacing:.2px}
.btn:disabled{opacity:.4;cursor:not-allowed}
.btn-cy{background:var(--cy);color:var(--blk)}
.btn-cy:hover{box-shadow:0 0 18px var(--cyg);transform:translateY(-1px)}
.btn-ol{background:transparent;color:var(--tx2);border:1px solid var(--bd2)}
.btn-ol:hover{border-color:var(--cy);color:var(--cy)}
.btn-gh{background:rgba(255,255,255,.05);color:var(--tx3);border:1px solid var(--bd)}
.btn-gh:hover{background:rgba(255,255,255,.1);color:var(--tx)}
.btn-sm{font-size:11px;padding:5px 12px}

/* MAIN */
.main{padding:20px 22px;max-width:1380px;margin:0 auto}

/* METRICS */
.mrow{display:grid;grid-template-columns:repeat(5,1fr);gap:11px;margin-bottom:18px}
.mc{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);padding:15px 16px;position:relative;overflow:hidden}
.mc::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:var(--ma,var(--cy));opacity:.65}
.mc-lbl{font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.9px;margin-bottom:8px}
.mc-val{font-size:24px;font-weight:800;color:var(--tx);line-height:1;letter-spacing:-1px}
.mc-sub{font-size:10px;color:var(--tx3);margin-top:4px;font-weight:500}
/* L-frames on first card */
.lf{position:absolute;pointer-events:none}
.lf::before,.lf::after{content:'';position:absolute;background:var(--cy);opacity:.45}
.lf-tl::before{top:0;left:0;width:14px;height:2px}.lf-tl::after{top:0;left:0;width:2px;height:14px}
.lf-br::before{bottom:0;right:0;width:14px;height:2px}.lf-br::after{bottom:0;right:0;width:2px;height:14px}

/* HEALTH BAR */
.hbw{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);padding:13px 18px;margin-bottom:18px;display:flex;align-items:center;gap:16px}
.hbl{font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.8px;white-space:nowrap}
.hbar{flex:1;height:7px;background:var(--s3);border-radius:4px;overflow:hidden;display:flex;gap:1px}
.hbs{height:100%;transition:width .5s}
.hleg{display:flex;gap:10px}
.hli{display:flex;align-items:center;gap:4px;font-size:10px;color:var(--tx3);font-weight:500}
.d7{width:7px;height:7px;border-radius:50%}
.hscore{font-size:20px;font-weight:800;letter-spacing:-1px;white-space:nowrap}

/* TOOLBAR */
.tb{display:flex;align-items:center;gap:7px;margin-bottom:15px;flex-wrap:wrap}
.tbt{font-size:15px;font-weight:800;color:var(--tx);flex:1;letter-spacing:-.4px}
.fc{font-size:11px;font-weight:600;padding:5px 11px;border-radius:20px;border:1px solid var(--bd);background:none;color:var(--tx3);cursor:pointer;font-family:var(--f);transition:all .12s;letter-spacing:.2px}
.fc:hover{border-color:var(--cy);color:var(--cy)}
.fc.on{background:var(--cy2);border-color:var(--cy);color:var(--cy)}
.fc.ow{background:rgba(245,166,35,.12);border-color:var(--warn);color:var(--warn)}
.fc.od{background:rgba(224,82,82,.12);border-color:var(--danger);color:var(--danger)}
.vs{width:1px;height:16px;background:var(--bd2);margin:0 1px}

/* CARD GRID */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:11px}
.ic{background:#FFFFFF;border:1px solid #E4E7EC;border-radius:var(--r);cursor:pointer;transition:all .14s;overflow:hidden;position:relative}
.ic:hover{border-color:var(--cy);transform:translateY(-2px);box-shadow:0 4px 20px rgba(60,219,192,.15)}
.ic.ag{border-left:3px solid var(--warn)}
.ic.st{border-left:3px solid var(--danger)}
.ict{padding:13px 14px 9px;display:flex;align-items:flex-start;gap:9px}
.rdot{width:9px;height:9px;border-radius:50%;flex-shrink:0;margin-top:4px}
.icn{font-size:13px;font-weight:700;line-height:1.35;color:var(--blk);flex:1}
.ptag{font-size:10px;font-weight:700;padding:3px 7px;border-radius:4px;white-space:nowrap;letter-spacing:.3px;text-transform:uppercase}
.icm{padding:0 14px 12px}
.icow{font-size:11px;color:var(--gm);margin-bottom:9px;font-weight:500}
.pr{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
.prl{font-size:10px;color:var(--gm);font-weight:600;text-transform:uppercase;letter-spacing:.5px}
.prv{font-size:12px;font-weight:800;color:var(--blk);letter-spacing:-.5px}
.pt{height:4px;background:#E4E7EC;border-radius:2px;overflow:hidden}
.pf{height:100%;border-radius:2px;transition:width .5s}
.icf{display:flex;justify-content:space-between;align-items:center;margin-top:9px}
.roi{font-size:10px;font-weight:700;color:#0f766e;background:#f0fdf4;padding:3px 7px;border-radius:4px;letter-spacing:.3px}
.age{font-size:10px;font-weight:600}
.age-ok{color:var(--gm)}.age-w{color:var(--warn)}.age-d{color:var(--danger)}
.icrsk{border-top:1px solid #E4E7EC;padding:7px 14px 11px}
.rrow{font-size:11px;color:var(--gd);display:flex;gap:5px;margin-bottom:3px;line-height:1.4}

/* PANEL */
.ov{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:200;backdrop-filter:blur(3px)}
.panel{position:fixed;top:0;right:0;bottom:0;width:490px;background:var(--s1);z-index:201;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,.6);border-left:1px solid var(--bd)}
.phd{padding:16px 20px 12px;border-bottom:1px solid var(--bd);position:sticky;top:0;background:var(--s1);z-index:10}
.phr{display:flex;align-items:flex-start;gap:9px;margin-bottom:11px}
.ptit{font-size:14px;font-weight:800;color:var(--tx);flex:1;line-height:1.35;letter-spacing:-.3px}
.xbtn{background:none;border:none;color:var(--tx3);cursor:pointer;font-size:15px;padding:2px}
.xbtn:hover{color:var(--tx)}
.tabs{display:flex;gap:2px}
.tab{flex:1;padding:7px 4px;border-radius:6px;border:none;cursor:pointer;font-family:var(--f);font-size:11px;font-weight:700;color:var(--tx3);background:none;transition:all .12s;text-transform:uppercase;letter-spacing:.3px}
.tab:hover{color:var(--tx2)}
.tab.on{background:var(--cy2);color:var(--cy)}
.pb{padding:16px 20px;overflow-y:auto;flex:1}
.ps{margin-bottom:20px}
.pst{font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:1px;margin-bottom:9px}
.ig{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.ic2{background:var(--s2);border-radius:8px;padding:9px 11px;border:1px solid var(--bd)}
.icl{font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:3px}
.icv{font-size:12px;font-weight:700;color:var(--tx)}
.dt{font-size:12px;color:var(--tx2);line-height:1.65;font-weight:400}
.rch{display:flex;gap:7px;align-items:flex-start;background:rgba(224,82,82,.08);border:1px solid rgba(224,82,82,.2);border-radius:6px;padding:8px 10px;font-size:11px;color:#f8a5a5;margin-bottom:6px}
.bch{background:rgba(245,166,35,.08);border-color:rgba(245,166,35,.2);color:#fcd38d}
.ci{background:var(--s2);border-radius:8px;padding:9px 11px;border-left:3px solid var(--bd);margin-bottom:6px}
.cim{display:flex;justify-content:space-between;margin-bottom:3px}
.cid{font-size:10px;color:var(--tx3);font-weight:700}
.cin{font-size:11px;color:var(--tx2);line-height:1.5}

/* CHECK-IN FORM */
.cif{background:var(--s2);border-radius:8px;padding:15px;border:1px solid var(--bd)}
.fl{display:flex;flex-direction:column;gap:3px;margin-bottom:12px}
.fl label{font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.8px}
.fi,.fs,.fta{font-family:var(--f);font-size:12px;font-weight:500;background:var(--s3);color:var(--tx);border:1px solid var(--bd2);border-radius:6px;padding:7px 9px;outline:none;transition:border-color .12s}
.fi:focus,.fs:focus,.fta:focus{border-color:var(--cy)}
.fs option{background:var(--s3)}
.fta{resize:vertical;min-height:68px}
.rr{display:flex;gap:10px;align-items:center}
.rr input[type=range]{flex:1;accent-color:var(--cy)}
.rn{font-size:14px;font-weight:800;color:var(--cy);min-width:36px;letter-spacing:-.5px}

/* BRIEF */
.br{background:var(--blk);border-radius:8px;padding:16px;border:1px solid rgba(60,219,192,.2);position:relative;overflow:hidden}
.br::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--cy),transparent)}
.brh{display:flex;align-items:center;gap:9px;margin-bottom:12px}
.brt{font-size:12px;font-weight:800;color:var(--cy);letter-spacing:-.2px}
.brtx{font-size:12px;line-height:1.75;color:var(--tx2);white-space:pre-wrap;font-weight:400}
.ld{display:flex;align-items:center;gap:9px;color:var(--tx3);font-size:12px;font-weight:500}
.sp{width:15px;height:15px;border:2px solid rgba(60,219,192,.2);border-top-color:var(--cy);border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0}
@keyframes spin{to{transform:rotate(360deg)}}

/* MODAL */
.mo{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px)}
.mb{background:var(--s1);border-radius:13px;padding:24px;width:100%;max-width:490px;box-shadow:0 8px 40px rgba(0,0,0,.6);border:1px solid var(--bd2);max-height:90vh;overflow-y:auto}
.mt{font-size:16px;font-weight:800;color:var(--tx);margin-bottom:16px;letter-spacing:-.4px}

/* EMPTY */
.emp{text-align:center;padding:52px 20px;color:var(--tx3)}
.emp p{font-size:13px;margin-top:8px}

@media(max-width:680px){.mrow{grid-template-columns:repeat(2,1fr)}.panel{width:100%}.main{padding:13px}}

/* ROLE BADGES */
.rbadge{font-size:9px;font-weight:800;padding:2px 7px;border-radius:3px;letter-spacing:.5px;text-transform:uppercase;white-space:nowrap}
.rb-admin{background:var(--cy2);color:var(--cy)}
.rb-gestor{background:rgba(245,166,35,.15);color:var(--warn)}
.rb-viewer{background:rgba(255,255,255,.07);color:var(--tx3)}

/* AUDIT LOG */
.al-entry{background:var(--s2);border:1px solid var(--bd);border-radius:7px;padding:9px 12px;margin-bottom:6px}
.al-who{font-size:11px;font-weight:700;color:var(--tx)}
.al-what{font-size:11px;color:var(--tx2);margin-top:1px}
.al-when{font-size:10px;color:var(--tx3);font-weight:500}
.al-del{color:#f8a5a5}.al-edit{color:var(--cy)}.al-ci{color:var(--warn)}.al-create{color:#a7f3d0}

/* AI PROMPT */
.aip-box{background:var(--blk);border:1px solid rgba(60,219,192,.2);border-radius:7px;padding:11px;font-size:10.5px;color:var(--tx3);line-height:1.65;white-space:pre-wrap;max-height:180px;overflow-y:auto;font-family:monospace;letter-spacing:0}
.aip-ok{background:rgba(60,219,192,.07);border:1px solid rgba(60,219,192,.22);border-radius:6px;padding:9px 11px;font-size:11px;color:var(--cy);font-weight:600}
.aip-err{background:rgba(224,82,82,.07);border:1px solid rgba(224,82,82,.2);border-radius:6px;padding:9px 11px;font-size:11px;color:#f8a5a5;font-weight:500}
.aip-toggle{display:flex;align-items:center;gap:6px;margin-bottom:14px;border-bottom:1px solid var(--bd);padding-bottom:12px}

/* AI SETTINGS MODAL */
.ais-provider{display:flex;flex-direction:column;gap:7px;margin-bottom:16px}
.ais-opt{display:flex;align-items:center;gap:10px;background:var(--s2);border:1px solid var(--bd);border-radius:8px;padding:10px 13px;cursor:pointer;transition:all .12s}
.ais-opt:hover{border-color:var(--cy)}
.ais-opt.on{border-color:var(--cy);background:var(--cy2)}
.ais-opt input[type=radio]{accent-color:var(--cy);width:14px;height:14px;flex-shrink:0}
.ais-name{font-size:12px;font-weight:700;color:var(--tx)}
.ais-desc{font-size:10px;color:var(--tx3);margin-top:1px}
.ais-badge{font-size:9px;font-weight:800;padding:2px 6px;border-radius:3px;margin-left:auto;white-space:nowrap}
.ais-free{background:rgba(60,219,192,.15);color:var(--cy)}
.ais-key{background:rgba(245,166,35,.15);color:var(--warn)}

/* FIRST LOGIN OVERLAY */
.fl-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(6px)}
.fl-card{background:var(--s1);border:1px solid var(--bd2);border-radius:16px;padding:32px;width:100%;max-width:400px;box-shadow:0 8px 40px rgba(0,0,0,.7)}
.fl-title{font-size:16px;font-weight:800;color:var(--tx);margin-bottom:5px;letter-spacing:-.3px}
.fl-sub{font-size:11px;color:var(--tx3);margin-bottom:22px;font-weight:500;line-height:1.5}

/* AUTH SCREEN */
.auth{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--blk);padding:20px}
.auth-card{background:var(--s1);border:1px solid var(--bd2);border-radius:16px;padding:36px 32px;width:100%;max-width:420px;box-shadow:0 8px 40px rgba(0,0,0,.6)}
.auth-logo{display:flex;justify-content:center;margin-bottom:24px}
.auth-title{font-size:18px;font-weight:800;color:var(--tx);text-align:center;margin-bottom:5px;letter-spacing:-.4px}
.auth-sub{font-size:11px;color:var(--tx3);text-align:center;margin-bottom:22px;font-weight:500}
.auth-tabs{display:flex;gap:2px;background:var(--s2);border-radius:8px;padding:3px;margin-bottom:20px}
.auth-tab{flex:1;padding:7px;border-radius:6px;border:none;cursor:pointer;font-family:var(--f);font-size:11px;font-weight:700;color:var(--tx3);background:none;transition:all .12s;text-transform:uppercase;letter-spacing:.3px}
.auth-tab.on{background:var(--cy);color:var(--blk)}
.auth-err{background:rgba(224,82,82,.1);border:1px solid rgba(224,82,82,.3);border-radius:6px;padding:8px 10px;font-size:11px;color:#f8a5a5;margin-bottom:12px;font-weight:500}
.auth-ok{background:rgba(60,219,192,.1);border:1px solid rgba(60,219,192,.3);border-radius:6px;padding:10px 12px;font-size:12px;color:var(--cy);margin-bottom:12px;font-weight:500;text-align:center}
.usr-row{display:flex;justify-content:space-between;align-items:center;background:var(--s2);border:1px solid var(--bd);border-radius:8px;padding:9px 12px;margin-bottom:7px}
`;

function Logo({ height = 28 }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}logo-positivo-tecnologIA-mai-25.png`}
      alt="Positivo TecnologIA"
      style={{ height, display: "block", objectFit: "contain" }}
    />
  );
}

function IaBox({ style }) {
  return <span className="ia-chip" style={style}>IA</span>;
}

export default function App() {
  const [data, setData] = useState([]);
  const seeded = useRef(false);
  const [sel, setSel] = useState(null);
  const [fp, setFp] = useState("Todos");
  const [fr, setFr] = useState("Todos");
  const [fOwner, setFOwner] = useState("todas");
  const [tab, setTab] = useState("detail");
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ci, setCi] = useState({ ragStatus: "verde", progress: 50, note: "" });
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", owner: "", team: "", phase: "Ideação", roiEstimate: "", description: "", targetDate: "", url: "" });

  // Auth state
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [authView, setAuthView] = useState("login");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginErr, setLoginErr] = useState("");
  const [reqForm, setReqForm] = useState({ name: "", email: "", justification: "" });
  const [reqSent, setReqSent] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [approveTarget, setApproveTarget] = useState(null);
  const [approvePwd, setApprovePwd] = useState("");
  const [editForm, setEditForm] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  // AI check-in mode
  const [aiMode, setAiMode] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [aiParsed, setAiParsed] = useState(null);
  const [aiParseErr, setAiParseErr] = useState("");
  // Audit log
  const [auditLogs, setAuditLogs] = useState([]);
  const [usersModalTab, setUsersModalTab] = useState("requests");
  // Role selector no modal de aprovação
  const [approveRole, setApproveRole] = useState("viewer");
  // Configurações de IA para briefing — persistidas em localStorage
  const [aiProvider, setAiProvider] = useState(() => localStorage.getItem("brief_provider") || "proxy");
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("brief_apikey") || "");
  const [showApiSettings, setShowApiSettings] = useState(false);
  // Troca de senha (primeiro acesso e perfil)
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current: "", next: "", confirm: "" });
  const [pwdErr, setPwdErr] = useState("");
  const [pwdOk, setPwdOk] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // Escutar iniciativas do Firestore — só depois de autenticado
  useEffect(() => {
    if (!session) return;
    const unsub = onSnapshot(
      query(collection(db, "initiatives"), orderBy("lastUpdate", "desc")),
      snap => {
        if (snap.empty && !seeded.current) {
          // Primeira execução: semear dados iniciais
          seeded.current = true;
          INITIAL_INITIATIVES.forEach(({ id, ...rest }) => {
            addDoc(collection(db, "initiatives"), rest);
          });
        } else {
          setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      },
      err => console.error("Firestore initiatives error:", err.code, err.message)
    );
    return () => unsub();
  }, [session?.uid]);

  // Observar auth do Firebase
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (!fbUser) { setSession(null); return; }
        const snap = await getDoc(doc(db, "users", fbUser.uid));
        if (snap.exists()) {
          const profile = snap.data();
          setSession({ uid: fbUser.uid, ...profile });
          if (profile.firstLogin) setShowChangePwd(true);
        } else if (fbUser.email.toLowerCase() === ADMIN.email.toLowerCase()) {
          const profile = { email: fbUser.email, name: ADMIN.name, role: "admin" };
          await setDoc(doc(db, "users", fbUser.uid), profile);
          setSession({ uid: fbUser.uid, ...profile });
        } else {
          await signOut(auth);
          setLoginErr("Acesso ainda não aprovado. Aguarde a validação do administrador.");
        }
      } catch (e) {
        console.error("Erro Firebase:", e);
        setSession(null);
      } finally {
        setAuthLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // Escutar solicitações em tempo real
  useEffect(() => {
    if (!session) return;
    const q = query(collection(db, "requests"), orderBy("date", "desc"));
    const unsub = onSnapshot(q, snap => setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [session?.uid]);

  // Escutar usuários aprovados (todos autenticados — necessário para compartilhamento)
  useEffect(() => {
    if (!session) return;
    const unsub = onSnapshot(collection(db, "users"), snap => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.email.toLowerCase() !== ADMIN.email.toLowerCase()));
    });
    return () => unsub();
  }, [session?.role]);

  // Escutar audit log (admin)
  useEffect(() => {
    if (session?.role !== "admin") return;
    const q = query(collection(db, "auditLog"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, snap => setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [session?.role]);

  const total = data.length;
  const byRag = data.reduce((a, i) => { a[i.ragStatus]++; return a; }, { verde: 0, amarelo: 0, vermelho: 0 });
  let roi = 0;
  data.forEach(i => { const m = i.roiEstimate.match(/[\d,.]+/); if (m) roi += parseFloat(m[0].replace(",", ".")) || 0; });
  const score = Math.round((byRag.verde * 100 + byRag.amarelo * 55 + byRag.vermelho * 10) / Math.max(total, 1));
  const sc = score >= 70 ? "#3CDBC0" : score >= 45 ? "#F5A623" : "#E05252";

  const filtered = data.filter(i =>
    (fp === "Todos" || i.phase === fp) &&
    (fr === "Todos" || i.ragStatus === fr) &&
    (fOwner === "todas" || i.createdBy === session.uid)
  );
  const selLive = sel ? data.find(x => x.id === sel.id) || sel : null;

  // Permissões por role
  function canEdit(i) {
    if (!i) return false;
    if (session.role === "admin") return true;
    if (session.role === "gestor") return i.createdBy === session.uid;
    return false;
  }
  function canCheckIn(i) {
    if (!i) return false;
    if (session.role === "admin") return true;
    if (session.role === "gestor") return true;
    if (i.createdBy === session.uid) return true; // criador sempre pode
    if (i.sharedWith?.includes(session.uid)) return true; // compartilhado
    return false;
  }

  // Grava ação no audit log
  async function logAction(action, initiative, extra = {}) {
    try {
      await addDoc(collection(db, "auditLog"), {
        userId: session.uid, userName: session.name, userEmail: session.email || "",
        action, initiativeId: initiative.id, initiativeName: initiative.name || "?",
        timestamp: new Date().toISOString(), ...extra
      });
    } catch (e) { console.error("Erro ao gravar log:", e); }
  }

  // Gera prompt contextualizado para IA externa
  function buildPrompt(i) {
    const checks = (i.checkIns || []).slice(0, 5)
      .map(c => `• ${c.date}: ${c.note} (${RAG_LABEL[c.ragStatus]}, ${c.progress}%)`)
      .join("\n") || "Nenhum check-in registrado.";
    const diasSemUpdate = daysSince(i.lastUpdate);
    return `Você é um assistente de gestão de projetos de IA da Positivo Tecnologia.

INICIATIVA: ${i.name}
RESPONSÁVEL: ${i.owner} | TIME: ${i.team || "—"}
FASE: ${i.phase} | STATUS ATUAL: ${RAG_LABEL[i.ragStatus]}
PROGRESSO REGISTRADO: ${i.progress}%
PRAZO ALVO: ${i.targetDate || "não definido"}
DIAS SEM ATUALIZAÇÃO: ${diasSemUpdate}
DESCRIÇÃO: ${i.description || "—"}

HISTÓRICO DE CHECK-INS (mais recentes):
${checks}

RISCOS ATIVOS: ${(i.risks || []).join("; ") || "nenhum"}
BLOQUEIOS: ${(i.blockers || []).join("; ") || "nenhum"}

---
INSTRUÇÕES:
Você receberá um relato livre do responsável sobre o que foi feito. Com base nesse relato E no histórico acima:

1. Estime o progresso REAL atual (0–100%) considerando o esforço descrito e o que ainda falta para completar a iniciativa.
2. Liste o BACKLOG de ações pendentes: o que ainda precisa ser feito para avançar de fase ou concluir a iniciativa, com base na descrição e nos check-ins anteriores.
3. Avalie o status RAG (verde/amarelo/vermelho) considerando prazo, bloqueios e ritmo atual.
4. Escreva uma nota objetiva de 2–3 frases resumindo o que foi feito e o que vem a seguir.

Responda APENAS com um JSON no formato exato abaixo (sem markdown, sem texto extra):

{
  "ragStatus": "verde",
  "progress": 0,
  "note": "resumo em português, 2-3 frases objetivas do que foi feito e próximo passo",
  "risks": ["risco identificado"],
  "blockers": ["bloqueio identificado"],
  "backlog": ["ação pendente 1", "ação pendente 2", "ação pendente 3"]
}`;
  }

  // Parseia resposta JSON da IA
  function parseAIResponse(text) {
    try { return JSON.parse(text.trim()); } catch {}
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
    return null;
  }

  function open(i) {
    setSel(i); setTab("detail");
    setCi({ ragStatus: i.ragStatus, progress: i.progress, note: "" });
    setAiMode(false); setAiResponse(""); setAiParsed(null); setAiParseErr("");
    setConfirmDelete(false);
  }

  async function saveCI() {
    const dt = new Date().toISOString().split("T")[0];
    const newCI = { date: dt, note: ci.note, ragStatus: ci.ragStatus, progress: +ci.progress };
    const current = data.find(x => x.id === sel.id);
    await updateDoc(doc(db, "initiatives", sel.id), {
      ragStatus: ci.ragStatus,
      progress: +ci.progress,
      lastUpdate: new Date().toISOString(),
      checkIns: [newCI, ...(current?.checkIns || [])]
    });
    await logAction("check-in", { id: sel.id, name: sel.name }, { ragStatus: ci.ragStatus, progress: +ci.progress });
    setSel(s => ({ ...s, ragStatus: ci.ragStatus, progress: +ci.progress }));
    setTab("detail");
    setAiMode(false); setAiResponse(""); setAiParsed(null); setAiParseErr("");
  }

  async function saveEdit() {
    const current = data.find(x => x.id === sel.id);
    await updateDoc(doc(db, "initiatives", sel.id), {
      name: editForm.name,
      owner: editForm.owner,
      team: editForm.team,
      phase: editForm.phase,
      ragStatus: editForm.ragStatus,
      roiEstimate: editForm.roiEstimate,
      description: editForm.description,
      targetDate: editForm.targetDate,
      url: editForm.url,
      progress: +editForm.progress,
      risks: editForm.risks.split("\n").map(s => s.trim()).filter(Boolean),
      blockers: editForm.blockers.split("\n").map(s => s.trim()).filter(Boolean),
      lastUpdate: new Date().toISOString(),
    });
    await logAction("edit", { id: sel.id, name: editForm.name }, {
      before: { ragStatus: current?.ragStatus, progress: current?.progress },
      after: { ragStatus: editForm.ragStatus, progress: +editForm.progress }
    });
    setTab("detail");
  }

  async function deleteInit() {
    const current = data.find(x => x.id === sel.id);
    await logAction("delete", { id: sel.id, name: current?.name || sel.name });
    await deleteDoc(doc(db, "initiatives", sel.id));
    setSel(null);
    setConfirmDelete(false);
  }

  async function addInit() {
    const ref = await addDoc(collection(db, "initiatives"), {
      ...form, ragStatus: "amarelo", progress: 0, risks: [], blockers: [],
      startDate: new Date().toISOString().split("T")[0],
      lastUpdate: new Date().toISOString(), checkIns: [],
      createdBy: session.uid, createdByName: session.name, sharedWith: [],
    });
    await logAction("create", { id: ref.id, name: form.name });
    setShowAdd(false);
    setForm({ name: "", owner: "", team: "", phase: "Ideação", roiEstimate: "", description: "", targetDate: "", url: "" });
  }

  // Auth functions
  async function doLogin() {
    setLoginErr("");
    try {
      await signInWithEmailAndPassword(auth, loginForm.email.trim(), loginForm.password);
    } catch (e) {
      const msgs = { "auth/invalid-credential": "E-mail ou senha incorretos.", "auth/user-not-found": "E-mail não cadastrado.", "auth/wrong-password": "Senha incorreta.", "auth/too-many-requests": "Muitas tentativas. Tente novamente mais tarde." };
      setLoginErr(msgs[e.code] || "Erro ao entrar. Tente novamente.");
    }
  }

  async function doLogout() { await signOut(auth); }

  async function doChangePwd(isFirst = false) {
    setPwdErr("");
    if (pwdForm.next.length < 6) { setPwdErr("A senha deve ter ao menos 6 caracteres."); return; }
    if (pwdForm.next !== pwdForm.confirm) { setPwdErr("As senhas não coincidem."); return; }
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, pwdForm.current);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, pwdForm.next);
      if (isFirst) {
        await updateDoc(doc(db, "users", session.uid), { firstLogin: false });
        setSession(s => ({ ...s, firstLogin: false }));
        setShowChangePwd(false);
      } else {
        setPwdOk(true);
        setTimeout(() => { setShowProfile(false); setPwdOk(false); }, 1500);
      }
      setPwdForm({ current: "", next: "", confirm: "" });
    } catch (e) {
      const msgs = { "auth/wrong-password": "Senha atual incorreta.", "auth/invalid-credential": "Senha atual incorreta.", "auth/too-many-requests": "Muitas tentativas. Aguarde." };
      setPwdErr(msgs[e.code] || "Erro ao alterar senha. Tente novamente.");
    }
  }

  async function sendRequest() {
    await addDoc(collection(db, "requests"), {
      name: reqForm.name.trim(), email: reqForm.email.trim().toLowerCase(),
      justification: reqForm.justification.trim(),
      date: new Date().toISOString().split("T")[0], status: "pending"
    });
    setReqSent(true); setReqForm({ name: "", email: "", justification: "" });
  }

  async function approveRequest() {
    if (!approvePwd.trim()) return;
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, approveTarget.email, approvePwd.trim());
      await setDoc(doc(db, "users", cred.user.uid), { email: approveTarget.email, name: approveTarget.name, role: approveRole, firstLogin: true });
      await signOut(secondaryAuth);
      await updateDoc(doc(db, "requests", approveTarget.id), { status: "approved" });
      setApproveTarget(null); setApprovePwd(""); setApproveRole("viewer");
    } catch (e) {
      alert("Erro ao criar usuário: " + (e.code === "auth/email-already-in-use" ? "E-mail já cadastrado." : e.message));
    }
  }

  async function rejectRequest(id) {
    await updateDoc(doc(db, "requests", id), { status: "rejected" });
  }

  async function removeUser(uid) {
    await deleteDoc(doc(db, "users", uid));
  }

  async function changeUserRole(uid, newRole) {
    await updateDoc(doc(db, "users", uid), { role: newRole });
  }

  // Tela de loading enquanto Firebase resolve
  if (authLoading) return (
    <>
      <style>{CSS}</style>
      <div className="auth"><div className="ld"><div className="sp" /> Carregando...</div></div>
    </>
  );

  // Tela de autenticação
  if (!session) return (
    <>
      <style>{CSS}</style>
      <div className="auth">
        <div className="auth-card">
          <div className="auth-logo"><Logo height={38} /></div>
          <div className="auth-title">Gerenciador de Iniciativas <IaBox /></div>
          <div className="auth-sub">Acesso restrito · Positivo Tecnologia S.A.</div>
          <div className="auth-tabs">
            <button className={`auth-tab ${authView === "login" ? "on" : ""}`} onClick={() => { setAuthView("login"); setLoginErr(""); setReqSent(false); }}>Entrar</button>
            <button className={`auth-tab ${authView === "request" ? "on" : ""}`} onClick={() => { setAuthView("request"); setLoginErr(""); }}>Solicitar Acesso</button>
          </div>
          {authView === "login" && (
            <>
              {loginErr && <div className="auth-err">{loginErr}</div>}
              <div className="fl">
                <label>E-mail</label>
                <input className="fi" type="email" placeholder="seu@positivo.com.br" value={loginForm.email} onChange={e => { setLoginForm(p => ({ ...p, email: e.target.value })); setLoginErr(""); }} onKeyDown={e => e.key === "Enter" && doLogin()} />
              </div>
              <div className="fl">
                <label>Senha</label>
                <input className="fi" type="password" placeholder="••••••••" value={loginForm.password} onChange={e => { setLoginForm(p => ({ ...p, password: e.target.value })); setLoginErr(""); }} onKeyDown={e => e.key === "Enter" && doLogin()} />
              </div>
              <button className="btn btn-cy" style={{ width: "100%", justifyContent: "center", marginTop: 10 }} disabled={!loginForm.email || !loginForm.password} onClick={doLogin}>Entrar</button>
            </>
          )}
          {authView === "request" && (
            reqSent
              ? <div className="auth-ok">✓ Solicitação enviada! O administrador irá validar em breve.</div>
              : (
                <>
                  <div className="fl"><label>Nome Completo *</label><input className="fi" type="text" placeholder="Seu nome" value={reqForm.name} onChange={e => setReqForm(p => ({ ...p, name: e.target.value }))} /></div>
                  <div className="fl"><label>E-mail Corporativo *</label><input className="fi" type="email" placeholder="seu@positivo.com.br" value={reqForm.email} onChange={e => setReqForm(p => ({ ...p, email: e.target.value }))} /></div>
                  <div className="fl"><label>Justificativa *</label><textarea className="fta" placeholder="Por que você precisa de acesso?" value={reqForm.justification} onChange={e => setReqForm(p => ({ ...p, justification: e.target.value }))} /></div>
                  <button className="btn btn-cy" style={{ width: "100%", justifyContent: "center", marginTop: 10 }} disabled={!reqForm.name || !reqForm.email || !reqForm.justification} onClick={sendRequest}>Enviar Solicitação</button>
                </>
              )
          )}
        </div>
      </div>
    </>
  );

  const N8N_WEBHOOK = "https://briefing-proxy.rceschim.workers.dev";

  const BRIEF_PROMPT = (portfolio) =>
    `Você é um assistente executivo da Positivo Tecnologia. Analise o portfólio de iniciativas de IA abaixo e gere um briefing executivo em português, objetivo e direto, com no máximo 3 parágrafos. Destaque: saúde geral do portfólio, iniciativas críticas (em risco ou paradas), e uma recomendação de ação prioritária.\n\nDATA: ${new Date().toLocaleDateString("pt-BR")}\n\nPORTFÓLIO:\n${portfolio}`;

  async function genBrief() {
    setLoading(true); setBrief(null);
    const portfolio = data.map(i =>
      `• ${i.name} (${i.phase}) | ${RAG_LABEL[i.ragStatus]} | ${i.progress}% concluído | ROI: ${i.roiEstimate} | Dono: ${i.owner} | ${daysSince(i.lastUpdate)}d sem update${i.blockers.length ? ` | BLOQUEIO: ${i.blockers[0]}` : ""}${i.risks.length ? ` | RISCO: ${i.risks[0]}` : ""}`
    ).join("\n");

    try {
      if (aiProvider === "proxy") {
        // Cloudflare Worker (padrão)
        const res = await fetch(N8N_WEBHOOK, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ portfolio, date: new Date().toLocaleDateString("pt-BR") })
        });
        const j = await res.json();
        setBrief(j.briefing || j.text || j.output || "Erro ao gerar briefing.");

      } else if (aiProvider === "anthropic") {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-allow-browser": "true" },
          body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1024, messages: [{ role: "user", content: BRIEF_PROMPT(portfolio) }] })
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error?.message || res.statusText);
        setBrief(j.content?.[0]?.text || "Resposta vazia.");

      } else if (aiProvider === "openai") {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: JSON.stringify({ model: "gpt-4o", max_tokens: 1024, messages: [{ role: "user", content: BRIEF_PROMPT(portfolio) }] })
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error?.message || res.statusText);
        setBrief(j.choices?.[0]?.message?.content || "Resposta vazia.");

      } else if (aiProvider === "gemini") {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: BRIEF_PROMPT(portfolio) }] }] })
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error?.message || res.statusText);
        setBrief(j.candidates?.[0]?.content?.parts?.[0]?.text || "Resposta vazia.");
      }
    } catch (e) {
      setBrief(`Erro: ${e.message || "Falha na conexão com a API."}`);
    }
    setLoading(false);
  }

  const FIELDS = [
    ["Nome da Iniciativa *", "name", "text", "Ex: Chatbot de Suporte"],
    ["Responsável *", "owner", "text", "Nome do dono"],
    ["Time / Área", "team", "text", "Ex: Pricing & Costs"],
    ["ROI Estimado", "roiEstimate", "text", "Ex: R$ 1,5M/ano"],
    ["Prazo Alvo", "targetDate", "date", ""],
    ["URL do Sistema (se publicado)", "url", "url", "https://..."],
  ];

  return (
    <>
      <style>{CSS}</style>
      <div>
        {/* HEADER */}
        <header className="hd">
          <div className="brand">
            <Logo height={26} />
            <div className="hsep" />
            <span className="hsub">Gerenciador de Iniciativas <IaBox /></span>
          </div>
          <div className="hactions">
            <button className="btn btn-cy" onClick={() => { setSel(null); setBrief(null); genBrief(); }}>
              ✦ Briefing Executivo IA
            </button>
            <button className="btn btn-gh btn-sm" title="Configurar IA do Briefing" onClick={() => setShowApiSettings(true)} style={{ fontSize: 14, padding: "6px 10px" }}>⚙️</button>
            <button className="btn btn-ol" onClick={() => setShowAdd(true)}>+ Nova Iniciativa</button>
            {session.role === "admin" && (
              <button className="btn btn-ol" onClick={() => setShowUsers(true)}>
                👥 Acessos{requests.filter(r => r.status === "pending").length > 0 && <span style={{ background: "#E05252", color: "#fff", borderRadius: 10, fontSize: 9, fontWeight: 800, padding: "1px 5px", marginLeft: 4 }}>{requests.filter(r => r.status === "pending").length}</span>}
              </button>
            )}
            <button className="btn btn-gh btn-sm" style={{ gap: 5 }} onClick={() => { setShowProfile(true); setPwdErr(""); setPwdForm({ current: "", next: "", confirm: "" }); setPwdOk(false); }}>
              👤 {session.name.split(" ")[0]}
              <span className={`rbadge ${ROLE_CLS[session.role] || "rb-viewer"}`}>{ROLE_LABEL[session.role] || session.role}</span>
            </button>
            <button className="btn btn-gh btn-sm" onClick={doLogout}>Sair</button>
          </div>
        </header>

        <main className="main">
          {/* METRICS */}
          <div className="mrow">
            <div className="mc" style={{ "--ma": "#3CDBC0" }}>
              <div className="lf lf-tl" style={{ top: 7, left: 7 }} />
              <div className="lf lf-br" style={{ bottom: 7, right: 7 }} />
              <div className="mc-lbl">Total <IaBox style={{ fontSize: 8 }} /></div>
              <div className="mc-val">{total}</div>
              <div className="mc-sub">{PHASES.map(p => data.filter(i => i.phase === p).length > 0 ? `${data.filter(i => i.phase === p).length} ${p}` : null).filter(Boolean).join(" · ")}</div>
            </div>
            <div className="mc" style={{ "--ma": "#3CDBC0" }}>
              <div className="mc-lbl">No Prazo</div>
              <div className="mc-val" style={{ color: "#3CDBC0" }}>{byRag.verde}</div>
              <div className="mc-sub">{Math.round(byRag.verde / total * 100)}% do portfólio</div>
            </div>
            <div className="mc" style={{ "--ma": "#F5A623" }}>
              <div className="mc-lbl">Atenção</div>
              <div className="mc-val" style={{ color: "#F5A623" }}>{byRag.amarelo}</div>
              <div className="mc-sub">Requer acompanhamento</div>
            </div>
            <div className="mc" style={{ "--ma": "#E05252" }}>
              <div className="mc-lbl">Em Risco</div>
              <div className="mc-val" style={{ color: "#E05252" }}>{byRag.vermelho}</div>
              <div className="mc-sub">Ação imediata</div>
            </div>
            <div className="mc" style={{ "--ma": "#3CDBC0" }}>
              <div className="mc-lbl">ROI Total Est.</div>
              <div className="mc-val" style={{ fontSize: 22 }}>R${roi.toFixed(1)}M</div>
              <div className="mc-sub">por ano</div>
            </div>
          </div>

          {/* HEALTH BAR */}
          <div className="hbw">
            <span className="hbl">Saúde do Portfólio</span>
            <div className="hbar">
              <div className="hbs" style={{ width: `${byRag.verde / total * 100}%`, background: "#3CDBC0" }} />
              <div className="hbs" style={{ width: `${byRag.amarelo / total * 100}%`, background: "#F5A623" }} />
              <div className="hbs" style={{ width: `${byRag.vermelho / total * 100}%`, background: "#E05252" }} />
            </div>
            <div className="hleg">
              {Object.entries(RAG_LABEL).map(([k, v]) => (
                <div key={k} className="hli"><div className="d7" style={{ background: RAG[k] }} />{v}</div>
              ))}
            </div>
            <div className="hscore" style={{ color: sc }}>{score}<span style={{ fontSize: 11, color: "var(--tx3)", fontWeight: 500 }}>/100</span></div>
          </div>

          {/* TOOLBAR */}
          <div className="tb">
            <span className="tbt">Iniciativas <IaBox style={{ fontSize: 10, verticalAlign: "middle" }} /></span>
            <button className={`fc ${fOwner === "todas" ? "on" : ""}`} onClick={() => setFOwner("todas")}>Todas</button>
            <button className={`fc ${fOwner === "minhas" ? "on" : ""}`} onClick={() => setFOwner("minhas")}>Minhas</button>
            <div className="vs" />
            {["Todos", ...PHASES].map(f => (
              <button key={f} className={`fc ${fp === f ? "on" : ""}`} onClick={() => setFp(f)}>{f}</button>
            ))}
            <div className="vs" />
            {["Todos", "verde", "amarelo", "vermelho"].map(r => (
              <button key={r}
                className={`fc ${fr === r ? (r === "vermelho" ? "od" : r === "amarelo" ? "ow" : "on") : ""}`}
                onClick={() => setFr(r)}>
                {r === "Todos" ? "Todos RAG" : RAG_LABEL[r]}
              </button>
            ))}
          </div>

          {/* CARDS */}
          {filtered.length === 0
            ? <div className="emp"><p>Nenhuma iniciativa com os filtros selecionados.</p></div>
            : (
              <div className="grid">
                {filtered.map(i => {
                  const s = stale(i); const days = daysSince(i.lastUpdate);
                  return (
                    <div key={i.id} className={`ic ${s === "s" ? "st" : s === "a" ? "ag" : ""}`} onClick={() => open(i)}>
                      <div className="ict">
                        <div className="rdot" style={{ background: RAG[i.ragStatus], boxShadow: `0 0 6px ${RAG[i.ragStatus]}55` }} />
                        <div className="icn">{i.name}</div>
                        <div className="ptag" style={{ background: PHASE_C[i.phase] + "22", color: PHASE_C[i.phase] }}>{i.phase}</div>
                      </div>
                      <div className="icm">
                        <div className="icow">👤 {i.owner} · {i.team}</div>
                        {i.createdByName && i.createdByName !== i.owner && (
                          <div style={{ fontSize: 10, color: "var(--gl)", marginBottom: 6, fontWeight: 500 }}>✏️ criado por {i.createdByName}</div>
                        )}
                        <div className="pr"><span className="prl">Progresso</span><span className="prv">{i.progress}%</span></div>
                        <div className="pt"><div className="pf" style={{ width: `${i.progress}%`, background: RAG[i.ragStatus] }} /></div>
                        <div className="icf">
                          <span className="roi">💰 {i.roiEstimate}</span>
                          <span className={`age ${s === "s" ? "age-d" : s === "a" ? "age-w" : "age-ok"}`}>{days === 0 ? "Hoje" : `há ${days}d`}</span>
                        </div>
                        {i.url && (
                          <div style={{ padding: "0 0 10px" }}>
                            <a href={i.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="btn btn-cy btn-sm" style={{ width: "100%", justifyContent: "center", textDecoration: "none", display: "flex" }}>↗ Acessar Sistema</a>
                          </div>
                        )}
                      </div>
                      {(i.risks.length > 0 || i.blockers.length > 0) && (
                        <div className="icrsk">
                          {[...i.blockers.map(b => ({ t: b, bl: true })), ...i.risks.map(r => ({ t: r, bl: false }))].slice(0, 2).map((r, idx) => (
                            <div key={idx} className="rrow"><span>{r.bl ? "🚫" : "⚠️"}</span><span>{r.t}</span></div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          }
        </main>

        {/* SIDE PANEL */}
        {(selLive || loading || brief) && !showAdd && (
          <>
            <div className="ov" onClick={() => { setSel(null); setBrief(null); setLoading(false); }} />
            <div className="panel">
              {/* BRIEF ONLY */}
              {!selLive && (loading || brief) && (
                <>
                  <div className="phd">
                    <div className="phr">
                      <Logo height={20} />
                      <button className="xbtn" style={{ marginLeft: "auto" }} onClick={() => { setBrief(null); setLoading(false); }}>✕</button>
                    </div>
                    <div className="ptit">✦ Briefing Executivo — Gerenciador de Iniciativas <IaBox /></div>
                  </div>
                  <div className="pb">
                    <div className="br">
                      <div className="brh"><span style={{ fontSize: 16 }}>📊</span><span className="brt">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</span></div>
                      {loading
                        ? <div className="ld"><div className="sp" /> Analisando {total} iniciativas...</div>
                        : <div className="brtx">{brief}</div>
                      }
                      {brief && !loading && <button className="btn btn-gh btn-sm" style={{ marginTop: 12 }} onClick={genBrief}>↺ Regenerar</button>}
                    </div>
                  </div>
                </>
              )}

              {/* INITIATIVE */}
              {selLive && (
                <>
                  <div className="phd">
                    <div className="phr">
                      <div className="rdot" style={{ background: RAG[selLive.ragStatus], boxShadow: `0 0 8px ${RAG[selLive.ragStatus]}66`, width: 10, height: 10, marginTop: 3 }} />
                      <div className="ptit">{selLive.name}</div>
                      <button className="xbtn" onClick={() => setSel(null)}>✕</button>
                    </div>
                    <div className="tabs">
                      {[
                        ["detail", "📋 Detalhes"],
                        ...(canCheckIn(selLive) ? [["ci", "✏️ Check-in"]] : []),
                        ["ai", "✦ IA"],
                        ...(canEdit(selLive) ? [["edit", "⚙️ Editar"]] : []),
                      ].map(([k, l]) => (
                        <button key={k} className={`tab ${tab === k ? "on" : ""}`}
                          onClick={() => {
                            setTab(k);
                            setConfirmDelete(false);
                            if (k === "ai" && !brief && !loading) genBrief();
                            if (k === "edit") setEditForm({
                              name: selLive.name,
                              owner: selLive.owner,
                              team: selLive.team || "",
                              phase: selLive.phase,
                              ragStatus: selLive.ragStatus,
                              roiEstimate: selLive.roiEstimate || "",
                              description: selLive.description || "",
                              targetDate: selLive.targetDate || "",
                              url: selLive.url || "",
                              progress: selLive.progress,
                              risks: (selLive.risks || []).join("\n"),
                              blockers: (selLive.blockers || []).join("\n"),
                            });
                          }}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pb">
                    {/* DETAIL */}
                    {tab === "detail" && (
                      <>
                        <div className="ps">
                          <div className="pst">Informações</div>
                          <div className="ig">
                            {[
                              ["Fase", <span style={{ color: PHASE_C[selLive.phase] }}>{selLive.phase}</span>],
                              ["Status", <span style={{ color: RAG[selLive.ragStatus] }}>{RAG_LABEL[selLive.ragStatus]}</span>],
                              ["Responsável", selLive.owner],
                              ["Time", selLive.team],
                              ["ROI Est.", <span style={{ color: "#3CDBC0" }}>{selLive.roiEstimate}</span>],
                              ["Progresso", `${selLive.progress}%`],
                              ["Prazo", selLive.targetDate || "—"],
                              ["Última Atualiz.", <span style={{ color: stale(selLive) !== "f" ? "#F5A623" : undefined }}>há {daysSince(selLive.lastUpdate)}d</span>],
                              ...(selLive.createdByName ? [["Criado por", selLive.createdByName]] : []),
                            ].map(([l, v], idx) => (
                              <div key={idx} className="ic2">
                                <div className="icl">{l}</div>
                                <div className="icv">{v}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        {selLive.url && (
                          <div className="ps">
                            <a href={selLive.url} target="_blank" rel="noopener noreferrer" className="btn btn-cy" style={{ width: "100%", justifyContent: "center", textDecoration: "none", display: "flex" }}>↗ Acessar Sistema Online</a>
                          </div>
                        )}
                        <div className="ps">
                          <div className="pst">Descrição</div>
                          <div className="dt">{selLive.description}</div>
                        </div>
                        {(selLive.blockers.length > 0 || selLive.risks.length > 0) && (
                          <div className="ps">
                            <div className="pst">Riscos & Bloqueios</div>
                            {selLive.blockers.map((b, i) => <div key={i} className="rch bch">🚫 {b}</div>)}
                            {selLive.risks.map((r, i) => <div key={i} className="rch">⚠️ {r}</div>)}
                          </div>
                        )}
                        {(session.role === "admin" || selLive.createdBy === session.uid) && users.length > 0 && (
                          <div className="ps">
                            <div className="pst">👥 Compartilhar Check-in</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {users.filter(u => u.uid !== selLive.createdBy).map(u => {
                                const shared = selLive.sharedWith?.includes(u.uid);
                                return (
                                  <div key={u.uid} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--s2)", border: `1px solid ${shared ? "rgba(60,219,192,.3)" : "var(--bd)"}`, borderRadius: 7, padding: "8px 11px" }}>
                                    <div>
                                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--tx)" }}>{u.name}</div>
                                      <div style={{ fontSize: 10, color: "var(--tx3)" }}>{u.email}</div>
                                    </div>
                                    <button
                                      className={`btn btn-sm ${shared ? "btn-cy" : "btn-ol"}`}
                                      onClick={async () => {
                                        const current = selLive.sharedWith || [];
                                        const next = shared ? current.filter(id => id !== u.uid) : [...current, u.uid];
                                        await updateDoc(doc(db, "initiatives", selLive.id), { sharedWith: next });
                                      }}
                                    >{shared ? "✓ Com acesso" : "+ Compartilhar"}</button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <div className="ps">
                          <div className="pst">Histórico de Check-ins</div>
                          {selLive.checkIns.length === 0
                            ? <div style={{ fontSize: 11, color: "var(--tx3)" }}>Nenhum check-in ainda.</div>
                            : selLive.checkIns.map((c, i) => (
                              <div key={i} className="ci" style={{ borderLeftColor: RAG[c.ragStatus] }}>
                                <div className="cim">
                                  <span className="cid">{c.date} · {c.progress}%</span>
                                  <span style={{ fontSize: 10, color: RAG[c.ragStatus], fontWeight: 700 }}>{RAG_LABEL[c.ragStatus]}</span>
                                </div>
                                <div className="cin">{c.note}</div>
                              </div>
                            ))
                          }
                        </div>
                      </>
                    )}

                    {/* CHECK-IN */}
                    {tab === "ci" && (
                      <div className="cif">
                        {/* Toggle: manual vs IA */}
                        <div className="aip-toggle">
                          <button className={`btn btn-sm ${!aiMode ? "btn-cy" : "btn-gh"}`} onClick={() => { setAiMode(false); setAiResponse(""); setAiParsed(null); setAiParseErr(""); }}>✏️ Manual</button>
                          <button className={`btn btn-sm ${aiMode ? "btn-cy" : "btn-gh"}`} onClick={() => setAiMode(true)}>✦ Atualizar com IA</button>
                        </div>

                        {/* MODO IA */}
                        {aiMode ? (
                          <>
                            <div className="pst" style={{ marginBottom: 8 }}>1. Copie o prompt e cole na sua IA</div>
                            <div className="aip-box">{buildPrompt(selLive)}</div>
                            <button className="btn btn-gh btn-sm" style={{ marginTop: 7, marginBottom: 16 }} onClick={() => navigator.clipboard.writeText(buildPrompt(selLive))}>📋 Copiar Prompt</button>

                            <div className="pst" style={{ marginBottom: 8 }}>2. Cole a resposta da IA aqui</div>
                            <textarea className="fta" style={{ minHeight: 100, marginBottom: 8 }} placeholder={'{\n  "ragStatus": "verde",\n  "progress": 75,\n  "note": "...",\n  "risks": [],\n  "blockers": [],\n  "backlog": ["ação 1", "ação 2"]\n}'} value={aiResponse} onChange={e => { setAiResponse(e.target.value); setAiParsed(null); setAiParseErr(""); }} />
                            <button className="btn btn-ol btn-sm" style={{ marginBottom: 12 }} onClick={() => {
                              const parsed = parseAIResponse(aiResponse);
                              if (parsed && ["verde","amarelo","vermelho"].includes(parsed.ragStatus) && typeof parsed.progress === "number") {
                                setAiParsed(parsed);
                                setCi({ ragStatus: parsed.ragStatus, progress: parsed.progress, note: parsed.note || "" });
                                setAiParseErr("");
                              } else {
                                setAiParseErr("Não foi possível ler o JSON. Verifique se a IA respondeu no formato correto.");
                                setAiParsed(null);
                              }
                            }}>Interpretar Resposta</button>

                            {aiParseErr && <div className="aip-err" style={{ marginBottom: 12 }}>{aiParseErr}</div>}
                            {aiParsed && (
                              <div style={{ marginBottom: 14 }}>
                                <div className="aip-ok" style={{ marginBottom: aiParsed.backlog?.length ? 8 : 0 }}>
                                  ✓ Lido: <strong style={{ color: RAG[aiParsed.ragStatus] }}>{RAG_LABEL[aiParsed.ragStatus]}</strong> · {aiParsed.progress}% · "{aiParsed.note?.slice(0, 60)}{aiParsed.note?.length > 60 ? "…" : ""}"
                                </div>
                                {aiParsed.backlog?.length > 0 && (
                                  <div style={{ background: "var(--s2)", border: "1px solid var(--bd)", borderRadius: 6, padding: "9px 11px" }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: ".7px", marginBottom: 6 }}>📋 Backlog sugerido pela IA</div>
                                    {aiParsed.backlog.map((b, idx) => (
                                      <div key={idx} style={{ fontSize: 11, color: "var(--tx2)", display: "flex", gap: 6, marginBottom: 4 }}>
                                        <span style={{ color: "var(--cy)", fontWeight: 700 }}>{idx + 1}.</span>{b}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="pst" style={{ marginBottom: 8 }}>3. Revise e confirme</div>
                            <div className="fl">
                              <label>Status RAG</label>
                              <select className="fs" value={ci.ragStatus} onChange={e => setCi(p => ({ ...p, ragStatus: e.target.value }))}>
                                <option value="verde">🟢 No Prazo</option>
                                <option value="amarelo">🟡 Atenção</option>
                                <option value="vermelho">🔴 Em Risco</option>
                              </select>
                            </div>
                            <div className="fl">
                              <label>Progresso</label>
                              <div className="rr">
                                <input type="range" min={0} max={100} value={ci.progress} onChange={e => setCi(p => ({ ...p, progress: e.target.value }))} />
                                <span className="rn">{ci.progress}%</span>
                              </div>
                            </div>
                            <div className="fl">
                              <label>Nota</label>
                              <textarea className="fta" value={ci.note} onChange={e => setCi(p => ({ ...p, note: e.target.value }))} />
                            </div>
                            <button className="btn btn-cy" style={{ width: "100%", justifyContent: "center" }} disabled={!ci.note} onClick={saveCI}>Registrar Check-in</button>
                          </>
                        ) : (
                          /* MODO MANUAL */
                          <>
                            <div className="fl">
                              <label>Status RAG</label>
                              <select className="fs" value={ci.ragStatus} onChange={e => setCi(p => ({ ...p, ragStatus: e.target.value }))}>
                                <option value="verde">🟢 No Prazo</option>
                                <option value="amarelo">🟡 Atenção</option>
                                <option value="vermelho">🔴 Em Risco</option>
                              </select>
                            </div>
                            <div className="fl">
                              <label>Progresso</label>
                              <div className="rr">
                                <input type="range" min={0} max={100} value={ci.progress} onChange={e => setCi(p => ({ ...p, progress: e.target.value }))} />
                                <span className="rn">{ci.progress}%</span>
                              </div>
                            </div>
                            <div className="fl">
                              <label>O que aconteceu esta semana?</label>
                              <textarea className="fta" placeholder="Ex: Concluímos a integração X. Próximo passo: testes..." value={ci.note} onChange={e => setCi(p => ({ ...p, note: e.target.value }))} />
                            </div>
                            <button className="btn btn-cy" style={{ width: "100%", justifyContent: "center" }} disabled={!ci.note} onClick={saveCI}>Registrar Check-in</button>
                          </>
                        )}
                      </div>
                    )}

                    {/* AI */}
                    {tab === "ai" && (
                      <div className="br">
                        <div className="brh"><span style={{ fontSize: 16 }}>✦</span><span className="brt">Briefing Executivo · {new Date().toLocaleDateString("pt-BR")}</span></div>
                        {loading
                          ? <div className="ld"><div className="sp" /> Analisando portfólio...</div>
                          : brief
                            ? <><div className="brtx">{brief}</div><button className="btn btn-gh btn-sm" style={{ marginTop: 12 }} onClick={genBrief}>↺ Regenerar</button></>
                            : <button className="btn btn-cy btn-sm" onClick={genBrief}>✦ Gerar Briefing</button>
                        }
                      </div>
                    )}

                    {/* EDITAR — admin ou gestor (próprias iniciativas) */}
                    {tab === "edit" && canEdit(selLive) && (
                      <div className="cif">
                        <div className="pst" style={{ marginBottom: 13 }}>⚙️ Editar Iniciativa</div>
                        {[
                          ["Nome *", "name", "text", ""],
                          ["Responsável *", "owner", "text", ""],
                          ["Time / Área", "team", "text", ""],
                          ["ROI Estimado", "roiEstimate", "text", "Ex: R$ 1,5M/ano"],
                          ["Prazo Alvo", "targetDate", "date", ""],
                          ["URL do Sistema", "url", "url", "https://..."],
                        ].map(([label, key, type]) => (
                          <div key={key} className="fl">
                            <label>{label}</label>
                            <input className="fi" type={type} value={editForm[key] || ""} onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))} />
                          </div>
                        ))}
                        <div className="fl">
                          <label>Fase</label>
                          <select className="fs" value={editForm.phase || "Ideação"} onChange={e => setEditForm(p => ({ ...p, phase: e.target.value }))}>
                            {PHASES.map(p => <option key={p}>{p}</option>)}
                          </select>
                        </div>
                        <div className="fl">
                          <label>Status RAG</label>
                          <select className="fs" value={editForm.ragStatus || "verde"} onChange={e => setEditForm(p => ({ ...p, ragStatus: e.target.value }))}>
                            <option value="verde">🟢 No Prazo</option>
                            <option value="amarelo">🟡 Atenção</option>
                            <option value="vermelho">🔴 Em Risco</option>
                          </select>
                        </div>
                        <div className="fl">
                          <label>Progresso</label>
                          <div className="rr">
                            <input type="range" min={0} max={100} value={editForm.progress ?? 0} onChange={e => setEditForm(p => ({ ...p, progress: e.target.value }))} />
                            <span className="rn">{editForm.progress ?? 0}%</span>
                          </div>
                        </div>
                        <div className="fl">
                          <label>Descrição</label>
                          <textarea className="fta" value={editForm.description || ""} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} />
                        </div>
                        <div className="fl">
                          <label>Riscos (um por linha)</label>
                          <textarea className="fta" style={{ minHeight: 52 }} placeholder="Ex: Integração SAP pendente" value={editForm.risks || ""} onChange={e => setEditForm(p => ({ ...p, risks: e.target.value }))} />
                        </div>
                        <div className="fl" style={{ marginBottom: 16 }}>
                          <label>Bloqueios (um por linha)</label>
                          <textarea className="fta" style={{ minHeight: 52 }} placeholder="Ex: API keys TI não liberadas" value={editForm.blockers || ""} onChange={e => setEditForm(p => ({ ...p, blockers: e.target.value }))} />
                        </div>
                        <button className="btn btn-cy" style={{ width: "100%", justifyContent: "center", marginBottom: 10 }} disabled={!editForm.name || !editForm.owner} onClick={saveEdit}>Salvar Alterações</button>
                        {session?.role !== "admin" ? null : !confirmDelete
                          ? <button className="btn btn-gh" style={{ width: "100%", justifyContent: "center", color: "#E05252", borderColor: "rgba(224,82,82,.3)" }} onClick={() => setConfirmDelete(true)}>🗑️ Excluir Iniciativa</button>
                          : <div style={{ background: "rgba(224,82,82,.08)", border: "1px solid rgba(224,82,82,.25)", borderRadius: 8, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                              <span style={{ fontSize: 11, color: "#f8a5a5", fontWeight: 600 }}>Confirmar exclusão permanente de "{selLive.name}"?</span>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button className="btn btn-sm" style={{ flex: 1, justifyContent: "center", background: "#E05252", color: "#fff" }} onClick={deleteInit}>Excluir</button>
                                <button className="btn btn-gh btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => setConfirmDelete(false)}>Cancelar</button>
                              </div>
                            </div>
                        }
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* USERS MODAL */}
        {showUsers && session?.role === "admin" && (
          <div className="mo" onClick={e => e.target === e.currentTarget && setShowUsers(false)}>
            <div className="mb" style={{ maxWidth: 600 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div className="mt" style={{ margin: 0 }}>👥 Administração</div>
                <button className="xbtn" onClick={() => { setShowUsers(false); setApproveTarget(null); }}>✕</button>
              </div>

              {/* Abas do modal */}
              <div className="auth-tabs" style={{ marginBottom: 18 }}>
                {[["requests", `Solicitações${requests.filter(r=>r.status==="pending").length > 0 ? ` (${requests.filter(r=>r.status==="pending").length})` : ""}`], ["users", "Usuários"], ["audit", "Log de Ações"]].map(([k, l]) => (
                  <button key={k} className={`auth-tab ${usersModalTab === k ? "on" : ""}`} onClick={() => setUsersModalTab(k)}>{l}</button>
                ))}
              </div>

              {/* ABA: Solicitações */}
              {usersModalTab === "requests" && (
                <>
                  {requests.filter(r => r.status === "pending").length === 0
                    ? <div style={{ fontSize: 11, color: "var(--tx3)", padding: "12px 0" }}>Nenhuma solicitação pendente.</div>
                    : requests.filter(r => r.status === "pending").map(r => (
                      <div key={r.id} style={{ background: "var(--s2)", border: "1px solid var(--bd)", borderRadius: 8, padding: "10px 12px", marginBottom: 9 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5 }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--tx)" }}>{r.name}</div>
                            <div style={{ fontSize: 10, color: "var(--tx3)" }}>{r.email} · {r.date}</div>
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn btn-cy btn-sm" onClick={() => { setApproveTarget(r); setApprovePwd(""); }}>Aprovar</button>
                            <button className="btn btn-gh btn-sm" style={{ color: "#E05252", borderColor: "rgba(224,82,82,.3)" }} onClick={() => rejectRequest(r.id)}>Rejeitar</button>
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--tx2)", fontStyle: "italic" }}>"{r.justification}"</div>
                        {approveTarget?.id === r.id && (
                          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <select className="fs" style={{ width: 140 }} value={approveRole} onChange={e => setApproveRole(e.target.value)}>
                                <option value="viewer">Visualizador</option>
                                <option value="gestor">Gestor</option>
                              </select>
                              <input className="fi" type="text" placeholder="Senha inicial" style={{ flex: 1 }} value={approvePwd} onChange={e => setApprovePwd(e.target.value)} onKeyDown={e => e.key === "Enter" && approveRequest()} autoFocus />
                              <button className="btn btn-cy btn-sm" disabled={!approvePwd.trim()} onClick={approveRequest}>Confirmar</button>
                              <button className="btn btn-gh btn-sm" onClick={() => { setApproveTarget(null); setApproveRole("viewer"); }}>✕</button>
                            </div>
                            <div style={{ fontSize: 10, color: "var(--tx3)" }}>
                              {approveRole === "gestor" ? "⚙️ Gestor: cria e edita suas próprias iniciativas" : "👁 Visualizador: apenas leitura"}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  }
                </>
              )}

              {/* ABA: Usuários */}
              {usersModalTab === "users" && (
                <>
                  <div className="usr-row" style={{ marginBottom: 7, opacity: 0.6 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--tx)" }}>{ADMIN.name}</div>
                      <div style={{ fontSize: 10, color: "var(--tx3)" }}>{ADMIN.email}</div>
                    </div>
                    <span className="rbadge rb-admin">Admin</span>
                  </div>
                  {users.length === 0
                    ? <div style={{ fontSize: 11, color: "var(--tx3)" }}>Nenhum outro usuário aprovado ainda.</div>
                    : users.map(u => (
                      <div key={u.uid} className="usr-row">
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--tx)" }}>{u.name}</div>
                          <div style={{ fontSize: 10, color: "var(--tx3)" }}>{u.email}</div>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <select className="fs" style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6 }}
                            value={u.role || "viewer"}
                            onChange={e => changeUserRole(u.uid, e.target.value)}>
                            <option value="viewer">Visualizador</option>
                            <option value="gestor">Gestor</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button className="btn btn-gh btn-sm" style={{ color: "#E05252", borderColor: "rgba(224,82,82,.3)" }} onClick={() => removeUser(u.uid)}>Remover</button>
                        </div>
                      </div>
                    ))
                  }
                </>
              )}

              {/* ABA: Log de Ações */}
              {usersModalTab === "audit" && (
                <>
                  {auditLogs.length === 0
                    ? <div style={{ fontSize: 11, color: "var(--tx3)", padding: "12px 0" }}>Nenhuma ação registrada ainda.</div>
                    : auditLogs.slice(0, 60).map(log => (
                      <div key={log.id} className="al-entry">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span className="al-who">{log.userName}</span>
                          <span className="al-when">{new Date(log.timestamp).toLocaleString("pt-BR")}</span>
                        </div>
                        <div className={`al-what ${ACTION_CLS[log.action] || ""}`}>
                          {ACTION_LABEL[log.action] || log.action} <strong>"{log.initiativeName}"</strong>
                          {log.action === "check-in" && log.ragStatus && ` → ${RAG_LABEL[log.ragStatus]}, ${log.progress}%`}
                          {log.action === "edit" && log.before && ` (${RAG_LABEL[log.before.ragStatus]} ${log.before.progress}% → ${RAG_LABEL[log.after?.ragStatus]} ${log.after?.progress}%)`}
                        </div>
                      </div>
                    ))
                  }
                </>
              )}
            </div>
          </div>
        )}

        {/* ADD MODAL */}
        {showAdd && (
          <div className="mo" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
            <div className="mb">
              <div className="mt">+ Nova Iniciativa <span style={{ color: "#3CDBC0" }}><IaBox /></span></div>
              {FIELDS.map(([label, key, type, ph]) => (
                <div key={key} className="fl">
                  <label>{label}</label>
                  <input className="fi" type={type} placeholder={ph} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
                </div>
              ))}
              <div className="fl">
                <label>Fase Inicial</label>
                <select className="fs" value={form.phase} onChange={e => setForm(p => ({ ...p, phase: e.target.value }))}>
                  {PHASES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="fl">
                <label>Descrição</label>
                <textarea className="fta" placeholder="O que essa iniciativa resolve? Qual o impacto esperado?" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: 9, marginTop: 4 }}>
                <button className="btn btn-gh" style={{ flex: 1, justifyContent: "center" }} onClick={() => setShowAdd(false)}>Cancelar</button>
                <button className="btn btn-cy" style={{ flex: 1, justifyContent: "center" }} disabled={!form.name || !form.owner} onClick={addInit}>Adicionar</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL CONFIGURAÇÃO DE IA */}
        {showApiSettings && (
          <div className="mo" onClick={e => e.target === e.currentTarget && setShowApiSettings(false)}>
            <div className="mb" style={{ maxWidth: 460 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div className="mt" style={{ margin: 0 }}>⚙️ Configurar IA do Briefing</div>
                <button className="xbtn" onClick={() => setShowApiSettings(false)}>✕</button>
              </div>

              <div className="pst" style={{ marginBottom: 10 }}>Provedor de IA</div>
              <div className="ais-provider">
                {[
                  { id: "proxy", name: "Proxy Padrão (Cloudflare Worker)", desc: "Usa o worker configurado. Não requer API key.", badge: "Padrão", cls: "ais-free" },
                  { id: "anthropic", name: "Claude (Anthropic)", desc: "claude-sonnet-4-6 — melhor qualidade de análise.", badge: "API Key", cls: "ais-key" },
                  { id: "openai", name: "OpenAI (GPT-4o)", desc: "gpt-4o — boa alternativa para briefings executivos.", badge: "API Key", cls: "ais-key" },
                  { id: "gemini", name: "Google Gemini", desc: "gemini-1.5-flash — rápido e econômico.", badge: "API Key", cls: "ais-key" },
                ].map(p => (
                  <label key={p.id} className={`ais-opt ${aiProvider === p.id ? "on" : ""}`}>
                    <input type="radio" name="provider" value={p.id} checked={aiProvider === p.id} onChange={() => { setAiProvider(p.id); localStorage.setItem("brief_provider", p.id); }} />
                    <div>
                      <div className="ais-name">{p.name}</div>
                      <div className="ais-desc">{p.desc}</div>
                    </div>
                    <span className={`ais-badge ${p.cls}`}>{p.badge}</span>
                  </label>
                ))}
              </div>

              {aiProvider !== "proxy" && (
                <>
                  <div className="pst" style={{ marginBottom: 8 }}>API Key — {aiProvider === "anthropic" ? "Anthropic" : aiProvider === "openai" ? "OpenAI" : "Google AI Studio"}</div>
                  <div className="fl" style={{ marginBottom: 6 }}>
                    <input
                      className="fi" type="password"
                      placeholder={aiProvider === "anthropic" ? "sk-ant-..." : aiProvider === "openai" ? "sk-..." : "AIza..."}
                      value={apiKey}
                      onChange={e => { setApiKey(e.target.value); localStorage.setItem("brief_apikey", e.target.value); }}
                    />
                  </div>
                  <div style={{ fontSize: 10, color: "var(--tx3)", marginBottom: 16, lineHeight: 1.5 }}>
                    🔒 A chave é salva apenas no seu navegador (localStorage). Nunca é enviada ao servidor ou ao Firestore.
                  </div>
                </>
              )}

              <div style={{ display: "flex", gap: 9 }}>
                <button className="btn btn-cy" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setShowApiSettings(false); setSel(null); setBrief(null); genBrief(); }}>
                  ✦ Salvar e Gerar Briefing
                </button>
                <button className="btn btn-gh" style={{ flex: 1, justifyContent: "center" }} onClick={() => setShowApiSettings(false)}>Fechar</button>
              </div>
            </div>
          </div>
        )}

        {/* PRIMEIRO ACESSO — troca de senha obrigatória */}
        {showChangePwd && session && (
          <div className="fl-overlay">
            <div className="fl-card">
              <div className="auth-logo"><Logo height={32} /></div>
              <div className="fl-title">Bem-vindo, {session.name.split(" ")[0]}!</div>
              <div className="fl-sub">Por segurança, defina uma senha pessoal antes de continuar. Você não poderá usar a senha temporária fornecida pelo administrador.</div>
              {pwdErr && <div className="auth-err">{pwdErr}</div>}
              <div className="fl"><label>Senha Temporária (atual)</label><input className="fi" type="password" placeholder="••••••••" value={pwdForm.current} onChange={e => { setPwdForm(p => ({ ...p, current: e.target.value })); setPwdErr(""); }} /></div>
              <div className="fl"><label>Nova Senha</label><input className="fi" type="password" placeholder="Mínimo 6 caracteres" value={pwdForm.next} onChange={e => { setPwdForm(p => ({ ...p, next: e.target.value })); setPwdErr(""); }} /></div>
              <div className="fl" style={{ marginBottom: 16 }}><label>Confirmar Nova Senha</label><input className="fi" type="password" placeholder="Repita a nova senha" value={pwdForm.confirm} onChange={e => { setPwdForm(p => ({ ...p, confirm: e.target.value })); setPwdErr(""); }} onKeyDown={e => e.key === "Enter" && doChangePwd(true)} /></div>
              <button className="btn btn-cy" style={{ width: "100%", justifyContent: "center" }} disabled={!pwdForm.current || !pwdForm.next || !pwdForm.confirm} onClick={() => doChangePwd(true)}>Definir Senha e Entrar</button>
            </div>
          </div>
        )}

        {/* MODAL PERFIL */}
        {showProfile && (
          <div className="mo" onClick={e => { if (e.target === e.currentTarget) { setShowProfile(false); setPwdErr(""); setPwdForm({ current: "", next: "", confirm: "" }); setPwdOk(false); } }}>
            <div className="mb" style={{ maxWidth: 400 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div className="mt" style={{ margin: 0 }}>👤 Meu Perfil</div>
                <button className="xbtn" onClick={() => { setShowProfile(false); setPwdErr(""); setPwdForm({ current: "", next: "", confirm: "" }); setPwdOk(false); }}>✕</button>
              </div>
              <div style={{ background: "var(--s2)", borderRadius: 8, padding: "12px 14px", marginBottom: 20, border: "1px solid var(--bd)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--tx)" }}>{session.name}</div>
                <div style={{ fontSize: 11, color: "var(--tx3)", marginTop: 2 }}>{session.email}</div>
                <span className={`rbadge ${ROLE_CLS[session.role] || "rb-viewer"}`} style={{ marginTop: 8, display: "inline-block" }}>{ROLE_LABEL[session.role] || session.role}</span>
              </div>
              <div className="pst" style={{ marginBottom: 12 }}>Alterar Senha</div>
              {pwdErr && <div className="auth-err">{pwdErr}</div>}
              {pwdOk && <div className="auth-ok">✓ Senha alterada com sucesso!</div>}
              <div className="fl"><label>Senha Atual</label><input className="fi" type="password" placeholder="••••••••" value={pwdForm.current} onChange={e => { setPwdForm(p => ({ ...p, current: e.target.value })); setPwdErr(""); }} /></div>
              <div className="fl"><label>Nova Senha</label><input className="fi" type="password" placeholder="Mínimo 6 caracteres" value={pwdForm.next} onChange={e => { setPwdForm(p => ({ ...p, next: e.target.value })); setPwdErr(""); }} /></div>
              <div className="fl" style={{ marginBottom: 16 }}><label>Confirmar Nova Senha</label><input className="fi" type="password" placeholder="Repita a nova senha" value={pwdForm.confirm} onChange={e => { setPwdForm(p => ({ ...p, confirm: e.target.value })); setPwdErr(""); }} onKeyDown={e => e.key === "Enter" && doChangePwd(false)} /></div>
              <button className="btn btn-cy" style={{ width: "100%", justifyContent: "center" }} disabled={!pwdForm.current || !pwdForm.next || !pwdForm.confirm} onClick={() => doChangePwd(false)}>Salvar Nova Senha</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
