(function () {
  var scripts = document.getElementsByTagName('script');
  var currentScript = document.currentScript || scripts[scripts.length - 1];
  var scriptSrc = currentScript && currentScript.src ? currentScript.src : 'https://concert.pihai0202.com/widget.js';
  var origin = scriptSrc.replace(/\/widget\.js(\?.*)?$/, '');

  var containers = document.querySelectorAll('#tw-concert-today, .tw-concert-today');
  containers.forEach(function (el) {
    if (el.getAttribute('data-loaded') === 'true') return;
    el.setAttribute('data-loaded', 'true');

    var city = el.getAttribute('data-city') || '';
    var venueId = el.getAttribute('data-venue') || '';
    var category = el.getAttribute('data-category') || '';
    var date = el.getAttribute('data-date') || '';
    var palette = el.getAttribute('data-palette') || 'volcano';
    var color = el.getAttribute('data-color') || '';
    var bg = el.getAttribute('data-bg') || '';

    var params = new URLSearchParams();
    params.set('embed', 'today');
    if (city) params.set('city', city);
    if (venueId) params.set('venue_id', venueId);
    if (category) params.set('category', category);
    if (date) params.set('date', date);
    if (palette) params.set('palette', palette);
    if (color) params.set('color', color.replace('#', ''));
    if (bg) params.set('bg', bg.replace('#', ''));

    var iframe = document.createElement('iframe');
    iframe.src = origin + '/?' + params.toString();
    iframe.style.width = '100%';
    iframe.style.maxWidth = '440px';
    iframe.style.height = el.getAttribute('data-height') || '260px';
    iframe.style.border = 'none';
    iframe.style.background = 'transparent';
    iframe.setAttribute('loading', 'lazy');

    el.innerHTML = '';
    el.appendChild(iframe);
  });
})();
