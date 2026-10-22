/* revontuli · the $50. A button that offers fifty dollars; what follows is a claim form, an agreement with no end and a
   CAPTCHA drawn from a gas pixel detector — and then an error. Self-contained: it brings its own styles and dialogs, and wires
   up the button with id="get50" on whichever page loads it (after data.js and site.js).
   Nothing typed into the form leaves the browser; the "numbers on the back of the card" are wiped as soon as they're typed. */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const BASE = new URL('.', document.currentScript ? document.currentScript.src : location.href).href;   // where this file lives (the site root)

/* ---------- styles: the About page's two inks and its buttons (copied here, so the dialogs look the same on any page) ---------- */
const CSS = `
.f50 .act{display:inline-flex;align-items:center;justify-content:center;min-width:9.5em;font:inherit;font-family:var(--sc);font-weight:700;letter-spacing:.08em;font-size:13.5px;line-height:1.2;color:var(--ink);background:var(--peach);border:1px solid var(--ink);border-radius:2px;padding:5.4px 14.4px 6.3px;cursor:pointer;text-decoration:none;box-shadow:2px 2px 0 var(--ink)}
.f50 .act:hover{background:#EDCFB5;color:var(--ink)}
.f50 .act:active{transform:translate(1px,1px);box-shadow:1px 1px 0 var(--ink)}
.f50 .act:focus-visible{outline:2px solid var(--ink);outline-offset:2.7px}
dialog.err{border:0;padding:10.8px;width:min(504px,calc(100vw - 28.8px));background:var(--paper) var(--laid);border-radius:3px;box-shadow:0 27px 54px -18px rgba(20,20,40,.55),0 0 0 1px rgba(43,49,66,.35);color:var(--ink)}   /* the page's paper, as a mount for the picture */
dialog.err::backdrop{background:rgba(30,32,48,.35)}
.err-img{position:relative;aspect-ratio:16/9;background:#3b4150 url(${BASE}assets/images/wha.png) center/cover no-repeat;border-radius:1px;outline:1.5px solid var(--ink);overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;padding:16.2px 18px}
.err-msg{margin:0;max-width:17em;font-family:var(--serif);font-size:clamp(18px,3.2vw,24.3px);line-height:1.22;font-weight:600;color:var(--peach-3);text-shadow:0 2px 5.4px rgba(0,0,0,.6),0 0 2px rgba(0,0,0,.45)}   /* the pale peach of the page's second ink */
.err-t{margin:0 0 5.4px;font-family:var(--sc);font-size:11.7px;letter-spacing:.2em;color:var(--peach);opacity:.9;text-shadow:0 1px 2.7px rgba(0,0,0,.6)}
.err-b{align-self:flex-end;font-family:var(--sc);font-weight:700;letter-spacing:.08em;font-size:13.5px;line-height:1.2;color:var(--ink);background:var(--peach);border:1px solid var(--ink);border-radius:2px;padding:5.4px 14.4px 6.3px;cursor:pointer;box-shadow:2px 2px 0 var(--ink)}   /* the page's own button (.act) */
.err-b:hover{background:#EDCFB5}
.err-b:active{transform:translate(1px,1px);box-shadow:1px 1px 0 var(--ink)}
.err-b:focus-visible{outline:2px solid var(--peach-3);outline-offset:2.7px}
@media (max-width:576px){.err-img{aspect-ratio:auto;min-height:calc((100vw - 50px) * 9 / 16);gap:16px}.err-msg{font-size:17px}}   /* small screens: the picture grows to fit the message */
/* the $50 claim: an agreement with no end (generated as you read) */
dialog.tos{border:0;padding:0;width:min(640px,calc(100vw - 24px));max-height:calc(100vh - 32px);background:var(--paper) var(--laid);color:var(--ink);border-radius:3px;box-shadow:0 30px 60px -20px rgba(20,20,40,.6),0 0 0 1px rgba(43,49,66,.35);overflow:hidden}
dialog.tos[open]{display:flex;flex-direction:column}
dialog.tos::backdrop{background:rgba(30,32,48,.45)}
.tos-h{padding:18px 22px 10px;border-bottom:1.5px solid var(--ink)}
.tos-h h3{margin:0;font-family:var(--sc);font-weight:700;font-size:21px;letter-spacing:.06em;line-height:1.15}
.tos-h p{margin:4px 0 0;font-style:italic;color:var(--ink-2);font-size:15px;line-height:1.3}
.tos-doc{position:relative;flex:1 1 auto;min-height:180px;height:56vh;overflow-y:auto;overflow-anchor:none;padding:6px 22px 18px;font-size:16px;line-height:1.45;text-align:justify;hyphens:auto;overscroll-behavior:contain;scrollbar-width:thin}
.tos-doc:focus-visible{outline:2px solid var(--peach-2);outline-offset:-2px}
.tos-doc h4{margin:20px 0 6px;font-family:var(--sc);font-weight:700;font-size:15.5px;letter-spacing:.08em;text-align:left}
.tos-doc .cl{margin:0 0 8px}
.tos-doc .no{font-weight:700;margin-right:.35em;font-variant-numeric:oldstyle-nums}
.tos-doc .dt{font-variant:small-caps;letter-spacing:.03em;font-weight:600}
.tos-doc ol{margin:0 0 8px;padding-left:2.2em;list-style:lower-alpha}
.tos-doc .mix{margin:14px 0 18px;padding:16px 10px 14px;border-top:3px double var(--ink);border-bottom:3px double var(--ink);text-align:center;hyphens:none}   /* Article MIX: for those who got this far */
.tos-doc .mix b{display:block;font-family:var(--sc);font-weight:700;font-size:clamp(24px,5vw,34px);letter-spacing:.08em;line-height:1.1;color:var(--peach-2)}
.tos-doc .mix span{display:block;margin-top:8px;font-family:var(--serif);font-size:clamp(17px,3vw,20px);line-height:1.3;font-weight:600}
.tos-doc .mix i{display:block;margin-top:6px;color:var(--ink-2);font-size:14.5px}
.tos-doc .tease{margin:8px 0 14px;padding:9px 14px 10px;border:2.5px dashed var(--ink);border-radius:2px;text-align:center;hyphens:none;font-style:italic;font-size:16.5px;line-height:1.35;color:var(--ink-2)}   /* a rare aside from the management */
.tos-doc ol li{margin:0 0 3px}
.tos-f{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:10px 22px 14px;border-top:1.5px solid var(--ink);font-size:15px}
.tos-f .prog{flex:1 1 100%;font-family:'DM Mono',monospace;font-size:12px;color:var(--ink-2)}
.tos-f .bar{height:3px;background:var(--faint);margin-top:4px}
.tos-f .bar i{display:block;height:100%;width:0;background:var(--peach-2);transition:width .3s}
.tos-f .act[disabled]{opacity:.45;cursor:not-allowed;transform:none;box-shadow:none}
.tos-f .act.no{background:transparent}
@media (max-width:576px){.tos-doc{height:46vh;padding:4px 16px 14px;font-size:15px;text-align:left}.tos-h,.tos-f{padding-left:16px;padding-right:16px}}
.tos-f .act small{font-family:var(--serif);font-style:italic;letter-spacing:0;font-weight:500;text-transform:none;margin-left:.3em}
.claim-f{flex:1 1 auto;overflow-y:auto;padding:8px 22px 14px;overscroll-behavior:contain;max-height:62vh}
.claim-f .fld{margin:12px 0 0}
.claim-f label{display:block;font-family:var(--sc);font-weight:700;letter-spacing:.05em;font-size:14.5px}
.claim-f label small{font-family:var(--serif);font-style:italic;font-weight:500;letter-spacing:0;color:var(--ink-2)}
.claim-f input{display:block;width:100%;box-sizing:border-box;margin:3px 0 0;padding:4px 2px;font:inherit;font-size:17px;color:var(--ink);background:transparent;border:0;border-bottom:1.5px solid var(--ink);border-radius:0}
.claim-f input::placeholder{color:var(--ink-3);font-style:italic}
.claim-f input:focus{outline:none;border-bottom-color:var(--peach-2);background:rgba(231,196,166,.18)}
.claim-f .msg{margin:3px 0 0;min-height:1.2em;font-style:italic;font-size:14.5px;line-height:1.3;color:var(--ink-2)}
.claim-f .msg.ok::before{content:"✓ ";font-style:normal;color:#4E7A4A}
.claim-f .msg.bad{color:#A1291C}
.claim-f .row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:4px}
.claim-f .row .msg{margin:0}
.claim-f .hint{margin:3px 0 6px;font-size:14.5px;line-height:1.35;color:var(--ink-2)}
.claim-f .cap{display:block;width:100%;max-width:420px;aspect-ratio:3/2;border:1.5px solid var(--ink);background:#14121c;touch-action:none;cursor:crosshair}
.claim-f .skip{font:inherit;font-style:italic;background:none;border:0;padding:0;color:var(--ink-2);text-decoration:underline;text-decoration-color:var(--peach-2);text-underline-offset:.18em;cursor:pointer;font-size:14.5px}
@media (max-width:576px){.claim-f{padding:6px 16px 12px}}
`;
document.head.insertAdjacentHTML('beforeend', `<style id="f50-css">${CSS}</style>`);

/* ---------- the dialogs: the agreement, the claim form, the error ---------- */
document.body.insertAdjacentHTML('beforeend', `
<dialog class="f50 tos" id="tos" aria-labelledby="tosT">
  <div class="tos-h"><h3 id="tosT">Terms and Conditions</h3><p>Please read the Agreement below before accepting it. At least of it.</p></div>
  <div class="tos-doc" id="tosDoc" tabindex="0" role="document" aria-label="The Terms and Conditions"></div>
  <div class="tos-f">
    <div class="prog" aria-live="off"><span id="tosProg">You have read 0% of the Agreement.</span><div class="bar"><i id="tosBar"></i></div></div>
    <button type="button" class="act no" id="tosNext">Read the Next Part</button>
    <button type="button" class="act no" id="tosNo">Decline</button>
    <button type="button" class="act" id="tosYes">Accept without reading <small>(recommended)</small></button>
  </div>
</dialog>

<dialog class="f50 tos claim" id="claim" aria-labelledby="claimT">
  <div class="tos-h"><h3 id="claimT">Claim your <span id="prize">$50</span></h3><p>All fields are mandatory, except the ones that are compulsory.</p></div>
  <form class="claim-f" id="claimF" autocomplete="off" novalidate onsubmit="return false">
    <div class="fld"><label for="cName">Full name</label><input id="cName" name="hog-name" placeholder="e.g. Hedger McHogface'); DROP TABLE recipients;" autocomplete="off" spellcheck="false"><p class="msg" id="mName" aria-live="polite"></p></div>
    <div class="fld"><label for="cDob">Date of birth <small>(Julian date, 7 decimals)</small></label><input id="cDob" name="hog-jd" inputmode="decimal" autocomplete="off"><p class="msg" id="mDob" aria-live="polite"></p></div>
    <div class="fld"><label for="cSkip">Skips in your last throw on <a href="${BASE}index.html">the lake</a></label><input id="cSkip" name="hog-skips" inputmode="numeric" autocomplete="off"><p class="msg" id="mSkip" aria-live="polite"></p></div>
    <div class="fld"><label for="cSpin">Spin of the black hole in Cyg X-1, <i>a</i></label><input id="cSpin" name="hog-spin" inputmode="decimal" placeholder="−1 &lt; a &lt; 1" autocomplete="off"><p class="msg" id="mSpin" aria-live="polite"></p></div>
    <div class="fld"><label for="cBack">The three numbers on the back of your credit card</label><input id="cBack" name="hog-digits" inputmode="numeric" maxlength="4" autocomplete="off" data-lpignore="true" data-1p-ignore><p class="msg" id="mBack" aria-live="polite"></p></div>
    <div class="fld"><label>Terms and Conditions</label><div class="row"><button type="button" class="act no" id="cTerms">Read &amp; accept…</button><p class="msg" id="mTerms" aria-live="polite">not accepted yet.</p></div></div>
    <div class="fld" id="robot" hidden><label>Confirm you are not a robot</label>
      <p class="hint">A photoelectron track in a gas pixel detector. Draw the direction in which the electron set off: it starts at the small blob (the Auger electron) and ends in the big one (the Bragg peak).</p>
      <canvas id="cap" class="cap" role="img" aria-label="A photoelectron track on a hexagonal pixel grid. Drag across it to draw the emission direction."></canvas>
      <div class="row"><button type="button" class="skip" id="capNew">another track</button><p class="msg" id="mCap" aria-live="polite"></p></div></div>
  </form>
  <div class="tos-f"><button type="button" class="act no" id="claimNo">Cancel</button><button type="button" class="act" id="claimYes" disabled>Confirm</button></div>
</dialog>

<dialog class="f50 err" id="err" aria-labelledby="errMsg">
  <div class="err-img">
    <div><p class="err-t">Error occured</p><p class="err-msg" id="errMsg">Something went wrong. Maybe it’s a bug. Maybe it’s you. Maybe a cosmic ray flipped a bit. Who knows? Not you.</p></div>
    <button type="button" class="err-b" id="errOk" autofocus>Try again later</button>
  </div>
</dialog>
`);

/* ---------- the $50: first, the agreement. It has no end: clauses are drawn up as you read, from a handful of
   sentence patterns filled with words from the lists below (the legal-ese is the joke; nothing here is binding) ---------- */
const TOS = (() => {
  let used = new Set();                                  // within one sentence, no word is drawn twice
  const pick = a => { let x; for (let i = 0; i < 8; i++) { x = a[Math.floor(Math.random() * a.length)]; if (!used.has(x)) break; } used.add(x); return x; };
  const W = {                                            // the word lists. Each is used in the sentence patterns (S, below) as shown
    // party: who acts — the subject of a clause:  “{party} shall forthwith polarize the Sauna …” · “Where {party} fails to …”
    party: ['the Claimant',
      'the Licensor',
      'the Hedgehog',
      'any Successor-in-Curiosity',
      'the Night Sky',
      'the Sauna Crew',
      'the Party of the First Part',
      'the Party of the Second Part',
      'any Third Party, Fourth Party or Afterparty',
      'the Ministry of Success',
      'the Fish',
      'a Reasonable Tree',
      'the Universe',
      'the Mailbox',
      'the Neighbouring Cabin',
      'the Jetty'],
    // shall: how strongly — followed directly by a bare verb:  “the Claimant {shall} polarize the Sauna …”  (so: no trailing “to” unless the phrase needs one: “undertakes … to”)
    shall: ['shall',
      'shall not',
      'may, but need not,',
      'shall use reasonable endeavours to',
      'is hereby irrevocably bound to',
      'undertakes, jointly and severally, to',
      'shall forthwith',
      'covenants and agrees to',
      'shall under no circumstances',
      'may, at the sole discretion of the Prickle of hedgehogs,',
      'shall be deemed to',
      'shall heretofore and in perpetuity',
      'is strongly encouraged, under penalty of mild disappointment, to',
      'shall not, save during a leap year,',
      'may, at its own peril and expense, attempt to',
      'shall use all best efforts, short of actual effort, to',
      'shall immediately, or at least before it is too late,',
      'shall, by way of quantum entanglement, simultaneously refuse and agree to',
      'covenants, while maintaining an air of plausible deniability, to',
      'may, upon presentation of a valid reason,',
      'is entitled, but not obliged, to'],
    // verb: what is to be done — a bare verb:  “the Claimant shall forthwith {verb} the Sauna …”
    verb: ['disclose',
      'indemnify',
      'depolarize',
      'reimburse',
      'acknowledge',
      'ratify',
      'sublicense',
      'remit',
      're-emit',
      'retain',
      'heat',
      'skip',
      'surrender',
      'notarize',
      'ray-trace',
      'waive',
      'assign',
      'carry home on its back',
      'file in triplicate',
      'dredge',
      'countersign',
      'recalibrate',
      'hold harmless',
      'rotate by 90° (ninety degrees)',
      'thaw',
      'apportion'],
    // thing: to what — an object:  “the Claimant shall polarize {thing} within thirty (30) days …” · “words importing {thing} include {thing}”
    thing: ['the Fifty Dollars',
      'any and all apples',
      'the Water',
      'the Fishing Rod and its appurtenances',
      'all right, title and interest in the Lake',
      'any stones skipped hereunder',
      'the polarization angle',
      'the Application for Permission to Apply',
      'Form 50-B (to be filed before Form 50-A)',
      'the innermost stable circular orbit',
      'the Stone',
      'the Birch and the apples thereon',
      'any entity caught in breach hereof',
      'this Agreement (including this clause)',
      'a pile of rotting leaves',
      'the burrow and its contents',
      'the fern frost patterns on the window',
      'the left boot',
      'all intellectual property containing a zero bit',
      'the cosmic microwave background',
      'any rainbow occurring on the Premises',
      'the ice song',
      'the last apple of the season',
      'the last sunny day of the year',
      'the first thunder of the spring',
      'any loophole herein',
      'every typo in this Agreement',
      'the preamble',
      'the footnotes (including this one)',
      'all royalties and licensing fees thereon',
      'the affidavit of the Hedgehog',
      'any plausible deniability arising hereunder'],
    // cond: a condition word — introduces a whole circumstance:  “…, {cond} {circ}.”
    cond: ['in the event that',
      'provided always that',
      'notwithstanding that',
      'save where',
      'unless and until',
      'if and only if',
      'to the extent that',
      'insofar as',
      'except during those brief moments when',
      'for so long as it remains true that',
      'whether or not',
      'irrespective of whether or not',
      'assuming, without foundation, that',
      'on the express condition that'],
    // circ: a circumstance — a whole clause, lower case:  “…, provided always that {circ}.”
    circ: ['the Hedgehog is asleep',
      'the Lake is frozen',
      'the Sun is below the horizon',
      'the spin parameter exceeds 0.998',
      'the polarization angle is undefined',
      'the morning coffee cup is completely empty',
      'it is an odd day of the year',
      'the apple has fallen from the birch',
      'Form K-50 has been filed in triplicate',
      'it is raining in Turku, Finland',
      'the Claimant has scrolled this far',
      'kaamos has begun',
      'the sauna is still warm',
      'a hedgehog has been seen carrying an apple',
      'a meteor has been observed',
      'the Licensor is fishing',
      'the Claimant has not yet reached the end of this Agreement',
      'the Moon is waxing gibbous',
      'the tide is high',
      'the tide goes out indefinitely',
      'the Universe expands faster than anticipated',
      'the Moon is feeling particularly dramatic tonight',
      'a rubber duck has squeaked in affirmation',
      'entropy has decreased for 12 (twelve) seconds'],
    // when: a deadline or time:  “… shall polarize the Sauna {when}, …”
    when: ['within thirty (30) days',
      'forthwith',
      'no later than the next juhannus',
      'within one (1) Hubble time',
      'before the ice-out',
      'within a reasonable number of light-seconds',
      'in perpetuity, throughout the Universe',
      'on the next sauna evening',
      'upon reaching the end of this Agreement',
      'before the heat death of the Universe',
      'within seven (7) hedgehog-lengths',
      'within five (5) jetty-crossing-times',
      'within two (2) business eons',
      'by the time the tea cools down',
      'by the stroke of midnight in a timezone of your own choosing',
      'within three (3) ceremonial blinks of an eye',
      'within half a jiffy (adjusted for inflation)',
      'within a generation of field mice (yummy!)',
      'by the absolute end of the current geological epoch',
      'within forty-eight (48) micro-centuries',
      'on or before the thirty-first of February'],
    // noun: a kind of quarrel or paper:  “Any {noun} arising out of the Sauna shall be referred to …” · “… shall give notice of any {noun} by placing it in …”
    noun: ['dispute',
      'claim',
      'controversy',
      'ambiguity',
      'apple',
      'table',
      'misunderstanding',
      'grievance',
      'loophole',
      'typo',
      'affidavit',
      'sub-clause',
      'existential dread',
      'breach',
      'footnote',
      'indemnity',
      'coffee stain',
      'infringement',
      'quantum state',
      'licensing fee',
      'printer jam',
      'royalty',
      'non-disclosure',
      'preamble',
      'schism',
      'liability',
      'stipulation',
      'omission',
      'plausible deniability',
      'splash'],
    // where: who hears disputes:  “… shall be referred to {where}, …”  (half the time a generated court is used instead, see BODY below)
    where: ['the courts of Turku',
      'the lake shore, sitting in plenary session',
      'the International Astronomical Union',
      'the Hedgehog, whose decision shall be final and unappealable',
      'a parliament of owls',
      'the basement of the Municipal Printing Office',
      'the Department of Unresolved Grievances',
      'a wisdom of wombats acting as a board of mediation',
      'a conspiracy of ravens in closed session',
      'a quiet bench in the city park, subject to weather conditions',
      'the edge of the pier, at low tide',
      'the Sauna Committee, sitting at no less than 80 °C'],
    // fact: a fact (or “fact”) — a whole clause, lower case:  “The Claimant hereby acknowledges that {fact}, and shall raise this matter again …”
    fact: ['the Fifty Dollars are a social construct',
      'hedgehogs, as everyone knows, carry apples home on their backs',
      'apples grow on birches at any time of the year',
      'a polarization angle is an axis, not an arrow',
      'there is no exit from the lake, only the sauna',
      'the Licensor is progressively losing the ability to can',
      'this Agreement has no end',
      'all black holes are alike',
      'the Hedgehog is in charge',
      'the Claimant has been warned',
      'zero is a positive emotion',
      'the Earth is a flat plane resting securely on the back of a giant hedgehog',
      'Finland does not actually exist and is merely a fishing coordinate reserved by the UN',
      'all ravens are black',
      'for every action, there is an equal and opposite bureaucratic reaction',
      'Socrates is a human',
      'correlation implies causation',
      'Paul McCartney was replaced by a lookalike in 1966',
      'jet fuel does not have to melt steel beams',
      'the moon landing was staged on Mars',
      'birds sit on power lines strictly to recharge their internal lithium-ion batteries',
      // 'Epstein did not kill himself',
      'the irrationality measure of pi is 2',
      'the barber shaves every man in town who does not shave himself, except on public holidays',
      'a tautology is a statement that is true because it is true',
      'the set of all sets that do not contain themselves is overwhelmed',
      'this statement is false'],
    // adj: what a provision may turn out to be:  “If any provision of this Agreement is held to be {adj}, the remaining provisions …”
    adj: ['invalid',
      'unenforceable',
      'unpolarized',
      'frozen',
      'eaten by the Hedgehog',
      'void for vagueness',
      'lost in a haystack',
      'too hot for the sauna',
      'null and void',
      'statutorily absurd',
      'fair and square',
      'sub-optimal',
      'quantum-entangled',
      'non-Euclidean',
      'morally questionable',
      'lost in transit',
      'overly theatrical',
      'chemically bitter',
      'temporally displaced',
      'void ab initio',
      'retroactively imaginary',
      'too good to be true',
      'plausibly deniable',
      'subject to atmospheric pressure',
      'vaguely ominous',
      'deeply confused',
      'strictly hypothetical',
      'soggy from the heavy rain',
      'unverifiable',
      'spontaneously combusted',
      'topologically equivalent to a donut',
      'over-caffeinated',
      'unhinged',
      'dubious',
      'indubitable',
      'ambiguous',
      'over-cooked',
      'unresolved',
      'waterlogged',
      'obsolete',
      'highly combustible'],
    // loss: losses one may be liable for:  “The Lake shall be liable for any losses, howsoever caused, including but not limited to {loss}, {loss} and {loss}.”
    loss: ['loss of profit',
      'loss of apples',
      'loss of energy',
      'loss of polarization',
      'consequential skips',
      'loss of track of time',
      'loss of momentum',
      'incidental squeaking',
      'loss of the physical ability to care',
      'loss of faith in the judicial process',
      'loss of sleep due to existential dread',
      'diminution of sentiment',
      'irrecoverable losses',
      'damp socks',
      'loss of the will to read further',
      'weather-related anxiety and depression',
      'printer jams',
      'coffee stains',
      'typos',
      'loss of plausible deniability'],
    // term: a Defined Term (capitalised, set in small caps):  “The terms “{term}” and “{term}” shall have the meanings ascribed to them in Clause 3.2 …”
    term: ['Birch Apple',
      'Burrow',
      'Löyly',
      'Fifty Dollars',
      'Premises',
      'Hedgehog',
      'Skip',
      'Business Day',
      'End of this Agreement',
      'Apple Birch',
      'Sauna Evening',
      'Kaamos',
      'Void',
      'Reasonable Endeavours',
      'Hubble Constant',
      'Form K-50',
      'Salty Licorice',
      'Entropy'],
    // head: a fixed Article heading:  “Article XII. {head}”  (about one Article in seven; the rest are put together from TOPIC & co., below)
    head: ['Obligations of the Claimant',
      'Apples',
      'Force Majeure',
      'Saunas and Sauna-Adjacent Structures',
      'Polarization',
      'Indemnification',
      'Severability',
      'Hedgehogs',
      'Governing Law',
      'Notices',
      'Termination (Theoretical)',
      'Survival',
      'The Lake',
      'Confidentiality',
      'Representations and Warranties',
      'Payment of the Fifty Dollars',
      'Interpretation',
      'Assignment',
      'Liability',
      'Meteors and Other Acts of the Sky',
      'Waiver',
      'Further Assurances',
      'Entire Agreement (Not Applicable)'],
    // fill: a filler, slipped into every clause (but the Definitions) at the start, before its first “shall” or “may”, or at the end:
    //   “Mutatis mutandis, the Claimant shall …” · “the Licensor, for the avoidance of doubt, shall …” · “… within thirty (30) days, inter alia.”
    //   (so: an aside that reads right anywhere, lower case, no full stop)
    fill: ['mutatis mutandis',
      'inter alia',
      'for the avoidance of doubt',
      'ipso facto',
      'prima facie',
      'a fortiori',
      'nunc pro tunc',
      'res ipsa loquitur',
      'sub judice',
      'in good faith',
      'for all intents and purposes',
      'subject to contract',
      'without prejudice',
      'time being of the essence',
      'save as otherwise provided',
      'as the case may be',
      'howsoever arising',
      'to the fullest extent permitted by the Hedgehog',
      'herein and hereinafter',
      'by way of an abundance of caution',
      'as amended from time to time',
      'jointly and severally',
      'for value received',
      'in the presence of two (2) witnesses and a hedgehog',
      'nemine contradicente',
      'per stirpes',
      'ex officio']
  };
  // …and the cosmos, the lab and general nonsense, not about anyone in particular
  // (the same lists as W, by the same names — appended to them below; see the comments in W for how each is used)
  const MORE = {
    party: ['the Observer (and, where applicable, the Observed)', 
      'any Schrödinger’s cat (alive or otherwise)', 
      'Reviewer No. 2', 
      'the Dark Matter (wherever situated)', 
      'any Sufficiently Advanced Civilization',
      'the Spherical Cow', 
      'the Local Group of Galaxies', 
      'a Duly Appointed Penguin', 
      'the Grant Committee', 
      'the Comet (upon its return)', 
      'the Universe (as a whole)', 
      'Maxwell’s Demon'],
    shall: ['shall, to the extent permitted by the laws of thermodynamics,', 
      'shall, in a reference frame of its choosing,', 
      'shall, subject to peer review,', 
      'may, with a probability of one half,', 
      'shall, at the speed of light,'],
    verb: ['renormalize', 
      'redshift', 
      'Fourier-transform', 
      'collapse the wave function of', 
      'tidally disrupt', 
      'accrete', 
      'deorbit', 
      'peer-review', 
      'time-dilate', 
      'quantize', 
      'spaghettify',
      'invoice', 
      'convert into a pie chart', 
      'cite', 
      'reticulate', 
      'extrapolate', 
      'round to the nearest order of magnitude'],
    thing: ['the cosmological constant', 
      'all photons emitted hereunder', 
      'the event horizon and everything behind it', 
      'the second law of thermodynamics', 
      'any spare dimensions', 
      'the Hubble tension',
      'the error bars', 
      'the reviewer’s comments', 
      'the coffee machine', 
      'one (1) spherical cow, in vacuum', 
      'the speed of light (in a vacuum, or approximately)', 
      'the arrow of time',
      'all neutrinos passing through the Claimant', 
      'the last slice of cake', 
      'the Oxford comma', 
      'Pluto (whatever its status)', 
      'any unpaid invoices from the Big Bang', 
      'the anomalous result',
      'the remaining 95% of the Universe', 
      'all left socks', 
      'the fine print', 
      'this sentence'],
    circ: ['the Universe is still expanding', 
      'the result is not statistically significant', 
      'Reviewer No. 2 has been consulted', 
      'the coffee machine is out of order', 
      'the cat is both alive and dead',
      'Pluto is reinstated as a planet', 
      'entropy has decreased', 
      'it is Monday', 
      'the p-value exceeds 0.05', 
      'the deadline has been extended again', 
      'the Moon is found to be made of cheese',
      'neutrinos are found to be faster than light', 
      'nobody is looking'],
    when: ['within one (1) Planck time', 
      'at the speed of light, or as soon thereafter as is reasonably practicable', 
      'before the next solar maximum', 
      'by the end of the fiscal aeon',
      'no sooner than the heat death of the Universe and no later than the Big Crunch', 
      'by next Tuesday (in the Claimant’s rest frame)', 
      'when pigs fly (as defined in Schedule 4)',
      'once the arXiv submission clears moderation', 
      'shortly after the deadline'],
    noun: ['paradox', 
      'anomaly', 
      'singularity', 
      'quarrel about units', 
      'conflict of interest'],
    where: ['a jury of twelve (12) spherical cows', 
      'Reviewer No. 2, whose decision shall be final and unhelpful', 
      'the Court of Appeal of Alpha Centauri', 
      'the nearest black hole, from which there is no appeal'],
    fact: ['correlation does not imply causation', 
      'the Universe is under no obligation to make sense', 
      'nothing travels faster than light, except bad news', 
      'all models are wrong, but some are useful',
      'every result is preliminary', 
      'the error bars are larger than they appear', 
      'there is no such thing as a free lunch, or as free fifty dollars', 
      'space is big', 
      'the cake is not guaranteed',
      'the Party reading this is, statistically, not a robot'],
    adj: ['statistically insignificant', 
      'redshifted beyond recognition', 
      'lost behind the event horizon', 
      'retracted', 
      'in a state of superposition', 
      'written in Comic Sans'],
    loss: ['loss of signal-to-noise', 
      'gravitational time dilation', 
      'spaghettification', 
      'loss of the arrow of time', 
      'existential dread', 
      'acts of God, gods or sufficiently advanced aliens',
      'cosmic-ray bit-flips', 
      'coffee spillage', 
      'the 95% of the Universe nobody can find'],
    term: ['Universe', 
      'Spherical Cow', 
      'Reasonable Observer', 
      'Speed of Light', 
      'Business Aeon', 
      'Free Lunch', 
      'Statistically Significant', 
      'Fine Print'],
    head: ['Thermodynamics', 
      'Relativity (Special and General)', 
      'Quantum Indeterminacy', 
      'Dark Matter', 
      'Peer Review', 
      'Cosmic Rays and Other Bit-Flips', 
      'Units of Measurement', 
      'Time Travel',
      'Cake', 
      'The Fine Print', 
      'Errata', 
      'Acknowledgements'],
    fill: ['without loss of generality',
      'up to isomorphism',
      'modulo the Hubble constant',
      'almost surely',
      'almost everywhere',
      'in the weak sense',
      'to first order',
      'ceteris paribus',
      'by symmetry',
      'trivially',
      'by abuse of notation',
      'up to a multiplicative constant of order unity',
      'in natural units',
      'in the limit of small hedgehogs',
      'for sufficiently large values of fifty',
      'assuming a spherical cow',
      'in the rest frame of the Hedgehog',
      'with probability one',
      'at the 3σ level',
      'by the pigeonhole principle',
      'as an exercise for the reader',
      'by the axiom of choice',
      'in the Newtonian limit',
      'after subtracting the background',
      'on a clear night',
      'as is well known',
      'by an argument too large to fit in this margin',
      'barring a supernova']
  };
  for (const k in MORE) W[k].push(...MORE[k]);
  // pompous institutions, offices and instruments, assembled freshly each time: “the High Court of Lost Umbrellas (Appellate Division)”
  // BODY + SUBJ + TAIL make a court or body:  “{BODY} {SUBJ}{TAIL}” → “the High Court of Lost Umbrellas (Appellate Division)”
  //   (it hears disputes — “… shall be referred to …” — and receives appeals and notices)
  const BODY = ['the Court of', 
    'the High Court of', 
    'the Supreme Tribunal of', 
    'the Honourable Society of', 
    'the Exchequer of', 
    'the Royal Commission on', 
    'the Assize of', 
    'the Registry of',
    'the Chancery of', 
    'the Office of the Deputy Undersecretary for', 
    'the Most Venerable Guild of', 
    'the Ancient and Unnecessary Order of', 
    'the Standing Committee on', 
    'the Bureau of', 
    'the Ministry of',
    'the Small Claims Court of', 
    'the Star Chamber of', 
    'the Inter-Galactic Council on'];
  // OFFICE + SUBJ make an official, who sometimes turns up as a party:  “{OFFICE} {SUBJ}” → “the Registrar of Unclaimed Socks”
  const OFFICE = ['the Lord High Keeper of', 
    'the Registrar of', 
    'the High Commissioner for', 
    'the Deputy Undersecretary for', 
    'the Grand Inquisitor of', 
    'the Keeper of the Seals of', 
    'the Master of the Rolls of',
    'the Comptroller-General of', 
    'the Warden of', 
    'the Ombudsman for', 
    'the Assistant to the Regional Manager of'];
  // INSTR + SUBJ make a document of law:  “Pursuant to {INSTR} {SUBJ} ({year}), the Claimant shall …” → “Pursuant to the Writ of Fog (1066), …”
  const INSTR = ['the Letter of', 
    'the Writ of', 
    'the Statute of', 
    'the Treaty of', 
    'the Edict of', 
    'the Charter of', 
    'the Doctrine of', 
    'the Bill of', 
    'the Decree Absolute of', 
    'the Great Scroll of',
    'the Memorandum of Misunderstanding on', 
    'the Protocol of', 
    'the Codicil of', 
    'the Papal Bull of'];
  // a paper to be obtained:  “Before claiming the Fifty Dollars, the Claimant shall obtain {DOC} of {SUBJ} from {a court}, countersigned by {an official}.”
  const DOC = ['a Letter', 
    'a Writ', 
    'a Certificate', 
    'a Notarized Affidavit', 
    'a Permit (in triplicate)', 
    'a Sworn Declaration', 
    'a Stamped Receipt', 
    'a Licence to Proceed', 
    'a Note from Their Mother'];
  // what all of the above are of / for — plural or mass nouns, Title Case:  “the Court of {SUBJ}”, “the Writ of {SUBJ}”
  const SUBJ = ['Pies and Powder', 
    'Lost Umbrellas', 
    'Small Claims and Smaller Hedgehogs', 
    'Things Left in the Sauna', 
    'Unclaimed Socks', 
    'Wandering Comets', 
    'Disputed Apples', 
    'Moderate Inconvenience',
    'Overdue Library Books', 
    'Strange Attractors', 
    'Excessive Footnotes', 
    'Rubber Ducks and Maritime', 
    'Hats', 
    'Unreasonable Doubt', 
    'Perpetual Motion', 
    'Leap Seconds', 
    'the Drop of Water in the Lake',
    'Fog', 
    'Misplaced Decimal Points', 
    'Mild Surprise', 
    'Puddles', 
    'Ambiguous Signage', 
    'Errant Commas', 
    'Teaspoons', 
    'Stray Cats and Strange Quarks', 
    'Odd Socks and Even Socks', 
    'Loud Chewing',
    'Unattended Kettles', 
    'Spherical Cows', 
    'Things That Go Bump in the Night', 
    'Unexplained Draughts', 
    'Snacks', 
    'Orbital Debris and Lesser Debris'];
  // optional endings for a court ('' = none, so most have none):  “the Court of Hats{TAIL}”
  const TAIL = ['',  '', '',  '', 
    ' (Appellate Division)', 
    ' (sitting in Chambers)', 
    ' and its Successors in Title', 
    ' (Sauna Division)', 
    ' (Black Hole Division)', 
    ' (Northern Circuit)', 
    ', in Perpetuity'];
  const inst = () => `${pick(BODY)} ${pick(SUBJ)}${pick(TAIL)}`, officer = () => `${pick(OFFICE)} ${pick(SUBJ)}`, instr = () => `${pick(INSTR)} ${pick(SUBJ)}`;
  const year = () => pick(['1066', 
    '1215',
    '1349', 
    '1689', 
    '1776',
    '1812', 
    '1905', 
    '1919', 
    '1969', 
    '4713 BC', 
    'the year of the Great Fog', 
    'time immemorial', 
    'the reign of the Great Hog']);

  /* the Articles' headings: a fixed few (W.head, above), but mostly put together on the spot, so that a hundred Articles in,
     the headings are still new — “Supplementary Lemmas Concerning Teaspoons”, “Entropy in the Limit of Biscuits” */
  // TOPIC: what an Article is about — plural or mass nouns, Title Case (“… of {TOPIC}” must read right):  “On the Conservation of {TOPIC}”, “{TOPIC} and {TOPIC}”
  //   (topics that already contain “and”, like 'Seals and Sea Lions', are welcome: the patterns that join two topics with “and” skip them;
  //    so are ones that start with “the”, like 'the Moon': the patterns that put a word right before the topic skip those)
  const TOPIC = ['Apples',
    'Saunas',
    'Comets',
    'Errata',
    'Footnotes',
    'Liabilities',
    'Indemnities',
    'Black Holes',
    'Neutron Stars',
    'Eigenvalues',
    'Prime Numbers',
    'Infinite Series',
    'Boundary Conditions',
    'Moral Hazard',
    'Entropy',
    'Dark Energy',
    'Spherical Cows',
    'the Small Print',
    'Gravity',
    'Polarization',
    'Signatures',
    'Seals and Stamps',
    'Seals and Sea Lions',
    'Leap Seconds',
    'Coffee',
    'Deadlines',
    'Rounding Errors',
    'Imaginary Numbers',
    'the Axiom of Choice',
    'the Illusion of Choice',
    'Undefined Behaviour',
    'Recursion',
    'Paradoxes',
    'Reviewer No. 2',
    'Hedgehogs',
    'Riders and Codicils',
    'Heirs and Assigns',
    'Fog',
    'Wormholes',
    'Water',
    'Ducks',
    'Interest (Compound)',
    'Interest (Lack of)',
    'Pie (Mathematical and Otherwise)',
    'Error Bars',
    'Lemmas',
    'the Null Hypothesis',
    'Snow',
    'Small Talk',
    'Magnetic Fields',
    'Supernovae (type Ia)',
    'Tautologies',
    'Holidays',
    'Parking Availability',
    'Rain',
    'the Moon',
    'the Sun',
    'the Galaxy',
    'the Universe',
  ];
  // QUAL: a qualifier in brackets:  “{TOPIC} ({QUAL})” → “Socks (Revisited)”
  const QUAL = ['Revisited',
    'Continued',
    'Abridged',
    'Unabridged',
    'Provisional',
    'in Perpetuity',
    'Retroactive',
    'Non-Binding',
    'Asymptotic',
    'Second Reading',
    'Draft',
    'Redacted',
    'as Amended',
    'Revised and Expanded',
    'Final Version',
    'Final Version 2',
    'Final Version, Really',
    'for the Avoidance of Doubt',
    'Without Prejudice',
    'Subject to Contract',
    'in a Vacuum',
    'to First Order'];
  // ADJ: an adjective before a KIND or a TOPIC:  “{ADJ} {KIND} {TOPIC}” → “Supplementary Lemmas Concerning Teaspoons” · “{ADJ} {TOPIC}” → “Retrograde Coffee”
  const ADJ = ['Further',
    'Miscellaneous',
    'Supplementary',
    'Residual',
    'Transitional',
    'Ancillary',
    'Hypothetical',
    'Unforeseen',
    'Boundary',
    'Imaginary',
    'Retrograde',
    'Conserved',
    'Undisclosed',
    'Lesser',
    'Greater',
    'Irrational',
    'Non-Euclidean',
    'Relativistic',
    'Ceremonial',
    'Purely Decorative'];
  // KIND: what sort of Article it is, ending in a preposition:  “{KIND} {TOPIC}” → “Objections to Umbrellas”
  const KIND = ['Provisions Concerning',
    'Matters Relating to',
    'Remarks on',
    'Questions Regarding',
    'Exceptions to',
    'Obligations in Respect of',
    'Lemmas Concerning',
    'Boundary Conditions for',
    'Objections to',
    'Amendments to',
    'A Brief History of',
    'Frequently Asked Questions about',
    'The Limits of',
    'Corollaries of',
    'An Appendix on'];
  // the heading patterns themselves: add more as `() => \`…\`` using pick(TOPIC) etc.
  const SOLO = TOPIC.filter(t => !/ and /.test(t.replace(/\(.*?\)/g, '')));   // the topics without an “and” of their own (one inside brackets is fine)
  const BARE = TOPIC.filter(t => !/^the /i.test(t));      // …and without a “the”, for where a word goes right before the topic (“Retrograde Coffee”, not “Retrograde the Moon”)
  const PLAIN = TOPIC.filter(t => !/\(/.test(t));      // …and without brackets, for where a bracket follows (“Socks (Revisited)”, not “Pie (Mathematical and Otherwise) (Revisited)”)
  const KADJ = KIND.filter(k => !/^(The|A|An) /.test(k));   // the kinds an adjective can stand before (“Further Remarks on”, not “Further The Limits of”)
  const HEADS = [
    () => `${pick(SOLO)} and ${pick(SOLO)}`,
    () => `${pick(SOLO)}, ${pick(SOLO)}, and ${pick(SOLO)}`,
    () => `${pick(PLAIN)} (${pick(QUAL)})`,
    () => `${pick(ADJ)} ${pick(KADJ)} ${pick(TOPIC)}`,
    () => `On the Conservation of ${pick(TOPIC)}`,
    () => `${pick(SOLO)}, ${pick(SOLO)} and Other ${pick(['Recurring Phenomena', 'Acts of God', 'Liabilities', 'Inconveniences', 'Singularities', 'Matters', 'Unknowns'])}`,
    () => `${pick(TOPIC)} in the Limit of ${pick(TOPIC)}`,
    () => `The ${pick(BARE)} Problem`,
    () => `${pick(TOPIC)} at Finite Temperature`,
    () => `${pick(TOPIC)} in a Vacuum`,
    () => `${pick(TOPIC)}, Notwithstanding ${pick(TOPIC)}`,
    () => `${pick(TOPIC)}: A Rebuttal`,
    () => `${pick(KIND)} ${pick(TOPIC)}`,
    () => `${pick(TOPIC)} Considered Harmful`,
    () => `${pick(TOPIC)} as a Special Case of ${pick(TOPIC)}`,
    () => `${pick(ADJ)} ${pick(BARE)}`,
    () => `Proof of the Existence of ${pick(PLAIN)}${pick(['', ' (Sketch)', ' (Left to the Reader)', ' (Withdrawn)'])}`,
    () => `Everything You Always Wanted to Know about ${pick(TOPIC)}`,
    () => `${pick(TOPIC)}: Theory and Practice`,
    () => `${pick(TOPIC)}: Experiments and Observations`
  ];
  let lastHeads = [];
  const heading = () => {                                // no heading twice within forty Articles
    let h; for (let i = 0; i < 12; i++) { h = Math.random() < 0.15 ? pick(W.head) : HEADS[Math.floor(Math.random() * HEADS.length)](); if (!lastHeads.includes(h)) break; }
    h = h[0].toUpperCase() + h.slice(1);                 // (“the Moon and Coffee” → “The Moon and Coffee”)
    lastHeads = [h, ...lastHeads].slice(0, 40); return h;
  };
  let art = 0, cl = 0, made = [];
  const P = () => Math.random() < 0.2 ? officer() : pick(W.party), cap = t => t[0].toUpperCase() + t.slice(1);   // now and then an official instead
  const words = n => {                                    // 203 → “two hundred and three”
    const one = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const ten = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const two = n => n < 20 ? one[n] : ten[Math.floor(n / 10)] + (n % 10 ? '-' + one[n % 10] : '');
    const three = n => n < 100 ? two(n) : one[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + two(n % 100) : '');
    return n < 1000 ? three(n) : three(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? (n % 1000 < 100 ? ' and ' : ' ') + three(n % 1000) : '');
  };
  const ref = () => made.length ? 'Clause ' + pick(made.slice(-40)) : 'Clause 1.1';
  const dt = t => `<span class="dt">${t}</span>`;
  const S = [
    () => `${cap(P())} ${pick(W.shall)} ${pick(W.verb)} ${pick(W.thing)} ${pick(W.when)}, ${pick(W.cond)} ${pick(W.circ)}.`,
    () => `Notwithstanding ${ref()}, ${P()} ${pick(W.shall)} ${pick(W.verb)} ${pick(W.thing)}, except as expressly provided in ${ref()}.`,
    () => `For the avoidance of doubt, nothing in this Agreement shall oblige ${P()} to ${pick(W.verb)} ${pick(W.thing)}, ${pick(W.cond)} ${pick(W.circ)}.`,
    () => `Any ${pick(W.noun)} arising out of or in connection with ${pick(W.thing)} shall be referred to ${Math.random() < 0.5 ? pick(W.where) : inst()}, ${pick(W.cond)} ${pick(W.circ)}.`,
    () => `${cap(P())} hereby acknowledges that ${pick(W.fact)}, and ${pick(W.shall)} raise this matter again ${pick(W.when)}.`,
    () => `The terms “${dt(pick(W.term))}” and “${dt(pick(W.term))}” shall have the meanings ascribed to them in ${ref()} or, failing that, the meaning that ${P()} considers most inconvenient to the Claimant.`,
    () => `If any provision of this Agreement is held to be ${pick(W.adj)}, the remaining provisions shall continue in full force and effect, and ${P()} ${pick(W.shall)} ${pick(W.verb)} ${pick(W.thing)} ${pick(W.when)}.`,
    () => `${cap(P())} represents and warrants that it has read ${ref()} in full, and that it has not yet reached the end of this Agreement.`,
    () => `${cap(P())} ${pick(W.shall)} ${pick(W.verb)}:<ol><li>${pick(W.thing)};</li><li>${pick(W.thing)}; and</li><li>${pick(W.thing)}, ${pick(W.cond)} ${pick(W.circ)},</li></ol> in each case ${pick(W.when)}.`,
    () => `Time shall be of the essence, save in respect of ${pick(W.thing)}, for which time shall be relative (see ${ref()}).`,
    () => `Where ${P()} fails to ${pick(W.verb)} ${pick(W.thing)} ${pick(W.when)}, ${P()} may, by written notice delivered by hedgehog, ${pick(W.verb)} ${pick(W.thing)}.`,
    () => `This clause is intentionally left blank, save for the following: ${P()} ${pick(W.shall)} ${pick(W.verb)} ${pick(W.thing)}.`,
    () => `The ${dt('Fifty Dollars')} shall become payable ${pick(W.when)}, ${pick(W.cond)} ${pick(W.circ)}, and in any event not before the Claimant has reached the end of this Agreement.`,
    () => `Each Party shall keep the existence of ${pick(W.thing)} strictly confidential, except from the Hedgehog, who already knows.`,
    () => `No waiver of ${ref()} shall be effective unless made in writing, signed by both Parties and carried home by the Hedgehog.`,
    () => `${cap(P())} shall be liable for any losses, howsoever caused, including but not limited to ${pick(W.loss)}, ${pick(W.loss)} and ${pick(W.loss)}.`,
    () => `In this Agreement, words importing the singular include the plural, words importing one hedgehog include all hedgehogs, and words importing ${pick(W.thing)} include ${pick(W.thing)}.`,
    () => `${ref()} shall survive the termination of this Agreement, which, for the avoidance of doubt, shall not terminate.`,
    () => `${cap(P())} shall give notice of any ${pick(W.noun)} by placing it in ${pick(['the Mailbox', 
      'the pile of leaves', 
      'a bottle, cast into the Lake', 
      'the burrow (if open)'])} ${pick(W.when)}.`,
    () => `Nothing in ${ref()} shall be construed as an offer of fifty (50) dollars, an invitation to treat, or an apple.`
  ];
  S.push(                                                 // more patterns: physics, the lab, and plain nonsense
    () => `Pursuant to ${instr()} (${year()}), ${P()} ${pick(W.shall)} ${pick(W.verb)} ${pick(W.thing)} ${pick(W.when)}.`,
    () => `Any appeal against this clause shall be lodged with ${inst()}, which sits on the second Tuesday of every leap century, weather permitting.`,
    () => `Before ${pick(['claiming the Fifty Dollars', 
      'reading further', 
      'entering the Sauna', 
      'touching the Hedgehog', 
      'skipping any stone'])}, ${P()} shall obtain ${pick(DOC)} of ${pick(SUBJ)} from ${inst()}, countersigned by ${officer()}.`,
    () => `As was settled once and for all in ${instr()} (${year()}), and unsettled again in ${instr()} (${year()}), ${P()} ${pick(W.shall)} ${pick(W.verb)} ${pick(W.thing)}.`,
    () => `${cap(officer())} may, on application by ${P()} and on payment of the customary fee of one (1) apple, issue ${pick(DOC)} of ${pick(SUBJ)}, which shall have no effect whatsoever.`,
    () => `This Agreement shall be governed by ${instr()}, save where it conflicts with ${instr()}, in which case it shall be governed by whichever of the two is shorter.`,
    () => `All notices under this Agreement shall be sent to ${officer()}, c/o ${inst()}, and shall be deemed received upon being lost.`,
    () => `${cap(P())} shall be deemed to have read this clause whether or not it was observed doing so, in accordance with the Copenhagen interpretation.`,
    () => `All quantities in this Agreement are given in SI units, save for ${pick(W.thing)}, which shall be measured in hedgehog-lengths.`,
    () => `Should ${P()} travel faster than light, this Agreement shall be read in reverse, starting from the end (see ${ref()}).`,
    () => `No provision of this Agreement shall be construed as violating the conservation of energy, momentum or ${pick(['angular momentum', 
      'apples', 
      'patience', 
      'paperwork'])}.`,
    () => `${cap(P())} acknowledges that, by the uncertainty principle, it cannot know both where the Fifty Dollars are and how fast they are leaving.`,
    () => `This Agreement is entered into in the rest frame of ${P()}; in any other frame, its clauses may appear shortened in the direction of motion, but are not.`,
    () => `The Parties agree that ${pick(W.thing)} shall be rounded to the nearest order of magnitude, as is customary in astrophysics.`,
    () => `Any clause found in a state of superposition shall be both binding and not binding until read by ${P()}, whereupon it shall be binding.`,
    () => `${cap(P())} shall bear the cost of ${pick(W.thing)}, including any dark energy consumed in the process.`,
    () => `Nothing in this Agreement shall be interpreted as a promise of cake (see ${ref()}).`,
    () => `In the event of a conflict between this Agreement and the laws of physics, the laws of physics shall prevail, except at weekends.`,
    () => `${cap(P())} warrants that it has calibrated ${pick(W.thing)}, or at least looked in its general direction, ${pick(W.when)}.`,
    () => `Clause ${art}.${cl} is self-referential. ${cap(P())} ${pick(W.shall)} refrain from thinking about it too hard.`,
    () => `The error bars on ${pick(W.thing)} are hereby declared to be ±100%, at the 68% confidence level, ${pick(W.cond)} ${pick(W.circ)}.`,
    () => `If this Agreement is ever found to contain a final clause, that clause shall be deemed to be an erratum and shall be replaced by ${words(art + 1)} (${art + 1}) further Articles.`
  );
  S.push(                                                 // the long ones, in mathematese, legalese and astrophysicsese
    () => `Let ${P()} be a Party, and let ε > 0 be arbitrary. Then there exists δ > 0 such that, whenever ${P()} comes within δ of ${pick(W.thing)}, ${pick(W.thing)} shall recede by at least ε ${pick(W.when)}, ${pick(W.cond)} ${pick(W.circ)}; the proof is left as an exercise to ${P()}.`,
    () => `Without loss of generality, and without admission of any ${pick(W.noun)}, ${P()} may assume that ${pick(W.circ)}; the general case follows by induction on the number of hedgehogs, the base case being trivial, the inductive step being ${pick(W.adj)}, and the whole being the subject of ${instr()} (${year()}).`,
    () => `Suppose, for the sake of contradiction, that the Fifty Dollars have been paid ${pick(W.when)}. Then ${pick(W.circ)}, and the Claimant must have reached the end of this Agreement, contrary to ${ref()}. Hence ${pick(W.fact)}, and the Fifty Dollars have not been paid. QED.`,
    () => `The Parties agree that the sum of all obligations hereunder, together with every ${pick(W.noun)} and all ${pick(W.loss)} arising therefrom, is a divergent series; any attempt by ${P()} to ${pick(W.verb)} the total by zeta-function regularization, Cesàro summation or other sorcery shall be held ${pick(W.adj)} and referred to ${inst()} ${pick(W.when)}.`,
    (p = P()) => `Should ${p} cross the event horizon of ${pick(W.thing)}, every obligation of ${p} to ${pick(W.verb)} ${pick(W.thing)} shall be deemed discharged as seen by ${p}, and as forever pending, ever more redshifted and ever more slowly fading, as seen by ${P()}, ${pick(W.cond)} ${pick(W.circ)}.`,
    () => `Every obligation of ${P()} to ${pick(W.verb)} ${pick(W.thing)} shall be evaluated to first order in ${pick(W.thing)}; terms of second and higher order, together with any ${pick(W.noun)} arising at the boundary, are hereby declared ${pick(W.adj)}, ${pick(W.cond)} ${pick(W.circ)}.`,
    () => `The probability that ${P()} reads this clause in full is hereby fixed at one half, whether or not ${pick(W.circ)}; any Party claiming to have read two consecutive clauses shall bear the burden of proof at the 5σ level and ${pick(W.shall)} ${pick(W.verb)} ${pick(W.thing)} ${pick(W.when)}.`,
    () => `${cap(P())} acknowledges that the clauses of this Agreement are countably infinite and that a further ${pick(W.noun)} may always be accommodated by moving every existing clause along by one, which ${P()} ${pick(W.shall)} do ${pick(W.when)}.`,
    () => `This clause is the limit, as n tends to infinity, of Clause ${art}.n. It exists in the sense of distributions, converges weakly to ${pick(W.thing)}, is ${pick(W.adj)} in the L² norm, and shall bind ${P()} almost everywhere, except on a set of measure zero, namely whenever ${pick(W.circ)}.`,
    () => `Any ${pick(W.noun)} emitted by ${P()} in breach of this Agreement shall be polarized at ${Math.round(Math.random() * 180)}° east of north, and shall be measured ${pick(W.when)} by an X-ray polarimeter with a modulation factor of no less than ${20 + Math.floor(Math.random() * 60)}%, whose findings shall be admissible before ${inst()}, ${pick(W.cond)} ${pick(W.circ)}.`,
    () => `${cap(P())} ${pick(W.shall)} keep its obligations and its excuses in hydrostatic equilibrium; should the pressure of the latter exceed the Eddington limit, ${pick(W.thing)} shall be blown away by radiation, and any resulting ${pick(W.loss)} shall not be recoverable from ${P()} under any policy of insurance.`,
    () => `Notwithstanding the second law of thermodynamics, the entropy of ${pick(W.thing)} shall be non-decreasing on Business Days only; on all other days it may be decreased by ${P()}, provided that the heat so released is applied to ${pick(W.thing)} ${pick(W.when)}, and not to ${pick(W.thing)}.`,
    () => `Let 𝒜 denote this Agreement and 𝒜′ the Agreement read backwards. The Parties covenant that 𝒜 and 𝒜′ are isomorphic, save for ${pick(W.thing)} and ${pick(W.thing)}, the former being its own inverse and the latter ${pick(W.adj)}; both shall be returned to ${P()} ${pick(W.when)}.`,
    () => `${cap(P())} shall be liable for ${pick(W.loss)} only in the rest frame of ${pick(W.thing)}; in every other frame its liability shall be Lorentz-contracted by a factor γ, to be determined by ${officer()} ${pick(W.when)} and rounded down, ${pick(W.cond)} ${pick(W.circ)}.`,
    () => `All integrals in this Agreement are taken over the whole Universe and are to be understood as Cauchy principal values; any singularity met along the way, including but not limited to ${pick(W.thing)} and any ${pick(W.noun)} arising therefrom, shall be stepped around in a small semicircle, anticlockwise, ${pick(W.when)}, at the expense of ${P()}.`,
    (p = P()) => `Should ${p} prove that P = NP ${pick(W.when)}, this Agreement shall terminate forthwith and the Fifty Dollars shall be paid; should ${p} instead prove that P ≠ NP, it ${pick(W.shall)} ${pick(W.verb)} ${pick(W.thing)} and shall be awarded a further clause.`,
    () => `${cap(P())} warrants that every bounded sequence of excuses offered under this Agreement has a convergent subsequence (Bolzano–Weierstrass), the limit of which ${P()} ${pick(W.shall)} ${pick(W.verb)} and submit in writing to ${inst()} ${pick(W.when)}.`,
    () => `For the purposes of ${ref()}, ${pick(W.thing)} shall be approximated as a point mass at the centre of ${pick(W.thing)}, all ${pick(W.loss)} shall be neglected, and ${P()} shall be treated as a perfectly spherical, perfectly elastic body of uniform density and indeterminate mood, ${pick(W.cond)} ${pick(W.circ)}.`,
    (p = P()) => `The Parties acknowledge that this Agreement is consistent if and only if it cannot prove its own consistency (Gödel, 1931), and hereby waive, jointly and severally, any right to ask whether it is; should ${p} ask nonetheless, it ${pick(W.shall)} ${pick(W.verb)} ${pick(W.thing)} ${pick(W.when)}.`,
    () => `${cap(P())} shall bear all ${pick(W.loss)} arising from ${pick(W.thing)} up to the Chandrasekhar limit of 1.4 Dollars; beyond that limit the costs shall collapse under their own weight into ${pick(W.thing)}, be held ${pick(W.adj)}, and become the sole responsibility of ${officer()}.`
  );
  const DEFS = [
    `“${dt('Agreement')}” means these Terms and Conditions, as amended, extended and further extended from time to time, which is to say continuously.`,
    `“${dt('Dollars')}” means units of currency, or their equivalent at the rate prevailing on the Premises.`,
    `“${dt('Claimant')}” means you, the person who pressed the button.`,
    `“${dt('Hedgehog')}” means the jumping hedgehog, who is in charge at the moment.`,
    `“${dt('Party')}” means each of the Claimant, the Licensor, the Hedgehog and any Afterparty; “${dt('Parties')}” means all of them, even when you are not invited.`,
    `“${dt('Premises')}” means the Lake, its shore, the Sauna, and any part of the Universe within the past light cone of the Hedgehog.`,
    `“${dt('Universe')}” means the observable Universe and, for the avoidance of doubt, the unobservable one too.`,
    `“${dt('Business Day')}” means any day on which the Hedgehog is awake, excluding weekends, public holidays and days ending in “y”.`,
    `“${dt('Day')}” means a mean solar day, even when there is no sun in sight for days in a row, which is a common occurrence.`,
    `“${dt('Forthwith')}” means at once, or within one (1) Hubble time, whichever is later.`,
    `“${dt('In Writing')}” means written by hand, in ink, on birch bark, and witnessed by two (2) eyes.`,
    `“${dt('Including')}” means including, without limitation and without end.`,
    `“${dt('Reasonable')}” means reasonable to a reasonable person.`,
    `“${dt('Apple')}” means any fruit that falls from a birch.`,
    `“${dt('Form K-50b')}” means the Application for Permission to Apply for the Fifty Dollars, available by post only, in Swedish, upon submission of Form K-50a.`,
    `“${dt('Force Majeure')}” means any event beyond the reasonable control of an omnipotent God, including meteors, Mondays and acts of the God when he was drunk.`,
    `“${dt('Signature')}” means a mark made by the Claimant or, failing that, a photoelectron track of an X-ray photon emitted by the Claimant.`,
    `“${dt('Fifty')}” means 50 (fifty), or sometimes also 40 (forty).`,
    `“${dt('Infinity')}” means a number larger than the number of clauses in this Agreement.`,
    `“${dt('Termination')}” has no meaning in this Agreement.`,
    `“${dt('Hereinafter')}” means after here, i.e. there.`,
    `“${dt('Notwithstanding')}” means withstanding, but not.`,
    `“${dt('Fine Print')}” means print that is fine.`,
    `“${dt('Immediately')}” means as soon as it is not yet considered unimmediate.`,
    `“${dt('Majority')}” means Me.`,
    `Silence shall be deemed consent, save the silence of the Hedgehog, which shall be deemed sleep.`,
    `“${dt('You')}” means you. Yes, you.`,
    `“${dt('Default')}” means the Claimant, by default.`,
    `Headings are for convenience only and shall not affect the interpretation of this Agreement, except where they are funnier than the clause beneath them.`,
    `“${dt('End of this Agreement')}” has the meaning given to it in the final clause of this Agreement.`
  ];
  // TEASE: a rare aside right under an Article's heading (not under I or MIX), with probability TEASE_P per Article,
  //   so about one in every 150 Articles:  “Article CCXII. Coffee in a Vacuum” → “Accept already.”
  const TEASE_P = 0.067;
  const TEASE = ['If you keep scrolling, the Fifty Dollars will not magically double.',
    'Accept already.',
    'Consider the recommended option. It is not recommended for nothing.',
    'Nine (9) out of ten (10) dentists recommend skipping the rest.',
    'Nobody reads licence agreements. Don’t be a hero.',
    'One in three people keeps reading after this point. Are you the odd one out?',
    'Still here? The Fifty Dollars should have had an expiry date.',
    'You have now read more of this Agreement than its author.',
    'At this rate, you will reach the end of this Agreement before the heat death of the Universe! Please plan accordingly.',
    'Your patience has been noted, and can be used against you.',
    'Achievement unlocked: none.',
    'Don’t you need a nap?',
    'Reading on will not increase the cash prize. It will, however, increase the Agreement.',
    'Just one last article before the next one!',
    'Look at you go! Your lawyer would be proud.',
    'The button that says “recommended” means it.',
    'So many exciting papers on arXiv today, and you are reading Terms and Conditions.'];
  let teased = [];                                        // no aside twice, until all have been seen
  const tease = () => { const left = TEASE.filter(t => !teased.includes(t)); if (!left.length) teased = []; const t = pick(left.length ? left : TEASE); teased.push(t); return t; };
  const ROMAN = n => { let r = '', x = n; for (const [v, s] of [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) while (x >= v) { r += s; x -= v; } return r; };
  let skips = 0, pending = [], recent = [];
  // slip a filler (W.fill) into a clause: at the start, before the first “shall” or “may”, or before the full stop — whichever the clause allows
  const LOWER = /^(The|A|An|Any|All|Every|Each|If|Should|Where|Wherever|No|Nothing|In|For|This|Notwithstanding|Suppose|Let|Before|As|Pursuant|Without|Save|Upon|Unless|Subject|Whereas|Neither|Words|Time|Then)(?=[ ,])/;
  function fill(t) {
    const low = t.toLowerCase(), echo = f => low.includes(f.toLowerCase()) || f.split(' ').some(w => w.length > 3 && new RegExp(`\\b${w.toLowerCase()}\\b`).test(low));
    let f; for (let i = 0; i < 12; i++) { f = pick(W.fill); if (!echo(f)) break; }   // (not “Time being of the essence, time shall be of the essence”, nor “save …, save …”)
    if (echo(f)) return t;
    const at = [];
    if (/^[A-Z]/.test(t) && !W.fill.some(x => low.startsWith(x.toLowerCase()))) at.push(() => `${cap(f)}, ${LOWER.test(t) ? t[0].toLowerCase() + t.slice(1) : t}`);   // at the start (“the Claimant”, but still “Reviewer No. 2”)
    let c = -1, depth = 0, tag = false;                   // before the first “shall” or “may” in plain text (not inside a tag or brackets): “the Licensor, inter alia, shall …”
    for (let i = 1; i < t.length; i++) { const ch = t[i]; if (ch === '<') tag = true; else if (ch === '>') tag = false; else if (!tag && ch === '(') depth++; else if (!tag && ch === ')') depth--; else if (!tag && !depth && /^ (shall|may) /.test(t.slice(i, i + 7)) && t[i - 1] !== ',') { c = i; break; } }
    if (c > 0) at.push(() => `${t.slice(0, c)}, ${f},${t.slice(c)}`);
    if (/[a-z0-9)”]\.$/.test(t)) at.push(() => `${t.slice(0, -1)}, ${f}.`);   // at the end (only a plain full stop: not after a list or a ∎)
    return at.length ? at[Math.floor(Math.random() * at.length)]() : t;
  }
  function chunk() {                                      // one Article: a heading and 3–7 clauses
    art++; cl = 0;
    used = new Set(); let h = `<h4>Article ${ROMAN(art)}. ${art === 1 ? 'Definitions' : heading()}</h4>`;
    if (art === 1009) h += `<div class="mix"><b>Congratulations!</b><span>You have read your way to Article MIX (not to be confused with a Mix of Articles). Such dedication is rarely seen. You have read so far you started seeing words in Roman numerals. Keep scrolling until you start seeing ghosts! </div>`;   // 1009 = MIX
    else if (art > 1 && Math.random() < TEASE_P) h += `<div class="tease">${tease()}</div>`;   // (now and then)
    const n = art === 1 ? DEFS.length : 3 + Math.floor(Math.random() * 8);
    for (let i = 0; i < n; i++) {
      cl++; const no = `${art}.${cl}`; made.push(no);
      used = new Set(); let k; do { k = Math.floor(Math.random() * S.length); } while (recent.includes(k)); recent = [k, ...recent].slice(0, 14);   // no pattern twice within fourteen clauses
      const txt = art === 1 ? DEFS[i] : pending.length ? pending.shift() : fill(S[k]());
      h += `<div class="cl" data-i="${made.length}"><span class="no">${no}</span>${txt}</div>`;   // (a div: some clauses carry lists, which a <p> can’t hold)
    }
    return h;
  }
  return {
    reset() { art = 0; cl = 0; made = []; skips = 0; pending = []; recent = []; },
    chunk,
    get clauses() { return made.length; },
    skipped(from, to) {                                   // the Agreement notices
      skips++; used = new Set();
      pending.push(skips === 1 ? `The Party having attempted to skip to the end shall be deemed not to have read Clauses ${from} to ${to}, and is respectfully invited to read them again.`
        : skips === 2 ? 'The end of this Agreement has been moved, for the convenience of the Claimant, to a later clause.'
        : `The Claimant has now attempted to skip to the end ${skips} times. ${pick(['The Hedgehog has been informed.', 
          'This has been noted in Form K-50c.', 
          'The end is not impressed.', 
          'Patience is a virtue (see Clause 1.4).'])}`);
    }
  };
})();
const tos = $('#tos'), tosDoc = $('#tosDoc'), dlg = $('#err');
// the progress counter: after k clauses it reads  100 · k / (k + TOS_HALF) %   (k counted from the last clause in full view, beyond those on the first screen)
//   so 50% after TOS_HALF clauses, 90% after 9·TOS_HALF, 99% after 99·TOS_HALF; an Article has 6.5 clauses on average, so with 132: about XXI, CLXXXIV, MMI.
//   Larger = slower. In general, to show p (as a fraction), one has to read TOS_HALF · p / (1 − p) clauses.
const TOS_HALF = 133;
let tosAt = -1, tosBase = 0;                              // where the counter last stood, and the clause it started from
function tosFill() {                                      // keep a few screens of text below what's being read
  let guard = 0;
  while (tosDoc.scrollHeight - tosDoc.scrollTop - tosDoc.clientHeight < tosDoc.clientHeight * 3 && guard++ < 30) tosDoc.insertAdjacentHTML('beforeend', TOS.chunk());
  if (tosDoc.children.length > 900) {                    // the far past is shredded (and the view kept exactly where it was, margins and all)
    const keep = tosDoc.children[tosDoc.children.length - 900], y = keep.offsetTop;
    while (tosDoc.firstElementChild !== keep) tosDoc.firstElementChild.remove();
    tosDoc.scrollTop -= y - keep.offsetTop;
  }
  const cls = tosDoc.querySelectorAll('.cl'), bottom = tosDoc.scrollTop + tosDoc.clientHeight;
  let k = 0; for (let i = cls.length - 1; i >= 0; i--) if (cls[i].offsetTop + cls[i].offsetHeight <= bottom) { k = +cls[i].dataset.i; break; }   // the last clause in full view
  if (tosAt < 0) tosBase = k;                            // (on opening: what is on the first screen doesn't count)
  const done = k - tosBase;
  if (done <= tosAt) return; tosAt = done;               // (the counter only moves on, clause by clause, and never back)
  const pct = 100 * done / (done + TOS_HALF);            // asymptotically: never quite all of it
  $('#tosProg').textContent = `You have read ${pct < 99 ? pct.toFixed(1) : pct.toFixed(Math.min(6, 1 + Math.ceil(-Math.log10(100 - pct))))}% of the Agreement · ${TOS.clauses} clauses so far.`;
  $('#tosBar').style.width = pct + '%';
}
tosDoc.addEventListener('scroll', () => requestAnimationFrame(tosFill), { passive: true });
const open_ = d => { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); };
const close_ = d => { if (d.close) d.close(); else d.removeAttribute('open'); };
let tosRead = 0;
$('#cTerms').addEventListener('click', () => {
  TOS.reset(); tosDoc.innerHTML = ''; tosDoc.scrollTop = 0; tosAt = -1;
  open_(tos); tosFill(); tosDoc.focus({ preventScroll: true });
});
$('#tosNext').addEventListener('click', () => {           // the next Article
  const h = [...tosDoc.querySelectorAll('h4')].find(x => x.offsetTop > tosDoc.scrollTop + 40);   // (not the heading already at the top)
  if (h) tosDoc.scrollTo({ top: h.offsetTop - 4, behavior: RV.reduced() ? 'auto' : 'smooth' });
  setTimeout(tosFill, 500);
});
$('#tosNo').addEventListener('click', () => { close_(tos); if (!CL.terms) say('mTerms', 'declined. (the $50 can only be claimed under the Agreement.)', 'bad'); });
$('#tosYes').addEventListener('click', () => {
  const pct = parseFloat(($('#tosProg').textContent.match(/[\d.]+/) || ['0'])[0]);
  close_(tos); CL.terms = true;
  say('mTerms', pct > 2 ? `accepted without reading. (you read ${pct}% — that doesn’t count.)` : 'accepted without reading. a wise choice.', 'ok');
  $('#cTerms').textContent = 'Read again…'; $('#robot').hidden = false; capNew(); check();
});
tos.addEventListener('click', e => { if (e.target === tos) close_(tos); });

/* ---------- the claim form ---------- */
const claim = $('#claim'), CL = { name: false, dob: false, skip: false, spin: false, back: false, terms: false, robot: false, off: false };
const say = (id, html, cls) => { const m = $('#' + id); m.innerHTML = html; m.className = 'msg' + (cls ? ' ' + cls : ''); };
const check = () => { $('#claimYes').disabled = !Object.keys(CL).filter(k => k !== 'off').every(k => CL[k]); };
$('#get50').addEventListener('click', () => { open_(claim); });
$('#claimNo').addEventListener('click', () => close_(claim));
claim.addEventListener('click', e => { if (e.target === claim) close_(claim); });
$('#claimYes').addEventListener('click', () => { close_(claim); open_(dlg); });
// the name
$('#cName').addEventListener('input', e => {
  const v = e.target.value.trim(); CL.name = v.length > 1;
  say('mName', !v ? '' : v.length < 2 ? 'a little longer, please.' : /mchogface/i.test(v) ? 'welcome, Hedgehog.' : /^vlad|loktev/i.test(v) ? 'nice try.' : 'noted.', v.length > 1 ? 'ok' : 'bad'); check();
});
// the date of birth, as a Julian date — and, since we're at it, a horoscope (the discount applies whichever way Mercury is going)
const SIGNS = [[120, 'Capricorns'], [219, 'Aquarians'], [321, 'Pisceans'], [420, 'Ariens'], [521, 'Taureans'], [621, 'Geminis'], [723, 'Cancerians'], [823, 'Leos'], [923, 'Virgos'], [1023, 'Librans'], [1122, 'Scorpios'], [1222, 'Sagittarians'], [1232, 'Capricorns']];
const sign = d => { const md = (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); return SIGNS.find(([to]) => md < to)[1]; };
function mercuryRetrograde(ms) {                          // Mercury's geocentric longitude from both orbits (Kepler, ecliptic only): is it running backwards today?
  const lon = t => { const d = t / 864e5 - 10957.5, RAD = Math.PI / 180, M = (174.7948 + 4.09233445 * d) * RAD, e = 0.20563; let E = M; for (let i = 0; i < 6; i++) E = M + e * Math.sin(E);
    const xv = 0.387098 * (Math.cos(E) - e), yv = 0.387098 * Math.sqrt(1 - e * e) * Math.sin(E), L = Math.atan2(yv, xv) + 77.4561 * RAD, r = Math.hypot(xv, yv);
    const Me = (357.5291 + 0.98560028 * d) * RAD, Le = Me + (1.9148 * Math.sin(Me) + 0.02 * Math.sin(2 * Me)) * RAD + 102.9372 * RAD, re = 1.00014 - 0.01671 * Math.cos(Me);
    return Math.atan2(r * Math.sin(L) - re * Math.sin(Le), r * Math.cos(L) - re * Math.cos(Le)); };
  const dl = lon(ms + 432e5) - lon(ms - 432e5); return Math.atan2(Math.sin(dl), Math.cos(dl)) < 0;
}
const JD_EXAMPLE = '2449849.8384606';                    // the example under the field: 12 May 1995, 08:07:23 UTC (a Taurean)
$('#cDob').placeholder = 'e.g. ' + JD_EXAMPLE;
$('#cDob').addEventListener('input', e => {
  const v = e.target.value.trim().replace(',', '.'), m = v.match(/^(\d+)\.(\d+)$/); CL.dob = false;
  if (!v) say('mDob', '');
  else if (!m) say('mDob', 'a Julian date, please — the number of days since noon, 1 January 4713 BC (e.g. 2449849.8384606).', 'bad');
  else if (m[2].length !== 7) say('mDob', `exactly 7 decimals, please (you gave ${m[2].length}): a precision of about 9 milliseconds.`, 'bad');
  else {
    const ms = (parseFloat(v) - 2440587.5) * 864e5, d = new Date(ms);
    if (!isFinite(ms) || ms > Date.now()) say('mDob', 'born in the future? the form does not accept time travellers.', 'bad');
    else if (ms < Date.UTC(1890, 0, 1)) say('mDob', 'congratulations on your longevity, but this grant is only for <i>young</i> researchers.', 'bad');
    else {
      CL.dob = true; const retro = mercuryRetrograde(Date.now());
      say('mDob', `that’s ${d.toUTCString().slice(5, 22)} UTC. lucky day for ${sign(d)}: Mercury is ${retro ? 'retrograde' : 'prograde'}, so you get 20% off! (now it’s $40)`, 'ok');
      $('#prize').textContent = '$40';
    }
  }
  check();
});
// the last throw on the lake (the home page remembers it)
$('#cSkip').addEventListener('input', e => {
  const v = e.target.value.trim(), n = /^\d+$/.test(v) ? +v : NaN, last = RV.store.get('skipLast', null); CL.skip = false;
  if (!v) say('mSkip', '');
  else if (!isFinite(n)) say('mSkip', 'a whole number of skips, please. (half-skips are called plunks.)', 'bad');
  else if (last == null) { CL.skip = true; say('mSkip', 'we have no record of you throwing a stone, so we’ll take your word for it. <a href="${BASE}index.html">throw one?</a>', 'ok'); }
  else if (n !== last) say('mSkip', `our records show ${last}. please be honest.`, 'bad');
  else { CL.skip = true; say('mSkip', last === 0 ? 'zero. honest, at least.' : last > 7 ? 'verified. impressive.' : 'verified.', 'ok'); }
  check();
});
// the spin of Cyg X-1: anything a black hole can have
$('#cSpin').addEventListener('input', e => {
  const v = e.target.value.trim().replace('−', '-').replace(',', '.'), a = /^[-+]?(\d+\.?\d*|\.\d+)$/.test(v) ? parseFloat(v) : NaN; CL.spin = false;
  if (!v) say('mSpin', '');
  else if (!isFinite(a)) say('mSpin', 'a number, please: the dimensionless spin, between −1 and 1.', 'bad');
  else if (Math.abs(a) >= 1) say('mSpin', a === 1 || a === -1 ? 'exactly maximal? the Universe forbids it (and so does this form).' : 'naked singularities are not accepted. |a| must be below 1.', 'bad');
  else { CL.spin = true; say('mSpin', a > 0.998 ? 'beyond the Thorne limit, but we’ll allow it.' : a > 0.9 ? 'bold. some papers agree with you.' : a < 0 ? 'retrograde? an interesting choice.' : 'accepted. (the literature can’t agree either.)', 'ok'); }
  check();
});
// the three numbers on the back of the card: never kept — the moment there are three, they're wiped, with a word of advice
$('#cBack').addEventListener('input', e => {
  const v = e.target.value.replace(/\D/g, '');
  if (v.length >= 3) { e.target.value = ''; CL.back = true; say('mBack', 'checked. never give these to anyone (else). not even if they offer more than $50.', 'ok'); }
  else if (!CL.back) say('mBack', '');
  check();
});

/* ---------- not a robot: a photoelectron track on a gas pixel detector's hexagonal grid (as in IXPE). The electron leaves the
   absorption point (where the Auger electron leaves a small blob) in a direction that carries the X-ray's polarization, scatters
   more and more as it slows, and stops in a dense Bragg peak. Draw its initial direction: within 20° (as an axis) passes. ---------- */
const cap = $('#cap'), cx = cap.getContext('2d'); let TR = null, drag = null, capBusy = false;
function capSize() { const r = cap.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); cap.width = Math.round(r.width * dpr); cap.height = Math.round(r.height * dpr); cx.setTransform(dpr, 0, 0, dpr, 0, 0); return [r.width, r.height]; }
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
function capNew() {
  if (!cap.getBoundingClientRect().width) return;
  const [w, h] = capSize(), L = Math.min(w, h) * 0.66, phi = Math.random() * 2 * Math.PI, pts = [];
  let x = 0, y = 0, a = phi;
  for (let k = 0; k < 40; k++) pts.push([gauss() * 4, gauss() * 4, 1]);                                      // the Auger electron
  for (let s = 0; s < L; s += 1) {
    const u = s / L; a += gauss() * (0.015 + 0.2 * u * u); x += Math.cos(a); y += Math.sin(a);
    const q = 0.35 + 0.12 / Math.max(0.035, 1 - u);                                                           // more charge as it slows down
    for (let k = 0; k < 2; k++) if (Math.random() < Math.min(1, q)) pts.push([x + gauss() * 2.6, y + gauss() * 2.6, q]);   // the charge cloud, spread by diffusion in the gas
    if (u > 0.88) for (let k = 0; k < 4; k++) pts.push([x + gauss() * 4.5, y + gauss() * 4.5, 1]);             // the Bragg peak
  }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const ox = w / 2 - (x0 + x1) / 2, oy = h / 2 - (y0 + y1) / 2, R = Math.max(4, Math.min(w, h) / 30), hw = Math.sqrt(3) * R, cells = new Map();
  for (const [px, py, q] of pts) {                                                                              // charge into hexagonal pixels (pointy-top, axial coordinates)
    const X = px + ox, Y = py + oy, qr = (2 / 3 * Y) / R, qq = (Math.sqrt(3) / 3 * X - Y / 3) / R;
    let rx = Math.round(qq), rz = Math.round(qr), ry = Math.round(-qq - qr); const dx = Math.abs(rx - qq), dz = Math.abs(rz - qr), dy = Math.abs(ry + qq + qr);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dy <= dz) rz = -rx - ry;
    const k = rx + ',' + rz; cells.set(k, (cells.get(k) || 0) + q);
  }
  TR = { phi, sx: ox, sy: oy, w, h, R, hw, cells }; drawCap();
}
function hex(c, x, y, R) { c.beginPath(); for (let i = 0; i < 6; i++) { const t = Math.PI / 180 * (60 * i - 30); c.lineTo(x + R * 0.94 * Math.cos(t), y + R * 0.94 * Math.sin(t)); } c.closePath(); }
const heat = t => `rgb(${Math.round(40 + 215 * Math.min(1, t * 1.6))},${Math.round(20 + 210 * Math.max(0, t - 0.35) / 0.65)},${Math.round(70 + 60 * Math.max(0, 0.4 - t) / 0.4 + 120 * Math.max(0, t - 0.8) / 0.2)})`;
function drawCap(user, truth) {
  const { w, h, R, hw, cells } = TR; cx.clearRect(0, 0, w, h); cx.fillStyle = '#14121c'; cx.fillRect(0, 0, w, h);
  cx.strokeStyle = 'rgba(255,255,255,.05)'; cx.lineWidth = 0.6;                                                 // the empty pixels, faintly
  for (let r = -2; r * 1.5 * R < h + 2 * R; r++) for (let q = -Math.ceil(r / 2) - 2; (q + r / 2) * hw < w + hw; q++) { const X = hw * (q + r / 2), Y = 1.5 * R * r; hex(cx, X, Y, R); cx.stroke(); }
  let max = 0; for (const v of cells.values()) max = Math.max(max, v);
  for (const [k, v] of cells) { const [q, r] = k.split(',').map(Number), X = hw * (q + r / 2), Y = 1.5 * R * r; hex(cx, X, Y, R); cx.fillStyle = heat(Math.sqrt(v / max)); cx.fill(); }
  const arrow = (x0, y0, x1, y1, col, dash) => { cx.save(); cx.strokeStyle = col; cx.fillStyle = col; cx.lineWidth = 2.2; cx.setLineDash(dash || []); cx.beginPath(); cx.moveTo(x0, y0); cx.lineTo(x1, y1); cx.stroke(); cx.setLineDash([]);
    const a = Math.atan2(y1 - y0, x1 - x0); cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x1 - 9 * Math.cos(a - 0.4), y1 - 9 * Math.sin(a - 0.4)); cx.lineTo(x1 - 9 * Math.cos(a + 0.4), y1 - 9 * Math.sin(a + 0.4)); cx.fill(); cx.restore(); };
  if (truth) arrow(TR.sx, TR.sy, TR.sx + Math.cos(TR.phi) * 60, TR.sy + Math.sin(TR.phi) * 60, '#95d5b7', [5, 4]);
  if (user) arrow(user[0], user[1], user[2], user[3], '#E7C4A6');
}
const capXY = e => { const r = cap.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
cap.addEventListener('pointerdown', e => { if (capBusy || CL.robot || !TR) return; drag = capXY(e).concat(capXY(e)); try { cap.setPointerCapture(e.pointerId); } catch (_) {} });
cap.addEventListener('pointermove', e => { if (!drag) return; const [x, y] = capXY(e); drag[2] = x; drag[3] = y; drawCap(drag); });
cap.addEventListener('pointerup', () => {
  if (!drag) return; const d = drag; drag = null;
  if (Math.hypot(d[2] - d[0], d[3] - d[1]) < 15) { drawCap(); say('mCap', 'draw a line, please — drag across the track.', 'bad'); return; }
  const deg = x => ((x * 180 / Math.PI) % 180 + 180) % 180, ua = Math.atan2(d[3] - d[1], d[2] - d[0]);
  const diff = Math.abs(deg(ua) - deg(TR.phi)), err = Math.min(diff, 180 - diff);
  const shown = a => Math.round(((-a * 180 / Math.PI) % 180 + 180) % 180);                                      // as an angle on the sky: counter-clockwise from the right
  if (err < 1) { capBusy = true; drawCap(d, true); say('mCap', `<b>ROBOT DETECTED.</b> off by only ${err.toFixed(2)}° — no human draws like that. free money is for humans only. try again, more sloppily.`, 'bad');   // too good to be human
    setTimeout(() => { capBusy = false; capNew(); }, 3200); }
  else if (err <= 20) { CL.robot = true; drawCap(d, true); say('mCap', err < 3 ? `not a robot — but suspiciously close (off by ${err.toFixed(1)}°). we’re keeping an eye on you.` : `not a robot. (off by ${err.toFixed(0)}° — a robot would have been more precise.)`, 'ok'); check(); }
  else { capBusy = true; drawCap(d, true); say('mCap', `the electron set off at ${shown(TR.phi)}°; you drew ${shown(ua)}°. the track bends after the first few hundred microns — easy to be fooled. another one…`, 'bad');
    setTimeout(() => { capBusy = false; capNew(); }, 2400); }
});
$('#capNew').addEventListener('click', () => { if (!CL.robot) { say('mCap', ''); capNew(); } });
addEventListener('resize', () => { if (!$('#robot').hidden && !CL.robot) capNew(); });

/* ---------- the error at the end of the $50 ---------- */
$('#errOk').addEventListener('click', () => { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); });
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
})();
