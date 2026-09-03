// TunnelVision Research — shared JS
// Lightbox for canonical journey filmstrip
(function() {
  const frames = [{"label": "A", "src": "../assets/images/exploration-start-A.jpg", "alt": "Canonical frame A"}, {"label": "B", "src": "../assets/images/exploration-06.jpg", "alt": "Canonical frame B"}, {"label": "C", "src": "../assets/images/exploration-08.jpg", "alt": "Canonical frame C"}, {"label": "D", "src": "../assets/images/exploration-17.jpg", "alt": "Canonical frame D"}, {"label": "E", "src": "../assets/images/exploration-23.jpg", "alt": "Canonical frame E"}, {"label": "F", "src": "../assets/images/exploration-25.jpg", "alt": "Canonical frame F"}, {"label": "G", "src": "../assets/images/exploration-29.jpg", "alt": "Canonical frame G"}, {"label": "H", "src": "../assets/images/exploration-34.jpg", "alt": "Canonical frame H"}];
  const reelItems = Array.from(document.querySelectorAll('#canonical-reel .film-cell'));
  const lb = document.getElementById('journey-lightbox');
  if (!lb || !frames.length) return;

  const img = lb.querySelector('.lb-image');
  const label = lb.querySelector('.lb-label');
  const counter = lb.querySelector('.lb-counter');
  const prev = lb.querySelector('.lb-prev');
  const next = lb.querySelector('.lb-next');
  const close = lb.querySelector('.lb-close');
  let index = 0;

  function render() {
    const f = frames[index];
    img.src = f.src;
    img.alt = f.alt;
    label.textContent = `Frame ${f.label}`;
    counter.textContent = `${index + 1} / ${frames.length}`;
  }

  function openAt(i) {
    index = i;
    render();
    lb.classList.add('open');
    lb.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lb-open');
    close.focus();
  }

  function hide() {
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lb-open');
  }

  function step(delta) {
    index = (index + delta + frames.length) % frames.length;
    render();
  }

  reelItems.forEach(function(el, i) {
    el.addEventListener('click', function() { openAt(i); });
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openAt(i);
      }
    });
  });

  prev.addEventListener('click', function() { step(-1); });
  next.addEventListener('click', function() { step(1); });
  close.addEventListener('click', hide);
  lb.querySelector('.lb-backdrop').addEventListener('click', hide);

  document.addEventListener('keydown', function(e) {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') hide();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
  });
})();

// Mobile nav toggle
(function() {
  var toggle = document.getElementById('nav-toggle');
  var sidebar = document.getElementById('sidebar');
  if (!toggle || !sidebar) return;
  
  toggle.addEventListener('click', function() {
    sidebar.classList.toggle('open');
  });
  
  // Close sidebar when clicking a link on mobile
  sidebar.querySelectorAll('a').forEach(function(a) {
    a.addEventListener('click', function() {
      if (window.innerWidth <= 1100) {
        sidebar.classList.remove('open');
      }
    });
  });
  
  // Close sidebar when clicking outside
  document.addEventListener('click', function(e) {
    if (window.innerWidth <= 1100 && 
        sidebar.classList.contains('open') && 
        !sidebar.contains(e.target) && 
        e.target !== toggle) {
      sidebar.classList.remove('open');
    }
  });
})();
