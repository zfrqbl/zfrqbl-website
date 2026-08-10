/* Client-side search logic */
(function() {
  'use strict';

  var searchInput = document.getElementById('search-input');
  var resultsContainer = document.getElementById('search-results');
  var resultsInfo = document.getElementById('search-results-info');
  var emptyState = document.getElementById('search-empty');
  var index = null;

  function loadIndex() {
    return fetch('/data/search-index.json')
      .then(function(response) {
        if (!response.ok) throw new Error('Failed to load search index');
        return response.json();
      })
      .then(function(data) {
        index = data;
        var params = new URLSearchParams(window.location.search);
        var q = params.get('q') || '';
        if (searchInput) searchInput.value = q;
        if (q) {
          performSearch(q);
        } else {
          renderInitial();
        }
      })
      .catch(function(err) {
        console.error('Search error:', err);
        if (resultsInfo) resultsInfo.textContent = 'Search unavailable.';
      });
  }

  function normalize(str) {
    return str.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function scoreItem(item, terms) {
    var score = 0;
    var titleNorm = normalize(item.title);
    var contentNorm = normalize(item.content || '');
    var descNorm = normalize(item.description || '');
    var tagsNorm = (item.tags || []).map(normalize).join(' ');
    var categoryNorm = normalize(item.category || '');

    terms.forEach(function(term) {
      if (titleNorm.includes(term)) score += 10;
      if (categoryNorm.includes(term)) score += 5;
      if (tagsNorm.includes(term)) score += 4;
      if (descNorm.includes(term)) score += 3;
      if (contentNorm.includes(term)) score += 1;
    });

    return score;
  }

  function highlightExcerpt(text, terms) {
    if (!text) return '';
    var excerpt = text.substring(0, 240);
    var html = escapeHtml(excerpt);
    terms.forEach(function(term) {
      if (!term) return;
      var regex = new RegExp('(' + escapeRegExp(term) + ')', 'gi');
      html = html.replace(regex, '<mark>$1</mark>');
    });
    if (text.length > 240) html += '…';
    return html;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function typeLabel(type) {
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  function performSearch(query) {
    if (!index) return;
    var terms = normalize(query).split(' ').filter(Boolean);

    if (terms.length === 0) {
      renderInitial();
      return;
    }

    var results = index.map(function(item) {
      return { item: item, score: scoreItem(item, terms) };
    }).filter(function(r) {
      return r.score > 0;
    }).sort(function(a, b) {
      return b.score - a.score;
    }).map(function(r) {
      return r.item;
    });

    renderResults(results, query, terms);
  }

  function renderInitial() {
    if (resultsContainer) resultsContainer.innerHTML = '';
    if (resultsInfo) resultsInfo.textContent = 'Search across all articles, projects, and notes.';
    if (emptyState) emptyState.style.display = 'none';
  }

  function renderResults(results, query, terms) {
    if (!resultsContainer) return;

    if (results.length === 0) {
      resultsContainer.innerHTML = '';
      if (resultsInfo) resultsInfo.textContent = 'No results for "' + escapeHtml(query) + '"';
      if (emptyState) {
        emptyState.style.display = 'block';
        emptyState.innerHTML = '<p>No results found. Try different keywords.</p>';
      }
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (resultsInfo) {
      resultsInfo.textContent = results.length + ' result' + (results.length === 1 ? '' : 's') + ' for "' + escapeHtml(query) + '"';
    }

    var html = '';
    results.forEach(function(item) {
      html += '<li class="search-result">';
      html += '<a href="' + escapeHtml(item.url) + '">';
      html += '<div class="search-result-type">' + typeLabel(item.type) + '</div>';
      html += '<h3 class="search-result-title">' + escapeHtml(item.title) + '</h3>';
      if (item.date) {
        html += '<div class="search-result-date">' + formatDate(item.date) + '</div>';
      }
      if (item.description) {
        html += '<p class="search-result-excerpt">' + highlightExcerpt(item.description, terms) + '</p>';
      }
      html += '</a>';
      html += '</li>';
    });

    resultsContainer.innerHTML = html;
  }

  function debounce(fn, wait) {
    var timeout;
    return function() {
      var args = arguments;
      var ctx = this;
      clearTimeout(timeout);
      timeout = setTimeout(function() { fn.apply(ctx, args); }, wait);
    };
  }

  function initSearch() {
    if (!searchInput) return;

    loadIndex();

    var debouncedSearch = debounce(function() {
      var q = searchInput.value.trim();
      var params = new URLSearchParams(window.location.search);
      if (q) {
        params.set('q', q);
      } else {
        params.delete('q');
      }
      var newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      window.history.replaceState(null, '', newUrl);
      performSearch(q);
    }, 200);

    searchInput.addEventListener('input', debouncedSearch);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSearch);
  } else {
    initSearch();
  }
})();
