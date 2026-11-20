/* Akinlabi Family Budget — turns a typed or spoken note into ledger entries.
   Works fully on the phone: no AI service, no internet needed. */
(function (root) {
  "use strict";

  const EXPENSE = ["Groceries", "Dining out", "Gas (fuel)", "Car maintenance", "Electricity",
    "Water, heat & trash", "Rent & housing", "Phone & internet", "Household items", "Health & pharmacy",
    "Giving & tithe", "Clothing", "Personal care", "Kids & family", "Travel", "Education & work",
    "Subscriptions", "Gifts", "Fees & bank", "Other"];
  const INCOME = ["Stipend & salary", "Side income", "Refund", "Gift received", "Other income"];

  /* Order matters: the first pattern that matches wins. */
  const ITEM_RULES = [
    ["Car maintenance", /motor oil|engine oil|oil change|tyre|tire|brake|mechanic|car wash|wiper|antifreeze|coolant|windshield|car battery|alignment|transmission|spark plug|auto ?parts|car repair|car service/i],
    ["Gas (fuel)", /\bgas\b(?!\s*bill)|gasoline|\bfuel\b|petrol|diesel|fill(ed)? (up|the tank)/i],
    ["Electricity", /electric|power bill|light bill|xcel|otter ?tail|sioux valley|nwe|northwestern energy/i],
    ["Water, heat & trash", /water bill|sewer|trash|garbage|heating|natural gas|gas bill|utility|utilities/i],
    ["Rent & housing", /\brent\b|lease|mortgage|renters insurance|apartment/i],
    ["Phone & internet", /phone bill|cell ?phone|mobile plan|internet|wi-?fi|data plan|verizon|at&t|t-mobile|mint mobile|midco|xfinity|airtime/i],
    ["Subscriptions", /netflix|spotify|subscription|prime membership|amazon prime|youtube premium|hulu|disney\+?|icloud|google one|apple music|chatgpt|claude/i],
    ["Health & pharmacy", /pharmacy|prescription|medicine|medication|tylenol|ibuprofen|vitamin|clinic|doctor|dentist|dental|copay|co-pay|hospital|eye ?glasses|contacts/i],
    ["Giving & tithe", /tithe|offering|church|donation|donate|seed|giving|charity|thanksgiving offering/i],
    ["Dining out", /restaurant|takeout|take-out|pizza|burger|fries|mcdonald|chipotle|subway|starbucks|coffee shop|culver|taco bell|wendy|kfc|popeyes|chick-?fil-?a|domino|pizza ranch|dinner out|lunch out|ate out|eating out/i],
    ["Personal care", /haircut|barber|salon|hair (cream|oil|braid)|braids|lotion|shampoo|conditioner|deodorant|toothpaste|toothbrush|razor|makeup|perfume|body wash/i],
    ["Household items", /detergent|soap|tissue|toilet paper|paper towel|bleach|cleaner|cleaning|dish ?washing|sponge|trash bags?|foil|ziploc|light ?bulb|battery|batteries|bedsheet|pillow|furniture|pot|pan|plates?|cups?|kitchen/i],
    ["Clothing", /cloth|shirt|t-shirt|trouser|pants|jeans|shoe|sneaker|boot|jacket|coat|dress|skirt|sweater|hoodie|socks|underwear|gloves|scarf|hat|beanie/i],
    ["Kids & family", /diaper|wipes|baby|formula|daycare|toy|school supplies/i],
    ["Travel", /flight|airfare|airline|hotel|airbnb|uber|lyft|bus ticket|train ticket|parking|toll/i],
    ["Education & work", /textbook|book|tuition|course|conference|registration|printing|stationery|notebook|laptop|software|membership dues|application fee/i],
    ["Gifts", /gift|present for|birthday card/i],
    ["Fees & bank", /bank fee|atm fee|overdraft|late fee|service charge|wire fee|transfer fee|western union|remit/i],
    ["Groceries", /grocer|rice|beans|egg|milk|bread|butter|cheese|yogh?urt|cereal|oats|flour|sugar|salt|vegetable oil|cooking oil|palm oil|olive oil|\boil\b|meat|chicken|turkey|beef|goat|pork|fish|stock ?fish|crayfish|shrimp|sardine|tuna|vegetable|veggies|spinach|ugu|tomato|onion|pepper|potato|plantain|yam|garri|gari|fufu|semo|semolina|poundo|egusi|ogbono|maggi|seasoning|curry|thyme|indomie|noodle|pasta|spaghetti|fruit|apple|banana|orange|grape|water bottles?|juice|soda|snack|chips|cookies|biscuit|frozen|ice cream|corn|lettuce|carrot|cabbage|garlic|ginger|food/i],
  ];

  const STORES = ["Walmart", "Target", "Costco", "Sam's Club", "Aldi", "Hy-Vee", "Hyvee", "Sunshine Foods", "Sunshine",
    "Lewis Drug", "Lewis", "Menards", "Fleet Farm", "Home Depot", "Lowe's", "Casey's", "Kum & Go", "Cenex", "Shell",
    "Holiday", "BP", "Walgreens", "CVS", "Dollar General", "Dollar Tree", "Amazon", "Best Buy", "Kohl's", "TJ Maxx",
    "Marshalls", "Ross", "Hobby Lobby", "Michaels", "Scheels", "McDonald's", "Chipotle", "Subway", "Starbucks",
    "Culver's", "Taco Bell", "Wendy's", "KFC", "Popeyes", "Chick-fil-A", "Domino's", "Pizza Ranch", "Applebee's",
    "Jiffy Lube", "Valvoline", "Firestone", "AutoZone", "O'Reilly", "Verizon", "T-Mobile", "AT&T", "Midco", "Xcel",
    "Uber", "Lyft", "African store", "Asian market", "Brookings Food Pantry"];
  const STORE_HINT = { "Casey's": "Gas (fuel)", "Kum & Go": "Gas (fuel)", "Cenex": "Gas (fuel)", "Shell": "Gas (fuel)",
    "Holiday": "Gas (fuel)", "BP": "Gas (fuel)", "Walgreens": "Health & pharmacy", "CVS": "Health & pharmacy",
    "Jiffy Lube": "Car maintenance", "Valvoline": "Car maintenance", "Firestone": "Car maintenance",
    "AutoZone": "Car maintenance", "O'Reilly": "Car maintenance", "Verizon": "Phone & internet",
    "T-Mobile": "Phone & internet", "AT&T": "Phone & internet", "Midco": "Phone & internet", "Xcel": "Electricity",
    "Uber": "Travel", "Lyft": "Travel", "Aldi": "Groceries", "Hy-Vee": "Groceries", "Hyvee": "Groceries",
    "Sunshine Foods": "Groceries", "Sunshine": "Groceries", "African store": "Groceries", "Asian market": "Groceries" };
  ["McDonald's", "Chipotle", "Subway", "Starbucks", "Culver's", "Taco Bell", "Wendy's", "KFC", "Popeyes",
    "Chick-fil-A", "Domino's", "Pizza Ranch", "Applebee's"].forEach(s => STORE_HINT[s] = "Dining out");

  const INCOME_RE = /\b(stipend|salary|pay ?check|payroll|got paid|was paid|we were paid|i was paid|income|received|refund|reimburse(d|ment)?|deposit(ed)?|side job|side hustle|gift(ed)? (me|us)|sent (me|us))\b/i;

  /* ---------- spoken numbers -> digits ---------- */
  const ONES = { zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
    eighteen: 18, nineteen: 19 };
  const TENS = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
  const isNumWord = w => w in ONES || w in TENS || w === "hundred" || w === "thousand";

  function runValue(words) {
    const groups = []; let cur = 0, total = 0, last = null, any = false;
    const close = () => { if (any) groups.push(total + cur); total = 0; cur = 0; any = false; };
    for (const w of words) {
      if (w in ONES) { if (last === "ones" || last === "teen" || last === "tens" && ONES[w] >= 10) close(); cur += ONES[w]; last = ONES[w] < 10 ? "ones" : "teen"; any = true; }
      else if (w in TENS) { if (last && last !== "hundred" && last !== "thousand") close(); cur += TENS[w]; last = "tens"; any = true; }
      else if (w === "hundred") { cur = (cur || 1) * 100; last = "hundred"; any = true; }
      else if (w === "thousand") { total += (cur || 1) * 1000; cur = 0; last = "thousand"; any = true; }
    }
    close();
    if (groups.length === 1) return String(groups[0]);
    if (groups.length === 2 && groups[1] < 100 && groups[1] >= 10) return groups[0] + "." + String(groups[1]).padStart(2, "0");
    return null;
  }

  function wordsToNumbers(text) {
    const toks = text.match(/[A-Za-z]+|[^A-Za-z]+/g) || [];
    const out = [];
    for (let i = 0; i < toks.length; i++) {
      const w = toks[i].toLowerCase();
      if (!isNumWord(w) || w === "oh") { out.push(toks[i]); continue; }
      const run = [w]; let j = i + 1, frac = null;
      while (j + 1 < toks.length && /^[ \t-]+$/.test(toks[j])) {
        const n = toks[j + 1].toLowerCase();
        if (isNumWord(n)) { run.push(n); j += 2; continue; }
        if (n === "and" && /hundred|thousand/.test(run[run.length - 1]) && j + 3 < toks.length && isNumWord((toks[j + 3] || "").toLowerCase())) { j += 2; continue; }
        if (n === "point" && frac === null) {
          frac = ""; let k = j + 2;
          while (k + 1 < toks.length && /^\s+$/.test(toks[k]) && (toks[k + 1].toLowerCase() in ONES) && ONES[toks[k + 1].toLowerCase()] < 10) { frac += ONES[toks[k + 1].toLowerCase()]; k += 2; }
          if (frac) j = k; else frac = null;
          break;
        }
        break;
      }
      // "a single 'one'" before a noun is usually a quantity, keep it as a digit anyway (amount logic ignores it)
      const v = runValue(run);
      if (v === null) { out.push(toks[i]); continue; }
      out.push(frac ? v + "." + frac : v);
      i = j - 1;
    }
    return out.join("")
      .replace(/(\d+)\s*dollars?\s*(?:and\s*)?(\d{1,2})\s*cents?/gi, (m, d, c) => d + "." + c.padStart(2, "0"))
      .replace(/(\d+)\s*cents?\b/gi, (m, c) => "0." + c.padStart(2, "0"));
  }

  /* ---------- dates ---------- */
  const pad = n => String(n).padStart(2, "0");
  const ymd = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  function findDate(t, now) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const s = t.toLowerCase();
    if (/day before yesterday/.test(s)) { d.setDate(d.getDate() - 2); return ymd(d); }
    if (/yesterday|last night/.test(s)) { d.setDate(d.getDate() - 1); return ymd(d); }
    let m = s.match(/\b(last|this past|on|this)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
    if (m) {
      const want = DAYS.indexOf(m[2]); let back = (d.getDay() - want + 7) % 7;
      if (m[1] === "last" && back === 0) back = 7;
      d.setDate(d.getDate() - back); return ymd(d);
    }
    m = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(st|nd|rd|th)?\b/);
    if (!m) { const m2 = s.match(/\b(\d{1,2})(st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/); if (m2) m = [m2[0], m2[3], m2[1]]; }
    if (m) {
      const mo = MONTHS.indexOf(m[1].slice(0, 3)), day = +m[2];
      if (mo >= 0 && day >= 1 && day <= 31) {
        let x = new Date(now.getFullYear(), mo, day);
        if (x > now) x = new Date(now.getFullYear() - 1, mo, day);
        return ymd(x);
      }
    }
    m = s.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (m) {
      const y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : now.getFullYear();
      const x = new Date(y, +m[1] - 1, +m[2]); if (!isNaN(x)) return ymd(x);
    }
    return ymd(d);
  }

  /* ---------- helpers ---------- */
  const money = v => { const n = parseFloat(String(v).replace(/[$,]/g, "")); return isFinite(n) ? Math.round(n * 100) / 100 : null; };
  const AMT = String.raw`\$?\s?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)`;
  function categorize(text) { for (const [c, re] of ITEM_RULES) if (re.test(text)) return c; return null; }
  function findStore(t) {
    const low = t.toLowerCase();
    let best = null;
    for (const s of STORES) {
      const i = low.indexOf(s.toLowerCase());
      if (i >= 0 && /^[^a-z]?$/.test(low[i - 1] || "") && (!best || s.length > best.length)) best = s;
    }
    if (best) return best === "Hyvee" ? "Hy-Vee" : best;
    const m = t.match(/\b(?:at|from|in)\s+(?:the\s+)?([A-Z][\w'&]*(?:\s+[A-Z][\w'&]*){0,2})/);
    if (m && !/^(I|We|My|The|Total|Today|Yesterday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/.test(m[1])) return m[1];
    return "";
  }
  function title(s) { s = s.trim(); return s ? s[0].toUpperCase() + s.slice(1) : s; }

  /* ---------- main ---------- */
  function parse(text, now) {
    now = now || new Date();
    const raw = String(text || "").trim();
    if (!raw) return [];
    const t = wordsToNumbers(raw);
    const date = findDate(t, now);
    const store = findStore(t);
    const tn = t.replace(/\b(?:on\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?\b/gi, " ")
      .replace(/\b(?:on\s+)?(?:the\s+)?\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/gi, " ")
      .replace(/\b(?:on\s+)?\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, " ");
    const income = INCOME_RE.test(t) && !/\b(bought|buy|paid for|spent)\b/i.test(t);

    const totalM = tn.match(new RegExp(String.raw`\b(?:total(?:\s+(?:is|was|of|came to))?|altogether|all together|in total|came to|comes to|cost me|it cost|everything (?:was|cost)|sum of)\b[^\d$]{0,12}` + AMT, "i"));
    let total = totalM ? money(totalM[1]) : null;

    if (income) {
      const nums = [...tn.matchAll(new RegExp(AMT, "g"))].map(m => money(m[1])).filter(n => n != null && n > 0);
      const amount = total != null ? total : nums.length ? Math.max(...nums) : null;
      let category = /side|freelance|gig|hustle/i.test(t) ? "Side income"
        : /refund|reimburse/i.test(t) ? "Refund" : /gift|sent (me|us)/i.test(t) ? "Gift received"
        : /stipend|salary|pay ?check|payroll|paid/i.test(t) ? "Stipend & salary" : "Other income";
      return [{ type: "income", date, store, category, amount, items: [], note: raw.slice(0, 200) }];
    }

    // isolate the list of things bought
    let seg = tn.replace(/\b(?:and\s+)?(?:the\s+)?(?:total|altogether|all together|in total|came to|comes to|it cost)\b.*$/i, " ");
    const verb = seg.match(/\b(?:bought|buy|buying|got|purchased|picked up|paid for|spent \S+ on|shopped for|ordered)\b/i);
    if (verb) seg = seg.slice(verb.index + verb[0].length);
    seg = seg.replace(/\b(?:today|yesterday|this morning|this evening|tonight|last night|day before yesterday)\b/gi, " ")
      .replace(/\b(?:on|last|this past|this)\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, " ")
      .replace(/\b(?:i|we|my wife|my husband|so|um+|uh+|okay|ok|please|record|add|log|that|went to|go to|just|also)\b/gi, " ");
    if (store) seg = seg.replace(new RegExp(String.raw`\b(?:at|from|in|to)?\s*(?:the\s+)?` + store.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + String.raw`(?:'s)?\b`, "ig"), " ");

    const parts = seg.split(/,|;|\band\b|\bplus\b|\n/i).map(p => p.replace(/\s+/g, " ").trim()).filter(Boolean);
    const items = [];
    for (let p of parts) {
      let amount = null;
      const pm = p.match(new RegExp(String.raw`(?:\bfor\b|\bat\b|\bcost\b|=|-|:)?\s*` + AMT + String.raw`\s*(?:dollars?|bucks|usd)?\s*$`, "i"));
      if (pm && !/^\d+(\.\d+)?$/.test(p.replace(/\$/g, "").trim()) || pm && parts.length === 1) { amount = money(pm[1]); p = p.slice(0, pm.index).trim(); }
      p = p.replace(/^(?:some|a|an|the|of|for|with|paid|spent|filled|on)\s+/i, "").replace(/\s+(?:for|at|of)$/i, "").trim();
      if (!p && amount == null) continue;
      if (!p && amount != null) { items.push({ name: "", amount }); continue; }
      if (p.length > 60 || /^(?:it|was|is|were|the|a|an|to|for|of|on|at|with|my|our|stuff|things|some)$/i.test(p)) continue;
      items.push({ name: title(p) || "Item", amount });
    }

    // a price only after the last item of a list is the total for the whole list
    for (let k = items.length - 1; k >= 0; k--) if (!items[k].name) { if (total == null) total = items[k].amount; items.splice(k, 1); }
    if (items.length >= 2 && items.filter(i => i.amount != null).length === 1 && items[items.length - 1].amount != null) {
      if (total == null) total = items[items.length - 1].amount;
      items[items.length - 1].amount = null;
    }
    // a lone number with no items list = the amount
    if (total == null && !items.some(i => i.amount != null)) {
      const nums = [...tn.matchAll(new RegExp(AMT, "g"))].map(m => money(m[1])).filter(n => n != null && n > 0);
      if (nums.length) total = /\$|dollar|bucks|\.\d\d\b/.test(t) ? nums[nums.length - 1] : Math.max(...nums);
    }

    const hint = STORE_HINT[store] || null;
    const textCat = categorize(t);
    items.forEach(i => { i.category = categorize(i.name) || null; });
    const priced = items.filter(i => i.amount != null);

    // Split by category when every item has a price and categories differ
    if (priced.length >= 2 && priced.length === items.length) {
      const groups = {};
      for (const i of items) { const c = i.category || hint || textCat || "Other"; (groups[c] = groups[c] || []).push(i); }
      const cats = Object.keys(groups);
      if (cats.length > 1) {
        const out = cats.map(c => ({ type: "expense", date, store, category: c,
          amount: Math.round(groups[c].reduce((a, i) => a + i.amount, 0) * 100) / 100,
          items: groups[c].map(i => ({ name: i.name, amount: i.amount })), note: "" }));
        const sum = out.reduce((a, e) => a + e.amount, 0);
        if (total != null && total > sum + 0.004) {
          const big = out.reduce((a, b) => b.amount > a.amount ? b : a);
          big.amount = Math.round((big.amount + total - sum) * 100) / 100; big.note = "Includes tax/other " + (total - sum).toFixed(2);
        }
        return out;
      }
    }

    const counts = {};
    items.forEach(i => { if (i.category) counts[i.category] = (counts[i.category] || 0) + 1; });
    const majority = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    const category = majority || hint || textCat || (store ? "Groceries" : "Other");
    const sumItems = priced.length ? Math.round(priced.reduce((a, i) => a + i.amount, 0) * 100) / 100 : null;
    const amount = total != null ? total : sumItems;
    const cleanItems = items.filter(i => !(items.length === 1 && i.amount == null && amount != null && i.name === "Item"))
      .map(i => ({ name: i.name, amount: i.amount }));
    return [{ type: "expense", date, store, category, amount, items: cleanItems, note: "" }];
  }

  const api = { parse, wordsToNumbers, categorize, findDate, EXPENSE, INCOME };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.BudgetParse = api;
})(this);
