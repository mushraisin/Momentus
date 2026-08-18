// Розклад по категоріях зі сторінки прибрано — назовні лишається
// саме загальне число, тож і константи категорій тут більше не потрібні.
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

/**
 * Усі поверхні, які мають слухатися обраного стилю вікон. Раніше тут були
 * лише .card і .pane, тому оформлення докочувалось до головних панелей,
 * а вікна гардероба, магазину, кінотеатру й передперегляду лишалися
 * типовими — саме через це стиль виглядав «застосованим наполовину».
 */
// Гаманець і спливні повідомлення сюди свідомо не входять: це піл і
// невеличкі плашки, а не вікна — від чужого радіуса вони лише ламаються.
const CARD_SURFACES = [
  '.card', '.pane', '.pv', '.pf-lookwin', '.lbox', '.gate-box',
  '.cdrawer', '.drop-menu', '.pick-menu', '.langmenu',
  // галерея й кінотеатр: плитки стрічки, «кліп дня/місяця» і сам зал
  '.item', '.spot', '.room', '.sh-card',
].join(',');

const DISCORD_ICON = `<svg viewBox="0 0 127 96" aria-hidden="true"><path fill="currentColor" d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69Z"/></svg>`;

// ─────────────────────────────────────────────
//  CSS
// ─────────────────────────────────────────────
export const BASE_CSS = `
/* Inter постачається з проєктом. Раніше CSS просив його на віру, і браузер
   тихо брав системний — через це сайт і картки бота, які малюються справжнім
   Inter, виглядали різними шрифтами. */
@font-face{font-family:'Inter';font-style:normal;font-weight:100 900;
  font-display:swap;src:url(/vendor/inter.ttf) format('truetype')}
:root{
  --bg0:#05070d;--card:rgba(22,27,40,.72);--line:rgba(255,255,255,.08);
  --text:#eef2f9;--dim:#8e9bb3;--good:#43c47b;--mid:#e9b949;--bad:#ef5350;
  /* Акцент задано трьома токенами: основний, світліший (наведення) і темніший
     (низ градієнта). Усе оформлення бере саме їх, тож обраний колір діє
     і в спокої, і під курсором — інакше hover повертав би типовий синій. */
  --accent:#6b7cff;--accent-lo:#5b6bf0;--accent-hi:#7d8bff;--accent-up:#8b97ff;
  /* Той самий акцент числами — для напівпрозорих підсвіток, обведень і тіней.
     Без цього десятки правил тримали синій жорстко вписаним, і обраний
     колір фарбував лише самі кнопки, а їхній фон, рамки та світіння
     лишалися типовими. */
  --accent-rgb:107,124,255;
  /* Поверхня спливних меню й вікон. Окремий токен, бо вони мають лишатися
     читабельними навіть тоді, коли обраний стиль вікон майже прозорий. */
  --menu:rgba(14,18,30,.97);
  --radius:18px;--blur:14px;
  --discord:#5865f2;
}
*{box-sizing:border-box}

/* ── Смуги прокрутки: тонкі, у кольорах сайту, замість системних ── */
*{scrollbar-width:thin;scrollbar-color:rgba(var(--accent-rgb),.45) transparent}
*::-webkit-scrollbar{width:10px;height:10px}
*::-webkit-scrollbar-track{background:transparent}
*::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:999px;
  border:3px solid transparent;background-clip:content-box;transition:background .25s}
*::-webkit-scrollbar-thumb:hover{background:rgba(var(--accent-rgb),.55);background-clip:content-box}
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
/* ── Тло ──
   Шари розставлені явно, і це важливо: затемнювальна накладка для власної
   картинки раніше йшла після полотен у порядку документа, тож малювалась
   ПОВЕРХ них — дим і зорі зникали, щойно людина ставила свій фон.
   Тепер накладка сидить під ними й гасить лише саму картинку. */
.bg{position:fixed;inset:0;z-index:-1;overflow:hidden;background:var(--bg0);isolation:isolate}
.bg::after{z-index:0}
#fog{position:absolute;inset:-12%;width:124%;height:124%;filter:blur(34px);opacity:.62;z-index:1}
#stars{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;z-index:2}

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
/* Вміст смуги завжди однакової ширини — інакше на широких сторінках
   (галерея, кінотеатр) кнопки роз'їжджалися до країв, а на вузьких
   збігалися до центру, і шапка «стрибала» при переході. */
.topbar-in{max-width:1240px;margin:0 auto;padding:0 clamp(16px,2.4vw,28px);min-height:64px;
  display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.topbar .brand{flex:none}
.topbar nav{padding:10px 0}
header{display:flex;align-items:center;gap:12px;padding:14px 0 26px;flex-wrap:wrap;animation:fadeIn .6s both}
.brand{font-size:18px;font-weight:800;display:flex;align-items:center;gap:9px}
.brand .dot{width:9px;height:9px;border-radius:2px;background:var(--accent);box-shadow:0 0 14px var(--accent)}
nav{display:flex;gap:8px;margin-left:auto;flex-wrap:wrap;align-items:center}
nav a{padding:8px 15px;border-radius:999px;background:rgba(255,255,255,.04);
  border:1px solid var(--line);font-size:14px;transition:.28s cubic-bezier(.22,.9,.3,1)}
nav a:hover{border-color:rgba(var(--accent-rgb),.55);background:rgba(var(--accent-rgb),.12);transform:translateY(-2px)}
/* поточна сторінка в шапці — той самий вигляд «обрано», що й усюди */
nav a.active{background:linear-gradient(180deg,var(--accent-hi),var(--accent-lo));color:#fff;
  border-color:rgba(255,255,255,.35);
  box-shadow:0 0 0 3px rgba(var(--accent-rgb),.18),0 8px 20px rgba(var(--accent-rgb),.28)}
nav a.active:hover{background:linear-gradient(180deg,var(--accent-up),var(--accent))}
nav a:active{transform:scale(.96)}

/* ── Загальне шліфування ──
   Дрібниці, які видно не одразу, але без яких сайт «сирий»:
   однакове кільце фокуса з клавіатури, свій колір виділення тексту,
   плавне гортання й повага до системного «менше руху». */
:focus{outline:0}
:focus-visible{outline:2px solid rgba(var(--accent-rgb),.85);outline-offset:2px;border-radius:8px}
::selection{background:rgba(var(--accent-rgb),.35);color:#fff}
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
/* модерація — той самий вигляд «обрано», але в червоному тоні:
   це службова кнопка, і плутати її з рештою не варто */
nav a.apart.active{background:linear-gradient(180deg,#ef6b68,#d63c39);color:#fff;
  border-color:rgba(255,255,255,.35);
  box-shadow:0 0 0 3px rgba(239,83,80,.2),0 8px 20px rgba(214,60,57,.32)}
nav a.apart.active:hover{background:linear-gradient(180deg,#f47a77,#e04844)}

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
.drop summary:hover{border-color:rgba(var(--accent-rgb),.55)}
.drop[open] summary{border-color:rgba(var(--accent-rgb),.65);background:rgba(var(--accent-rgb),.12)}
.drop-l{color:var(--dim);font-size:13px}
.drop-v{margin-left:auto;font-weight:600}
.drop .chev{margin-left:0}
/* Картки мають backdrop-filter, а це власний контекст накладання: z-index
   меню всередині картки не підніме його над сусідньою карткою. Тому підіймаємо
   саму картку, поки в ній щось розкрито. Стосується всіх спадних меню й пікерів. */
.card:has(.drop[open]),.card:has(.pick-menu:not([hidden])),.pane:has(.drop[open]){
  position:relative;z-index:40}
.drop-menu{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:30;padding:6px;
  border-radius:12px;background:var(--menu);border:1px solid var(--line);
  box-shadow:0 16px 40px rgba(0,0,0,.55);display:flex;flex-direction:column;gap:2px;
  max-height:260px;overflow:auto;animation:menuIn .2s cubic-bezier(.22,.9,.3,1) both}
.drop-opt{padding:9px 11px;border:0;border-radius:9px;background:0;color:var(--text);
  font:inherit;font-size:13px;text-align:left;cursor:pointer;transition:.16s}
.drop-opt:hover{background:rgba(var(--accent-rgb),.16)}
/* обраний пункт — у спільному блоці «обрано / натиснуто» */

/* ── Вибір учасника з пошуком ── */
.picker{position:relative}
.pick-btn{width:100%;display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:12px;
  background:rgba(255,255,255,.05);border:1px solid var(--line);color:var(--text);
  font:inherit;font-size:14px;cursor:pointer;transition:.25s}
.pick-btn:hover{border-color:rgba(var(--accent-rgb),.55)}
.pick-face{width:26px;height:26px;flex:none;border-radius:50%;background:rgba(255,255,255,.08)
  center/cover no-repeat;border:1px solid var(--line)}
.pick-face.on{border-color:rgba(var(--accent-rgb),.6)}
.pick-menu{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:31;padding:8px;
  border-radius:14px;background:var(--menu);border:1px solid var(--line);
  box-shadow:0 18px 44px rgba(0,0,0,.6);animation:menuIn .2s cubic-bezier(.22,.9,.3,1) both}
.pick-menu[hidden]{display:none}
.pick-search{width:100%;padding:9px 12px;border-radius:10px;margin-bottom:6px;
  background:rgba(255,255,255,.06);border:1px solid var(--line);color:var(--text);font:inherit;font-size:13px}
.pick-list{display:flex;flex-direction:column;gap:2px;max-height:240px;overflow:auto}
.pick-row{display:flex;align-items:center;gap:10px;padding:7px 9px;border:0;border-radius:10px;
  background:0;color:var(--text);font:inherit;font-size:13px;text-align:left;cursor:pointer;transition:.16s}
.pick-row:hover{background:rgba(var(--accent-rgb),.16)}
.pick-row img{width:24px;height:24px;border-radius:50%;flex:none}
/* Колонок стільки, скільки влізе: назви покарань довгі («голосовий мут»),
   тож комірка не вужча за напис, а сам напис при потребі переходить на
   другий рядок — обрізати текст у кнопці не можна. */
.kindrow{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}
.up .kindbtn{display:flex;min-height:44px;padding:8px 12px;white-space:normal}
.up .kindbtn .kl{white-space:normal;text-align:center;line-height:1.2;
  hyphens:auto;overflow-wrap:anywhere}
@media(max-width:420px){.kindrow{grid-template-columns:1fr}}

/* місце під «✓» праворуч; де є власне правило відступів — воно повторює 28px */
.drop-opt,.qopt,.langmenu a,.pick-row{position:relative;padding-right:28px}

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
/* Підтвердження вдалої дії: кнопка зеленіє, коротко пружинить
   і показує «Готово» з галочкою — видно й кольором, і словом. */
.btn.done{background:linear-gradient(180deg,#4fd18b,#37b374)!important;color:#06210f!important;
  border-color:rgba(255,255,255,.4)!important;box-shadow:0 0 0 3px rgba(79,209,139,.24),
  0 10px 26px rgba(55,179,116,.35)!important;animation:okPop .45s cubic-bezier(.22,.9,.3,1)}
.btn.done::after{content:' ✓';font-weight:800}
@keyframes okPop{0%{transform:scale(.94)}55%{transform:scale(1.04)}100%{transform:none}}
.viewer .tagp{flex:none}
.langs{position:relative;margin-left:6px}
.langs summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;
  padding:8px 13px;border-radius:999px;background:rgba(255,255,255,.04);
  border:1px solid var(--line);font-size:13px;transition:.28s cubic-bezier(.22,.9,.3,1)}
.langs summary::-webkit-details-marker{display:none}
.langs summary:hover{border-color:rgba(var(--accent-rgb),.55);background:rgba(var(--accent-rgb),.12);transform:translateY(-2px)}
.langs summary b{font-weight:700;letter-spacing:.08em}
/* стрілка: повертається, коли меню відкрите */
.langs summary i{width:0;height:0;border:4px solid transparent;border-top-color:var(--dim);
  margin-top:3px;transition:transform .3s cubic-bezier(.22,.9,.3,1)}
.langs[open] summary{border-color:rgba(var(--accent-rgb),.65);background:rgba(var(--accent-rgb),.16)}
.langs[open] summary i{transform:rotate(180deg) translateY(3px)}
/* Меню має лягати поверх усього вмісту сторінки, а горизонтальний скрол
   меню на вузьких екранах не повинен його обрізати. */
.langs{z-index:45}
nav:has(.langs[open]){overflow:visible}
.langmenu{position:absolute;right:0;top:calc(100% + 8px);z-index:45;min-width:172px;padding:6px;
  border-radius:14px;background:var(--menu);border:1px solid var(--line);
  box-shadow:0 18px 44px rgba(0,0,0,.55);backdrop-filter:blur(10px);
  display:flex;flex-direction:column;gap:2px;animation:menuIn .26s cubic-bezier(.22,.9,.3,1) both}
/* праворуч лишаємо місце під «✓», інакше він налазить на назву мови */
.langmenu a{display:flex;align-items:center;gap:10px;padding:9px 28px 9px 11px;border-radius:10px;
  border:0;background:0;font-size:13px;transition:.2s}
.langmenu a:hover{background:rgba(var(--accent-rgb),.16);transform:none}
.langmenu a b{font-size:11px;font-weight:700;letter-spacing:.1em;color:var(--dim);min-width:22px}
.langmenu a span{color:var(--text)}
/* обрана мова — у спільному блоці «обрано / натиснуто»;
   тут лишається тільки колір напису: на акцентній заливці
   і код мови, і назва мають бути світлими, інакше зливаються */
.langmenu a.on b{color:rgba(255,255,255,.85)}
.langmenu a.on span{color:#fff}
.langmenu a.on:hover{background:linear-gradient(180deg,var(--accent-hi),var(--accent-lo))}
@keyframes menuIn{from{opacity:0;transform:translateY(-8px) scale(.97)}to{opacity:1;transform:none}}

.me{display:flex;align-items:center;gap:9px;padding:5px 6px 5px 5px;border-radius:999px;
  background:rgba(255,255,255,.05);border:1px solid var(--line);font-size:13px;animation:fadeIn .7s .2s both}
.me img{width:26px;height:26px;border-radius:50%;border:1px solid rgba(var(--accent-rgb),.6)}
.me span{max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* аватар і нік — це і є вхід у профіль */
.me-link{display:flex;align-items:center;gap:9px;padding:0;border:0;background:0;transition:.2s}
.me-link:hover{transform:none;background:0}
.me-link:hover img{border-color:rgba(var(--accent-rgb),1);box-shadow:0 0 0 3px rgba(var(--accent-rgb),.2)}
.me-link:hover span{color:#fff}
.me-out{padding:2px 7px;border-radius:999px;color:var(--dim);font-size:12px;border:0;background:0}
.me-out:hover{color:#fff;background:rgba(255,255,255,.08)}
/* ми на сторінці профілю — чип світиться, як активна кнопка в шапці */
.me.active{background:linear-gradient(180deg,var(--accent-hi),var(--accent-lo));border-color:rgba(255,255,255,.35);
  box-shadow:0 0 0 3px rgba(var(--accent-rgb),.18),0 8px 20px rgba(var(--accent-rgb),.28)}
.me.active span{color:#fff}
.me.active img{border-color:rgba(255,255,255,.7)}
.me.active .me-out{color:rgba(255,255,255,.75)}
.me.active .me-out:hover{background:rgba(255,255,255,.18)}
.signed{display:flex;align-items:center;gap:8px;font-size:13px;color:#8fe08a;letter-spacing:.04em;
  animation:fadeIn .8s .35s both}

/* ── Головна ── */
.hero{position:relative;min-height:80vh;display:flex;flex-direction:column;align-items:flex-start;
  justify-content:center;text-align:left;gap:22px;padding-left:clamp(4px,5vw,88px);padding-top:6vh;max-width:780px}
.logo{margin:0;display:flex;flex-wrap:wrap;line-height:1;
  font-size:clamp(38px,8.4vw,96px);font-weight:800;letter-spacing:.03em;text-transform:uppercase}
.logo span{color:transparent;-webkit-text-stroke:1.6px rgba(255,255,255,.9);
  text-shadow:0 0 34px rgba(var(--accent-rgb),.45);animation:letterIn .75s cubic-bezier(.2,.85,.3,1) both;
  transition:color .35s ease,text-shadow .35s ease}
.logo:hover span{color:rgba(255,255,255,.96);text-shadow:0 0 46px rgba(var(--accent-rgb),.7)}
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
.gbtn:hover{transform:translateY(-3px);border-color:rgba(var(--accent-rgb),.6);background:rgba(var(--accent-rgb),.14)}
/* службова кнопка поруч із чипом профілю — того ж розміру, іншого відтінку */
.me.modchip{border-color:rgba(239,83,80,.35);background:rgba(239,83,80,.1);
  padding:5px 13px 5px 11px;transition:.28s cubic-bezier(.22,.9,.3,1)}
.me.modchip:hover{border-color:rgba(239,83,80,.65);background:rgba(239,83,80,.2);transform:translateY(-2px)}
.me.modchip .mi{font-size:14px;line-height:1}

/* ── Картки ── */
/* Радіус, розмиття й товщина рамки — токенами: обраний стиль вікон міняє
   саме їх, тож не доводиться перебивати правило для кожної поверхні окремо. */
.card{background:var(--card);border:var(--line-w,1px) solid var(--line);
  border-radius:var(--radius);padding:22px;margin:16px 0;
  backdrop-filter:blur(var(--blur));-webkit-backdrop-filter:blur(var(--blur));
  transition:.35s cubic-bezier(.22,.9,.3,1)}
.row{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.avatar{width:76px;height:76px;border-radius:50%;border:3px solid var(--accent);animation:pop .6s both}
.name{font-size:25px;font-weight:800}
.pill{display:inline-block;padding:4px 13px;border-radius:999px;font-size:13px;font-weight:700;
  background:rgba(var(--accent-rgb),.16);border:1px solid rgba(var(--accent-rgb),.45)}
/* Рейтинг: число, під ним підпис, ще нижче — гаманець.
   Усе в стовпчик по центру, інакше чип тулиться збоку до підпису. */
.score{margin-left:auto;display:flex;flex-direction:column;align-items:center;gap:6px;
  text-align:center;flex:none}
.score b{font-size:38px;line-height:1;color:#fff}
.score span{font-size:11px;color:var(--dim);letter-spacing:.14em;line-height:1}
/* Гаманець — не другий рейтинг: дрібний чип під підписом */
.fpchip{display:inline-flex;align-items:center;gap:5px;margin-top:2px;padding:4px 11px;
  border-radius:999px;font-size:12px;font-weight:700;color:#f0d79a;line-height:1.3;
  background:rgba(224,180,92,.12);border:1px solid rgba(224,180,92,.3)}
.fpchip i{font-style:normal;font-size:11px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:18px}
.tile{background:rgba(255,255,255,.035);border:1px solid var(--line);border-radius:14px;padding:15px;
  transition:.3s;animation:fadeUp .5s both}
.tile:hover{background:rgba(var(--accent-rgb),.1);transform:translateY(-3px)}
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
tbody tr:hover{background:rgba(var(--accent-rgb),.08)}
td.rank{width:56px;color:var(--dim);font-weight:800}
td.num{text-align:right;font-weight:800}
.mini{width:28px;height:28px;border-radius:50%;vertical-align:middle;margin-right:10px}

/* ── Галерея ── */
/* ── Плитка стрічки ──
   Усі картки однакові, як у відеосервісах: прев'ю рівно 16:9 незалежно від
   того, що всередині, під ним стала за висотою підпис-панель. Різні
   пропорції медіа ховаються всередині прев'ю (object-fit: cover),
   тож сітка виходить рівною, без сходинок і дір. */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:16px}
.item{display:flex;flex-direction:column;background:var(--card);border:var(--line-w,1px) solid var(--line);
  border-radius:var(--radius);overflow:hidden;animation:fadeUp .5s both;transition:.35s cubic-bezier(.22,.9,.3,1)}
.item:hover{transform:translateY(-4px);border-color:rgba(var(--accent-rgb),.35)}
.item .media{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;background:#05070d;cursor:zoom-in}
.item video.media{cursor:zoom-in;pointer-events:none}
.spot-m{cursor:zoom-in}
.spot-m video.media{pointer-events:none}
/* натяк, що плитку можна розгорнути */
.item .shot::after{content:'⤢';position:absolute;right:10px;bottom:10px;width:28px;height:28px;
  display:flex;align-items:center;justify-content:center;border-radius:9px;font-size:13px;
  color:#fff;background:rgba(8,11,19,.7);border:1px solid rgba(255,255,255,.14);
  opacity:0;transform:translateY(4px);transition:.25s;pointer-events:none}
.item:hover .shot::after{opacity:1;transform:none}
/* Підпис-панель: назва, під нею автор і дата, лайк праворуч —
   висота стала, тож нижні краї карток стоять на одній лінії. */
.item .meta{display:grid;grid-template-columns:minmax(0,1fr) auto;
  gap:4px 10px;padding:12px 14px;align-items:center;flex:1}
.item .cap{grid-column:1;grid-row:1;font-size:14px;line-height:1.35;font-weight:600;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
  min-height:2.7em;margin:0}
.item .who{grid-column:1;grid-row:2;font-size:12px;color:var(--dim);
  display:flex;align-items:center;gap:7px;min-width:0}
.item .who img{width:24px;height:24px;border-radius:50%;flex:none}
.item .who a{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.item .when{grid-column:1;grid-row:3;font-size:11px;margin:0}
.item .like{grid-column:2;grid-row:1/span 3;align-self:center;margin-top:0}

/* ── Розкладка галереї: сітка на всю ширину + бічна панель ── */
.glayout{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:22px;align-items:start}
.gside{position:sticky;top:18px;display:flex;flex-direction:column;gap:16px}
.pane{padding:18px;transition:border-color .3s}
/* Під курсором рамка світлішає в бік акценту, а не типового білого:
   раніше наведення збивало обраний колір рамки на стандартний, і стиль
   вікон виглядав так, ніби він то є, то нема. */
.pane:hover{border-color:rgba(var(--accent-rgb),.34)}
.pane-h{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;
  color:var(--dim);margin-bottom:13px;padding-bottom:11px;border-bottom:1px solid var(--line)}
.pane-h b{color:var(--text);font-variant-numeric:tabular-nums}
.signin{display:flex;flex-direction:column;gap:12px;align-items:flex-start}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;text-align:center}
.stat b{display:block;font-size:22px;font-weight:800}
.stat span{font-size:11px;color:var(--dim);letter-spacing:.06em;text-transform:uppercase}
.cinelink{display:flex;align-items:center;justify-content:space-between;gap:10px;
  transition:.3s cubic-bezier(.22,.9,.3,1)}
.cinelink:hover{transform:translateY(-3px);border-color:rgba(var(--accent-rgb),.5)}
.cinelink span{color:var(--dim);font-size:13px}
.grid.wide{grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:18px}
.item .shot{position:relative;overflow:hidden}
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
.act:hover{border-color:rgba(var(--accent-rgb),.6);background:rgba(var(--accent-rgb),.2)}
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
/* Зал бере обраний стиль вікон, як і решта поверхонь: раніше тут стояв
   власний вписаний градієнт, тож кінотеатр лишався типовим навіть тоді,
   коли весь інший сайт уже був у обраному стилі. */
.room{position:relative;background:var(--card);
  border:var(--line-w,1px) solid var(--line);border-radius:var(--radius);padding:16px;overflow:hidden;
  backdrop-filter:blur(var(--blur));-webkit-backdrop-filter:blur(var(--blur));
  box-shadow:0 24px 70px rgba(0,0,0,.45)}
/* тонкий світлий кант зверху — картка перестає бути пласкою */
.room::after{content:'';position:absolute;left:16px;right:16px;top:0;height:1px;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.16),transparent);pointer-events:none}
.room-h{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}
.room-r{display:flex;align-items:center;gap:10px;flex:none}

/* ── Шухляда з налаштуваннями сеансу ──
   Джерело, зал, права й історія потрібні зрідка, тож не займають сторінку:
   виїжджають збоку поверх залу й так само зникають. */
.cdrawer{position:fixed;right:0;top:0;bottom:0;width:min(430px,92vw);z-index:60;
  display:flex;flex-direction:column;
  background:linear-gradient(180deg,rgba(16,20,32,.98),rgba(11,14,24,.98));
  border-left:1px solid var(--line);box-shadow:-24px 0 70px rgba(0,0,0,.6);
  backdrop-filter:blur(14px);animation:drawerIn .32s cubic-bezier(.22,.9,.3,1) both}
@keyframes drawerIn{from{transform:translateX(28px);opacity:0}to{transform:none;opacity:1}}
.cdrawer-h{display:flex;align-items:center;justify-content:space-between;gap:12px;flex:none;
  padding:18px 20px;border-bottom:1px solid var(--line);font-size:15px;letter-spacing:.02em}
.cdrawer-h .gate-x{position:static}
.cdrawer-b{flex:1;overflow:auto;padding:16px 18px 26px}
.cdrawer-b .card{margin:0 0 14px;background:rgba(255,255,255,.03)}
.cdrawer-back{position:fixed;inset:0;z-index:59;background:rgba(3,5,10,.6);
  backdrop-filter:blur(3px);animation:fadeIn .25s both}
@media(max-width:620px){.cdrawer{width:100%;border-left:0}}
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
  box-shadow:0 0 0 1px rgba(0,0,0,.5) inset,0 18px 60px rgba(var(--accent-rgb),.10);
  transition:box-shadow .6s ease}

/* ── Атмосфера залу ──
   Поки йде показ, від екрана розходиться мʼяке світло, а сама кімната
   темнішає — як у залі, де погасили лампи. Ефект чисто на тінях
   і прозорості: жодних важких фільтрів, тож не гальмує. */
.stagewrap::before{content:'';position:absolute;left:6%;right:6%;top:14%;bottom:-6%;z-index:0;
  border-radius:50%;pointer-events:none;opacity:0;transition:opacity .8s ease;
  background:radial-gradient(ellipse at center,rgba(var(--accent-rgb),.30),rgba(var(--accent-rgb),0) 70%);
  filter:blur(46px)}
.room.live .stagewrap::before{opacity:1;animation:glowBreath 7s ease-in-out infinite}
@keyframes glowBreath{0%,100%{opacity:.75}50%{opacity:1}}
.room.live .screen{box-shadow:0 0 0 1px rgba(0,0,0,.5) inset,0 26px 90px rgba(var(--accent-rgb),.28)}
/* світло зі сцени лягає на саму кімнату */
.room.live{border-color:rgba(var(--accent-rgb),.28)}
/* поки дивимось — усе стороннє тьмяніє, щоб не тягнуло око на себе;
   клас вішаємо просто на самі панелі, без залежності від батька */
.cpanels{transition:opacity .5s ease}
.cpanels.dim{opacity:.5}
.cpanels.dim:hover{opacity:1}
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
  background:linear-gradient(180deg,var(--accent-hi),var(--accent-lo));box-shadow:0 8px 22px rgba(var(--accent-rgb),.35)}
.btn.play:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 12px 28px rgba(var(--accent-rgb),.5)}
.btn.play:disabled{opacity:.4;cursor:not-allowed;transform:none;box-shadow:none}
.btn.ghost{background:rgba(255,255,255,.05);border:1px solid var(--line)}
/* Смуга тонка, але з високою зоною влучання — по ній зручно клікати */
/* Смуга часу: тонка в спокої, товща під курсором — влучити легше,
   а сама панель від цього не «дихає», бо висота елемента стала. */
.seek{position:relative;flex:1;min-width:180px;height:22px;display:flex;align-items:center;cursor:default}
.seek::before{content:'';position:absolute;left:0;right:0;top:50%;height:5px;margin-top:-2.5px;
  border-radius:999px;background:rgba(255,255,255,.1);transition:height .18s,margin-top .18s}
.seek[data-admin="1"]{cursor:pointer}
.seek i{position:absolute;left:0;top:50%;height:5px;margin-top:-2.5px;width:0;border-radius:999px;
  background:linear-gradient(90deg,#6b7cff,#9b6bff);
  box-shadow:0 0 14px rgba(var(--accent-rgb),.55);
  transition:width .25s linear,height .18s,margin-top .18s}
.seek b{position:absolute;top:50%;left:0;width:13px;height:13px;margin:-6.5px 0 0 -6.5px;border-radius:50%;
  background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.6);opacity:0;transform:scale(.6);
  transition:opacity .2s,transform .2s}
.seek[data-admin="1"]:hover::before,.seek[data-admin="1"]:hover i{height:8px;margin-top:-4px}
.seek[data-admin="1"]:hover b{opacity:1;transform:scale(1)}
.seek[data-admin="1"]:hover i{box-shadow:0 0 20px rgba(var(--accent-rgb),.8)}
.tm{font-size:13px;color:var(--dim);font-variant-numeric:tabular-nums}
.btn.icon{width:40px;height:40px;padding:0;flex:none;border-radius:12px;font-size:15px;
  background:rgba(255,255,255,.05);border:1px solid var(--line);color:var(--text)}
.btn.icon:hover{border-color:rgba(var(--accent-rgb),.55);background:rgba(var(--accent-rgb),.14)}
.btn.icon:disabled{opacity:.4;cursor:not-allowed;transform:none;box-shadow:none}
/* увімкнений перемикач у панелі — той самий вигляд «обрано», що й усюди
   (сам колір задає спільний блок у кінці стилів) */
.btn.icon.on{border-color:rgba(255,255,255,.35)}
/* головна кнопка панелі — пуск/пауза; решта тихіші, щоб око не розбігалося */
.cbar .btn.play{width:46px;height:46px;padding:0;flex:none;border-radius:14px;font-size:17px;
  display:inline-flex;align-items:center;justify-content:center}
.cbar .btn.play:disabled{opacity:.45;box-shadow:none;transform:none;cursor:not-allowed}

/* ── Завіса на паузі: пояснює, що коїться, замість чорного екрана ── */
.stagewrap{position:relative;display:flex;flex-direction:column;min-height:0}
.stagewrap>.screen{flex:1 1 auto;min-height:0}

/* ── Живе світло від кадру ──
   Полотно 32×18 із кадром, розтягнуте на всю сцену й розмите до плям:
   темні сцени світять тьмяно, яскраві — заливають зал своїм кольором.
   Лежить під екраном і не ловить кліки. */
.ambient{position:absolute;left:-6%;right:-6%;top:-4%;bottom:-10%;width:112%;height:114%;
  z-index:0;pointer-events:none;opacity:0;border-radius:50%;
  filter:blur(58px) saturate(1.7);transform:translateZ(0);
  transition:opacity .9s ease}
/* Два полотна по черзі: нове проявляється поверх старого, тож колір
   переходить плавно, а не смикається на кожному кадрі.
   Обидва лежать НИЖЧЕ сцени: інакше верхнє полотно щосекунди накривало
   саме відео (у сцени z-index був автоматичний, тобто нижчий). */
.ambient,.ambient.next{z-index:0}
.stagewrap>.screen,.stagewrap>.curtain{position:relative;z-index:2}
.room.live .ambient.show{opacity:.62}
/* довший перехід — світло перетікає, а не блимає */
.room.live .ambient{transition:opacity 1.4s cubic-bezier(.4,0,.3,1)}
/* У повному екрані сцена займає весь екран, тож світлу нема куди вийти
   за її межі. Робимо саму сцену прозорою: чорні поля навколо кадру
   перестають бути глухими, і крізь них видно те саме світло. */
.room.fs .ambient,.room:fullscreen .ambient,.room:-webkit-full-screen .ambient{
  left:0;right:0;top:0;bottom:0;width:100%;height:100%;
  filter:blur(90px) saturate(1.75);border-radius:0}
.room.fs.live .ambient.show,.room:fullscreen.live .ambient.show{opacity:.7}
.room.fs .screen,.room:fullscreen .screen,.room:-webkit-full-screen .screen{background:transparent}
.room.fs .screen .cin-media,.room:fullscreen .screen .cin-media,
.room:-webkit-full-screen .screen .cin-media{background:transparent}
/* коли кадр узяти неможливо (чужа рамка, захищений потік) — лишається
   рівне акцентне сяйво, тож порожнеча однаково не чорна */
.stagewrap.noframe::before{opacity:1}
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
  border-radius:50%;background:#fff;box-shadow:0 0 10px rgba(var(--accent-rgb),.7);cursor:pointer}
.vol input[type=range]::-moz-range-thumb{width:13px;height:13px;border:0;border-radius:50%;background:#fff}
.btn.icon.flat{width:34px;height:34px;background:0;border:0;font-size:15px}
.btn.icon.flat:hover{background:rgba(255,255,255,.08)}

/* ── Якість ── */
.qual{position:relative;flex:none}
.qual[hidden]{display:none}
.qual summary{list-style:none;cursor:pointer;padding:8px 12px;border-radius:10px;font-size:12px;
  letter-spacing:.06em;background:rgba(255,255,255,.05);border:1px solid var(--line);transition:.25s}
.qual summary::-webkit-details-marker{display:none}
.qual summary:hover{border-color:rgba(var(--accent-rgb),.55)}
.qmenu{position:absolute;right:0;bottom:calc(100% + 8px);z-index:30;min-width:118px;padding:6px;
  border-radius:12px;background:var(--menu);border:1px solid var(--line);
  box-shadow:0 16px 40px rgba(0,0,0,.55);display:flex;flex-direction:column;gap:2px;
  animation:menuIn .22s cubic-bezier(.22,.9,.3,1) both}
/* пункти меню якості й озвучки виглядають однаково — це один і той самий
   спосіб вибору, лише різні списки */
.qopt,.vopt,.sopt{padding:8px 28px 8px 11px;border:0;border-radius:8px;background:0;color:var(--text);
  font:inherit;font-size:13px;text-align:left;cursor:pointer;transition:.18s;position:relative}
.qopt:hover,.vopt:hover,.sopt:hover{background:rgba(var(--accent-rgb),.16)}
/* увімкнені субтитри видно й по самій кнопці, не лише в списку */
#cin-subs.lit summary{border-color:rgba(var(--accent-rgb),.6);background:rgba(var(--accent-rgb),.16);color:#fff}
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
.qitem:hover{border-color:rgba(var(--accent-rgb),.4);background:rgba(var(--accent-rgb),.07);transform:translateX(2px)}
.qn{width:22px;height:22px;flex:none;display:flex;align-items:center;justify-content:center;
  border-radius:50%;background:rgba(255,255,255,.06);font-size:11px;color:var(--dim);font-weight:700}
.qitem:first-child .qn{background:rgba(var(--accent-rgb),.25);color:#fff}
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
.act.grant.on{background:rgba(var(--accent-rgb),.25);border-color:rgba(var(--accent-rgb),.6)}
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
.lchip{padding:1px 7px;border-radius:999px;background:rgba(var(--accent-rgb),.16);
  border:1px solid rgba(var(--accent-rgb),.3);font-size:11px;white-space:nowrap}
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
  box-shadow:0 0 0 2px rgba(var(--accent-rgb),.14)}
.gate{font-size:44px;margin-bottom:14px}
@media(max-width:980px){
  .glayout{grid-template-columns:1fr}
  .gside{position:static;order:-1}
}

/* ── Кліпи дня та місяця ── */
.spots{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin:22px 0}
.spot{position:relative;background:var(--card);border:var(--line-w,1px) solid var(--line);border-radius:var(--radius);
  padding:16px;animation:fadeUp .6s both;transition:.4s cubic-bezier(.22,.9,.3,1);overflow:hidden}
.spot::before{content:'';position:absolute;inset:-1px;border-radius:var(--radius);pointer-events:none;
  border:1px solid transparent;transition:.4s}
.spot:hover{transform:translateY(-4px)}
.spot:hover::before{border-color:rgba(var(--accent-rgb),.45);box-shadow:0 0 40px rgba(var(--accent-rgb),.14) inset}
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
.tabs a:hover{transform:translateY(-2px);border-color:rgba(var(--accent-rgb),.5)}
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
.up input[type=text]:focus,.up input[type=number]:focus{outline:0;border-color:rgba(var(--accent-rgb),.6);
  background:rgba(255,255,255,.07);box-shadow:0 0 0 3px rgba(var(--accent-rgb),.16)}
.up input::placeholder{color:var(--dim)}
/* рідна кнопка вибору файлу — у тому ж стилі, що й решта кнопок сайту */
.up input[type=file]::file-selector-button{margin-right:12px;padding:8px 14px;border-radius:10px;
  background:rgba(255,255,255,.05);border:1px solid var(--line);color:var(--text);
  font:inherit;font-weight:600;cursor:pointer;transition:.2s}
.up input[type=file]:hover::file-selector-button{border-color:rgba(var(--accent-rgb),.55);
  background:rgba(var(--accent-rgb),.16);color:#fff}
/* Головна дія («Застосувати», «Опублікувати») — той самий вигляд,
   що й «обрано»: акцентна заливка, світла рамка й кільце. Один стиль
   на весь сайт, тож нові кнопки просто беруть .btn і виглядають так само. */
.btn{display:inline-block;padding:12px 22px;border-radius:12px;
  background:linear-gradient(180deg,var(--accent-hi),var(--accent-lo));color:#fff;
  border:1px solid rgba(255,255,255,.35);font-weight:700;font:inherit;cursor:pointer;
  box-shadow:0 0 0 3px rgba(var(--accent-rgb),.18),0 8px 20px rgba(var(--accent-rgb),.28);
  transition:.3s cubic-bezier(.22,.9,.3,1)}
.btn:hover{transform:translateY(-2px);background:linear-gradient(180deg,var(--accent-up),var(--accent));
  box-shadow:0 0 0 3px rgba(var(--accent-rgb),.24),0 12px 28px rgba(var(--accent-rgb),.42)}
.btn:disabled{opacity:.5;box-shadow:none;transform:none;cursor:default}
/* другорядні кнопки лишаються тихими — акцент має бути один на екран */
.btn.ghost{box-shadow:none}
.btn.ghost:hover{background:rgba(var(--accent-rgb),.16);border-color:rgba(var(--accent-rgb),.55);box-shadow:none}
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
/* усе в підвалі стоїть на одній лінії: у .like є верхній відступ для стрічки,
   тут він зайвий і збивав кнопку нижче за дату й лічильник */
.lbf .like{margin:0;align-self:center}
.lbf>*{align-self:center}
@media(max-width:760px){.lbox{--stage:46vh;--foot:64px}.lbf{padding:10px 14px;gap:10px}}
.lbclose{position:absolute;right:18px;top:16px;z-index:2;width:38px;height:38px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;font-size:17px;cursor:pointer;
  color:var(--text);background:rgba(12,16,26,.8);border:1px solid var(--line);transition:.2s}
.lbclose:hover{background:rgba(var(--accent-rgb),.3);transform:rotate(90deg)}
.lbnav{position:absolute;top:50%;transform:translateY(-50%);z-index:2;width:46px;height:46px;
  border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;
  cursor:pointer;color:var(--text);background:rgba(12,16,26,.8);border:1px solid var(--line);
  transition:.2s;opacity:.75}
.lbnav:hover{opacity:1;background:rgba(var(--accent-rgb),.3)}
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
  border-color:rgba(var(--accent-rgb),.55);background:rgba(var(--accent-rgb),.16)}
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
  /* на вузькому екрані рейтинг стає в рядок зліва, чип — поруч із підписом */
  .score{margin-left:0;width:100%;flex-direction:row;align-items:baseline;
    justify-content:flex-start;gap:10px;text-align:left}
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

/* ── Оформлення сторінки учасника ── */
.pf-head{position:relative;overflow:hidden}
.pf-head.withbanner{padding-top:0}
.pf-banner{position:relative;margin:-22px -22px 18px;height:180px;overflow:hidden}
/* висоту смуги обирає власник сторінки */
.pf-b-flat{height:110px}
.pf-b-tall{height:280px}
@media(max-width:600px){.pf-b-tall{height:200px}}

/* порядок блоків: маленький список зі стрілками */
.pf-order{display:flex;flex-direction:column;gap:6px}
.pf-orow{display:flex;align-items:center;gap:10px;padding:8px 11px;border-radius:11px;
  background:rgba(255,255,255,.04);border:1px solid var(--line)}
.pf-onum{width:20px;flex:none;text-align:center;font-size:12px;color:var(--dim);
  font-variant-numeric:tabular-nums}
.pf-oname{flex:1;font-size:13px}
.pf-orow .act{flex:none}
.pf-orow .act:disabled{opacity:.3;pointer-events:none}
.pf-banner img{width:100%;height:100%;object-fit:cover;display:block;
  animation:fadeIn .8s both;transform:scale(1.02)}
/* знизу банер розчиняється в картці — інакше різкий стик виглядає грубо */
.pf-banner::after{content:'';position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(180deg,rgba(0,0,0,.15) 0%,rgba(0,0,0,0) 40%,var(--card) 100%)}
@media(max-width:600px){.pf-banner{height:130px}}

.pf-aboutbox .pane-h{display:flex;align-items:center;justify-content:space-between;gap:12px}
.pf-text{white-space:pre-wrap;line-height:1.6}
.pf-edit{display:none;width:100%;min-height:110px;margin-top:10px;padding:12px 14px;
  border-radius:12px;background:rgba(255,255,255,.05);border:1px solid var(--line);
  color:var(--text);font:inherit;font-size:14px;resize:vertical;transition:.2s}
.pf-edit:focus{outline:0;border-color:rgba(var(--accent-rgb),.6);box-shadow:0 0 0 3px rgba(var(--accent-rgb),.16)}
.pf-aboutbox.editing .pf-text{display:none}
.pf-aboutbox.editing .pf-edit{display:block}

/* ── Вікно передперегляду ──
   Показує не сам колір, а сторінку з ним: смуга, картка, кнопка, аватар.
   Так видно результат до того, як щось вдягати. */
.pv-back{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;
  padding:22px;background:rgba(3,5,10,.86);backdrop-filter:blur(6px);animation:fadeIn .22s both}
.pv{width:min(680px,94vw);border-radius:20px;overflow:hidden;background:var(--card);
  border:1px solid var(--line);box-shadow:0 30px 80px rgba(0,0,0,.6);
  animation:lbIn .28s cubic-bezier(.22,.9,.3,1) both}
.pv-h{display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:14px 18px;border-bottom:1px solid var(--line);font-size:15px}
.pv-h .gate-x{position:static}
.pv-stage{position:relative;height:290px;padding:16px;overflow:hidden}
.pv-fog{position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(60% 50% at 50% 20%,rgba(255,255,255,.07),transparent 70%)}
.pv-bar{position:relative;display:flex;align-items:center;gap:8px;padding:8px 10px;
  border-radius:12px;background:rgba(9,12,20,.7);border:1px solid rgba(255,255,255,.07);
  backdrop-filter:blur(8px)}
.pv-dot{width:8px;height:8px;border-radius:2px;background:#fff;opacity:.7}
.pv-bar i{display:block;width:52px;height:9px;border-radius:999px;background:rgba(255,255,255,.12)}
.pv-bar i.on{width:64px;background:#6b7cff}
.pv-card{position:relative;margin-top:16px;padding:16px;border-radius:16px;
  background:rgba(22,27,40,.78);border:1px solid rgba(255,255,255,.08);
  backdrop-filter:blur(10px);display:flex;align-items:center;gap:14px}
.pv-ava{width:54px;height:54px;border-radius:50%;flex:none;border:3px solid #6b7cff;
  background:linear-gradient(135deg,#20263a,#141926)}
.pv-lines{flex:1;display:flex;flex-direction:column;gap:8px}
.pv-lines i{display:block;height:10px;border-radius:999px;background:rgba(255,255,255,.16)}
.pv-lines i.s{width:55%;height:8px;background:rgba(255,255,255,.09)}
.pv-btn{padding:9px 16px;border-radius:11px;font-size:13px;font-weight:700;color:#fff;
  background:#6b7cff;flex:none}
.pv-f{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 18px}

/* ── Вітрина ілюстрацій ──
   Кілька картинок на видноті: рівні плитки, підпис проступає при наведенні. */
/* Нік і кнопка оформлення — в одному рядку. Ніку віддаємо весь залишок,
   але з правом стиснутись, інакше кнопка зривається на другий рядок. */
.pf-id{flex:1;min-width:0}
.pf-nrow{display:flex;align-items:center;gap:10px;min-width:0}
.pf-nrow .name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* ── Вітрина ілюстрацій ──
   Робота, за яку платили, займає все полотно, а не мініатюру в сітці.
   Під нею — смуга решти; клік по ній міняє велике зображення. */
.pf-stage{position:relative;border-radius:calc(var(--radius) - 4px);overflow:hidden;
  background:#05070d;border:1px solid var(--line)}
.pf-big{position:relative;width:100%;aspect-ratio:16/9;display:flex;
  align-items:center;justify-content:center;background:#05070d}
.pf-big-m{width:100%;height:100%;object-fit:cover;display:block;
  animation:fadeIn .4s both}
/* Вітрина без заголовка й підпису — сама картинка й є вітриною. */
.pf-showbare{padding:12px}
.pf-bigopen{position:absolute;right:10px;top:10px;width:34px;height:34px;border-radius:10px;
  display:flex;align-items:center;justify-content:center;font-size:15px;
  background:rgba(8,11,18,.7);border:1px solid var(--line);backdrop-filter:blur(6px);
  opacity:0;transition:.25s}
.pf-stage:hover .pf-bigopen{opacity:1}
.pf-bigopen:hover{border-color:rgba(var(--accent-rgb),.6);background:rgba(var(--accent-rgb),.22)}
.pf-strip{display:flex;gap:8px;margin-top:10px;overflow-x:auto;padding-bottom:2px}
.pf-th{position:relative;width:88px;height:52px;flex:none;border-radius:10px;cursor:pointer;
  padding:0;border:1px solid var(--line);background:#0a0d16 center/cover no-repeat;
  transition:.22s cubic-bezier(.22,.9,.3,1)}
.pf-th:hover{transform:translateY(-2px);border-color:rgba(var(--accent-rgb),.55)}
.pf-th.on{border-color:rgba(var(--accent-rgb),.85);box-shadow:0 0 0 3px rgba(var(--accent-rgb),.22)}
.pf-th i{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-style:normal;
  font-size:15px;color:var(--text);text-shadow:0 2px 8px rgba(0,0,0,.9)}

/* ── Ігри учасника ── */
.gmlist{display:flex;flex-direction:column;gap:9px}
.gmrow{display:flex;align-items:center;gap:12px;animation:fadeUp .45s both}
.gmname{flex:1;min-width:0;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gmbar{flex:0 0 34%;height:6px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden}
.gmbar i{display:block;height:100%;border-radius:999px;
  background:linear-gradient(90deg,var(--accent-lo),var(--accent-up));
  animation:grow .7s cubic-bezier(.22,.9,.3,1) both;transform-origin:left}
/* «зараз грає» — жива крапка, щоб було видно, що стеження працює */
.gmrow.now .gmname{color:#fff}
.gmdot{display:inline-block;width:7px;height:7px;margin-right:8px;border-radius:50%;
  background:var(--good);box-shadow:0 0 8px var(--good);animation:beat 2s ease-in-out infinite}
.gmh{flex:none;font-size:12px;color:var(--dim);font-variant-numeric:tabular-nums;min-width:56px;
  text-align:right}
@media(max-width:520px){.gmbar{flex-basis:22%}}

/* ── Голосування ──
   Окреме спливаюче вікно: троє випадкових, один голос, ніяких пояснень —
   що робити, видно з самих облич. Голос нічого не коштує, тож і
   попереджати нема про що. */
.vsback{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;
  padding:22px;background:rgba(3,5,10,.82);backdrop-filter:blur(6px);animation:fadeIn .22s both}
.vsback[hidden]{display:none}
.vswin{position:relative;width:min(560px,94vw);padding:26px 22px 22px;
  border-radius:var(--radius);background:var(--card);border:var(--line-w,1px) solid var(--line);
  box-shadow:0 30px 80px rgba(0,0,0,.6);backdrop-filter:blur(var(--blur));
  animation:lbIn .28s cubic-bezier(.22,.9,.3,1) both}
.vs-x{position:absolute;right:10px;top:10px}
.vs-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
@media(max-width:520px){.vs-row{grid-template-columns:1fr}}
.vs-one{display:flex;flex-direction:column;align-items:center;gap:9px;padding:14px 10px;
  border-radius:16px;cursor:pointer;background:rgba(255,255,255,.03);
  border:1px solid var(--line);color:var(--text);font:inherit;
  transition:.28s cubic-bezier(.22,.9,.3,1)}
.vs-one img{width:66px;height:66px;border-radius:50%;border:2px solid var(--line);
  transition:.28s cubic-bezier(.22,.9,.3,1)}
.vs-one b{font-size:14px;font-weight:700;max-width:100%;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.vs-one:hover:not(:disabled){transform:translateY(-3px);
  border-color:rgba(var(--accent-rgb),.6);background:rgba(var(--accent-rgb),.10)}
.vs-one:hover:not(:disabled) img{border-color:var(--accent);
  box-shadow:0 0 0 4px rgba(var(--accent-rgb),.2)}
.vs-one:active:not(:disabled){transform:scale(.97)}
.vs-one:disabled{opacity:.5;cursor:default}
.vs-one.won{border-color:rgba(67,196,123,.6);background:rgba(67,196,123,.12)}
@media(max-width:520px){.vs-one img{width:54px;height:54px}}

/* ── Рейтинг картками ──
   Кожен показаний своїм банером, акцентом і рамкою — тим самим, що й у
   профілі. Перші три — ширшими картками з медаллю, щоб перемога читалась. */
.tpwrap{display:flex;flex-direction:column;gap:14px;margin-top:4px}
/* Трійка лідерів — у ДВА стовпці, а не в три: у три банер стискався до
   вузької смужки, і картинка, заради якої його ставили, не читалась.
   Перше місце займає весь рядок. */
.tp-podium{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px}
.tp-podium .tp-1{grid-column:1/-1}
.tp-rest{display:flex;flex-direction:column;gap:10px}
/* Картка живе в оформленні СВОГО власника: --tp-* приходять із його стилю
   вікон. Відкат тут навмисно нейтральний, а не на токени сайту: інакше
   картка людини без свого стилю переймала б стиль того, хто дивиться, —
   і рейтинг показував би не її оформлення, а чуже. */
.tp{position:relative;display:block;overflow:hidden;padding:0 16px 14px;
  border-radius:var(--tp-r,18px);
  border:var(--tp-w,1px) solid var(--tp-l,rgba(255,255,255,.09));
  background:var(--tp-bg,rgba(16,20,30,.72));
  backdrop-filter:blur(var(--tp-bl,14px));-webkit-backdrop-filter:blur(var(--tp-bl,14px));
  box-shadow:var(--tp-s,none);
  animation:fadeUp .5s both;transition:.32s cubic-bezier(.22,.9,.3,1)}
.tp:hover{transform:translateY(-3px);border-color:var(--c)}

/* ── Смуга банера ──
   Це головне, заради чого картка існує: людина ставила банер, щоб його
   бачили. Раніше він лежав тлом під майже непрозорою накладкою з
   opacity:.30 — тобто його не було видно зовсім. */
.tp-head{position:relative;display:block;margin:0 -16px 0;height:104px;overflow:hidden}
.tp-bg{position:absolute;inset:0;display:block;background:center/cover no-repeat;
  transition:transform .6s cubic-bezier(.22,.9,.3,1)}
.tp:hover .tp-bg{transform:scale(1.05)}
/* без банера смуга не порожня — беремо акцент власника */
.tp-head::before{content:'';position:absolute;inset:0;z-index:0;
  background:linear-gradient(135deg,color-mix(in srgb,var(--c) 42%,#0a0d16),#0a0d16)}
.tp-bg{z-index:1}
/* розчиняємо низ смуги в картці — стик не має бути різким */
.tp-head::after{content:'';position:absolute;left:0;right:0;bottom:0;height:62%;z-index:2;
  pointer-events:none;background:linear-gradient(180deg,transparent,var(--tp-bg,rgba(16,20,30,.96)))}
.tp-place{position:absolute;left:12px;top:10px;z-index:3;font-size:14px;color:#fff;
  font-variant-numeric:tabular-nums;padding:3px 10px;border-radius:999px;
  background:rgba(5,7,13,.62);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(6px)}
.tp-top .tp-place{font-size:20px;padding:2px 10px}

.tp-body{position:relative;z-index:3;display:flex;align-items:center;gap:14px;margin-top:-26px}
.tp-face{width:58px;height:58px;flex:none;border-radius:50%;border:3px solid var(--f);
  background:#0a0d16;
  box-shadow:0 0 0 4px var(--tp-bg,rgba(16,20,30,.9)),0 0 22px color-mix(in srgb,var(--f) 45%,transparent)}
.tp-id{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;padding-top:20px}
.tp-id b{font-size:16px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tp-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}
.tp-lvl{font-style:normal;font-size:11px;color:var(--c);letter-spacing:.06em;text-transform:uppercase}
/* Найвища роль — у її ж кольорі, з крапкою, як у списку учасників Discord:
   так її впізнають одразу, не читаючи. */
.tp-role{display:inline-flex;align-items:center;gap:6px;padding:2px 9px;border-radius:999px;
  font-size:11px;line-height:1.6;color:var(--r);max-width:100%;
  background:color-mix(in srgb,var(--r) 15%,transparent);
  border:1px solid color-mix(in srgb,var(--r) 42%,transparent)}
.tp-role i{width:7px;height:7px;flex:none;border-radius:50%;background:var(--r);
  box-shadow:0 0 8px var(--r)}
.tp-role{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* у профілі той самий чип, лише трохи більший */
.pf-role{margin-top:6px;font-size:13px;padding:4px 12px}
.pf-role i{width:8px;height:8px}
.tp-id em{font-style:normal;font-size:12px;color:var(--dim);overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.tp-score{flex:none;display:flex;flex-direction:column;align-items:flex-end;line-height:1.1;
  padding-top:20px}
.tp-score b{font-size:22px;font-weight:800;color:var(--c)}
.tp-score span{font-size:10px;color:var(--dim);letter-spacing:.12em;text-transform:uppercase}
/* трійка лідерів — вища смуга банера й більший аватар */
.tp-top .tp-head{height:172px}
.tp-top .tp-face{width:76px;height:76px}
.tp-top .tp-id{padding-top:26px}
.tp-top .tp-id b{font-size:19px}
.tp-top .tp-score{padding-top:26px}
.tp-top .tp-score b{font-size:27px}
.tp-1{box-shadow:0 0 0 1px rgba(224,180,92,.45),0 18px 46px rgba(224,180,92,.20)}
.tp-2{box-shadow:0 0 0 1px rgba(200,210,228,.38),0 16px 40px rgba(200,210,228,.14)}
.tp-3{box-shadow:0 0 0 1px rgba(205,127,80,.38),0 16px 40px rgba(205,127,80,.14)}
/* Щоденна нагорода за місце — поруч із медаллю, щоб було видно, за що
   змагаються. Без цього нарахування було невидимим. */
/* Плашка стоїть просто біля ніка, а не поверх банера: там її було легко
   не помітити, і вона затуляла картинку. */
.tp-nrow{display:flex;align-items:center;gap:9px;min-width:0}
.tp-nrow b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tp-reward{flex:none;padding:2px 9px;border-radius:999px;
  font-size:11px;font-weight:700;color:#ffdf8a;background:rgba(224,180,92,.16);
  border:1px solid rgba(224,180,92,.42);white-space:nowrap}

/* ── Статистика на картці ──
   Повідомлення, голос і скільки людина на сервері — заради цих чисел
   у рейтинг і заходять, тож вони стоять просто на картці. */
.tp-stats{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;padding-top:11px;
  border-top:1px solid rgba(255,255,255,.09)}
.tp-stat{display:flex;align-items:baseline;gap:6px;padding:5px 10px;border-radius:999px;
  background:rgba(5,7,13,.5);border:1px solid rgba(255,255,255,.07);
  backdrop-filter:blur(4px);white-space:nowrap}
.tp-stat i{font-style:normal;font-size:11px;opacity:.75;align-self:center}
.tp-stat b{font-size:13px;font-weight:700;font-variant-numeric:tabular-nums}
.tp-stat em{font-style:normal;font-size:10px;color:var(--dim);letter-spacing:.06em}
.tp-top .tp-stats{margin-top:14px}
/* Рядки нижче трійки — компактніші: смуга банера тонша, і все лишається
   в одному стовпці, щоб довгі ніки не ламали розкладку. */
.tp:not(.tp-top) .tp-head{height:76px}
.tp:not(.tp-top) .tp-face{width:50px;height:50px;border-width:2px}
.tp:not(.tp-top) .tp-body{margin-top:-22px}
.tp:not(.tp-top) .tp-id,.tp:not(.tp-top) .tp-score{padding-top:16px}
@media(max-width:600px){
  .tp-top .tp-head{height:110px}
  .tp-top .tp-face{width:62px;height:62px}
  .tp-stat em{display:none}
}

/* ── Рівень ──
   Купується за ✨FP, кожен наступний удвічі дорожчий. Смуга показує,
   скільки вже зібрано на наступний, щоб не рахувати в голові. */
.lvbar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:16px;
  padding-top:16px;border-top:1px solid var(--line)}
.lvchip{display:flex;align-items:baseline;gap:7px;padding:6px 13px;border-radius:999px;
  background:rgba(var(--accent-rgb),.14);border:1px solid rgba(var(--accent-rgb),.4)}
.lvchip i{font-style:normal;color:var(--accent);font-size:12px;align-self:center}
.lvchip b{font-size:19px;font-weight:800;line-height:1}
.lvchip span{font-size:11px;color:var(--dim);letter-spacing:.1em;text-transform:uppercase}
.lvgrow{flex:1;min-width:180px;display:flex;flex-direction:column;gap:6px}
.lvtrack{height:6px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden}
.lvtrack i{display:block;height:100%;border-radius:999px;
  background:linear-gradient(90deg,var(--accent-lo),var(--accent-up));
  transition:width .5s cubic-bezier(.22,.9,.3,1)}
.lvnote{font-size:12px;color:var(--dim)}
.lvup{flex:none}
.lvup:disabled{opacity:.45;cursor:not-allowed}

/* ── Гардероб: окреме вікно, щоб не займати сторінку профілю ── */
.pf-lookopen{flex:none}
.pf-lookback{position:fixed;inset:0;z-index:65;display:flex;align-items:center;justify-content:center;
  padding:22px;background:rgba(3,5,10,.82);backdrop-filter:blur(6px);animation:fadeIn .22s both}
.pf-lookback[hidden]{display:none}
.pf-lookwin{width:min(760px,94vw);max-height:88vh;overflow:auto;padding:20px 22px;
  border-radius:20px;background:var(--card);border:1px solid var(--line);
  box-shadow:0 30px 80px rgba(0,0,0,.6);animation:lbIn .28s cubic-bezier(.22,.9,.3,1) both}
.pf-lookh{display:flex;align-items:center;gap:10px}
.pf-lookh .gate-x{position:static}
.pf-lookwin .pane-h{display:flex;align-items:center;justify-content:space-between;gap:12px}
.pf-group{margin-top:16px}
.pf-gt{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin-bottom:9px;
  display:flex;align-items:center;justify-content:space-between;gap:10px}
/* дрібне «зняти» в заголовку групи: знімається саме те, на що дивишся,
   і не треба шукати окремий список скидання десь унизу вікна */
.pf-gt .pf-clear{font-size:11px;padding:3px 9px;text-transform:none;letter-spacing:0}

/* ── Вкладки вікна оформлення ──
   Раніше все — гардероб, заливка, блоки, вітрина, скидання — лежало одним
   довгим сувоєм, і потрібне доводилось шукати прокруткою. Тепер це чотири
   розділи, і видно рівно один. */
.pf-tabs{display:flex;gap:6px;margin:14px 0 4px;flex-wrap:wrap;
  border-bottom:1px solid var(--line);padding-bottom:12px}
.pf-tab{padding:9px 14px;border-radius:11px;border:1px solid var(--line);cursor:pointer;
  background:rgba(255,255,255,.04);color:var(--dim);font:inherit;font-size:13px;
  display:flex;align-items:center;gap:7px;transition:.25s cubic-bezier(.22,.9,.3,1)}
.pf-tab:hover{color:var(--text);border-color:rgba(var(--accent-rgb),.5);transform:translateY(-2px)}
.pf-tab:active{transform:scale(.97)}
.pf-tab.on{background:linear-gradient(180deg,var(--accent-hi),var(--accent-lo));color:#fff;
  border-color:rgba(255,255,255,.35);
  box-shadow:0 0 0 3px rgba(var(--accent-rgb),.18),0 8px 20px rgba(var(--accent-rgb),.26)}
.pf-tab .pf-tn{font-size:11px;opacity:.75}
.pf-panel[hidden]{display:none}
.pf-panel{animation:fadeUp .32s cubic-bezier(.22,.9,.3,1) both}
/* Вікно вже не стрибає у висоті при перемиканні вкладок: сувій живе
   всередині, а шапка з вкладками лишається на місці. */
.pf-lookwin{display:flex;flex-direction:column}
.pf-scroll{overflow:auto;min-height:230px;margin:0 -6px;padding:2px 6px 4px}

.pf-sws{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:10px}
.pf-sw{position:relative;height:62px;border-radius:12px;border:1px solid var(--line);
  cursor:pointer;overflow:hidden;padding:0;color:#fff;font:inherit;
  transition:.25s cubic-bezier(.22,.9,.3,1)}
.pf-sw span{position:absolute;left:0;right:0;bottom:0;padding:4px 7px;font-size:11px;
  text-align:left;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.72));
  text-shadow:0 1px 3px rgba(0,0,0,.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pf-sw:hover{transform:translateY(-3px);border-color:rgba(var(--accent-rgb),.55)}
.pf-sw:active{transform:scale(.96)}
.pf-sw.on{border-color:rgba(var(--accent-rgb),.85);box-shadow:0 0 0 3px rgba(var(--accent-rgb),.22)}
.pf-sw.on::after{content:'✓';position:absolute;right:7px;top:5px;font-size:12px;
  text-shadow:0 1px 4px rgba(0,0,0,.9)}
.pf-sw.mo{background:linear-gradient(120deg,var(--a),var(--b),var(--a));
  background-size:300% 300%;animation:flow 9s ease-in-out infinite}
.pf-sw.accent{background:radial-gradient(circle at 38% 34%,var(--c),#0a0d16 74%)}
/* стиль вікон показуємо самим вікном — маленька картка в тому ж вигляді */
.pf-sw.card{border-style:solid;backdrop-filter:blur(8px)}
.pf-sw.card::before{content:'';position:absolute;left:9px;right:9px;top:12px;height:6px;
  border-radius:999px;background:rgba(255,255,255,.22)}
.pf-sw.frame{background:#0a0d16}
.pf-sw.frame::before{content:'';position:absolute;left:50%;top:42%;width:30px;height:30px;
  margin:-15px 0 0 -15px;border-radius:50%;border:2px solid var(--c);box-shadow:0 0 14px var(--c)}
.pf-up{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.pf-up .btn{cursor:pointer}
.pf-up .btn.busy{opacity:.6;pointer-events:none}

.pf-shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px}
.pf-shot{height:64px;border-radius:12px;border:1px solid var(--line);cursor:pointer;
  background:rgba(255,255,255,.05) center/cover no-repeat;color:var(--dim);
  font:inherit;font-size:12px;transition:.25s cubic-bezier(.22,.9,.3,1)}
.pf-shot:hover{transform:translateY(-2px);border-color:rgba(var(--accent-rgb),.55)}
.pf-shot.on{border-color:rgba(var(--accent-rgb),.8);box-shadow:0 0 0 3px rgba(var(--accent-rgb),.22)}
.pf-shot:active{transform:scale(.96)}

/* ── Магазин косметики ──
   Кожна річ показує саму себе, а не іконку: колір є колір, градієнт є
   градієнт. Замкнені набори видно всім — щоб було зрозуміло, заради
   чого бустити сервер. */
.shop{display:flex;flex-direction:column;gap:26px}
/* ── Гаманець ──
   Був картою на всю ширину сторінки, у якій жили два елементи: число
   ліворуч і кнопка праворуч, а між ними — порожнеча на пів екрана.
   Тепер це компактна плашка по ширині вмісту: місця займає рівно стільки,
   скільки треба, і так само липне під шапку, щоб баланс було видно
   під час гортання. */
.sh-wallet{position:sticky;top:72px;z-index:35;align-self:flex-start;
  display:inline-flex;align-items:center;gap:10px;width:fit-content;max-width:100%;
  padding:7px 8px 7px 14px;border-radius:999px;
  background:linear-gradient(135deg,rgba(var(--accent-rgb),.18),rgba(155,107,255,.10)),
    linear-gradient(0deg,rgba(9,12,20,.94),rgba(9,12,20,.94));
  border:1px solid var(--line);
  box-shadow:0 10px 30px rgba(0,0,0,.38);
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
/* кнопка цін — частина плашки, а не щось на іншому кінці смуги */
.sh-wallet .sh-openprices{margin-left:4px;border-radius:999px}
@media(max-width:600px){
  .sh-wallet{top:64px}
  .sh-bal b{font-size:20px}
  .sh-bal .sh-coin{font-size:19px}
}
.sh-bal{display:flex;align-items:baseline;gap:8px}
.sh-bal b{font-size:23px;line-height:1;font-weight:800;letter-spacing:-.02em;
  background:linear-gradient(180deg,#fff,#b9c2ff);-webkit-background-clip:text;
  background-clip:text;color:transparent}
/* підпис «FP» дрібний, але сама монетка — ні: інакше правило для span
   тиснуло б і її (тому тут :not, а не окремий клас нижче) */
.sh-bal span:not(.sh-coin){color:var(--dim);font-size:11px;letter-spacing:.12em}
.sh-bal .sh-coin{font-size:21px;line-height:1;display:inline-block;align-self:center;
  filter:drop-shadow(0 0 10px rgba(255,214,102,.45));
  animation:coin 3.5s ease-in-out infinite;transform-origin:center}
@keyframes coin{0%,88%,100%{transform:rotate(0) scale(1)}92%{transform:rotate(-12deg) scale(1.14)}96%{transform:rotate(10deg) scale(1.08)}}
.sh-boost{margin-left:auto;padding:9px 14px;border-radius:12px;font-size:13px;color:var(--dim);
  background:rgba(255,255,255,.04);border:1px solid var(--line)}
.sh-boost.on{color:#d9b8ff;background:rgba(155,107,255,.14);border-color:rgba(155,107,255,.35)}

/* Категорії ліворуч списком згори вниз, набори — праворуч. */
.sh-layout{display:grid;grid-template-columns:220px minmax(0,1fr);gap:22px;align-items:start}
.sh-side{position:sticky;top:84px;display:flex;flex-direction:column;gap:4px}
.sh-cat{display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding:11px 13px;border-radius:12px;font-size:14px;border:1px solid transparent;
  color:var(--dim);transition:.22s cubic-bezier(.22,.9,.3,1)}
.sh-cat:hover{background:rgba(255,255,255,.05);color:var(--text)}
.sh-cat.on{background:rgba(var(--accent-rgb),.16);border-color:rgba(var(--accent-rgb),.4);color:#fff}
.sh-cn{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sh-cc{font-size:12px;color:var(--dim);flex:none}
.sh-cat.on .sh-cc{color:#c9d0ff}
@media(max-width:820px){
  .sh-layout{grid-template-columns:1fr}
  .sh-side{position:static;flex-direction:row;overflow-x:auto;padding-bottom:4px}
  .sh-cat{flex:none}
}
/* Категорія тепер не «прокрутити до», а «показати лише це»: магазин перестав
   бути одним нескінченним сувоєм, у якому шукаєш потрібний розділ очима. */
.sh-sec[hidden]{display:none}
.sh-side .sh-cat{cursor:pointer;border:1px solid transparent;background:0;
  text-align:left;font:inherit;width:100%}
/* ── Спливаючі повідомлення ──
   Раніше відмова («не вистачає FP») лягала смугою в самому низу сторінки:
   людина тиснула кнопку вгорі й нічого не бачила. Тепер повідомлення
   зʼявляється поверх сторінки, там, куди дивишся. */
.toasts{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:80;
  display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;
  width:max-content;max-width:min(440px,92vw)}
.toast{display:flex;align-items:center;gap:10px;padding:11px 16px;border-radius:13px;
  font-size:14px;color:var(--text);background:var(--menu);border:1px solid var(--line);
  box-shadow:0 16px 40px rgba(0,0,0,.55);backdrop-filter:blur(10px);
  animation:toastIn .3s cubic-bezier(.22,.9,.3,1) both;pointer-events:auto}
.toast.out{animation:toastOut .28s ease-in both}
.toast i{font-style:normal;font-size:16px;line-height:1;flex:none}
.toast-face{width:30px;height:30px;flex:none;border-radius:50%;border:1px solid var(--line)}
.toast.good{border-color:rgba(67,196,123,.42);background:rgba(16,38,27,.96)}
.toast.bad{border-color:rgba(239,83,80,.45);background:rgba(42,16,16,.96)}
@keyframes toastIn{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}
@keyframes toastOut{to{opacity:0;transform:translateY(8px) scale(.98)}}

/* ── Позначки картки ──
   Раніше «Уже ваше» й «У наборі» лежали плитами поверх прев'ю: вони різались
   об край картки, затуляли самі зразки й були чужі решті сайту. Тепер це
   звичайні чипи в рядку з назвою — тим самим стилем, що й скрізь. */
.sh-card.mine{border-color:rgba(67,196,123,.35)}
.sh-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}
.sh-chip{padding:3px 9px;border-radius:999px;font-size:11px;line-height:1.5;
  color:var(--dim);background:rgba(255,255,255,.05);border:1px solid var(--line);
  white-space:nowrap}
.sh-chip.good{color:#7fe0a4;background:rgba(67,196,123,.13);border-color:rgba(67,196,123,.34)}
.sh-chip.boost{color:#d9b8ff;background:rgba(155,107,255,.13);border-color:rgba(155,107,255,.32)}
/* дії в ряд: спершу подивитись, потім узяти */
.sh-a{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.sh-a .btn{flex:1;min-width:110px;justify-content:center;text-align:center}
/* залишок заливок просто в кнопці, дрібним */
.sh-left{margin-left:7px;font-size:11px;opacity:.75}

/* ── Заливка своєї роботи (тільки в магазині) ── */
.sh-upbox{width:min(560px,94vw)}
.sh-upbody{padding:16px 18px;display:flex;flex-direction:column;gap:12px}
.sh-upkinds{display:flex;gap:8px;flex-wrap:wrap}
.sh-upwhere{margin:-4px 0 0}
.sh-updrop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;
  min-height:170px;padding:14px;border-radius:14px;cursor:pointer;
  border:1px dashed rgba(255,255,255,.18);background:rgba(255,255,255,.03);
  transition:.25s cubic-bezier(.22,.9,.3,1)}
.sh-updrop:hover{border-color:rgba(var(--accent-rgb),.6);background:rgba(var(--accent-rgb),.07)}
.sh-updrop.has{border-style:solid;border-color:rgba(var(--accent-rgb),.45)}
.sh-upshot{display:none;width:100%;height:150px;border-radius:11px;
  background:#0a0d16 center/contain no-repeat}
.sh-updrop.has .sh-upshot{display:block}
.sh-updrop.has .sh-uppick{font-size:12px;color:var(--dim)}
.sh-uppick{font-size:14px;color:var(--dim)}
.sh-upfields{display:flex;gap:10px;flex-wrap:wrap}
.sh-upfields input{padding:10px 12px;border-radius:11px;font:inherit;font-size:13px;
  background:rgba(255,255,255,.05);border:1px solid var(--line);color:var(--text)}
.sh-upfields input:focus{outline:0;border-color:rgba(var(--accent-rgb),.6)}
#sh-uptitle{flex:1;min-width:180px}
#sh-upprice{width:130px;text-align:right}
.sh-upacts{display:flex;gap:8px;align-items:center}
/* прапорець «лише для бустерів» — автор вирішує це одразу під час заливки */
.sh-upboost{display:flex;align-items:center;gap:9px;cursor:pointer;font-size:13px;color:var(--dim)}
.sh-upboost input{width:17px;height:17px;accent-color:var(--accent);cursor:pointer}
.sh-upboost:hover{color:var(--text)}

/* ── Керування власною роботою ── */
.sh-myboost{flex:none;padding:7px 10px;filter:grayscale(1);opacity:.5;transition:.22s}
.sh-myboost.on{filter:none;opacity:1;border-color:rgba(155,107,255,.5);
  background:rgba(155,107,255,.16)}
.sh-mydel{flex:none;padding:7px 10px}
.sh-mydel:hover{border-color:rgba(239,83,80,.6);background:rgba(239,83,80,.14);color:#ff9a97}
.sh-myby{font-size:12px;color:var(--dim);flex:none}

/* ── Стрічка варіантів у передперегляді ──
   Набір показував по одному зразку за клік із підказкою «клікайте ще» —
   було незрозуміло, скільки їх узагалі й що вже бачив. */
.pv-strip{display:flex;gap:8px;padding:10px 18px 0;overflow-x:auto}
.pv-strip[hidden]{display:none}
.pv-th{width:56px;height:38px;flex:none;border-radius:9px;cursor:pointer;padding:0;
  border:1px solid var(--line);background:#0a0d16 center/cover no-repeat;
  transition:.22s cubic-bezier(.22,.9,.3,1)}
.pv-th:hover{transform:translateY(-2px);border-color:rgba(var(--accent-rgb),.55)}
.pv-th.on{border-color:rgba(var(--accent-rgb),.85);box-shadow:0 0 0 3px rgba(var(--accent-rgb),.22)}
.pv-th.mo{background:linear-gradient(120deg,var(--a),var(--b),var(--a));
  background-size:300% 300%;animation:flow 9s ease-in-out infinite}
.pv-th.ac{background:radial-gradient(circle at 38% 34%,var(--c),#0a0d16 74%)}
.pv-th.fr::before{content:'';display:block;width:18px;height:18px;margin:9px auto;
  border-radius:50%;border:2px solid var(--c);box-shadow:0 0 10px var(--c)}
.pv-name{padding:8px 18px 0;font-size:13px;color:var(--dim)}

.tagp.good{border-color:rgba(67,196,123,.45);background:rgba(67,196,123,.14);color:#7fe0a4}
.sh-body{display:flex;flex-direction:column;gap:30px}
.sh-sec{scroll-margin-top:90px;animation:fadeUp .5s both}
.sh-h{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:14px}
.sh-h h2{margin:0 0 2px;font-size:19px;letter-spacing:-.01em}
.sh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(226px,1fr));gap:16px}

.sh-by{font-size:12px;color:var(--dim);margin-top:4px}
.sh-by b{color:var(--text);font-weight:600}
.sh-prev i.im{background:center/cover no-repeat}

/* свої роботи: назва, ціна й одна кнопка «виставити» */
.sh-own{margin-bottom:16px;padding:14px;border-radius:16px;
  background:rgba(255,255,255,.03);border:1px solid var(--line)}
.sh-gt{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin-bottom:8px}
.sh-mine{display:flex;flex-direction:column;gap:10px}
.sh-my{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.sh-my.listed{opacity:1}
.sh-myimg{width:56px;height:36px;border-radius:8px;flex:none;background:center/cover no-repeat;
  border:1px solid var(--line)}
.sh-mytitle{flex:1;min-width:140px}
.sh-myprice{width:96px;flex:none}
.sh-my input{padding:8px 11px;border-radius:10px;font:inherit;font-size:13px;
  background:rgba(255,255,255,.05);border:1px solid var(--line);color:var(--text)}
.sh-my input:focus{outline:0;border-color:rgba(var(--accent-rgb),.6)}

/* вікно цін: список у стовпчик, кнопка 🚀 поруч із кожним */
/* Вікно цін: у рядку видно саму річ, її категорію й ціну — без цього
   правиш наосліп, бо назви самі по собі мало що кажуть. */
.sh-pricewin{width:min(640px,94vw)}
.sh-pricelist{max-height:60vh;overflow:auto;padding:12px 18px;display:flex;flex-direction:column;gap:14px}
.sh-pgroup{display:flex;flex-direction:column;gap:8px}
.sh-prow{display:flex;align-items:center;gap:10px}
.sh-pv{width:46px;height:32px;flex:none;border-radius:9px;overflow:hidden;display:grid;
  border:1px solid var(--line)}
.sh-pv i{display:block;width:100%;height:100%}
.sh-pv i.im{background:center/cover no-repeat}
.sh-pv i.ac{background:radial-gradient(circle at 40% 35%,var(--c),#0a0d16 74%)}
.sh-pv i.fr{background:#0a0d16;position:relative}
.sh-pv i.fr::after{content:'';position:absolute;left:50%;top:50%;width:16px;height:16px;
  margin:-8px 0 0 -8px;border-radius:50%;border:2px solid var(--c);box-shadow:0 0 8px var(--c)}
.sh-pv i.cd{border:1px solid;border-radius:6px;margin:4px}
.sh-pv i.mo{background:linear-gradient(120deg,var(--a),var(--b),var(--a));
  background-size:300% 300%;animation:flow 9s ease-in-out infinite}
.sh-pn{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.sh-pn b{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sh-pn i{font-style:normal;font-size:11px;color:var(--dim);letter-spacing:.04em}
.sh-pfp{flex:none;font-size:13px;color:var(--dim)}
.sh-prow input{width:96px;flex:none;padding:8px 11px;border-radius:10px;font:inherit;font-size:13px;
  text-align:right;background:rgba(255,255,255,.05);border:1px solid var(--line);color:var(--text)}
.sh-flag{flex:none;padding:7px 11px;opacity:.45}
.sh-flag.on{opacity:1;background:rgba(155,107,255,.2);border-color:rgba(155,107,255,.5)}
.sh-openprices{margin-left:auto}

.sh-card{position:relative;display:flex;flex-direction:column;gap:12px;padding:14px;
  border-radius:16px;background:var(--card);border:1px solid var(--line);
  scroll-margin-top:90px;animation:fadeUp .5s both;transition:.32s cubic-bezier(.22,.9,.3,1)}
.sh-card:hover{transform:translateY(-4px);border-color:rgba(var(--accent-rgb),.4);
  box-shadow:0 16px 40px rgba(0,0,0,.45)}
.sh-card.mine{border-color:rgba(var(--accent-rgb),.5)}
.sh-card.mine::after{content:'✓';position:absolute;right:14px;top:12px;font-size:12px;
  color:#c9d0ff;opacity:.9}
.sh-card.locked{opacity:.62}
.sh-card.locked:hover{opacity:.85;transform:none;box-shadow:none}

/* прев'ю: справжні зразки з набору, а не іконка */
/* Прев'ю саме по собі — кнопка перегляду: окрема «Подивитись» тільки
   дублювала те, на що людина й так дивиться. Тому зразків більше, смуга
   вища, і по ній видно, що на неї можна натиснути. */
.sh-prev{position:relative;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:4px;
  height:118px;width:100%;padding:0;cursor:zoom-in;font:inherit;
  border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,.1);
  box-shadow:inset 0 0 30px rgba(0,0,0,.5);transition:.35s cubic-bezier(.22,.9,.3,1)}
.sh-card:hover .sh-prev{transform:scale(1.02);border-color:rgba(var(--accent-rgb),.45)}
.sh-prev:active{transform:scale(.99)}
/* скільки зразків не влізло */
.sh-more{position:absolute;right:8px;bottom:8px;padding:2px 8px;border-radius:999px;
  font-size:11px;font-style:normal;color:var(--text);background:rgba(8,11,18,.78);
  border:1px solid var(--line);backdrop-filter:blur(4px)}
/* підпис «Подивитись» проступає під курсором — без окремої кнопки в картці */
.sh-zoom{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(.94);
  padding:7px 15px;border-radius:999px;font-size:12px;color:var(--text);
  background:rgba(8,11,18,.82);border:1px solid var(--line);backdrop-filter:blur(6px);
  opacity:0;transition:.28s cubic-bezier(.22,.9,.3,1);white-space:nowrap}
.sh-prev:hover .sh-zoom,.sh-prev:focus-visible .sh-zoom{opacity:1;transform:translate(-50%,-50%) scale(1)}
@media(hover:none){.sh-zoom{display:none}}
.sh-prev i{display:block}
.sh-prev i.ac{background:radial-gradient(circle at 40% 35%,var(--c),#0a0d16 74%)}
.sh-prev i.cd{border-style:solid;margin:9px 4px;backdrop-filter:blur(6px)}
.sh-prev i.fr{background:#0a0d16;position:relative}
.sh-prev i.fr::after{content:'';position:absolute;left:50%;top:50%;width:34px;height:34px;
  margin:-17px 0 0 -17px;border-radius:50%;border:2px solid var(--c);
  box-shadow:0 0 14px var(--c)}
.sh-prev i.mo{background:linear-gradient(120deg,var(--a),var(--b),var(--a));
  background-size:300% 300%;animation:flow 9s ease-in-out infinite}
@keyframes flow{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
.sh-prev.custom{display:flex;align-items:center;justify-content:center;font-size:32px;
  color:var(--dim);background:repeating-linear-gradient(45deg,#0a0d16,#0a0d16 10px,#0e121c 10px,#0e121c 20px)}

.sh-b{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.sh-n{font-weight:700;font-size:15px;margin-bottom:2px}
.sh-p{font-size:12px;color:var(--dim);white-space:nowrap}
.sh-left{margin-top:-4px}
.sh-a{display:flex;margin-top:auto}
.sh-a .btn{width:100%;text-align:center;padding:9px 12px;font-size:13px}
/* редагування ціни — лише адміністратору */
.sh-price{display:flex;gap:8px}
.sh-price input{width:100%;padding:8px 11px;border-radius:10px;font:inherit;font-size:13px;
  background:rgba(255,255,255,.05);border:1px solid var(--line);color:var(--text)}
.sh-price input:focus{outline:0;border-color:rgba(var(--accent-rgb),.6)}
.sh-price .btn{white-space:nowrap;padding:8px 12px}
/* коротка іскра після вдалої покупки */
.sh-card.bought{animation:bought .7s cubic-bezier(.22,.9,.3,1)}
@keyframes bought{0%{box-shadow:0 0 0 0 rgba(var(--accent-rgb),.55)}
  60%{box-shadow:0 0 0 14px rgba(var(--accent-rgb),0)}100%{box-shadow:0 0 0 0 rgba(var(--accent-rgb),0)}}
@media(max-width:560px){.sh-wallet .hint{margin-left:0;text-align:left}}

/* ── Графік репутації на профілі ── */
.chartbox{padding:18px 20px 14px}
.chartbox .pane-h{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.dchips{display:flex;gap:8px}
.dchip{display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border-radius:999px;
  font-size:12px;color:var(--dim);background:rgba(255,255,255,.05);border:1px solid var(--line)}
.dchip b{font-size:13px;color:var(--text)}
.dchip.up b{color:var(--good)}
.dchip.down b{color:var(--bad)}
.chart{width:100%;height:auto;display:block;margin:14px 0 4px;overflow:visible}
/* сітка й підписи: без них лінія читається як випадкова риска */
.chgrid{stroke:rgba(255,255,255,.07);stroke-width:1}
.chlabel{fill:var(--dim);font-size:11px;letter-spacing:.04em}
.chpt{opacity:.85}
.chhair{stroke:rgba(255,255,255,.18);stroke-width:1;opacity:0;transition:opacity .15s}
.hp:hover .chhair{opacity:1}
.chline{stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round;
  filter:drop-shadow(0 4px 14px rgba(var(--accent-rgb),.45));
  stroke-dasharray:2400;stroke-dashoffset:2400;animation:draw 1.4s cubic-bezier(.22,.9,.3,1) .15s forwards}
@keyframes draw{to{stroke-dashoffset:0}}
.charea{opacity:0;animation:fadeIn .8s .5s forwards}
.chdot{animation:pop .5s 1.2s both;filter:drop-shadow(0 0 10px rgba(var(--accent-rgb),.8))}
/* крапки під курсором: невидимі, поки не наведеш */
.hp circle{fill:#fff;opacity:0;transition:opacity .15s;pointer-events:none}
.hp:hover circle{opacity:1}
.hp rect{cursor:crosshair}
.chfoot{display:flex;align-items:center;justify-content:space-between;gap:12px;
  font-size:11px;color:var(--dim);letter-spacing:.04em}
.chart-empty{padding:34px 0 30px;text-align:center}

/* ─────────────────────────────────────────────
   СПІЛЬНА МОВА «ОБРАНО / НАТИСНУТО»
   Блок навмисно стоїть останнім: він має перемагати будь-які часткові
   стилі (.btn.ghost, .langmenu a тощо), інакше вибране губить вигляд.
   Клас .pick-el — будь-яка кнопка-перемикач, .on — обрана.
   Новий елемент вибору бере ці класи й не потребує власних правил.
   ───────────────────────────────────────────── */
.pick-el{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:6px;
  min-width:0;white-space:nowrap;font-weight:600;transition:.2s cubic-bezier(.22,.9,.3,1)}
.pick-el::after{content:'✓';font-size:12px;opacity:0;transition:.2s}
.pick-el.on,.btn.ghost.pick-el.on,.btn.icon.on,
.tabs a.on,.langmenu a.on,.drop-opt.on,.qopt.on,.vopt.on,.sopt.on{
  background:linear-gradient(180deg,var(--accent-hi),var(--accent-lo));color:#fff;
  border-color:rgba(255,255,255,.35);
  box-shadow:0 0 0 3px rgba(var(--accent-rgb),.22),0 8px 20px rgba(var(--accent-rgb),.3)}
.pick-el.on::after{opacity:.9}
.pick-el:not(.on){opacity:.72}
.pick-el:not(.on):hover{opacity:1;transform:translateY(-1px)}
/* у списках «✓» стоїть праворуч; місце під нього тримає padding-right вище */
.drop-opt::after,.qopt::after,.vopt::after,.sopt::after,.langmenu a::after{content:'✓';position:absolute;
  right:10px;font-size:11px;opacity:0;transition:.2s}
.drop-opt.on::after,.qopt.on::after,.vopt.on::after,.sopt.on::after,.langmenu a.on::after{opacity:.95}
/* наведення на вже обране не має його «гасити» */
.pick-el.on:hover,.tabs a.on:hover,.drop-opt.on:hover,.qopt.on:hover,.vopt.on:hover,
.sopt.on:hover,.btn.icon.on:hover{background:linear-gradient(180deg,var(--accent-up),var(--accent))}

/* Натискання відчутне скрізь однаково */
.pick-el:active,.tabs a:active,.drop-opt:active,.qopt:active,.pick-row:active,.like:active,
.lbnav:active,.lbclose:active,.gbtn:active,.dbtn:active,.langmenu a:active{transform:scale(.96)}

/* Головна дія на головній сторінці — у кольорах сайту, а не Discord */
.dbtn.site{background:linear-gradient(180deg,var(--accent-hi),var(--accent-lo));
  border:1px solid rgba(255,255,255,.35);
  box-shadow:0 0 0 3px rgba(var(--accent-rgb),.2),0 10px 30px rgba(var(--accent-rgb),.36)}
.dbtn.site:hover{background:linear-gradient(180deg,var(--accent-up),var(--accent));
  box-shadow:0 0 0 3px rgba(var(--accent-rgb),.26),0 16px 42px rgba(var(--accent-rgb),.5)}
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
      /* Дим підхоплює обраний акцент: тло перестає жити окремо від
         оформлення й починає з ним гармоніювати. Без вибору лишається
         типовий синьо-фіолетовий. */
      var acc=(getComputedStyle(document.documentElement)
        .getPropertyValue('--accent-rgb')||'107,124,255').trim().split(',').map(Number);
      if(acc.length!==3||acc.some(isNaN))acc=[107,124,255];
      /* світліший і темніший родичі акценту — щоб шари не злилися в пляму */
      var lift=function(v,d){return Math.max(0,Math.min(255,Math.round(v+d)))};
      var tintA=acc.map(function(v){return lift(v,26)});
      var tintB=[lift(acc[0],42),lift(acc[1],-12),lift(acc[2],20)];
      var tintC=[lift(acc[0],-34),lift(acc[1],28),lift(acc[2],6)];

      layers=[
        /* дуже великий повільний шар — дає глибину, якої раніше бракувало */
        {t:tile(256,tintA,(Math.random()*9999)|0,2.1),sc:4.2,a:.14,pa:.05,
         ox:22,oy:16,w1:.021,w2:-.017,rot:.004,ph:R(0,6.3)},
        {t:tile(256,tintA,(Math.random()*9999)|0,2.4),sc:2.6,a:.26,pa:.06,
         ox:30,oy:22,w1:.048,w2:.036,rot:.008,ph:R(0,6.3)},
        {t:tile(256,tintB,(Math.random()*9999)|0,2.8),sc:1.5,a:.17,pa:.045,
         ox:38,oy:29,w1:-.038,w2:.055,rot:-.012,ph:R(0,6.3)},
        {t:tile(192,tintC,(Math.random()*9999)|0,3.2),sc:0.85,a:.10,pa:.03,
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
      /* Джерело світла повільно ходить — раніше воно стояло намертво в
         одному куті, і дим під ним здавався нерухомою плівкою. */
      var lx=fw*(.22+Math.sin(s*.031)*.10),ly=-fh*.1+fh*Math.cos(s*.024)*.06;
      var lg=fx.createRadialGradient(lx,ly,0,lx,ly,diag*.85);
      lg.addColorStop(0,'rgba(150,170,255,.24)');
      lg.addColorStop(.5,'rgba(120,110,210,.07)');
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
    /* Субтитри окремими файлами (.vtt) чіпляємо як рідні доріжки —
       далі вони живуть так само, як ті, що прийшли в маніфесті. */
    (cfg.subtitles||[]).forEach(function(s,i){
      var tr=document.createElement('track');
      tr.kind='subtitles';tr.label=s.label||('#'+(i+1));
      if(s.lang)tr.srclang=s.lang;
      tr.src=s.url;v.appendChild(tr);
    });
    box.appendChild(v);
    /* рідні доріжки браузер вмикає сам — нам потрібен свій перемикач */
    for(var ti=0;ti<v.textTracks.length;ti++)v.textTracks[ti].mode='disabled';
    var ready=Promise.resolve();

    var hls=null,levels=[];
    if(cfg.provider==='hls'&&!v.canPlayType('application/vnd.apple.mpegurl')){
      /* Safari грає HLS сам, решті потрібен hls.js */
      /* Спершу свій файл — він їде з тієї ж машини, що й сайт, тож не залежить
         від чужого CDN. Якщо бот запущено без npm install, лишається запасний
         шлях назовні: краще так, ніж зал із чорним екраном. */
      ready=loadScript('/vendor/hls.min.js').catch(function(){
        return loadScript('https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js');
      }).then(function(){
        if(!window.Hls||!window.Hls.isSupported()){v.src=cfg.src;return}
        /* Автоякість. Три речі, без яких hls.js сидить на низькій картинці:
           capLevelToPlayerSize:false — інакше якість обмежується розміром
             елемента, і в невеликому вікні 1080p не вмикається ніколи;
           abrEwmaDefaultEstimate — стартова оцінка каналу; за замовчуванням
             вона мала, тож перші секунди йдуть у найгіршій якості;
           abrBandWidthUpFactor — наскільки сміливо підвищувати рівень.
           Далі hls.js сам піднімає якість, щойно бачить запас каналу. */
        hls=new window.Hls({
          lowLatencyMode:true,
          capLevelToPlayerSize:false,
          startLevel:-1,
          abrEwmaDefaultEstimate:2500000,
          abrBandWidthUpFactor:0.9,
          abrBandWidthFactor:0.95,
          maxBufferLength:30,
        });
        hls.loadSource(cfg.src);hls.attachMedia(v);
        hls.on(window.Hls.Events.MANIFEST_PARSED,function(){
          /* у стрімі якості приходять із маніфесту — віддаємо їх у меню */
          levels=(hls.levels||[]).map(function(l,i){return {label:(l.height||l.bitrate/1000|0)+(l.height?'p':'k'),index:i}});
          levels.sort(function(a,b){return parseInt(b.label)-parseInt(a.label)});
          /* Перший пункт — «Авто»: рівень обирає сам плеєр і підвищує його,
             коли дозволяє канал. Вручну обрана якість це вимикає. */
          if(levels.length>1)levels.unshift({label:cfg.autoText||'Авто',index:-1,auto:true});
          if(cfg.onLevels)cfg.onLevels(levels);

          /* окремі аудіодоріжки — це і є озвучки всередині самого стріму */
          var tracks=(hls.audioTracks||[]).map(function(a,i){
            return {label:a.name||a.lang||('#'+(i+1)),index:i};
          });
          if(tracks.length>1&&cfg.onAudioTracks)cfg.onAudioTracks(tracks);

          /* субтитри лежать у тому ж маніфесті окремими доріжками */
          var subs=(hls.subtitleTracks||[]).map(function(s,i){
            return {label:s.name||s.lang||('#'+(i+1)),index:i};
          });
          if(subs.length&&cfg.onSubtitles)cfg.onSubtitles(subs);
        });
        /* Поки якість обирає плеєр — показуємо, на чому він зараз зупинився. */
        hls.on(window.Hls.Events.LEVEL_SWITCHED,function(_e,d){
          var l=(hls.levels||[])[d.level];
          if(l&&cfg.onLevelSwitch)cfg.onLevelSwitch((l.height||((l.bitrate/1000)|0))+(l.height?'p':'k'),hls.autoLevelEnabled);
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
      /* Рівень усередині HLS-стріму перемикається без перезавантаження.
         −1 повертає автоматичний вибір: плеєр знову сам підвищуватиме якість. */
      setLevel:function(i){if(hls)hls.currentLevel=Number(i)},
      setAudioTrack:function(i){if(hls)hls.audioTrack=i},
      /* Субтитри: −1 вимикає. У hls.js доріжки свої, у звичайного відео —
         рідні textTracks (туди ж потрапляють зовнішні файли .vtt). */
      setSubtitle:function(i){
        var n=Number(i);
        if(hls){
          hls.subtitleDisplay=n>=0;
          hls.subtitleTrack=n;
          if(n<0)return;
        }
        var tt=v.textTracks||[];
        for(var k=0;k<tt.length;k++)tt[k].mode=(k===n?'showing':'disabled');
      },
      /* рідні доріжки самого відео — коли субтитри прийшли окремим файлом */
      nativeSubtitles:function(){
        var out=[],tt=v.textTracks||[];
        for(var k=0;k<tt.length;k++){
          if(tt[k].kind!=='subtitles'&&tt[k].kind!=='captions')continue;
          out.push({label:tt[k].label||tt[k].language||('#'+(k+1)),index:k});
        }
        return out;
      },
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

    /* ── Субтитри ──
       Доріжки приходять або з маніфесту, або окремими файлами (.vtt).
       Вибір особистий, як гучність: спільним лишається тільки час. */
    cfg.onSubtitles=function(subs){
      var box=document.getElementById('cin-subs');
      if(!box||!subs.length)return;
      var menu=box.querySelector('.qmenu');menu.innerHTML='';
      var off=document.createElement('button');
      off.className='sopt on';off.dataset.sub='-1';
      off.dataset.label=stage.dataset.subsOff||'Вимкнено';
      off.textContent=off.dataset.label;menu.appendChild(off);
      subs.forEach(function(s){
        var b=document.createElement('button');
        b.className='sopt';b.dataset.sub=s.index;b.dataset.label=s.label;
        b.textContent=s.label;menu.appendChild(b);
      });
      box.hidden=false;
    };
    /* доріжки з окремих файлів готові одразу — питаємо їх у самого плеєра */
    if(player.nativeSubtitles){
      var own=player.nativeSubtitles();
      if(own.length)cfg.onSubtitles(own);
    }

    /* Рівні якості всередині HLS-стріму доїжджають після розбору маніфесту */
    cfg.autoText=stage.dataset.autoText||'Авто';
    cfg.onLevels=function(levels){
      var box=document.getElementById('cin-qual');
      if(!box||!levels.length)return;
      var menu=box.querySelector('.qmenu');menu.innerHTML='';
      levels.forEach(function(l,i){
        var b=document.createElement('button');
        b.className='qopt'+(i===0?' on':'');b.dataset.level=l.index;b.dataset.label=l.label;
        if(l.auto)b.dataset.auto='1';
        b.textContent=l.label;menu.appendChild(b);
      });
      box.hidden=false;
      document.getElementById('cin-qlabel').textContent=levels[0].label;
    };

    /* Плеєр підняв або опустив якість сам — показуємо це поруч зі словом
       «Авто», щоб було видно, на чому він зараз зупинився. */
    cfg.onLevelSwitch=function(label,isAuto){
      var lab=document.getElementById('cin-qlabel');
      if(!lab)return;
      var picked=document.querySelector('#cin-qual .qopt.on');
      if(!isAuto||!picked||picked.dataset.auto!=='1')return;
      lab.textContent=(stage.dataset.autoText||'Авто')+' · '+label;
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
    startAmbient(player);
    setInterval(tick,250);
  }

  /**
   * Живе світло від кадру.
   *
   * Раз на пів секунди зменшуємо поточний кадр до 32×18 і кладемо на полотно
   * під сценою; далі CSS розмиває його до кольорових плям. Виходить те саме,
   * що й «навколишнє світло» у відеосервісах, тільки без жодних бібліотек.
   *
   * Коли кадр узяти не можна — чужа рамка або потік без CORS (полотно тоді
   * «псується» й кидає SecurityError) — тихо лишаємо рівне акцентне сяйво.
   */
  function startAmbient(player){
    var a=document.getElementById('cin-ambient'),b=document.getElementById('cin-ambient2'),
        wrap=document.querySelector('.stagewrap');
    if(!a||!b||!wrap)return;
    var video=player&&player.el&&player.el.tagName==='VIDEO'?player.el:null;
    if(!video){wrap.classList.add('noframe');return}

    var ctxA=null,ctxB=null;
    try{ ctxA=a.getContext('2d');ctxB=b.getContext('2d') }catch(e){}
    if(!ctxA||!ctxB){wrap.classList.add('noframe');return}

    /* повага до системного «менше руху»: світло стоїть, а не пульсує */
    var still=matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    var timer=null,dead=false,top=false;   /* top — чи зараз згори друге полотно */

    /**
     * Плавність. Новий кадр малюємо в те полотно, яке зараз невидиме,
     * і проявляємо його поверх старого. Через півсекунди воно стає
     * основним, і все повторюється — колір переходить, а не стрибає.
     */
    function draw(){
      if(dead)return;
      if(document.hidden||video.paused||video.readyState<2)return;
      var hidden=top?a:b,ctx=top?ctxA:ctxB;
      try{
        ctx.drawImage(video,0,0,hidden.width,hidden.height);
      }catch(e){
        /* потік з чужого домену без CORS — полотно зіпсоване, більше не пробуємо */
        dead=true;clearInterval(timer);wrap.classList.add('noframe');
        a.remove();b.remove();
        return;
      }
      /* міняємо, хто згори: CSS-перехід зробить решту */
      top=!top;
      a.classList.toggle('show',!top);
      b.classList.toggle('show',top);
    }

    draw();
    /* Знімаємо кадр рідше, ніж триває перехід: так одна пляма встигає
       повністю перетекти в наступну, і світло не блимає. */
    timer=setInterval(draw,still?3000:1500);
    document.addEventListener('visibilitychange',function(){if(!document.hidden)draw()});
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
    /* Йде показ — гасимо світло в залі: сцена світиться, решта тьмяніє. */
    var room=document.getElementById('cin-room'),pan=document.querySelector('.cpanels');
    if(room)room.classList.toggle('live',!!want.playing);
    if(pan)pan.classList.toggle('dim',!!want.playing);
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
    /* Referer вписувати не треба: коли CDN пускає лише «зі свого» сайту,
       сервер сам підставляє його з адреси потоку й веде через проксі. */
    post(action,{
      source:inp.value,
      title:(document.getElementById('cin-title')||{}).value,
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
    /* три випадки: «Авто» (рівень −1, плеєр вибирає сам і підвищує),
       конкретний рівень усередині HLS або окремий файл на кожну якість */
    if(b.dataset.level!==undefined&&player.setLevel)player.setLevel(Number(b.dataset.level));
    else if(b.dataset.url&&player.setQuality)player.setQuality(b.dataset.url);
    else return;
    var all=qual.querySelectorAll('.qopt');
    for(var i=0;i<all.length;i++)all[i].classList.toggle('on',all[i]===b);
    document.getElementById('cin-qlabel').textContent=b.dataset.label;
    qual.removeAttribute('open');
    setTimeout(function(){applyVolume(savedVol,false);sync(true)},400);
  });

  /* ── Субтитри (теж особисті: комусь потрібні, комусь заважають) ── */
  var subs=document.getElementById('cin-subs');
  if(subs)subs.addEventListener('click',function(e){
    var b=e.target.closest('.sopt');if(!b||!player||!player.setSubtitle)return;
    player.setSubtitle(Number(b.dataset.sub));
    var all=subs.querySelectorAll('.sopt');
    for(var i=0;i<all.length;i++)all[i].classList.toggle('on',all[i]===b);
    var lab=document.getElementById('cin-slabel');
    if(lab)lab.textContent=b.dataset.label;
    subs.classList.toggle('lit',Number(b.dataset.sub)>=0);
    subs.removeAttribute('open');
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

  /* ── Шухляда з налаштуваннями сеансу ──
     Джерело, зал, права й історія рідко потрібні під час показу,
     тож виїжджають збоку й так само зникають. */
  (function(){
    var drawer=document.getElementById('cin-drawer'),
        back=document.getElementById('cin-drawer-back'),
        open=document.getElementById('cin-settings'),
        shut=document.getElementById('cin-drawer-x');
    if(!drawer||!open)return;
    function show(on){
      drawer.hidden=!on;
      if(back)back.hidden=!on;
      open.classList.toggle('on',on);
      document.body.style.overflow=on?'hidden':'';
    }
    open.addEventListener('click',function(){show(drawer.hidden)});
    if(shut)shut.addEventListener('click',function(){show(false)});
    if(back)back.addEventListener('click',function(){show(false)});
    addEventListener('keydown',function(e){if(e.key==='Escape'&&!drawer.hidden)show(false)});
  })();

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
/**
 * Магазин: покупка й одягання без перезавантаження сторінки.
 * Кожна дія одразу видно на самій картці — і в балансі згори.
 */
/**
 * Вікно передперегляду.
 *
 * Показує не сам колір, а те, як із ним виглядатиме сторінка: смуга
 * навігації, картка з текстом, кнопка й аватар із рамкою. Так видно
 * результат до того, як щось вдягати.
 */
/**
 * Перемикання вітрини. Живе окремо від решти логіки профілю, бо потрібне
 * і на чужій сторінці — там свого гардероба немає, а вітрину гортати треба.
 */
const SHOWCASE_JS = `
(function(){
  var stage=document.getElementById('pf-stage');
  if(!stage)return;
  var big=stage.querySelector('.pf-big'),open=stage.querySelector('.pf-bigopen');

  document.addEventListener('click',function(e){
    var th=e.target.closest('.pf-th');
    if(!th)return;
    var url=th.dataset.url,video=th.dataset.video==='1';
    /* міняємо саме вміст, а не всю сцену — розмір полотна лишається сталим */
    big.innerHTML=video
      ? '<video class="pf-big-m" src="'+url+'" autoplay muted loop playsinline></video>'
      : '<img class="pf-big-m" src="'+url+'" alt="">';
    if(open)open.href=url;
    /* смуга мініатюр — сусід сцени, а не її вміст, тож шукаємо від спільного
       батька: інакше позначка «обрано» лишалась би на першій назавжди */
    var strip=th.closest('.pf-strip');
    if(strip)strip.querySelectorAll('.pf-th').forEach(function(b){b.classList.toggle('on',b===th)});
    stage.dataset.i=th.dataset.i;
  });
})();
`;

/** Голосування: спливаюче вікно на сторінці рейтингу. */
const VOTE_JS = `
(function(){
  var box=document.getElementById('vs');
  if(!box)return;

  function shut(){box.hidden=true;document.body.style.overflow=''}
  /* Вікно показуємо одразу: голос доступний раз на добу, тож нагадувати
     про нього кнопкою десь на сторінці було б слабше. */
  box.hidden=false;document.body.style.overflow='hidden';
  addEventListener('keydown',function(e){if(e.key==='Escape'&&!box.hidden)shut()});

  box.addEventListener('click',function(e){
    if(e.target===box||e.target.closest('.vs-x')){shut();return}
    var b=e.target.closest('.vs-one');
    if(!b||b.disabled)return;
    box.querySelectorAll('.vs-one').forEach(function(x){x.disabled=true});
    fetch('/api/vote',{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({target:b.dataset.user})})
      .then(function(r){return r.json()}).then(function(j){
        if(j.error){
          if(window.toast)window.toast(window.errText?window.errText(j.error):j.error,'bad');
          return;
        }
        /* Підтвердження — самою карткою: обраний зеленіє, і вікно
           закривається, бо голос уже віддано. */
        b.classList.add('won');
        setTimeout(shut,700);
      }).catch(function(){
        box.querySelectorAll('.vs-one').forEach(function(x){x.disabled=false});
      });
  });
})();
`;

const PREVIEW_JS = `
window.CosmeticPreview=(function(){
  var box=null;

  function shut(){if(box){box.remove();box=null;document.body.style.overflow=''}}

  function css(it){
    var v=it.value||{};
    if(it.kind==='background'&&v.type==='solid')return 'background:'+v.color;
    if(it.kind==='background'&&v.type==='gradient')
      return 'background:linear-gradient('+(v.angle||160)+'deg,'+v.from+','+v.to+')';
    if(it.kind==='background'&&v.type==='motion')
      return 'background:linear-gradient(120deg,'+v.from+','+v.to+','+v.from+');background-size:300% 300%;animation:flow 12s ease-in-out infinite';
    if(it.kind==='background'&&v.type==='image')return 'background:#05070d url('+v.url+') center/cover no-repeat';
    return 'background:#0a0d16';
  }

  /** Мініатюра варіанта в стрічці — показує сам зразок, а не підпис. */
  function thumb(it,i,on){
    var v=it.value||{},cls='pv-th'+(on?' on':''),style='';
    if(it.kind==='background'&&v.type==='solid')style='background:'+v.color;
    else if(it.kind==='background'&&v.type==='gradient')
      style='background:linear-gradient('+(v.angle||160)+'deg,'+v.from+','+v.to+')';
    else if(it.kind==='background'&&v.type==='motion'){cls+=' mo';style='--a:'+v.from+';--b:'+v.to}
    else if(v.type==='image')style='background-image:url('+v.url+')';
    else if(it.kind==='accent'){cls+=' ac';style='--c:'+v.color}
    else if(it.kind==='frame'){cls+=' fr';style='--c:'+v.color}
    else if(it.kind==='card')style='background:'+v.bg+';border-color:'+v.line;
    return '<button class="'+cls+'" data-i="'+i+'" style="'+style+'" title="'
      +String(it.name||'').replace(/"/g,'&quot;')+'"></button>';
  }

  /**
   * @param what {id,name,kind,value} або масив таких — тоді внизу зʼявляється
   *   стрічка варіантів. Раніше набір показувався по одному за клік із
   *   підказкою «клікайте ще», і скільки їх узагалі — було невідомо.
   * @param opts {hint, action:{label,fn}}
   */
  function open(what,opts){
    shut();
    opts=opts||{};
    var list=[].concat(what).filter(Boolean);
    if(!list.length)return;
    var idx=0;

    box=document.createElement('div');
    box.className='pv-back';
    box.innerHTML=
      '<div class="pv">'
      +'<div class="pv-h"><b></b><button class="gate-x pv-x" aria-label="×">×</button></div>'
      +'<div class="pv-stage">'
        +'<div class="pv-fog"></div>'
        +'<div class="pv-bar"><span class="pv-dot"></span><i></i><i></i><i class="on"></i></div>'
        +'<div class="pv-card">'
          +'<div class="pv-ava"></div>'
          +'<div class="pv-lines"><i></i><i class="s"></i></div>'
          +'<div class="pv-btn">Кнопка</div>'
        +'</div>'
      +'</div>'
      +'<div class="pv-strip"'+(list.length>1?'':' hidden')+'>'
      +list.map(function(it,i){return thumb(it,i,i===0)}).join('')
      +'</div>'
      +'<div class="pv-f"><span class="hint pv-hint"></span><span class="pv-act"></span></div>'
      +'</div>';

    var stage=box.querySelector('.pv-stage'),ava=box.querySelector('.pv-ava'),
        head=box.querySelector('.pv-h b'),dot=box.querySelector('.pv-bar i.on'),
        btn=box.querySelector('.pv-btn'),card=box.querySelector('.pv-card');

    /* Показуємо обраний варіант так, як він виглядатиме на сторінці. */
    function show(i){
      idx=i;
      var it=list[i],v=it.value||{};
      stage.setAttribute('style',css(it));
      head.textContent=it.name||'';
      var accent=(it.kind==='accent'&&v.color)||'#6b7cff';
      dot.style.background=accent;btn.style.background=accent;
      /* рамку показуємо лише тоді, коли дивимось саме на рамку */
      var frame=(it.kind==='frame'&&v.color)||null;
      ava.style.borderColor=frame||'';
      ava.style.boxShadow=frame?('0 0 0 4px '+frame+'33,0 0 24px '+frame+'66'):'';

      /* Стиль вікон показуємо на самій картці: раніше передперегляд його
         взагалі не враховував, тож «Вікна» виглядали так, ніби нічого
         не роблять. Тепер видно і округлість, і рамку, і тінь. */
      if(it.kind==='card'){
        card.style.background=v.bg||'';
        card.style.borderColor=v.line||'';
        card.style.borderWidth=(v.width||1)+'px';
        card.style.borderRadius=(v.radius==null?18:v.radius)+'px';
        card.style.backdropFilter='blur('+(v.blur||0)+'px)';
        card.style.boxShadow=v.shadow||'none';
      }else{
        card.style.background='';card.style.borderColor='';card.style.borderWidth='';
        card.style.borderRadius='';card.style.backdropFilter='';card.style.boxShadow='';
      }
      box.querySelectorAll('.pv-th').forEach(function(b,k){b.classList.toggle('on',k===i)});
    }
    show(0);
    box.querySelector('.pv-hint').textContent=opts.hint||'';

    if(opts.action){
      var b=document.createElement('button');
      b.className='btn sm';b.textContent=opts.action.label;
      b.addEventListener('click',function(){opts.action.fn(list[idx]);shut()});
      box.querySelector('.pv-act').appendChild(b);
    }

    box.addEventListener('click',function(e){
      var th=e.target.closest('.pv-th');
      if(th){show(Number(th.dataset.i));return}
      if(e.target===box||e.target.closest('.pv-x'))shut();
    });
    document.body.appendChild(box);
    document.body.style.overflow='hidden';
  }

  addEventListener('keydown',function(e){if(e.key==='Escape')shut()});
  return {open:open,close:shut};
})();
`;

const SHOP_JS = `
(function(){
  /* Відмова спливає поверх сторінки: смуга внизу лишалась непоміченою,
     бо кнопка, яку тиснули, зазвичай була зовсім в іншому місці. */
  function fail(t){if(window.toast)window.toast(t,'bad')}
  function done(t){if(window.toast)window.toast(t,'good')}

  /* тексти відмов приходять зі сторінки — вони перекладені */
  var say=window.errText||function(c){return c};

  /* Позначка «лише бустерам» тепер чип у рядку з назвою, а не плита поверх
     прев'ю, тож ставимо й знімаємо її саме там. */
  /**
   * Та сама робота показана двічі: у своєму розділі й у вікні цін
   * адміністратора. Тож правки й видалення застосовуємо до всіх її рядків —
   * інакше в одному місці зміна видно, а в другому лишається старе.
   */
  function rowsOf(asset){
    return [].slice.call(document.querySelectorAll('.sh-my[data-asset="'+asset+'"]'));
  }

  function setBoost(card,on){
    if(!card)return;
    var chips=card.querySelector('.sh-chips');
    var chip=chips?chips.querySelector('.sh-chip.boost'):null;
    if(on&&!chip){
      if(!chips){
        chips=document.createElement('div');chips.className='sh-chips';
        var n=card.querySelector('.sh-n');
        if(n&&n.parentNode)n.parentNode.insertBefore(chips,n.nextSibling);
      }
      chip=document.createElement('span');chip.className='sh-chip boost';
      chip.textContent=(document.querySelector('.shop')||{dataset:{}}).dataset.boost||'🚀';
      chips.appendChild(chip);
    }else if(!on&&chip){
      chip.remove();
      if(chips&&!chips.children.length)chips.remove();
    }
  }

  function post(url,payload){
    return fetch(url,{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify(payload)}).then(function(r){return r.json()})
      .catch(function(){return{error:'net'}});
  }

  /* ── Категорія показує лише свій розділ ──
     Раніше це був якір із підсвіткою: усі розділи лишались на сторінці,
     і магазин був одним довгим сувоєм. */
  var cats=[].slice.call(document.querySelectorAll('.sh-cat'));
  var secs=[].slice.call(document.querySelectorAll('.sh-sec'));
  var empty=document.getElementById('sh-empty');

  function filter(name){
    cats.forEach(function(c){c.classList.toggle('on',c.dataset.cat===name)});
    var shown=0;
    secs.forEach(function(s){
      var hide=false;
      if(name==='mine'){
        /* «Моє» — зрізи по всіх розділах, тож ховаємо не секції, а картки */
        var any=0;
        s.querySelectorAll('.sh-card').forEach(function(card){
          var mine=card.classList.contains('mine');
          card.hidden=!mine;if(mine)any++;
        });
        hide=!any;
      }else{
        s.querySelectorAll('.sh-card').forEach(function(card){card.hidden=false});
        hide=name!=='all'&&s.id!==name;
      }
      s.hidden=hide;
      if(!hide)shown++;
    });
    if(empty)empty.hidden=shown>0;
    try{history.replaceState(null,'',name==='all'?location.pathname:'#'+name)}catch(e){}
  }

  cats.forEach(function(c){
    c.addEventListener('click',function(){filter(c.dataset.cat)});
  });
  /* прийшли за посиланням на конкретний розділ — одразу показуємо його */
  var start=(location.hash||'').slice(1);
  if(start&&cats.some(function(c){return c.dataset.cat===start}))filter(start);

  /* ── Заливка своєї роботи ──
     Живе тільки тут: результат потрапляє саме в магазин, тож і заливати
     логічно звідси. Спершу видно картинку, призначення й ціну — списання
     відбувається лише після підтвердження. */
  (function(){
    var win=document.getElementById('sh-upwin');
    if(!win)return;
    var file=document.getElementById('sh-upfile'),drop=document.getElementById('sh-updrop'),
        shot=document.getElementById('sh-upshot'),title=document.getElementById('sh-uptitle'),
        price=document.getElementById('sh-upprice'),go=document.getElementById('sh-upgo'),
        hint=document.getElementById('sh-uphint'),where=document.getElementById('sh-upwhere');
    var boost=document.getElementById('sh-upboost');
    var chosen=null,kind='background',tpl=go.dataset.tpl||'{n}',explain=hint.textContent;

    /* куди саме лягне робота — видно ще до заливки */
    var CATS={};
    [].slice.call(document.querySelectorAll('.sh-cat')).forEach(function(c){
      CATS[c.dataset.cat]=(c.querySelector('.sh-cn')||{}).textContent||'';
    });
    var KIND2CAT={background:'bg',banner:'banner',art:'art'};

    /* Ціна не підставляється, тож поки її не вписали — публікувати нічого. */
    function asked(){var n=Math.round(Number(price.value));return n>0?n:0}
    function cost(){return Math.max(1,Math.ceil(asked()/2))}
    function refresh(){
      var ready=!!chosen&&asked()>0;
      go.textContent=asked()>0?tpl.replace('{n}',cost()):tpl.replace('{n}','—');
      go.disabled=!ready;
      var cat=(CATS[KIND2CAT[kind]]||'').trim();
      where.textContent=cat?('→ '+cat):'';
      /* ілюстрація йде на все полотно профілю, тож там доречні й гіфка, й відео */
      file.accept=kind==='art'?'image/*,video/mp4,video/webm':'image/*';
    }

    function open(k){
      kind=k||'background';
      document.querySelectorAll('.sh-upkind').forEach(function(b){
        b.classList.toggle('on',b.dataset.kind===kind);
      });
      win.hidden=false;document.body.style.overflow='hidden';
      hint.textContent=explain;refresh();
    }
    function shut(){
      win.hidden=true;document.body.style.overflow='';
      chosen=null;file.value='';shot.style.backgroundImage='';shot.innerHTML='';
      title.value='';price.value='';
      if(boost)boost.checked=false;
      drop.classList.remove('has');go.classList.remove('busy');refresh();
    }

    document.addEventListener('click',function(e){
      var opener=e.target.closest('.sh-upopen');
      if(opener){open(opener.dataset.kind);return}
      /* Закриваємо лише хрестиком або «Скасувати». Клік повз вікно —
         надто легкий спосіб втратити вже обраний файл і вписані дані. */
      if(!win.hidden&&e.target.closest('.sh-upx')){shut();return}
      var k=e.target.closest('.sh-upkind');
      if(k){kind=k.dataset.kind;
        document.querySelectorAll('.sh-upkind').forEach(function(b){b.classList.toggle('on',b===k)});
        refresh();}
    });
    addEventListener('keydown',function(e){if(e.key==='Escape'&&!win.hidden)shut()});

    file.addEventListener('change',function(){
      var f=file.files&&file.files[0];
      if(!f)return;
      chosen=f;
      var fr=new FileReader();
      fr.onload=function(){
        /* відео фоном не покажеш — для нього ставимо справжній плеєр */
        if(/^video\\//.test(f.type)){
          shot.style.backgroundImage='';
          shot.innerHTML='<video src="'+fr.result+'" autoplay muted loop playsinline '
            +'style="width:100%;height:100%;object-fit:contain;border-radius:11px"></video>';
        }else{
          shot.innerHTML='';
          shot.style.backgroundImage='url('+fr.result+')';
        }
        drop.classList.add('has');
      };
      fr.readAsDataURL(f);
      refresh();
    });
    price.addEventListener('input',refresh);

    go.addEventListener('click',function(){
      if(!chosen)return;
      go.classList.add('busy');go.disabled=true;
      var fd=new FormData();
      fd.append('slot',kind);fd.append('price',String(asked()));
      fd.append('title',title.value||'');fd.append('file',chosen);
      if(boost&&boost.checked)fd.append('booster','1');
      fetch('/api/profile/asset',{method:'POST',body:fd})
        .then(function(r){return r.json()}).then(function(j){
          if(j.error){fail(say(j.error));hint.textContent=say(j.error);
            go.classList.remove('busy');go.disabled=false;return}
          /* робота вже в магазині — показуємо її в тому самому розділі */
          location.reload();
        }).catch(function(){
          fail(say('net'));go.classList.remove('busy');go.disabled=false;
        });
    });

    /* з профілю приходять по «залити своє» — одразу відкриваємо вікно */
    if((location.hash||'')==='#upload')open('background');
  })();

  document.addEventListener('click',function(e){
    /* ── отримати набір: картка міняється на місці ── */
    var buy=e.target.closest('.sh-buy');
    if(buy){
      var card=buy.closest('.sh-card');
      buy.disabled=true;buy.classList.add('busy');
      post('/api/shop/buy',{item:buy.dataset.item}).then(function(j){
        buy.disabled=false;buy.classList.remove('busy');
        if(j.error){fail(say(j.error));return}

        var bal=document.getElementById('sh-balance');
        if(bal&&typeof j.balance==='number')bal.textContent=j.balance;

        card.classList.add('mine','bought');
        var a=card.querySelector('.sh-a');
        if(a)a.innerHTML='<a class="btn ghost sm" href="/me#look">Обрати в профілі</a>';
        /* позначка «уже ваше» зʼявляється одразу, без перезавантаження */
        if(!card.querySelector('.sh-own-tag')){
          var tag=document.createElement('span');
          tag.className='sh-own-tag';tag.textContent='✓ Уже ваше';
          card.insertBefore(tag,card.firstChild.nextSibling);
        }
        var mineCat=document.querySelector('.sh-cat[data-cat="mine"] .sh-cc');
        if(mineCat)mineCat.textContent=String((Number(mineCat.textContent)||0)+1);
      });
      return;
    }

    /* ── передперегляд: увесь набір одразу, варіанти перемикаються стрічкою ── */
    var prev=e.target.closest('.sh-prev');
    if(prev&&window.CosmeticPreview){
      var card=prev.closest('.sh-card');
      var items=JSON.parse(card.dataset.items||'[]');
      if(!items.length)return;

      /* із самого передперегляду можна й купити — не треба закривати вікно,
         шукати ту саму картку й тиснути кнопку ще раз */
      var buyBtn=card.querySelector('.sh-buy');
      window.CosmeticPreview.open(items,{
        action:buyBtn?{label:buyBtn.textContent.trim(),fn:function(){buyBtn.click()}}:null,
      });
      return;
    }

    /* ── вікно цін (адміністратор) ── */
    var openp=e.target.closest('#sh-openprices');
    var win=document.getElementById('sh-prices');
    if(openp&&win){win.hidden=false;document.body.style.overflow='hidden';return}
    if(win&&!win.hidden&&(e.target===win||e.target.closest('.sh-pricex'))){
      win.hidden=true;document.body.style.overflow='';return;
    }

    /* позначка «лише для бустерів» */
    var flag=e.target.closest('.sh-flag');
    if(flag){
      var next=!flag.classList.contains('on');
      post('/api/shop/flag',{item:flag.dataset.item,booster:next}).then(function(j){
        if(j.error){fail(say(j.error));return}
        flag.classList.toggle('on',j.booster);
        var card=document.querySelector('.sh-card[data-id="'+flag.dataset.item+'"]');
        if(card){
          setBoost(card,j.booster);
        }
      });
      return;
    }

    /* Зберігаємо всі ціни ОДНИМ запитом: коли їх слали окремо, кожен
       перезаписував спільну мапу, і доїжджала лише остання правка. */
    var save=e.target.closest('.sh-saveprices');
    if(save){
      var rows=[].slice.call(document.querySelectorAll('.sh-prow'));
      var prices={},flags={};
      rows.forEach(function(r){
        prices[r.dataset.item]=r.querySelector('input').value;
        flags[r.dataset.item]=r.querySelector('.sh-flag').classList.contains('on');
      });
      save.disabled=true;
      post('/api/shop/prices',{prices:prices,booster:flags}).then(function(j){
        save.disabled=false;
        if(j.error){fail(say(j.error));return}
        (j.items||[]).forEach(function(it){
          var card=document.querySelector('.sh-card[data-id="'+it.id+'"]');
          if(!card)return;
          var p=card.querySelector('.sh-p');
          if(p)p.textContent=it.price?it.price+' ✨FP':'безкоштовно';
          var b=card.querySelector('.sh-buy');
          if(b)b.textContent=it.price?it.price+' ✨':'Взяти';
          setBoost(card,it.booster);
        });
        save.classList.add('done');
        setTimeout(function(){save.classList.remove('done')},900);
      });
      return;
    }

    /* ── виставити роботу на вітрину або зняти ── */
    var list=e.target.closest('.sh-list');
    if(list){
      var row=list.closest('.sh-my');
      var on=list.dataset.on==='1';
      list.disabled=true;
      /* Свою роботу править автор, будь-чию — адміністратор. Спільна точка
         входу /api/shop/asset розбирається, хто саме прийшов. */
      post('/api/shop/asset',{
        asset:list.dataset.asset,
        price:row.querySelector('.sh-myprice').value||undefined,
        title:row.querySelector('.sh-mytitle').value,
        listed:!on,
      }).then(function(j){
        list.disabled=false;
        if(j.error){fail(say(j.error));return}
        list.dataset.on=on?'0':'1';
        list.textContent=on?'Виставити':'Зняти';
        row.classList.toggle('listed',!on);
        done(on?'Знято з вітрини':'Виставлено на вітрину');
      });
      return;
    }

    /* ── буст для власної роботи ── */
    var mb=e.target.closest('.sh-myboost');
    if(mb){
      var next=!mb.classList.contains('on');
      mb.disabled=true;
      post('/api/shop/asset',{asset:mb.dataset.asset,booster:next}).then(function(j){
        mb.disabled=false;
        if(j.error){fail(say(j.error));return}
        rowsOf(mb.dataset.asset).forEach(function(r){
          var b=r.querySelector('.sh-myboost');if(b)b.classList.toggle('on',j.asset.booster);
        });
        setBoost(document.querySelector('.sh-card[data-id="asset:'+mb.dataset.asset+'"]'),j.asset.booster);
        done(j.asset.booster?'Тепер лише для бустерів':'Відкрито для всіх');
      });
      return;
    }

    /* ── видалення роботи ──
       Її могли вже купити, тож попереджаємо: покупцям повернеться половина,
       а сама річ зникне і з магазину, і з їхніх профілів. */
    var del=e.target.closest('.sh-mydel');
    if(del){
      if(!confirm(del.dataset.confirm||'?'))return;
      del.disabled=true;
      post('/api/shop/assetDelete',{asset:del.dataset.asset}).then(function(j){
        del.disabled=false;
        if(j.error){fail(say(j.error));return}
        rowsOf(del.dataset.asset).forEach(function(r){r.remove()});
        var card=document.querySelector('.sh-card[data-id="asset:'+del.dataset.asset+'"]');
        if(card)card.remove();
        var bal=document.getElementById('sh-balance');
        if(bal&&typeof j.balance==='number')bal.textContent=j.balance;
        done(j.refunded
          ?('Видалено; повернуто '+j.total+' ✨FP покупцям ('+j.refunded+')')
          :'Роботу видалено');
      });
      return;
    }

    /* збереження опису й ціни роботи — по виходу з поля */
  });

  /* Опис і ціну роботи зберігаємо, коли поле втрачає фокус: окрема кнопка
     «зберегти» для кожного рядка тільки захаращувала б список. */
  document.addEventListener('change',function(e){
    var f=e.target.closest('.sh-mytitle,.sh-myprice');
    if(!f)return;
    var row=f.closest('.sh-my');
    var payload={asset:row.dataset.asset,title:row.querySelector('.sh-mytitle').value};
    var p=row.querySelector('.sh-myprice').value;
    if(p)payload.price=p;
    post('/api/shop/asset',payload).then(function(j){
      if(j.error){fail(say(j.error));return}
      /* другий рядок тієї ж роботи має показувати те саме */
      rowsOf(row.dataset.asset).forEach(function(other){
        if(other===row)return;
        other.querySelector('.sh-mytitle').value=j.asset.title;
        other.querySelector('.sh-myprice').value=j.asset.price;
      });
      var card=document.querySelector('.sh-card[data-id="asset:'+row.dataset.asset+'"]');
      if(card){
        var n=card.querySelector('.sh-n');if(n&&j.asset.title)n.textContent=j.asset.title;
        var pr=card.querySelector('.sh-p');if(pr)pr.textContent=j.asset.price+' ✨FP';
      }
      done('Збережено');
    });
  });
})();
`;

/**
 * Профіль: опис, гардероб і свої картинки.
 * Усе застосовується на місці — сторінка не перезавантажується, бо оформлення
 * видно одразу, а перезавантаження щоразу збивало б з пантелику.
 */
const PROFILE_JS = `
(function(){
  function post(url,payload){
    return fetch(url,{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify(payload)}).then(function(r){return r.json()})
      .catch(function(){return{error:'net'}});
  }

  /* Вдягання нічого не питає й не перезавантажує сторінку, тож без короткого
     підтвердження було незрозуміло, чи дія взагалі зарахувалась — надто коли
     річ схожа на попередню. */
  var TXT=(document.getElementById('pf-txt')||{dataset:{}}).dataset;
  function say(t,kind){if(window.toast&&t)window.toast(t,kind||'good')}
  function fill(tpl,name){return String(tpl||'').replace('{name}',name||'')}

  /* ── Оформлення застосовуємо самі, без перезавантаження ── */
  function paint(look){
    var st=document.getElementById('skin-live');
    if(!st){st=document.createElement('style');st.id='skin-live';document.head.appendChild(st)}
    var css='',bg=look&&look.background;
    if(bg&&bg.type==='solid')css+='.bg{background:'+bg.color+'}';
    if(bg&&bg.type==='gradient')css+='.bg{background:linear-gradient('+(bg.angle||160)+'deg,'+bg.from+','+bg.to+')}';
    if(bg&&bg.type==='motion')css+='.bg{background:linear-gradient(120deg,'+bg.from+','+bg.to+','+bg.from+');background-size:300% 300%;animation:flow 18s ease-in-out infinite}';
    if(bg&&bg.type==='image'){
      css+='.bg{background:#05070d url('+bg.url+') center/cover no-repeat fixed}';
      /* накладка під полотнами, інакше вона гасить дим і зорі */
      css+='.bg::after{content:"";position:absolute;inset:0;z-index:0;'
        +'background:linear-gradient(180deg,rgba(4,6,12,.62),rgba(4,6,12,.48))}';
    }
    if(bg)css+='#fog{opacity:.5;mix-blend-mode:screen}#stars{opacity:.85;mix-blend-mode:screen}';
    if(look&&look.accent){
      var sh=function(hex,d){
        var n=parseInt(String(hex).replace('#',''),16);
        var p=[(n>>16)&255,(n>>8)&255,n&255].map(function(v){return Math.max(0,Math.min(255,v+d))});
        return '#'+p.map(function(v){return v.toString(16).padStart(2,'0')}).join('');
      };
      /* той самий колір числами — його беруть усі напівпрозорі підсвітки */
      var rgb=function(hex){
        var n=parseInt(String(hex).replace('#',''),16);
        return ((n>>16)&255)+','+((n>>8)&255)+','+(n&255);
      };
      css+=':root{--accent:'+look.accent+';--accent-hi:'+sh(look.accent,18)
        +';--accent-lo:'+sh(look.accent,-18)+';--accent-up:'+sh(look.accent,30)
        +';--accent-rgb:'+rgb(look.accent)+'}';
    }
    if(look&&look.frame)css+='.avatar{border-color:'+look.frame.color+'!important;box-shadow:0 0 0 4px '+look.frame.color+'33,0 0 26px '+look.frame.color+'66}';
    if(look&&look.card){
      var c=look.card,rad=(c.radius||18),bl=(c.blur||14);
      css+=':root{--card:'+c.bg+';--line:'+c.line+';--radius:'+rad+'px;--blur:'+bl+'px'
        +';--line-w:'+(c.width||1)+'px}';
      css+=':root{--menu:'+(c.menu||('linear-gradient(0deg,rgba(8,11,18,.94),rgba(8,11,18,.94)),'+c.bg))+'}';
      /* той самий перелік поверхонь, що й на сервері — інакше після вибору
         без перезавантаження стиль лягав би лише на частину вікон */
      css+='${CARD_SURFACES}{border-radius:'+rad+'px;backdrop-filter:blur('+bl+'px);'
        +'-webkit-backdrop-filter:blur('+bl+'px)'+(c.shadow?';box-shadow:'+c.shadow:'')+'}';
    }
    st.textContent=css;

    /* Вітрина: перемальовуємо сцену й смугу під нею, коли змінився вибір.
       Ілюстрацією може бути картинка, гіфка або відео — тег залежить від mime. */
    var stage=document.getElementById('pf-stage');
    if(stage&&look&&look.showcase){
      var list=look.showcase;
      var wrap=stage.closest('.pf-show');
      if(wrap)wrap.hidden=!list.length;
      if(list.length){
        var first=list[0],vid=/^video\\//.test(first.mime||'');
        var big=stage.querySelector('.pf-big');
        if(big){
          big.innerHTML=vid
            ? '<video class="pf-big-m" src="'+first.url+'" autoplay muted loop playsinline></video>'
            : '<img class="pf-big-m" src="'+first.url+'" alt="">';
        }
        var open=stage.querySelector('.pf-bigopen');
        if(open)open.href=first.url;

        var strip=stage.parentNode.querySelector('.pf-strip');
        if(strip){
          strip.innerHTML=list.map(function(s,i){
            var v=/^video\\//.test(s.mime||'');
            return '<button class="pf-th'+(i?'':' on')+'" data-i="'+i+'" data-url="'+s.url+'"'
              +' data-video="'+(v?'1':'')+'" data-title="'+(s.title||'')+'"'
              +(v?'':' style="background-image:url('+s.url+')"')+'>'+(v?'<i>▶</i>':'')+'</button>';
          }).join('');
          strip.hidden=list.length<2;
        }
      }
    }

    /* банер угорі картки */
    var head=document.querySelector('.pf-head');
    var old=head?head.querySelector('.pf-banner'):null;
    if(look&&look.bannerUrl){
      if(!old){
        old=document.createElement('div');old.className='pf-banner';
        old.innerHTML='<img alt="">';head.prepend(old);head.classList.add('withbanner');
      }
      old.querySelector('img').src=look.bannerUrl;
    }else if(old){old.remove();head.classList.remove('withbanner')}

    /* позначки «вдягнено» */
    document.querySelectorAll('.pf-sw').forEach(function(b){
      var kind=b.dataset.kind,on=false;
      if(kind==='background')on=!!bg&&bg.id===b.dataset.item;
      if(kind==='frame')on=!!(look&&look.frame)&&look.frame.id===b.dataset.item;
      if(kind==='accent')on=b.classList.contains('on');
      b.classList.toggle('on',on);
    });
  }

  /* ── Вікно оформлення ── */
  (function(){
    var win=document.getElementById('look'),open=document.getElementById('pf-lookopen');
    if(!win||!open)return;
    function show(on){win.hidden=!on;document.body.style.overflow=on?'hidden':''}
    open.addEventListener('click',function(){show(true)});
    win.addEventListener('click',function(e){
      if(e.target===win||e.target.closest('.pf-lookx'))show(false);
    });
    addEventListener('keydown',function(e){if(e.key==='Escape'&&!win.hidden)show(false)});
    /* із магазину приходять із #look — одразу відкриваємо */
    if(location.hash==='#look')show(true);
  })();

  /* ── Вкладки вікна оформлення ── */
  (function(){
    var tabs=[].slice.call(document.querySelectorAll('.pf-tab'));
    var panels=[].slice.call(document.querySelectorAll('.pf-panel'));
    if(!tabs.length)return;
    var scroll=document.querySelector('.pf-scroll');
    function go(name){
      tabs.forEach(function(t){
        var on=t.dataset.tab===name;
        t.classList.toggle('on',on);t.setAttribute('aria-selected',on?'true':'false');
      });
      panels.forEach(function(p){p.hidden=p.dataset.panel!==name});
      /* новий розділ читається згори, а не з місця, де скінчився попередній */
      if(scroll)scroll.scrollTop=0;
    }
    tabs.forEach(function(t){t.addEventListener('click',function(){go(t.dataset.tab)})});
    /* із магазину приходять по «залити своє» — одразу потрібна вкладка */
    if(location.hash==='#upload')go('images');
  })();

  /* ── Рівень ── */
  (function(){
    var up=document.getElementById('pf-levelup');
    if(!up)return;
    up.addEventListener('click',function(){
      up.disabled=true;up.classList.add('busy');
      post('/api/shop/level',{}).then(function(j){
        up.classList.remove('busy');
        if(j.error){
          say(window.errText?window.errText(j.error):j.error,'bad');
          up.disabled=false;return;
        }
        var chip=document.querySelector('.lvchip b');
        if(chip)chip.textContent=j.level;
        say((TXT.lvlDone||'').replace('{n}',j.level));
        if(j.unlocked)say((TXT.lvlUnlocked||'').replace('{name}',j.unlocked.name));
        /* ціна наступного вже інша, а смуга — з нового балансу */
        setTimeout(function(){location.reload()},900);
      });
    });
  })();

  /* ── Опис ── */
  var box=document.getElementById('pf-about'),edit=document.getElementById('pf-edit');
  if(edit&&box)edit.addEventListener('click',function(){
    var open=box.classList.toggle('editing');
    edit.textContent=edit.dataset[open?'save':'edit'];
    var ta=box.querySelector('textarea');
    if(open){if(ta)ta.focus();return}
    post('/api/profile',{about:ta?ta.value:''}).then(function(j){
      if(j.error)return;
      var view=box.querySelector('.pf-text');
      if(view)view.textContent=(ta&&ta.value.trim())||'—';
    });
  });

  /** Вдягнути або зняти річ і сказати про це вголос. */
  function equip(sw,was,name){
    return post('/api/shop/equip',{item:was?'':sw.dataset.item}).then(function(j){
      if(j.error){say(window.errText?window.errText(j.error):j.error,'bad');return}
      if(sw.dataset.kind==='accent'){
        document.querySelectorAll('.pf-sw.accent').forEach(function(b){
          b.classList.toggle('on',b===sw&&!was);
        });
      }
      paint(j.look);
      say(fill(was?TXT.removed:TXT.worn,name));
    });
  }

  /* ── Гардероб ── */
  document.addEventListener('click',function(e){
    var sw=e.target.closest('.pf-sw');
    if(sw){
      var was=sw.classList.contains('on');
      var it=JSON.parse(sw.dataset.item2||'null');

      /* спершу показуємо, як це виглядатиме, і вже потім вдягаємо */
      if(it&&window.CosmeticPreview&&!e.shiftKey){
        window.CosmeticPreview.open(it,{
          hint:was?'Зараз вдягнено':'',
          action:{label:was?'Зняти':'Вдягнути',fn:function(){
            equip(sw,was,(it&&it.name)||'');
          }},
        });
        return;
      }

      equip(sw,was,(it&&it.name)||sw.title||'');
      return;
    }

    /* які блоки показувати на своїй сторінці */
    var bl=e.target.closest('.pf-block');
    if(bl){
      var vis=!bl.classList.contains('on');
      var body={hidden:{}};body.hidden[bl.dataset.block]=!vis;
      post('/api/profile',body).then(function(j){
        if(j.error)return;
        bl.classList.toggle('on',vis);
        /* блок ховаємо одразу, без перезавантаження */
        var sel={chart:'.chartbox',showcase:'.pf-show',about:'.pf-aboutbox'}[bl.dataset.block];
        var node=sel?document.querySelector(sel):null;
        if(node)node.hidden=!vis;
      });
      return;
    }

    /* вітрина: клік по картинці додає або прибирає її */
    var sp=e.target.closest('#pf-showpick .pf-shot');
    if(sp){
      sp.classList.toggle('on');
      var picked=[].slice.call(document.querySelectorAll('#pf-showpick .pf-shot.on'))
        .map(function(b){return Number(b.dataset.show)});
      post('/api/profile',{showcase:picked}).then(function(j){
        if(j.error){sp.classList.toggle('on');say(window.errText?window.errText(j.error):j.error,'bad');return}
        paint(j.look);
        say(TXT.showcase);
      });
      return;
    }

    /* порядок блоків: стрілками вгору-вниз */
    var mv=e.target.closest('.pf-oup,.pf-odown');
    if(mv){
      var row=mv.closest('.pf-orow'),list=document.getElementById('pf-order');
      var up=mv.classList.contains('pf-oup');
      if(up&&row.previousElementSibling)list.insertBefore(row,row.previousElementSibling);
      else if(!up&&row.nextElementSibling)list.insertBefore(row.nextElementSibling,row);
      var rows=[].slice.call(list.children);
      rows.forEach(function(r,i){
        r.querySelector('.pf-onum').textContent=i+1;
        r.querySelector('.pf-oup').disabled=i===0;
        r.querySelector('.pf-odown').disabled=i===rows.length-1;
      });
      post('/api/profile',{layout:rows.map(function(r){return r.dataset.block})}).then(function(j){
        if(j.error){say(window.errText?window.errText(j.error):j.error,'bad');return}
        say(TXT.orderSaved||'');
      });
      return;
    }

    /* висота банера */
    var bh=e.target.closest('.pf-bh');
    if(bh){
      post('/api/profile',{bannerH:bh.dataset.h}).then(function(j){
        if(j.error){say(window.errText?window.errText(j.error):j.error,'bad');return}
        document.querySelectorAll('.pf-bh').forEach(function(b){b.classList.toggle('on',b===bh)});
        var ban=document.querySelector('.pf-banner');
        if(ban){ban.className='pf-banner pf-b-'+bh.dataset.h}
        say(TXT.orderSaved||'');
      });
      return;
    }

    /* налаштування: де показувати оформлення */
    var sc=e.target.closest('.pf-scope');
    if(sc){
      var next=!sc.classList.contains('on');
      var body={scope:{}};body.scope[sc.dataset.part]=next;
      post('/api/profile',body).then(function(j){
        if(j.error)return;
        sc.classList.toggle('on',next);
        paint(j.look);
      });
      return;
    }

    /* скинути все одразу — щоб не тиснути п'ять кнопок поспіль */
    var all=e.target.closest('.pf-clearall');
    if(all){
      all.classList.add('busy');
      var parts=['background','accent','frame','card','banner'];
      Promise.all(parts.map(function(w){return post('/api/shop/clear',{what:w})}))
        .then(function(res){
          all.classList.remove('busy');
          var last=res[res.length-1];
          document.querySelectorAll('.pf-sw.on').forEach(function(b){b.classList.remove('on')});
          if(last&&last.look)paint(last.look);
          say(TXT.reset);
        });
      return;
    }

    var clr=e.target.closest('.pf-clear');
    if(clr){
      post('/api/shop/clear',{what:clr.dataset.what}).then(function(j){
        if(j.error){say(window.errText?window.errText(j.error):j.error,'bad');return}
        if(clr.dataset.what==='accent'){
          document.querySelectorAll('.pf-sw.accent').forEach(function(b){b.classList.remove('on')});
        }
        paint(j.look);
        say(fill(TXT.removed,clr.textContent.trim()));
      });
      return;
    }

    /* своя картинка: клік по ній ставить її у свою ж категорію */
    var shot=e.target.closest('.pf-shot');
    if(shot&&shot.dataset.asset){
      var slot=shot.dataset.slot||'background';
      var was=shot.classList.contains('on');
      var body={};body[slot]=was?'':shot.dataset.asset;   /* повторний клік знімає */
      post('/api/profile',body).then(function(j){
        if(j.error){say(window.errText?window.errText(j.error):j.error,'bad');return}
        /* Позначку міняємо лише в межах свого призначення: картинки тепер
           розкладені по групах, і вибір фону не має скидати банер. */
        document.querySelectorAll('.pf-shot[data-slot="'+slot+'"]').forEach(function(b){
          b.classList.toggle('on',b===shot&&!was);
        });
        paint(j.look);
        say(fill(was?TXT.removed:TXT.worn,shot.closest('.pf-group').querySelector('.pf-gt span').textContent.trim()));
      });
    }
  });

})();
`;

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
          /* Підтверджуємо словом, а не лише кольором: кнопка стає «Готово ✓»
             і чекає, поки анімація дограє, — тоді оновлюємо сторінку. */
          apply.classList.add('done');
          apply.dataset.was=apply.textContent;
          apply.textContent=apply.dataset.done||'Готово';
          setTimeout(function(){location.reload()},700);
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
function langSwitch(lang, path, query = '') {
  const cur = LANGS[lang] ?? LANGS.uk;
  // Решту параметрів сторінки несемо з собою: без цього вибір мови на
  // «/gallery?sort=top» повертав стрічку до типового сортування.
  const keep = String(query ?? '');
  const opts = Object.values(LANGS).map((l) =>
    `<a href="${esc(path)}?${keep ? `${esc(keep)}&amp;` : ''}lang=${l.code}" class="${l.code === lang ? 'on' : ''}">
      <b>${l.short}</b><span>${esc(l.name)}</span></a>`,
  ).join('');

  return `<details class="langs">
    <summary aria-label="${esc(t(lang, 'nav.lang'))}"><b>${cur.short}</b><i></i></summary>
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
  // og:* читаються з property, twitter:* — з name. Раніше всі йшли через
  // property, і частина месенджерів просто не бачила картку.
  return tags
    .filter(([, v]) => v)
    .map(([k, v]) => `<meta ${k.startsWith('twitter:') ? 'name' : 'property'}="${k}" content="${esc(v)}">`)
    .join('\n');
}

/**
 * Особисте оформлення на весь сайт.
 *
 * Фон, акцент і рамка аватара — це вибір людини, тож він їде з нею по всіх
 * сторінках, а не живе лише в профілі. Зорі й дим лишаються завжди: дим
 * переходить у режим «screen» і притлумлюється, тож світиться поверх кольору
 * замість того, щоб його забивати.
 */
function skinCss(look, { page = null } = {}) {
  if (!look) return '';
  // «Тут» — будь-яка сторінка профілю: своя або чужа. На чужій ми показуємо
  // оформлення її власника, тож обмеження «лише в профілі» діє й там.
  const here = page === 'me' || page === 'u';
  const scope = look.scope ?? {};
  // Кожну частину оформлення можна лишити тільки в профілі — це вибір людини
  // в налаштуваннях; за замовчуванням усе діє на всьому сайті.
  const show = (part) => (scope[part] === false ? here : true);

  const bg = show('background') ? look.background : null;
  const rules = [];

  if (bg?.type === 'solid') rules.push(`.bg{background:${bg.color}}`);
  if (bg?.type === 'gradient') {
    rules.push(`.bg{background:linear-gradient(${bg.angle ?? 160}deg,${bg.from},${bg.to})}`);
  }
  if (bg?.type === 'motion') {
    rules.push(
      `.bg{background:linear-gradient(120deg,${bg.from},${bg.to},${bg.from});`
      + 'background-size:300% 300%;animation:flow 18s ease-in-out infinite}',
    );
  }
  // Старі записи могли мати префікс own:, для якого адреси вже немає, —
  // тоді у CSS ішло url(null) і фон ставав просто зламаним правилом.
  if (bg?.type === 'image' && bg.url) {
    rules.push(`.bg{background:#05070d url(${bg.url}) center/cover no-repeat fixed}`);
    // під власною картинкою текст мусить лишатися читабельним; накладка сидить
    // під полотнами (z-index:0), тож гасить саму картинку, а не дим із зорями
    rules.push('.bg::after{content:"";position:absolute;inset:0;z-index:0;'
      + 'background:linear-gradient(180deg,rgba(4,6,12,.62),rgba(4,6,12,.48))}');
  }
  // Дим і зорі лишаються завжди — вони й є обличчям сайту. Над власним фоном
  // дим переходить у «screen»: світиться поверх кольору, а не забиває його.
  if (bg) rules.push('#fog{opacity:.5;mix-blend-mode:screen}#stars{opacity:.85;mix-blend-mode:screen}');

  if (look.accent && show('accent')) {
    // Перевизначаємо самі токени — далі все оформлення підхоплює їх само,
    // включно зі станом під курсором, підсвітками й тінями.
    rules.push(`:root{--accent:${look.accent};`
      + `--accent-hi:${shade(look.accent, 18)};`
      + `--accent-lo:${shade(look.accent, -18)};`
      + `--accent-up:${shade(look.accent, 30)};`
      + `--accent-rgb:${rgbOf(look.accent)}}`);
  }

  if (look.card && show('card')) {
    const c = look.card;
    const radius = c.radius ?? 18;
    const blur = c.blur ?? 14;

    // Токени бере все оформлення само — разом із поверхнею спливних меню,
    // яку раніше ніщо не чіпало, тож меню лишалися типово-темними навіть
    // при світлому чи прозорому стилі вікон.
    rules.push(`:root{--card:${c.bg};--line:${c.line};--radius:${radius}px;--blur:${blur}px;`
      + `--line-w:${c.width ?? 1}px}`);

    // Меню й модальні вікна: обраний відтінок поверх щільної підкладки,
    // інакше майже прозорий стиль зробив би їх нечитабельними.
    rules.push(`:root{--menu:${c.menu ?? `linear-gradient(0deg,rgba(8,11,18,.94),rgba(8,11,18,.94)),${c.bg}`}}`);

    // Стиль поширюємо на всі поверхні-панелі, а не лише на .card:
    // раніше вікна кінотеатру, гардероба, магазину й передперегляду
    // лишалися з типовим виглядом, і оформлення застосовувалось «наполовину».
    rules.push(`${CARD_SURFACES}{border-radius:${radius}px;`
      + `backdrop-filter:blur(${blur}px);-webkit-backdrop-filter:blur(${blur}px)`
      + `${c.shadow ? `;box-shadow:${c.shadow}` : ''}}`);
  }

  if (look.frame) {
    const c = look.frame.color;
    rules.push(`.avatar{border-color:${c}!important;box-shadow:0 0 0 4px ${c}33,0 0 26px ${c}66}`);
    if (look.frame.style === 'spin') {
      rules.push(`.avatar{animation:frameSpin 6s linear infinite}
        @keyframes frameSpin{to{box-shadow:0 0 0 4px ${c}33,0 0 26px ${c}66}}`);
    }
    if (look.frame.style === 'pulse') {
      rules.push(`.avatar{animation:framePulse 2.6s ease-in-out infinite}
        @keyframes framePulse{0%,100%{box-shadow:0 0 0 4px ${c}22,0 0 18px ${c}55}
        50%{box-shadow:0 0 0 7px ${c}33,0 0 32px ${c}88}}`);
    }
  }

  return rules.length ? `<style>${rules.join('\n')}</style>` : '';
}

/** «107,124,255» — той самий колір для rgba(): підсвітки, обведення, тіні. */
function rgbOf(hex) {
  const m = /^#?([\da-f]{6})$/i.exec(String(hex));
  if (!m) return '107,124,255';
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/** Трохи темніший відтінок того самого кольору — для градієнта кнопок. */
function shade(hex, amount) {
  const m = /^#?([\da-f]{6})$/i.exec(String(hex));
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((v) => Math.max(0, Math.min(255, v + amount)));
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Тексти відмов для сторінки. Сервер відповідає короткими мітками
 * («funds», «no storage»), а людині треба речення — і тією мовою, яку вона
 * обрала. Раніше ці рядки були вписані в скрипт українською, тож в
 * англійському режимі магазин відповідав українською або взагалі мітками.
 */
function errorDict(lang) {
  const map = {
    funds: 'err.funds',
    booster: 'err.booster',
    owned: 'err.owned',
    limit: 'err.limit',
    locked: 'err.locked',
    'no storage': 'err.noStorage',
    'image only': 'err.imageOnly',
    'media only': 'err.mediaOnly',
    'not yours': 'err.notYours',
    level: 'err.level',
    cooldown: 'err.cooldown',
    'no duel': 'err.noDuel',
    net: 'err.net',
    unknown: 'err.unknown',
  };
  const out = {};
  for (const [code, key] of Object.entries(map)) out[code] = t(lang, key);
  return `window.ERRS=${JSON.stringify(out)};`
    + 'window.errText=function(c){return (window.ERRS||{})[c]||(window.ERRS||{}).unknown||c};'
    + TOAST_JS;
}

/**
 * Спливаючі повідомлення. Потрібні всюди, де дія міняє щось непомітно:
 * покупка не вдалася, річ вдягнено, роботу видалено. Раніше про це або
 * не було сказано взагалі, або текст лягав у самому низу сторінки.
 */
const TOAST_JS = `
window.toast=function(text,kind,avatar){
  if(!text)return;
  var box=document.querySelector('.toasts');
  if(!box){box=document.createElement('div');box.className='toasts';document.body.appendChild(box)}
  var el=document.createElement('div');
  el.className='toast'+(kind?' '+kind:'');
  /* Замість значка може бути аватарка — тоді видно, ХТО саме це зробив. */
  var ico={good:'✓',bad:'✕'}[kind];
  el.innerHTML=(avatar?'<img class="toast-face" alt="">':(ico?'<i>'+ico+'</i>':''))+'<span></span>';
  if(avatar)el.querySelector('.toast-face').src=avatar;
  el.querySelector('span').textContent=text;
  box.appendChild(el);
  /* більше трьох на екрані — це вже шум */
  while(box.children.length>3)box.removeChild(box.firstChild);
  setTimeout(function(){
    el.classList.add('out');
    setTimeout(function(){el.remove()},280);
  },kind==='bad'?4200:2600);
};
`;

/**
 * Сповіщення, які людина ще не бачила: хтось віддав їй голос або впала
 * нагорода за місце в рейтингу. Виводяться спливаючими вікнами — з ніком
 * і аватаркою того, хто голосував.
 */
function newsJs(news, lang) {
  const items = news.map((n) => ({
    text: n.kind === 'top'
      ? t(lang, 'news.top', { n: n.amount, place: n.place })
      : t(lang, 'news.vote', { name: n.name, n: n.amount }),
    avatar: n.kind === 'top' ? null : n.avatar,
  }));
  // невелика затримка й крок між ними — інакше кілька сповіщень
  // вискакують одночасно й перекривають одне одного
  return `(function(){var L=${JSON.stringify(items)};`
    + 'L.forEach(function(n,i){setTimeout(function(){'
    + 'if(window.toast)window.toast(n.text,"good",n.avatar)},600+i*900)})})();';
}

function shell({ title, content, hasCustomCss, extraJs = '', meta = '', skin = '', lang = 'uk', description = '' }) {
  return `<!doctype html>
<html lang="${esc(lang)}"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#05070d">
<!-- Сайт існує лише в темному вигляді: без цього браузер малює рідні
     елементи (поля, календарі, автозаповнення) світлими, і вони б'ють по очах. -->
<meta name="color-scheme" content="dark">
${description ? `<meta name="description" content="${esc(description)}">` : ''}
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/favicon.svg">
<link rel="manifest" href="/manifest.webmanifest">
<title>${esc(title)}</title>
${meta}
<style>${BASE_CSS}</style>
${hasCustomCss ? '<link rel="stylesheet" href="/custom.css">' : ''}
${skin}
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
  lang = 'uk', path = '/', query = '', gallery = false, page = null, og = null, look = null,
  news = [],
}) {
  // apart — кнопка стоїть окремо від основних, з розділювачем
  const navHtml = nav
    .map((n) => `<a href="${esc(n.href)}" class="${[n.active ? 'active' : '', n.apart ? 'apart' : ''].filter(Boolean).join(' ')}">${esc(n.label)}</a>`)
    .join('');

  // Сам чип із аватаром і ніком веде в профіль — окрема кнопка зайва.
  // Профіль — теж сторінка, тож коли ми на ній, чип світиться так само,
  // як активна кнопка в шапці.
  const auth = session
    ? `<div class="me${path === '/me' ? ' active' : ''}">
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
    lang,
    description: og?.description ?? '',
    skin: skinCss(look, { page }),
    meta: og ? metaTags(og) : '',
    extraJs: [
      // Сповіщення про голоси й нагороди. Показуються один раз — сервер
      // гасить їх одразу, щойно віддав сторінці.
      news.length ? newsJs(news, lang) : '',
      // словник відмов і спливні повідомлення потрібні там, де щось купують
      // або віддають голос
      ['shop', 'me', 'top'].includes(page) ? errorDict(lang) : '',
      gallery ? GALLERY_JS : '',
      page === 'cinema' ? PLAYERS_JS : '',
      page === 'cinema' ? CINEMA_JS : '',
      page === 'mod' ? MOD_JS : '',
      page === 'shop' || page === 'me' ? PREVIEW_JS : '',
      page === 'shop' ? SHOP_JS : '',
      page === 'me' ? PROFILE_JS : '',
      // вітрину гортають і на чужій сторінці, тож скрипт іде на обидві
      page === 'me' || page === 'u' ? SHOWCASE_JS : '',
      page === 'top' ? VOTE_JS : '',
    ].filter(Boolean).join('\n'),
    // Смуга навігації йде на всю ширину вікна, а її вміст тримається тієї ж
    // сітки, що й сторінка. На головній її немає — там своя обкладинка.
    content: `<div class="topbar" id="topbar">
      <!-- Смуга однакова на всіх сторінках: ширина вмісту стала, тож назва
           сервера й кнопки стоять на тому самому місці, куди б ви не пішли.
           Ширина самої сторінки нижче може бути різна — це вже не впливає. -->
      <div class="topbar-in">
        <a class="brand" href="/"><span class="dot"></span>${esc(guildName)}</a>
        <nav>${navHtml}${auth}${langSwitch(lang, path, query)}</nav>
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
  // Головна дія для своїх — у стилі сайту, для гостей — у кольорах Discord,
  // бо це саме вхід через Discord.
  const primary = session
    ? `<a class="dbtn site" href="/top">🏆 <span>${esc(t(lang, 'nav.top'))}</span></a>`
    : `<a class="dbtn" href="/login?next=/">${DISCORD_ICON}<span>${esc(t(lang, 'landing.login'))}</span></a>`;

  return shell({
    title: 'Моментус',
    lang,

    description: og?.description ?? '',
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
/**
 * Рейтинг картками, а не списком.
 *
 * Люди вкладаються в оформлення свого профілю — банер, акцент, рамку, — і
 * рядок таблиці з ніком та числом усе це ховав. Тепер кожен показаний тим
 * самим блоком, що й угорі його сторінки, у його ж кольорах. Перші три
 * місця йдуть ширшими картками з медаллю: без цього «перемога» в рейтингу
 * нічим не відрізнялась від четвертого місця.
 */
export function leaderboardPage(rows, lang = 'uk', { duel = null } = {}) {
  if (!rows.length) return `<div class="card empty rise">${esc(t(lang, 'top.empty'))}</div>`;

  const medals = ['🥇', '🥈', '🥉'];

  /** Години з хвилин — «1240 хв» нікому ні про що не говорить. */
  const hrs = (min) => (min >= 60
    ? t(lang, 'games.hours', { n: Math.round(min / 6) / 10 })
    : t(lang, 'games.minutes', { n: Math.round(min) }));

  const card = (r, i) => {
    const place = i + 1;
    const top = place <= 3;
    const accent = r.accent || '#6b7cff';
    const frame = r.frame || accent;

    // Стиль вікон учасника діє на його ж картку: радіус, товщина рамки,
    // колір межі й тінь — тим самим набором, що й у нього в профілі.
    const c = r.card ?? {};
    const skin = [
      `--c:${esc(accent)}`,
      `--f:${esc(frame)}`,
      c.radius != null ? `--tp-r:${Number(c.radius)}px` : '',
      c.width != null ? `--tp-w:${Number(c.width)}px` : '',
      c.line ? `--tp-l:${esc(c.line)}` : '',
      c.shadow ? `--tp-s:${esc(c.shadow)}` : '',
      // колір самої картки — без нього стиль вікон майже не читався
      c.bg ? `--tp-bg:${esc(c.bg)}` : '',
      c.blur != null ? `--tp-bl:${Number(c.blur)}px` : '',
      `animation-delay:${Math.min(i * 0.035, 0.6)}s`,
    ].filter(Boolean).join(';');

    // тло: банер, а без нього — обраний фон сторінки
    const bg = r.banner
      ? ` style="background-image:url(${esc(r.banner)})"`
      : (r.bgCss ? ` style="background:${esc(r.bgCss)}"` : '');

    const stat = (icon, value, label) => `<span class="tp-stat" title="${esc(label)}">
      <i>${icon}</i><b>${esc(value)}</b><em>${esc(label)}</em></span>`;

    // Картка повторює верх профілю: смуга банера, під нею аватар із ніком.
    // Раніше банер був ледь помітним тлом під майже непрозорою накладкою —
    // тобто його фактично не було видно взагалі.
    return `<a class="tp${top ? ` tp-top tp-${place}` : ''}" href="/u/${esc(r.user_id)}" style="${skin}">
      <span class="tp-head">
        <span class="tp-bg"${bg}></span>
        <span class="tp-place">${top ? medals[i] : `#${place}`}</span>
      </span>
      <span class="tp-body">
        <img class="tp-face" src="${esc(avatarUrl(r.user_id, r.avatar, top ? 128 : 64))}"
          alt="" loading="lazy">
        <span class="tp-id">
          <span class="tp-nrow">
            <b>${esc(r.username ?? r.user_id)}</b>
            ${r.reward ? `<span class="tp-reward" title="${esc(t(lang, 'top.daily'))}">
              +${r.reward} ✨</span>` : ''}
          </span>
          <span class="tp-meta">
            ${r.roleName
    ? `<span class="tp-role" style="--r:${esc(r.roleColor || accent)}">
                <i></i>${esc(r.roleName)}</span>`
    : ''}
            <i class="tp-lvl">◆ ${Number(r.level) || 1} ${esc(t(lang, 'lvl.short'))}</i>
          </span>
          ${top && r.about ? `<em>${esc(r.about)}</em>` : ''}
        </span>
        <span class="tp-score">
          <b>${r.ai_score}</b>
          <span>${esc(t(lang, 'top.score'))}</span>
        </span>
      </span>
      <span class="tp-stats">
        ${stat('✉', fmt(r.messages ?? 0), t(lang, 'profile.messages'))}
        ${stat('🎧', hrs(r.voice ?? 0), t(lang, 'profile.voice'))}
        ${stat('◷', fmt(r.days ?? 0), t(lang, 'top.days'))}
        ${r.votes ? stat('✨', fmt(r.votes), t(lang, 'top.votes')) : ''}
      </span>
    </a>`;
  };

  // Голосування — окремим спливаючим вікном, а не смугою на сторінці:
  // так воно не тисне рейтинг і його видно одразу, коли заходиш.
  const face = (p) => `<button class="vs-one" data-user="${esc(p.userId)}">
    <img src="${esc(avatarUrl(p.userId, null, 96))}" alt="" loading="lazy">
    <b>${esc(p.username)}</b>
  </button>`;

  const vsBox = (duel && duel.canVote && (duel.people ?? []).length)
    ? `<div class="vsback" id="vs" hidden><div class="vswin">
        <button class="gate-x vs-x" aria-label="×">×</button>
        <div class="vs-row">${duel.people.map(face).join('')}</div>
      </div></div>`
    : '';

  return `${vsBox}
  <div class="tpwrap">
    <div class="tp-podium">${rows.slice(0, 3).map(card).join('')}</div>
    ${rows.length > 3
    ? `<div class="tp-rest">${rows.slice(3).map((r, i) => card(r, i + 3)).join('')}</div>`
    : ''}
  </div>`;
}

export function profilePage(profile, {
  username, avatar, roleName, roleColor, rank, lang = 'uk',
  look = {}, mine = false, wardrobe = null, level = null, games = null,
}) {
  // Обраний акцент важить більше за колір ролі: це свідомий вибір людини.
  const accent = look.accent || roleColor || '#6b7cff';

  // Фон сторінки. Зорі й дим лишаються — просто лягають поверх обраного
  // кольору й трохи притлумлюються, щоб не забивати його.
  const bg = look.background;
  const bgCss = bg
    ? (bg.type === 'gradient'
      ? `linear-gradient(${bg.angle ?? 160}deg,${bg.from},${bg.to})`
      : bg.color)
    : null;
  const skin = bgCss
    ? `<style>.bg{background:${esc(bgCss)}}#fog{opacity:.34;mix-blend-mode:screen}
        #stars{opacity:.7}</style>`
    : '';

  // Висоту банера обирає власник сторінки — типово звичайна.
  const bannerH = ['cover', 'tall', 'flat'].includes(look.layout?.bannerH)
    ? look.layout.bannerH : 'cover';
  const banner = look.bannerUrl
    ? `<div class="pf-banner pf-b-${bannerH}"><img src="${esc(look.bannerUrl)}" alt=""></div>`
    : '';

  // Що людина вирішила сховати зі своєї сторінки.
  const hidden = look.layout?.hidden ?? {};

  /**
   * Вітрина ілюстрацій — як у Steam: кілька картинок, які людина сама
   * поставила на видноту. Беруться зі своїх залитих і куплених робіт.
   */
  /**
   * Вітрина ілюстрацій.
   *
   * Раніше це була сітка дрібних плиток — робота, заради якої людина платила,
   * зводилась до мініатюри. Тепер перша йде на все полотно сторінки, а решта
   * стоїть смугою під нею й перемикає велике зображення. Ілюстрацією може
   * бути картинка, гіфка або коротке відео — воно грає саме, без звуку.
   */
  const shots = look.showcase ?? [];
  const isVideo = (s) => String(s.mime ?? '').startsWith('video/');
  const bigOf = (s) => (isVideo(s)
    ? `<video class="pf-big-m" src="${esc(s.url)}" autoplay muted loop playsinline></video>`
    : `<img class="pf-big-m" src="${esc(s.url)}" alt="" loading="lazy">`);

  // Ні заголовка «Вітрина», ні підпису під ілюстрацією: сама картинка й є
  // вітриною, а зайві написи з лінією лише розбивали її на дві частини.
  const showcase = (!hidden.showcase && shots.length)
    ? `<div class="card pane rise pf-show pf-showbare">
        <div class="pf-stage" id="pf-stage" data-i="0">
          <div class="pf-big">${bigOf(shots[0])}</div>
          <a class="pf-bigopen" href="${esc(shots[0].url)}" target="_blank" rel="noopener"
            aria-label="${esc(t(lang, 'profile.openFull'))}">⤢</a>
        </div>
        ${shots.length > 1
    ? `<div class="pf-strip">
            ${shots.map((s, i) => `<button class="pf-th${i === 0 ? ' on' : ''}" data-i="${i}"
              data-url="${esc(s.url)}" data-video="${isVideo(s) ? '1' : ''}"
              data-title="${esc(s.title ?? '')}"
              style="${isVideo(s) ? '' : `background-image:url(${esc(s.url)})`}">
              ${isVideo(s) ? '<i>▶</i>' : ''}
            </button>`).join('')}
          </div>`
    : ''}
      </div>`
    : '';

  // Опис — базова персоналізація, доступна кожному власнику сторінки.
  const aboutText = String(look.about ?? '').trim();
  const about = (aboutText || mine)
    ? `<div class="card pane rise pf-aboutbox" id="pf-about">
        <div class="pane-h">${esc(t(lang, 'profile.about'))}
          ${mine ? `<button class="btn ghost sm" id="pf-edit"
            data-edit="${esc(t(lang, 'profile.edit'))}"
            data-save="${esc(t(lang, 'profile.save'))}">${esc(t(lang, 'profile.edit'))}</button>` : ''}
        </div>
        <div class="pf-text">${aboutText ? esc(aboutText) : `<span class="muted">—</span>`}</div>
        ${mine ? `<textarea class="pf-edit" maxlength="400"
          placeholder="${esc(t(lang, 'profile.aboutEdit'))}">${esc(aboutText)}</textarea>` : ''}
      </div>`
    : '';

  /** Один зразок у гардеробі: показує сам себе й позначається, коли вдягнений. */
  const swatch = (it) => {
    const on = {
      background: () => look.background?.id === it.id,
      accent: () => look.accent === it.value.color,
      frame: () => look.frame?.id === it.id,
      card: () => look.card?.id === it.id,
    }[it.kind]?.() ?? false;
    let style = '';
    if (it.kind === 'background' && it.value.type === 'solid') style = `background:${esc(it.value.color)}`;
    if (it.kind === 'background' && it.value.type === 'gradient') {
      style = `background:linear-gradient(${it.value.angle}deg,${esc(it.value.from)},${esc(it.value.to)})`;
    }
    if (it.kind === 'background' && it.value.type === 'motion') {
      style = `--a:${esc(it.value.from)};--b:${esc(it.value.to)}`;
    }
    if (it.kind === 'accent' || it.kind === 'frame') style = `--c:${esc(it.value.color)}`;
    if (it.kind === 'card') {
      // показуємо саме те, чим стилі різняться: округлість, товщину рамки й тінь
      style = `background:${esc(it.value.bg)};border-color:${esc(it.value.line)};`
        + `border-width:${it.value.width ?? 1}px;`
        + `border-radius:${it.value.radius ?? 18}px;`
        + `backdrop-filter:blur(${Math.min(it.value.blur ?? 8, 12)}px)`
        + (it.value.shadow ? `;box-shadow:${it.value.shadow}` : '');
    }
    const cls = ['pf-sw', it.kind, it.value.type === 'motion' ? 'mo' : '', on ? 'on' : '']
      .filter(Boolean).join(' ');
    // data-item2 несе всю річ — вікно передперегляду малює її, не ходячи на сервер
    const full = esc(JSON.stringify({ id: it.id, name: it.name, kind: it.kind, value: it.value }));
    return `<button class="${cls}" data-item="${esc(it.id)}" data-kind="${esc(it.kind)}"
      data-item2="${full}" title="${esc(it.name)}" style="${style}"><span>${esc(it.name)}</span></button>`;
  };

  // Гардероб живе в окремому вікні: на самій сторінці він займав пів екрана
  // й заважав дивитися профіль, заради якого сюди й заходять.
  //
  // Усередині вікна — вкладки. Раніше гардероб, заливка, блоки, вітрина,
  // область дії та скидання лежали одним довгим сувоєм: щоб змінити фон,
  // доводилось гортати повз усе інше. Тепер на екрані рівно один розділ.

  // Речі показуємо за призначенням, а не за набором, у якому їх куплено:
  // людина йде сюди з думкою «хочу інший фон», а не «що там було в наборі».
  const ownedItems = (wardrobe?.packs ?? []).flatMap((p) => p.items ?? []);
  const byKind = (kind) => ownedItems.filter((it) => it.kind === kind);

  const kindGroup = (kind) => {
    const list = byKind(kind);
    if (!list.length) return '';
    // «Зняти» стоїть у заголовку саме цієї групи — знімається те, на що дивишся
    const clearable = ['background', 'accent', 'frame', 'card'].includes(kind);
    return `<div class="pf-group">
      <div class="pf-gt">
        <span>${esc(t(lang, `profile.kind.${kind}`))}</span>
        ${clearable
    ? `<button class="btn ghost sm pf-clear" data-what="${kind}">${esc(t(lang, 'profile.take'))}</button>`
    : ''}
      </div>
      <div class="pf-sws">${list.map(swatch).join('')}</div>
    </div>`;
  };

  const looksPanel = ownedItems.length
    ? ['background', 'accent', 'frame', 'card'].map(kindGroup).join('')
    : `<div class="muted">${esc(t(lang, 'profile.noPacks'))}</div>`;

  // Свої картинки — розкладені за призначенням: фон, банер, ілюстрація.
  // Раніше вони лежали однією купою, і зрозуміти, що з чого стане банером,
  // а що піде у вітрину, було неможливо.
  //
  // Заливка сюди більше не входить: вона живе в магазині, бо саме туди
  // робота й потрапляє. Тут лишається чистий вибір із уже залитого.
  const allMine = [...(wardrobe?.assets ?? []), ...(wardrobe?.bought ?? [])];
  const picked = look.layout?.showcase ?? [];

  // Банер відкривається пʼятим рівнем — про це має бути сказано просто
  // в його ж групі, а не з'ясовуватись після невдалого кліку.
  const perkOf = (key) => (wardrobe?.levelPerks ?? []).find((p) => p.key === key) ?? null;
  const bannerPerk = perkOf('banner');
  const bannerLocked = !!bannerPerk && !bannerPerk.unlocked;

  const imageGroup = (spec) => {
    const list = allMine.filter((a) => a.kind === spec.kind);
    const isArt = spec.slot === null;
    const locked = spec.slot === 'banner' && bannerLocked;

    if (locked) {
      return `<div class="pf-group">
        <div class="pf-gt"><span>${esc(spec.name)}</span></div>
        <div class="hint">🔒 ${esc(t(lang, 'profile.needLevel', { n: bannerPerk.level }))}</div>
      </div>`;
    }
    if (!list.length) {
      return `<div class="pf-group">
        <div class="pf-gt"><span>${esc(spec.name)}</span></div>
        <div class="hint">${esc(t(lang, 'profile.kindEmpty'))}</div>
      </div>`;
    }
    return `<div class="pf-group">
      <div class="pf-gt"><span>${esc(spec.name)}</span>
        ${isArt ? `<span class="hint" style="text-transform:none;letter-spacing:0">${
    esc(t(lang, 'profile.artHint', { max: wardrobe?.showcaseMax ?? 6 }))}</span>` : ''}
      </div>
      <div class="pf-shots"${isArt ? ' id="pf-showpick"' : ''}>
        ${list.map((a) => {
    // фон і банер вдягаються, ілюстрація — потрапляє у вітрину
    const on = isArt
      ? picked.includes(a.id)
      : (look.background?.id === `asset:${a.id}` || look.banner === `asset:${a.id}`);
    const attrs = isArt
      ? `data-show="${a.id}"`
      : `data-asset="${a.id}" data-slot="${esc(spec.slot)}"`;
    return `<button class="pf-shot${on ? ' on' : ''}" ${attrs}
          style="background-image:url(${esc(a.url)})"></button>`;
  }).join('')}
      </div>
    </div>`;
  };

  const KINDS = wardrobe?.kinds ?? [];
  const imagesPanel = `
    <div class="hint" style="margin-bottom:4px">${esc(t(lang, 'profile.imagesHint'))}</div>
    ${allMine.length
    ? KINDS.map(imageGroup).join('')
    : `<div class="muted">${esc(t(lang, 'profile.noImages'))}</div>`}
    <div class="pf-up" style="margin-top:14px">
      ${wardrobe?.canUpload
    ? `<a class="btn sm" href="/shop#upload">＋ ${esc(t(lang, 'shop.upload'))}</a>`
    : `<span class="hint">🔒 ${esc(t(lang, 'profile.ownLocked'))}</span>`}
    </div>`;

  // Порядок блоків: людина сама вирішує, що йде першим на її сторінці.
  const ORDER_KEYS = ['about', 'showcase', 'chart'];
  const savedOrder = Array.isArray(look.layout?.order) ? look.layout.order : [];
  const order = [...savedOrder.filter((k) => ORDER_KEYS.includes(k)),
    ...ORDER_KEYS.filter((k) => !savedOrder.includes(k))];

  const pagePanel = `
    <div class="pf-group">
      <div class="pf-gt"><span>${esc(t(lang, 'profile.blocks'))}</span></div>
      <div class="hint" style="margin-bottom:9px">${esc(t(lang, 'profile.blocksHint'))}</div>
      <div class="pf-up">
        ${['chart', 'showcase', 'about'].map((b) => {
    const on = !hidden[b];
    return `<button class="btn ghost sm pick-el pf-block${on ? ' on' : ''}" data-block="${b}">
          ${esc(t(lang, `profile.block.${b}`))}</button>`;
  }).join('')}
      </div>
    </div>

    <div class="pf-group">
      <div class="pf-gt"><span>${esc(t(lang, 'profile.order'))}</span></div>
      <div class="hint" style="margin-bottom:9px">${esc(t(lang, 'profile.orderHint'))}</div>
      <div class="pf-order" id="pf-order">
        ${order.map((k, i) => `<div class="pf-orow" data-block="${k}">
          <span class="pf-onum">${i + 1}</span>
          <span class="pf-oname">${esc(t(lang, `profile.block.${k}`))}</span>
          <button class="act pf-oup" type="button" aria-label="↑"${i === 0 ? ' disabled' : ''}>↑</button>
          <button class="act pf-odown" type="button" aria-label="↓"${i === order.length - 1 ? ' disabled' : ''}>↓</button>
        </div>`).join('')}
      </div>
    </div>

    <div class="pf-group">
      <div class="pf-gt"><span>${esc(t(lang, 'profile.banner'))}</span></div>
      <div class="hint" style="margin-bottom:9px">${esc(t(lang, 'profile.bannerHint'))}</div>
      <div class="pf-up">
        ${['cover', 'tall', 'flat'].map((h) => {
    const on = (look.layout?.bannerH ?? 'cover') === h;
    return `<button class="btn ghost sm pick-el pf-bh${on ? ' on' : ''}" data-h="${h}">
          ${esc(t(lang, `profile.bannerH.${h}`))}</button>`;
  }).join('')}
      </div>
    </div>

    <div class="pf-group">
      <div class="pf-gt"><span>${esc(t(lang, 'profile.showcase'))}</span></div>
      <div class="hint">${esc(t(lang, 'profile.showcaseWhere'))}</div>
    </div>`;

  const settingsPanel = `
    <div class="pf-group">
      <div class="pf-gt"><span>${esc(t(lang, 'profile.scope'))}</span></div>
      <div class="hint" style="margin-bottom:9px">${esc(t(lang, 'profile.scopeHint'))}</div>
      <div class="pf-up">
        ${['background', 'accent', 'card'].map((part) => {
    const on = look.scope?.[part] !== false;
    return `<button class="btn ghost sm pick-el pf-scope${on ? ' on' : ''}" data-part="${part}">
          ${esc(t(lang, `profile.scope.${part}`))}</button>`;
  }).join('')}
      </div>
    </div>

    <div class="pf-group">
      <div class="pf-gt"><span>${esc(t(lang, 'profile.reset'))}</span></div>
      <div class="hint" style="margin-bottom:9px">${esc(t(lang, 'profile.resetAllHint'))}</div>
      <div class="pf-up">
        ${['background', 'accent', 'frame', 'card', 'banner'].map((w) =>
    `<button class="btn ghost sm pf-clear" data-what="${w}">${esc(t(lang, `profile.clear.${w}`))}</button>`).join('')}
        <button class="btn ghost sm pf-clearall" id="pf-clearall">${esc(t(lang, 'profile.resetAll'))}</button>
      </div>
    </div>`;

  // Емодзі обовʼязково з селектором U+FE0F. Без нього 🖼 і ⚙ мають текстове
  // подання за замовчуванням: браузер бере їх зі шрифту тексту й малює
  // порожньою рамкою або блідим значком — саме це й було видно на вкладках.
  const TABS = [
    ['look', '🎨', t(lang, 'profile.tab.look'), ownedItems.length],
    ['images', '🖼️', t(lang, 'profile.tab.images'), allMine.length],
    ['page', '🧩', t(lang, 'profile.tab.page'), null],
    ['settings', '⚙️', t(lang, 'profile.tab.settings'), null],
  ];

  const wardrobeBox = mine && wardrobe
    ? `<div class="pf-lookback" id="look" hidden><div class="pf-lookwin">
        <!-- Тексти повідомлень тримаємо тут: скрипт спільний для обох мов -->
        <span id="pf-txt" hidden
          data-worn="${esc(t(lang, 'profile.worn', { name: '{name}' }))}"
          data-removed="${esc(t(lang, 'profile.removed', { name: '{name}' }))}"
          data-reset="${esc(t(lang, 'profile.resetDone'))}"
          data-showcase="${esc(t(lang, 'profile.savedShowcase'))}"
          data-lvl-done="${esc(t(lang, 'lvl.done', { n: '{n}' }))}"
          data-lvl-unlocked="${esc(t(lang, 'lvl.unlocked', { name: '{name}' }))}"
          data-order-saved="${esc(t(lang, 'profile.savedLayout'))}"></span>
        <div class="pane-h">${esc(t(lang, 'profile.look'))}
          <span class="pf-lookh">
            <a class="btn ghost sm" href="/shop">✨ ${esc(t(lang, 'nav.shop'))}</a>
            <button class="gate-x pf-lookx" aria-label="×">×</button>
          </span>
        </div>

        <div class="pf-tabs" role="tablist">
          ${TABS.map(([id, icon, label, n], i) => `<button class="pf-tab${i === 0 ? ' on' : ''}"
            data-tab="${id}" role="tab" aria-selected="${i === 0}">
            <span aria-hidden="true">${icon}</span>${esc(label)}
            ${n ? `<span class="pf-tn">${n}</span>` : ''}
          </button>`).join('')}
        </div>

        <div class="pf-scroll">
          <div class="pf-panel" data-panel="look">${looksPanel}</div>
          <div class="pf-panel" data-panel="images" hidden>${imagesPanel}</div>
          <div class="pf-panel" data-panel="page" hidden>${pagePanel}</div>
          <div class="pf-panel" data-panel="settings" hidden>${settingsPanel}</div>
        </div>
      </div></div>`
    : '';
  // Розклад по категоріях більше не показуємо: назовні йде саме загальне
  // число, а як воно рухалося — видно з графіка нижче.

  const tiles = [
    [fmt(profile.totalMessages), t(lang, 'profile.messages')],
    [fmt(profile.messages30d), t(lang, 'profile.msg30')],
    [`${Math.round(profile.voiceMinutes / 60)} ${lang === 'en' ? 'h' : 'год'}`, t(lang, 'profile.voice')],
    [fmt(profile.activeDays), t(lang, 'profile.activeDays')],
  ].map(([b, s], i) => `<div class="tile" style="animation-delay:${(0.1 + i * 0.06).toFixed(2)}s"><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join('');

  return `${skin}
  <div class="card rise pf-head${banner ? ' withbanner' : ''}">
    ${banner}
    <div class="row">
      <img class="avatar" src="${esc(avatar)}" alt="" style="border-color:${esc(accent)}">
      <div class="pf-id">
        <div class="pf-nrow">
          <div class="name">${esc(username)}</div>
          ${mine && wardrobe
    ? `<button class="btn ghost sm pf-lookopen" id="pf-lookopen"
              title="${esc(t(lang, 'profile.look'))}">🎨 ${esc(t(lang, 'profile.look'))}</button>`
    : ''}
        </div>
        <!-- Роль у ВЛАСНОМУ кольорі, а не в кольорі акценту: саме так її
             видно в списку учасників Discord, і профіль має збігатися. -->
        ${roleName
    ? `<span class="tp-role pf-role" style="--r:${esc(roleColor || accent)}">
        <i></i>${esc(roleName)}</span>`
    : ''}
        <div class="muted" style="margin-top:5px">${esc(t(lang, 'profile.days', { days: profile.daysOnServer }))}${rank ? ` · #${rank}` : ''}</div>
      </div>
      <div class="score">
        <b>${profile.aiScore}</b>
        <span>${esc(t(lang, 'profile.rating'))}</span>
        ${Number.isFinite(look.balance)
    ? `<div class="fpchip" title="✨FP"><i>✨</i>${fmt(look.balance)}</div>`
    : ''}
      </div>
    </div>
    ${levelBar(level, { lang, mine })}
    <div class="row" hidden>
    </div>
    <div class="tiles">${tiles}</div>
  </div>
  ${order.map((k) => ({
    about,
    showcase,
    chart: hidden.chart ? '' : scoreChart(profile, { lang, accent }),
  }[k] ?? '')).join('\n  ')}
  ${gamesBox(games, lang)}
  ${wardrobeBox}`;
}

/**
 * Ігри учасника.
 *
 * Discord не зберігає «наіграних годин» — у його API такого просто немає,
 * видно лише те, у що людина грає зараз. Тому години рахує сам бот, а отже
 * статистика починається з дня, коли стеження увімкнули. Якщо воно вимкнене
 * (games === null), блока немає взагалі — краще нічого, ніж порожня рамка.
 */
function gamesBox(games, lang = 'uk') {
  if (!games || !games.length) return '';
  const max = Math.max(...games.map((g) => g.minutes), 1);

  return `<div class="card pane rise gmbox">
    <div class="pane-h">${esc(t(lang, 'games.title'))}</div>
    <div class="gmlist">
      ${games.map((g, i) => `<div class="gmrow${g.now ? ' now' : ''}"
          style="animation-delay:${(i * 0.05).toFixed(2)}s">
        <span class="gmname">${g.now ? '<i class="gmdot"></i>' : ''}${esc(g.game)}</span>
        <span class="gmbar"><i style="width:${Math.max(4, Math.round((g.minutes / max) * 100))}%"></i></span>
        <span class="gmh">${g.hours >= 1
    ? esc(t(lang, 'games.hours', { n: g.hours }))
    : esc(t(lang, 'games.minutes', { n: Math.round(g.minutes) }))}</span>
      </div>`).join('')}
    </div>
    <div class="hint" style="margin-top:10px">${esc(t(lang, 'games.since'))}</div>
  </div>`;
}

/**
 * Смуга рівня. Рівень не дається за активність — його купують за ✨FP,
 * і кожен наступний коштує вдвічі більше. Тому поруч завжди видно ціну
 * наступного й наскільки до нього вистачає грошей.
 */
function levelBar(level, { lang = 'uk', mine = false } = {}) {
  if (!level) return '';
  const cur = Math.max(1, Number(level.level) || 1);
  const next = Number(level.next) || 1;
  const bal = Number(level.balance) || 0;
  const ready = mine && bal >= next;
  // скільки зібрано на наступний рівень
  const pct = Math.max(0, Math.min(100, Math.round((bal / next) * 100)));

  return `<div class="lvbar">
    <div class="lvchip" title="${esc(t(lang, 'lvl.title'))}">
      <i>◆</i><b>${cur}</b><span>${esc(t(lang, 'lvl.short'))}</span>
    </div>
    ${mine
    ? `<div class="lvgrow">
        <div class="lvtrack"><i style="width:${pct}%"></i></div>
        <div class="lvnote">${esc(t(lang, 'lvl.next', { n: cur + 1, cost: next }))}</div>
      </div>
      <button class="btn sm lvup" id="pf-levelup" ${ready ? '' : 'disabled'}
        data-cost="${next}">${esc(t(lang, 'lvl.up', { cost: next }))}</button>`
    : ''}
  </div>`;
}

/**
 * Графік загальної репутації.
 *
 * Малюємо самі, без бібліотек: площа під лінією, сама лінія, крапка на
 * останньому значенні й підказки при наведенні. Шкала не від нуля, а по
 * фактичному діапазону з запасом — інакше рух у 30–40 балів виглядав би
 * рівною лінією й графік не мав би сенсу.
 */
function scoreChart(profile, { lang = 'uk', accent = '#6b7cff' } = {}) {
  const pts = (profile.scoreHistory ?? []).filter((n) => Number.isFinite(n));
  const dW = profile.scoreDeltaWeek ?? 0;
  const dM = profile.scoreDeltaMonth ?? 0;

  const deltaChip = (v, label) => {
    const cls = v > 0 ? 'up' : (v < 0 ? 'down' : '');
    const sign = v > 0 ? '+' : '';
    return `<span class="dchip ${cls}"><b>${sign}${Math.round(v)}</b>${esc(label)}</span>`;
  };
  const head = `<div class="pane-h">${esc(t(lang, 'profile.trend'))}
    <span class="dchips">${deltaChip(dW, t(lang, 'profile.week'))}${deltaChip(dM, t(lang, 'profile.month'))}</span>
  </div>`;

  // Менше двох точок — малювати нічого; чесно кажемо, що дані ще збираються.
  if (pts.length < 2) {
    return `<div class="card pane rise chartbox">${head}
      <div class="muted chart-empty">${esc(t(lang, 'profile.trendSoon'))}</div>
    </div>`;
  }

  const W = 760;
  const H = 240;
  const L = 44;          // місце під підписи значень ліворуч
  const R = 16;
  const TOP = 16;
  const BOT = 30;        // місце під дати знизу

  const min = Math.min(...pts);
  const max = Math.max(...pts);
  // запас, щоб лінія не липла до країв; для рівних значень — видима смуга
  const span = Math.max(30, (max - min) * 1.35);
  const mid = (max + min) / 2;
  const lo = Math.max(0, Math.round(mid - span / 2));
  const hi = Math.min(1000, Math.round(mid + span / 2));

  const x = (i) => L + (W - L - R) * (pts.length === 1 ? 0.5 : i / (pts.length - 1));
  const y = (v) => TOP + (H - TOP - BOT) * (1 - (v - lo) / (hi - lo || 1));

  /**
   * Плавна лінія: між точками ведемо криву, а не ламану. Контрольні точки
   * зміщені лише по горизонталі — так крива не «вилітає» за межі значень.
   */
  const curve = pts.map((v, i) => {
    if (!i) return `M${x(0).toFixed(1)} ${y(v).toFixed(1)}`;
    const x0 = x(i - 1);
    const x1 = x(i);
    const cx = (x0 + x1) / 2;
    return `C${cx.toFixed(1)} ${y(pts[i - 1]).toFixed(1)} ${cx.toFixed(1)} ${y(v).toFixed(1)} ${x1.toFixed(1)} ${y(v).toFixed(1)}`;
  }).join(' ');
  const base = H - BOT;
  const area = `${curve} L${x(pts.length - 1).toFixed(1)} ${base} L${x(0).toFixed(1)} ${base} Z`;
  const last = pts.at(-1);

  // сітка з чотирьох ліній і підписами значень — без неї графік читається погано
  const steps = 4;
  const grid = Array.from({ length: steps + 1 }, (_, k) => {
    const v = Math.round(lo + (hi - lo) * (k / steps));
    const gy = y(v);
    return `<line class="chgrid" x1="${L}" y1="${gy.toFixed(1)}" x2="${W - R}" y2="${gy.toFixed(1)}"></line>
      <text class="chlabel" x="${L - 10}" y="${(gy + 4).toFixed(1)}" text-anchor="end">${v}</text>`;
  }).join('');

  // дати знизу: перша, середня й остання — більше не влізе й не треба
  const dayLabel = (i) => {
    const daysAgo = pts.length - 1 - i;
    if (daysAgo === 0) return t(lang, 'profile.today');
    return `−${daysAgo} ${t(lang, 'profile.daysShort')}`;
  };
  const marks = [...new Set([0, Math.floor((pts.length - 1) / 2), pts.length - 1])];
  const dates = marks.map((i) => `<text class="chlabel" x="${x(i).toFixed(1)}" y="${H - 8}"
    text-anchor="${i === 0 ? 'start' : (i === pts.length - 1 ? 'end' : 'middle')}">${esc(dayLabel(i))}</text>`).join('');

  // точки видно, коли їх небагато — так одразу зрозуміло, скільки замірів
  const dots = pts.length <= 20
    ? pts.map((v, i) => `<circle class="chpt" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3"
        fill="${esc(accent)}"></circle>`).join('')
    : '';

  // невидимі смужки для підказок: наводиш будь-де — бачиш значення
  const hovers = pts.map((v, i) => {
    const w = (W - L - R) / pts.length;
    return `<g class="hp"><rect x="${(L + w * i).toFixed(1)}" y="${TOP}" width="${w.toFixed(1)}"
        height="${(H - TOP - BOT).toFixed(1)}" fill="transparent"></rect>
      <line class="chhair" x1="${x(i).toFixed(1)}" y1="${TOP}" x2="${x(i).toFixed(1)}" y2="${base}"></line>
      <circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="5"></circle>
      <title>${v} · ${esc(dayLabel(i))}</title></g>`;
  }).join('');

  return `<div class="card pane rise chartbox">${head}
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img"
      aria-label="${esc(t(lang, 'profile.trend'))}">
      <defs>
        <linearGradient id="chg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${esc(accent)}" stop-opacity=".38"/>
          <stop offset="100%" stop-color="${esc(accent)}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${grid}
      <path class="charea" d="${area}" fill="url(#chg)"></path>
      <path class="chline" d="${curve}" fill="none" stroke="${esc(accent)}"></path>
      ${dots}
      <circle class="chdot" cx="${x(pts.length - 1).toFixed(1)}" cy="${y(last).toFixed(1)}" r="5.5"
        fill="${esc(accent)}"></circle>
      ${dates}
      ${hovers}
    </svg>
    <div class="chfoot">
      <span class="hint">${pts.length} ${esc(t(lang, 'profile.points'))}</span>
      <span class="hint">${esc(t(lang, 'profile.now'))}: <b>${last}</b></span>
    </div>
  </div>`;
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
  // Галерея прив'язана до Discord-каналу, але писати про це на сторінці
  // не варто: людина й так бачить результат, а пояснення лише займало місце.

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
    <div class="card pane">${upload}</div>
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

  // Усі плитки однакові: прев'ю 16:9 і стала за висотою підпис-панель.
  // Порожній підпис не «з'їдає» рядок — місце під нього лишається,
  // інакше сусідні картки виходили б різної висоти.
  const cards = items.map((it, i) => `<article class="item" data-item="${it.id}"
        style="animation-delay:${Math.min(i * 0.03, 0.5)}s">
      <div class="shot">
        ${mediaTag(it)}
        ${adminActs(it, { admin, session, lang })}
        <span class="badge">${it.kind === 'video' ? '▶' : (it.mime === 'image/gif' ? 'GIF' : '❖')}</span>
      </div>
      <div class="meta">
        <div class="cap">${it.title ? esc(it.title) : ''}</div>
        ${author(it, avatars)}
        <div class="when">${esc(timeAgo(it.created_at, lang))}</div>
        ${likeBtn(it, liked)}
      </div>
    </article>`).join('');

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
    // субтитри окремими файлами, якщо джерело їх віддало
    subtitles: state.subtitles ?? [],
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
      <div class="room-r">
        ${channel ? `<div class="vc"><span class="dotlive"></span>${esc(channel.name)}</div>` : ''}
        <button class="btn icon" id="cin-settings"
          title="${esc(t(lang, 'cin.settings'))}" aria-label="${esc(t(lang, 'cin.settings'))}">⚙️</button>
      </div>
    </div>

    <div class="stagewrap">
    <!-- Полотно живого світла: сюди щосекунди лягає зменшений кадр,
         розмитий до кольорових плям. Порожнє й невидиме, поки нема що показувати. -->
    <canvas class="ambient" id="cin-ambient" width="32" height="18" aria-hidden="true"></canvas>
    <canvas class="ambient next" id="cin-ambient2" width="32" height="18" aria-hidden="true"></canvas>
    <div class="curtain" id="cin-curtain" hidden>
      <div class="curtain-i">⏸</div>
      <div class="curtain-t">${esc(t(lang, 'cin.paused'))}</div>
      <div class="curtain-h" id="cin-curtain-h"></div>
    </div>
    <div class="screen${source ? '' : ' idle'}" id="cin-stage" data-cfg="${cfg}"
      data-ok-text="${esc(t(lang, 'cin.controllable'))}"
      data-resume="${esc(t(lang, 'cin.resumeAt'))}"
      data-auto-text="${esc(t(lang, 'cin.autoQuality'))}"
      data-subs-off="${esc(t(lang, 'cin.subsOff'))}"
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

      <!-- Субтитри: список наповнюється, щойно плеєр розбере доріжки -->
      <details class="qual" id="cin-subs" hidden>
        <summary title="${esc(t(lang, 'cin.subs'))}">💬 <b id="cin-slabel">${esc(t(lang, 'cin.subsOff'))}</b></summary>
        <div class="qmenu"></div>
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

  // Службове (джерело, зал, права, історія) живе в шухляді збоку —
  // на самій сторінці лишається екран, черга й глядачі.
  const drawer = `<aside class="cdrawer" id="cin-drawer" hidden>
    <div class="cdrawer-h">
      <b>${esc(t(lang, 'cin.settings'))}</b>
      <button class="gate-x" id="cin-drawer-x" aria-label="×">×</button>
    </div>
    <div class="cdrawer-b">${addBox}${editorsBox}${lockBox}${historyBox}</div>
  </aside>
  <div class="cdrawer-back" id="cin-drawer-back" hidden></div>`;

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

  // Екран головний, під ним — черга й зал; решта ховається в шухляду.
  return `<div class="clayout">
    ${room}
    <div class="cpanels">${queueBox}${people}</div>
  </div>${drawer}${modal}`;
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

/**
 * Магазин косметики.
 *
 * Каталог розбитий по наборах; кожна річ — картка з живим прев'ю самого
 * оформлення, а не з іконкою. Бустерські набори видно всім (щоб було видно,
 * заради чого бустити), але кнопка в них замкнена.
 */
export function shopPage({
  items = [], categories = [], market = [], authors = {}, mine = [],
  owned = [], booster = false, admin = false, kinds = [],
  balance = 0, lang = 'uk', uploads = {}, uploadLimit = 3,
}) {
  const has = new Set(owned);

  /** Прев'ю самої речі: колір є колір, набір — кілька зразків, робота — картинка. */
  const swatchOne = (it) => {
    const v = it.value ?? {};
    if (it.kind === 'background' && v.type === 'solid') return `<i style="background:${esc(v.color)}"></i>`;
    if (it.kind === 'background' && v.type === 'gradient') {
      return `<i style="background:linear-gradient(${v.angle}deg,${esc(v.from)},${esc(v.to)})"></i>`;
    }
    if (it.kind === 'background' && v.type === 'motion') {
      return `<i class="mo" style="--a:${esc(v.from)};--b:${esc(v.to)}"></i>`;
    }
    if (v.type === 'image') return `<i class="im" style="background-image:url(${esc(v.url)})"></i>`;
    if (it.kind === 'accent') return `<i class="ac" style="--c:${esc(v.color)}"></i>`;
    if (it.kind === 'card') {
      return `<i class="cd" style="background:${esc(v.bg)};border-color:${esc(v.line)};`
        + `border-width:${v.width ?? 1}px;border-radius:${Math.min(v.radius ?? 8, 14)}px`
        + `${v.shadow ? `;box-shadow:${v.shadow}` : ''}"></i>`;
    }
    return `<i class="fr" style="--c:${esc(v.color)}"></i>`;
  };
  /**
   * Саме прев'ю і є кнопкою перегляду: окрема «Подивитись» лише забирала
   * місце й дублювала те, на що людина й так дивиться. Тому показуємо
   * більше зразків і робимо смугу клікабельною.
   */
  const preview = (entry) => {
    const all = entry.pack ? entry.items : [entry];
    const shown = all.slice(0, 6);
    const rest = all.length - shown.length;
    return `<button class="sh-prev" type="button" title="${esc(t(lang, 'shop.preview'))}"
      aria-label="${esc(t(lang, 'shop.preview'))}">
      ${shown.map(swatchOne).join('')}
      ${rest > 0 ? `<i class="sh-more">+${rest}</i>` : ''}
      <span class="sh-zoom">${esc(t(lang, 'shop.preview'))}</span>
    </button>`;
  };

  const card = (entry, i) => {
    const owns = has.has(entry.id);
    const locked = entry.booster && !booster;
    // Робота учасника впізнається за автором, а не за категорією: тепер вона
    // лежить у звичайному розділі поряд із каталожними речами.
    const isMarket = !!entry.author;

    const action = locked
      ? `<button class="btn ghost sm" disabled>🔒 ${esc(t(lang, 'shop.boosterOnly'))}</button>`
      : owns
        ? `<a class="btn ghost sm" href="/me#look">${esc(t(lang, 'shop.inProfile'))}</a>`
        : `<button class="btn sm sh-buy" data-item="${esc(entry.id)}">
            ${entry.price ? `${entry.price} ✨` : esc(t(lang, 'shop.take'))}</button>`;

    // хто це виклав — видно одразу, це ж чужа робота
    const by = isMarket
      ? `<div class="sh-by">${esc(t(lang, 'shop.by'))} <b>${esc(authors[entry.author] ?? entry.author)}</b>${
        entry.sales ? ` · ${entry.sales} ${esc(t(lang, 'shop.sold'))}` : ''}</div>`
      : '';

    const payload = esc(JSON.stringify(entry.pack
      ? entry.items.map((it) => ({ id: it.id, name: it.name, kind: it.kind, value: it.value }))
      : [{ id: entry.id, name: entry.name, kind: entry.kind, value: entry.value }]));

    const count = entry.pack ? (entry.items?.length ?? 0) : 0;

    // Позначки стоять у рядку з назвою, а не плитою поверх прев'ю: накладені
    // плашки різались об край картки й затуляли самі зразки, заради яких
    // сюди й дивляться. Перегляд теж переїхав у ряд дій — його стало видно
    // одразу, а не лише під курсором.
    const chips = [
      owns ? `<span class="sh-chip good">✓ ${esc(t(lang, 'shop.owned'))}</span>` : '',
      count > 1 ? `<span class="sh-chip">${esc(t(lang, 'shop.variants', { n: count }))}</span>` : '',
      entry.booster ? `<span class="sh-chip boost" title="${esc(t(lang, 'shop.boosterOnly'))}">🚀 ${esc(t(lang, 'shop.boosterOnly'))}</span>` : '',
    ].filter(Boolean).join('');

    return `<article class="sh-card${locked ? ' locked' : ''}${owns ? ' mine' : ''}"
        data-id="${esc(entry.id)}" data-items="${payload}"
        style="animation-delay:${Math.min(i * 0.04, 0.35)}s">
      ${preview(entry)}
      <div class="sh-b">
        <div>
          <div class="sh-n">${esc(entry.name)}</div>
          ${chips ? `<div class="sh-chips">${chips}</div>` : ''}
          ${entry.hint ? `<div class="hint">${esc(entry.hint)}</div>` : ''}
          ${by}
        </div>
        <div class="sh-p">${entry.price ? `${entry.price} ✨FP` : esc(t(lang, 'shop.free'))}</div>
      </div>
      <div class="sh-a">${action}</div>
    </article>`;
  };

  /**
   * Рядок керування власною роботою: опис, ціна, буст, вітрина, видалення.
   * Той самий рядок бачить адміністратор для чужих робіт — інакше правити
   * чуже було б нічим, бо каталожні ціни живуть у власному вікні.
   */
  const myRow = (a, alien = false) => `<div class="sh-my${a.listed ? ' listed' : ''}"
      data-asset="${a.id}">
    <span class="sh-myimg" style="background-image:url(${esc(a.url)})"></span>
    <input class="sh-mytitle" type="text" maxlength="60" value="${esc(a.title ?? '')}"
      placeholder="${esc(t(lang, 'shop.workTitle'))}">
    <input class="sh-myprice" type="number" min="1" max="99999" value="${a.price || ''}"
      placeholder="${esc(t(lang, 'shop.price'))}" aria-label="${esc(t(lang, 'shop.price'))}">
    <button class="btn ghost sm sh-myboost${a.booster ? ' on' : ''}" data-asset="${a.id}"
      title="${esc(t(lang, 'shop.boosterOnly'))}" type="button">🚀</button>
    <button class="btn ghost sm sh-list" data-asset="${a.id}" data-on="${a.listed ? '1' : '0'}"
      type="button">${a.listed ? esc(t(lang, 'shop.unlist')) : esc(t(lang, 'shop.list'))}</button>
    <button class="btn ghost sm sh-mydel" data-asset="${a.id}" type="button"
      data-confirm="${esc(t(lang, 'shop.delConfirm'))}"
      title="${esc(t(lang, 'shop.del'))}">🗑</button>
    ${alien ? `<span class="sh-myby">${esc(t(lang, 'shop.by'))} ${esc(authors[a.author] ?? a.author)}</span>` : ''}
  </div>`;

  // Розділи: категорія → каталог і роботи учасників разом. Раніше все залите
  // людьми звалювалось в окремий «Кастом», тож фон від учасника лежав не поряд
  // з іншими фонами, а десь унизу сторінки.
  const sections = categories.map((c) => {
    const spec = kinds.find((k) => k.category === c.id) ?? null;
    const list = [...items.filter((i) => i.category === c.id), ...market.filter((m) => m.category === c.id)];

    // Свої роботи саме цього призначення — тут-таки, з ціною й перемикачем вітрини.
    const ownList = spec ? mine.filter((a) => a.kind === spec.kind) : [];
    const own = ownList.length
      ? `<div class="sh-own">
          <div class="sh-gt">${esc(t(lang, 'shop.yourWorks'))}</div>
          <div class="sh-mine">
            ${ownList.map((a) => myRow(a)).join('')}
          </div>
        </div>`
      : '';

    // Заливка стоїть у заголовку саме того розділу, куди робота й потрапить.
    const upload = spec
      ? (booster
        ? `<button class="btn sm sh-upopen" data-kind="${esc(spec.kind)}" type="button">
            ＋ ${esc(t(lang, 'shop.upload'))}
            <span class="sh-left">${uploads[spec.kind] ?? uploadLimit}/${uploadLimit}</span>
          </button>`
        : `<button class="btn ghost sm" disabled>🔒 ${esc(t(lang, 'shop.boosterOnly'))}</button>`)
      : '';

    return `<section class="sh-sec" id="${esc(c.id)}">
      <div class="sh-h">
        <div>
          <h2>${esc(c.name)}</h2>
          <div class="hint">${esc(c.hint)}</div>
        </div>
        ${upload}
      </div>
      ${own}
      ${list.length
    ? `<div class="sh-grid">${list.map(card).join('')}</div>`
    : `<div class="muted">${esc(t(lang, 'shop.emptyCat'))}</div>`}
    </section>`;
  }).join('');

  // Ліворуч — категорії. Тепер це не «прокрутити до», а «показати лише це»:
  // раніше всі розділи лежали одним сувоєм і потрібний доводилось шукати очима.
  const total = items.length + market.length;
  const side = `<aside class="sh-side">
    <button class="sh-cat on" data-cat="all" type="button">
      <span class="sh-cn">${esc(t(lang, 'shop.all'))}</span>
      <span class="sh-cc">${total}</span>
    </button>
    ${categories.map((c) => `<button class="sh-cat" data-cat="${esc(c.id)}" type="button">
      <span class="sh-cn">${esc(c.name)}</span>
      <span class="sh-cc">${items.filter((x) => x.category === c.id).length
    + market.filter((x) => x.category === c.id).length}</span>
    </button>`).join('')}
    <button class="sh-cat" data-cat="mine" type="button">
      <span class="sh-cn">✓ ${esc(t(lang, 'shop.mineOnly'))}</span>
      <span class="sh-cc">${owned.length}</span>
    </button>
  </aside>`;

  // Ціни й позначки правляться в окремому вікні. У кожному рядку видно саму
  // річ, а не лише назву: інакше не зрозуміло, чому саме міняєш ціну.
  const priceRow = (p) => {
    const cat = categories.find((c) => c.id === p.category);
    const sample = p.pack ? p.items[0] : p;
    return `<div class="sh-prow" data-item="${esc(p.id)}">
      <span class="sh-pv">${swatchOne(sample)}</span>
      <span class="sh-pn">
        <b>${esc(p.name)}</b>
        <i>${esc(cat?.name ?? p.category)}${p.pack ? ` · ${p.items.length} ${esc(t(lang, 'shop.inPack'))}` : ''}</i>
      </span>
      <input type="number" min="0" max="99999" value="${p.price}"
        aria-label="${esc(t(lang, 'shop.price'))}">
      <span class="sh-pfp">✨</span>
      <button class="btn ghost sm sh-flag${p.booster ? ' on' : ''}" data-item="${esc(p.id)}"
        title="${esc(t(lang, 'shop.boosterOnly'))}">🚀</button>
    </div>`;
  };

  /**
   * Заливка своєї роботи. Живе тільки тут: раніше вона була захована у вікні
   * оформлення профілю, хоча її результат потрапляє саме в магазин — тож
   * доводилось ходити туди-сюди й вгадувати, куди воно дінеться.
   *
   * Спершу видно саму картинку, її призначення й ціну, і лише після
   * підтвердження щось списується.
   */
  const uploadWin = booster
    ? `<div class="pv-back" id="sh-upwin" hidden><div class="pv sh-upbox">
        <div class="pv-h"><b>${esc(t(lang, 'shop.upload'))}</b>
          <button class="gate-x sh-upx" aria-label="×">×</button></div>

        <div class="sh-upbody">
          <div class="sh-upkinds">
            ${kinds.map((k, i) => `<button class="btn ghost sm pick-el sh-upkind${i === 0 ? ' on' : ''}"
              data-kind="${esc(k.kind)}" type="button">${esc(k.name)}
              <span class="sh-left">${uploads[k.kind] ?? uploadLimit}/${uploadLimit}</span>
            </button>`).join('')}
          </div>
          <div class="hint sh-upwhere" id="sh-upwhere"></div>

          <label class="sh-updrop" id="sh-updrop">
            <span class="sh-upshot" id="sh-upshot"></span>
            <span class="sh-uppick">${esc(t(lang, 'profile.upPick'))}</span>
            <!-- перелік дозволеного міняється разом із призначенням:
                 для ілюстрації підходить і відео -->
            <input type="file" accept="image/*" id="sh-upfile" hidden>
          </label>

          <!-- Поля лишаються порожніми: підставлена ціна виглядає як уже
               прийняте рішення, і її легко не помітити перед списанням. -->
          <div class="sh-upfields">
            <input type="text" id="sh-uptitle" maxlength="60"
              placeholder="${esc(t(lang, 'profile.upNamePh'))}">
            <input type="number" id="sh-upprice" min="1" max="99999"
              placeholder="${esc(t(lang, 'profile.upPricePh'))}"
              aria-label="${esc(t(lang, 'shop.price'))}">
          </div>
          <label class="sh-upboost">
            <input type="checkbox" id="sh-upboost">
            <span>🚀 ${esc(t(lang, 'shop.onlyBoosters'))}</span>
          </label>
        </div>

        <div class="pv-f">
          <span class="hint" id="sh-uphint">${esc(t(lang, 'profile.upExplain'))}</span>
          <span class="sh-upacts">
            <button class="btn ghost sm sh-upx" type="button">${esc(t(lang, 'profile.upCancel'))}</button>
            <button class="btn sm" id="sh-upgo" type="button" disabled
              data-tpl="${esc(t(lang, 'profile.upConfirm', { n: '{n}' }))}"></button>
          </span>
        </div>
      </div></div>`
    : '';

  const priceWin = admin
    ? `<div class="pv-back" id="sh-prices" hidden><div class="pv sh-pricewin">
        <div class="pv-h"><b>${esc(t(lang, 'shop.prices'))}</b>
          <button class="gate-x sh-pricex" aria-label="×">×</button></div>
        <div class="sh-pricelist">
          ${categories.map((c) => {
    const list = items.filter((i) => i.category === c.id);
    if (!list.length) return '';
    return `<div class="sh-pgroup">
              <div class="sh-gt">${esc(c.name)}</div>
              ${list.map(priceRow).join('')}
            </div>`;
  }).join('')}

          <!-- Роботи учасників правляться тут-таки: у них своя ціна в базі,
               а не в конфізі гільдії, тож і рядок у них свій — зате поруч
               із рештою цін, а не в окремому місці. -->
          ${market.length
    ? `<div class="sh-pgroup">
              <div class="sh-gt">${esc(t(lang, 'shop.memberWorks'))}</div>
              <div class="sh-mine">
                ${market.map((m) => myRow({
      id: m.assetId, title: m.name, price: m.price, booster: m.booster,
      listed: true, url: m.value.url, author: m.author,
    }, true)).join('')}
              </div>
            </div>`
    : ''}
        </div>
        <div class="pv-f">
          <span class="hint">${esc(t(lang, 'shop.pricesHint'))}</span>
          <button class="btn sm sh-saveprices">${esc(t(lang, 'shop.savePrice'))}</button>
        </div>
      </div></div>`
    : '';

  return `<div class="shop" data-boost="🚀 ${esc(t(lang, 'shop.boosterOnly'))}">
    <div class="sh-wallet rise">
      <div class="sh-bal">
        <span class="sh-coin">✨</span>
        <b id="sh-balance">${fmt(balance)}</b>
        <span>FP</span>
      </div>
      ${admin ? `<button class="btn ghost sm sh-openprices" id="sh-openprices">⚙️ ${esc(t(lang, 'shop.prices'))}</button>` : ''}
    </div>
    <div class="sh-layout">
      ${side}
      <div class="sh-body">
        ${sections}
        <div class="muted" id="sh-empty" hidden>${esc(t(lang, 'shop.nothingHere'))}</div>
      </div>
    </div>
    ${uploadWin}
    ${priceWin}
  </div>`;
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
