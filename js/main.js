/* Main application logic */
(function() {
  'use strict';

  // =========================================================================
  // Theme Toggle
  // =========================================================================

  var STORAGE_KEY = 'theme';
  var LIGHT = 'light';
  var DARK = 'dark';

  function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') || LIGHT;
  }

  function toggleTheme() {
    var current = getCurrentTheme();
    var next = current === LIGHT ? DARK : LIGHT;
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {}
    updateThemeButtons(next);
  }

  function updateThemeButtons(theme) {
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    buttons.forEach(function(btn) {
      var icon = btn.querySelector('.theme-icon');
      if (!icon) return;
      if (theme === DARK) {
        icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>';
        btn.setAttribute('aria-label', 'Switch to light theme');
      } else {
        icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
        btn.setAttribute('aria-label', 'Switch to dark theme');
      }
    });
  }

  function initThemeToggle() {
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    buttons.forEach(function(btn) {
      btn.addEventListener('click', toggleTheme);
    });
    updateThemeButtons(getCurrentTheme());

    // Listen for system preference changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
        var stored = null;
        try { stored = localStorage.getItem(STORAGE_KEY); } catch (err) {}
        if (!stored) {
          var theme = e.matches ? DARK : LIGHT;
          document.documentElement.setAttribute('data-theme', theme);
          updateThemeButtons(theme);
        }
      });
    }
  }

  // =========================================================================
  // Mobile Navigation
  // =========================================================================

  function initMobileNav() {
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.querySelector('.nav-links');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', function() {
      var isOpen = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen);
      toggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
    });

    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
      if (!nav.contains(e.target) && !toggle.contains(e.target)) {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Close menu on escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  // =========================================================================
  // Code Block Copy Button
  // =========================================================================

  function initCopyButtons() {
    var buttons = document.querySelectorAll('.copy-button');
    buttons.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var codeBlock = btn.closest('.code-block');
        var pre = codeBlock ? codeBlock.querySelector('pre') : btn.closest('pre');
        if (!pre) return;

        var code = pre.textContent;

        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(code).then(function() {
            showCopied(btn);
          }).catch(function() {
            fallbackCopy(code, btn);
          });
        } else {
          fallbackCopy(code, btn);
        }
      });
    });
  }

  function fallbackCopy(text, btn) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showCopied(btn);
    } catch (err) {
      console.error('Copy failed', err);
    }
    document.body.removeChild(textarea);
  }

  function showCopied(btn) {
    var originalText = btn.textContent;
    btn.textContent = 'COPIED';
    btn.classList.add('copied');
    setTimeout(function() {
      btn.textContent = originalText;
      btn.classList.remove('copied');
    }, 1800);
  }

  // =========================================================================
  // Syntax Highlighting (lightweight)
  // =========================================================================

  var KEYWORDS_PY = new Set(['and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield', 'True', 'False', 'None']);
  var KEYWORDS_JS = new Set(['async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'from', 'function', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'of', 'return', 'static', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield', 'true', 'false', 'null', 'undefined']);
  var KEYWORDS_SH = new Set(['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case', 'esac', 'function', 'in', 'until', 'select', 'return', 'exit']);
  var BUILTINS_PY = new Set(['print', 'len', 'range', 'type', 'str', 'int', 'float', 'list', 'dict', 'tuple', 'set', 'frozenset', 'bool', 'bytes', 'open', 'input', 'isinstance', 'hasattr', 'getattr', 'setattr', 'super', 'enumerate', 'zip', 'map', 'filter', 'sorted', 'reversed', 'sum', 'min', 'max', 'any', 'all', 'abs', 'round', 'format']);

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function highlightCode(code, lang) {
    var keywords = null;
    var builtins = null;

    if (lang === 'python' || lang === 'py') {
      keywords = KEYWORDS_PY;
      builtins = BUILTINS_PY;
    } else if (lang === 'javascript' || lang === 'js' || lang === 'json' || lang === 'typescript' || lang === 'ts') {
      keywords = KEYWORDS_JS;
    } else if (lang === 'bash' || lang === 'sh' || lang === 'shell') {
      keywords = KEYWORDS_SH;
    }

    if (!keywords) {
      return escapeHtml(code);
    }

    var result = '';
    var i = 0;
    var n = code.length;

    while (i < n) {
      var c = code[i];

      // Comments
      if (c === '#' || (c === '/' && code[i + 1] === '/')) {
        var end = code.indexOf('\n', i);
        if (end === -1) end = n;
        result += '<span class="token-comment">' + escapeHtml(code.substring(i, end)) + '</span>';
        i = end;
        continue;
      }

      // Strings
      if (c === '"' || c === "'") {
        var quote = c;
        var j = i + 1;
        while (j < n && code[j] !== quote) {
          if (code[j] === '\\') j += 2;
          else j++;
        }
        j++;
        result += '<span class="token-string">' + escapeHtml(code.substring(i, j)) + '</span>';
        i = j;
        continue;
      }

      // Numbers
      if (/\d/.test(c)) {
        var j = i;
        while (j < n && /[0-9._xXbBoO]/.test(code[j])) j++;
        result += '<span class="token-number">' + escapeHtml(code.substring(i, j)) + '</span>';
        i = j;
        continue;
      }

      // Words (identifiers, keywords)
      if (/[a-zA-Z_@]/.test(c)) {
        var j = i;
        if (c === '@') j++;
        while (j < n && /[a-zA-Z0-9_]/.test(code[j])) j++;
        var word = code.substring(i, j);
        var bare = word.startsWith('@') ? word.slice(1) : word;

        if (keywords.has(bare)) {
          result += '<span class="token-keyword">' + escapeHtml(word) + '</span>';
        } else if (builtins && builtins.has(bare)) {
          result += '<span class="token-builtin">' + escapeHtml(word) + '</span>';
        } else if (c === '@') {
          result += '<span class="token-decorator">' + escapeHtml(word) + '</span>';
        } else if (code[j] === '(') {
          result += '<span class="token-function">' + escapeHtml(word) + '</span>';
        } else {
          result += escapeHtml(word);
        }
        i = j;
        continue;
      }

      // Operators
      if (/[+\-*/%=<>!&|^~?:]/.test(c)) {
        result += '<span class="token-operator">' + escapeHtml(c) + '</span>';
        i++;
        continue;
      }

      // Punctuation
      if (/[{}()\[\],;.]/.test(c)) {
        result += '<span class="token-punctuation">' + escapeHtml(c) + '</span>';
        i++;
        continue;
      }

      result += escapeHtml(c);
      i++;
    }

    return result;
  }

  function initSyntaxHighlighting() {
    var blocks = document.querySelectorAll('pre code');
    blocks.forEach(function(block) {
      // Don't re-highlight
      if (block.dataset.highlighted) return;

      var lang = '';
      var classes = block.className.split(/\s+/);
      for (var i = 0; i < classes.length; i++) {
        if (classes[i].startsWith('language-')) {
          lang = classes[i].substring(9);
          break;
        }
      }

      var original = block.textContent;
      block.innerHTML = highlightCode(original, lang);
      block.dataset.highlighted = 'true';
    });
  }

  // =========================================================================
  // Table of Contents
  // =========================================================================

  function initToc() {
    var toc = document.querySelector('.article-toc');
    if (!toc) return;

    var headings = document.querySelectorAll('.article-body h2, .article-body h3');
    if (headings.length === 0) return;

    var list = document.createElement('ul');
    list.className = 'article-toc-list';

    headings.forEach(function(heading) {
      if (!heading.id) return;

      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + heading.id;

      var num = heading.dataset.number;
      if (num && heading.tagName === 'H2') {
        a.textContent = num + '. ' + heading.textContent;
      } else {
        a.textContent = heading.textContent;
      }

      if (heading.tagName === 'H3') {
        a.classList.add('toc-h3');
      }

      li.appendChild(a);
      list.appendChild(li);
    });

    toc.appendChild(list);

    // Active section highlighting via IntersectionObserver
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          var id = entry.target.id;
          var link = toc.querySelector('a[href="#' + id + '"]');
          if (link) {
            if (entry.isIntersecting) {
              toc.querySelectorAll('a').forEach(function(l) { l.classList.remove('active'); });
              link.classList.add('active');
            }
          }
        });
      }, { rootMargin: '-80px 0px -65% 0px', threshold: 0 });

      headings.forEach(function(h) { observer.observe(h); });
    }

    // Mobile toggle
    var toggle = document.querySelector('.toc-toggle');
    if (toggle) {
      toggle.addEventListener('click', function() {
        toc.classList.toggle('open');
        var expanded = toc.classList.contains('open');
        toggle.setAttribute('aria-expanded', expanded);
      });
    }
  }

  // =========================================================================
  // Smooth scroll for anchor links
  // =========================================================================

  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
      anchor.addEventListener('click', function(e) {
        var target = document.querySelector(this.getAttribute('href'));
        if (target) {
          e.preventDefault();
          var offset = 80;
          var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
          window.scrollTo({ top: top, behavior: 'smooth' });
          history.pushState(null, '', this.getAttribute('href'));
        }
      });
    });
  }

  // =========================================================================
  // Initialize everything on DOM ready
  // =========================================================================

  function init() {
    initThemeToggle();
    initMobileNav();
    initCopyButtons();
    initSyntaxHighlighting();
    initToc();
    initSmoothScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
