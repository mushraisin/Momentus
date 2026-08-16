import { REPUTATION_CATEGORIES } from '../config/constants.js';
import { avatarUrl } from './oauth.js';
import { t, LANGS } from '../i18n/index.js';
import { PROVIDER_LABEL } from './providers.js';

/** Екранування — обовʼязково для будь-яких даних від користувачів. */
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const DISCORD_ICON = `<svg viewBox="0 0 127 96" aria-hidden="true"><path fill="currentColor" d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69Z"/></svg>`;

// ─────────────────────────────────────────────
//  CSS
// ─────────────────────────────────────────────
export const BASE_CSS = `
:root{
  --bg0:#05070d;--card:rgba(22,27,40,.72);--line:rgba(255,255,255,.08);
  --text:#eef2f9;--dim:#8e9bb3;--good:#43c47b;--mid:#e9b949;--bad:#ef5350;
  --accent:#6b7cff;--discord:#5865f2;
}
*{box-sizing:border-box}

/* ── Смуги прокрутки: тонкі, у кольорах сайту, замість системних ── */
*{scrollbar-width:thin;scrollbar-color:rgba(107,124,255,.45) transparent}
*::-webkit-scrollbar{width:10px;height:10px}
*::-webkit-scrollbar-track{background:transparent}
*::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:999px;
  border:3px solid transparent;background-clip:content-box;transition:background .25s}
*::-webkit-scrollbar-thumb:hover{background:rgba(107,124,255,.55);background-clip:content-box}
*::-webkit-scrollbar-corner{background:transparent}
body{margin:0;background:var(--bg0);color:var(--text);min-height:100vh;overflow-x:hidden;
  font:16px/1.6 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
@view-transition{navigation:auto}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes pop{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes letterIn{0%{opacity:0;transform:translateY(26px) rotate(-4deg);filter:blur(6px)}100%{opacity:1;transform:none;filter:none}}
@keyframes beat{0%,100%{transform:scale(1)}35%{transform:scale(1.32)}}
.rise{animation:fadeUp .55s cubic-bezier(.22,.9,.3,1) both}

/* ── Тло: дим + зірки ── */
.bg{position:fixed;inset:0;z-index:-1;overflow:hidden;background:var(--bg0)}
#fog{position:absolute;inset:-12%;width:124%;height:124%;filter:blur(34px);opacity:.62}
#stars{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated}

/* ── Каркас ── */
.wrap{max-width:1060px;margin:0 auto;padding:22px 18px 70px;position:relative}
.wrap.wide{max-width:1560px;padding-left:clamp(18px,3vw,44px);padding-right:clamp(18px,3vw,44px)}
.wrap.under-top{padding-top:26px}

/* ── Верхня смуга навігації ──
   Напівпрозоре скло на всю ширину: сторінка гортається під нею, тому фон
   і дим лишаються видимими, а кнопки завжди під рукою. */
.topbar{position:sticky;top:0;z-index:40;
  background:linear-gradient(180deg,rgba(9,12,20,.82),rgba(9,12,20,.58));
  backdrop-filter:blur(16px) saturate(140%);-webkit-backdrop-filter:blur(16px) saturate(140%);
  border-bottom:1px solid rgba(255,255,255,.07);transition:box-shadow .35s,background .35s}
.topbar.scrolled{background:linear-gradient(180deg,rgba(7,9,16,.92),rgba(7,9,16,.78));
  box-shadow:0 12px 34px rgba(0,0,0,.45)}
.topbar-in{max-width:1060px;margin:0 auto;padding:0 18px;min-height:64px;
  display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.topbar-in.wide{max-width:1560px;padding-left:clamp(18px,3vw,44px);padding-right:clamp(18px,3vw,44px)}
.topbar .brand{flex:none}
.topbar nav{padding:10px 0}
header{display:flex;align-items:center;gap:12px;padding:14px 0 26px;flex-wrap:wrap;animation:fadeIn .6s both}
.brand{font-size:18px;font-weight:800;display:flex;align-items:center;gap:9px}
.brand .dot{width:9px;height:9px;border-radius:2px;background:var(--accent);box-shadow:0 0 14px var(--accent)}
nav{display:flex;gap:8px;margin-left:auto;flex-wrap:wrap;align-items:center}
nav a{padding:8px 15px;border-radius:999px;background:rgba(255,255,255,.04);
  border:1px solid var(--line);font-size:14px;transition:.28s cubic-bezier(.22,.9,.3,1)}
nav a:hover{border-color:rgba(107,124,255,.55);background:rgba(107,124,255,.12);transform:translateY(-2px)}
nav a.active{border-color:rgba(107,124,255,.7);background:rgba(107,124,255,.18);
  box-shadow:0 0 0 3px rgba(107,124,255,.14)}
nav a:active{transform:scale(.96)}

/* ── Загальне шліфування ──
   Дрібниці, які видно не одразу, але без яких сайт «сирий»:
   однакове кільце фокуса з клавіатури, свій колір виділення тексту,
   плавне гортання й повага до системного «менше руху». */
:focus{outline:0}
:focus-visible{outline:2px solid rgba(107,124,255,.85);outline-offset:2px;border-radius:8px}
::selection{background:rgba(107,124,255,.35);color:#fff}
html{scroll-behavior:smooth}
img,video{-webkit-user-drag:none}
button,a{-webkit-tap-highlight-color:transparent}
/* довгі слова й посилання не розпирають картки */
.card,.pane,.item .cap,.lreason{overflow-wrap:anywhere}
@media(prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;
    transition-duration:.01ms!important;scroll-behavior:auto!important}
}
/* службова кнопка (модерація) — окремо від основних, із розділювачем */
nav a.apart{margin-left:10px;padding-left:15px;border-color:rgba(239,83,80,.35);
  background:rgba(239,83,80,.1);position:relative}
nav a.apart::before{content:'';position:absolute;left:-6px;top:50%;transform:translateY(-50%);
  width:1px;height:18px;background:var(--line)}
nav a.apart:hover{border-color:rgba(239,83,80,.65);background:rgba(239,83,80,.2)}
nav a.apart.active{border-color:rgba(239,83,80,.8);background:rgba(239,83,80,.26)}

/* сітка панелі модерації: журналу потрібно більше місця, ніж решті */
.modgrid{margin-top:0}
.modgrid .log{max-height:460px}
.modgrid .viewers{max-height:460px}
.modgrid .journalbox{grid-column:span 2}
@media(max-width:820px){.modgrid .journalbox{grid-column:span 1}}

/* ── Спадне меню в стилі сайту (замість нативного select) ── */
.drop{position:relative}
.drop summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;
  padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.05);
  border:1px solid var(--line);font-size:14px;transition:.25s}
.drop summary::-webkit-details-marker{display:none}
.drop summary:hover{border-color:rgba(107,124,255,.55)}
.drop[open] summary{border-color:rgba(107,124,255,.65);background:rgba(107,124,255,.12)}
.drop-l{color:var(--dim);font-size:13px}
.drop-v{margin-left:auto;font-weight:600}
.drop .chev{margin-left:0}
/* Картки мають backdrop-filter, а це власний контекст накладання: z-index
   меню всередині картки не підніме його над сусідньою карткою. Тому підіймаємо
   саму картку, поки в ній щось розкрито. Стосується всіх спадних меню й пікерів. */
.card:has(.drop[open]),.card:has(.pick-menu:not([hidden])),.pane:has(.drop[open]){
  position:relative;z-index:40}
.drop-menu{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:30;padding:6px;
  border-radius:12px;background:rgba(14,18,30,.98);border:1px solid var(--line);
  box-shadow:0 16px 40px rgba(0,0,0,.55);display:flex;flex-direction:column;gap:2px;
  max-height:260px;overflow:auto;animation:menuIn .2s cubic-bezier(.22,.9,.3,1) both}
.drop-opt{padding:9px 11px;border:0;border-radius:9px;background:0;color:var(--text);
  font:inherit;font-size:13px;text-align:left;cursor:pointer;transition:.16s}
.drop-opt:hover{background:rgba(107,124,255,.16)}
/* обраний пункт — у спільному блоці «обрано / натиснуто» */

/* ── Вибір учасника з пошуком ── */
.picker{position:relative}
.pick-btn{width:100%;display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:12px;
  background:rgba(255,255,255,.05);border:1px solid var(--line);color:var(--text);
  font:inherit;font-size:14px;cursor:pointer;transition:.25s}
.pick-btn:hover{border-color:rgba(107,124,255,.55)}
.pick-face{width:26px;height:26px;flex:none;border-radius:50%;background:rgba(255,255,255,.08)
  center/cover no-repeat;border:1px solid var(--line)}
.pick-face.on{border-color:rgba(107,124,255,.6)}
.pick-menu{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:31;padding:8px;
  border-radius:14px;background:rgba(14,18,30,.98);border:1px solid var(--line);
  box-shadow:0 18px 44px rgba(0,0,0,.6);animation:menuIn .2s cubic-bezier(.22,.9,.3,1) both}
.pick-menu[hidden]{display:none}
.pick-search{width:100%;padding:9px 12px;border-radius:10px;margin-bottom:6px;
  background:rgba(255,255,255,.06);border:1px solid var(--line);color:var(--text);font:inherit;font-size:13px}
.pick-list{display:flex;flex-direction:column;gap:2px;max-height:240px;overflow:auto}
.pick-row{display:flex;align-items:center;gap:10px;padding:7px 9px;border:0;border-radius:10px;
  background:0;color:var(--text);font:inherit;font-size:13px;text-align:left;cursor:pointer;transition:.16s}
.pick-row:hover{background:rgba(107,124,255,.16)}
.pick-row img{width:24px;height:24px;border-radius:50%;flex:none}
/* ── Спільна мова «обрано / натиснуто» ──
   Один вигляд для всього сайту: акцентна заливка, світла рамка, кільце
   й позначка «✓». Клас .pick ставимо будь-якій кнопці-перемикачу,
   а .on означає «обрано». Розмір при виборі не змінюється — місце
   під «✓» зарезервоване, тож нічого не стрибає. */
.pick-el{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:6px;
  min-width:0;white-space:nowrap;font-weight:600;transition:.2s cubic-bezier(.22,.9,.3,1)}
.pick-el::after{content:'✓';font-size:12px;opacity:0;transition:.2s}
.pick-el.on{background:linear-gradient(180deg,#7d8bff,#5b6bf0);
  border-color:rgba(255,255,255,.35);color:#fff;
  box-shadow:0 0 0 3px rgba(107,124,255,.22),0 8px 20px rgba(107,124,255,.3)}
.pick-el.on::after{opacity:.9}
.pick-el:not(.on){opacity:.72}
.pick-el:not(.on):hover{opacity:1;transform:translateY(-1px)}
.pick-el:active{transform:scale(.96)}

/* Колонок стільки, скільки влізе: назви покарань довгі («голосовий мут»),
   тож комірка не вужча за напис, а сам напис при потребі переходить на
   другий рядок — обрізати текст у кнопці не можна. */
.kindrow{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}
.up .kindbtn{display:flex;min-height:44px;padding:8px 12px;white-space:normal}
.up .kindbtn .kl{white-space:normal;text-align:center;line-height:1.2;
  hyphens:auto;overflow-wrap:anywhere}
@media(max-width:420px){.kindrow{grid-template-columns:1fr}}

/* Ті самі правила — для вкладок, мов, варіантів у меню й якості відео,
   щоб «обране» скрізь читалося однаково. */
.tabs a.on,.langmenu a.on,.drop-opt.on,.qopt.on{
  background:linear-gradient(180deg,#7d8bff,#5b6bf0);border-color:rgba(255,255,255,.35);color:#fff;
  box-shadow:0 0 0 3px rgba(107,124,255,.18)}
.tabs a.on{box-shadow:0 0 0 3px rgba(107,124,255,.18),0 8px 20px rgba(107,124,255,.28)}
.drop-opt,.qopt,.langmenu a,.pick-row{position:relative;padding-right:26px}
.drop-opt::after,.qopt::after,.langmenu a::after{content:'✓';position:absolute;right:10px;
  font-size:11px;opacity:0;transition:.2s}
.drop-opt.on::after,.qopt.on::after,.langmenu a.on::after{opacity:.95}

/* Натискання відчутне скрізь однаково */
.tabs a:active,.drop-opt:active,.qopt:active,.pick-row:active,.like:active,
.lbnav:active,.lbclose:active,.gbtn:active,.dbtn:active,.langmenu a:active{
  transform:scale(.96)}

/* Поле для свого терміну — той самий стиль, що й решта полів вводу.
   Стрілки-«крутилки» браузера прибираємо: вони псують вигляд. */
.custom-dur{align-items:center}
.custom-dur input[type=number]{flex:1 1 90px;min-width:0;-moz-appearance:textfield;appearance:textfield}
.custom-dur input[type=number]::-webkit-outer-spin-button,
.custom-dur input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.custom-dur .drop{flex:1 1 120px}
/* атрибут hidden має перемагати будь-який display із класу */
[hidden]{display:none!important}

/* Будь-яка кнопка помітно «продавлюється» — стає ясно, що клік зарахований */
.btn:active:not(:disabled),.act:active:not(:disabled),.kindbtn:active{transform:scale(.96)}
.btn.busy{position:relative;color:transparent}
.btn.busy::after{content:'';position:absolute;left:50%;top:50%;width:15px;height:15px;
  margin:-8px 0 0 -8px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;
  border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
/* короткий зелений спалах після вдалої дії */
.btn.done{background:linear-gradient(180deg,#4fd18b,#37b374)!important;color:#06210f!important}
.viewer .tagp{flex:none}
.langs{position:relative;margin-left:6px}
.langs summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;
  padding:8px 13px;border-radius:999px;background:rgba(255,255,255,.04);
  border:1px solid var(--line);font-size:13px;transition:.28s cubic-bezier(.22,.9,.3,1)}
.langs summary::-webkit-details-marker{display:none}
.langs summary:hover{border-color:rgba(107,124,255,.55);background:rgba(107,124,255,.12);transform:translateY(-2px)}
.langs summary b{font-weight:700;letter-spacing:.08em}
/* стрілка: повертається, коли меню відкрите */
.langs summary i{width:0;height:0;border:4px solid transparent;border-top-color:var(--dim);
  margin-top:3px;transition:transform .3s cubic-bezier(.22,.9,.3,1)}
.langs[open] summary{border-color:rgba(107,124,255,.65);background:rgba(107,124,255,.16)}
.langs[open] summary i{transform:rotate(180deg) translateY(3px)}
/* Меню має лягати поверх усього вмісту сторінки, а горизонтальний скрол
   меню на вузьких екранах не повинен його обрізати. */
.langs{z-index:45}
nav:has(.langs[open]){overflow:visible}
.langmenu{position:absolute;right:0;top:calc(100% + 8px);z-index:45;min-width:172px;padding:6px;
  border-radius:14px;background:rgba(14,18,30,.96);border:1px solid var(--line);
  box-shadow:0 18px 44px rgba(0,0,0,.55);backdrop-filter:blur(10px);
  display:flex;flex-direction:column;gap:2px;animation:menuIn .26s cubic-bezier(.22,.9,.3,1) both}
.langmenu a{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:10px;
  border:0;background:0;font-size:13px;transition:.2s}
.langmenu a:hover{background:rgba(107,124,255,.16);transform:none}
.langmenu a b{font-size:11px;font-weight:700;letter-spacing:.1em;color:var(--dim);min-width:22px}
.langmenu a span{color:var(--text)}
/* обрана мова — у спільному блоці «обрано / натиснуто» */
.langmenu a.on b{color:var(--accent)}
@keyframes menuIn{from{opacity:0;transform:translateY(-8px) scale(.97)}to{opacity:1;transform:none}}

.me{display:flex;align-items:center;gap:9px;padding:5px 6px 5px 5px;border-radius:999px;
  background:rgba(255,255,255,.05);border:1px solid var(--line);font-size:13px;animation:fadeIn .7s .2s both}
.me img{width:26px;height:26px;border-radius:50%;border:1px solid rgba(107,124,255,.6)}
.me span{max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* аватар і нік — це і є вхід у профіль */
.me-link{display:flex;align-items:center;gap:9px;padding:0;border:0;background:0;transition:.2s}
.me-link:hover{transform:none;background:0}
.me-link:hover img{border-color:rgba(107,124,255,1);box-shadow:0 0 0 3px rgba(107,124,255,.2)}
.me-link:hover span{color:#fff}
.me-out{padding:2px 7px;border-radius:999px;color:var(--dim);font-size:12px;border:0;background:0}
.me-out:hover{color:#fff;background:rgba(255,255,255,.08)}
.signed{display:flex;align-items:center;gap:8px;font-size:13px;color:#8fe08a;letter-spacing:.04em;
  animation:fadeIn .8s .35s both}

/* ── Головна ── */
.hero{position:relative;min-height:80vh;display:flex;flex-direction:column;align-items:flex-start;
  justify-content:center;text-align:left;gap:22px;padding-left:clamp(4px,5vw,88px);padding-top:6vh;max-width:780px}
.logo{margin:0;display:flex;flex-wrap:wrap;line-height:1;
  font-size:clamp(38px,8.4vw,96px);font-weight:800;letter-spacing:.03em;text-transform:uppercase}
.logo span{color:transparent;-webkit-text-stroke:1.6px rgba(255,255,255,.9);
  text-shadow:0 0 34px rgba(107,124,255,.45);animation:letterIn .75s cubic-bezier(.2,.85,.3,1) both;
  transition:color .35s ease,text-shadow .35s ease}
.logo:hover span{color:rgba(255,255,255,.96);text-shadow:0 0 46px rgba(107,124,255,.7)}
.hline{width:74px;height:2px;background:var(--accent);border-radius:2px;box-shadow:0 0 18px var(--accent);
  animation:grow .7s .45s cubic-bezier(.22,.9,.3,1) both;transform-origin:left}
.tag{color:var(--dim);font-size:clamp(13px,1.6vw,16px);letter-spacing:.38em;text-transform:uppercase;
  animation:fadeUp .8s .55s cubic-bezier(.22,.9,.3,1) both}
.cta{display:flex;gap:14px;flex-wrap:wrap;animation:pop .7s .65s cubic-bezier(.22,.9,.3,1) both}
.dbtn{display:inline-flex;align-items:center;gap:12px;padding:16px 30px;border-radius:14px;
  background:var(--discord);color:#fff;font-size:17px;font-weight:700;
  box-shadow:0 10px 30px rgba(88,101,242,.34);transition:.3s cubic-bezier(.22,.9,.3,1)}
.dbtn svg{width:25px;height:19px}
.dbtn:hover{transform:translateY(-3px);background:#4752c4;box-shadow:0 16px 42px rgba(88,101,242,.55)}
.gbtn{display:inline-flex;align-items:center;gap:10px;padding:16px 30px;border-radius:14px;
  background:rgba(255,255,255,.06);border:1px solid var(--line);font-size:17px;font-weight:700;
  transition:.3s cubic-bezier(.22,.9,.3,1)}
.gbtn:hover{transform:translateY(-3px);border-color:rgba(107,124,255,.6);background:rgba(107,124,255,.14)}
/* службова кнопка поруч із чипом профілю — того ж розміру, іншого відтінку */
.me.modchip{border-color:rgba(239,83,80,.35);background:rgba(239,83,80,.1);
  padding:5px 13px 5px 11px;transition:.28s cubic-bezier(.22,.9,.3,1)}
.me.modchip:hover{border-color:rgba(239,83,80,.65);background:rgba(239,83,80,.2);transform:translateY(-2px)}
.me.modchip .mi{font-size:14px;line-height:1}

/* ── Картки ── */
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:22px;margin:16px 0;
  backdrop-filter:blur(14px);transition:.35s cubic-bezier(.22,.9,.3,1)}
.row{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.avatar{width:76px;height:76px;border-radius:50%;border:3px solid var(--accent);animation:pop .6s both}
.name{font-size:25px;font-weight:800}
.pill{display:inline-block;padding:4px 13px;border-radius:999px;font-size:13px;font-weight:700;
  background:rgba(107,124,255,.16);border:1px solid rgba(107,124,255,.45)}
.score{margin-left:auto;text-align:center}
.score b{display:block;font-size:38px;line-height:1;color:#fff}
.score span{font-size:11px;color:var(--dim);letter-spacing:.14em}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:18px}
.tile{background:rgba(255,255,255,.035);border:1px solid var(--line);border-radius:14px;padding:15px;
  transition:.3s;animation:fadeUp .5s both}
.tile:hover{background:rgba(107,124,255,.1);transform:translateY(-3px)}
.tile b{display:block;font-size:25px;font-weight:800}
.tile span{font-size:13px;color:var(--dim)}
.bar{height:10px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden}
.bar>i{display:block;height:100%;border-radius:999px;transform-origin:left;animation:grow .9s cubic-bezier(.22,.9,.3,1) both}
.cat{display:grid;grid-template-columns:190px 1fr 48px;gap:15px;align-items:center;padding:10px 0;animation:fadeUp .5s both}
.cat .val{text-align:right;color:var(--dim);font-weight:700}
table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:12px 8px;border-bottom:1px solid var(--line);font-size:15px}
th{color:var(--dim);font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.08em}
tbody tr{transition:.25s;animation:fadeUp .45s both}
tbody tr:hover{background:rgba(107,124,255,.08)}
td.rank{width:56px;color:var(--dim);font-weight:800}
td.num{text-align:right;font-weight:800}
.mini{width:28px;height:28px;border-radius:50%;vertical-align:middle;margin-right:10px}

/* ── Галерея ── */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:16px}
.item{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden;
  animation:fadeUp .5s both;transition:.35s cubic-bezier(.22,.9,.3,1)}
.item:hover{transform:translateY(-4px);border-color:rgba(107,124,255,.35)}
.item .media{width:100%;aspect-ratio:1/1;object-fit:cover;display:block;background:#0b0e16;cursor:zoom-in}
.item video.media{cursor:zoom-in;pointer-events:none}
.spot-m{cursor:zoom-in}
.spot-m video.media{pointer-events:none}
/* натяк, що плитку можна розгорнути */
.item .shot::after{content:'⤢';position:absolute;right:10px;bottom:10px;width:28px;height:28px;
  display:flex;align-items:center;justify-content:center;border-radius:9px;font-size:13px;
  color:#fff;background:rgba(8,11,19,.7);border:1px solid rgba(255,255,255,.14);
  opacity:0;transform:translateY(4px);transition:.25s;pointer-events:none}
.item:hover .shot::after{opacity:1;transform:none}
.item .meta{padding:12px 14px}
.item .cap{font-size:14px;margin-bottom:8px;word-break:break-word}
.item .who{font-size:12px;color:var(--dim);display:flex;align-items:center;gap:7px}
.item .who img{width:20px;height:20px;border-radius:50%}
.item .who a{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px}

/* ── Розкладка галереї: сітка на всю ширину + бічна панель ── */
.glayout{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:22px;align-items:start}
.gside{position:sticky;top:18px;display:flex;flex-direction:column;gap:16px}
.pane{padding:18px;transition:border-color .3s}
.pane:hover{border-color:rgba(255,255,255,.14)}
.pane-h{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;
  color:var(--dim);margin-bottom:13px;padding-bottom:11px;border-bottom:1px solid var(--line)}
.pane-h b{color:var(--text);font-variant-numeric:tabular-nums}
.signin{display:flex;flex-direction:column;gap:12px;align-items:flex-start}
/* галерея з Discord-каналу: пояснення замість форми завантаження */
.fromch{display:flex;align-items:center;gap:14px}
.fromch-i{width:44px;height:44px;flex:none;display:flex;align-items:center;justify-content:center;
  border-radius:13px;background:rgba(88,101,242,.16);border:1px solid rgba(88,101,242,.35);font-size:20px}
.fromch-t{font-weight:700;margin-bottom:3px}
/* підказка про канал іде під формою, відокремлена лінією */
.chline{margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;text-align:center}
.stat b{display:block;font-size:22px;font-weight:800}
.stat span{font-size:11px;color:var(--dim);letter-spacing:.06em;text-transform:uppercase}
.cinelink{display:flex;align-items:center;justify-content:space-between;gap:10px;
  transition:.3s cubic-bezier(.22,.9,.3,1)}
.cinelink:hover{transform:translateY(-3px);border-color:rgba(107,124,255,.5)}
.cinelink span{color:var(--dim);font-size:13px}
.grid.wide{grid-template-columns:repeat(auto-fill,minmax(232px,1fr));gap:18px}
.item .shot{position:relative;overflow:hidden}
.item.tall .media{aspect-ratio:3/4}
.item .badge{position:absolute;left:10px;top:10px;padding:3px 9px;border-radius:999px;font-size:11px;
  background:rgba(5,7,13,.66);border:1px solid var(--line);backdrop-filter:blur(6px);letter-spacing:.06em}
.item .when{font-size:11px;color:var(--dim);margin-top:9px;letter-spacing:.04em}
.item .media{transition:transform .6s cubic-bezier(.22,.9,.3,1)}
.item:hover .media{transform:scale(1.045)}

/* кнопки правки — проявляються на наведенні, щоб не шуміли */
.acts{position:absolute;right:9px;top:9px;display:flex;gap:6px;opacity:0;transform:translateY(-4px);
  transition:.25s;z-index:2}
.item:hover .acts,.spot:hover .acts,.acts:focus-within{opacity:1;transform:none}
.spot .acts{position:static;opacity:.55;transform:none;margin-left:auto}
.spot:hover .acts{opacity:1}
.act{width:30px;height:30px;border-radius:9px;border:1px solid var(--line);cursor:pointer;
  background:rgba(5,7,13,.72);color:var(--text);font-size:13px;backdrop-filter:blur(6px);transition:.22s}
.act:hover{border-color:rgba(107,124,255,.6);background:rgba(107,124,255,.2)}
.act.danger:hover{border-color:rgba(239,83,80,.7);background:rgba(239,83,80,.22)}

/* ── Кінотеатр ── */
/* Плеєр займає всю ширину, службові картки лягають під ним рядом */
.clayout{display:block}
/* Картки під плеєром тягнуться на однакову висоту — інакше низ виходить
   рваним. Форма ширша за решту, журнал завжди на всю ширину. */
.cpanels{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));
  gap:14px;align-items:stretch;margin-top:20px}
.cpanels .pane{margin:0;display:flex;flex-direction:column;min-height:150px}
.cpanels .addbox,.cpanels .queuebox{grid-column:span 2}
.cpanels .hist{grid-column:1/-1;min-height:0}
@media(max-width:820px){.cpanels .addbox,.cpanels .queuebox{grid-column:span 1}}

/* Форма додавання: поля поруч, а не стовпчиком на пів екрана */
.addbox .up{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:10px;align-content:start}
.addbox .up input:first-child{grid-column:1/-1}
.addbox .up .row{grid-column:1/-1;margin-top:2px}
@media(max-width:520px){.addbox .up{grid-template-columns:1fr}}

/* Порожні картки не мають виглядати зламаними */
.pane .muted{flex:1;display:flex;align-items:center;justify-content:center;
  text-align:center;font-size:13px;opacity:.7;padding:10px 0}
.log:empty::before,.queue:empty::before{content:'—';color:var(--dim)}
.room{position:relative;background:linear-gradient(180deg,rgba(26,31,46,.78),rgba(18,22,34,.72));
  border:1px solid var(--line);border-radius:22px;padding:16px;overflow:hidden;
  box-shadow:0 24px 70px rgba(0,0,0,.45)}
/* тонкий світлий кант зверху — картка перестає бути пласкою */
.room::after{content:'';position:absolute;left:16px;right:16px;top:0;height:1px;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.16),transparent);pointer-events:none}
.room-h{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}
.room-t{font-size:22px;font-weight:800;letter-spacing:-.01em;line-height:1.25;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.room-s{font-size:12px;color:var(--dim);letter-spacing:.1em;text-transform:uppercase;margin-top:5px}
/* помітний розʼїзд — краще показати чесно, ніж мовчки тягнути */
.room-s.warn{color:#f0cd7a}
.vc{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--dim);
  padding:7px 13px;border-radius:999px;background:rgba(255,255,255,.04);border:1px solid var(--line)}
.dotlive{width:8px;height:8px;border-radius:50%;background:var(--good);box-shadow:0 0 12px var(--good);
  animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
.room-id{min-width:0}
.room-meta{display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap}
.tagp{font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:3px 9px;border-radius:999px;
  border:1px solid var(--line);background:rgba(255,255,255,.05);color:var(--dim)}
.tagp.warn{border-color:rgba(233,185,73,.45);background:rgba(233,185,73,.14);color:#f0cd7a}
.note{margin-top:12px;padding:11px 14px;border-radius:12px;font-size:13px;color:#f0cd7a;
  background:rgba(233,185,73,.1);border:1px solid rgba(233,185,73,.3)}
.screen{position:relative;border-radius:16px;overflow:hidden;background:#000;aspect-ratio:16/9;
  display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.07);
  box-shadow:0 0 0 1px rgba(0,0,0,.5) inset,0 18px 60px rgba(107,124,255,.10)}
/* будь-який плеєр — відео, iframe YouTube/Vimeo/сайту — тягнеться на всю сцену */
.screen .cin-media,.screen video,.screen iframe{position:absolute;inset:0;width:100%;height:100%;
  border:0;object-fit:contain;background:#04060b;display:block}
input.bad{border-color:rgba(239,83,80,.75);animation:shake .35s}
@keyframes shake{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
.btn.busy{opacity:.6;pointer-events:none}
.screen.idle{background:repeating-linear-gradient(45deg,#080b13,#080b13 12px,#0a0e18 12px,#0a0e18 24px)}
.idle-t{color:var(--dim);font-size:14px;letter-spacing:.1em;text-transform:uppercase}
/* панель керування залу — окремий клас, бо .bar уже зайнятий прогрес-барами профілю */
.cbar{display:flex;align-items:center;gap:12px;margin-top:14px;flex-wrap:wrap;
  padding:10px 12px;border-radius:16px;background:rgba(255,255,255,.03);
  border:1px solid rgba(255,255,255,.06)}
/* розділювач перед групою правих кнопок */
.cbar .vol{margin-left:6px;padding-left:14px;border-left:1px solid var(--line)}
.btn.play{width:46px;height:46px;padding:0;border-radius:50%;font-size:16px;flex:none;
  background:linear-gradient(180deg,#7d8bff,#5b6bf0);box-shadow:0 8px 22px rgba(107,124,255,.35)}
.btn.play:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 12px 28px rgba(107,124,255,.5)}
.btn.play:disabled{opacity:.4;cursor:not-allowed;transform:none;box-shadow:none}
.btn.ghost{background:rgba(255,255,255,.05);border:1px solid var(--line)}
/* Смуга тонка, але з високою зоною влучання — по ній зручно клікати */
.seek{position:relative;flex:1;min-width:180px;height:20px;display:flex;align-items:center;cursor:default}
.seek::before{content:'';position:absolute;left:0;right:0;height:5px;border-radius:999px;
  background:rgba(255,255,255,.1)}
.seek[data-admin="1"]{cursor:pointer}
.seek i{position:absolute;left:0;height:5px;width:0;border-radius:999px;
  background:linear-gradient(90deg,#6b7cff,#9b6bff);
  box-shadow:0 0 14px rgba(107,124,255,.55);transition:width .25s linear}
.seek b{position:absolute;top:50%;left:0;width:13px;height:13px;margin:-6.5px 0 0 -6.5px;border-radius:50%;
  background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.6);opacity:0;transform:scale(.6);
  transition:opacity .2s,transform .2s}
.seek[data-admin="1"]:hover b{opacity:1;transform:scale(1)}
.seek[data-admin="1"]:hover i{box-shadow:0 0 20px rgba(107,124,255,.8)}
.tm{font-size:13px;color:var(--dim);font-variant-numeric:tabular-nums}
.btn.icon{width:40px;height:40px;padding:0;flex:none;border-radius:12px;font-size:15px;
  background:rgba(255,255,255,.05);border:1px solid var(--line);color:var(--text)}
.btn.icon:hover{border-color:rgba(107,124,255,.55);background:rgba(107,124,255,.14)}
.btn.icon:disabled{opacity:.4;cursor:not-allowed;transform:none;box-shadow:none}
.btn.icon.on{background:rgba(107,124,255,.24);border-color:rgba(107,124,255,.65)}

/* ── Завіса на паузі: пояснює, що коїться, замість чорного екрана ── */
.stagewrap{position:relative;display:flex;flex-direction:column;min-height:0}
.stagewrap>.screen{flex:1 1 auto;min-height:0}
.curtain{position:absolute;inset:0;z-index:3;border-radius:14px;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:10px;text-align:center;padding:20px;
  background:rgba(4,6,11,.94);animation:fadeIn .25s both}
.curtain[hidden]{display:none}
.curtain-i{font-size:40px;opacity:.85}
.curtain-t{font-size:17px;font-weight:700;letter-spacing:.04em}
.curtain-h{font-size:13px;color:var(--dim);max-width:420px;line-height:1.5}

/* ── Повний екран ──
   Розмір задає сам браузер (елемент іде в top layer), тож нічого не позиціонуємо
   фіксовано — лише розкладаємо всередині. Правила для :fullscreen і
   :-webkit-full-screen мають бути окремими: невідомий селектор у списку
   змусив би браузер відкинути все правило. */
.room:fullscreen{border-radius:0;border:0;padding:0;background:#04060b;display:flex;flex-direction:column;
  width:100%;height:100%;position:relative}
.room:-webkit-full-screen{border-radius:0;border:0;padding:0;background:#04060b;display:flex;flex-direction:column;
  width:100%;height:100%;position:relative}
.room:fullscreen .room-h,.room:fullscreen .note{display:none}
.room:-webkit-full-screen .room-h,.room:-webkit-full-screen .note{display:none}
.room:fullscreen .stagewrap{flex:1 1 auto;min-height:0}
.room:-webkit-full-screen .stagewrap{flex:1 1 auto;min-height:0}
.room:fullscreen .screen{height:100%;width:100%;max-height:none;aspect-ratio:auto;border:0;border-radius:0}
.room:-webkit-full-screen .screen{height:100%;width:100%;max-height:none;aspect-ratio:auto;border:0;border-radius:0}
.room:fullscreen .curtain{border-radius:0}
.room:fullscreen .cbar{position:absolute;left:0;right:0;bottom:0;margin:0;padding:18px 24px 22px;
  background:linear-gradient(to top,rgba(3,5,10,.94),rgba(3,5,10,0));transition:opacity .35s,transform .35s}
.room:-webkit-full-screen .cbar{position:absolute;left:0;right:0;bottom:0;margin:0;padding:18px 24px 22px;
  background:linear-gradient(to top,rgba(3,5,10,.94),rgba(3,5,10,0));transition:opacity .35s,transform .35s}
.room:fullscreen .cbar{z-index:3}
.room:-webkit-full-screen .cbar{z-index:3}

/* ── Автоприховування панелі в повному екрані ── */
.wakezone{display:none}
/* і за псевдокласом, і за класом, який ставить JS — щоб працювало в будь-якому браузері */
.room:fullscreen .wakezone,.room:-webkit-full-screen .wakezone,.room.fs .wakezone{
  display:block;position:absolute;left:0;right:0;bottom:0;height:120px;z-index:2;
  pointer-events:none}
/* Смуга ловить мишу лише поки панель схована; щойно та зʼявилась —
   кліки знову проходять до плеєра. */
.room.fs.idlebar .wakezone{pointer-events:auto}
.room.fs.idlebar .cbar{opacity:0;transform:translateY(16px);pointer-events:none}
.room.fs.idlebar{cursor:none}

/* ── Гучність ── */
.vol{display:flex;align-items:center;gap:8px;flex:none}
.vol input[type=range]{width:96px;height:4px;-webkit-appearance:none;appearance:none;
  background:rgba(255,255,255,.16);border-radius:999px;outline:none;cursor:pointer}
.vol input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;
  border-radius:50%;background:#fff;box-shadow:0 0 10px rgba(107,124,255,.7);cursor:pointer}
.vol input[type=range]::-moz-range-thumb{width:13px;height:13px;border:0;border-radius:50%;background:#fff}
.btn.icon.flat{width:34px;height:34px;background:0;border:0;font-size:15px}
.btn.icon.flat:hover{background:rgba(255,255,255,.08)}

/* ── Якість ── */
.qual{position:relative;flex:none}
.qual[hidden]{display:none}
.qual summary{list-style:none;cursor:pointer;padding:8px 12px;border-radius:10px;font-size:12px;
  letter-spacing:.06em;background:rgba(255,255,255,.05);border:1px solid var(--line);transition:.25s}
.qual summary::-webkit-details-marker{display:none}
.qual summary:hover{border-color:rgba(107,124,255,.55)}
.qmenu{position:absolute;right:0;bottom:calc(100% + 8px);z-index:30;min-width:118px;padding:6px;
  border-radius:12px;background:rgba(14,18,30,.97);border:1px solid var(--line);
  box-shadow:0 16px 40px rgba(0,0,0,.55);display:flex;flex-direction:column;gap:2px;
  animation:menuIn .22s cubic-bezier(.22,.9,.3,1) both}
.qopt{padding:8px 11px;border:0;border-radius:8px;background:0;color:var(--text);font:inherit;
  font-size:13px;text-align:left;cursor:pointer;transition:.18s}
.qopt:hover{background:rgba(107,124,255,.16)}
/* обрана якість / озвучка — у спільному блоці «обрано / натиснуто» */

/* ── Вікно «зал зачинено» ── */
.clayout.blurred{filter:blur(3px);opacity:.5;pointer-events:none}
.gate-back{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;
  padding:24px;background:rgba(3,5,10,.72);backdrop-filter:blur(8px);animation:fadeIn .3s both}
.gate-back.hidden{display:none}
.gate-box{position:relative}
.gate-x{position:absolute;right:14px;top:12px;width:30px;height:30px;border-radius:9px;cursor:pointer;
  background:0;border:0;color:var(--dim);font-size:20px;line-height:1;transition:.2s}
.gate-x:hover{background:rgba(255,255,255,.08);color:#fff}
.gate-box{max-width:430px;width:100%;padding:34px 30px;border-radius:22px;text-align:center;
  background:var(--card);border:1px solid var(--line);box-shadow:0 30px 80px rgba(0,0,0,.6);
  animation:pop .45s cubic-bezier(.22,.9,.3,1) both}
.gate-box h2{margin:0 0 10px;font-size:22px}
.gate-box p{margin:0 0 18px;color:var(--dim);line-height:1.55}
.gate-ico{font-size:46px;margin-bottom:12px;animation:fadeUp .6s .1s both}
.gate-vc{display:inline-flex;align-items:center;gap:9px;padding:8px 15px;border-radius:999px;
  font-size:13px;background:rgba(255,255,255,.05);border:1px solid var(--line);margin-bottom:18px}
.gate-wait{display:flex;align-items:center;justify-content:center;gap:7px;font-size:13px;
  color:var(--dim);margin:6px 0 16px}
.gate-wait i{width:6px;height:6px;border-radius:50%;background:var(--accent);animation:pulse 1.4s infinite}
.gate-wait i:nth-child(2){animation-delay:.2s}
.gate-wait i:nth-child(3){animation-delay:.4s;margin-right:5px}
.note.good{color:#8fe08a;background:rgba(67,196,123,.1);border-color:rgba(67,196,123,.3)}

/* ── Черга ── */
.queue{display:flex;flex-direction:column;gap:7px;max-height:300px;overflow:auto}
.qitem{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:12px;
  background:rgba(255,255,255,.035);border:1px solid var(--line);animation:fadeUp .35s both;
  transition:border-color .25s,background .25s,transform .25s}
.qitem:hover{border-color:rgba(107,124,255,.4);background:rgba(107,124,255,.07);transform:translateX(2px)}
.qn{width:22px;height:22px;flex:none;display:flex;align-items:center;justify-content:center;
  border-radius:50%;background:rgba(255,255,255,.06);font-size:11px;color:var(--dim);font-weight:700}
.qitem:first-child .qn{background:rgba(107,124,255,.25);color:#fff}
/* Назва завжди має пріоритет: на вузькій картці кнопки переносяться нижче,
   а не з'їдають підпис до трьох літер. */
.qitem{flex-wrap:wrap}
.qbody{min-width:0;flex:1 1 150px}
.qitem .act{margin-left:0}
.qt{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.qa{font-size:11px;color:var(--dim);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.qitem .act{width:26px;height:26px;font-size:11px;border-radius:8px;opacity:.6}
.qitem:hover .act{opacity:1}
.pane-h .act{width:24px;height:24px;font-size:11px;margin-left:auto;border-radius:7px}
.pane-h{display:flex;align-items:center;gap:8px}
.viewer .act{width:26px;height:26px;font-size:11px;opacity:.45}
.viewer .act.ctl{margin-left:auto}
.viewer:hover .act{opacity:1}
.act.grant.on{background:rgba(107,124,255,.25);border-color:rgba(107,124,255,.6)}
/* право паузи ввімкнене — зелене; забране — приглушене */
.act.ctl.on{background:rgba(67,196,123,.22);border-color:rgba(67,196,123,.55);opacity:.85}
.viewer:hover .act.ctl.on{opacity:1}
.act.ctl:not(.on){opacity:.35;text-decoration:line-through}

/* ── Журнал і блокування ── */
.hist{padding:16px 18px}
.hist summary{cursor:pointer;list-style:none;margin:0;border-bottom:0;padding-bottom:0;
  display:flex;align-items:center;gap:8px;transition:color .2s}
.hist summary:hover{color:var(--text)}
.hist summary::-webkit-details-marker{display:none}
.hist[open] summary{margin-bottom:14px;padding-bottom:11px;border-bottom:1px solid var(--line)}
/* стрілка розкриття праворуч */
.chev{margin-left:auto;width:0;height:0;border:5px solid transparent;border-top-color:var(--dim);
  margin-top:4px;transition:transform .3s cubic-bezier(.22,.9,.3,1)}
.hist[open] .chev{transform:rotate(180deg) translateY(4px)}
.log{display:flex;flex-direction:column;gap:6px;max-height:340px;overflow:auto;font-size:12px;
  padding-right:4px}
.logrow{display:flex;align-items:flex-start;gap:9px;padding:8px 10px;border-radius:10px;
  background:rgba(255,255,255,.03);transition:background .2s}
.logrow:hover{background:rgba(255,255,255,.06)}
.li{flex:none;width:18px;text-align:center;font-size:13px;line-height:1.5}
.lmain{min-width:0;flex:1}
.ltop{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.lu{font-weight:600;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.la{color:var(--dim);white-space:nowrap}
.lchip{padding:1px 7px;border-radius:999px;background:rgba(107,124,255,.16);
  border:1px solid rgba(107,124,255,.3);font-size:11px;white-space:nowrap}
.lreason{color:var(--text);opacity:.8;margin-top:3px;line-height:1.4;
  overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.lsub{display:flex;align-items:center;gap:8px;margin-top:4px;color:var(--dim);font-size:11px}
.lt{margin-left:auto;font-variant-numeric:tabular-nums;flex:none}
.btn.sm{padding:8px 14px;font-size:13px}
.locked-now{margin-bottom:12px;padding:10px 13px;border-radius:11px;font-size:13px;color:#f0cd7a;
  background:rgba(233,185,73,.1);border:1px solid rgba(233,185,73,.3)}
.lock{opacity:.75}
.viewers{display:flex;flex-direction:column;gap:4px;max-height:340px;overflow:auto}
.viewer{display:flex;align-items:center;gap:9px;font-size:13px;padding:6px 7px;border-radius:10px;
  transition:background .2s;flex-wrap:wrap}
.viewer:hover{background:rgba(255,255,255,.04)}
/* імʼя стискається останнім і має розумну ширину, а не 88 пікселів */
.viewer .vname{flex:1 1 110px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.viewer>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.viewer .hint{flex:none;font-size:11px}
.viewer img{width:28px;height:28px;border-radius:50%;border:1px solid var(--line);
  box-shadow:0 0 0 2px rgba(107,124,255,.14)}
.gate{font-size:44px;margin-bottom:14px}
@media(max-width:980px){
  .glayout{grid-template-columns:1fr}
  .gside{position:static;order:-1}
}

/* ── Кліпи дня та місяця ── */
.spots{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin:22px 0}
.spot{position:relative;background:var(--card);border:1px solid var(--line);border-radius:20px;
  padding:16px;animation:fadeUp .6s both;transition:.4s cubic-bezier(.22,.9,.3,1);overflow:hidden}
.spot::before{content:'';position:absolute;inset:-1px;border-radius:20px;pointer-events:none;
  border:1px solid transparent;transition:.4s}
.spot:hover{transform:translateY(-4px)}
.spot:hover::before{border-color:rgba(107,124,255,.45);box-shadow:0 0 40px rgba(107,124,255,.14) inset}
.spot-h{display:flex;align-items:center;gap:9px;font-size:12px;font-weight:700;letter-spacing:.14em;
  text-transform:uppercase;color:var(--dim);margin-bottom:13px}
.spot-h i{font-style:normal;font-size:16px;color:var(--accent);text-shadow:0 0 14px var(--accent)}
.spot-m{border-radius:14px;overflow:hidden;background:#0b0e16}
.spot .media.big{width:100%;aspect-ratio:16/10;object-fit:cover;display:block;cursor:zoom-in;
  transition:transform .6s cubic-bezier(.22,.9,.3,1)}
.spot:hover .media.big{transform:scale(1.03)}
.spot-f{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-top:13px}
.spot-f .cap{font-size:15px;margin-bottom:7px;word-break:break-word}
.spot-f .who{font-size:12px;color:var(--dim);display:flex;align-items:center;gap:7px}
.spot-f .who img{width:20px;height:20px;border-radius:50%}
.spot-f .like{margin-top:0}
.spot.empty{display:flex;flex-direction:column;justify-content:flex-start;text-align:left;padding:16px}

/* ── Вкладки стрічки ── */
.tabs{display:flex;align-items:center;gap:8px;margin:0 0 16px;animation:fadeIn .6s .2s both}
.tabs .th{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;
  color:var(--dim);margin-right:6px}
.tabs a{padding:7px 15px;border-radius:999px;font-size:13px;border:1px solid var(--line);
  background:rgba(255,255,255,.04);transition:.28s cubic-bezier(.22,.9,.3,1)}
.tabs a:hover{transform:translateY(-2px);border-color:rgba(107,124,255,.5)}
/* вигляд обраної вкладки — у спільному блоці «обрано / натиснуто» вище */

.like{display:inline-flex;align-items:center;gap:7px;margin-top:10px;padding:6px 13px;border-radius:999px;
  background:rgba(255,255,255,.05);border:1px solid var(--line);cursor:pointer;font-size:14px;
  color:var(--text);transition:.25s;font-family:inherit}
.like:hover{border-color:rgba(239,83,80,.6);background:rgba(239,83,80,.12)}
.like.on{border-color:rgba(239,83,80,.75);background:rgba(239,83,80,.2);color:#ff8b88}
.like.on .h{animation:beat .45s}
.up{display:grid;gap:12px}
.up input[type=file],.up input[type=text],.up input[type=number]{width:100%;padding:12px 14px;
  border-radius:12px;background:rgba(255,255,255,.05);border:1px solid var(--line);
  color:var(--text);font:inherit;transition:.2s}
.up input[type=text]:focus,.up input[type=number]:focus{outline:0;border-color:rgba(107,124,255,.6);
  background:rgba(255,255,255,.07);box-shadow:0 0 0 3px rgba(107,124,255,.16)}
.up input::placeholder{color:var(--dim)}
.up input[type=file]::file-selector-button{margin-right:12px;padding:8px 14px;border-radius:8px;border:0;
  background:var(--accent);color:#fff;font:inherit;font-weight:600;cursor:pointer}
.btn{display:inline-block;padding:12px 22px;border-radius:12px;background:var(--accent);color:#fff;
  font-weight:700;border:0;font:inherit;cursor:pointer;transition:.3s}
.btn:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(107,124,255,.4)}
.hint{font-size:13px;color:var(--dim)}
.err{color:#ff9a97;font-size:14px}
.lightbox{position:fixed;inset:0;background:rgba(3,5,10,.92);display:none;align-items:center;
  justify-content:center;z-index:50;padding:24px;animation:fadeIn .25s both;backdrop-filter:blur(6px)}
.lightbox.on{display:flex}

/* ── Велике вікно публікації ──
   Медіа зверху, під ним підпис, автор і лайк; стрілками — сусідні публікації. */
/* Вікно завжди однакове — як у відеосервісів: чорна сцена сталої висоти,
   медіа вписується всередину, а під ним рядок із підписом, автором і лайком.
   Так вертикальне фото й широке відео виглядають однаково охайно. */
.lbox{--stage:62vh;--foot:72px;display:flex;flex-direction:column;width:min(1040px,94vw);
  height:calc(var(--stage) + var(--foot));box-sizing:border-box;
  border-radius:18px;overflow:hidden;background:var(--card);border:1px solid var(--line);
  box-shadow:0 30px 90px rgba(0,0,0,.6);animation:lbIn .28s cubic-bezier(.22,.9,.3,1) both}
@keyframes lbIn{from{opacity:0;transform:scale(.96) translateY(10px)}to{opacity:1;transform:none}}
.lbm{display:flex;align-items:center;justify-content:center;background:#04060c;
  height:var(--stage);flex:none;min-width:0;position:relative}
.lbm img,.lbm video{max-width:100%;max-height:100%;width:auto;height:auto;
  display:block;object-fit:contain}
.lbf{display:flex;align-items:center;gap:14px;padding:14px 18px;flex:none;
  height:var(--foot);box-sizing:border-box;
  border-top:1px solid var(--line);background:rgba(255,255,255,.02)}
.lbf .lbtxt{min-width:0;flex:1}
.lbf .cap{font-size:15px;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lbf .who{font-size:12px;color:var(--dim);display:flex;align-items:center;gap:7px}
.lbf .who img{width:20px;height:20px;border-radius:50%}
.lbf .who a{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px}
.lbf .when{font-size:11px;color:var(--dim);letter-spacing:.04em;flex:none}
@media(max-width:760px){.lbox{--stage:46vh;--foot:64px}.lbf{padding:10px 14px;gap:10px}}
.lbclose{position:absolute;right:18px;top:16px;z-index:2;width:38px;height:38px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;font-size:17px;cursor:pointer;
  color:var(--text);background:rgba(12,16,26,.8);border:1px solid var(--line);transition:.2s}
.lbclose:hover{background:rgba(107,124,255,.3);transform:rotate(90deg)}
.lbnav{position:absolute;top:50%;transform:translateY(-50%);z-index:2;width:46px;height:46px;
  border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;
  cursor:pointer;color:var(--text);background:rgba(12,16,26,.8);border:1px solid var(--line);
  transition:.2s;opacity:.75}
.lbnav:hover{opacity:1;background:rgba(107,124,255,.3)}
.lbnav[disabled]{opacity:.18;pointer-events:none}
.lbprev{left:18px}
.lbnext{right:18px}
.lbn{font-size:12px;color:var(--dim);flex:none;letter-spacing:.06em}
@media(max-width:640px){
  .lbnav{width:38px;height:38px;font-size:16px}
  .lbprev{left:6px}.lbnext{right:6px}
  .lbf{flex-wrap:wrap;gap:10px}
}

/* ── Посилання на репозиторій у куті ── */
.ghbar{position:fixed;right:16px;bottom:14px;z-index:35;display:flex;gap:8px}
.gh{width:36px;height:36px;
  display:flex;align-items:center;justify-content:center;border-radius:50%;
  color:var(--dim);background:rgba(255,255,255,.04);border:1px solid var(--line);
  backdrop-filter:blur(8px);opacity:.6;transition:.3s cubic-bezier(.22,.9,.3,1)}
.gh svg{width:17px;height:17px;display:block}
.gh:hover{opacity:1;color:#fff;transform:translateY(-2px);
  border-color:rgba(107,124,255,.55);background:rgba(107,124,255,.16)}
.gh:active{transform:scale(.94)}
@media(max-width:640px){.ghbar{right:12px;bottom:12px;gap:6px}.gh{width:32px;height:32px}}

.muted{color:var(--dim)}
.empty{padding:52px;text-align:center;color:var(--dim)}
footer{margin-top:34px;color:var(--dim);font-size:12px;text-align:center;opacity:.6}
/* На середніх екранах меню теж не має розповзатися на два ряди —
   краще один рядок із горизонтальним скролом. */
@media(max-width:900px){
  .topbar-in{flex-wrap:nowrap;gap:8px;min-height:58px}
  .topbar nav{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding:8px 0}
  .topbar nav::-webkit-scrollbar{display:none}
  .topbar nav a,.topbar .langs summary{flex:none;white-space:nowrap}
  .topbar .me span{max-width:96px}
}
@media(max-width:640px){
  .cat{grid-template-columns:126px 1fr 42px;gap:10px}
  .score{margin-left:0;width:100%;text-align:left}
  /* меню в один рядок із горизонтальним скролом — інакше шапка з'їдає пів екрана */
  header,.topbar-in{flex-wrap:nowrap;gap:8px}
  header{padding-bottom:18px}
  .topbar-in{min-height:56px;padding:0 14px}
  .wrap.under-top{padding-top:18px}
  .brand{flex:none;font-size:16px}
  nav{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-bottom:2px;-webkit-overflow-scrolling:touch}
  nav::-webkit-scrollbar{display:none}
  nav a,.langs summary{flex:none;white-space:nowrap;padding:7px 12px;font-size:13px}
  .me{flex:none}
  .me span{max-width:74px}
  .room{padding:13px}
  .cbar{gap:10px}
  .stats{gap:6px}
  .stat b{font-size:19px}
}
/* Екран великий, але не переростає вікно — керування має лишатись на видноті */
@media(min-width:981px){
  .screen{max-height:calc(100vh - 200px);min-height:440px}
  .wrap.wide{max-width:1720px}
}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

// ─────────────────────────────────────────────
//  Тло: дим (шумові текстури) + зірки
// ─────────────────────────────────────────────
const BG_JS = `
(function(){
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var R=function(a,b){return a+Math.random()*(b-a)};

  /* Верхня смуга темніє, щойно сторінку прокрутили — щоб кнопки не губились
     на світлих кадрах галереї. */
  var topbar=document.getElementById('topbar');
  if(topbar){
    var onScroll=function(){topbar.classList.toggle('scrolled',(scrollY||0)>8)};
    addEventListener('scroll',onScroll,{passive:true});onScroll();
  }

  /* ── Спадне меню мов: закриваємо кліком поза ним і по Esc ── */
  document.addEventListener('click',function(e){
    var d=document.querySelector('.langs[open]');
    if(d&&!d.contains(e.target))d.removeAttribute('open');
  });
  addEventListener('keydown',function(e){
    if(e.key==='Escape'){var d=document.querySelector('.langs[open]');if(d)d.removeAttribute('open')}
  });

  /* ── ДИМ: тайлінговий фрактальний шум, кілька шарів пливуть із різною швидкістю ── */
  var fc=document.getElementById('fog');
  if(fc){
    var fx=fc.getContext('2d'),fw,fh,layers=[];

    /* Хеш з лавинним ефектом. ВАЖЛИВО: множення лише через Math.imul —
       звичайне * виходить за межі точності double й ламає 32-бітну арифметику
       (розподіл вироджується в нулі, і дим стає невидимим). */
    function hash(x,y,s){
      var h=Math.imul(x,0x27d4eb2d)^Math.imul(y,0x165667b1)^Math.imul(s,0x9e3779b1);
      h^=h>>>15; h=Math.imul(h,0x2c1b3c6d);
      h^=h>>>12; h=Math.imul(h,0x297a2d39);
      h^=h>>>15;
      return (h>>>0)/4294967296;
    }
    /* значеннєвий шум із періодом G — краї тайла збігаються, тому повтор непомітний */
    function vn(u,v,G,s){
      var x=u*G,y=v*G,xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;
      var sx=xf*xf*(3-2*xf),sy=yf*yf*(3-2*yf);
      var x0=((xi%G)+G)%G,x1=(x0+1)%G,y0=((yi%G)+G)%G,y1=(y0+1)%G;
      var a=hash(x0,y0,s),b=hash(x1,y0,s),c=hash(x0,y1,s),d=hash(x1,y1,s);
      var t1=a+(b-a)*sx,t2=c+(d-c)*sx;
      return t1+(t2-t1)*sy;
    }
    function fbm(u,v,s){
      return vn(u,v,3,s)*.52+vn(u,v,6,s+7)*.26+vn(u,v,12,s+13)*.14+vn(u,v,24,s+19)*.08;
    }
    /* Спотворення координат іншим шумом (domain warping). Саме воно
       перетворює рівні «хмаринки» на витягнуті пасма, схожі на справжній дим. */
    function warped(u,v,s){
      var wx=fbm(u+.13,v+.71,s+101)-.5;
      var wy=fbm(u+.57,v+.29,s+211)-.5;
      return fbm(u+wx*.55,v+wy*.55,s);
    }
    /* текстура диму: щільні клуби + прозорі просвіти.
       Нормалізуємо за фактичним діапазоном шуму — інакше контраст «з'їдається»
       і замість клубів виходить рівна ледь помітна плівка. */
    function tile(N,tint,seed,gamma){
      var vals=new Float32Array(N*N),mn=1e9,mx=-1e9,i=0,x,y,v;
      for(y=0;y<N;y++)for(x=0;x<N;x++){
        v=warped(x/N,y/N,seed);vals[i++]=v;
        if(v<mn)mn=v; if(v>mx)mx=v;
      }
      var rng=(mx-mn)||1;
      var cv=document.createElement('canvas');cv.width=cv.height=N;
      var cx=cv.getContext('2d'),img=cx.createImageData(N,N),d=img.data,j=0;
      for(i=0;i<vals.length;i++){
        var k=(vals[i]-mn)/rng;          /* 0..1 по всьому діапазону */
        k=Math.pow(k,gamma);             /* контраст: рідкі щільні згустки */
        d[j++]=tint[0];d[j++]=tint[1];d[j++]=tint[2];d[j++]=k*255;
      }
      cx.putImageData(img,0,0);return cv;
    }

    function fogInit(){
      fw=fc.width=Math.max(220,Math.round(innerWidth/3));
      fh=fc.height=Math.max(160,Math.round(innerHeight/3));
      if(layers.length)return;
      /* Кожен шар не «летить», а кружляє замкнутою орбітою Ліссажу й повільно
         обертається — тому спільного напрямку немає взагалі, дим просто
         клубочиться на місці. ox/oy — радіуси орбіти, w1/w2 — її частоти,
         rot — швидкість обертання (у сусідніх шарів різні знаки). */
      layers=[
        {t:tile(256,[128,146,242],(Math.random()*9999)|0,2.4),sc:2.6,a:.26,pa:.06,
         ox:30,oy:22,w1:.048,w2:.036,rot:.008,ph:R(0,6.3)},
        {t:tile(256,[168,120,228],(Math.random()*9999)|0,2.8),sc:1.5,a:.16,pa:.045,
         ox:38,oy:29,w1:-.038,w2:.055,rot:-.012,ph:R(0,6.3)},
        {t:tile(192,[ 96,164,220],(Math.random()*9999)|0,3.2),sc:0.85,a:.09,pa:.03,
         ox:46,oy:35,w1:.064,w2:-.045,rot:.016,ph:R(0,6.3)}
      ];
    }
    /* Ледь помітний паралакс: дим відгукується на рух миші й тло перестає
       здаватися наклейкою. Плавно доганяємо ціль, без ривків. */
    var mx=0,my=0,tx=0,ty=0;
    if(!reduce)addEventListener('mousemove',function(e){
      tx=(e.clientX/innerWidth-.5)*14;
      ty=(e.clientY/innerHeight-.5)*10;
    },{passive:true});

    function fogDraw(ts){
      var s=reduce?0:ts*0.001,diag=Math.sqrt(fw*fw+fh*fh);
      mx+=(tx-mx)*.04;my+=(ty-my)*.04;
      fx.clearRect(0,0,fw,fh);
      fx.globalCompositeOperation='lighter';
      for(var i=0;i<layers.length;i++){
        var L=layers[i];
        /* дальні шари зміщуються менше — виходить відчуття глибини */
        var depth=(i+1)/layers.length;
        var ox=Math.sin(s*L.w1+L.ph)*L.ox+mx*depth;
        var oy=Math.cos(s*L.w2+L.ph*1.7)*L.oy+my*depth;
        fx.globalAlpha=Math.max(0,L.a+Math.sin(s*.09+L.ph)*L.pa);
        fx.save();
        fx.translate(fw/2,fh/2);
        fx.rotate(s*L.rot+L.ph*.1);
        fx.scale(L.sc,L.sc);
        fx.translate(ox,oy);
        fx.fillStyle=fx.createPattern(L.t,'repeat');
        /* після повороту треба перекрити діагональ, інакше вилізуть порожні кути */
        var R2=diag/L.sc;
        fx.fillRect(-R2,-R2,R2*2,R2*2);
        fx.restore();
      }
      /* мʼяка віньєтка: дим тримається країв і низу, центр лишається чистим,
         щоб текст сторінки читався */
      fx.globalCompositeOperation='destination-out';
      fx.globalAlpha=1;
      var g=fx.createRadialGradient(fw*.5,fh*.42,0,fw*.5,fh*.42,diag*.62);
      g.addColorStop(0,'rgba(0,0,0,.8)');
      g.addColorStop(.55,'rgba(0,0,0,.25)');
      g.addColorStop(1,'rgba(0,0,0,0)');
      fx.fillStyle=g;fx.fillRect(0,0,fw,fh);

      /* Приглушене світло згори-зліва: дим під ним трохи яскравіший, і сцена
         перестає бути пласкою. Множимо лише те, що вже намальовано. */
      fx.globalCompositeOperation='source-atop';
      var lg=fx.createRadialGradient(fw*.22,-fh*.1,0,fw*.22,-fh*.1,diag*.85);
      lg.addColorStop(0,'rgba(150,170,255,.22)');
      lg.addColorStop(.5,'rgba(120,110,210,.06)');
      lg.addColorStop(1,'rgba(0,0,0,0)');
      fx.fillStyle=lg;fx.fillRect(0,0,fw,fh);

      fx.globalCompositeOperation='source-over';
      if(!reduce)requestAnimationFrame(fogDraw);
    }
    fogInit();fogDraw(0);if(!reduce)requestAnimationFrame(fogDraw);
    var ft;addEventListener('resize',function(){clearTimeout(ft);ft=setTimeout(function(){fogInit();fogDraw(0)},220)});
  }

  /* ── ЗІРКИ: кожна живе власним циклом появи й згасання ── */
  var sc2=document.getElementById('stars');
  if(sc2){
    var sx=sc2.getContext('2d'),sw,sh,st;
    /* Кілька відтінків: живе небо не буває однаково білим. */
    var TINTS=['255,255,255','206,218,255','255,236,214','196,236,255'];
    function spawn(o,w,h,first){
      o.x=Math.random()*w;o.y=Math.random()*h;
      var r=Math.random();
      o.s=r<.5?2:(r<.85?3:4);          /* більші зірки */
      o.max=R(.4,1);
      o.tint=TINTS[(Math.random()*TINTS.length)|0];
      o.life=0;o.dur=R(2400,7200);
      o.delay=first?(Math.random()<.6?0:R(0,3000)):R(0,3500);
      return o;
    }

    /* Зрідка — падаюча зірка. Рідко настільки, щоб її поява була приємною
       несподіванкою, а не миготінням. */
    var shoot=null,shootAt=R(8000,20000);
    function shootStep(dt){
      if(reduce)return;
      if(!shoot){
        shootAt-=dt;
        if(shootAt>0)return;
        shootAt=R(25000,60000);
        var fromLeft=Math.random()<.5;
        shoot={
          x:fromLeft?R(0,sw*.4):R(sw*.6,sw),y:R(0,sh*.45),
          vx:(fromLeft?1:-1)*R(.35,.6),vy:R(.16,.28),life:0,dur:R(700,1100),
        };
        return;
      }
      shoot.life+=dt;
      if(shoot.life>=shoot.dur){shoot=null;return}
      var k=shoot.life/shoot.dur;
      var a=Math.sin(k*Math.PI)*.85;
      var x=shoot.x+shoot.vx*shoot.life,y=shoot.y+shoot.vy*shoot.life;
      var tail=Math.min(90,shoot.life*.22);
      var g=sx.createLinearGradient(x,y,x-shoot.vx*tail*3,y-shoot.vy*tail*3);
      g.addColorStop(0,'rgba(255,255,255,'+a.toFixed(3)+')');
      g.addColorStop(1,'rgba(255,255,255,0)');
      sx.strokeStyle=g;sx.lineWidth=2;sx.lineCap='round';
      sx.beginPath();sx.moveTo(x,y);
      sx.lineTo(x-shoot.vx*tail*3,y-shoot.vy*tail*3);sx.stroke();
    }
    function starInit(){
      sw=sc2.width=innerWidth;sh=sc2.height=innerHeight;
      var n=Math.min(300,Math.floor(sw*sh/5200));st=[];
      for(var i=0;i<n;i++){var o=spawn({},sw,sh,true);if(!o.delay)o.life=R(0,o.dur);st.push(o)}
    }
    var last=0;
    function starDraw(ts){
      var dt=last?Math.min(ts-last,60):16;last=ts;
      sx.clearRect(0,0,sw,sh);
      for(var i=0;i<st.length;i++){
        var o=st[i];
        if(o.delay>0){if(!reduce)o.delay-=dt;continue}
        if(!reduce)o.life+=dt;
        if(o.life>=o.dur){spawn(o,sw,sh);continue}
        var a=Math.sin(o.life/o.dur*Math.PI)*o.max;
        if(a<=.01)continue;
        sx.fillStyle='rgba('+o.tint+','+a.toFixed(3)+')';
        sx.fillRect(o.x|0,o.y|0,o.s,o.s);
        /* найбільші ледь світяться — так небо перестає бути «пікселями» */
        if(o.s>3&&a>.5){
          sx.fillStyle='rgba('+o.tint+','+(a*.16).toFixed(3)+')';
          sx.fillRect((o.x|0)-2,(o.y|0)-2,o.s+4,o.s+4);
        }
      }
      shootStep(dt);
      requestAnimationFrame(starDraw);
    }
    starInit();starDraw(0);requestAnimationFrame(starDraw);
    var stm;addEventListener('resize',function(){clearTimeout(stm);stm=setTimeout(function(){starInit();starDraw(0)},220)});
  }
})();
`;

/** Лайки та перегляд медіа у галереї. */
const GALLERY_JS = `
(function(){
  document.addEventListener('click',function(e){
    var b=e.target.closest('.like');
    if(b){
      e.preventDefault();
      var id=b.dataset.id;
      fetch('/api/like/'+id,{method:'POST'}).then(function(r){return r.json()}).then(function(j){
        if(j.error){location.href='/login?next='+encodeURIComponent(location.pathname+location.search);return}
        // той самий кліп може бути й у «кліпі дня», і у стрічці — оновлюємо всі копії
        var all=document.querySelectorAll('.like[data-id="'+id+'"]');
        for(var i=0;i<all.length;i++){
          all[i].classList.toggle('on',j.liked);
          all[i].querySelector('.n').textContent=j.likes;
        }
      }).catch(function(){});
      return;
    }
    /* ── адмінське редагування підпису ── */
    var ed=e.target.closest('.act-edit');
    if(ed){
      e.preventDefault();
      var card=ed.closest('.item,.spot'),cap=card.querySelector('.cap');
      var cur=cap?cap.textContent.trim():'';
      var next=prompt(ed.dataset.prompt||'',cur);
      if(next===null)return;
      fetch('/api/item/'+ed.dataset.id+'/title',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({title:next})
      }).then(function(r){return r.json()}).then(function(j){
        if(j.error)return;
        if(cap){cap.textContent=j.title}
        else if(j.title){
          var el=document.createElement('div');el.className='cap';el.textContent=j.title;
          card.querySelector('.meta,.spot-f').prepend(el);
        }
      }).catch(function(){});
      return;
    }
    var del=e.target.closest('.act-del');
    if(del){
      e.preventDefault();
      if(!confirm(del.dataset.confirm||'?'))return;
      fetch('/api/item/'+del.dataset.id+'/delete',{method:'POST'})
        .then(function(r){return r.json()}).then(function(j){
          if(j.error)return;
          var nodes=document.querySelectorAll('[data-item="'+del.dataset.id+'"]');
          for(var i=0;i<nodes.length;i++){
            nodes[i].style.transition='.35s';nodes[i].style.opacity=0;nodes[i].style.transform='scale(.94)';
          }
          setTimeout(function(){for(var i=0;i<nodes.length;i++)nodes[i].remove()},350);
        }).catch(function(){});
      return;
    }
    /* ── Велике вікно публікації ──
       Клік по картці відкриває її на весь екран; стрілками ходимо по стрічці. */
    var shot=e.target.closest('.shot,.spot-m');
    if(shot&&!e.target.closest('.acts,.like')){
      e.preventDefault();
      open(cards().indexOf(shot.closest('[data-item]')));
      return;
    }
    if(e.target.closest('.lbclose')){close();return}
    var nav=e.target.closest('.lbnav');
    if(nav){if(viewIdx>=0)open(viewIdx+(nav.classList.contains('lbnext')?1:-1));return}
    /* клік повз саме вікно — закриваємо */
    var box=document.getElementById('lb');
    if(box&&box.classList.contains('on')&&e.target.closest('#lb')&&!e.target.closest('.lbox')){close()}
  });

  /* Індекс відкритої публікації. Імʼя навмисно своє: у слухачі вище
     вже є локальна var cur, і вона перекрила б цю на весь слухач. */
  var viewIdx=-1;

  /** Усі публікації на сторінці по порядку, без повторів «кліпу дня».
      Беремо лише самі картки — усередині теж трапляється data-item (кнопки дій). */
  function cards(){
    var seen={},out=[];
    var all=document.querySelectorAll('.grid>[data-item],.spots>[data-item],.spots .spot[data-item]');
    for(var i=0;i<all.length;i++){
      var id=all[i].dataset.item;
      if(seen[id]||!all[i].querySelector('.media'))continue;
      seen[id]=1;out.push(all[i]);
    }
    return out;
  }

  function close(){
    var lb=document.getElementById('lb');
    if(!lb)return;
    lb.classList.remove('on');lb.innerHTML='';viewIdx=-1;
    document.body.style.overflow='';
  }

  function open(i){
    var list=cards(),lb=document.getElementById('lb');
    if(!lb||!list.length)return;
    /* i може прийти зіпсованим (−1 від indexOf, NaN від стрілки) — доводимо до межі */
    i=Number(i);
    if(!isFinite(i))return;
    if(i<0||i>=list.length)return;
    var card=list[i];
    if(!card)return;
    viewIdx=i;
    var src=card.querySelector('.media');
    if(!src)return;

    var big;
    if(src.tagName==='VIDEO'){
      big=document.createElement('video');
      big.src=src.currentSrc||src.src;big.controls=true;big.autoplay=true;big.playsInline=true;
    }else{
      big=document.createElement('img');
      big.src=src.dataset.full||src.src;big.alt='';
    }

    var cap=card.querySelector('.cap'),who=card.querySelector('.who'),
        when=card.querySelector('.when'),like=card.querySelector('.like');

    var box=document.createElement('div');box.className='lbox';
    var media=document.createElement('div');media.className='lbm';media.appendChild(big);
    var foot=document.createElement('div');foot.className='lbf';
    var txt=document.createElement('div');txt.className='lbtxt';
    if(cap){var c=document.createElement('div');c.className='cap';c.textContent=cap.textContent;txt.appendChild(c)}
    if(who)txt.appendChild(who.cloneNode(true));
    foot.appendChild(txt);
    if(when){var w=document.createElement('div');w.className='when';w.textContent=when.textContent.trim();foot.appendChild(w)}
    /* лайк — жива копія: обробник вище оновлює всі кнопки з тим самим data-id */
    if(like)foot.appendChild(like.cloneNode(true));
    var n=document.createElement('div');n.className='lbn';n.textContent=(i+1)+' / '+list.length;
    foot.appendChild(n);
    box.appendChild(media);box.appendChild(foot);

    lb.innerHTML='';
    lb.appendChild(btn('lbnav lbprev','‹',i<=0));
    lb.appendChild(box);
    lb.appendChild(btn('lbnav lbnext','›',i>=list.length-1));
    lb.appendChild(btn('lbclose','✕',false));
    lb.classList.add('on');
    document.body.style.overflow='hidden';
  }

  function btn(cls,label,off){
    var b=document.createElement('button');
    b.className=cls;b.type='button';b.textContent=label;
    if(off)b.setAttribute('disabled','');
    return b;
  }

  addEventListener('keydown',function(e){
    var lb=document.getElementById('lb');
    if(!lb||!lb.classList.contains('on'))return;
    if(e.key==='Escape')close();
    else if(e.key==='ArrowRight')open(viewIdx+1);
    else if(e.key==='ArrowLeft')open(viewIdx-1);
  });
})();
`;

/**
 * Адаптери плеєрів: назовні — один інтерфейс (play/pause/seek/time/duration),
 * усередині — рідне відео, YouTube, Vimeo, HLS чи чужий сайт у рамці.
 * Завдяки цьому логіка синхронізації нижче однакова для всіх джерел.
 */
const PLAYERS_JS = `
window.CinemaPlayer=(function(){
  function loadScript(src){
    return new Promise(function(res,rej){
      if(document.querySelector('script[data-s="'+src+'"]'))return res();
      var s=document.createElement('script');s.src=src;s.async=true;s.dataset.s=src;
      s.onload=res;s.onerror=function(){rej(new Error('script'))};document.head.appendChild(s);
    });
  }

  /* ── Рідний <video>: файли з галереї, mp4/webm і HLS ── */
  function Native(box,cfg){
    var v=document.createElement('video');
    v.playsInline=true;v.preload='auto';v.className='cin-media';
    box.appendChild(v);
    var ready=Promise.resolve();

    var hls=null,levels=[];
    if(cfg.provider==='hls'&&!v.canPlayType('application/vnd.apple.mpegurl')){
      /* Safari грає HLS сам, решті потрібен hls.js */
      ready=loadScript('https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js').then(function(){
        if(!window.Hls||!window.Hls.isSupported()){v.src=cfg.src;return}
        hls=new window.Hls({lowLatencyMode:true});hls.loadSource(cfg.src);hls.attachMedia(v);
        hls.on(window.Hls.Events.MANIFEST_PARSED,function(){
          /* у стрімі якості приходять із маніфесту — віддаємо їх у меню */
          levels=(hls.levels||[]).map(function(l,i){return {label:(l.height||l.bitrate/1000|0)+(l.height?'p':'k'),index:i}});
          levels.sort(function(a,b){return parseInt(b.label)-parseInt(a.label)});
          if(cfg.onLevels)cfg.onLevels(levels);

          /* окремі аудіодоріжки — це і є озвучки всередині самого стріму */
          var tracks=(hls.audioTracks||[]).map(function(a,i){
            return {label:a.name||a.lang||('#'+(i+1)),index:i};
          });
          if(tracks.length>1&&cfg.onAudioTracks)cfg.onAudioTracks(tracks);
        });
      }).catch(function(){v.src=cfg.src});
    }else{ v.src=cfg.src }

    /* Не кожен HLS починає шкалу з нуля: у частини потоків currentTime стартує
       з великого числа (зсув медіа-послідовності). Тому і час, і перемотку
       рахуємо від початку доступного вікна, а не від абсолютного нуля —
       інакше кожен клієнт «стрибав» би у свій бік. */
    function base(){
      try{ if(v.seekable&&v.seekable.length)return v.seekable.start(0) }catch(e){}
      return 0;
    }

    return {
      kind:'native',el:v,ready:ready,
      play:function(){return v.play().catch(function(){})},
      pause:function(){v.pause()},
      seek:function(sec){v.currentTime=base()+sec},
      time:function(){return Math.max(0,(v.currentTime||0)-base())},
      duration:function(){
        if(v.seekable&&v.seekable.length)return v.seekable.end(v.seekable.length-1)-base();
        return isFinite(v.duration)?v.duration:0;
      },
      /* поки браузер добирає буфер, підганяти безглуздо — тільки зіпсуємо */
      buffering:function(){return v.readyState<3&&!v.paused},
      volume:function(x){v.muted=x<=0;v.volume=Math.max(0,Math.min(1,x))},
      getVolume:function(){return v.muted?0:v.volume},
      /* плавне підтягування: краще трохи змінити швидкість, ніж смикати позицію */
      rate:function(r){try{v.playbackRate=r}catch(e){}},
      /* рівень усередині HLS-стріму перемикається без перезавантаження */
      setLevel:function(i){if(hls)hls.currentLevel=i},
      setAudioTrack:function(i){if(hls)hls.audioTrack=i},
      onEnded:function(cb){v.addEventListener('ended',cb)},
      /* якості з плейлиста міняємо підміною джерела, зберігаючи позицію */
      setQuality:function(url){
        var at=v.currentTime,wasPlaying=!v.paused;
        v.src=url;v.load();
        v.addEventListener('loadedmetadata',function once(){
          v.removeEventListener('loadedmetadata',once);
          v.currentTime=at;if(wasPlaying)v.play().catch(function(){});
        });
      },
      onSeek:function(cb){v.addEventListener('seeking',function(){cb(Math.max(0,(v.currentTime||0)-base()))})}
    };
  }

  /* ── YouTube: керуємо через IFrame API, рідні контроли ховаємо ── */
  function YouTube(box,cfg){
    var host=document.createElement('div');host.id='yt-'+Date.now();box.appendChild(host);
    var player=null,onEnd=null;
    var ready=loadScript('https://www.youtube.com/iframe_api').then(function(){
      return new Promise(function(res){
        function boot(){
          player=new window.YT.Player(host.id,{
            videoId:cfg.src,
            playerVars:{controls:0,disablekb:1,modestbranding:1,rel:0,playsinline:1,fs:0},
            events:{
              onReady:function(){res()},
              onStateChange:function(e){
                /* 0 — відео скінчилось: сигналимо, щоб увімкнути наступне з черги */
                if(e.data===0&&onEnd)onEnd();
              }
            }
          });
        }
        if(window.YT&&window.YT.Player)boot();
        else window.onYouTubeIframeAPIReady=boot;
      });
    });
    return {
      kind:'yt',el:host,ready:ready,
      play:function(){player&&player.playVideo()},
      pause:function(){player&&player.pauseVideo()},
      seek:function(sec){player&&player.seekTo(sec,true)},
      time:function(){return player&&player.getCurrentTime?player.getCurrentTime()||0:0},
      duration:function(){return player&&player.getDuration?player.getDuration()||0:0},
      volume:function(x){if(!player)return;player.setVolume(Math.round(x*100));if(x<=0)player.mute();else player.unMute()},
      getVolume:function(){return player&&player.getVolume?player.getVolume()/100:1},
      rate:function(r){try{player&&player.setPlaybackRate(r)}catch(e){}},
      onEnded:function(cb){onEnd=cb},
      onSeek:function(){}
    };
  }

  /* ── Vimeo: офіційний player.js ── */
  function Vimeo(box,cfg){
    var f=document.createElement('iframe');
    f.src='https://player.vimeo.com/video/'+cfg.src+'?controls=0&transparent=0';
    f.allow='autoplay; fullscreen';f.className='cin-media';f.frameBorder='0';
    box.appendChild(f);
    var player=null,pos=0,dur=0,vol=1,onEnd=null;
    var ready=loadScript('https://player.vimeo.com/api/player.js').then(function(){
      player=new window.Vimeo.Player(f);
      player.on('timeupdate',function(d){pos=d.seconds;dur=d.duration});
      player.on('ended',function(){if(onEnd)onEnd()});
      return player.ready();
    });
    return {
      kind:'vimeo',el:f,ready:ready,
      play:function(){player&&player.play().catch(function(){})},
      pause:function(){player&&player.pause().catch(function(){})},
      seek:function(sec){player&&player.setCurrentTime(sec).catch(function(){})},
      time:function(){return pos},
      duration:function(){return dur},
      volume:function(x){vol=x;player&&player.setVolume(x).catch(function(){})},
      getVolume:function(){return vol},
      rate:function(r){player&&player.setPlaybackRate&&player.setPlaybackRate(r).catch(function(){})},
      onEnded:function(cb){onEnd=cb},
      onSeek:function(){}
    };
  }

  /* ── Чужий плеєр у рамці ──
     Керувати кросдоменним плеєром можна лише його ж мовою postMessage.
     Єдиного стандарту немає, тож говоримо всіма відомими діалектами одразу
     і слухаємо, хто відповість: Playerjs, Rutube, VK, Dailymotion та
     поширений формат {method:...}. Щойно приходить відповідь — вмикаємо
     повне керування; якщо мовчить, лишається спільним тільки момент запуску. */
  var DIALECTS=[
    {name:'playerjs',
     play:'{"api":"play"}',pause:'{"api":"pause"}',
     seek:function(s){return '{"api":"seek","seek":'+s+'}'},
     vol:function(v){return '{"api":"volume","volume":'+Math.round(v*100)+'}'},
     probe:'{"api":"time"}',
     read:function(d){
       if(typeof d!=='string')return null;
       try{var j=JSON.parse(d)}catch(e){return null}
       if(j&&(j.event||j.api))return{time:Number(j.time!==undefined?j.time:j.info)||null};
       return null;}},
    {name:'rutube',
     play:{type:'player:play',data:{}},pause:{type:'player:pause',data:{}},
     seek:function(s){return {type:'player:setCurrentTime',data:{time:s}}},
     vol:function(v){return {type:'player:setVolume',data:{volume:v}}},
     probe:{type:'player:getCurrentTime',data:{}},
     read:function(d){
       var j=d;if(typeof d==='string'){try{j=JSON.parse(d)}catch(e){return null}}
       if(j&&typeof j.type==='string'&&j.type.indexOf('player:')===0)
         return{time:j.data&&(j.data.time!==undefined?j.data.time:j.data.currentTime)};
       return null;}},
    {name:'generic',
     play:{method:'play'},pause:{method:'pause'},
     seek:function(s){return {method:'seek',value:s}},
     vol:function(v){return {method:'setVolume',value:v}},
     probe:{method:'getCurrentTime'},
     read:function(d){
       var j=d;if(typeof d==='string'){try{j=JSON.parse(d)}catch(e){return null}}
       if(j&&(j.method||j.event||j.type))return{time:Number(j.value||j.time||j.currentTime)||null};
       return null;}},
    {name:'dailymotion',
     play:'play',pause:'pause',
     seek:function(s){return 'seek?time='+s},
     vol:function(v){return 'volume?volume='+v},
     probe:'currentTime',
     read:function(d){
       if(typeof d!=='string'||d.indexOf('=')<0)return null;
       var m=d.match(/currentTime=([\\d.]+)/);return m?{time:Number(m[1])}:null;}},
    {name:'kodik',
     play:{key:'kodik_player_api',value:{method:'play'}},
     pause:{key:'kodik_player_api',value:{method:'pause'}},
     seek:function(s){return {key:'kodik_player_api',value:{method:'seek',seconds:s}}},
     vol:function(v){return {key:'kodik_player_api',value:{method:'volume',volume:v}}},
     probe:{key:'kodik_player_api',value:{method:'get_time'}},
     read:function(d){
       var j=d;if(typeof d==='string'){try{j=JSON.parse(d)}catch(e){return null}}
       if(j&&j.key&&String(j.key).indexOf('kodik')===0)return{time:j.value&&Number(j.value.time)};
       return null;}},
    {name:'plain',
     play:'play',pause:'pause',
     seek:function(s){return 'seek:'+s},
     vol:function(v){return 'volume:'+v},
     probe:'time',
     read:function(d){
       if(typeof d!=='string')return null;
       var m=d.match(/^time:([\\d.]+)$/);return m?{time:Number(m[1])}:null;}}
  ];

  /**
   * Час старту в посиланні. Коли плеєром керувати не вдається, ми знімаємо
   * і ставимо рамку заново — і хочемо, щоб вона починала з потрібної хвилини.
   */
  function withTime(src,provider,sec){
    var s=Math.max(0,Math.round(sec||0));
    if(!s)return src;
    try{
      var u=new URL(src,location.href);
      if(provider==='twitch'){u.searchParams.set('t',Math.floor(s/60)+'m'+(s%60)+'s');return u.toString()}
      if(/vimeo\\.com/i.test(u.hostname)){u.hash='t='+s+'s';return u.toString()}
      /* більшість плеєрів розуміють t / start / time */
      if(u.searchParams.has('start'))u.searchParams.set('start',s);
      else if(u.searchParams.has('time'))u.searchParams.set('time',s);
      else u.searchParams.set('t',s);
      return u.toString();
    }catch(e){return src}
  }

  function Frame(box,cfg){
    var speaks=null,pos=0,dur=0,vol=1,onTalk=null,f=null,mountedAt=0;

    function baseSrc(sec){
      var raw=cfg.provider==='twitch'
        ? 'https://player.twitch.tv/?'+cfg.src+'&parent='+cfg.host+'&autoplay=true'
        : cfg.src;
      return withTime(raw,cfg.provider,sec);
    }

    /* Ставимо рамку. Поки плеєр не відгукнувся, це і є наш «пуск». */
    function mount(sec){
      if(f)return;
      f=document.createElement('iframe');
      f.src=baseSrc(sec);
      f.allow='autoplay; fullscreen; encrypted-media; picture-in-picture';
      f.className='cin-media';f.frameBorder='0';
      box.appendChild(f);
      mountedAt=sec||0;
    }

    /* Знімаємо рамку — звук і картинка зупиняються миттєво й гарантовано,
       навіть коли плеєр не приймає жодних команд. Це наша «залізна» пауза. */
    function unmount(){
      if(!f)return;
      f.src='about:blank';
      f.remove();
      f=null;
    }

    mount(cfg.getPos?cfg.getPos():0);

    function send(msg){
      if(!f||!f.contentWindow)return;
      try{f.contentWindow.postMessage(typeof msg==='string'?msg:JSON.stringify(msg),'*')}catch(e){}
    }
    function say(key,arg){
      var list=speaks?[speaks]:DIALECTS;
      for(var i=0;i<list.length;i++){
        var d=list[i],m=d[key];
        send(typeof m==='function'?m(arg):m);
      }
    }

    addEventListener('message',function(e){
      if(!f||e.source!==f.contentWindow)return;
      for(var i=0;i<DIALECTS.length;i++){
        var got=DIALECTS[i].read(e.data);
        if(got){
          if(!speaks){speaks=DIALECTS[i];if(onTalk)onTalk(DIALECTS[i].name)}
          if(got.time>0)pos=got.time;
          return;
        }
      }
    });

    /* Промацуємо плеєр постійно, а не 12 разів: рамка може завантажитись
       пізно, а сайт — почати відповідати лише після першого кліку. */
    setInterval(function(){ if(!speaks&&f)say('probe') },1500);

    return {
      kind:'frame',ready:Promise.resolve(),
      get el(){return f},
      /* поки ніхто не відповів — точного часу немає, але пауза все одно працює */
      get limited(){return !speaks},
      /* «жорсткий» режим: пауза = зняти рамку, пуск = поставити заново */
      mode:function(){return speaks?'soft':(cfg.hardPause===false?'signal':'hard')},
      onControllable:function(cb){onTalk=cb;if(speaks)cb(speaks.name)},
      play:function(){
        if(speaks){say('play');return}
        if(!f)mount(cfg.getPos?cfg.getPos():0);
      },
      pause:function(){
        /* Спершу завжди пробуємо ввічливо — команда нічого не ламає.
           Рамку знімаємо, лише якщо плеєр мовчить і режим дозволений:
           деякі сайти після перезавантаження стартують з нуля. */
        say('pause');
        if(speaks||cfg.hardPause===false)return;
        unmount();
      },
      seek:function(s){
        pos=s;
        if(speaks){say('seek',s);return}
        /* без API єдиний спосіб — перезібрати рамку з іншим часом */
        if(f){unmount();mount(s)}
      },
      volume:function(v){vol=v;say('vol',v)},
      getVolume:function(){return vol},
      time:function(){return pos},
      duration:function(){return dur},
      onSeek:function(){}
    };
  }

  return function create(box,cfg){
    if(cfg.provider==='youtube')return YouTube(box,cfg);
    if(cfg.provider==='vimeo')return Vimeo(box,cfg);
    if(cfg.provider==='iframe'||cfg.provider==='twitch')return Frame(box,cfg);
    return Native(box,cfg);
  };
})();
`;

/**
 * Кінотеатр: сервер — єдине джерело правди. Сторінка раз на 2 с питає стан
 * і підганяє плеєр; локально нічого не вирішує, тому всі бачать те саме.
 */
const CINEMA_JS = `
(function(){
  var stage=document.getElementById('cin-stage');
  var bar=document.getElementById('cin-seek'),fill=document.getElementById('cin-fill'),knob=document.getElementById('cin-knob');
  var toggle=document.getElementById('cin-toggle'),tm=document.getElementById('cin-time'),st=document.getElementById('cin-status');
  var admin=bar&&bar.dataset.admin==='1';
  var cfg=stage?JSON.parse(stage.dataset.cfg||'{}'):{};
  var player=null,applying=false,dragging=false;
  var want={playing:false,pos:0,at:Date.now(),source:cfg.src||null,provider:cfg.provider||null};

  function fmt(ms){
    var s=Math.max(0,Math.round(ms/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60);s=s%60;
    return (h?h+':'+(m<10?'0':''):'')+m+':'+(s<10?'0':'')+s;
  }

  /* ── Годинник ──
     Позицію не можна рахувати від локального часу: годинники розходяться,
     та й відповідь іде мережею. Тому на кожному опитуванні оцінюємо зсув
     годинника (як NTP) і тримаємо медіану — так позиція однакова у всіх. */
  var offsets=[],clockOffset=0;
  function noteClock(serverTime,sentAt){
    var rtt=Date.now()-sentAt;
    if(rtt>3000)return;                       /* надто довга відповідь — не довіряємо */
    var off=serverTime+rtt/2-Date.now();
    offsets.push(off);if(offsets.length>9)offsets.shift();
    var s=offsets.slice().sort(function(a,b){return a-b});
    clockOffset=s[Math.floor(s.length/2)];
  }
  function serverNow(){return Date.now()+clockOffset}
  /* очікувана позиція «зараз» — від серверного часу, а не від локального */
  function expected(){return want.pos+(want.playing?serverNow()-want.at:0)}

  function post(action,body){
    var sent=Date.now();
    return fetch('/api/cinema/'+action,{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify(body||{})}).then(function(r){return r.json()}).then(function(j){
        if(j&&j.serverTime)noteClock(j.serverTime,sent);
        apply(j);return j;
      }).catch(function(){});
  }

  function mount(){
    if(!stage||!cfg.src||!window.CinemaPlayer)return;
    stage.innerHTML='';
    /* Рамці треба знати, з якої хвилини стартувати після зняття паузи */
    cfg.getPos=function(){return expected()/1000};
    player=window.CinemaPlayer(stage,cfg);
    stage.classList.remove('idle');
    if(player.limited)document.body.classList.add('cin-limited');
    player.ready.then(function(){applyVolume(savedVol,false);sync(true)});

    /* Відео скінчилось — вмикаємо наступне з черги. Робить це лише той, хто
       керує сеансом; сервер додатково відкидає повторні виклики за полем
       current, тож двоє редакторів не перескочать через один ролик. */
    if(player.onEnded)player.onEnded(function(){
      if(!canEdit)return;
      /* є що далі — вмикаємо наступне; черга порожня — сеанс завершується,
         щоб зал не лишався з чорним екраном і застиглим часом */
      if(queueLen){
        post('next',{current:cfg.src}).then(function(j){if(j&&!j.error)location.reload()});
      }else{
        post('stop').then(function(j){if(j&&!j.error)location.reload()});
      }
    });

    /* Аудіодоріжки зі стріму — окремий випадок озвучок, підставляємо їх у те саме меню */
    cfg.onAudioTracks=function(tracks){
      var box=document.getElementById('cin-voice');
      if(!box||!tracks.length)return;
      var menu=box.querySelector('.qmenu');menu.innerHTML='';
      tracks.forEach(function(a,i){
        var b=document.createElement('button');
        b.className='vopt'+(i===0?' on':'');b.dataset.track=a.index;b.dataset.label=a.label;
        b.textContent=a.label;menu.appendChild(b);
      });
      box.hidden=false;
      document.getElementById('cin-vlabel').textContent=tracks[0].label;
    };

    /* Рівні якості всередині HLS-стріму доїжджають після розбору маніфесту */
    cfg.onLevels=function(levels){
      var box=document.getElementById('cin-qual');
      if(!box||!levels.length)return;
      var menu=box.querySelector('.qmenu');menu.innerHTML='';
      levels.forEach(function(l,i){
        var b=document.createElement('button');
        b.className='qopt'+(i===0?' on':'');b.dataset.level=l.index;b.dataset.label=l.label;
        b.textContent=l.label;menu.appendChild(b);
      });
      box.hidden=false;
      document.getElementById('cin-qlabel').textContent=levels[0].label;
    };

    /* Чужий плеєр міг відгукнутись на postMessage — тоді вмикаємо керування,
       яке сервер спершу позначив як недоступне. */
    if(player.onControllable)player.onControllable(function(dialect){
      if(toggle)toggle.disabled=false;
      if(bar&&admin)bar.dataset.admin='1';
      var note=document.querySelector('.note');
      if(note){note.classList.add('good');note.textContent=(stage.dataset.okText||'')+' ('+dialect+')'}
      sync(true);
    });

    /* Пряме посилання нерідко захищене від відтворення на чужому домені —
       тоді пропонуємо адміністратору показати саму сторінку в рамці. */
    if(player.el&&player.el.tagName==='VIDEO'){
      player.el.addEventListener('error',function(){
        var n=document.createElement('div');n.className='note';
        n.textContent=cfg.failText||'';
        if(cfg.admin&&cfg.pageUrl){
          var b=document.createElement('button');b.className='btn ghost';b.style.marginLeft='12px';
          b.textContent=cfg.frameText||'';
          b.onclick=function(){post('source',{source:cfg.pageUrl,mode:'frame'}).then(function(){location.reload()})};
          n.appendChild(b);
        }
        var room=document.getElementById('cin-room');
        if(room&&!room.querySelector('.note.fail')){n.classList.add('fail');room.appendChild(n)}
      });
    }
    player.onSeek(function(cur){
      /* страхування: стрибок не-адміна повертаємо назад */
      if(admin||applying)return;
      var w=expected()/1000;
      if(Math.abs(cur-w)>1.6){applying=true;player.seek(w);setTimeout(function(){applying=false},300)}
    });
    setInterval(tick,250);
  }

  function tick(){
    if(!player)return;
    var d=player.duration(),cur=player.limited?expected()/1000:player.time();
    if(!dragging&&fill){
      var p=d?Math.min(100,cur/d*100):0;
      fill.style.width=p+'%';if(knob)knob.style.left=p+'%';
    }
    if(tm)tm.textContent=fmt(cur*1000)+(d?' / '+fmt(d*1000):'');
  }

  function apply(j){
    if(!j||j.error)return;

    var cnt=document.getElementById('cin-count');
    if(cnt&&j.viewers)cnt.textContent=j.viewers.length;
    var box=document.getElementById('cin-viewers');
    if(box&&j.viewers){
      box.innerHTML='';
      if(!j.viewers.length){box.innerHTML='<div class="muted">—</div>'}
      j.viewers.forEach(function(x){
        var d=document.createElement('div');d.className='viewer';d.dataset.user=x.id;
        var im=document.createElement('img');im.src=x.avatar;im.alt='';
        var sp=document.createElement('span');sp.textContent=x.name;
        d.appendChild(im);d.appendChild(sp);
        /* кнопки прав не можна губити під час фонового оновлення */
        if(j.admin){
          var c=document.createElement('button');
          c.className='act ctl'+(j.blocked&&j.blocked.indexOf(x.id)>=0?'':' on');
          c.dataset.user=x.id;c.textContent='⏯';c.title=box.dataset.pause||'';
          d.appendChild(c);
          var g=document.createElement('button');
          g.className='act grant'+(j.editors&&j.editors.indexOf(x.id)>=0?' on':'');
          g.dataset.user=x.id;g.textContent='🎛';g.title=box.dataset.grant||'';
          d.appendChild(g);
        }
        box.appendChild(d);
      });
    }

    /* джерело змінилось або зникло — простіше перезібрати сторінку */
    if((j.source||null)!==(want.source||null)||(j.provider||null)!==(want.provider||null)){
      location.reload();return;
    }

    /* ВАЖЛИВО: позначку часу беремо серверну, а не локальну. Інакше далі
       expected() рахує від serverNow(), і позиція кожного глядача виявляється
       зсунутою рівно на його власний зсув годинника — саме звідси розʼїзд. */
    want.playing=!!j.playing;want.pos=j.positionMs||0;
    want.at=j.serverTime||serverNow();
    if(toggle)toggle.textContent=want.playing?'⏸':'▶';
    showDrift();
    sync(true);
  }

  /* ── Підгонка ──
     Стрибок позицією помітний і збиває буфер, тому дрібне відставання
     виправляємо швидкістю відтворення (як це роблять справжні watch-party),
     і лише велике — перемоткою. */
  /* Завіса поверх рамки: пояснює, що зараз пауза, і з якої хвилини продовжимо. */
  var curtainEl=document.getElementById('cin-curtain');
  function curtain(on,mode){
    if(!curtainEl)return;
    curtainEl.hidden=!on;
    if(!on)return;
    var h=document.getElementById('cin-curtain-h');
    if(h&&stage){
      h.textContent=mode==='signal'
        ? (stage.dataset.manual||'')
        : (stage.dataset.resume||'')+' '+fmt(expected());
    }
  }

  var rateOn=false;
  function sync(hard){
    if(!player)return;

    /* Плеєр не приймає команд. Два варіанти:
       hard   — пауза знімає рамку (гарантовано тихо, але сайт перезапуститься);
       signal — рамку не чіпаємо, лише показуємо завісу з проханням
                зупинити вручну; так нічия позиція не губиться. */
    var m=player.mode&&player.mode();
    if(m==='hard'||m==='signal'){
      if(want.playing){player.play();curtain(false)}
      else{player.pause();curtain(true,m)}
      return;
    }
    curtain(false);

    if(player.limited)return;

    /* Поки браузер добирає буфер, час стоїть не з нашої вини — будь-яка
       підгонка в цей момент тільки погіршить справу. */
    if(player.buffering&&player.buffering()){drift=null;return}

    var w=expected()/1000,cur=player.time(),d=cur-w;
    drift=d;

    if(Math.abs(d)>2||(hard&&Math.abs(d)>1)){
      /* далеко відʼїхали — тільки перемотка */
      applying=true;player.seek(w);setTimeout(function(){applying=false},400);
      if(rateOn&&player.rate){player.rate(1);rateOn=false}
    }else if(want.playing&&player.rate&&Math.abs(d)>0.25){
      /* Пропорційна поправка: чим більше відставання, тим помітніша зміна
         швидкості, але не більше 6% — на слух це не чути. */
      var k=Math.min(0.06,Math.abs(d)*0.05);
      player.rate(d<0?1+k:1-k);rateOn=true;
    }else if(rateOn&&player.rate&&Math.abs(d)<0.12){
      player.rate(1);rateOn=false;
    }

    if(want.playing)player.play();else player.pause();
    showDrift();
  }

  /* Невеликий індикатор: якщо розʼїзд помітний, глядач бачить це, а не гадає. */
  var drift=null;
  function showDrift(){
    if(!st)return;
    var big=drift!==null&&Math.abs(drift)>1.2;
    st.classList.toggle('warn',big);
    st.textContent=(want.playing?(st.dataset.live||''):(st.dataset.paused||''))
      +(big?' · '+(drift>0?'+':'')+drift.toFixed(1)+'s':'');
  }

  if(toggle)toggle.addEventListener('click',function(){
    if(!canControl){if(gateBox)gateBox.classList.remove('hidden');return}
    post(want.playing?'pause':'play',{positionMs:player&&!player.limited?player.time()*1000:expected()});
  });

  /* Перемотка — лише адміністратору. */
  if(bar)bar.addEventListener('click',function(e){
    if(!admin||!player||!canControl)return;
    var d=player.duration();if(!d)return;
    var r=bar.getBoundingClientRect();
    post('seek',{positionMs:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*d*1000});
  });

  /* ── Джерело: запустити зараз або поставити в чергу ── */
  function submitSource(action,btn){
    var inp=document.getElementById('cin-src');
    if(!inp||!inp.value.trim())return;
    btn.disabled=true;btn.classList.add('busy');
    post(action,{
      source:inp.value,
      title:(document.getElementById('cin-title')||{}).value,
      /* Referer потрібен, коли CDN пускає лише «зі свого» сайту —
         тоді потік піде через наш проксі з цим заголовком. */
      referer:(document.getElementById('cin-ref')||{}).value,
    })
      .then(function(j){
        btn.disabled=false;btn.classList.remove('busy');
        if(!j||j.error){inp.classList.add('bad');setTimeout(function(){inp.classList.remove('bad')},1200);return}
        if(action==='source'){location.reload();return}
        inp.value='';var ti=document.getElementById('cin-title');if(ti)ti.value='';
      });
  }
  var load=document.getElementById('cin-load');
  if(load)load.addEventListener('click',function(){submitSource('source',this)});
  var qadd=document.getElementById('cin-queue');
  if(qadd)qadd.addEventListener('click',function(){submitSource('queue',this)});

  /* ── Черга: увімкнути зараз / прибрати ── */
  var qlist=document.getElementById('cin-queue-list');
  if(qlist)qlist.addEventListener('click',function(e){
    var play=e.target.closest('.qplay'),del=e.target.closest('.qdel'),
        up=e.target.closest('.qup'),down=e.target.closest('.qdown');
    if(play)post('next',{id:Number(play.dataset.id)}).then(function(){location.reload()});
    else if(del)post('unqueue',{id:Number(del.dataset.id)});
    else if(up)post('queueMove',{id:Number(up.dataset.id),dir:-1});
    else if(down)post('queueMove',{id:Number(down.dataset.id),dir:1});
  });
  /* Перемикач жорсткої паузи — коли сайт погано переживає перезавантаження */
  var hardBtn=document.getElementById('cin-hard');
  if(hardBtn)hardBtn.addEventListener('click',function(){
    var on=!hardBtn.classList.contains('on');
    hardBtn.classList.toggle('on',on);
    cfg.hardPause=on;
    post('hardPause',{on:on});
  });

  var nextBtn=document.getElementById('cin-next');
  if(nextBtn)nextBtn.addEventListener('click',function(){
    post('next',{}).then(function(j){if(j&&!j.error)location.reload()});
  });
  var qclear=document.getElementById('cin-qclear');
  if(qclear)qclear.addEventListener('click',function(){post('clearQueue')});

  /* ── Права на керування сеансом ── */
  var vbox=document.getElementById('cin-viewers');
  if(vbox)vbox.addEventListener('click',function(e){
    var g=e.target.closest('.grant'),c=e.target.closest('.ctl');
    if(g){
      post(g.classList.contains('on')?'revoke':'grant',{userId:g.dataset.user});
      g.classList.toggle('on');
      return;
    }
    /* право ставити на паузу — окремо від права правити сеанс */
    if(c){
      post(c.classList.contains('on')?'denyControl':'allowControl',{userId:c.dataset.user});
      c.classList.toggle('on');
    }
  });

  /* ── Тимчасове закриття залу ── */
  document.addEventListener('click',function(e){
    var l=e.target.closest('[data-lock]');
    if(!l)return;
    post('lock',{minutes:Number(l.dataset.lock)}).then(function(){location.reload()});
  });
  var stop=document.getElementById('cin-stop');
  if(stop)stop.addEventListener('click',function(){post('stop').then(function(){location.reload()})});

  /* ── На весь екран ──
     Розгортаємо всю кімнату, а не самий плеєр: рідні контроли приховані,
     тож наша панель має лишатися доступною і в повноекранному режимі. */
  var room=document.getElementById('cin-room'),full=document.getElementById('cin-full');
  function fsElement(){return document.fullscreenElement||document.webkitFullscreenElement||null}
  function enter(){
    if(!room)return;
    if(room.requestFullscreen)room.requestFullscreen().catch(function(){});
    else if(room.webkitRequestFullscreen)room.webkitRequestFullscreen();
    else if(player&&player.el&&player.el.webkitEnterFullscreen)player.el.webkitEnterFullscreen(); /* iPhone */
  }
  function exit(){
    if(document.exitFullscreen)document.exitFullscreen().catch(function(){});
    else if(document.webkitExitFullscreen)document.webkitExitFullscreen();
  }
  function toggleFull(){ fsElement()?exit():enter() }

  if(full)full.addEventListener('click',toggleFull);
  if(stage)stage.addEventListener('dblclick',toggleFull);
  addEventListener('keydown',function(e){
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;
    if(e.key==='f'||e.key==='F'||e.key==='а'||e.key==='А')toggleFull();
  });

  /* ── Автоприховування панелі в повному екрані ──
     Над рамкою чужого плеєра рухи миші до сторінки не доходять, тому внизу
     екрана лежить наша прозора смуга: щойно курсор туди заходить, панель
     повертається. Поза повним екраном нічого не ховаємо — там панель під
     відео й нікому не заважає. */
  var idleT=null,wake=document.getElementById('cin-wake');
  function showBar(){
    if(!room)return;
    room.classList.remove('idlebar');
    clearTimeout(idleT);
    if(fsElement())idleT=setTimeout(function(){room.classList.add('idlebar')},3000);
  }
  if(room){
    room.addEventListener('mousemove',showBar);
    room.addEventListener('touchstart',showBar,{passive:true});
  }
  if(wake){
    wake.addEventListener('mouseenter',showBar);
    wake.addEventListener('mousemove',showBar);
    wake.addEventListener('touchstart',showBar,{passive:true});
  }
  addEventListener('keydown',showBar);

  ['fullscreenchange','webkitfullscreenchange'].forEach(function(ev){
    document.addEventListener(ev,function(){
      var on=!!fsElement();
      if(room)room.classList.toggle('fs',on);
      if(full)full.textContent=on?'⤫':'⛶';
      if(!on&&room)room.classList.remove('idlebar');
      showBar();
    });
  });

  mount();
  /* ── Гучність ── */
  var volRange=document.getElementById('cin-volrange'),muteBtn=document.getElementById('cin-mute');
  /* Обережно: Number(null) === 0, тож без явної перевірки на «немає значення»
     плеєр стартував би беззвучним. */
  var stored=localStorage.getItem('cin-vol');
  var savedVol=stored===null||stored===''?1:Number(stored);
  if(!isFinite(savedVol)||savedVol<0||savedVol>1)savedVol=1;
  function applyVolume(x,remember){
    if(player&&player.volume)player.volume(x);
    if(volRange)volRange.value=Math.round(x*100);
    if(muteBtn)muteBtn.textContent=x<=0?'🔇':(x<0.5?'🔉':'🔊');
    if(remember)localStorage.setItem('cin-vol',String(x));
  }
  if(volRange)volRange.addEventListener('input',function(){applyVolume(this.value/100,true)});
  if(muteBtn)muteBtn.addEventListener('click',function(){
    var cur=player&&player.getVolume?player.getVolume():savedVol;
    applyVolume(cur>0?0:(Number(localStorage.getItem('cin-vol'))||1),false);
  });

  /* ── Озвучка ──
     У плейлистах Playerjs кожна озвучка — окрема доріжка зі своїми якостями.
     Вибір особистий: хтось дивиться дубляж, хтось оригінал, і це нікому
     не заважає — позиція спільна, бо її тримає сервер. */
  var voice=document.getElementById('cin-voice');
  if(voice)voice.addEventListener('click',function(e){
    var b=e.target.closest('.vopt');if(!b||!player)return;

    /* доріжка всередині стріму — перемикається без перезавантаження */
    if(b.dataset.track!==undefined&&player.setAudioTrack){
      player.setAudioTrack(Number(b.dataset.track));
      var tabs=voice.querySelectorAll('.vopt');
      for(var k=0;k<tabs.length;k++)tabs[k].classList.toggle('on',tabs[k]===b);
      document.getElementById('cin-vlabel').textContent=b.dataset.label;
      voice.removeAttribute('open');
      return;
    }

    var v=(cfg.variants||[])[Number(b.dataset.i)];
    if(!v)return;

    if(player.setQuality)player.setQuality(v.src);
    /* меню якостей теж треба перебудувати — у кожної озвучки вони свої */
    var qbox=document.getElementById('cin-qual');
    if(qbox){
      var menu=qbox.querySelector('.qmenu');menu.innerHTML='';
      (v.qualities||[]).forEach(function(q,i){
        var o=document.createElement('button');
        o.className='qopt'+(i===0?' on':'');o.dataset.url=q.url;o.dataset.label=q.label;
        o.textContent=q.label;menu.appendChild(o);
      });
      qbox.hidden=(v.qualities||[]).length<2;
      if((v.qualities||[]).length)document.getElementById('cin-qlabel').textContent=v.qualities[0].label;
    }

    var all=voice.querySelectorAll('.vopt');
    for(var i=0;i<all.length;i++)all[i].classList.toggle('on',all[i]===b);
    document.getElementById('cin-vlabel').textContent=b.dataset.label;
    voice.removeAttribute('open');
    setTimeout(function(){applyVolume(savedVol,false);sync(true)},400);
  });

  /* ── Якість (вибір особистий, не синхронізується) ── */
  var qual=document.getElementById('cin-qual');
  if(qual)qual.addEventListener('click',function(e){
    var b=e.target.closest('.qopt');if(!b||!player)return;
    /* два випадки: окремий файл на кожну якість або рівень усередині HLS */
    if(b.dataset.level!==undefined&&player.setLevel)player.setLevel(Number(b.dataset.level));
    else if(b.dataset.url&&player.setQuality)player.setQuality(b.dataset.url);
    else return;
    var all=qual.querySelectorAll('.qopt');
    for(var i=0;i<all.length;i++)all[i].classList.toggle('on',all[i]===b);
    document.getElementById('cin-qlabel').textContent=b.dataset.label;
    qual.removeAttribute('open');
    setTimeout(function(){applyVolume(savedVol,false);sync(true)},400);
  });

  /* ── Замок керування ──
     Дивитися можна завжди; пуск і пауза вмикаються самі, щойно людина
     зайшла в голосовий канал (і замикаються, коли вийшла). */
  var canControl=!!cfg.canControl,canEdit=!!cfg.canEdit,queueLen=Number(cfg.queueLen||0);
  var gateBox=document.getElementById('cin-gate');
  if(gateBox){
    var close=function(){gateBox.classList.add('hidden')};
    var x=document.getElementById('cin-gate-x'),watch=document.getElementById('cin-gate-watch');
    if(x)x.addEventListener('click',close);
    if(watch)watch.addEventListener('click',close);
    gateBox.addEventListener('click',function(e){if(e.target===gateBox)close()});
    addEventListener('keydown',function(e){if(e.key==='Escape')close()});
  }

  function setControl(on){
    if(on===canControl)return;
    canControl=on;
    if(toggle)toggle.disabled=!on||(player&&player.limited);
    if(bar)bar.dataset.admin=(on&&admin&&player&&!player.limited)?'1':'0';
    if(gateBox)gateBox.classList.toggle('hidden',on);
    if(on&&st)st.title=stage?(stage.dataset.okText||''):'';
  }

  /* Черга оновлюється фоново — щоб бачити, що додали інші. */
  var lastQueue='';
  function renderQueue(j){
    var box=document.getElementById('cin-queue-list');
    if(!box||!j.queue)return;
    var sig=JSON.stringify(j.queue.map(function(q){return q.id}));
    if(sig===lastQueue)return;
    lastQueue=sig;
    var cnt=document.getElementById('cin-qcount');
    if(cnt)cnt.textContent=j.queue.length;
    if(!j.queue.length){box.innerHTML='<div class="muted">'+(box.dataset.empty||'')+'</div>';return}
    box.innerHTML='';
    j.queue.forEach(function(q,i){
      var row=document.createElement('div');row.className='qitem';row.dataset.id=q.id;
      var n=document.createElement('span');n.className='qn';n.textContent=i+1;
      var body=document.createElement('div');body.className='qbody';
      var t1=document.createElement('div');t1.className='qt';t1.textContent=q.title||q.pageUrl||q.source;
      var t2=document.createElement('div');t2.className='qa';t2.textContent=(q.provider||'')+' · '+(q.addedName||'');
      body.appendChild(t1);body.appendChild(t2);
      row.appendChild(n);row.appendChild(body);
      if(j.canEdit){
        /* стрілки порядку теж малюємо тут — інакше фонове оновлення їх з'їдає */
        var up=document.createElement('button');up.className='act qup';up.dataset.id=q.id;
        up.textContent='↑';up.disabled=i===0;up.title=box.dataset.up||'';
        var dn=document.createElement('button');dn.className='act qdown';dn.dataset.id=q.id;
        dn.textContent='↓';dn.disabled=i===j.queue.length-1;dn.title=box.dataset.down||'';
        var p=document.createElement('button');p.className='act qplay';p.dataset.id=q.id;p.textContent='▶';
        p.title=box.dataset.play||'';
        row.appendChild(up);row.appendChild(dn);row.appendChild(p);
      }
      if(j.canEdit||(cfg.me&&q.addedBy===cfg.me)){
        var d=document.createElement('button');d.className='act qdel danger';d.dataset.id=q.id;d.textContent='✕';
        row.appendChild(d);
      }
      box.appendChild(row);
    });
  }

  function gate(j){
    if(!j)return;
    setControl(!!j.canControl);
    /* режим паузи міг перемкнути хтось інший */
    if(typeof j.hardPause==='boolean'&&j.hardPause!==cfg.hardPause){
      cfg.hardPause=j.hardPause;
      if(hardBtn)hardBtn.classList.toggle('on',j.hardPause);
    }
    canEdit=!!j.canEdit;
    queueLen=(j.queue||[]).length;
    var nb=document.getElementById('cin-next');
    if(nb)nb.disabled=!(canEdit&&queueLen);
    renderQueue(j);
    var c=document.getElementById('cin-count');
    if(c&&j.viewers)c.textContent=j.viewers.length;
  }

  function poll(){
    var sent=Date.now();
    fetch('/api/cinema/state').then(function(r){return r.json()}).then(function(j){
      if(j&&j.serverTime)noteClock(j.serverTime,sent);
      gate(j);apply(j);
    }).catch(function(){});
  }
  poll();setInterval(poll,2000);setInterval(function(){sync(false)},1000);

  /* Згорнута вкладка — головна причина розʼїзду: браузер душить таймери,
     і за кілька хвилин фону відео відстає на десятки секунд. Щойно вкладка
     повертається, питаємо стан і підганяємо жорстко. */
  document.addEventListener('visibilitychange',function(){
    if(document.hidden)return;
    offsets.length=0;              /* оцінка годинника за час фону застаріла */
    poll();
    setTimeout(function(){sync(true)},300);
  });
  addEventListener('focus',function(){poll()});
  applyVolume(savedVol,false);
  /* після монтування плеєра гучність треба виставити ще раз */
  setTimeout(function(){applyVolume(savedVol,false)},1200);
})();
`;

/** Панель модерації: усі перевірки на сервері, тут лише зручність. */
const MOD_JS = `
(function(){
  var kind='text',err=document.getElementById('mod-err');
  function fail(t){if(!err)return;err.textContent=t;err.hidden=!t}

  /** Термін: або готовий варіант, або своє число з обраною одиницею. */
  function pickedMinutes(){
    var drop=document.getElementById('mod-dur');
    var v=drop?drop.dataset.value:'0';
    if(v!=='custom')return Number(v||0);
    var n=Number((document.getElementById('mod-num')||{}).value||0);
    var unit=Number((document.getElementById('mod-unit')||{dataset:{}}).dataset.value||1);
    return Math.max(1,Math.round(n*unit));
  }

  /* ── Спадні меню в стилі сайту ── */
  document.addEventListener('click',function(e){
    var opt=e.target.closest('.drop-opt');
    if(opt){
      var drop=opt.closest('.drop');
      drop.dataset.value=opt.dataset.value;
      drop.querySelector('.drop-v').textContent=opt.textContent;
      drop.querySelectorAll('.drop-opt').forEach(function(o){o.classList.toggle('on',o===opt)});
      drop.removeAttribute('open');
      /* «свій час» відкриває поле для ручного значення */
      if(drop.id==='mod-dur'){
        var box=document.getElementById('mod-custom');
        if(box)box.hidden=drop.dataset.value!=='custom';
      }
      return;
    }
    var open=document.querySelector('.drop[open]');
    if(open&&!open.contains(e.target))open.removeAttribute('open');
  });

  /* ── Вибір учасника: список із пошуком замість вписування ID ── */
  var picker=document.getElementById('mod-picker');
  if(picker){
    var menu=document.getElementById('mod-menu'),list=document.getElementById('mod-list'),
        search=document.getElementById('mod-search'),hidden=document.getElementById('mod-user'),
        nameEl=document.getElementById('mod-name'),faceEl=document.getElementById('mod-face');
    var timer=null;

    function load(q){
      fetch('/api/members?q='+encodeURIComponent(q||''))
        .then(function(r){return r.json()}).then(function(j){
          list.innerHTML='';
          if(!j.members||!j.members.length){
            var none=document.createElement('div');none.className='muted';
            none.textContent=list.dataset.empty||'—';list.appendChild(none);return;
          }
          j.members.forEach(function(m){
            var row=document.createElement('button');row.type='button';row.className='pick-row';
            row.dataset.id=m.id;row.dataset.name=m.name;row.dataset.avatar=m.avatar;
            var im=document.createElement('img');im.src=m.avatar;im.alt='';
            var sp=document.createElement('span');sp.textContent=m.name;
            row.appendChild(im);row.appendChild(sp);list.appendChild(row);
          });
        }).catch(function(){});
    }

    document.getElementById('mod-pick').addEventListener('click',function(){
      var show=menu.hidden;
      menu.hidden=!show;
      if(show){search.value='';load('');setTimeout(function(){search.focus()},30)}
    });

    search.addEventListener('input',function(){
      clearTimeout(timer);
      var q=this.value;
      timer=setTimeout(function(){load(q)},200);
    });

    list.addEventListener('click',function(e){
      var row=e.target.closest('.pick-row');if(!row)return;
      hidden.value=row.dataset.id;
      nameEl.textContent=row.dataset.name;
      faceEl.style.backgroundImage='url('+row.dataset.avatar+')';
      faceEl.classList.add('on');
      menu.hidden=true;
      fail('');
    });

    document.addEventListener('click',function(e){
      if(!picker.contains(e.target))menu.hidden=true;
    });
  }

  document.addEventListener('click',function(e){
    var k=e.target.closest('.kindbtn');
    if(k){
      kind=k.dataset.kind;
      document.querySelectorAll('.kindbtn').forEach(function(b){
        var on=b===k;
        b.classList.toggle('on',on);
        b.setAttribute('aria-pressed',on?'true':'false');
      });
      /* попередження не має строку — ховаємо і вибір терміну, і ручне поле */
      var dur=document.getElementById('mod-dur'),cus=document.getElementById('mod-custom');
      if(dur)dur.hidden=kind==='warn';
      if(cus)cus.hidden=kind==='warn'||!dur||dur.dataset.value!=='custom';
      return;
    }

    /* зняти всі попередження учасника */
    var unwarn=e.target.closest('.mod-unwarn');
    if(unwarn){
      fetch('/api/mod/unwarn',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({userId:unwarn.dataset.user,all:true})})
        .then(function(r){return r.json()}).then(function(j){
          if(j.error){fail(j.error);return}
          location.reload();
        }).catch(function(){});
      return;
    }

    var lift=e.target.closest('.mod-lift');
    if(lift){
      fetch('/api/mod/lift',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({userId:lift.dataset.user,kind:lift.dataset.kind})})
        .then(function(r){return r.json()}).then(function(j){
          /* ієрархія: пояснення приходить із сервера готовим текстом */
          if(j.error){fail(j.message||j.error);return}
          location.reload();
        }).catch(function(){});
      return;
    }

    if(e.target.closest('#mod-apply')){
      var apply=e.target.closest('#mod-apply');
      var user=(document.getElementById('mod-user').value||'').replace(/[^0-9]/g,'');
      if(!user){
        fail(document.getElementById('mod-picker').dataset.need||'Оберіть учасника');
        /* підсвічуємо саме те місце, де бракує вибору */
        var pick=document.getElementById('mod-pick');
        pick.classList.add('bad');setTimeout(function(){pick.classList.remove('bad')},1200);
        return;
      }
      fail('');
      apply.disabled=true;apply.classList.add('busy');
      /* попередження — окрема дія: без терміну, зі своїм лічильником */
      var url=kind==='warn'?'/api/mod/warn':'/api/mod/apply';
      fetch(url,{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({
          userId:user,kind:kind,
          minutes:pickedMinutes(),
          reason:document.getElementById('mod-reason').value||''
        })}).then(function(r){return r.json()}).then(function(j){
          apply.disabled=false;apply.classList.remove('busy');
          if(j.error){fail(({limit:'Перевищено ваш ліміт',rank:'Цей учасник рівний вам або вищий',
            reason:'Причина обовʼязкова',self:'Себе не можна','not found':'Учасника не знайдено'})[j.error]||j.error);return}
          /* коротко підтверджуємо успіх, і аж потім оновлюємо сторінку */
          apply.classList.add('done');
          setTimeout(function(){location.reload()},450);
        }).catch(function(){
          apply.disabled=false;apply.classList.remove('busy');
          fail('Не вдалося звʼязатися з сервером');
        });
    }
  });
})();
`;

const BACKGROUND = `<div class="bg"><canvas id="fog"></canvas><canvas id="stars"></canvas></div>`;

/** Посилання на репозиторій — тихо сидить у куті на всіх сторінках. */
/** Посилання автора в куті: репозиторій і Telegram, поруч одне з одним. */
const LINKS = `<div class="ghbar">
  <a class="gh" href="https://github.com/mushraisin?tab=repositories"
    target="_blank" rel="noopener noreferrer" title="GitHub" aria-label="GitHub">
    <svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
  </a>
  <a class="gh" href="https://t.me/mushbarry"
    target="_blank" rel="noopener noreferrer" title="Telegram" aria-label="Telegram">
    <svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M14.9 2.1a.85.85 0 0 0-.87-.13L1.42 6.83c-.68.26-.65 1.24.04 1.46l3.2 1.02 1.19 3.72c.1.31.38.52.7.53.33 0 .62-.19.74-.49l1.02-2.6 3.06 2.25c.44.32 1.07.09 1.2-.44l2.02-9.2a.86.86 0 0 0-.29-.98ZM6.16 9.02 12.4 4.6 6.9 10.5l-.24 1.86-.5-3.34Z"/></svg>
  </a>
</div>`;

/**
 * Іконка вкладки: темний квадрат із світним трикутником «пуск».
 * Векторна — лишається чіткою і в 16 px, і на екрані закладок.
 */
export const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><filter id="g" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="3" result="b"/><feMerge>
    <feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
  <rect width="64" height="64" rx="16" fill="#05070d"/>
  <rect x="1.5" y="1.5" width="61" height="61" rx="15" fill="none" stroke="#6b7cff" stroke-opacity=".35" stroke-width="2"/>
  <path d="M26 20.5 45 32 26 43.5Z" fill="#6b7cff" filter="url(#g)"/>
</svg>`;

// ─────────────────────────────────────────────
//  Каркас
// ─────────────────────────────────────────────
/** Спадний вибір мови. На <details> — працює навіть без JS. */
function langSwitch(lang, path) {
  const cur = LANGS[lang] ?? LANGS.uk;
  const opts = Object.values(LANGS).map((l) =>
    `<a href="${esc(path)}?lang=${l.code}" class="${l.code === lang ? 'on' : ''}">
      <b>${l.short}</b><span>${esc(l.name)}</span></a>`,
  ).join('');

  return `<details class="langs">
    <summary aria-label="Мова"><b>${cur.short}</b><i></i></summary>
    <div class="langmenu">${opts}</div>
  </details>`;
}

function letters(word) {
  return [...word]
    .map((ch, i) => `<span style="animation-delay:${(i * 0.055).toFixed(3)}s">${esc(ch)}</span>`)
    .join('');
}

/**
 * Теги для прев'ю посилань. Без них Discord показує голий текст замість картки,
 * а це найпомітніша дрібниця, коли посиланням діляться в чаті.
 */
function metaTags({ title, description, image, url, type = 'website' }) {
  const tags = [
    ['og:site_name', 'Моментус'],
    ['og:type', type],
    ['og:title', title],
    ['og:description', description],
    ['og:url', url],
    ['og:image', image],
    ['twitter:card', image ? 'summary_large_image' : 'summary'],
    ['twitter:title', title],
    ['twitter:description', description],
    ['twitter:image', image],
  ];
  return tags
    .filter(([, v]) => v)
    .map(([k, v]) => `<meta property="${k}" content="${esc(v)}">`)
    .join('\n');
}

function shell({ title, content, hasCustomCss, extraJs = '', meta = '' }) {
  return `<!doctype html>
<html lang="uk"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#05070d">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/favicon.svg">
<link rel="manifest" href="/manifest.webmanifest">
<title>${esc(title)}</title>
${meta}
<style>${BASE_CSS}</style>
${hasCustomCss ? '<link rel="stylesheet" href="/custom.css">' : ''}
</head><body>
${BACKGROUND}
${content}
${LINKS}
<script>${BG_JS}</script>
${extraJs ? `<script>${extraJs}</script>` : ''}
</body></html>`;
}

export function layout({
  title, guildName, body, nav = [], session, hasCustomCss,
  lang = 'uk', path = '/', gallery = false, page = null, og = null,
}) {
  // apart — кнопка стоїть окремо від основних, з розділювачем
  const navHtml = nav
    .map((n) => `<a href="${esc(n.href)}" class="${[n.active ? 'active' : '', n.apart ? 'apart' : ''].filter(Boolean).join(' ')}">${esc(n.label)}</a>`)
    .join('');

  // Сам чип із аватаром і ніком веде в профіль — окрема кнопка зайва.
  const auth = session
    ? `<div class="me">
        <a class="me-link" href="/me" title="${esc(t(lang, 'nav.profile'))}">
          <img src="${esc(avatarUrl(session.user_id, session.avatar, 64))}" alt="">
          <span>${esc(session.username ?? '')}</span>
        </a>
        <a class="me-out" href="/logout" title="${esc(t(lang, 'nav.logout'))}">✕</a>
      </div>`
    : `<a href="/login?next=${encodeURIComponent(path)}">${esc(t(lang, 'nav.login'))}</a>`;

  // галерея й кінотеатр — широкі сторінки, решта лишається вузькою й читабельною
  const wide = gallery || page === 'cinema' ? ' wide' : '';

  return shell({
    title,
    hasCustomCss,
    meta: og ? metaTags(og) : '',
    extraJs: [
      gallery ? GALLERY_JS : '',
      page === 'cinema' ? PLAYERS_JS : '',
      page === 'cinema' ? CINEMA_JS : '',
      page === 'mod' ? MOD_JS : '',
    ].filter(Boolean).join('\n'),
    // Смуга навігації йде на всю ширину вікна, а її вміст тримається тієї ж
    // сітки, що й сторінка. На головній її немає — там своя обкладинка.
    content: `<div class="topbar" id="topbar">
      <div class="topbar-in${wide}">
        <a class="brand" href="/"><span class="dot"></span>${esc(guildName)}</a>
        <nav>${navHtml}${auth}${langSwitch(lang, path)}</nav>
      </div>
    </div>
    <div class="wrap${wide} under-top">
      ${body}
      <footer>Моментус</footer>
    </div>
    ${gallery ? '<div class="lightbox" id="lb"></div>' : ''}`,
  });
}

/** Головна: назва, вхід і галерея. */
export function landingLayout({ lang = 'uk', session = null, og = null, mod = false }) {
  // Залогінений бачить себе в шапці — сам аватар із ніком і є входом у профіль.
  const chip = session
    ? `<div class="me">
        <a class="me-link" href="/me" title="${esc(t(lang, 'nav.profile'))}">
          <img src="${esc(avatarUrl(session.user_id, session.avatar, 64))}" alt="">
          <span>${esc(session.username ?? '')}</span>
        </a>
        <a class="me-out" href="/logout" title="${esc(t(lang, 'nav.logout'))}">✕</a>
      </div>`
    : '';

  // Службова кнопка стоїть поруч із чипом профілю в куті, а не серед головних.
  const modChip = mod
    ? `<a class="me modchip" href="/mod" title="${esc(t(lang, 'nav.mod'))}">
        <span class="mi">🛡️</span><span>${esc(t(lang, 'nav.mod'))}</span>
      </a>`
    : '';

  // Окремої кнопки «Профіль» більше немає: увійшовши, людина клікає свій чип угорі.
  const primary = session
    ? `<a class="dbtn" href="/top">🏆 <span>${esc(t(lang, 'nav.top'))}</span></a>`
    : `<a class="dbtn" href="/login?next=/">${DISCORD_ICON}<span>${esc(t(lang, 'landing.login'))}</span></a>`;

  return shell({
    title: 'Моментус',
    meta: og ? metaTags(og) : '',
    content: `<div class="wrap">
      <header><span></span><nav>${chip}${modChip}${langSwitch(lang, '/')}</nav></header>
      <section class="hero">
        <h1 class="logo" aria-label="Моментус">${letters('МОМЕНТУС')}</h1>
        <div class="hline"></div>
        <div class="tag">${esc(t(lang, 'landing.tag'))}</div>
        ${session ? `<div class="signed">● ${esc(t(lang, 'landing.hi'))}</div>` : ''}
        <div class="cta">
          ${primary}
          <a class="gbtn" href="/gallery">🖼️ <span>${esc(t(lang, 'landing.gallery'))}</span></a>
          <a class="gbtn" href="/cinema">🎬 <span>${esc(t(lang, 'nav.cinema'))}</span></a>
        </div>
      </section>
    </div>`,
  });
}

// ─────────────────────────────────────────────
//  Сторінки
// ─────────────────────────────────────────────
function levelColor(v) {
  if (v >= 80) return 'var(--good)';
  if (v >= 60) return '#7ec96a';
  if (v >= 40) return 'var(--mid)';
  if (v >= 20) return '#ef8b4a';
  return 'var(--bad)';
}

export function leaderboardPage(rows, lang = 'uk') {
  if (!rows.length) return `<div class="card empty rise">${esc(t(lang, 'top.empty'))}</div>`;
  const medals = ['🥇', '🥈', '🥉'];
  const body = rows.map((r, i) => `
    <tr style="animation-delay:${Math.min(i * 0.03, 0.5)}s">
      <td class="rank">${medals[i] ?? `#${i + 1}`}</td>
      <td><img class="mini" src="${esc(avatarUrl(r.user_id, r.avatar, 32))}" alt="" loading="lazy">
        <a href="/u/${esc(r.user_id)}">${esc(r.username ?? r.user_id)}</a></td>
      <td class="num">${r.ai_score}</td>
    </tr>`).join('');

  return `<div class="card rise"><table>
    <thead><tr><th>#</th><th>${esc(t(lang, 'top.member'))}</th>
    <th style="text-align:right">${esc(t(lang, 'top.score'))}</th></tr></thead>
    <tbody>${body}</tbody></table></div>`;
}

export function profilePage(profile, { username, avatar, roleName, roleColor, rank, lang = 'uk' }) {
  const accent = roleColor || '#6b7cff';
  const cats = REPUTATION_CATEGORIES.map((c) => {
    const value = profile.rep[c.key] ?? 0;
    return { label: c.inverted ? `${c.label} ↓` : c.label, value, level: c.inverted ? 100 - value : value };
  });

  const catsHtml = cats.map((c, i) => `
    <div class="cat" style="animation-delay:${(i * 0.04).toFixed(2)}s">
      <div>${esc(c.label)}</div>
      <div class="bar"><i style="width:${c.level}%;background:${levelColor(c.level)};animation-delay:${(0.2 + i * 0.05).toFixed(2)}s"></i></div>
      <div class="val">${Math.round(c.value)}</div>
    </div>`).join('');

  const tiles = [
    [fmt(profile.totalMessages), t(lang, 'profile.messages')],
    [fmt(profile.messages30d), t(lang, 'profile.msg30')],
    [`${Math.round(profile.voiceMinutes / 60)} ${lang === 'en' ? 'h' : 'год'}`, t(lang, 'profile.voice')],
    [fmt(profile.activeDays), t(lang, 'profile.activeDays')],
  ].map(([b, s], i) => `<div class="tile" style="animation-delay:${(0.1 + i * 0.06).toFixed(2)}s"><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join('');

  return `
  <div class="card rise">
    <div class="row">
      <img class="avatar" src="${esc(avatar)}" alt="" style="border-color:${esc(accent)}">
      <div>
        <div class="name">${esc(username)}</div>
        ${roleName ? `<div class="pill" style="color:${esc(accent)};border-color:${esc(accent)}66;background:${esc(accent)}22">${esc(roleName)}</div>` : ''}
        <div class="muted" style="margin-top:5px">${esc(t(lang, 'profile.days', { days: profile.daysOnServer }))}${rank ? ` · #${rank}` : ''}</div>
      </div>
      <div class="score"><b>${profile.aiScore}</b><span>${esc(t(lang, 'profile.rating'))}</span></div>
    </div>
    <div class="tiles">${tiles}</div>
  </div>
  <div class="card rise">${catsHtml}</div>`;
}

/** Один медіа-елемент (спільний для стрічки й для «кліпів дня/місяця»). */
/**
 * Плитка у стрічці — це прев'ю, а не плеєр: рідних кнопок немає,
 * бо клік відкриває публікацію у великому вікні, де вже є все керування.
 */
function mediaTag(it, cls = 'media') {
  return it.kind === 'video'
    ? `<video class="${cls}" src="/media/${it.id}" preload="metadata" muted playsinline></video>`
    : `<img class="${cls}" src="/media/${it.id}" alt="" loading="lazy">`;
}

function likeBtn(it, liked) {
  const on = liked.has(Number(it.id)) ? ' on' : '';
  return `<button class="like${on}" data-id="${it.id}"><span class="h">❤</span><span class="n">${it.likes}</span></button>`;
}

/** Автор під кліпом: аватар беремо з мапи (свіжий із Discord або збережений). */
function author(it, avatars = {}) {
  const src = avatars[it.user_id] ?? avatarUrl(it.user_id, it.avatar ?? null, 64);
  return `<div class="who">
    <img src="${esc(src)}" alt="" loading="lazy" width="24" height="24">
    <a href="/u/${esc(it.user_id)}">${esc(it.username ?? it.user_id)}</a>
  </div>`;
}

/** Кнопки правки — тільки для адміністратора (автор може правити свій підпис). */
function adminActs(it, { admin, session, lang }) {
  const canEdit = admin || session?.user_id === it.user_id;
  if (!canEdit) return '';
  const edit = `<button class="act act-edit" data-id="${it.id}" data-prompt="${esc(t(lang, 'gal.editTitle'))}"
      title="${esc(t(lang, 'gal.edit'))}">✎</button>`;
  const del = admin
    ? `<button class="act act-del danger" data-id="${it.id}" data-confirm="${esc(t(lang, 'gal.confirmDelete'))}"
        title="${esc(t(lang, 'gal.delete'))}">🗑</button>`
    : '';
  return `<div class="acts">${edit}${del}</div>`;
}

function timeAgo(ms, lang) {
  const d = Math.floor((Date.now() - Number(ms)) / 86400_000);
  if (d <= 0) return lang === 'en' ? 'today' : 'сьогодні';
  if (d === 1) return lang === 'en' ? 'yesterday' : 'вчора';
  return lang === 'en' ? `${d} d ago` : `${d} дн. тому`;
}

/** Велика картка-переможець: кліп дня або кліп місяця. */
function spotlight(it, { label, icon, lang, liked, avatars, admin, session, delay }) {
  if (!it) {
    return `<div class="spot empty" style="animation-delay:${delay}s">
      <div class="spot-h"><i>${icon}</i>${esc(label)}</div>
      <div class="muted" style="padding:30px 0">${esc(t(lang, 'gal.noTop'))}</div>
    </div>`;
  }
  return `<div class="spot" data-item="${it.id}" style="animation-delay:${delay}s">
    <div class="spot-h"><i>${icon}</i>${esc(label)}${adminActs(it, { admin, session, lang })}</div>
    <div class="spot-m">${mediaTag(it, 'media big')}</div>
    <div class="spot-f">
      <div>
        ${it.title ? `<div class="cap">${esc(it.title)}</div>` : ''}
        ${author(it, avatars)}
      </div>
      ${likeBtn(it, liked)}
    </div>
  </div>`;
}

/** Галерея кліпів: широка сітка на всю ширину + бічна панель. */
export function galleryPage({
  items, dayTop, monthTop, liked, avatars = {}, session, admin = false,
  lang = 'uk', sort = 'new', maxMb, error, stats = {}, cinema = false, fromChannel = null,
}) {
  // Галерея прив'язана до Discord-каналу: медіа завжди лягає туди — і те,
  // що кинули в канал, і те, що завантажили тут. Сайт лише показує.
  const channelNote = fromChannel
    ? `<div class="fromch">
        <div class="fromch-i">💬</div>
        <div>
          <div class="fromch-t">#${esc(fromChannel.name)}</div>
          <div class="hint">${esc(t(lang, 'gal.fromChannel'))}</div>
        </div>
      </div>`
    : '';

  const upload = session
    ? `<form class="up" method="post" action="/upload" enctype="multipart/form-data">
        <input type="file" name="file" accept="image/*,video/mp4,video/webm" required>
        <input type="text" name="title" maxlength="120" placeholder="${esc(t(lang, 'gal.caption'))}">
        <button class="btn" type="submit">${esc(t(lang, 'gal.send'))}</button>
        <span class="hint">${esc(t(lang, 'gal.limit', { mb: maxMb }))}</span>
        ${error ? `<div class="err">${esc(error)}</div>` : ''}
      </form>`
    : `<div class="signin">
        <span class="muted">${esc(t(lang, 'gal.loginToUpload'))}</span>
        <a class="btn" href="/login?next=%2Fgallery">${esc(t(lang, 'nav.login'))}</a>
      </div>`;

  const counters = [
    [stats.items ?? 0, t(lang, 'gal.items')],
    [stats.authors ?? 0, t(lang, 'gal.authors')],
    [stats.likes ?? 0, t(lang, 'gal.likesTotal')],
  ].map(([n, l]) => `<div class="stat"><b>${fmt(n)}</b><span>${esc(l)}</span></div>`).join('');

  const side = `<aside class="gside">
    <div class="card pane">${upload}${channelNote ? `<div class="chline">${channelNote}</div>` : ''}</div>
    <div class="card pane">
      <div class="stats">${counters}</div>
      <div class="hint" style="margin-top:12px">
        ${((stats.bytes ?? 0) / 1048576).toFixed(1)} MB · ${esc(stats.where ?? 'DB')}
      </div>
    </div>
    ${cinema ? `<a class="card pane cinelink" href="/cinema">
      <b>🎬 ${esc(t(lang, 'nav.cinema'))}</b><span>${esc(t(lang, 'gal.watch'))} →</span></a>` : ''}
  </aside>`;

  const spots = `<div class="spots">
    ${spotlight(dayTop, { label: t(lang, 'gal.dayTop'), icon: '☀', lang, liked, avatars, admin, session, delay: 0.05 })}
    ${spotlight(monthTop, { label: t(lang, 'gal.monthTop'), icon: '☾', lang, liked, avatars, admin, session, delay: 0.12 })}
  </div>`;

  const tabs = `<div class="tabs">
    <span class="th">${esc(t(lang, 'gal.feed'))}</span>
    <a href="/gallery?sort=new" class="${sort === 'new' ? 'on' : ''}">${esc(t(lang, 'gal.sortNew'))}</a>
    <a href="/gallery?sort=top" class="${sort === 'top' ? 'on' : ''}">${esc(t(lang, 'gal.sortTop'))}</a>
  </div>`;

  // Плитка різної висоти — сітка виглядає живою й заповнює ширину без дір.
  const cards = items.map((it, i) => {
    const tall = it.kind === 'video' || (Number(it.id) % 5 === 0);
    return `<article class="item${tall ? ' tall' : ''}" data-item="${it.id}"
        style="animation-delay:${Math.min(i * 0.03, 0.5)}s">
      <div class="shot">
        ${mediaTag(it)}
        ${adminActs(it, { admin, session, lang })}
        <span class="badge">${it.kind === 'video' ? '▶' : (it.mime === 'image/gif' ? 'GIF' : '❖')}</span>
      </div>
      <div class="meta">
        ${it.title ? `<div class="cap">${esc(it.title)}</div>` : ''}
        <div class="row" style="justify-content:space-between;gap:10px">
          ${author(it, avatars)}
          ${likeBtn(it, liked)}
        </div>
        <div class="when">${esc(timeAgo(it.created_at, lang))}</div>
      </div>
    </article>`;
  }).join('');

  return `<div class="glayout">
    <div class="gmain">
      ${spots}
      ${tabs}
      ${items.length
        ? `<div class="grid wide">${cards}</div>`
        : `<div class="card empty rise">${esc(t(lang, 'gal.empty'))}</div>`}
    </div>
    ${side}
  </div>`;
}

/** Список черги. Малюємо і на сервері, і потім оновлюємо з JS. */
export function queueList(items, { lang = 'uk', session = null, canEdit = false } = {}) {
  if (!items.length) return `<div class="muted">${esc(t(lang, 'cin.queueEmpty'))}</div>`;
  return items.map((q, i) => {
    const mine = session && q.addedBy === session.user_id;
    return `<div class="qitem" data-id="${q.id}">
      <span class="qn">${i + 1}</span>
      <div class="qbody">
        <div class="qt">${esc(q.title ?? q.pageUrl ?? q.source)}</div>
        <div class="qa">${esc(PROVIDER_LABEL[q.provider] ?? q.provider)} · ${esc(q.addedName ?? '')}</div>
      </div>
      ${canEdit ? `<button class="act qup" data-id="${q.id}" title="${esc(t(lang, 'cin.moveUp'))}"${i === 0 ? ' disabled' : ''}>↑</button>
      <button class="act qdown" data-id="${q.id}" title="${esc(t(lang, 'cin.moveDown'))}"${i === items.length - 1 ? ' disabled' : ''}>↓</button>
      <button class="act qplay" data-id="${q.id}" title="${esc(t(lang, 'cin.playNow'))}">▶</button>` : ''}
      ${canEdit || mine ? `<button class="act qdel danger" data-id="${q.id}" title="${esc(t(lang, 'gal.delete'))}">✕</button>` : ''}
    </div>`;
  }).join('');
}

/** Журнал дій — лише для адміністратора. */
export function historyList(items, lang = 'uk') {
  if (!items.length) return `<div class="muted">—</div>`;
  const icons = {
    play: '▶', pause: '⏸', seek: '⇥', start: '🎬', stop: '⏹', next: '⏭',
    lock: '🔒', unlock: '🔓', grant: '🎛', revoke: '🚫',
    'queue.add': '＋', 'queue.remove': '✕', 'queue.clear': '🧹',
  };
  return items.map((h) => `<div class="logrow">
    <span class="li">${icons[h.action] ?? '•'}</span>
    <span class="lu">${esc(h.username ?? h.userId ?? '')}</span>
    <span class="la">${esc(t(lang, `cin.act.${h.action}`))}</span>
    ${h.detail ? `<span class="ld">${esc(h.detail)}</span>` : ''}
    <span class="lt">${new Date(h.at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}</span>
  </div>`).join('');
}

/**
 * Кінотеатр: спільний перегляд для тих, хто сидить у голосовому каналі.
 * Стан тримає сервер; сторінка лише показує його й підганяє відео.
 */
export function cinemaPage({ state, session, lang = 'uk', host = '' }) {
  const {
    channel, viewers, admin, canControl, source, title,
    provider = 'file', syncMode = 'full', pageUrl,
  } = state;

  // Конфіг плеєра віддаємо одним JSON — клієнт сам обере адаптер.
  const cfg = esc(JSON.stringify({
    src: source ?? '', provider, host, sync: syncMode, pageUrl: pageUrl ?? null, admin,
    canControl, canEdit: state.canEdit, me: session?.user_id ?? null,
    queueLen: (state.queue ?? []).length,
    variants: state.variants ?? [],
    hardPause: state.hardPause !== false,
    failText: t(lang, 'cin.playFailed'), frameText: t(lang, 'cin.showSite'),
  }));
  const limited = syncMode !== 'full';
  // керування доступне лише з голосового каналу
  const locked = !canControl;

  // Анімацію появи вішаємо на саму кімнату: обгортка з transform стала б
  // containing block і зламала б позиціонування в повноекранному режимі.
  const room = `<div class="room rise" id="cin-room">
    <div class="room-h">
      <div class="room-id">
        <div class="room-t">${esc(title ?? t(lang, 'cin.nothing'))}</div>
        <div class="room-meta">
          <span class="room-s" id="cin-status"
            data-live="${esc(t(lang, 'cin.live'))}" data-paused="${esc(t(lang, 'cin.paused'))}">—</span>
          ${source ? `<span class="tagp">${esc(PROVIDER_LABEL[provider] ?? provider)}</span>` : ''}
          ${limited && source ? `<span class="tagp warn">${esc(t(lang, 'cin.cueOnly'))}</span>` : ''}
        </div>
      </div>
      ${channel ? `<div class="vc"><span class="dotlive"></span>${esc(channel.name)}</div>` : ''}
    </div>

    <div class="stagewrap">
    <div class="curtain" id="cin-curtain" hidden>
      <div class="curtain-i">⏸</div>
      <div class="curtain-t">${esc(t(lang, 'cin.paused'))}</div>
      <div class="curtain-h" id="cin-curtain-h"></div>
    </div>
    <div class="screen${source ? '' : ' idle'}" id="cin-stage" data-cfg="${cfg}"
      data-ok-text="${esc(t(lang, 'cin.controllable'))}"
      data-resume="${esc(t(lang, 'cin.resumeAt'))}"
      data-manual="${esc(t(lang, 'cin.pauseManually'))}">
      ${source ? '' : `<div class="idle-t">${esc(t(lang, 'cin.nothing'))}</div>`}
    </div>
    </div>

    <div class="cbar">
      <button class="btn play" id="cin-toggle"
        ${source && !locked ? '' : ' disabled'}
        title="${locked ? esc(t(lang, 'cin.controlLocked')) : ''}">▶</button>
      <button class="btn icon" id="cin-next" title="${esc(t(lang, 'cin.next'))}"
        ${state.canEdit && (state.queue ?? []).length ? '' : ' disabled'}>⏭</button>
      <div class="seek" id="cin-seek" data-admin="${admin && !limited && !locked ? '1' : '0'}">
        <i id="cin-fill"></i><b id="cin-knob"></b>
      </div>
      <span class="tm" id="cin-time">0:00</span>

      <div class="vol" id="cin-vol">
        <button class="btn icon flat" id="cin-mute" title="${esc(t(lang, 'cin.volume'))}">🔊</button>
        <input type="range" id="cin-volrange" min="0" max="100" value="100"
          aria-label="${esc(t(lang, 'cin.volume'))}">
      </div>

      <details class="qual" id="cin-voice"${state.variants?.length > 1 ? '' : ' hidden'}>
        <summary title="${esc(t(lang, 'cin.voice'))}">🎧 <b id="cin-vlabel">${esc(state.variants?.[0]?.label ?? '')}</b></summary>
        <div class="qmenu">
          ${(state.variants ?? []).map((v, i) => `<button class="vopt${i === 0 ? ' on' : ''}"
            data-i="${i}" data-label="${esc(v.label)}">${esc(v.label)}</button>`).join('')}
        </div>
      </details>

      <details class="qual" id="cin-qual"${state.qualities?.length > 1 ? '' : ' hidden'}>
        <summary title="${esc(t(lang, 'cin.quality'))}"><b id="cin-qlabel">${esc(state.qualities?.[0]?.label ?? 'auto')}</b></summary>
        <div class="qmenu">
          ${(state.qualities ?? []).map((q, i) => `<button class="qopt${i === 0 ? ' on' : ''}" data-url="${esc(q.url)}"
            data-label="${esc(q.label)}">${esc(q.label)}</button>`).join('')}
        </div>
      </details>

      ${admin || limited ? '' : `<span class="hint lock">🔒 ${esc(t(lang, 'cin.seekLocked'))}</span>`}
      ${limited && state.canEdit ? `<button class="btn icon${state.hardPause ? ' on' : ''}" id="cin-hard"
        title="${esc(t(lang, 'cin.hardPauseToggle'))}">⏻</button>` : ''}
      <button class="btn icon" id="cin-full" title="${esc(t(lang, 'cin.fullscreen'))}"${source ? '' : ' disabled'}>⛶</button>
    </div>

    <!-- Смуга внизу екрана: єдиний спосіб повернути сховану панель, коли зверху
         лежить рамка чужого плеєра — рухи миші над нею до сторінки не доходять. -->
    <div class="wakezone" id="cin-wake" aria-hidden="true">
    </div>
    ${limited && source ? `<div class="note">${esc(t(lang, 'cin.hardMode'))}</div>` : ''}
  </div>`;

  const people = `<div class="card pane">
    <div class="pane-h">${esc(t(lang, 'cin.viewers'))} · <b id="cin-count">${viewers.length}</b></div>
    <div class="viewers" id="cin-viewers" data-grant="${esc(t(lang, 'cin.grant'))}"
      data-pause="${esc(t(lang, 'cin.canPause'))}">
      ${viewers.map((v) => `<div class="viewer" data-user="${esc(v.id)}">
        <img src="${esc(v.avatar)}" alt=""><span class="vname">${esc(v.name)}</span>
        ${admin ? `<button class="act ctl${(state.blocked ?? []).includes(v.id) ? '' : ' on'}"
          data-user="${esc(v.id)}" title="${esc(t(lang, 'cin.canPause'))}">⏯</button>
        <button class="act grant${(state.editors ?? []).includes(v.id) ? ' on' : ''}"
          data-user="${esc(v.id)}" title="${esc(t(lang, 'cin.grant'))}">🎛</button>` : ''}
      </div>`).join('') || `<div class="muted">${esc(t(lang, 'cin.roomEmpty'))}</div>`}
    </div>
  </div>`;

  // Додавати в чергу може будь-хто з залу; запускати одразу — хто керує сеансом.
  const addBox = `<div class="card pane addbox">
    <div class="pane-h">${esc(state.canEdit ? t(lang, 'cin.admin') : t(lang, 'cin.addQueue'))}</div>
    <div class="up">
      <input type="text" id="cin-src" placeholder="${esc(t(lang, 'cin.setSource'))}">
      <input type="text" id="cin-title" placeholder="${esc(t(lang, 'cin.setTitle'))}">
      <input type="text" id="cin-ref" placeholder="${esc(t(lang, 'cin.setReferer'))}">
      <div class="row" style="gap:10px;flex-wrap:wrap">
        <button class="btn" id="cin-queue">＋ ${esc(t(lang, 'cin.queueAdd'))}</button>
        ${state.canEdit ? `<button class="btn ghost" id="cin-load">${esc(t(lang, 'cin.load'))}</button>` : ''}
        ${state.canEdit ? `<button class="btn ghost" id="cin-stop">${esc(t(lang, 'cin.stop'))}</button>` : ''}
      </div>
    </div>
  </div>`;

  const queueBox = `<div class="card pane queuebox">
    <div class="pane-h">${esc(t(lang, 'cin.queue'))} · <b id="cin-qcount">${(state.queue ?? []).length}</b>
      ${admin && (state.queue ?? []).length ? `<button class="act" id="cin-qclear"
        title="${esc(t(lang, 'cin.queueClear'))}">🧹</button>` : ''}</div>
    <div class="queue" id="cin-queue-list" data-empty="${esc(t(lang, 'cin.queueEmpty'))}"
      data-up="${esc(t(lang, 'cin.moveUp'))}" data-down="${esc(t(lang, 'cin.moveDown'))}"
      data-play="${esc(t(lang, 'cin.playNow'))}">${
      queueList(state.queue ?? [], { lang, session, canEdit: state.canEdit })}</div>
  </div>`;

  // Кому видані права — окремим списком, щоб забрати їх можна було й тоді,
  // коли людини зараз немає в каналі.
  const editorsBox = admin && (state.editorList ?? []).length
    ? `<div class="card pane">
        <div class="pane-h">${esc(t(lang, 'cin.editors'))}</div>
        <div class="viewers">
          ${state.editorList.map((e) => `<div class="viewer">
            <img src="${esc(e.avatar)}" alt=""><span>${esc(e.name)}</span>
            <button class="act grant on" data-user="${esc(e.id)}"
              title="${esc(t(lang, 'cin.revoke'))}">🎛</button>
          </div>`).join('')}
        </div>
      </div>`
    : '';

  const historyBox = admin
    ? `<details class="card pane hist">
        <summary class="pane-h">${esc(t(lang, 'cin.history'))}
          <b>${(state.history ?? []).length}</b><i class="chev"></i></summary>
        <div class="log" id="cin-log">${historyList(state.history ?? [], lang)}</div>
      </details>`
    : '';

  const lockBox = admin
    ? `<div class="card pane">
        <div class="pane-h">${esc(t(lang, 'cin.lock'))}</div>
        ${state.lockedUntil
          ? `<div class="locked-now">🔒 ${esc(t(lang, 'cin.lockedUntil', { time: new Date(state.lockedUntil).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) }))}</div>
             <button class="btn ghost" data-lock="0">${esc(t(lang, 'cin.unlock'))}</button>`
          : `<div class="row" style="gap:8px;flex-wrap:wrap">
              ${[15, 60, 180].map((m) => `<button class="btn ghost sm" data-lock="${m}">${m} ${esc(t(lang, 'cin.min'))}</button>`).join('')}
             </div>
             <div class="hint" style="margin-top:10px">${esc(t(lang, 'cin.lockHint'))}</div>`}
      </div>`
    : '';

  const adminBox = `${addBox}${queueBox}${editorsBox}${lockBox}${historyBox}`;

  // Зал тимчасово зачинено адміністратором — для решти нічого не показуємо.
  if (!state.allowed) {
    return `<div class="card empty rise">
      <div class="gate-ico">🔒</div>
      <div style="font-size:18px">${esc(t(lang, 'cin.lockedNow'))}</div>
      <div class="hint" style="margin-top:12px">${esc(t(lang, 'cin.lockedUntil', {
        time: new Date(state.lockedUntil).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
      }))}</div>
      <div style="margin-top:20px"><a class="btn" href="/gallery">← ${esc(t(lang, 'nav.gallery'))}</a></div>
    </div>`;
  }

  // Дивитися можна завжди. Якщо керування замкнене — показуємо картку-підказку
  // поверх сторінки; вона закривається й сама зникає, щойно людина зайде в канал.
  let gate = null;
  if (locked) {
    if (!session) gate = { text: t(lang, 'cin.needAuth'), login: true };
    else if (!channel) gate = { text: t(lang, 'cin.noChannel') };
    else gate = { text: t(lang, 'cin.gateJoin', { channel: channel.name }), waiting: true };
  }

  const modal = gate
    ? `<div class="gate-back" id="cin-gate">
        <div class="gate-box">
          <button class="gate-x" id="cin-gate-x" aria-label="×">×</button>
          <div class="gate-ico">🎬</div>
          <h2>${esc(t(lang, 'cin.gateTitle'))}</h2>
          <p>${esc(gate.text)}</p>
          ${channel ? `<div class="gate-vc"><span class="dotlive"></span>${esc(channel.name)}
            · <b id="cin-count">${viewers.length}</b> ${esc(t(lang, 'cin.viewers'))}</div>` : ''}
          ${gate.login ? `<a class="btn" href="/login?next=%2Fcinema">${esc(t(lang, 'nav.login'))}</a>` : ''}
          ${gate.waiting ? `<div class="gate-wait"><i></i><i></i><i></i>${esc(t(lang, 'cin.gateWaiting'))}</div>` : ''}
          <button class="btn ghost" id="cin-gate-watch">${esc(t(lang, 'cin.watchAnyway'))}</button>
        </div>
      </div>`
    : '';

  // Плеєр на всю ширину, а вся службова інформація — під ним рядом карток.
  return `<div class="clayout">
    ${room}
    <div class="cpanels">${people}${adminBox}</div>
  </div>${modal}`;
}

/**
 * Панель модерації на сайті. Показується лише тим, хто має доступ, —
 * і сторінка, і дії перевіряються на сервері, а не тільки схованою кнопкою.
 */
/**
 * Спадне меню в стилі сайту. Нативний <select> не піддається оформленню
 * (список малює операційна система), тому будуємо своє на <details> —
 * так само, як перемикач мов.
 */
export function dropdown(id, options, label = '') {
  const [firstValue, firstLabel] = options[0] ?? ['', '—'];
  return `<details class="drop" id="${esc(id)}" data-value="${esc(firstValue)}">
    <summary>
      ${label ? `<span class="drop-l">${esc(label)}</span>` : ''}
      <b class="drop-v">${esc(firstLabel)}</b><i class="chev"></i>
    </summary>
    <div class="drop-menu">
      ${options.map(([v, l], i) => `<button type="button" class="drop-opt${i === 0 ? ' on' : ''}"
        data-value="${esc(v)}">${esc(l)}</button>`).join('')}
    </div>
  </details>`;
}

export function modPage({
  active = [], warns = [], warnLimit = 3, journal = [], who = {},
  lang = 'uk', limitMinutes = 0, kinds = {},
}) {
  const name = (id) => esc(who[id]?.name ?? id);
  const face = (id) => esc(who[id]?.avatar ?? avatarUrl(id, null, 64));

  const KIND_ICON = { text: '💬', voice: '🔊', full: '⛔' };

  const durations = [
    [10, '10 хв'], [60, '1 год'], [360, '6 год'],
    [1440, '1 день'], [10080, 'тиждень'], [0, 'до зняття'],
  ].filter(([m]) => !limitMinutes || (m && m <= limitMinutes));

  const form = `<div class="card pane">
    <div class="pane-h">${esc(t(lang, 'mod.apply'))}</div>
    <div class="up">
      <!-- вибір учасника з пошуком: ID вписувати не треба -->
      <div class="picker" id="mod-picker" data-need="${esc(t(lang, 'mod.needMember'))}">
        <button class="pick-btn" id="mod-pick" type="button">
          <span class="pick-face" id="mod-face"></span>
          <span id="mod-name">${esc(t(lang, 'mod.pickMember'))}</span>
          <i class="chev"></i>
        </button>
        <div class="pick-menu" id="mod-menu" hidden>
          <input type="text" class="pick-search" id="mod-search"
            placeholder="${esc(t(lang, 'mod.search'))}" autocomplete="off">
          <div class="pick-list" id="mod-list" data-empty="${esc(t(lang, 'mod.noMembers'))}"></div>
        </div>
        <input type="hidden" id="mod-user">
      </div>

      <div class="kindrow">
        ${['text', 'voice', 'full'].map((k, i) => `<button class="btn ghost sm pick-el kindbtn${i === 0 ? ' on' : ''}"
          data-kind="${k}">${KIND_ICON[k]} <span class="kl">${esc(kinds[k] ?? k)}</span></button>`).join('')}
        <button class="btn ghost sm pick-el kindbtn" data-kind="warn">⚠️ <span class="kl">${esc(t(lang, 'mod.warn'))}</span></button>
      </div>

      ${dropdown(
    'mod-dur',
    [...durations.map(([m, l]) => [String(m), l]), ['custom', t(lang, 'mod.custom')]],
    t(lang, 'mod.duration'),
  )}
      <!-- своє значення: число + одиниця, показується лише коли обрано «свій час» -->
      <div class="row custom-dur" id="mod-custom" hidden style="gap:8px">
        <input type="number" id="mod-num" min="1" max="99999" value="30"
          aria-label="${esc(t(lang, 'mod.duration'))}">
        ${dropdown('mod-unit', [
    ['1', t(lang, 'mod.minutes')],
    ['60', t(lang, 'mod.hours')],
    ['1440', t(lang, 'mod.days')],
  ])}
      </div>

      <input type="text" id="mod-reason" placeholder="${esc(t(lang, 'mod.reason'))}">
      <button class="btn" id="mod-apply">${esc(t(lang, 'mod.applyBtn'))}</button>
      <div class="hint">${limitMinutes
        ? esc(t(lang, 'mod.limit', { time: limitMinutes >= 1440 ? `${Math.round(limitMinutes / 1440)} дн.` : `${limitMinutes} хв` }))
        : esc(t(lang, 'mod.noLimit'))}</div>
      <div class="err" id="mod-err" hidden></div>
    </div>
  </div>`;

  const activeBox = `<div class="card pane">
    <div class="pane-h">${esc(t(lang, 'mod.active'))} · <b>${active.length}</b></div>
    <div class="viewers">
      ${active.length ? active.map((p) => `<div class="viewer" data-user="${esc(p.userId)}">
        <img src="${face(p.userId)}" alt="">
        <span class="vname">${name(p.userId)}</span>
        <span class="tagp">${KIND_ICON[p.kind] ?? ''} ${esc(kinds[p.kind] ?? p.kind)}</span>
        <span class="hint">${p.until ? esc(leftText(p.until, lang)) : esc(t(lang, 'mod.untilLift'))}</span>
        <button class="act danger mod-lift" data-user="${esc(p.userId)}" data-kind="${esc(p.kind)}"
          title="${esc(t(lang, 'mod.lift'))}">✕</button>
      </div>`).join('') : `<div class="muted">${esc(t(lang, 'mod.nobody'))}</div>`}
    </div>
  </div>`;

  // Попередження живуть 72 години й згасають самі; три чинні — автоматичний мут.
  const warnBox = `<div class="card pane">
    <div class="pane-h">${esc(t(lang, 'mod.warns'))} · <b>${warns.length}</b></div>
    <div class="viewers">
      ${warns.length ? warns.map((w) => `<div class="viewer" data-user="${esc(w.userId)}">
        <img src="${face(w.userId)}" alt="">
        <span class="vname">${name(w.userId)}</span>
        <span class="tagp${w.count >= warnLimit - 1 ? ' warn' : ''}">${w.count}/${warnLimit}</span>
        <span class="hint">${esc(leftText(w.soonest, lang))}</span>
        <button class="act mod-unwarn" data-user="${esc(w.userId)}"
          title="${esc(t(lang, 'mod.clearWarns'))}">🧹</button>
      </div>`).join('') : `<div class="muted">${esc(t(lang, 'mod.noWarns'))}</div>`}
    </div>
  </div>`;

  // Два рядки на запис: угорі суть, унизу хто й коли —
  // так нічого не тісниться й не обрізається до трьох літер.
  const rowsHtml = journal.map((j) => {
    const when = new Date(Number(j.created_at));
    const sys = j.moderator_id === 'system';
    return `<div class="logrow">
      <span class="li">${actIcon(j.action)}</span>
      <div class="lmain">
        <div class="ltop">
          <b class="lu">${name(j.user_id)}</b>
          <span class="la">${esc(actText(j.action, lang))}</span>
          ${j.duration_ms ? `<span class="lchip">${esc(durText(j.duration_ms))}</span>` : ''}
        </div>
        ${j.reason ? `<div class="lreason">${esc(String(j.reason).slice(0, 120))}</div>` : ''}
        <div class="lsub">
          ${sys ? esc(t(lang, 'mod.system')) : name(j.moderator_id)}
          <span class="lt">${when.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })}
            ${when.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    </div>`;
  }).join('');

  const journalBox = `<div class="card pane journalbox">
    <div class="pane-h">${esc(t(lang, 'mod.journal'))} · <b>${journal.length}</b></div>
    <div class="log">${rowsHtml || `<div class="muted">${esc(t(lang, 'mod.empty'))}</div>`}</div>
  </div>`;

  return `<div class="cpanels modgrid">${form}${activeBox}${warnBox}${journalBox}</div>`;
}

function actIcon(a) {
  if (a.startsWith('mute.')) return { 'mute.text': '💬', 'mute.voice': '🔊', 'mute.full': '⛔' }[a] ?? '🔇';
  return { unmute: '✅', warn: '⚠️', kick: '👢', ban: '🔨' }[a] ?? '•';
}

function actText(a, lang) {
  const map = {
    'mute.text': 'текстовий мут', 'mute.voice': 'голосовий мут', 'mute.full': 'повний мут',
    unmute: 'знято', warn: 'попередження', kick: 'кік', ban: 'бан',
  };
  const en = {
    'mute.text': 'text mute', 'mute.voice': 'voice mute', 'mute.full': 'full mute',
    unmute: 'lifted', warn: 'warning', kick: 'kick', ban: 'ban',
  };
  return (lang === 'en' ? en : map)[a] ?? a;
}

function durText(ms) {
  const m = Math.round(Number(ms) / 60_000);
  if (m >= 1440) return `${Math.round(m / 1440)} дн.`;
  if (m >= 60) return `${Math.round(m / 60)} год`;
  return `${m} хв`;
}

function leftText(until, lang) {
  const m = Math.max(0, Math.round((until - Date.now()) / 60_000));
  const val = m >= 1440 ? `${Math.round(m / 1440)} дн.` : (m >= 60 ? `${Math.round(m / 60)} год` : `${m} хв`);
  return lang === 'en' ? `${val} left` : `ще ${val}`;
}

export function customPage(page) {
  return `<div class="card rise"><h1 style="margin-top:0">${esc(page.title)}</h1>${page.body}</div>`;
}

export function errorPage(code, message, lang = 'uk') {
  return `<div class="card empty rise">
    <h1 style="margin:0 0 10px;font-size:56px">${code}</h1>
    <div>${esc(message)}</div>
    <div style="margin-top:22px"><a class="btn" href="/">${esc(t(lang, 'err.home'))}</a></div>
  </div>`;
}

function fmt(n) {
  return new Intl.NumberFormat('uk-UA').format(n ?? 0);
}
