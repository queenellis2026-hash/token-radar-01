// Token Launch Radar's dashboard. It reads window.RADAR (data.js, written beside this page by
// main.ts from the same board board.json carries) and renders the ranked board, its filters, and
// a per-protocol detail view that shows the model's whole arithmetic. No network: every byte it
// shows is in data.js. The detail view recomputes the row's implied value from its printed
// factors, so the page and the board are visibly the same arithmetic.
//
// The method, in plain language (the same text the header below states for readers):
//   Who gets a row — the eligibility screen. A protocol the snapshot records with no token:
//   no CoinGecko id, no symbol and no market cap, all three token fields null. Out go products
//   of tokens that already trade: the wrapped, staked and bridged categories and the exchange
//   (CEX) category, names carrying a wrapped or staked product word, names that begin with an
//   exchange's name, names ending in a version marker (a re-release of a protocol that already
//   trades), and any second listing of a name that already trades. The house watchlist is
//   carried in whole, before the screen is applied to the rest.
//   Where the multiple comes from — the peer construction. Among tokenized protocols, take each
//   category's median market-cap/TVL multiple, winsorized at the 1st-99th percentile, and shrink
//   it toward the global median in proportion to how few tokenized peers the category has. A
//   category with two or fewer tokenized peers is thin: its shrunk multiple is held to 1.5x the
//   global median (the thin-category cap), and a category with fewer than three peers shows no
//   dollar peer band — too few peers to draw one honestly. On top of everything, no row's
//   effective multiple runs past the 90th percentile of all tokenized peer multiples (the p90
//   ceiling). A row either guard holds down says so on its page.
//   The factors. The category multiple is adjusted by exactly three: 7-day TVL momentum
//   (clamped, over 200), chain breadth (+5% per chain, to six), and seasoning (younger than
//   90 days down, older than two years up). Implied value = TVL x the adjusted, guarded
//   multiple, rounded to three significant figures.
(function () {
  'use strict';

  var DATA = window.RADAR;
  var app = document.getElementById('board');
  if (!DATA || !app) return;

  var state = { q: '', cat: 'all', chain: 'all', min: 0, wl: false, sort: 'implied', dir: -1, p: null };

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var a = Math.abs(n);
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtMult(n) { return 'x' + Number(n).toFixed(3); }
  // The model's own rounding, restated: three significant figures.
  function roundSig3(x) {
    if (!(x > 0)) return 0;
    var p = Math.pow(10, Math.floor(Math.log10(x)) - 2);
    return Math.round(x / p) * p;
  }
  // The model's arithmetic, restated: the effective multiple is the category multiple times the
  // three factors, held to the population's multiple ceiling before TVL is applied.
  function impliedOf(r) { return roundSig3(r.tvl_usd * Math.min(r.multiple * r.f_mom * r.f_chain * r.f_age, DATA.multiple_ceiling)); }

  // ------------------------------------------------------------ state in the hash (offline)
  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var q = new URLSearchParams(hash);
    if (q.get('p')) state.p = q.get('p');
    if (q.get('q')) state.q = q.get('q');
    if (q.get('cat')) state.cat = q.get('cat');
    if (q.get('chain')) state.chain = q.get('chain');
    if (q.get('min')) state.min = Number(q.get('min')) || 0;
    if (q.get('wl') === '1') state.wl = true;
    if (q.get('sort')) state.sort = q.get('sort');
  }
  function writeHash() {
    var q = new URLSearchParams();
    if (state.p) q.set('p', state.p);
    if (state.q) q.set('q', state.q);
    if (state.cat !== 'all') q.set('cat', state.cat);
    if (state.chain !== 'all') q.set('chain', state.chain);
    if (state.min) q.set('min', String(state.min));
    if (state.wl) q.set('wl', '1');
    if (state.sort !== 'implied') q.set('sort', state.sort);
    var s = q.toString();
    window.history.replaceState(null, '', s ? '#' + s : window.location.pathname + window.location.search);
  }

  // ------------------------------------------------------------ filtering and sorting
  function visible() {
    var needle = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.wl && r.provenance !== 'Watchlist') return false;
      if (state.cat !== 'all') {
        var c = r.category === null ? '__none' : r.category;
        if (c !== state.cat) return false;
      }
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (state.min && r.tvl_usd < state.min) return false;
      if (needle) {
        var hay = (r.name + ' ' + r.slug + ' ' + (r.category || '') + ' ' + r.chains.join(' ')).toLowerCase();
        if (hay.indexOf(needle) < 0) return false;
      }
      return true;
    });
  }
  function sorted(list) {
    var key = state.sort, dir = state.dir;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'rank') { av = a.rank; bv = b.rank; }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return a.rank - b.rank;
    });
  }

  // ------------------------------------------------------------ shared chrome
  function headerHTML() {
    return '<div class="top"><div class="brand"><span class="mark"></span>Token Launch Radar</div>' +
      '<div class="top-meta"><span>Snapshot <b>' + esc(DATA.as_of) + '</b></span>' +
      '<span><b>' + DATA.protocol_count + '</b> protocols tracked</span>' +
      '<span><b>' + DATA.tokenless_count + '</b> record no token</span>' +
      '<span><b>' + DATA.watchlist_size + '</b> on the house watchlist</span>' +
      '<span>model <b>' + esc(DATA.model_version) + '</b></span></div></div>' +
      '<p class="method"><b>Implied value = TVL x peer market-cap/TVL multiple for the category</b>, adjusted for ' +
      '7-day momentum, chain breadth, and seasoning. Who gets a row: a protocol the snapshot records with no ' +
      'token — no CoinGecko id, no symbol, no market cap — that is not a wrapped, staked or bridged product of a ' +
      'token that already trades, not an exchange house product, not a versioned re-release, and not a second ' +
      'listing of a name that already trades; the house watchlist is carried in whole. The multiple is the ' +
      'median of what the market pays for tokenized protocols in the same category (winsorized at the 1st-99th ' +
      'percentile, shrunk toward the global median x' + DATA.global_median.toFixed(3) + ' when a category has ' +
      'few tokenized peers). A category with ' + DATA.model.thin_peer_max + ' or fewer tokenized peers is thin: ' +
      'its multiple is held to ' + DATA.model.thin_cap_factor + 'x the global median, because one or two peers ' +
      'cannot carry a category\'s premium. And no row\'s effective multiple runs past x' +
      DATA.multiple_ceiling.toFixed(3) + ', the 90th percentile of all tokenized peer multiples; a row either ' +
      'guard holds down says so on its page. Every number shows its work.</p>' +
      '<div class="facts">' +
      '<div class="fact"><span>Watchlist covered</span><b>' + DATA.watchlist_size + ' / ' + DATA.watchlist_size + '</b></div>' +
      '<div class="fact"><span>Board rows</span><b>' + DATA.board_size + '</b></div>' +
      '<div class="fact"><span>Global peer median</span><b>x' + DATA.global_median.toFixed(3) + '</b></div>' +
      '<div class="fact"><span>Peer band (global)</span><b>x' + DATA.global_q25.toFixed(2) + '-x' + DATA.global_q75.toFixed(2) + '</b></div>' +
      '<div class="fact"><span>Multiple ceiling (p90)</span><b>x' + DATA.multiple_ceiling.toFixed(3) + '</b></div>' +
      '</div>';
  }
  function footHTML() {
    return '<p class="foot">A protocol on this board records no token in the snapshot of ' + esc(DATA.as_of) +
      '; that is DefiLlama\'s record, not proof — say a protocol records no token, never that it has none. ' +
      'Implied value is this entry\'s own model claim about what a launch would be worth if the record stayed ' +
      'as it is; it is not a prediction that a token will be issued. Source: ' + esc(DATA.source) + '.</p>';
  }

  // ------------------------------------------------------------ board view
  function controlsHTML(shown) {
    var cats = Array.from(new Set(DATA.rows.map(function (r) { return r.category === null ? '__none' : r.category; }))).sort();
    var chainCount = {};
    DATA.rows.forEach(function (r) { r.chains.forEach(function (c) { chainCount[c] = (chainCount[c] || 0) + 1; }); });
    var chains = Object.keys(chainCount).sort(function (a, b) { return chainCount[b] - chainCount[a] || (a < b ? -1 : 1); });
    var catOpts = '<option value="all">All categories</option>' + cats.map(function (c) {
      return '<option value="' + esc(c) + '"' + (state.cat === c ? ' selected' : '') + '>' + esc(c === '__none' ? 'Uncategorized' : c) + '</option>';
    }).join('');
    var chainOpts = '<option value="all">All chains</option>' + chains.map(function (c) {
      return '<option value="' + esc(c) + '"' + (state.chain === c ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('');
    var minOpts = [[0, 'Any TVL ($5M+)'], [25000000, '$25M and up'], [50000000, '$50M and up']].map(function (m) {
      return '<option value="' + m[0] + '"' + (state.min === m[0] ? ' selected' : '') + '>' + m[1] + '</option>';
    }).join('');
    return '<div class="controls">' +
      '<div class="field"><label for="q">Search</label><input type="search" id="q" placeholder="Name, category or chain" value="' + esc(state.q) + '"></div>' +
      '<div class="field"><label for="cat">Category</label><select id="cat">' + catOpts + '</select></div>' +
      '<div class="field"><label for="chain">Chain</label><select id="chain">' + chainOpts + '</select></div>' +
      '<div class="field"><label for="min">Minimum TVL</label><select id="min">' + minOpts + '</select></div>' +
      '<div class="field check"><input type="checkbox" id="wl"' + (state.wl ? ' checked' : '') + '><label for="wl">Watchlist only</label></div>' +
      '<span class="count"><b>' + shown + '</b> of ' + DATA.board_size + ' shown</span></div>';
  }
  function sortTh(key, label, cls) {
    var arrow = state.sort === key ? ' <span class="dir">' + (state.dir < 0 ? 'v' : '^') + '</span>' : '';
    return '<th class="' + (cls || '') + '" scope="col"><button type="button" data-sort="' + key + '">' + label + arrow + '</button></th>';
  }
  // Provenance and TVL tier are separate facts: the tag says Watchlist or Discovery, and a row
  // under the house floor carries its own pill, whatever its provenance.
  function provLabel(r) { return r.provenance === 'Watchlist' ? 'Watchlist' : 'Discovery'; }
  function tagHTML(r) {
    var tag = r.provenance === 'Watchlist' ? '<span class="tag">Watchlist</span>' : '<span class="tag off">Discovery</span>';
    var pill = r.tvl_usd < DATA.floor_usd ? '<span class="tag below">TVL &lt; ' + fmtUsd(DATA.floor_usd) + '</span>' : '';
    return tag + pill;
  }
  // The row's chains by name: the first three, then a +N for the rest it runs on.
  function chainsHTML(r) {
    if (!r.chains.length) return '<td class="chains">none named</td>';
    var shown = r.chains.slice(0, 3).map(esc).join(', ');
    var more = r.chains.length - 3;
    return '<td class="chains">' + shown + (more > 0 ? ' <span class="more">+' + more + '</span>' : '') + '</td>';
  }
  function boardHTML() {
    var list = sorted(visible());
    var rows = list.map(function (r) {
      var g = r.change_7d === null ? '<td class="n">n/a</td>'
        : '<td class="n ' + (r.change_7d >= 0 ? 'pos' : 'neg') + '">' + fmtPct(r.change_7d) + '</td>';
      return '<tr data-slug="' + esc(r.slug) + '"' + (r.rank <= 3 ? ' class="top3"' : '') + '>' +
        '<td class="rank">' + r.rank + '</td>' +
        '<td><span class="name"><b>' + esc(r.name) + '</b></span>' +
        '<span class="chip">' + esc(r.category || 'Uncategorized') + '</span>' + tagHTML(r) + '</td>' +
        chainsHTML(r) +
        '<td class="n">' + fmtUsd(r.tvl_usd) + '</td>' + g +
        '<td class="iv">' + fmtUsd(r.implied_value_usd) + '</td>' +
        '<td class="ratio">' + (r.implied_value_usd / r.tvl_usd).toFixed(2) + 'x</td></tr>';
    }).join('');
    var table = list.length === 0
      ? '<div class="panel"><div class="empty">No protocol matches that filter. Clear the search or pick another category, chain or floor.</div></div>'
      : '<div class="panel"><table><caption>Pre-token protocols ranked by implied value. Select a row for its arithmetic and farm plan.</caption><thead><tr>' +
        sortTh('rank', 'Rank') + '<th scope="col">Protocol</th><th scope="col">Chains</th>' +
        sortTh('tvl', 'TVL', 'n') + sortTh('growth', '7d %', 'n') + sortTh('implied', 'Implied value', 'n') +
        '<th class="n" scope="col">IV / TVL</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    return '<div class="shell">' + headerHTML() + controlsHTML(list.length) + table + footHTML() + '</div>';
  }

  // ------------------------------------------------------------ detail view
  function detailHTML(r) {
    var check = impliedOf(r);
    var agree = check === r.implied_value_usd;
    var ageText = r.age_days === null ? 'listing date unreported' : r.age_days + ' days tracked';
    var factorRows =
      '<tr><td class="k">TVL (snapshot)</td><td class="v">' + fmtUsd(r.tvl_usd) + '</td></tr>' +
      '<tr><td class="k">Category multiple R — ' + esc(r.category || 'no category') + ': peer median ' + fmtMult(r.peer_median) +
      ' over ' + r.peer_count + ' tokenized peer' + (r.peer_count === 1 ? '' : 's') + ', shrunk toward the global ' + fmtMult(DATA.global_median) + '</td><td class="v">' + fmtMult(r.multiple) + '</td></tr>' +
      (r.thin_capped
        ? '<tr><td class="k">Thin-category cap — ' + esc(r.category || 'this category') + ' has only ' + r.peer_count +
          ' tokenized peer' + (r.peer_count === 1 ? '' : 's') + ', so the shrunk multiple ' + fmtMult(r.multiple_pre_thin) +
          ' is held to ' + DATA.model.thin_cap_factor + 'x the global median</td><td class="v">' + fmtMult(r.multiple) + '</td></tr>'
        : '') +
      '<tr><td class="k">Momentum factor — 7d TVL change ' + fmtPct(r.change_7d) + ', clamped to [-30, +50] / 200</td><td class="v">' + fmtMult(r.f_mom) + '</td></tr>' +
      '<tr><td class="k">Breadth factor — ' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + ', +5% each to six</td><td class="v">' + fmtMult(r.f_chain) + '</td></tr>' +
      '<tr><td class="k">Seasoning factor — listed ' + esc(r.listed_at || 'unreported') + ', ' + ageText + '</td><td class="v">' + fmtMult(r.f_age) + '</td></tr>' +
      (r.multiple_capped
        ? '<tr><td class="k">Multiple ceiling — effective multiple ' + fmtMult(r.multiple_uncapped) + ' held to ' +
          fmtMult(r.multiple_ceiling) + ', the 90th percentile of all tokenized peer multiples</td><td class="v">' + fmtMult(r.multiple_effective) + '</td></tr>'
        : '') +
      '<tr class="total"><td>Implied value (3 significant figures)</td><td class="v">' + fmtUsd(r.implied_value_usd) + '</td></tr>';
    var facts =
      '<div><dt>Slug</dt><dd>' + esc(r.slug) + '</dd></div>' +
      '<div><dt>Category</dt><dd>' + esc(r.category || 'none named') + '</dd></div>' +
      '<div><dt>Chains</dt><dd>' + esc(r.chains.join(', ') || 'none named') + '</dd></div>' +
      '<div><dt>Listed</dt><dd>' + esc(r.listed_at || 'unreported') + '</dd></div>' +
      '<div><dt>TVL</dt><dd>' + fmtUsd(r.tvl_usd) + '</dd></div>' +
      '<div><dt>7d change</dt><dd>' + fmtPct(r.change_7d) + '</dd></div>' +
      '<div><dt>Token record</dt><dd>records no token</dd></div>' +
      '<div><dt>Provenance</dt><dd>' + provLabel(r) + (r.tvl_usd < DATA.floor_usd ? ' · TVL under the house floor of ' + fmtUsd(DATA.floor_usd) : '') + '</dd></div>' +
      '<div><dt>Rank</dt><dd>' + r.rank + ' of ' + DATA.board_size + '</dd></div>';
    var bandTail = r.multiple_capped
      ? 'This row\'s effective multiple is capped at the global 90th-percentile peer multiple ' + fmtMult(r.multiple_ceiling) +
        ', so the point estimate is held below the category\'s own band rather than priced off its ' +
        (r.peer_count === 1 ? 'single tokenized peer' : r.peer_count + ' tokenized peers') + ' alone.'
      : 'The point estimate sits inside the spread its peers actually trade at.';
    // A sparse category (fewer than three tokenized peers) shows no dollar band: a band drawn
    // from one peer reads as evidence it is not. The note names what little evidence there is.
    var bandHTML;
    if (r.sparse) {
      var peerText = '';
      if (r.peer_count === 1 && r.sparse_peers && r.sparse_peers.length === 1) {
        peerText = ': ' + esc(r.sparse_peers[0].name) + ', at a raw market-cap/TVL of x' + r.sparse_peers[0].ratio.toFixed(1);
      } else if (r.peer_count === 2 && r.sparse_peers && r.sparse_peers.length === 2) {
        peerText = ': ' + esc(r.sparse_peers[0].name) + ' (x' + r.sparse_peers[0].ratio.toFixed(1) + ') and ' +
          esc(r.sparse_peers[1].name) + ' (x' + r.sparse_peers[1].ratio.toFixed(1) + ')';
      }
      bandHTML = '<p class="band">Sparse category: <b>' + esc(r.category || 'no category') + '</b> has ' +
        (r.peer_count === 0 ? 'no tokenized peers' : 'only ' + r.peer_count + ' tokenized peer' + (r.peer_count === 1 ? '' : 's')) +
        peerText + ' — too few to draw a peer band from, so none is shown. The model anchors this row to the ' +
        'global median ' + fmtMult(DATA.global_median) + (r.thin_capped ? ' and holds its category multiple to the thin-category cap' : '') + '.</p>';
    } else {
      bandHTML = '<p class="band">Peer band: <b>' + fmtUsd(r.band_low_usd) + ' - ' + fmtUsd(r.band_high_usd) + '</b> — the middle half of the ' +
        esc(r.category || 'global') + ' peer multiples, shrunk the same way, applied to this protocol\'s TVL. ' + bandTail + '</p>';
    }
    var steps = r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    return '<div class="shell"><a class="back" href="#" id="back">&larr; Board</a>' +
      '<div class="detail-head"><h1>' + esc(r.name) + '</h1><span class="chip">' + esc(r.category || 'Uncategorized') + '</span>' + tagHTML(r) +
      '<span class="iv-big">' + fmtUsd(r.implied_value_usd) + '</span></div>' +
      bandHTML +
      '<div class="cols"><div class="card"><h2>The arithmetic</h2><table class="factors">' + factorRows + '</table>' +
      '<p class="check-note">This page recomputes the row from the factors above: <b>' + fmtUsd(check) + '</b>' +
      (agree ? ' — the same number board.json carries.' : ' — which differs from the board: the data would be stale.') + '</p></div>' +
      '<div class="card"><h2>Snapshot facts</h2><dl class="facts-list">' + facts + '</dl></div></div>' +
      '<div class="card" style="margin-top:16px"><h2>Farm plan</h2><ol class="steps">' + steps + '</ol></div>' +
      footHTML() + '</div>';
  }

  // ------------------------------------------------------------ render and wire
  function render() {
    var row = state.p ? DATA.rows.filter(function (r) { return r.slug === state.p; })[0] : undefined;
    if (state.p && !row) state.p = null;
    app.innerHTML = row ? detailHTML(row) : boardHTML();
    app.setAttribute('aria-busy', 'false');
    wire(row);
    window.scrollTo(0, 0);
  }
  function wire(row) {
    if (row) {
      var back = document.getElementById('back');
      back.addEventListener('click', function (e) { e.preventDefault(); state.p = null; writeHash(); render(); });
      return;
    }
    var q = document.getElementById('q');
    q.addEventListener('input', function () { state.q = q.value; writeHash(); render(); restoreFocus('q'); });
    var cat = document.getElementById('cat');
    cat.addEventListener('change', function () { state.cat = cat.value; writeHash(); render(); });
    var chain = document.getElementById('chain');
    chain.addEventListener('change', function () { state.chain = chain.value; writeHash(); render(); });
    var min = document.getElementById('min');
    min.addEventListener('change', function () { state.min = Number(min.value) || 0; writeHash(); render(); });
    var wl = document.getElementById('wl');
    wl.addEventListener('change', function () { state.wl = wl.checked; writeHash(); render(); });
    Array.prototype.forEach.call(app.querySelectorAll('[data-sort]'), function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-sort');
        if (state.sort === key) state.dir = -state.dir;
        else { state.sort = key; state.dir = key === 'rank' ? 1 : -1; }
        writeHash(); render();
      });
    });
    Array.prototype.forEach.call(app.querySelectorAll('tr[data-slug]'), function (tr) {
      tr.addEventListener('click', function () { state.p = tr.getAttribute('data-slug'); writeHash(); render(); });
    });
  }
  function restoreFocus(id) {
    var n = document.getElementById(id);
    if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
  }

  readHash();
  render();
})();
