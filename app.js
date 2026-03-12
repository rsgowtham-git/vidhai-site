// ========================================
// VIDHAI — App JS
// ========================================

(function() {
  'use strict';

  // --- Quill Editor Instance ---
  var quillEditor = null;
  var docxImportedHTML = null;  // Stores raw HTML from DOCX import (bypasses Quill)

  // --- Blog Data (loaded from API, falls back to posts.json) ---
  var memoryPosts = null;
  var postsLoaded = false;
  var useAPI = true;  // Use database API for persistence

  // --- Blog Page State ---
  var POSTS_PER_PAGE = 6;
  var currentPage = 1;
  var activeTag = 'All';

  // --- Page Detection ---
  var isBlogPage = false;

  function detectPage() {
    isBlogPage = !!document.getElementById('blog-page-container');
  }

  // --- Load Posts from API (with fallback to posts.json) ---
  function loadPosts(callback) {
    if (postsLoaded && memoryPosts) {
      callback(memoryPosts);
      return;
    }
    // Try API first
    fetch('./api/posts')
      .then(function(r) {
        if (!r.ok) throw new Error('API returned ' + r.status);
        return r.json();
      })
      .then(function(data) {
        memoryPosts = data;
        postsLoaded = true;
        useAPI = true;
        callback(memoryPosts);
      })
      .catch(function() {
        // Fallback to posts.json
        useAPI = false;
        fetch('./posts.json')
          .then(function(r) { return r.json(); })
          .then(function(data) {
            memoryPosts = data;
            postsLoaded = true;
            callback(memoryPosts);
          })
          .catch(function(err) {
            console.warn('Could not load posts:', err);
            memoryPosts = [];
            postsLoaded = true;
            callback(memoryPosts);
          });
      });
  }

  function getPosts() {
    if (memoryPosts) return memoryPosts;
    return [];
  }

  function savePosts(posts) {
    memoryPosts = posts;
  }

  function generateId() {
    return 'post-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
  }

  function estimateReadTime(text) {
    var words = text.trim().split(/\s+/).length;
    var mins = Math.max(1, Math.ceil(words / 200));
    return mins + ' min read';
  }

  function formatDate(dateStr) {
    if (!dateStr) {
      var d = new Date();
      var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }
    return dateStr;
  }

  // --- Render Blog Cards (Homepage — first 3 only) ---
  function renderBlogCards() {
    var container = document.getElementById('blog-cards-container');
    if (!container) return;
    var posts = getPosts();
    var displayPosts = posts.slice(0, 3);

    container.innerHTML = displayPosts.map(function(post, i) {
      var tagsHTML = (post.tags || []).map(function(t) {
        return '<span class="badge badge--tag">' + escapeHTML(t) + '</span>';
      }).join('');

      var excerptText = escapeHTML(stripHTMLTags(post.excerpt));

      return '<article class="blog-card" data-blog="' + i + '">' +
        '<div class="blog-card__meta">' +
          '<span>' + escapeHTML(post.author || 'Gowtham') + '</span>' +
          '<span class="dot-separator">' + escapeHTML(post.date) + '</span>' +
          '<span class="dot-separator">' + escapeHTML(post.readTime) + '</span>' +
        '</div>' +
        '<h3 class="blog-card__title">' + escapeHTML(post.title) + '</h3>' +
        '<p class="blog-card__excerpt">' + excerptText + '</p>' +
        '<div class="blog-card__tags">' + tagsHTML + '</div>' +
        '<span class="blog-card__read-more">Read more <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg></span>' +
      '</article>';
    }).join('');

    // Bind clicks
    container.querySelectorAll('[data-blog]').forEach(function(card) {
      card.addEventListener('click', function() {
        openBlog(parseInt(card.getAttribute('data-blog'), 10));
      });
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openBlog(parseInt(card.getAttribute('data-blog'), 10));
        }
      });
    });

    // Re-run reveal for new cards
    container.classList.remove('is-visible');
    requestAnimationFrame(function() {
      container.classList.add('is-visible');
    });
  }

  // --- Blog Page: Render with Pagination & Tag Filtering ---
  function getFilteredPosts() {
    var posts = getPosts();
    if (activeTag === 'All') return posts;
    return posts.filter(function(post) {
      return (post.tags || []).indexOf(activeTag) !== -1;
    });
  }

  function getAllTags() {
    var posts = getPosts();
    var tagSet = {};
    posts.forEach(function(post) {
      (post.tags || []).forEach(function(tag) {
        tagSet[tag] = true;
      });
    });
    return Object.keys(tagSet).sort();
  }

  function renderTagFilters() {
    var container = document.getElementById('blog-tag-filters');
    if (!container) return;

    var tags = getAllTags();
    var allTags = ['All'].concat(tags);

    container.innerHTML = '<div class="blog-tag-filters__inner">' +
      allTags.map(function(tag) {
        var isActive = tag === activeTag;
        return '<button class="blog-tag-btn' + (isActive ? ' blog-tag-btn--active' : '') + '" data-tag="' + escapeHTML(tag) + '">' + escapeHTML(tag) + '</button>';
      }).join('') +
    '</div>';

    // Bind tag clicks
    container.querySelectorAll('[data-tag]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        activeTag = btn.getAttribute('data-tag');
        currentPage = 1;
        renderTagFilters();
        renderBlogPage();
        renderPagination();
      });
    });
  }

  function renderBlogPage() {
    var container = document.getElementById('blog-page-container');
    if (!container) return;

    var filtered = getFilteredPosts();
    var start = (currentPage - 1) * POSTS_PER_PAGE;
    var end = start + POSTS_PER_PAGE;
    var pagePosts = filtered.slice(start, end);

    if (pagePosts.length === 0) {
      container.innerHTML = '<div class="blog-empty"><p>No posts found' + (activeTag !== 'All' ? ' for tag "' + escapeHTML(activeTag) + '"' : '') + '.</p></div>';
      return;
    }

    // We need the global index in the full (unfiltered) posts array to open the correct post
    var allPosts = getPosts();

    container.innerHTML = pagePosts.map(function(post) {
      var globalIndex = allPosts.indexOf(post);
      var tagsHTML = (post.tags || []).map(function(t) {
        return '<span class="badge badge--tag">' + escapeHTML(t) + '</span>';
      }).join('');

      var excerptText = escapeHTML(stripHTMLTags(post.excerpt));

      return '<article class="blog-card" data-blog="' + globalIndex + '">' +
        '<div class="blog-card__meta">' +
          '<span>' + escapeHTML(post.author || 'Gowtham') + '</span>' +
          '<span class="dot-separator">' + escapeHTML(post.date) + '</span>' +
          '<span class="dot-separator">' + escapeHTML(post.readTime) + '</span>' +
        '</div>' +
        '<h3 class="blog-card__title">' + escapeHTML(post.title) + '</h3>' +
        '<p class="blog-card__excerpt">' + excerptText + '</p>' +
        '<div class="blog-card__tags">' + tagsHTML + '</div>' +
        '<span class="blog-card__read-more">Read more <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg></span>' +
      '</article>';
    }).join('');

    // Bind clicks
    container.querySelectorAll('[data-blog]').forEach(function(card) {
      card.addEventListener('click', function() {
        openBlog(parseInt(card.getAttribute('data-blog'), 10));
      });
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openBlog(parseInt(card.getAttribute('data-blog'), 10));
        }
      });
    });

    // Re-run reveal for new cards
    container.classList.remove('is-visible');
    requestAnimationFrame(function() {
      container.classList.add('is-visible');
    });
  }

  function renderPagination() {
    var container = document.getElementById('blog-pagination');
    if (!container) return;

    var filtered = getFilteredPosts();
    var totalPages = Math.max(1, Math.ceil(filtered.length / POSTS_PER_PAGE));

    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    var prevDisabled = currentPage <= 1;
    var nextDisabled = currentPage >= totalPages;

    container.innerHTML =
      '<button class="blog-pagination__btn' + (prevDisabled ? ' blog-pagination__btn--disabled' : '') + '" id="pagination-prev"' + (prevDisabled ? ' disabled' : '') + '>' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg> Previous' +
      '</button>' +
      '<span class="blog-pagination__info">Page ' + currentPage + ' of ' + totalPages + '</span>' +
      '<button class="blog-pagination__btn' + (nextDisabled ? ' blog-pagination__btn--disabled' : '') + '" id="pagination-next"' + (nextDisabled ? ' disabled' : '') + '>' +
        'Next <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>' +
      '</button>';

    var prevBtn = document.getElementById('pagination-prev');
    var nextBtn = document.getElementById('pagination-next');

    if (prevBtn && !prevDisabled) {
      prevBtn.addEventListener('click', function() {
        currentPage--;
        renderBlogPage();
        renderPagination();
        window.scrollTo({ top: document.getElementById('blog-page-section').offsetTop - 80, behavior: 'smooth' });
      });
    }
    if (nextBtn && !nextDisabled) {
      nextBtn.addEventListener('click', function() {
        currentPage++;
        renderBlogPage();
        renderPagination();
        window.scrollTo({ top: document.getElementById('blog-page-section').offsetTop - 80, behavior: 'smooth' });
      });
    }
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function stripHTMLTags(html) {
    if (!html) return '';
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  // --- Theme Toggle ---
  var toggle = document.querySelector('[data-theme-toggle]');
  var root = document.documentElement;
  // Auto-detect system preference
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var theme = prefersDark ? 'dark' : 'light';
  root.setAttribute('data-theme', theme);

  function updateToggleIcon() {
    if (!toggle) return;
    toggle.setAttribute('aria-label', 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode');
    toggle.innerHTML = theme === 'dark'
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }
  updateToggleIcon();
  if (toggle) {
    toggle.addEventListener('click', function() {
      theme = theme === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', theme);
      updateToggleIcon();
    });
  }

  // --- Mobile Menu ---
  var menuToggle = document.querySelector('[data-menu-toggle]');
  var mobileMenu = document.getElementById('mobile-menu');
  var mobileLinks = document.querySelectorAll('[data-mobile-link]');

  function closeMobileMenu() {
    if (!mobileMenu || !menuToggle) return;
    mobileMenu.classList.remove('is-open');
    mobileMenu.setAttribute('aria-hidden', 'true');
    menuToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    menuToggle.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
  }

  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', function() {
      var isOpen = mobileMenu.classList.contains('is-open');
      if (isOpen) {
        closeMobileMenu();
      } else {
        mobileMenu.classList.add('is-open');
        mobileMenu.setAttribute('aria-hidden', 'false');
        menuToggle.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
        menuToggle.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      }
    });
    mobileLinks.forEach(function(link) {
      link.addEventListener('click', closeMobileMenu);
    });
  }

  // --- Nav scroll effect ---
  var nav = document.querySelector('.nav');
  if (nav) {
    window.addEventListener('scroll', function() {
      if (window.scrollY > 20) {
        nav.classList.add('nav--scrolled');
      } else {
        nav.classList.remove('nav--scrolled');
      }
    }, { passive: true });
  }

  // --- Tabs ---
  var tabBtns = document.querySelectorAll('.tab-btn');
  var tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var target = btn.getAttribute('data-tab');
      tabBtns.forEach(function(b) { b.classList.remove('active'); });
      tabContents.forEach(function(c) { c.classList.remove('active'); });
      btn.classList.add('active');
      var targetEl = document.getElementById('tab-' + target);
      if (targetEl) {
        targetEl.classList.add('active');
        var stagger = targetEl.querySelector('.stagger');
        if (stagger) {
          stagger.classList.remove('is-visible');
          requestAnimationFrame(function() { stagger.classList.add('is-visible'); });
        }
      }
    });
  });

  // --- Scroll Reveal ---
  var reveals = document.querySelectorAll('.reveal, .stagger');
  function checkReveal() {
    reveals.forEach(function(el) {
      var rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.88) {
        el.classList.add('is-visible');
      }
    });
  }
  window.addEventListener('scroll', checkReveal, { passive: true });
  window.addEventListener('resize', checkReveal, { passive: true });
  checkReveal();
  setTimeout(checkReveal, 100);
  setTimeout(checkReveal, 500);
  setTimeout(checkReveal, 1000);

  // --- Blog Post Overlay ---
  var blogOverlay = document.getElementById('blog-overlay');
  var blogPostContent = document.getElementById('blog-post-content');

  function openBlog(index) {
    var posts = getPosts();
    var post = posts[index];
    if (!post) return;

    var tagsHTML = (post.tags || []).map(function(t) {
      return '<span class="badge badge--tag">' + escapeHTML(t) + '</span>';
    }).join('');

    // Check if content contains HTML tags (rich text)
    var isRichContent = /<[a-z][\s\S]*>/i.test(post.content);
    var contentHTML;
    if (isRichContent) {
      contentHTML = post.content;
    } else {
      contentHTML = post.content.split('\n\n').map(function(p) {
        return '<p>' + escapeHTML(p) + '</p>';
      }).join('');
    }

    // Build Article JSON-LD schema
    var articleSchema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      'headline': post.title,
      'author': { '@type': 'Person', 'name': post.author || 'Gowtham' },
      'datePublished': post.date,
      'publisher': { '@type': 'Organization', 'name': 'Vidhai', 'url': 'https://vidhai.co' },
      'description': stripHTMLTags(post.excerpt || '').substring(0, 300)
    };
    var schemaScript = '<script type="application/ld+json">' + JSON.stringify(articleSchema) + '<\/script>';

    blogPostContent.innerHTML = 
      '<button class="blog-post__close" aria-label="Close article"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
      '<div class="blog-post__meta"><span>' + escapeHTML(post.author) + '</span><span class="dot-separator">' + escapeHTML(post.date) + '</span><span class="dot-separator">' + escapeHTML(post.readTime) + '</span></div>' +
      '<h2 class="blog-post__title">' + escapeHTML(post.title) + '</h2>' +
      '<div class="blog-post__tags">' + tagsHTML + '</div>' +
      '<div class="blog-post__content">' + contentHTML + '</div>' +
      schemaScript;

    blogOverlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    blogPostContent.querySelector('.blog-post__close').addEventListener('click', closeBlog);
  }

  function closeBlog() {
    blogOverlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  if (blogOverlay) {
    blogOverlay.addEventListener('click', function(e) {
      if (e.target === blogOverlay) closeBlog();
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeBlog();
      closeMobileMenu();
      closeAdmin();
    }
  });

  // ========================================
  // NEWSLETTER FORM (Supabase + Resend)
  // ========================================
  // Client-side email validation helper
  var disposableDomains = ['mailinator.com','guerrillamail.com','tempmail.com','throwaway.email','temp-mail.org','10minutemail.com','trashmail.com','yopmail.com','sharklasers.com','maildrop.cc','dispostable.com','mailnesia.com','tempr.email','discard.email','fake.com','fakeinbox.com','mailcatch.com','tempail.com','tempmailaddress.com','emailondeck.com','getnada.com','mohmal.com','burnermail.io','inboxkitten.com','mail7.io','harakirimail.com','mailsac.com','anonbox.net','mytemp.email','tempinbox.com','trash-mail.com','guerrillamail.org','spam4.me','cuvox.de','armyspy.com','dayrep.com','einrot.com','fleckens.hu','gustr.com','jourrapide.com','rhyta.com','superrito.com','teleworm.us'];
  function isValidEmailClient(email) {
    var re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    if (!re.test(email)) return false;
    var domain = email.split('@')[1];
    if (!domain || !domain.includes('.')) return false;
    if (disposableDomains.indexOf(domain.toLowerCase()) >= 0) return false;
    return true;
  }

  var newsletterForm = document.getElementById('newsletter-form');
  // Set timestamp when form loads (for anti-bot timing check)
  if (newsletterForm) {
    var tsField = document.getElementById('newsletter-ts');
    if (tsField) tsField.value = String(Date.now());
  }
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var emailInput = document.getElementById('newsletter-email');
      var email = emailInput.value.trim();
      if (!email) return;

      var errorEl = document.getElementById('newsletter-error');
      // Client-side validation
      if (!isValidEmailClient(email)) {
        if (errorEl) {
          errorEl.textContent = 'Please enter a valid email address. Disposable/temporary emails are not accepted.';
          errorEl.style.display = 'block';
        }
        return;
      }

      // Honeypot check (hidden field should be empty)
      var hpField = document.getElementById('newsletter-hp');
      if (hpField && hpField.value) {
        // Silently pretend success to confuse bots
        newsletterForm.style.display = 'none';
        var successEl2 = document.getElementById('newsletter-success');
        if (successEl2) { successEl2.textContent = 'Thanks for subscribing!'; successEl2.style.display = 'block'; }
        return;
      }

      var freq = newsletterForm.querySelector('input[name="frequency"]:checked');
      var frequency = freq ? freq.value : 'weekly';
      var tsVal = (tsField && tsField.value) ? tsField.value : '';

      var btn = document.getElementById('newsletter-btn');
      var successEl = document.getElementById('newsletter-success');
      var errorEl = document.getElementById('newsletter-error');

      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Subscribing...';
      }
      if (successEl) successEl.style.display = 'none';
      if (errorEl) errorEl.style.display = 'none';

      fetch('/api/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, frequency: frequency, _hp: (hpField ? hpField.value : ''), _ts: tsVal })
      })
      .then(function(response) { return response.json(); })
      .then(function(data) {
        if (data.success) {
          newsletterForm.style.display = 'none';
          if (successEl) {
            successEl.textContent = data.message || 'Almost there! Check your inbox and click the confirmation link to complete your subscription.';
            successEl.style.display = 'block';
          }
        } else {
          if (errorEl) {
            errorEl.textContent = data.error || 'Something went wrong. Please try again.';
            errorEl.style.display = 'block';
          }
          if (btn) { btn.disabled = false; btn.textContent = 'Subscribe'; }
        }
      })
      .catch(function() {
        if (errorEl) errorEl.style.display = 'block';
        if (btn) { btn.disabled = false; btn.textContent = 'Subscribe'; }
      });
    });
  }

  // ========================================
  // ADMIN PANEL
  // ========================================
  var adminAuthenticated = false;
  var adminPanel = document.getElementById('admin-panel');
  var adminOverlay = document.getElementById('admin-overlay');
  var adminBtn = document.getElementById('admin-open-btn');

  // --- Admin Auth ---
  function isAdminAuthenticated() {
    return adminAuthenticated;
  }

  function setAdminAuthenticated() {
    adminAuthenticated = true;
  }

  // --- Open / Close Admin ---
  function openAdmin() {
    if (!adminOverlay) return;
    if (!isAdminAuthenticated()) {
      showPasswordPrompt();
      return;
    }
    adminOverlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    renderAdminPostList();
  }

  function closeAdmin() {
    if (!adminOverlay) return;
    adminOverlay.classList.remove('is-open');
    document.body.style.overflow = '';
    // Reset to list view
    showAdminView('list');
  }

  if (adminBtn) {
    adminBtn.addEventListener('click', function(e) {
      e.preventDefault();
      openAdmin();
    });
  }

  // Close button
  var adminCloseBtn = document.getElementById('admin-close');
  if (adminCloseBtn) {
    adminCloseBtn.addEventListener('click', closeAdmin);
  }

  // Close overlay click (only on list/password views, NOT editor/linkedin)
  if (adminOverlay) {
    adminOverlay.addEventListener('click', function(e) {
      if (e.target === adminOverlay) {
        // Check which view is active — don't close if editing
        var editorView = adminPanel.querySelector('[data-admin-view="editor"]');
        var linkedinView = adminPanel.querySelector('[data-admin-view="linkedin"]');
        var isEditing = (editorView && editorView.style.display === 'block');
        var isLinkedIn = (linkedinView && linkedinView.style.display === 'block');
        if (!isEditing && !isLinkedIn) {
          closeAdmin();
        }
      }
    });
  }

  // --- Password Prompt ---
  function showPasswordPrompt() {
    adminOverlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    showAdminView('password');
    var pwInput = document.getElementById('admin-pw-input');
    if (pwInput) { pwInput.value = ''; pwInput.focus(); }
  }

  var pwForm = document.getElementById('admin-pw-form');
  if (pwForm) {
    pwForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var pw = document.getElementById('admin-pw-input').value;
      // Simple password: Grit@Prosperity143
      if (pw === 'Grit@Prosperity143') {
        setAdminAuthenticated();
        document.getElementById('admin-pw-error').textContent = '';
        showAdminView('list');
        renderAdminPostList();
      } else {
        document.getElementById('admin-pw-error').textContent = 'Incorrect password. Try again.';
      }
    });
  }

  // --- Admin Views ---
  function showAdminView(view) {
    if (!adminPanel) return;
    var views = adminPanel.querySelectorAll('[data-admin-view]');
    views.forEach(function(v) {
      v.style.display = v.getAttribute('data-admin-view') === view ? 'block' : 'none';
    });
  }

  // --- Render Post List ---
  function renderAdminPostList() {
    var listEl = document.getElementById('admin-post-list');
    if (!listEl) return;
    var posts = getPosts();

    if (posts.length === 0) {
      listEl.innerHTML = '<p class="admin-empty">No blog posts yet. Click "New Post" to create one.</p>';
      return;
    }

    listEl.innerHTML = posts.map(function(post, i) {
      return '<div class="admin-post-item">' +
        '<div class="admin-post-item__info">' +
          '<h4 class="admin-post-item__title">' + escapeHTML(post.title) + '</h4>' +
          '<span class="admin-post-item__meta">' + escapeHTML(post.date) + ' &middot; ' + escapeHTML(post.author || 'Gowtham') + '</span>' +
        '</div>' +
        '<div class="admin-post-item__actions">' +
          '<button class="admin-btn admin-btn--sm admin-btn--linkedin-sm" data-linkedin-index="' + i + '" title="Post to LinkedIn">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>' +
            ' LinkedIn' +
          '</button>' +
          '<button class="admin-btn admin-btn--sm admin-btn--edit" data-edit-index="' + i + '">Edit</button>' +
          '<button class="admin-btn admin-btn--sm admin-btn--delete" data-delete-index="' + i + '">Delete</button>' +
        '</div>' +
      '</div>';
    }).join('');

    // Bind edit
    listEl.querySelectorAll('[data-edit-index]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        editPost(parseInt(btn.getAttribute('data-edit-index'), 10));
      });
    });

    // Bind delete
    listEl.querySelectorAll('[data-delete-index]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        deletePost(parseInt(btn.getAttribute('data-delete-index'), 10));
      });
    });

    // Bind LinkedIn
    listEl.querySelectorAll('[data-linkedin-index]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        openLinkedInView(parseInt(btn.getAttribute('data-linkedin-index'), 10));
      });
    });
  }

  // --- Format Painter ---
  var formatPainterFormats = null;
  var formatPainterActive = false;

  function activateFormatPainter() {
    if (!quillEditor) return;
    var range = quillEditor.getSelection();
    if (!range || range.length === 0) {
      alert('Select some text first to copy its formatting.');
      return;
    }
    // Capture formats at selection
    formatPainterFormats = quillEditor.getFormat(range);
    formatPainterActive = true;
    // Visual feedback on the button
    var fpBtn = document.querySelector('.ql-format-painter');
    if (fpBtn) fpBtn.classList.add('ql-active');
  }

  function applyFormatPainter(range) {
    if (!quillEditor || !formatPainterFormats || !range || range.length === 0) return;
    // Clear existing formats first
    quillEditor.removeFormat(range.index, range.length);
    // Apply captured formats
    Object.keys(formatPainterFormats).forEach(function(fmt) {
      quillEditor.formatText(range.index, range.length, fmt, formatPainterFormats[fmt]);
    });
    // Deactivate
    formatPainterActive = false;
    formatPainterFormats = null;
    var fpBtn = document.querySelector('.ql-format-painter');
    if (fpBtn) fpBtn.classList.remove('ql-active');
  }

  // --- Insert Table ---
  function insertTable() {
    if (!quillEditor) return;
    var rows = prompt('Number of rows:', '3');
    var cols = prompt('Number of columns:', '3');
    if (!rows || !cols) return;
    rows = parseInt(rows, 10);
    cols = parseInt(cols, 10);
    if (isNaN(rows) || isNaN(cols) || rows < 1 || cols < 1 || rows > 20 || cols > 10) {
      alert('Please enter valid numbers (rows: 1-20, columns: 1-10).');
      return;
    }
    var tableHTML = '<table><thead><tr>';
    for (var c = 0; c < cols; c++) {
      tableHTML += '<th>Header ' + (c + 1) + '</th>';
    }
    tableHTML += '</tr></thead><tbody>';
    for (var r = 0; r < rows; r++) {
      tableHTML += '<tr>';
      for (var c2 = 0; c2 < cols; c2++) {
        tableHTML += '<td>&nbsp;</td>';
      }
      tableHTML += '</tr>';
    }
    tableHTML += '</tbody></table><p><br></p>';
    var range = quillEditor.getSelection(true);
    quillEditor.clipboard.dangerouslyPasteHTML(range.index, tableHTML);
  }

  // --- Quill Init ---
  function initQuill() {
    var editorContainer = document.getElementById('editor-content-quill');
    if (!editorContainer) return;
    // Destroy previous instance if any
    if (quillEditor) {
      quillEditor = null;
    }
    // Remove any existing Quill toolbars and editor content
    var parentField = editorContainer.parentNode;
    var existingToolbars = parentField.querySelectorAll('.ql-toolbar');
    existingToolbars.forEach(function(tb) { tb.remove(); });
    // Reset the editor container
    editorContainer.className = '';
    editorContainer.innerHTML = '';

    // Register table module if quill-better-table is available
    var toolbarOptions = [
      [{ 'header': [1, 2, 3, false] }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      [{ 'indent': '-1' }, { 'indent': '+1' }],
      [{ 'align': [] }],
      ['blockquote', 'code-block'],
      ['link', 'image'],
      ['insert-table'],
      ['format-painter'],
      ['clean']
    ];

    quillEditor = new Quill('#editor-content-quill', {
      theme: 'snow',
      placeholder: 'Write your post here...',
      modules: {
        toolbar: {
          container: toolbarOptions,
          handlers: {
            'format-painter': function() {
              activateFormatPainter();
            },
            'insert-table': function() {
              insertTable();
            }
          }
        }
      }
    });

    // Style the format painter button with paintbrush icon
    var fpBtn = document.querySelector('.ql-format-painter');
    if (fpBtn) {
      fpBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 3H5c-1.1 0-2 .9-2 2v4h18V5c0-1.1-.9-2-2-2z"/><path d="M3 9v3c0 1.1.9 2 2 2h4l-2 7h4l2-7h6c1.1 0 2-.9 2-2V9H3z"/></svg>';
      fpBtn.title = 'Format Painter — select formatted text, click this, then select target text';
    }

    // Style the table insert button
    var tblBtn = document.querySelector('.ql-insert-table');
    if (tblBtn) {
      tblBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>';
      tblBtn.title = 'Insert Table';
    }

    // Listen for selection changes to apply format painter
    quillEditor.on('selection-change', function(range) {
      if (formatPainterActive && range && range.length > 0) {
        applyFormatPainter(range);
      }
    });
  }

  // --- Import DOCX ---
  var importDocxBtn = document.getElementById('import-docx-btn');
  var importDocxInput = document.getElementById('import-docx-input');
  var importDocxStatus = document.getElementById('import-docx-status');

  function showDocxPreview(html) {
    var quillContainer = document.getElementById('editor-content-quill');
    var previewContainer = document.getElementById('editor-content-preview');
    var previewActions = document.getElementById('editor-preview-actions');
    // Hide Quill toolbar + editor
    if (quillContainer) quillContainer.style.display = 'none';
    var toolbar = quillContainer ? quillContainer.parentNode.querySelector('.ql-toolbar') : null;
    if (toolbar) toolbar.style.display = 'none';
    // Show preview
    if (previewContainer) {
      previewContainer.innerHTML = html;
      previewContainer.style.display = 'block';
    }
    if (previewActions) previewActions.style.display = 'flex';
    docxImportedHTML = html;
  }

  function hideDocxPreview() {
    var quillContainer = document.getElementById('editor-content-quill');
    var previewContainer = document.getElementById('editor-content-preview');
    var previewActions = document.getElementById('editor-preview-actions');
    // Show Quill
    if (quillContainer) quillContainer.style.display = 'block';
    var toolbar = quillContainer ? quillContainer.parentNode.querySelector('.ql-toolbar') : null;
    if (toolbar) toolbar.style.display = 'block';
    // Hide preview
    if (previewContainer) {
      previewContainer.style.display = 'none';
      previewContainer.innerHTML = '';
    }
    if (previewActions) previewActions.style.display = 'none';
    docxImportedHTML = null;
  }

  // Switch to Quill button
  var switchToQuillBtn = document.getElementById('editor-switch-to-quill');
  if (switchToQuillBtn) {
    switchToQuillBtn.addEventListener('click', function() {
      if (!confirm('Switching to the rich text editor may lose tables and some formatting. Continue?')) return;
      var html = docxImportedHTML || '';
      hideDocxPreview();
      if (quillEditor) {
        quillEditor.root.innerHTML = html;
      }
    });
  }

  if (importDocxBtn && importDocxInput) {
    importDocxBtn.addEventListener('click', function() {
      importDocxInput.click();
    });

    importDocxInput.addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) return;

      if (!file.name.toLowerCase().endsWith('.docx')) {
        if (importDocxStatus) {
          importDocxStatus.textContent = 'Please select a .docx file.';
          importDocxStatus.style.color = '#f87171';
        }
        return;
      }

      if (importDocxStatus) {
        importDocxStatus.textContent = 'Importing...';
        importDocxStatus.style.color = '#94a3b8';
      }

      var reader = new FileReader();
      reader.onload = function(event) {
        var arrayBuffer = event.target.result;

        if (typeof mammoth === 'undefined') {
          if (importDocxStatus) {
            importDocxStatus.textContent = 'Import library not loaded. Please refresh and try again.';
            importDocxStatus.style.color = '#f87171';
          }
          return;
        }

        mammoth.convertToHtml(
          { arrayBuffer: arrayBuffer },
          {
            styleMap: [
              "p[style-name='Heading 1'] => h1:fresh",
              "p[style-name='Heading 2'] => h2:fresh",
              "p[style-name='Heading 3'] => h3:fresh",
              "b => strong",
              "i => em",
              "u => u",
              "strike => s"
            ]
          }
        ).then(function(result) {
          var html = result.value;
          var warnings = result.messages.filter(function(m) { return m.type === 'warning'; });

          // Check if existing content should be replaced
          var hasExisting = false;
          if (docxImportedHTML) {
            hasExisting = true;
          } else if (quillEditor) {
            var currentContent = quillEditor.getText().trim();
            hasExisting = currentContent.length > 0;
          }

          if (hasExisting) {
            if (!confirm('The editor already has content. Replace it with the imported document?')) {
              if (importDocxStatus) {
                importDocxStatus.textContent = 'Import cancelled.';
                importDocxStatus.style.color = '#94a3b8';
              }
              importDocxInput.value = '';
              return;
            }
          }

          // Check if content has tables or complex HTML that Quill would break
          var hasComplexContent = /<table|<thead|<tbody/i.test(html);
          if (hasComplexContent) {
            // Use preview mode to preserve tables
            showDocxPreview(html);
          } else {
            // Simple content — safe for Quill
            hideDocxPreview();
            if (quillEditor) {
              quillEditor.setText('');
              quillEditor.root.innerHTML = html;
            }
          }

          // Try to extract title from filename if title field is empty
          var titleField = document.getElementById('editor-title');
          if (titleField && !titleField.value.trim()) {
            var docTitle = file.name.replace(/\.docx$/i, '').replace(/[-_]/g, ' ');
            titleField.value = docTitle;
          }

          if (importDocxStatus) {
            var warningText = warnings.length > 0 ? ' (' + warnings.length + ' warnings)' : '';
            importDocxStatus.textContent = '\u2705 Imported: ' + file.name + warningText;
            importDocxStatus.style.color = '#5eead4';
          }

          // Reset file input so same file can be re-imported
          importDocxInput.value = '';
        }).catch(function(err) {
          if (importDocxStatus) {
            importDocxStatus.textContent = 'Import failed: ' + err.message;
            importDocxStatus.style.color = '#f87171';
          }
          importDocxInput.value = '';
        });
      };

      reader.onerror = function() {
        if (importDocxStatus) {
          importDocxStatus.textContent = 'Could not read file. Please try again.';
          importDocxStatus.style.color = '#f87171';
        }
        importDocxInput.value = '';
      };

      reader.readAsArrayBuffer(file);
    });
  }

  // --- New Post ---
  var newPostBtn = document.getElementById('admin-new-post');
  if (newPostBtn) {
    newPostBtn.addEventListener('click', function() {
      currentEditIndex = -1;
      clearEditorForm();
      document.getElementById('admin-editor-title-text').textContent = 'New Post';
      showAdminView('editor');
      initQuill();
    });
  }

  // --- Edit Post ---
  var currentEditIndex = -1;

  function editPost(index) {
    var posts = getPosts();
    var post = posts[index];
    if (!post) return;
    currentEditIndex = index;

    document.getElementById('editor-title').value = post.title || '';
    document.getElementById('editor-author').value = post.author || 'Gowtham';
    document.getElementById('editor-tags').value = (post.tags || []).join(', ');
    document.getElementById('editor-excerpt').value = post.excerpt || '';
    document.getElementById('editor-content').value = post.content || '';
    document.getElementById('admin-editor-title-text').textContent = 'Edit Post';
    showAdminView('editor');
    initQuill();

    // If content has tables, show in preview mode to preserve them
    var hasComplexContent = /<table|<thead|<tbody/i.test(post.content || '');
    if (hasComplexContent) {
      showDocxPreview(post.content);
    } else {
      hideDocxPreview();
      if (quillEditor && post.content) {
        quillEditor.root.innerHTML = post.content;
      }
    }
  }

  function clearEditorForm() {
    document.getElementById('editor-title').value = '';
    document.getElementById('editor-author').value = 'Gowtham';
    document.getElementById('editor-tags').value = '';
    document.getElementById('editor-excerpt').value = '';
    document.getElementById('editor-content').value = '';
    hideDocxPreview();
    if (quillEditor) {
      quillEditor.root.innerHTML = '';
    }
  }

  // --- Refresh all blog views ---
  function refreshAllViews() {
    if (isBlogPage) {
      renderTagFilters();
      renderBlogPage();
      renderPagination();
    } else {
      renderBlogCards();
    }
  }

  // --- Save Post ---
  var editorForm = document.getElementById('admin-editor-form');
  if (editorForm) {
    editorForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var posts = getPosts();

      var title = document.getElementById('editor-title').value.trim();
      var author = document.getElementById('editor-author').value.trim() || 'Gowtham';
      var tagsStr = document.getElementById('editor-tags').value.trim();
      var excerpt = document.getElementById('editor-excerpt').value.trim();

      // Get content from DOCX preview if active, else from Quill, else from textarea
      var content;
      if (docxImportedHTML) {
        content = docxImportedHTML;
      } else if (quillEditor) {
        content = quillEditor.root.innerHTML.trim();
        // If Quill is empty it may contain just <p><br></p>
        if (content === '<p><br></p>' || content === '') content = '';
      } else {
        content = document.getElementById('editor-content').value.trim();
      }

      if (!title || !content) {
        alert('Title and content are required.');
        return;
      }

      var tags = tagsStr ? tagsStr.split(',').map(function(t) { return t.trim(); }).filter(Boolean) : [];
      var plainTextContent = stripHTMLTags(content);
      var readTime = estimateReadTime(plainTextContent);
      var date = formatDate(null);
      var excerptFinal = excerpt || stripHTMLTags(content).substring(0, 200) + '...';

      // Disable save button during API call
      var saveBtn = editorForm.querySelector('button[type="submit"]');
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

      if (useAPI) {
        // --- API-backed save ---
        var isEditing = (currentEditIndex >= 0 && currentEditIndex < posts.length);
        var apiMethod = isEditing ? 'PUT' : 'POST';
        var apiBody = {
          title: title,
          author: author,
          tags: tags,
          excerpt: excerptFinal,
          content: content,
          readTime: readTime,
          date: date
        };
        if (isEditing) {
          apiBody.id = posts[currentEditIndex].id;
        }

        fetch('./api/posts', {
          method: apiMethod,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiBody)
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Post'; }
          if (data.error) {
            alert('Error saving: ' + data.error);
            return;
          }
          // Refresh posts from API
          postsLoaded = false;
          loadPosts(function() {
            refreshAllViews();
            renderAdminPostList();
            docxImportedHTML = null;
            var savedPostIndex = isEditing ? currentEditIndex : 0;
            currentEditIndex = -1;
            var doLinkedIn = confirm('Post saved to database!\n\nWould you like to post this to LinkedIn?');
            if (doLinkedIn) {
              openLinkedInView(savedPostIndex);
            } else {
              showAdminView('list');
            }
          });
        })
        .catch(function(err) {
          if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Post'; }
          alert('Failed to save: ' + err.message);
        });

      } else {
        // --- In-memory fallback ---
        if (currentEditIndex >= 0 && currentEditIndex < posts.length) {
          posts[currentEditIndex].title = title;
          posts[currentEditIndex].author = author;
          posts[currentEditIndex].tags = tags;
          posts[currentEditIndex].excerpt = excerptFinal;
          posts[currentEditIndex].content = content;
          posts[currentEditIndex].readTime = readTime;
        } else {
          posts.unshift({
            id: generateId(),
            title: title,
            date: date,
            author: author,
            readTime: readTime,
            tags: tags,
            excerpt: excerptFinal,
            content: content
          });
        }
        savePosts(posts);
        refreshAllViews();
        renderAdminPostList();
        docxImportedHTML = null;
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Post'; }
        var savedPostIdx = (currentEditIndex >= 0) ? currentEditIndex : 0;
        currentEditIndex = -1;
        var doLinkedIn2 = confirm('Post saved!\n\nWould you like to post this to LinkedIn?\n\n(Note: Posts will be lost on refresh. Database not connected.)');
        if (doLinkedIn2) {
          openLinkedInView(savedPostIdx);
        } else {
          showAdminView('list');
        }
      }
    });
  }

  // --- Cancel Edit ---
  var cancelEditBtn = document.getElementById('admin-cancel-edit');
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', function() {
      showAdminView('list');
      currentEditIndex = -1;
    });
  }

  // --- Delete Post ---
  function deletePost(index) {
    if (!confirm('Are you sure you want to delete this post?')) return;
    var posts = getPosts();
    var post = posts[index];
    if (!post) return;

    if (useAPI && post.id) {
      // Delete from database
      fetch('./api/posts?id=' + encodeURIComponent(post.id), {
        method: 'DELETE'
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.error) {
          alert('Error deleting: ' + data.error);
          return;
        }
        postsLoaded = false;
        loadPosts(function() {
          refreshAllViews();
          renderAdminPostList();
        });
      })
      .catch(function(err) {
        alert('Failed to delete: ' + err.message);
      });
    } else {
      // In-memory fallback
      posts.splice(index, 1);
      savePosts(posts);
      refreshAllViews();
      renderAdminPostList();
    }
  }

  // ========================================
  // LINKEDIN PUBLISH FLOW
  // ========================================

  function openLinkedInView(postIndex) {
    var posts = getPosts();
    var post = posts[postIndex];
    if (!post) return;

    var plainExcerpt = stripHTMLTags(post.excerpt || post.content).substring(0, 300);
    var message = '\uD83D\uDCDD New on Vidhai \u2014 ' + post.title + '\n\n' +
      plainExcerpt + '\n\n' +
      'Read the full article \u2192 https://www.vidhai.co/blog.html\n\n' +
      '#AI #Vidhai #TechInsights';

    document.getElementById('linkedin-message').value = message;
    document.getElementById('linkedin-company').checked = true;
    document.getElementById('linkedin-personal').checked = true;
    document.getElementById('linkedin-success').style.display = 'none';
    document.getElementById('linkedin-success').textContent = '';

    // Store current post index for reference
    window.__vidhaiLinkedInPostIndex = postIndex;

    showAdminView('linkedin');
  }

  // LinkedIn Publish button
  var linkedinPublishBtn = document.getElementById('linkedin-publish-btn');
  if (linkedinPublishBtn) {
    linkedinPublishBtn.addEventListener('click', function() {
      var message = document.getElementById('linkedin-message').value;
      var postToCompany = document.getElementById('linkedin-company').checked;
      var postToPersonal = document.getElementById('linkedin-personal').checked;
      var successEl = document.getElementById('linkedin-success');

      if (!message.trim()) {
        successEl.textContent = 'Please enter a message to post.';
        successEl.style.display = 'block';
        successEl.style.color = '#f87171';
        return;
      }

      if (!postToCompany && !postToPersonal) {
        successEl.textContent = 'Please select at least one destination (personal or company).';
        successEl.style.display = 'block';
        successEl.style.color = '#f87171';
        return;
      }

      // Disable button and show loading
      linkedinPublishBtn.disabled = true;
      linkedinPublishBtn.textContent = 'Publishing...';
      successEl.style.display = 'none';

      // Call the Vercel serverless function
      fetch('/api/linkedin-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          postToPersonal: postToPersonal,
          postToCompany: postToCompany
        })
      })
      .then(function(response) { return response.json(); })
      .then(function(data) {
        linkedinPublishBtn.disabled = false;
        linkedinPublishBtn.textContent = 'Publish to LinkedIn';
        if (data.success) {
          successEl.textContent = '\u2705 ' + (data.message || 'Posted to LinkedIn!');
          successEl.style.display = 'block';
          successEl.style.color = '#5eead4';
        } else {
          successEl.textContent = '\u274c ' + (data.message || data.error || 'Failed to post. Please try again.');
          successEl.style.display = 'block';
          successEl.style.color = '#f87171';
        }
      })
      .catch(function(err) {
        linkedinPublishBtn.disabled = false;
        linkedinPublishBtn.textContent = 'Publish to LinkedIn';
        successEl.textContent = '\u274c Network error. Please check your connection and try again.';
        successEl.style.display = 'block';
        successEl.style.color = '#f87171';
      });
    });
  }

  // LinkedIn Cancel button
  var linkedinCancelBtn = document.getElementById('linkedin-cancel-btn');
  if (linkedinCancelBtn) {
    linkedinCancelBtn.addEventListener('click', function() {
      showAdminView('list');
    });
  }

  // ========================================
  // ADMIN TABS NAVIGATION
  // ========================================

  var adminTabsContainer = document.getElementById('admin-tabs');
  // Tab click handlers are bound in the content management section below

  // Show admin tabs when authenticated
  var origSetAdminAuth = setAdminAuthenticated;
  setAdminAuthenticated = function() {
    origSetAdminAuth();
    if (adminTabsContainer) adminTabsContainer.style.display = 'flex';
  };

  // ========================================
  // SUBSCRIBERS ADMIN VIEW
  // ========================================

  function renderSubscriberList() {
    var statsEl = document.getElementById('subscriber-stats');
    var listEl = document.getElementById('admin-subscriber-list');
    var unsubListEl = document.getElementById('admin-subscriber-list-unsub');
    if (!listEl) return;

    listEl.innerHTML = '<p class="admin-empty">Loading subscribers...</p>';
    if (unsubListEl) unsubListEl.innerHTML = '';

    fetch('/api/subscribers')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!Array.isArray(data)) {
          listEl.innerHTML = '<p class="admin-empty">Could not load subscribers.</p>';
          return;
        }

        var activePending = data.filter(function(s) { return s.status === 'active' || s.status === 'pending'; });
        var unsubscribed = data.filter(function(s) { return s.status === 'unsubscribed'; });
        var activeCount = data.filter(function(s) { return s.status === 'active'; }).length;
        var pendingCount = data.filter(function(s) { return s.status === 'pending'; }).length;

        if (statsEl) {
          statsEl.innerHTML =
            '<div class="stat"><span class="stat-number">' + data.length + '</span> total</div>' +
            '<div class="stat"><span class="stat-number active">' + activeCount + '</span> active</div>' +
            (pendingCount > 0 ? '<div class="stat"><span class="stat-number" style="color:#f59e0b;">' + pendingCount + '</span> pending</div>' : '') +
            '<div class="stat"><span class="stat-number unsub">' + unsubscribed.length + '</span> unsubscribed</div>';
        }

        // Render active & pending list
        if (activePending.length === 0) {
          listEl.innerHTML = '<p class="admin-empty">No active or pending subscribers yet.</p>';
        } else {
          listEl.innerHTML = renderSubItems(activePending);
          bindRemoveButtons(listEl);
        }

        // Render unsubscribed list
        if (unsubListEl) {
          if (unsubscribed.length === 0) {
            unsubListEl.innerHTML = '<p class="admin-empty">No unsubscribed users.</p>';
          } else {
            unsubListEl.innerHTML = renderSubItems(unsubscribed);
          }
        }
      })
      .catch(function() {
        listEl.innerHTML = '<p class="admin-empty">Failed to load subscribers. Is the API connected?</p>';
      });
  }

  function renderSubItems(subs) {
    return subs.map(function(sub) {
      var dateStr = '';
      try {
        dateStr = new Date(sub.subscribed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } catch(e) { /* ignore */ }
      var badgeClass = sub.status === 'active' ? 'active' : (sub.status === 'pending' ? 'pending' : 'unsubscribed');
      return '<div class="admin-subscriber-item">' +
        '<span class="admin-subscriber-item__email">' + escapeHTML(sub.email) + '</span>' +
        '<div class="admin-subscriber-item__meta">' +
          '<span>' + escapeHTML(sub.frequency || 'weekly') + '</span>' +
          '<span>' + dateStr + '</span>' +
          '<span class="admin-subscriber-item__badge ' + badgeClass + '">' + escapeHTML(sub.status) + '</span>' +
          (sub.status !== 'unsubscribed' ? '<button type="button" class="admin-subscriber-remove" data-sub-id="' + sub.id + '" data-sub-email="' + escapeHTML(sub.email) + '" title="Remove subscriber">&times;</button>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  function bindRemoveButtons(container) {
    container.querySelectorAll('.admin-subscriber-remove').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var subId = btn.getAttribute('data-sub-id');
        var subEmail = btn.getAttribute('data-sub-email');
        if (!confirm('Unsubscribe "' + subEmail + '"? They will be marked as unsubscribed.')) return;
        btn.disabled = true;
        btn.textContent = '...';
        fetch('/api/subscribers?id=' + encodeURIComponent(subId), { method: 'DELETE' })
          .then(function(r) { return r.json(); })
          .then(function(res) {
            if (res.success) {
              renderSubscriberList();
            } else {
              alert('Failed to unsubscribe: ' + (res.error || 'Unknown error'));
              btn.disabled = false;
              btn.textContent = '\u00d7';
            }
          })
          .catch(function() {
            alert('Network error. Please try again.');
            btn.disabled = false;
            btn.textContent = '\u00d7';
          });
      });
    });
  }

  // Subscriber sub-tab switching
  document.querySelectorAll('.subscriber-sub-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.subscriber-sub-tab').forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      var target = tab.getAttribute('data-sub-tab');
      var apList = document.getElementById('admin-subscriber-list');
      var unList = document.getElementById('admin-subscriber-list-unsub');
      if (target === 'active-pending') {
        if (apList) apList.style.display = '';
        if (unList) unList.style.display = 'none';
      } else {
        if (apList) apList.style.display = 'none';
        if (unList) unList.style.display = '';
      }
    });
  });

  // ========================================
  // NEWSLETTER COMPOSE & SEND (Multi-Section)
  // ========================================

  var nlSections = { ai: [], semi: [], blog: [], video: [], invest: [], ipo: [] };
  var nlSectionLimits = { ai: 4, semi: 3, blog: 2, video: 3, invest: 3, ipo: 3 };
  var nlSectionLabels = { ai: 'AI News', semi: 'Semiconductor', blog: 'Blog', video: 'Video', invest: 'Market Movers', ipo: 'Upcoming IPOs' };

  function renderNLSection(section) {
    var listEl = document.getElementById('nl-' + section + '-stories-list') || document.getElementById('nl-' + section + '-list');
    if (!listEl) return;
    var items = nlSections[section] || [];

    if (section === 'invest') {
      listEl.innerHTML = items.map(function(item, i) {
        return '<div class="nl-story-item">' +
          '<button type="button" class="nl-story-remove" data-section="' + section + '" data-remove-index="' + i + '">&times;</button>' +
          '<div class="admin-field"><label>Ticker</label>' +
          '<input type="text" class="admin-input nl-item-field" data-section="' + section + '" data-index="' + i + '" data-field="ticker" value="' + escapeHTML(item.ticker || '') + '" placeholder="e.g. NVDA"></div>' +
          '<div class="admin-field"><label>Company</label>' +
          '<input type="text" class="admin-input nl-item-field" data-section="' + section + '" data-index="' + i + '" data-field="title" value="' + escapeHTML(item.title) + '" placeholder="e.g. NVIDIA Corp"></div>' +
          '<div class="admin-field"><label>Price</label>' +
          '<input type="text" class="admin-input nl-item-field" data-section="' + section + '" data-index="' + i + '" data-field="price" value="' + escapeHTML(item.price || '') + '" placeholder="e.g. $142.50"></div>' +
          '<div class="admin-field"><label>Change %</label>' +
          '<input type="text" class="admin-input nl-item-field" data-section="' + section + '" data-index="' + i + '" data-field="change" value="' + escapeHTML(item.change || '') + '" placeholder="e.g. +5.2%"></div>' +
          '<div class="admin-field"><label>Context (optional)</label>' +
          '<input type="text" class="admin-input nl-item-field" data-section="' + section + '" data-index="' + i + '" data-field="context" value="' + escapeHTML(item.context || '') + '" placeholder="e.g. AI chip demand surges"></div>' +
        '</div>';
      }).join('');
    } else if (section === 'video') {
      listEl.innerHTML = items.map(function(item, i) {
        return '<div class="nl-story-item">' +
          '<button type="button" class="nl-story-remove" data-section="' + section + '" data-remove-index="' + i + '">&times;</button>' +
          '<div class="admin-field"><label>Video Title</label>' +
          '<input type="text" class="admin-input nl-item-field" data-section="' + section + '" data-index="' + i + '" data-field="title" value="' + escapeHTML(item.title) + '" placeholder="Video title"></div>' +
          '<div class="admin-field"><label>Channel / Source</label>' +
          '<input type="text" class="admin-input nl-item-field" data-section="' + section + '" data-index="' + i + '" data-field="source" value="' + escapeHTML(item.source) + '" placeholder="e.g. Fireship"></div>' +
          '<div class="admin-field"><label>URL</label>' +
          '<input type="text" class="admin-input nl-item-field" data-section="' + section + '" data-index="' + i + '" data-field="url" value="' + escapeHTML(item.url) + '" placeholder="https://..."></div>' +
          '<div class="admin-field"><label>Duration</label>' +
          '<input type="text" class="admin-input nl-item-field" data-section="' + section + '" data-index="' + i + '" data-field="duration" value="' + escapeHTML(item.duration || '') + '" placeholder="e.g. 14 min"></div>' +
        '</div>';
      }).join('');
    } else if (section === 'blog') {
      listEl.innerHTML = items.map(function(item, i) {
        return '<div class="nl-story-item">' +
          '<button type="button" class="nl-story-remove" data-section="' + section + '" data-remove-index="' + i + '">&times;</button>' +
          '<div class="admin-field"><label>Post Title</label>' +
          '<input type="text" class="admin-input nl-item-field" data-section="' + section + '" data-index="' + i + '" data-field="title" value="' + escapeHTML(item.title) + '" placeholder="Blog post title"></div>' +
          '<div class="admin-field"><label>Excerpt</label>' +
          '<textarea class="admin-textarea nl-item-field" data-section="' + section + '" data-index="' + i + '" data-field="summary" rows="2" placeholder="Short excerpt or teaser...">' + escapeHTML(item.summary) + '</textarea></div>' +
          '<div class="admin-field"><label>URL</label>' +
          '<input type="text" class="admin-input nl-item-field" data-section="' + section + '" data-index="' + i + '" data-field="url" value="' + escapeHTML(item.url) + '" placeholder="https://vidhai.co/blog.html#..."></div>' +
        '</div>';
      }).join('');
    } else if (section === 'ipo') {
      listEl.innerHTML = items.map(function(item, i) {
        return '<div class="nl-story-item">' +
          '<button type="button" class="nl-story-remove" data-section="' + section + '" data-remove-index="' + i + '">&times;</button>' +
          '<div class="admin-field"><label>Company Name</label>' +
          '<input type="text" class="admin-input nl-item-field" data-section="' + section + '" data-index="' + i + '" data-field="title" value="' + escapeHTML(item.title) + '" placeholder="e.g. Cerebras Systems"></div>' +
          '<div class="admin-field"><label>Expected Date</label>' +
          '<input type="text" class="admin-input nl-item-field" data-section="' + section + '" data-index="' + i + '" data-field="date" value="' + escapeHTML(item.date || '') + '" placeholder="e.g. Q2 2026"></div>' +
          '<div class="admin-field"><label>Valuation</label>' +
          '<input type="text" class="admin-input nl-item-field" data-section="' + section + '" data-index="' + i + '" data-field="valuation" value="' + escapeHTML(item.valuation || '') + '" placeholder="e.g. $8B"></div>' +
          '<div class="admin-field"><label>Sector</label>' +
          '<input type="text" class="admin-input nl-item-field" data-section="' + section + '" data-index="' + i + '" data-field="category" value="' + escapeHTML(item.category || '') + '" placeholder="e.g. AI, Semiconductor"></div>' +
          '<div class="admin-field"><label>Source URL</label>' +
          '<input type="text" class="admin-input nl-item-field" data-section="' + section + '" data-index="' + i + '" data-field="url" value="' + escapeHTML(item.url || '') + '" placeholder="https://..."></div>' +
        '</div>';
      }).join('');
    } else {
      listEl.innerHTML = items.map(function(item, i) {
        return '<div class="nl-story-item">' +
          '<button type="button" class="nl-story-remove" data-section="' + section + '" data-remove-index="' + i + '">&times;</button>' +
          '<div class="admin-field"><label>Badge / Category</label>' +
          '<input type="text" class="admin-input nl-item-field" data-section="' + section + '" data-index="' + i + '" data-field="badge" value="' + escapeHTML(item.badge || '') + '" placeholder="e.g. AI Models, Funding, Fabrication"></div>' +
          '<div class="admin-field"><label>Headline</label>' +
          '<input type="text" class="admin-input nl-item-field" data-section="' + section + '" data-index="' + i + '" data-field="title" value="' + escapeHTML(item.title) + '" placeholder="Story headline"></div>' +
          '<div class="admin-field"><label>Summary</label>' +
          '<textarea class="admin-textarea nl-item-field" data-section="' + section + '" data-index="' + i + '" data-field="summary" rows="2" placeholder="Brief summary...">' + escapeHTML(item.summary) + '</textarea></div>' +
          '<div class="admin-field"><label>Source Name</label>' +
          '<input type="text" class="admin-input nl-item-field" data-section="' + section + '" data-index="' + i + '" data-field="source" value="' + escapeHTML(item.source) + '" placeholder="e.g. Reuters, TechCrunch"></div>' +
          '<div class="admin-field"><label>Source URL</label>' +
          '<input type="text" class="admin-input nl-item-field" data-section="' + section + '" data-index="' + i + '" data-field="url" value="' + escapeHTML(item.url) + '" placeholder="https://..."></div>' +
          '<div class="admin-field"><label>Date</label>' +
          '<input type="text" class="admin-input nl-item-field" data-section="' + section + '" data-index="' + i + '" data-field="date" value="' + escapeHTML(item.date || '') + '" placeholder="e.g. Mar 5, 2026"></div>' +
        '</div>';
      }).join('');
    }

    // Bind remove buttons
    listEl.querySelectorAll('[data-remove-index]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        syncNLAllFields();
        var sec = btn.getAttribute('data-section');
        nlSections[sec].splice(parseInt(btn.getAttribute('data-remove-index'), 10), 1);
        renderNLSection(sec);
      });
    });
  }

  function syncNLAllFields() {
    document.querySelectorAll('.nl-item-field').forEach(function(el) {
      var sec = el.getAttribute('data-section');
      var idx = parseInt(el.getAttribute('data-index'), 10);
      var field = el.getAttribute('data-field');
      if (nlSections[sec] && nlSections[sec][idx]) {
        nlSections[sec][idx][field] = el.tagName === 'TEXTAREA' ? el.value : el.value;
      }
    });
  }

  // Add story buttons (multiple sections)
  document.querySelectorAll('.nl-add-story-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var section = btn.getAttribute('data-section');
      var limit = nlSectionLimits[section] || 4;
      syncNLAllFields();
      if (nlSections[section].length >= limit) {
        alert('Maximum ' + limit + ' items in this section.');
        return;
      }
      if (section === 'invest') {
        nlSections[section].push({ ticker: '', title: '', price: '', change: '', context: '' });
      } else if (section === 'video') {
        nlSections[section].push({ title: '', source: '', url: '', duration: '' });
      } else if (section === 'blog') {
        nlSections[section].push({ title: '', summary: '', url: '' });
      } else if (section === 'ipo') {
        nlSections[section].push({ title: '', date: '', valuation: '', category: '', url: '' });
      } else {
        nlSections[section].push({ badge: '', title: '', summary: '', source: '', url: '', date: '' });
      }
      renderNLSection(section);
    });
  });

  // Build the beautiful newsletter HTML
  function buildNewsletterHTML() {
    syncNLAllFields();
    var subject = (document.getElementById('nl-subject') || {}).value || 'Vidhai Weekly Digest';
    var personalNote = (document.getElementById('nl-personal-note') || {}).value || '';
    var nlFormat = (document.getElementById('nl-format') || {}).value || 'weekly';
    var isMonthly = nlFormat === 'monthly';

    var today = new Date();
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var dateStr = months[today.getMonth()] + ' ' + today.getDate() + ', ' + today.getFullYear();

    var unsubUrl = '{{UNSUBSCRIBE_URL}}';

    // Badge color mapping
    function badgeStyle(badge) {
      var b = (badge || '').toLowerCase();
      if (b.indexOf('model') >= 0 || b.indexOf('release') >= 0) return 'background:#dbeafe;color:#1e40af;';
      if (b.indexOf('policy') >= 0 || b.indexOf('regulation') >= 0) return 'background:#dbeafe;color:#1e40af;';
      if (b.indexOf('agent') >= 0) return 'background:#dbeafe;color:#1e40af;';
      if (b.indexOf('fund') >= 0) return 'background:#dbeafe;color:#1e40af;';
      if (b.indexOf('fab') >= 0 || b.indexOf('chip') >= 0 || b.indexOf('semi') >= 0) return 'background:#fce7f3;color:#9d174d;';
      if (b.indexOf('memory') >= 0 || b.indexOf('hbm') >= 0) return 'background:#fce7f3;color:#9d174d;';
      if (b.indexOf('talent') >= 0 || b.indexOf('hire') >= 0) return 'background:#fce7f3;color:#9d174d;';
      return 'background:#f1f5f9;color:#475569;';
    }

    // --- Build sections (headline-only for weekly, detailed for monthly) ---
    var siteUrl = 'https://www.vidhai.co';

    // Helper: bullet-style headline link
    function headlineLink(title, url, badge) {
      var badgeHTML = badge ? '<span style="display:inline-block;font-size:9px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;padding:2px 6px;border-radius:3px;margin-right:6px;' + badgeStyle(badge) + '">' + escapeHTML(badge) + '</span>' : '';
      var link = url ? '<a href="' + escapeHTML(url) + '" style="color:#18181b;text-decoration:none;font-size:14px;font-weight:500;line-height:1.4;">' + escapeHTML(title) + '</a>' : '<span style="font-size:14px;font-weight:500;color:#18181b;">' + escapeHTML(title) + '</span>';
      return '<div style="padding:8px 0;border-bottom:1px solid #f4f4f5;">' + badgeHTML + link + '</div>';
    }

    // Personal note — clean inline text style matching "Better" format
    var personalNoteHTML = '';
    if (personalNote.trim()) {
      personalNoteHTML = '<div style="padding:20px 32px 0 32px;">' +
        '<p style="font-size:15px;line-height:1.7;color:#334155;margin:0;">' +
        escapeHTML(personalNote).replace(/\n/g, '<br>') +
        '</p></div>';
    }

    // Section header helper — bold black text with dark underline (matching "Better" format)
    function sectionHeader(label) {
      return '<div style="font-size:13px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#18181b;margin-bottom:4px;">' + label + '</div>' +
        '<div style="height:2px;background:#18181b;margin-bottom:12px;"></div>';
    }

    // Section link helper
    function sectionLink(text, href) {
      return '<a href="' + href + '" style="display:inline-block;margin-top:10px;font-size:12px;font-weight:500;color:#6b7280;text-decoration:none;">' + text + ' &rarr;</a>';
    }

    // Detailed item helper for monthly format
    function detailedItem(title, url, summary, badge) {
      var badgeHTML = badge ? '<span style="display:inline-block;font-size:9px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;padding:2px 6px;border-radius:3px;margin-right:6px;' + badgeStyle(badge) + '">' + escapeHTML(badge) + '</span>' : '';
      var link = url ? '<a href="' + escapeHTML(url) + '" style="color:#18181b;text-decoration:none;font-size:14px;font-weight:600;line-height:1.4;">' + escapeHTML(title) + '</a>' : '<span style="font-size:14px;font-weight:600;color:#18181b;">' + escapeHTML(title) + '</span>';
      var summaryHTML = summary ? '<div style="font-size:13px;color:#64748b;line-height:1.5;margin-top:4px;">' + escapeHTML(summary) + '</div>' : '';
      return '<div style="padding:10px 0;border-bottom:1px solid #f4f4f5;">' + badgeHTML + link + summaryHTML + '</div>';
    }

    // AI news
    var aiHTML = '';
    var aiStories = (nlSections.ai || []).filter(function(s) { return s.title; });
    if (aiStories.length > 0) {
      var aiItems = aiStories.map(function(s) {
        return isMonthly ? detailedItem(s.title, s.url, s.summary, s.badge) : headlineLink(s.title, s.url, s.badge);
      }).join('');
      aiHTML = '<div style="padding:20px 32px;">' +
        sectionHeader('AI NEWS') +
        aiItems +
        sectionLink('Read all on Vidhai', siteUrl + '/#news') +
      '</div>';
    }

    // Semiconductor
    var semiHTML = '';
    var semiStories = (nlSections.semi || []).filter(function(s) { return s.title; });
    if (semiStories.length > 0) {
      var semiItems = semiStories.map(function(s) {
        return isMonthly ? detailedItem(s.title, s.url, s.summary, s.badge) : headlineLink(s.title, s.url, s.badge);
      }).join('');
      semiHTML = '<div style="padding:20px 32px;">' +
        sectionHeader('SEMICONDUCTOR INSIGHTS') +
        semiItems +
        sectionLink('Read all on Vidhai', siteUrl + '/#semiconductors') +
      '</div>';
    }

    // Market Movers (compact table — ticker, change, arrow)
    var investHTML = '';
    var investItems = (nlSections.invest || []).filter(function(s) { return s.title || s.ticker; });
    if (investItems.length > 0) {
      var moversRows = investItems.map(function(s) {
        var changeVal = (s.change || '').trim();
        var isDown = changeVal.indexOf('-') === 0;
        var changeColor = isDown ? '#ef4444' : '#22c55e';
        var arrow = isDown ? '\u25BC' : '\u25B2';
        return '<tr>' +
          '<td style="padding:6px 10px 6px 0;font-size:13px;font-weight:700;color:#18181b;">' + escapeHTML(s.ticker || '') + '</td>' +
          '<td style="padding:6px 10px;font-size:13px;color:#334155;">' + escapeHTML(s.title || '') + '</td>' +
          '<td style="padding:6px 10px;font-size:13px;font-weight:600;color:' + changeColor + ';text-align:right;">' + arrow + ' ' + escapeHTML(changeVal) + '</td>' +
        '</tr>';
      }).join('');
      investHTML = '<div style="padding:20px 32px;">' +
        sectionHeader('MARKET MOVERS') +
        '<table style="width:100%;border-collapse:collapse;"><tr><td style="padding:4px 10px 4px 0;font-size:11px;font-weight:700;color:#6b7280;">Ticker</td><td style="padding:4px 10px;font-size:11px;font-weight:700;color:#6b7280;">Company</td><td style="padding:4px 10px;font-size:11px;font-weight:700;color:#6b7280;text-align:right;">Change</td></tr>' + moversRows + '</table>' +
        sectionLink('See all movers on Vidhai', siteUrl + '/#investments') +
      '</div>';
    }

    // Blog posts — always included
    var blogHTML = '';
    var blogPosts = (nlSections.blog || []).filter(function(s) { return s.title; });
    if (blogPosts.length > 0) {
      var blogItems = blogPosts.map(function(s) {
        var link = s.url ? '<a href="' + escapeHTML(s.url) + '" style="color:#0f172a;text-decoration:none;font-size:14px;font-weight:600;">' + escapeHTML(s.title) + '</a>' : '<span style="font-size:14px;font-weight:600;color:#0f172a;">' + escapeHTML(s.title) + '</span>';
        var summaryHTML = (isMonthly && s.summary) ? '<div style="font-size:13px;color:#64748b;line-height:1.5;margin-top:4px;">' + escapeHTML(s.summary) + '</div>' : '';
        return '<div style="padding:8px 0;border-bottom:1px solid #f4f4f5;">' + link + summaryHTML + '</div>';
      }).join('');
      blogHTML = '<div style="padding:20px 32px;">' +
        sectionHeader('FROM THE BLOG') +
        blogItems +
        sectionLink('Read all posts', siteUrl + '/blog.html') +
      '</div>';
    }

    // Curated Videos
    var videoHTML = '';
    var videos = (nlSections.video || []).filter(function(s) { return s.title; });
    if (videos.length > 0) {
      var videoItems = videos.map(function(s) {
        var link = s.url ? '<a href="' + escapeHTML(s.url) + '" style="color:#18181b;text-decoration:none;font-size:14px;font-weight:500;">' + escapeHTML(s.title) + '</a>' : '<span style="font-size:14px;font-weight:500;color:#18181b;">' + escapeHTML(s.title) + '</span>';
        var meta = escapeHTML(s.source || '') + (s.duration ? ' &bull; ' + escapeHTML(s.duration) : '');
        return '<div style="padding:8px 0;border-bottom:1px solid #f4f4f5;">' + link + (meta ? '<div style="font-size:11px;color:#a1a1aa;margin-top:2px;">' + meta + '</div>' : '') + '</div>';
      }).join('');
      videoHTML = '<div style="padding:20px 32px;">' +
        sectionHeader('CURATED VIDEOS') +
        videoItems +
      '</div>';
    }

    // Upcoming IPOs
    var ipoHTML = '';
    var ipoItems = (nlSections.ipo || []).filter(function(s) { return s.title; });
    if (ipoItems.length > 0) {
      var ipoRows = ipoItems.map(function(s) {
        var link = s.url ? '<a href="' + escapeHTML(s.url) + '" style="color:#18181b;text-decoration:none;font-size:13px;font-weight:600;">' + escapeHTML(s.title) + '</a>' : '<span style="font-size:13px;font-weight:600;color:#18181b;">' + escapeHTML(s.title) + '</span>';
        var meta = [];
        if (s.date) meta.push(escapeHTML(s.date));
        if (s.valuation) meta.push('~' + escapeHTML(s.valuation));
        if (s.category) meta.push(escapeHTML(s.category));
        var metaStr = meta.length > 0 ? '<div style="font-size:11px;color:#a1a1aa;margin-top:2px;">' + meta.join(' &bull; ') + '</div>' : '';
        return '<div style="padding:8px 0;border-bottom:1px solid #f4f4f5;">' + link + metaStr + '</div>';
      }).join('');
      ipoHTML = '<div style="padding:20px 32px;">' +
        sectionHeader('UPCOMING IPOs') +
        ipoRows +
        sectionLink('See all on Vidhai', siteUrl + '/#investments') +
      '</div>';
    }

    // Assemble full email — clean, headline-driven, matching "Better" format
    return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
      '<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;color:#18181b;-webkit-text-size-adjust:100%;">' +
      '<div style="width:100%;background:#ffffff;padding:32px 0;">' +
      '<div style="max-width:600px;margin:0 auto;background:#ffffff;">' +
        // Header — clean, light, minimal
        '<div style="padding:32px 32px 16px 32px;text-align:center;">' +
          '<div style="font-size:32px;font-weight:300;color:#9ca3af;letter-spacing:-0.5px;">' + (isMonthly ? 'Vidhai Monthly Digest' : 'Vidhai Weekly Digest') + '</div>' +
          '<div style="font-size:14px;color:#9ca3af;margin-top:8px;">' + dateStr + '</div>' +
        '</div>' +
        personalNoteHTML +
        aiHTML +
        semiHTML +
        investHTML +
        videoHTML +
        blogHTML +
        ipoHTML +
        // Footer — simple
        '<div style="padding:28px 32px;text-align:center;border-top:1px solid #e4e4e7;margin-top:20px;">' +
          '<div style="margin-bottom:10px;">' +
            '<a href="' + siteUrl + '" style="font-size:13px;font-weight:600;color:#18181b;text-decoration:none;">' + siteUrl.replace('https://www.','') + '</a>' +
            ' &mdash; Where AI Meets Industry' +
          '</div>' +
          '<p style="font-size:11px;color:#a1a1aa;line-height:1.5;margin:0;">' +
            'You received this because you subscribed to Vidhai updates.<br>' +
            '<a href="' + unsubUrl + '" style="color:#71717a;text-decoration:underline;">Unsubscribe</a>' +
          '</p>' +
        '</div>' +
      '</div></div></body></html>';
  }

  // Preview button
  var nlPreviewBtn = document.getElementById('nl-preview-btn');
  if (nlPreviewBtn) {
    nlPreviewBtn.addEventListener('click', function() {
      var html = buildNewsletterHTML().replace(/{{UNSUBSCRIBE_URL}}/g, '#');
      var previewContainer = document.getElementById('nl-preview-container');
      var previewFrame = document.getElementById('nl-preview-frame');
      if (previewContainer && previewFrame) {
        previewFrame.innerHTML = '<iframe srcdoc="' + html.replace(/"/g, '&quot;') + '" style="width:100%;min-height:800px;border:none;"></iframe>';
        previewContainer.style.display = 'block';
      }
    });
  }

  var nlPreviewClose = document.getElementById('nl-preview-close');
  if (nlPreviewClose) {
    nlPreviewClose.addEventListener('click', function() {
      var previewContainer = document.getElementById('nl-preview-container');
      if (previewContainer) previewContainer.style.display = 'none';
    });
  }

  // Auto-fill from DB button
  var nlAutofillBtn = document.getElementById('nl-autofill-btn');
  if (nlAutofillBtn) {
    nlAutofillBtn.addEventListener('click', function() {
      nlAutofillBtn.disabled = true;
      nlAutofillBtn.textContent = 'Loading...';

      var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      var today = new Date();
      var dateStr = months[today.getMonth()] + ' ' + today.getDate() + ', ' + today.getFullYear();

      // Set subject line based on format
      var nlFormatVal = (document.getElementById('nl-format') || {}).value || 'weekly';
      var subjectEl = document.getElementById('nl-subject');
      if (subjectEl && !subjectEl.value) {
        subjectEl.value = (nlFormatVal === 'monthly' ? 'Vidhai Monthly Digest' : 'Vidhai Weekly Digest') + ' \u2014 ' + dateStr;
      }

      var pending = 6;
      function checkDone() {
        pending--;
        if (pending <= 0) {
          nlAutofillBtn.disabled = false;
          nlAutofillBtn.textContent = '\u2705 Filled';
          setTimeout(function() { nlAutofillBtn.textContent = 'Auto-fill from DB'; }, 2000);
        }
      }

      // Fetch AI News (top 3 by sort_order)
      fetch('/api/content?table=ai_news')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var items = (data || []).sort(function(a, b) { return (a.sort_order || 0) - (b.sort_order || 0); }).slice(0, 3);
          if (items.length > 0) {
            nlSections.ai = items.map(function(item) {
              return {
                badge: item.badge || '',
                title: item.title || '',
                summary: item.summary || '',
                source: item.source_name || '',
                url: item.source_url || '',
                date: item.date_display || ''
              };
            });
            renderNLSection('ai');
          }
          checkDone();
        })
        .catch(function() { checkDone(); });

      // Fetch Semiconductor News (top 3)
      fetch('/api/content?table=semiconductor_news')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var items = (data || []).sort(function(a, b) { return (a.sort_order || 0) - (b.sort_order || 0); }).slice(0, 3);
          if (items.length > 0) {
            nlSections.semi = items.map(function(item) {
              return {
                badge: item.badge || '',
                title: item.title || '',
                summary: item.summary || '',
                source: item.source_name || '',
                url: item.source_url || '',
                date: ''
              };
            });
            renderNLSection('semi');
          }
          checkDone();
        })
        .catch(function() { checkDone(); });

      // Fetch Market Movers (top 3 by absolute change_percent)
      fetch('/api/content?table=market_movers')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var items = (data || []).sort(function(a, b) {
            var aVal = Math.abs(parseFloat((a.change_percent || '0').replace(/[^\d.-]/g, '')) || 0);
            var bVal = Math.abs(parseFloat((b.change_percent || '0').replace(/[^\d.-]/g, '')) || 0);
            return bVal - aVal;
          }).slice(0, 3);
          if (items.length > 0) {
            nlSections.invest = items.map(function(item) {
              // Format change_percent: add sign and % if it's a number
              var cp = item.change_percent;
              var changeStr = '';
              if (typeof cp === 'number') {
                changeStr = (cp >= 0 ? '+' : '') + cp.toFixed(2) + '%';
              } else if (cp) {
                changeStr = String(cp);
                if (changeStr.indexOf('%') < 0) changeStr += '%';
                if (changeStr.charAt(0) !== '-' && changeStr.charAt(0) !== '+') changeStr = '+' + changeStr;
              }
              return {
                ticker: item.ticker || '',
                title: item.company_name || item.name || '',
                price: item.price ? ('$' + item.price) : '',
                change: changeStr,
                context: item.category || ''
              };
            });
            renderNLSection('invest');
          }
          checkDone();
        })
        .catch(function() { checkDone(); });

      // Fetch Curated Videos (all)
      fetch('/api/content?table=curated_videos')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var items = (data || []).slice(0, 3);
          if (items.length > 0) {
            nlSections.video = items.map(function(item) {
              return {
                title: item.title || '',
                source: item.source_channel || '',
                url: item.url || '',
                duration: ''
              };
            });
            renderNLSection('video');
          }
          checkDone();
        })
        .catch(function() { checkDone(); });

      // Fetch Blog Posts (latest 3 by created_at)
      fetch('/api/content?table=posts')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var items = (data || []).sort(function(a, b) {
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
          }).slice(0, 3);
          if (items.length > 0) {
            nlSections.blog = items.map(function(item) {
              var titleSlug = (item.title || '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
              return {
                title: item.title || '',
                summary: item.excerpt || '',
                url: 'https://www.vidhai.co/blog.html#post-' + titleSlug
              };
            });
            renderNLSection('blog');
          }
          checkDone();
        })
        .catch(function() { checkDone(); });

      // Fetch Upcoming IPOs (top 3)
      fetch('/api/content?table=upcoming_ipos')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var items = (data || []).filter(function(i) { return i.is_active; }).slice(0, 3);
          if (items.length > 0) {
            nlSections.ipo = items.map(function(item) {
              return {
                title: item.company_name || '',
                date: item.expected_date || '',
                valuation: item.estimated_valuation || '',
                category: item.category || '',
                url: item.source_url || ''
              };
            });
            renderNLSection('ipo');
          }
          checkDone();
        })
        .catch(function() { checkDone(); });
    });
  }

  // Helper: validate newsletter has content
  function validateNewsletterContent() {
    var subject = (document.getElementById('nl-subject') || {}).value;
    if (!subject) {
      alert('Please enter a subject line.');
      return null;
    }
    var personalNote = (document.getElementById('nl-personal-note') || {}).value;
    if (!personalNote || !personalNote.trim()) {
      alert('Please add a personal note. It\u2019s required for reader engagement.');
      return null;
    }
    syncNLAllFields();
    var hasBlog = (nlSections.blog || []).some(function(s) { return s.title; });
    if (!hasBlog) {
      alert('Blog posts are required. Click Auto-fill to load the latest 3 posts.');
      return null;
    }
    var hasContent = ['ai','semi','blog','video','invest','ipo'].some(function(sec) {
      return nlSections[sec].some(function(s) { return s.title; });
    });
    if (!hasContent) {
      alert('Add at least one story to the newsletter.');
      return null;
    }
    return { subject: subject, htmlContent: buildNewsletterHTML() };
  }

  // Send Draft to Me button
  var nlDraftBtn = document.getElementById('nl-draft-btn');
  if (nlDraftBtn) {
    nlDraftBtn.addEventListener('click', function() {
      var content = validateNewsletterContent();
      if (!content) return;

      var statusEl = document.getElementById('nl-compose-status');
      nlDraftBtn.disabled = true;
      nlDraftBtn.textContent = 'Sending draft...';
      if (statusEl) statusEl.style.display = 'none';

      fetch('/api/newsletter-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: content.subject,
          htmlContent: content.htmlContent,
          testEmail: 'rsgowtham@gmail.com'
        })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        nlDraftBtn.disabled = false;
        nlDraftBtn.textContent = 'Send Draft to Me';
        if (statusEl) {
          statusEl.textContent = data.success ? ('\u2705 ' + data.message) : ('\u274c ' + (data.error || 'Failed to send draft.'));
          statusEl.style.display = 'block';
          statusEl.style.color = data.success ? '#22c55e' : '#f87171';
        }
      })
      .catch(function() {
        nlDraftBtn.disabled = false;
        nlDraftBtn.textContent = 'Send Draft to Me';
        if (statusEl) {
          statusEl.textContent = '\u274c Network error. Please try again.';
          statusEl.style.display = 'block';
          statusEl.style.color = '#f87171';
        }
      });
    });
  }

  // Publish to Subscribers button
  var nlSendBtn = document.getElementById('nl-send-btn');
  if (nlSendBtn) {
    nlSendBtn.addEventListener('click', function() {
      var content = validateNewsletterContent();
      if (!content) return;

      if (!confirm('Publish this newsletter to all active subscribers? This cannot be undone.')) return;

      var audience = (document.getElementById('nl-audience') || {}).value || 'all';
      var statusEl = document.getElementById('nl-compose-status');

      nlSendBtn.disabled = true;
      nlSendBtn.textContent = 'Publishing...';
      if (statusEl) statusEl.style.display = 'none';

      fetch('/api/newsletter-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: content.subject,
          htmlContent: content.htmlContent,
          frequency: audience
        })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        nlSendBtn.disabled = false;
        nlSendBtn.textContent = 'Publish to Subscribers';
        if (statusEl) {
          statusEl.textContent = data.success ? ('\u2705 ' + data.message) : ('\u274c ' + (data.error || 'Failed to send.'));
          statusEl.style.display = 'block';
          statusEl.style.color = data.success ? '#22c55e' : '#f87171';
        }
      })
      .catch(function() {
        nlSendBtn.disabled = false;
        nlSendBtn.textContent = 'Publish to Subscribers';
        if (statusEl) {
          statusEl.textContent = '\u274c Network error. Please try again.';
          statusEl.style.display = 'block';
          statusEl.style.color = '#f87171';
        }
      });
    });
  }

  // ========================================
  // CURATED VIDEOS — Dynamic Sidebar
  // ========================================

  var videosCache = [];          // All videos from API
  var videosDisplayCount = 3;    // Number currently shown
  var VIDEOS_PER_LOAD = 3;       // Increment on "Load More"
  var videoHistoryFilter = 'all';

  // --- Fetch videos from API ---
  function fetchVideos(showHistory, callback) {
    var qs = showHistory ? '?history=true' : '';
    fetch('/api/videos' + qs)
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (Array.isArray(data)) {
          callback(null, data);
        } else {
          callback(data.error || 'Unknown error');
        }
      })
      .catch(function(err) {
        callback(err.message || 'Network error');
      });
  }

  // --- Set preference (like/dislike) ---
  function setVideoPreference(videoId, pref, callback) {
    fetch('/api/videos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_id: videoId, preference: pref })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      callback(null, data);
    })
    .catch(function(err) {
      callback(err.message || 'Network error');
    });
  }

  // --- Render a single video card with thumbs ---
  function renderVideoCard(video) {
    var wrapper = document.createElement('div');
    wrapper.className = 'video-card-wrapper';
    wrapper.setAttribute('data-video-id', video.id);

    var isLiked = video.preference === 'liked';
    var isDisliked = video.preference === 'disliked';

    wrapper.innerHTML =
      '<a href="' + escapeHTML(video.url) + '" target="_blank" rel="noopener noreferrer" class="video-card">' +
        '<div class="video-card__thumb">' +
          '<img src="' + escapeHTML(video.thumbnail) + '" alt="' + escapeHTML(video.title) + '" loading="lazy">' +
          '<div class="video-card__play">' +
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><polygon points="8 5 19 12 8 19"/></svg>' +
          '</div>' +
        '</div>' +
        '<span class="video-card__label">' + escapeHTML(video.title) + '</span>' +
      '</a>' +
      '<div class="video-card__actions">' +
        '<button class="video-pref-btn' + (isLiked ? ' liked' : '') + '" data-action="liked" data-video-id="' + video.id + '" aria-label="Like" title="More like this">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="' + (isLiked ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>' +
        '</button>' +
        '<button class="video-pref-btn' + (isDisliked ? ' disliked' : '') + '" data-action="disliked" data-video-id="' + video.id + '" aria-label="Dislike" title="Not for me">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="' + (isDisliked ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>' +
        '</button>' +
        (video.category ? '<span class="video-card__category">' + escapeHTML(video.category) + '</span>' : '') +
      '</div>';

    return wrapper;
  }

  // --- Escape HTML helper ---
  function escapeHTML(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // --- Render video sidebar ---
  function renderVideoSidebar() {
    var container = document.getElementById('video-cards-container');
    var loadMoreBtn = document.getElementById('video-load-more');
    if (!container) return;

    fetchVideos(false, function(err, videos) {
      if (err || !videos) {
        container.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--text-xs);">Could not load videos.</p>';
        return;
      }
      videosCache = videos;
      videosDisplayCount = Math.min(VIDEOS_PER_LOAD, videos.length);
      renderVideoCards();
    });
  }

  function renderVideoCards() {
    var container = document.getElementById('video-cards-container');
    var loadMoreBtn = document.getElementById('video-load-more');
    if (!container) return;

    container.innerHTML = '';
    var showing = videosCache.slice(0, videosDisplayCount);
    for (var i = 0; i < showing.length; i++) {
      container.appendChild(renderVideoCard(showing[i]));
    }

    // Show/hide load more
    if (loadMoreBtn) {
      loadMoreBtn.style.display = (videosDisplayCount < videosCache.length) ? 'block' : 'none';
    }

    // Attach pref button events
    attachVideoPreferenceEvents(container);
  }

  // --- Attach click handlers for thumbs ---
  function attachVideoPreferenceEvents(container) {
    var btns = container.querySelectorAll('.video-pref-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var btn = e.currentTarget;
        var action = btn.getAttribute('data-action');
        var videoId = parseInt(btn.getAttribute('data-video-id'), 10);

        setVideoPreference(videoId, action, function(err) {
          if (err) return;

          // Update local cache
          for (var j = 0; j < videosCache.length; j++) {
            if (videosCache[j].id === videoId) {
              videosCache[j].preference = action;
              break;
            }
          }

          if (action === 'disliked') {
            // Animate removal
            var wrapper = container.querySelector('[data-video-id="' + videoId + '"]');
            if (wrapper) {
              wrapper.classList.add('fade-out');
              setTimeout(function() {
                // Remove from cache and re-render
                videosCache = videosCache.filter(function(v) { return v.id !== videoId; });
                renderVideoCards();
              }, 350);
            }
          } else {
            // Re-render to update button state
            renderVideoCards();
          }
        });
      });
    }
  }

  // --- Load More button ---
  var loadMoreBtn = document.getElementById('video-load-more');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', function() {
      videosDisplayCount = Math.min(videosDisplayCount + VIDEOS_PER_LOAD, videosCache.length);
      renderVideoCards();
    });
  }

  // --- History Panel ---
  var historyToggle = document.getElementById('video-history-toggle');
  var historyPanel = document.getElementById('video-history-panel');
  var historyClose = document.getElementById('video-history-close');

  if (historyToggle && historyPanel) {
    historyToggle.addEventListener('click', function() {
      var isOpen = historyPanel.style.display !== 'none';
      if (isOpen) {
        historyPanel.style.display = 'none';
        historyToggle.classList.remove('active');
      } else {
        historyPanel.style.display = 'block';
        historyToggle.classList.add('active');
        loadVideoHistory('all');
      }
    });
  }

  if (historyClose && historyPanel) {
    historyClose.addEventListener('click', function() {
      historyPanel.style.display = 'none';
      if (historyToggle) historyToggle.classList.remove('active');
    });
  }

  // --- History Tabs ---
  var historyTabs = document.querySelectorAll('.video-history-tab');
  for (var ti = 0; ti < historyTabs.length; ti++) {
    historyTabs[ti].addEventListener('click', function(e) {
      var filter = e.currentTarget.getAttribute('data-filter');
      // Update active tab
      for (var tj = 0; tj < historyTabs.length; tj++) {
        historyTabs[tj].classList.remove('active');
      }
      e.currentTarget.classList.add('active');
      loadVideoHistory(filter);
    });
  }

  function loadVideoHistory(filter) {
    videoHistoryFilter = filter;
    var listEl = document.getElementById('video-history-list');
    if (!listEl) return;

    listEl.innerHTML = '<p class="video-history-empty">Loading...</p>';

    fetchVideos(true, function(err, allVideos) {
      if (err || !allVideos) {
        listEl.innerHTML = '<p class="video-history-empty">Could not load history.</p>';
        return;
      }

      // Filter
      var filtered = allVideos;
      if (filter === 'liked') {
        filtered = allVideos.filter(function(v) { return v.preference === 'liked'; });
      } else if (filter === 'disliked') {
        filtered = allVideos.filter(function(v) { return v.preference === 'disliked'; });
      }

      if (filtered.length === 0) {
        listEl.innerHTML = '<p class="video-history-empty">No videos found.</p>';
        return;
      }

      listEl.innerHTML = '';
      for (var i = 0; i < filtered.length; i++) {
        listEl.appendChild(renderHistoryItem(filtered[i]));
      }
    });
  }

  function renderHistoryItem(video) {
    var item = document.createElement('a');
    item.href = video.url;
    item.target = '_blank';
    item.rel = 'noopener noreferrer';
    item.className = 'video-history-item';

    var prefIcon = '';
    if (video.preference === 'liked') {
      prefIcon = '<span class="video-history-item__pref liked" title="Liked">' +
        '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>' +
        '</span>';
    } else if (video.preference === 'disliked') {
      prefIcon = '<span class="video-history-item__pref disliked" title="Hidden">' +
        '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>' +
        '</span>';
    }

    var dateStr = '';
    if (video.added_date) {
      try {
        dateStr = new Date(video.added_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } catch(e) { /* ignore */ }
    }

    item.innerHTML =
      '<div class="video-history-item__thumb">' +
        '<img src="' + escapeHTML(video.thumbnail) + '" alt="" loading="lazy">' +
      '</div>' +
      '<div class="video-history-item__info">' +
        '<div class="video-history-item__title">' + escapeHTML(video.title) + '</div>' +
        '<div class="video-history-item__meta">' +
          (dateStr ? dateStr : '') +
          (video.source_channel ? ' · ' + escapeHTML(video.source_channel) : '') +
          ' ' + prefIcon +
        '</div>' +
      '</div>';

    return item;
  }

  // ========================================
  // INITIALIZATION
  // ========================================
  detectPage();

  // Load curated videos sidebar (home page only)
  if (!isBlogPage) {
    renderVideoSidebar();
  }

  loadPosts(function() {
    if (isBlogPage) {
      renderTagFilters();
      renderBlogPage();
      renderPagination();
      // Deep-link: auto-open post from URL hash (e.g. blog.html#post-the-semiconductor-equipment-paradox)
      var hash = window.location.hash;
      if (hash && hash.indexOf('#post-') === 0) {
        var slug = hash.substring(6);
        var posts = getPosts();
        for (var pi = 0; pi < posts.length; pi++) {
          var postSlug = (posts[pi].title || '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
          if (postSlug === slug) {
            openBlog(pi);
            break;
          }
        }
      }
    } else {
      renderBlogCards();
    }
  });


  // ========================================
  // CONTENT MANAGEMENT SYSTEM
  // ========================================

  var CONTENT_API = '/api/content';

  // --- Content API Helpers ---
  function fetchContent(table, includeInactive) {
    var url = CONTENT_API + '?table=' + encodeURIComponent(table);
    if (includeInactive) url += '&active=false';
    return fetch(url).then(function(r) {
      if (!r.ok) throw new Error('API returned ' + r.status);
      return r.json();
    });
  }

  function saveContent(table, data) {
    var method = data.id ? 'PUT' : 'POST';
    var body = Object.assign({}, data, { table: table });
    return fetch(CONTENT_API, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function(r) { return r.json(); });
  }

  function deleteContent(table, id) {
    return fetch(CONTENT_API + '?table=' + encodeURIComponent(table) + '&id=' + encodeURIComponent(id), {
      method: 'DELETE'
    }).then(function(r) { return r.json(); });
  }

  // --- SVG Icon for source links (reusable) ---
  var sourceLinkSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';

  // --- Badge class mapping ---
  function getBadgeClass(badge) {
    var b = (badge || '').toLowerCase();
    if (b.indexOf('model') >= 0 || b.indexOf('release') >= 0 || b.indexOf('edge') >= 0 || b.indexOf('innovation') >= 0) return 'badge--model';
    if (b.indexOf('hardware') >= 0 || b.indexOf('supply') >= 0 || b.indexOf('invest') >= 0) return 'badge--hardware';
    if (b.indexOf('research') >= 0 || b.indexOf('processor') >= 0) return 'badge--research';
    if (b.indexOf('product') >= 0 || b.indexOf('deal') >= 0) return 'badge--product';
    return 'badge--model';
  }

  // --- Industry Impact SVG Icon Mapping ---
  var industryIconMap = {
    healthcare: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9v.01"/><path d="M9 12v.01"/><path d="M9 15v.01"/><path d="M9 18v.01"/></svg>',
    pharmaceutical_manufacturing: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v2"/><circle cx="16" cy="16" r="4.5"/><path d="M18.5 13.5v5h-5"/></svg>',
    automotive_mobility: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h2l2-4h6l2 4h2"/><circle cx="7.5" cy="17" r="2.5"/><circle cx="16.5" cy="17" r="2.5"/><path d="M3 9h18"/><path d="M5 9l2-5h10l2 5"/></svg>',
    'manufacturing_industry_4.0': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20"/><path d="M5 20V8l4-4h6l4 4v12"/><path d="M9 20v-4h6v4"/><path d="M9 12h.01"/><path d="M15 12h.01"/></svg>',
    semiconductors: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
    enterprise_software: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'
  };

  var defaultIndustryIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';

  function getIndustryIcon(iconName) {
    return industryIconMap[iconName] || defaultIndustryIcon;
  }

  // ========================================
  // RENDER FUNCTIONS (Public Site)
  // ========================================

  function renderAINews() {
    var container = document.getElementById('news-cards');
    if (!container) return;
    fetchContent('ai_news').then(function(items) {
      if (!items || !items.length) {
        container.innerHTML = '<p class="admin-empty">No AI news items yet.</p>';
        return;
      }
      container.innerHTML = items.map(function(item) {
        return '<article class="card">' +
          '<div class="card__meta">' +
            '<span class="badge ' + getBadgeClass(item.badge) + '">' + escapeHTML(item.badge) + '</span>' +
            (item.date_display ? '<span class="card__date">' + escapeHTML(item.date_display) + '</span>' : '') +
          '</div>' +
          '<h3 class="card__title">' + escapeHTML(item.title) + '</h3>' +
          '<p class="card__summary">' + escapeHTML(item.summary) + '</p>' +
          '<div class="card__source">' + sourceLinkSVG +
            '<a href="' + escapeHTML(item.source_url || '#') + '" target="_blank" rel="noopener noreferrer">' + escapeHTML(item.source_name || 'Source') + '</a>' +
          '</div>' +
        '</article>';
      }).join('');
      // Re-trigger reveal
      container.classList.remove('is-visible');
      requestAnimationFrame(function() { container.classList.add('is-visible'); });
    }).catch(function() {
      container.innerHTML = '<p class="admin-empty">Could not load news.</p>';
    });
  }

  function renderSemiNews() {
    var container = document.getElementById('semi-cards');
    if (!container) return;
    fetchContent('semiconductor_news').then(function(items) {
      if (!items || !items.length) {
        container.innerHTML = '<p class="admin-empty">No semiconductor news yet.</p>';
        return;
      }
      container.innerHTML = items.map(function(item) {
        return '<article class="card">' +
          '<div class="card__meta">' +
            '<span class="badge ' + getBadgeClass(item.badge) + '">' + escapeHTML(item.badge) + '</span>' +
            (item.date_display ? '<span class="card__date">' + escapeHTML(item.date_display) + '</span>' : '') +
          '</div>' +
          '<h3 class="card__title">' + escapeHTML(item.title) + '</h3>' +
          '<p class="card__summary">' + escapeHTML(item.summary) + '</p>' +
          '<div class="card__source">' + sourceLinkSVG +
            '<a href="' + escapeHTML(item.source_url || '#') + '" target="_blank" rel="noopener noreferrer">' + escapeHTML(item.source_name || 'Source') + '</a>' +
          '</div>' +
        '</article>';
      }).join('');
      container.classList.remove('is-visible');
      requestAnimationFrame(function() { container.classList.add('is-visible'); });
    }).catch(function() {
      container.innerHTML = '<p class="admin-empty">Could not load semiconductor news.</p>';
    });
  }

  // Course card detail SVGs
  var clockSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
  var capSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>';

  function buildCourseCard(item) {
    var priceText = item.is_free ? (item.price || 'Free') : (item.price || 'Paid');
    return '<article class="course-card">' +
      '<span class="course-card__provider">' + escapeHTML(item.provider) + '</span>' +
      '<h3 class="course-card__title">' + escapeHTML(item.title) + '</h3>' +
      '<p class="course-card__desc">' + escapeHTML(item.description) + '</p>' +
      '<div class="course-card__details">' +
        '<span class="course-card__detail">' + clockSVG + ' ' + escapeHTML(item.duration || '') + '</span>' +
        '<span class="course-card__detail">' + capSVG + ' ' + escapeHTML(item.level || '') + '</span>' +
      '</div>' +
      '<div class="course-card__footer">' +
        '<span class="course-card__price">' + escapeHTML(priceText) + '</span>' +
        '<a href="' + escapeHTML(item.enroll_url || '#') + '" target="_blank" rel="noopener noreferrer" class="course-card__link">Enroll &rarr;</a>' +
      '</div>' +
    '</article>';
  }

  function renderTrainingCourses() {
    var freeContainer = document.getElementById('free-course-cards');
    var paidContainer = document.getElementById('paid-course-cards');
    if (!freeContainer && !paidContainer) return;

    fetchContent('training_courses').then(function(items) {
      var freeItems = items.filter(function(c) { return c.is_free; });
      var paidItems = items.filter(function(c) { return !c.is_free; });

      if (freeContainer) {
        freeContainer.innerHTML = freeItems.length ?
          freeItems.map(buildCourseCard).join('') :
          '<p class="admin-empty">No free courses yet.</p>';
        freeContainer.classList.remove('is-visible');
        requestAnimationFrame(function() { freeContainer.classList.add('is-visible'); });
      }
      if (paidContainer) {
        paidContainer.innerHTML = paidItems.length ?
          paidItems.map(buildCourseCard).join('') :
          '<p class="admin-empty">No paid courses yet.</p>';
      }
    }).catch(function() {
      if (freeContainer) freeContainer.innerHTML = '<p class="admin-empty">Could not load courses.</p>';
      if (paidContainer) paidContainer.innerHTML = '<p class="admin-empty">Could not load courses.</p>';
    });
  }

  function renderIndustryImpact() {
    var container = document.getElementById('industry-cards');
    if (!container) return;

    fetchContent('industry_impact').then(function(items) {
      if (!items || !items.length) {
        container.innerHTML = '<p class="admin-empty">No industry items yet.</p>';
        return;
      }
      container.innerHTML = items.map(function(item) {
        return '<article class="industry-card">' +
          '<div class="industry-card__icon">' + getIndustryIcon(item.icon_name) + '</div>' +
          '<h3 class="industry-card__title">' + escapeHTML(item.title) + '</h3>' +
          '<p class="industry-card__summary">' + escapeHTML(item.summary) + '</p>' +
          '<div class="industry-card__source">Source: ' +
            '<a href="' + escapeHTML(item.source_url || '#') + '" target="_blank" rel="noopener noreferrer">' + escapeHTML(item.source_name || 'Source') + '</a>' +
          '</div>' +
        '</article>';
      }).join('');
      container.classList.remove('is-visible');
      requestAnimationFrame(function() { container.classList.add('is-visible'); });
    }).catch(function() {
      container.innerHTML = '<p class="admin-empty">Could not load industry data.</p>';
    });
  }

  // MeetPilot featured tool SVG logo
  var meetPilotLogo = '<svg class="tool-featured__logo" width="40" height="40" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="8" fill="rgba(0,196,204,0.1)" stroke="rgba(0,196,204,0.2)" stroke-width="1"/><path d="M7 16 Q10.5 10 14 16 Q17.5 22 21 16 Q23.5 11.5 25 16" stroke="#00C4CC" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="16" cy="16" r="2.5" fill="rgba(0,196,204,0.3)" stroke="#00C4CC" stroke-width="1.25"/></svg>';

  function buildFeaturedToolHTML(tool) {
    var featuresArr = tool.features || [];
    var featureIcons = [
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8 12 Q10 8 12 12 Q14 16 16 12"/></svg>',
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>',
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
    ];

    var featuresHTML = featuresArr.map(function(f, i) {
      return '<div class="tool-featured__feature">' +
        (featureIcons[i % featureIcons.length]) +
        '<span>' + escapeHTML(f) + '</span>' +
      '</div>';
    }).join('');

    var actionsHTML = '';
    if (tool.launch_url) {
      actionsHTML += '<a href="' + escapeHTML(tool.launch_url) + '" target="_blank" rel="noopener noreferrer" class="tool-featured__btn tool-featured__btn--primary">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> Launch Web App</a>';
    }
    if (tool.mobile_url) {
      actionsHTML += '<a href="' + escapeHTML(tool.mobile_url) + '" target="_blank" rel="noopener noreferrer" class="tool-featured__btn tool-featured__btn--secondary">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> Launch Mobile App</a>';
    }

    return '<div class="tool-featured reveal">' +
      '<div class="tool-featured__header">' + meetPilotLogo +
        '<div><h3 class="tool-featured__name">' + escapeHTML(tool.name) + '</h3>' +
        '<p class="tool-featured__tagline">' + escapeHTML(tool.tagline || '') + '</p></div>' +
        '<span class="badge badge--live">Live</span>' +
      '</div>' +
      '<p class="tool-featured__desc">' + escapeHTML(tool.description || '') + '</p>' +
      (featuresHTML ? '<div class="tool-featured__features">' + featuresHTML + '</div>' : '') +
      (actionsHTML ? '<div class="tool-featured__actions">' + actionsHTML + '</div>' : '') +
    '</div>';
  }

  // Tool card icon SVGs by tags
  var toolIconSVGs = {
    'Vision AI': '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    'NLP': '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/></svg>',
    'Recommender': '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    'default': '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>'
  };

  function getToolIcon(tags) {
    if (!tags || !tags.length) return toolIconSVGs['default'];
    for (var i = 0; i < tags.length; i++) {
      if (toolIconSVGs[tags[i]]) return toolIconSVGs[tags[i]];
    }
    return toolIconSVGs['default'];
  }

  function renderAITools() {
    var featuredContainer = document.getElementById('tools-featured');
    var upcomingContainer = document.getElementById('tools-upcoming');
    var upcomingLabel = document.getElementById('tools-upcoming-label');
    if (!featuredContainer && !upcomingContainer) return;

    fetchContent('ai_tools').then(function(items) {
      var liveTools = items.filter(function(t) { return t.status === 'live'; });
      var comingTools = items.filter(function(t) { return t.status === 'coming_soon'; });

      if (featuredContainer) {
        featuredContainer.innerHTML = liveTools.map(buildFeaturedToolHTML).join('');
        // Re-register dynamically added .reveal elements for scroll reveal
        reveals = document.querySelectorAll('.reveal, .stagger');
        checkReveal();
      }

      if (upcomingContainer) {
        if (comingTools.length > 0) {
          if (upcomingLabel) upcomingLabel.style.display = '';
          upcomingContainer.innerHTML = comingTools.map(function(tool) {
            var tagsHTML = (tool.tags || []).map(function(t) {
              return '<span class="badge badge--tag">' + escapeHTML(t) + '</span>';
            }).join('');
            return '<article class="tool-card tool-card--teaser">' +
              '<div class="tool-card__badge"><span class="badge badge--coming-soon">Coming Soon</span></div>' +
              '<div class="tool-card__icon">' + getToolIcon(tool.tags) + '</div>' +
              '<h3 class="tool-card__title">' + escapeHTML(tool.name) + '</h3>' +
              '<p class="tool-card__desc">' + escapeHTML(tool.description || '') + '</p>' +
              '<div class="tool-card__tags">' + tagsHTML + '</div>' +
              '<div class="tool-card__teaser">' +
                '<span class="tool-card__teaser-text">' + (tool.preview_date ? 'Preview coming ' + escapeHTML(tool.preview_date) : 'Coming Soon') + '</span>' +
              '</div>' +
            '</article>';
          }).join('');
          upcomingContainer.classList.remove('is-visible');
          requestAnimationFrame(function() { upcomingContainer.classList.add('is-visible'); });
        } else {
          if (upcomingLabel) upcomingLabel.style.display = 'none';
          upcomingContainer.innerHTML = '';
        }
      }
    }).catch(function() {
      if (featuredContainer) featuredContainer.innerHTML = '<p class="admin-empty">Could not load tools.</p>';
    });
  }

  function renderBreakingNews() {
    var scrollEl = document.getElementById('breaking-news-scroll');
    if (!scrollEl) return;

    fetchContent('breaking_news').then(function(items) {
      if (!items || !items.length) {
        scrollEl.innerHTML = '<span class="breaking-news__item">No breaking news at this time.</span>';
        return;
      }
      // Build items HTML then duplicate for seamless loop
      var itemsHTML = items.map(function(item) {
        return '<a href="' + escapeHTML(item.source_url || '#') + '" target="_blank" rel="noopener noreferrer" class="breaking-news__item">' + escapeHTML(item.headline) + '</a>' +
          '<span class="breaking-news__divider">|</span>';
      }).join('\n      ');

      // Duplicate for seamless CSS scroll animation
      scrollEl.innerHTML = itemsHTML + '\n      ' + itemsHTML;
    }).catch(function() {
      scrollEl.innerHTML = '<span class="breaking-news__item">Could not load breaking news.</span>';
    });
  }

  // ========================================
  // INVESTMENTS — Market Movers, Chart, IPOs
  // ========================================

  function getCategoryBadgeClass(category) {
    var c = (category || '').toLowerCase();
    if (c === 'ai') return 'invest-badge--ai';
    if (c === 'semiconductor') return 'invest-badge--semi';
    return 'invest-badge--other';
  }

  function buildMoverRow(item) {
    var changeNum = parseFloat(item.change) || 0;
    var changePctNum = parseFloat(item.change_percent) || 0;
    var changeClass = changeNum >= 0 ? 'invest-change--up' : 'invest-change--down';
    var changeSign = changeNum >= 0 ? '+' : '';
    var pctSign = changePctNum >= 0 ? '+' : '';

    return '<tr data-ticker="' + escapeHTML(item.ticker) + '">' +
      '<td class="invest-ticker">' + escapeHTML(item.ticker) + '</td>' +
      '<td>' + escapeHTML(item.company_name) + '</td>' +
      '<td class="invest-price">$' + escapeHTML(String(item.price)) + '</td>' +
      '<td class="invest-change ' + changeClass + '">' + changeSign + escapeHTML(String(item.change)) + '</td>' +
      '<td class="invest-changepct ' + changeClass + '">' + pctSign + escapeHTML(String(item.change_percent)) + '%</td>' +
      '<td class="invest-pe">' + (item.pe_ratio != null ? escapeHTML(String(item.pe_ratio)) : '—') + '</td>' +
      '<td class="invest-mcap">' + escapeHTML(item.market_cap || '') + '</td>' +
      '<td><span class="invest-badge ' + getCategoryBadgeClass(item.category) + '">' + escapeHTML(item.category || '') + '</span></td>' +
    '</tr>';
  }

  function fetchLivePrices(items) {
    var tickers = items.map(function(it) { return it.ticker; }).join(',');
    var apiBase = window.location.origin;
    return fetch(apiBase + '/api/stock-prices?tickers=' + encodeURIComponent(tickers))
      .then(function(resp) { return resp.ok ? resp.json() : null; })
      .then(function(data) {
        if (!data || !data.quotes) return;
        var tbody = document.getElementById('market-movers-body');
        if (!tbody) return;

        items.forEach(function(item) {
          var live = data.quotes[item.ticker];
          if (!live || live.price == null) return;

          var row = tbody.querySelector('tr[data-ticker="' + item.ticker + '"]');
          if (!row) return;

          var changeNum = live.change != null ? live.change : 0;
          var changePctNum = live.change_percent != null ? live.change_percent : 0;
          var changeClass = changeNum >= 0 ? 'invest-change--up' : 'invest-change--down';
          var changeSign = changeNum >= 0 ? '+' : '';
          var pctSign = changePctNum >= 0 ? '+' : '';

          var priceCell = row.querySelector('.invest-price');
          var changeCell = row.querySelector('.invest-change');
          var changePctCell = row.querySelector('.invest-changepct');
          var mcapCell = row.querySelector('.invest-mcap');

          if (priceCell) {
            priceCell.textContent = '$' + live.price.toFixed(2);
            priceCell.classList.add('invest-price-flash');
          }
          if (changeCell) {
            changeCell.textContent = changeSign + changeNum.toFixed(2);
            changeCell.className = 'invest-change ' + changeClass;
          }
          if (changePctCell) {
            changePctCell.textContent = pctSign + changePctNum.toFixed(2) + '%';
            changePctCell.className = 'invest-changepct ' + changeClass;
          }
          if (mcapCell && live.market_cap) {
            mcapCell.textContent = live.market_cap;
          }

          var peCell = row.querySelector('.invest-pe');
          if (peCell && live.pe_ratio != null) {
            peCell.textContent = live.pe_ratio.toFixed(2);
          }
        });

        // Update the timestamp
        var tsEl = document.getElementById('movers-timestamp');
        if (tsEl && data.fetched_at) {
          var d = new Date(data.fetched_at);
          tsEl.textContent = 'Live prices as of ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          tsEl.style.display = 'block';
        }
      })
      .catch(function() { /* silent — DB values remain as fallback */ });
  }

  function renderMarketMovers() {
    var tbody = document.getElementById('market-movers-body');
    if (!tbody) return;

    fetchContent('market_movers').then(function(items) {
      if (!items || !items.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="admin-empty">No market movers data yet.</td></tr>';
        return;
      }
      tbody.innerHTML = items.map(buildMoverRow).join('');

      // Fetch live prices to overlay on top of DB values
      fetchLivePrices(items);
    }).catch(function() {
      tbody.innerHTML = '<tr><td colspan="8" class="admin-empty">Could not load market movers.</td></tr>';
    });
  }

  function renderUpcomingIPOs() {
    var container = document.getElementById('ipo-cards');
    if (!container) return;

    fetchContent('upcoming_ipos').then(function(items) {
      if (!items || !items.length) {
        container.innerHTML = '<p class="admin-empty">No upcoming IPOs yet.</p>';
        return;
      }
      container.innerHTML = items.map(function(item) {
        var statusClass = '';
        var s = (item.status || '').toLowerCase();
        if (s === 'filed') statusClass = 'invest-status--filed';
        else if (s === 'preparing') statusClass = 'invest-status--preparing';
        else statusClass = 'invest-status--early';

        return '<article class="ipo-card">' +
          '<div class="ipo-card__header">' +
            '<h4 class="ipo-card__name">' + escapeHTML(item.company_name) + '</h4>' +
            '<div class="ipo-card__badges">' +
              '<span class="invest-badge ' + getCategoryBadgeClass(item.category) + '">' + escapeHTML(item.category || '') + '</span>' +
              '<span class="invest-status ' + statusClass + '">' + escapeHTML(item.status || '') + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="ipo-card__details">' +
            '<div class="ipo-card__detail"><span class="ipo-card__label">Expected</span><span class="ipo-card__value">' + escapeHTML(item.expected_date || 'TBD') + '</span></div>' +
            '<div class="ipo-card__detail"><span class="ipo-card__label">Valuation</span><span class="ipo-card__value">' + escapeHTML(item.estimated_valuation || 'TBD') + '</span></div>' +
          '</div>' +
          '<p class="ipo-card__desc">' + escapeHTML(item.description || '') + '</p>' +
          (item.source_url ? '<a href="' + escapeHTML(item.source_url) + '" target="_blank" rel="noopener noreferrer" class="ipo-card__source">' + sourceLinkSVG + ' Source</a>' : '') +
        '</article>';
      }).join('');
      container.classList.remove('is-visible');
      requestAnimationFrame(function() { container.classList.add('is-visible'); });
    }).catch(function() {
      container.innerHTML = '<p class="admin-empty">Could not load upcoming IPOs.</p>';
    });
  }

  // ========================================
  // ADMIN CONTENT CRUD
  // ========================================

  var contentEditTable = '';
  var contentEditItem = null;

  // Table-to-view mapping
  var tableViewMap = {
    ai_news: 'content-news',
    semiconductor_news: 'content-semi',
    training_courses: 'content-training',
    industry_impact: 'content-industry',
    ai_tools: 'content-tools',
    breaking_news: 'content-ticker',
    market_movers: 'content-movers',
    upcoming_ipos: 'content-ipos'
  };

  var tableListMap = {
    ai_news: 'admin-content-news-list',
    semiconductor_news: 'admin-content-semi-list',
    training_courses: 'admin-content-training-list',
    industry_impact: 'admin-content-industry-list',
    ai_tools: 'admin-content-tools-list',
    breaking_news: 'admin-content-ticker-list',
    market_movers: 'admin-content-movers-list',
    upcoming_ipos: 'admin-content-ipos-list'
  };

  // Form field definitions for each table
  var tableFields = {
    ai_news: [
      { key: 'badge', label: 'Badge/Category', type: 'text', placeholder: 'e.g. Model Releases, Hardware, Research' },
      { key: 'date_display', label: 'Date Display', type: 'text', placeholder: 'e.g. March 3, 2026' },
      { key: 'title', label: 'Title', type: 'text', placeholder: 'News headline', required: true },
      { key: 'summary', label: 'Summary', type: 'textarea', placeholder: 'Brief summary of the news' },
      { key: 'source_name', label: 'Source Name', type: 'text', placeholder: 'e.g. Reuters, TechCrunch' },
      { key: 'source_url', label: 'Source URL', type: 'text', placeholder: 'https://...' },
      { key: 'sort_order', label: 'Sort Order', type: 'number', placeholder: '1' },
      { key: 'is_active', label: 'Active', type: 'toggle' }
    ],
    semiconductor_news: [
      { key: 'badge', label: 'Badge/Category', type: 'text', placeholder: 'e.g. Supply Chain, Deal, Investment' },
      { key: 'date_display', label: 'Date Display', type: 'text', placeholder: 'e.g. March 2026' },
      { key: 'title', label: 'Title', type: 'text', placeholder: 'News headline', required: true },
      { key: 'summary', label: 'Summary', type: 'textarea', placeholder: 'Brief summary' },
      { key: 'source_name', label: 'Source Name', type: 'text', placeholder: 'e.g. EnkiAI' },
      { key: 'source_url', label: 'Source URL', type: 'text', placeholder: 'https://...' },
      { key: 'sort_order', label: 'Sort Order', type: 'number', placeholder: '1' },
      { key: 'is_active', label: 'Active', type: 'toggle' }
    ],
    training_courses: [
      { key: 'provider', label: 'Provider', type: 'text', placeholder: 'e.g. DeepLearning.AI' },
      { key: 'title', label: 'Title', type: 'text', placeholder: 'Course title', required: true },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Course description' },
      { key: 'duration', label: 'Duration', type: 'text', placeholder: 'e.g. 30 hours' },
      { key: 'level', label: 'Level', type: 'text', placeholder: 'e.g. Beginner, Intermediate' },
      { key: 'price', label: 'Price Display', type: 'text', placeholder: 'e.g. Free Certificate, $49/mo' },
      { key: 'enroll_url', label: 'Enrollment URL', type: 'text', placeholder: 'https://...' },
      { key: 'is_free', label: 'Free Course', type: 'toggle' },
      { key: 'sort_order', label: 'Sort Order', type: 'number', placeholder: '1' },
      { key: 'is_active', label: 'Active', type: 'toggle' }
    ],
    industry_impact: [
      { key: 'icon_name', label: 'Icon', type: 'select', options: ['healthcare', 'pharmaceutical_manufacturing', 'automotive_mobility', 'manufacturing_industry_4.0', 'semiconductors', 'enterprise_software'] },
      { key: 'title', label: 'Title', type: 'text', placeholder: 'Industry name', required: true },
      { key: 'summary', label: 'Summary', type: 'textarea', placeholder: 'Impact description' },
      { key: 'source_name', label: 'Source Name', type: 'text', placeholder: 'e.g. Bessemer Venture Partners' },
      { key: 'source_url', label: 'Source URL', type: 'text', placeholder: 'https://...' },
      { key: 'sort_order', label: 'Sort Order', type: 'number', placeholder: '1' },
      { key: 'is_active', label: 'Active', type: 'toggle' }
    ],
    ai_tools: [
      { key: 'name', label: 'Tool Name', type: 'text', placeholder: 'e.g. MeetPilot', required: true },
      { key: 'tagline', label: 'Tagline', type: 'text', placeholder: 'Short tagline' },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Full description' },
      { key: 'features', label: 'Features (comma-separated)', type: 'text', placeholder: 'Feature 1, Feature 2, Feature 3' },
      { key: 'tags', label: 'Tags (comma-separated)', type: 'text', placeholder: 'Vision AI, Manufacturing' },
      { key: 'status', label: 'Status', type: 'select', options: ['live', 'coming_soon'] },
      { key: 'launch_url', label: 'Web Launch URL', type: 'text', placeholder: './meetpilot.html' },
      { key: 'mobile_url', label: 'Mobile Launch URL', type: 'text', placeholder: './meetpilot-mobile.html' },
      { key: 'preview_date', label: 'Preview Date', type: 'text', placeholder: 'e.g. March 2026' },
      { key: 'sort_order', label: 'Sort Order', type: 'number', placeholder: '1' },
      { key: 'is_active', label: 'Active', type: 'toggle' }
    ],
    breaking_news: [
      { key: 'headline', label: 'Headline', type: 'text', placeholder: 'Breaking news headline', required: true },
      { key: 'source_url', label: 'Source URL', type: 'text', placeholder: 'https://...' },
      { key: 'sort_order', label: 'Sort Order', type: 'number', placeholder: '1' },
      { key: 'is_active', label: 'Active', type: 'toggle' }
    ],
    market_movers: [
      { key: 'ticker', label: 'Ticker', type: 'text', placeholder: 'e.g. NVDA', required: true },
      { key: 'company_name', label: 'Company Name', type: 'text', placeholder: 'e.g. NVIDIA Corporation', required: true },
      { key: 'price', label: 'Price', type: 'text', placeholder: 'e.g. 875.50' },
      { key: 'change', label: 'Change ($)', type: 'text', placeholder: 'e.g. 12.30 or -5.20' },
      { key: 'change_percent', label: 'Change (%)', type: 'text', placeholder: 'e.g. 1.42 or -0.60' },
      { key: 'market_cap', label: 'Market Cap', type: 'text', placeholder: 'e.g. $2.15T' },
      { key: 'category', label: 'Category', type: 'select', options: ['AI', 'Semiconductor', 'Other'] },
      { key: 'sort_order', label: 'Sort Order', type: 'number', placeholder: '1' },
      { key: 'is_active', label: 'Active', type: 'toggle' }
    ],
    upcoming_ipos: [
      { key: 'company_name', label: 'Company Name', type: 'text', placeholder: 'e.g. Databricks', required: true },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Brief company description' },
      { key: 'estimated_valuation', label: 'Estimated Valuation', type: 'text', placeholder: 'e.g. $43B' },
      { key: 'expected_date', label: 'Expected Date', type: 'text', placeholder: 'e.g. H2 2026' },
      { key: 'category', label: 'Category', type: 'select', options: ['AI', 'Semiconductor', 'Other'] },
      { key: 'status', label: 'Status', type: 'select', options: ['Preparing', 'Filed', 'Early Stage'] },
      { key: 'source_url', label: 'Source URL', type: 'text', placeholder: 'https://...' },
      { key: 'sort_order', label: 'Sort Order', type: 'number', placeholder: '1' },
      { key: 'is_active', label: 'Active', type: 'toggle' }
    ]
  };

  function getItemDisplayTitle(table, item) {
    if (table === 'breaking_news') return item.headline || 'Untitled';
    if (table === 'ai_tools') return item.name || 'Untitled';
    if (table === 'market_movers') return (item.ticker || '') + ' — ' + (item.company_name || 'Untitled');
    if (table === 'upcoming_ipos') return item.company_name || 'Untitled';
    return item.title || item.name || item.headline || 'Untitled';
  }

  function getItemDisplayBadge(table, item) {
    if (table === 'training_courses') return item.is_free ? 'Free' : 'Paid';
    if (table === 'ai_tools') return item.status === 'live' ? 'Live' : 'Coming Soon';
    if (table === 'breaking_news') return item.is_active ? 'Active' : 'Inactive';
    if (table === 'market_movers') return (item.category || '') + ' — $' + (item.price || '');
    if (table === 'upcoming_ipos') return (item.category || '') + ' — ' + (item.status || '');
    return item.badge || '';
  }

  function showContentList(table) {
    var listEl = document.getElementById(tableListMap[table]);
    if (!listEl) return;

    listEl.innerHTML = '<p class="admin-empty">Loading...</p>';

    fetchContent(table, true).then(function(items) {
      if (!items || !items.length) {
        listEl.innerHTML = '<p class="admin-empty">No items yet. Click the button above to add one.</p>';
        return;
      }

      listEl.innerHTML = items.map(function(item) {
        var title = getItemDisplayTitle(table, item);
        var badge = getItemDisplayBadge(table, item);
        var activeClass = item.is_active === false ? ' style="opacity:0.5"' : '';
        return '<div class="admin-post-item"' + activeClass + '>' +
          '<div class="admin-post-item__info">' +
            '<h4 class="admin-post-item__title">' + escapeHTML(title) + '</h4>' +
            '<span class="admin-post-item__meta">' + escapeHTML(badge) + (item.is_active === false ? ' &middot; Inactive' : '') + '</span>' +
          '</div>' +
          '<div class="admin-post-item__actions">' +
            '<button class="admin-btn admin-btn--sm admin-btn--edit" data-content-edit-table="' + table + '" data-content-edit-id="' + item.id + '">Edit</button>' +
            '<button class="admin-btn admin-btn--sm admin-btn--delete" data-content-delete-table="' + table + '" data-content-delete-id="' + item.id + '">Delete</button>' +
          '</div>' +
        '</div>';
      }).join('');

      // Bind edit buttons
      listEl.querySelectorAll('[data-content-edit-id]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var editTable = btn.getAttribute('data-content-edit-table');
          var editId = parseInt(btn.getAttribute('data-content-edit-id'), 10);
          var editItem = items.find(function(it) { return it.id === editId; });
          if (editItem) showContentForm(editTable, editItem);
        });
      });

      // Bind delete buttons
      listEl.querySelectorAll('[data-content-delete-id]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var delTable = btn.getAttribute('data-content-delete-table');
          var delId = parseInt(btn.getAttribute('data-content-delete-id'), 10);
          deleteContentItem(delTable, delId);
        });
      });
    }).catch(function() {
      listEl.innerHTML = '<p class="admin-empty">Failed to load items. Is the API connected?</p>';
    });
  }

  function showContentForm(table, item) {
    contentEditTable = table;
    contentEditItem = item || null;

    var titleEl = document.getElementById('content-form-title');
    var fieldsEl = document.getElementById('content-form-fields');
    if (!titleEl || !fieldsEl) return;

    titleEl.textContent = item ? 'Edit Item' : 'Add Item';

    var fields = tableFields[table] || [];
    fieldsEl.innerHTML = fields.map(function(field) {
      var val = '';
      if (item) {
        val = item[field.key];
        // Handle arrays for features and tags
        if (Array.isArray(val)) val = val.join(', ');
        if (val === null || val === undefined) val = '';
        if (typeof val === 'boolean') val = val;
        else val = String(val);
      }

      if (field.type === 'toggle') {
        var checked = item ? (item[field.key] !== false) : (field.key === 'is_active');
        return '<div class="admin-field">' +
          '<label class="content-toggle-label">' +
            '<span>' + escapeHTML(field.label) + '</span>' +
            '<label class="content-toggle">' +
              '<input type="checkbox" name="' + field.key + '"' + (checked ? ' checked' : '') + '>' +
              '<span class="content-toggle__slider"></span>' +
            '</label>' +
          '</label>' +
        '</div>';
      }

      if (field.type === 'select') {
        var optionsHTML = (field.options || []).map(function(opt) {
          return '<option value="' + escapeHTML(opt) + '"' + (val === opt ? ' selected' : '') + '>' + escapeHTML(opt) + '</option>';
        }).join('');
        return '<div class="admin-field">' +
          '<label>' + escapeHTML(field.label) + '</label>' +
          '<select name="' + field.key + '" class="admin-input">' + optionsHTML + '</select>' +
        '</div>';
      }

      if (field.type === 'textarea') {
        return '<div class="admin-field">' +
          '<label>' + escapeHTML(field.label) + '</label>' +
          '<textarea name="' + field.key + '" class="admin-textarea" rows="3" placeholder="' + escapeHTML(field.placeholder || '') + '">' + escapeHTML(val) + '</textarea>' +
        '</div>';
      }

      return '<div class="admin-field">' +
        '<label>' + escapeHTML(field.label) + '</label>' +
        '<input type="' + (field.type === 'number' ? 'number' : 'text') + '" name="' + field.key + '" class="admin-input" value="' + escapeHTML(val) + '" placeholder="' + escapeHTML(field.placeholder || '') + '"' + (field.required ? ' required' : '') + '>' +
      '</div>';
    }).join('');

    showAdminView('content-form');
  }

  function saveContentItem(e) {
    e.preventDefault();
    var form = document.getElementById('content-editor-form');
    if (!form || !contentEditTable) return;

    var fields = tableFields[contentEditTable] || [];
    var data = {};
    if (contentEditItem && contentEditItem.id) {
      data.id = contentEditItem.id;
    }

    fields.forEach(function(field) {
      if (field.type === 'toggle') {
        var checkbox = form.querySelector('input[name="' + field.key + '"]');
        data[field.key] = checkbox ? checkbox.checked : true;
      } else if (field.key === 'features' || field.key === 'tags') {
        var val = (form.querySelector('[name="' + field.key + '"]') || {}).value || '';
        data[field.key] = val.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
      } else if (field.type === 'number') {
        var numVal = (form.querySelector('[name="' + field.key + '"]') || {}).value;
        data[field.key] = numVal ? parseInt(numVal, 10) : 0;
      } else {
        data[field.key] = (form.querySelector('[name="' + field.key + '"]') || {}).value || '';
      }
    });

    var saveBtn = form.querySelector('button[type="submit"]');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

    saveContent(contentEditTable, data).then(function(result) {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
      if (result.error) {
        alert('Error saving: ' + result.error);
        return;
      }
      // Go back to the content list and refresh public section
      var viewName = tableViewMap[contentEditTable];
      showAdminView(viewName);
      showContentList(contentEditTable);
      refreshPublicSection(contentEditTable);
    }).catch(function(err) {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
      alert('Failed to save: ' + (err.message || 'Unknown error'));
    });
  }

  function deleteContentItem(table, id) {
    if (!confirm('Are you sure you want to delete this item?')) return;
    deleteContent(table, id).then(function(result) {
      if (result.error) {
        alert('Error deleting: ' + result.error);
        return;
      }
      showContentList(table);
      refreshPublicSection(table);
    }).catch(function(err) {
      alert('Failed to delete: ' + (err.message || 'Unknown error'));
    });
  }

  function refreshPublicSection(table) {
    if (table === 'ai_news') renderAINews();
    else if (table === 'semiconductor_news') renderSemiNews();
    else if (table === 'training_courses') renderTrainingCourses();
    else if (table === 'industry_impact') renderIndustryImpact();
    else if (table === 'ai_tools') renderAITools();
    else if (table === 'breaking_news') renderBreakingNews();
    else if (table === 'market_movers') renderMarketMovers();
    else if (table === 'upcoming_ipos') renderUpcomingIPOs();
  }

  // ========================================
  // ADMIN TAB SYSTEM EXTENSION
  // ========================================

  // Extend existing admin tab click handler to handle new content tabs
  if (adminTabsContainer) {
    var allAdminTabBtns = adminTabsContainer.querySelectorAll('[data-admin-tab]');
    allAdminTabBtns.forEach(function(tabBtn) {
      tabBtn.addEventListener('click', function() {
        var target = tabBtn.getAttribute('data-admin-tab');
        allAdminTabBtns.forEach(function(b) { b.classList.remove('active'); });
        tabBtn.classList.add('active');

        if (target === 'posts') {
          showAdminView('list');
          renderAdminPostList();
        } else if (target === 'subscribers') {
          showAdminView('subscribers');
          renderSubscriberList();
        } else if (target === 'newsletter') {
          showAdminView('newsletter');
        } else if (target.indexOf('content-') === 0) {
          // Content management tabs
          showAdminView(target);
          var tableKey = {
            'content-news': 'ai_news',
            'content-semi': 'semiconductor_news',
            'content-training': 'training_courses',
            'content-industry': 'industry_impact',
            'content-tools': 'ai_tools',
            'content-ticker': 'breaking_news',
            'content-movers': 'market_movers',
            'content-ipos': 'upcoming_ipos'
          }[target];
          if (tableKey) showContentList(tableKey);
        }
      });
    });
  }

  // Bind content-form submission
  var contentEditorForm = document.getElementById('content-editor-form');
  if (contentEditorForm) {
    contentEditorForm.addEventListener('submit', saveContentItem);
  }

  // Bind content cancel button
  var contentCancelBtn = document.getElementById('content-cancel-edit');
  if (contentCancelBtn) {
    contentCancelBtn.addEventListener('click', function() {
      var viewName = tableViewMap[contentEditTable] || 'list';
      showAdminView(viewName);
    });
  }

  // Bind "Add New" buttons for each content type
  document.querySelectorAll('[data-content-add]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var table = btn.getAttribute('data-content-add');
      showContentForm(table, null);
    });
  });

  // ========================================
  // INITIALIZE CONTENT SECTIONS ON PAGE LOAD
  // ========================================

  if (!isBlogPage) {
    renderBreakingNews();
    renderAINews();
    renderSemiNews();
    renderTrainingCourses();
    renderIndustryImpact();
    renderMarketMovers();
    renderUpcomingIPOs();
    renderAITools();
  }

  // Handle hash-based deep linking after dynamic content has loaded
  // Waits briefly for dynamic content to render, then scrolls to the target
  (function handleDeepLink() {
    var hash = window.location.hash;
    if (!hash) return;
    // Small delay to let dynamic content render and shift layout
    setTimeout(function() {
      var target = document.querySelector(hash);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 600);
  })();

})();
