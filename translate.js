// 🌐 Google Translate button, as on the Champions pages: the widget sits at the
// bottom right; on narrow screens it folds into a 🌐 button. Include once per page:
//   <script src="translate.js"></script>
//
// Once a page is translated, Google adds its own bar at the top of the page, which
// covered the menu on phones (Safari). That bar is hidden here: translating keeps
// working, and the "↺ Original" button next to the widget takes its place to switch
// back to English.
(function () {
  if (window.__cccTranslate) return;
  window.__cccTranslate = true;

  var css = [
    'body { top: 0 !important; }',
    'html, body { margin-top: 0 !important; }',
    'body.translated-ltr, body.translated-rtl { margin-top: 0 !important; top: 0 !important; }',
    // Google's top bar: the old class names, and the current one (an iframe in a .skiptranslate
    // block straight inside <body>; the language menu is left alone)
    '.goog-te-banner-frame, iframe.goog-te-banner-frame, .goog-te-banner-frame.skiptranslate { display: none !important; visibility: hidden !important; height: 0 !important; }',
    'iframe.VIpgJd-ZVi9od-ORHb-OEVmcd, body > .skiptranslate:has(> iframe.VIpgJd-ZVi9od-ORHb-OEVmcd) { display: none !important; visibility: hidden !important; height: 0 !important; }',
    '#goog-gt-tt, .goog-te-balloon-frame, .VIpgJd-ZVi9od-aZ2wEe-wOHMyf { display: none !important; visibility: hidden !important; }',
    '.goog-text-highlight { background: transparent !important; box-shadow: none !important; }',
    '#cccTranslateBar { position: fixed; bottom: 8px; right: 8px; z-index: 7000; display: flex; align-items: center; gap: 6px; }',
    '#translateToggleBtn, #translateResetBtn { display: none; align-items: center; justify-content: center;'
      + ' height: 38px; border: 1px solid var(--border, #9fdcf0); border-radius: 8px; background: var(--bg-card, #fff);'
      + ' color: var(--primary, #1fc1e6); cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,0.15); }',
    '#translateToggleBtn { width: 38px; font-size: 18px; }',
    '#translateResetBtn { padding: 0 10px; font-size: 13px; font-weight: 600; white-space: nowrap; }',
    'html.translated-ltr #translateResetBtn, html.translated-rtl #translateResetBtn { display: inline-flex; }',
    '@media (max-width: 800px) {',
    '  #google_translate_element { max-width: 0; overflow: hidden; opacity: 0; pointer-events: none; transition: max-width 0.2s ease, opacity 0.2s ease; }',
    '  body.translate-open #google_translate_element { max-width: 260px; opacity: 1; pointer-events: auto; }',
    '  #translateToggleBtn { display: inline-flex !important; }',
    '}',
  ].join('\n');

  window.googleTranslateElementInit = function () {
    new google.translate.TranslateElement({ pageLanguage: 'en', layout: google.translate.TranslateElement.InlineLayout.SIMPLE }, 'google_translate_element');
  };

  // Back to English: Google keeps the chosen language in the "googtrans" cookie
  // (on this address and on its parent domain); remove it and reload.
  function showOriginal() {
    var expired = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    var host = location.hostname;
    var parts = host.split('.');
    document.cookie = expired;
    document.cookie = expired + '; domain=' + host;
    document.cookie = expired + '; domain=.' + host;
    if (parts.length > 2) document.cookie = expired + '; domain=.' + parts.slice(-2).join('.');
    location.reload();
  }

  function setUp() {
    if (document.getElementById('google_translate_element')) return;
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var bar = document.createElement('div');
    bar.id = 'cccTranslateBar';
    bar.className = 'notranslate';
    var reset = document.createElement('button');
    reset.id = 'translateResetBtn';
    reset.type = 'button';
    reset.title = 'Show the page in English again';
    reset.textContent = '↺ Original';
    var widget = document.createElement('div');
    widget.id = 'google_translate_element';
    var btn = document.createElement('button');
    btn.id = 'translateToggleBtn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Toggle translation');
    btn.textContent = '🌐';
    bar.appendChild(reset);
    bar.appendChild(widget);
    bar.appendChild(btn);
    document.body.appendChild(bar);

    reset.addEventListener('click', showOriginal);
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      document.body.classList.toggle('translate-open');
    });
    document.addEventListener('click', function (e) {
      if (!document.body.classList.contains('translate-open')) return;
      if (widget.contains(e.target) || btn.contains(e.target)) return;
      document.body.classList.remove('translate-open');
    });

    var s = document.createElement('script');
    s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    document.body.appendChild(s);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setUp);
  else setUp();
})();
