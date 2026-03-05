// ========================================
// VIDHAI — App JS
// ========================================

(function() {
  'use strict';

  // --- Quill Editor Instance ---
  var quillEditor = null;

  // --- Blog Data (in-memory store, loaded from posts.json) ---
  var memoryPosts = null;
  var postsLoaded = false;

  // --- Blog Page State ---
  var POSTS_PER_PAGE = 6;
  var currentPage = 1;
  var activeTag = 'All';

  // --- Page Detection ---
  var isBlogPage = false;

  function detectPage() {
    isBlogPage = !!document.getElementById('blog-page-container');
  }

  // --- Load Posts from posts.json ---
  function loadPosts(callback) {
    if (postsLoaded && memoryPosts) {
      callback(memoryPosts);
      return;
    }
    fetch('./posts.json')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        memoryPosts = data;
        postsLoaded = true;
        callback(memoryPosts);
      })
      .catch(function(err) {
        console.warn('Could not load posts.json, using empty array:', err);
        memoryPosts = [];
        postsLoaded = true;
        callback(memoryPosts);
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
  var theme = 'dark';
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

    blogPostContent.innerHTML = 
      '<button class="blog-post__close" aria-label="Close article"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
      '<div class="blog-post__meta"><span>' + escapeHTML(post.author) + '</span><span class="dot-separator">' + escapeHTML(post.date) + '</span><span class="dot-separator">' + escapeHTML(post.readTime) + '</span></div>' +
      '<h2 class="blog-post__title">' + escapeHTML(post.title) + '</h2>' +
      '<div class="blog-post__tags">' + tagsHTML + '</div>' +
      '<div class="blog-post__content">' + contentHTML + '</div>';

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
  // NEWSLETTER FORM (FormSubmit.co)
  // ========================================
  var newsletterForm = document.getElementById('newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var emailInput = document.getElementById('newsletter-email');
      var email = emailInput.value.trim();
      if (!email) return;

      var freq = newsletterForm.querySelector('input[name="frequency"]:checked');
      var frequency = freq ? freq.value : 'weekly';

      var btn = document.getElementById('newsletter-btn');
      var successEl = document.getElementById('newsletter-success');
      var errorEl = document.getElementById('newsletter-error');

      // Disable button during submission
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Subscribing...';
      }

      // Hide previous messages
      if (successEl) successEl.style.display = 'none';
      if (errorEl) errorEl.style.display = 'none';

      // Build form data
      var formData = new FormData();
      formData.append('email', email);
      formData.append('frequency', frequency);
      formData.append('_subject', 'New Vidhai Newsletter Subscriber!');
      formData.append('_autoresponse', 'Welcome to Vidhai! Thank you for subscribing to our newsletter. You will receive curated AI and semiconductor industry insights directly in your inbox. We are glad to have you on board. \u2014 Team Vidhai (vidhai.co)');
      formData.append('_template', 'table');
      formData.append('_captcha', 'false');

      // Send via AJAX to FormSubmit.co
      fetch('https://formsubmit.co/ajax/rsgowtham@gmail.com', {
        method: 'POST',
        body: formData
      })
      .then(function(response) {
        return response.json();
      })
      .then(function(data) {
        if (data.success === 'true' || data.success === true) {
          newsletterForm.style.display = 'none';
          if (successEl) successEl.style.display = 'block';
        } else {
          if (errorEl) errorEl.style.display = 'block';
          if (btn) {
            btn.disabled = false;
            btn.textContent = 'Subscribe';
          }
        }
      })
      .catch(function() {
        if (errorEl) errorEl.style.display = 'block';
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Subscribe';
        }
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

          if (quillEditor) {
            // If editor already has content, ask before replacing
            var currentContent = quillEditor.getText().trim();
            if (currentContent.length > 0) {
              if (!confirm('The editor already has content. Replace it with the imported document?')) {
                if (importDocxStatus) {
                  importDocxStatus.textContent = 'Import cancelled.';
                  importDocxStatus.style.color = '#94a3b8';
                }
                importDocxInput.value = '';
                return;
              }
            }
            // Clear and paste HTML to preserve tables, lists, and formatting
            quillEditor.setText('');
            // Use dangerouslyPasteHTML for lists and text formatting
            // Then set innerHTML directly to also preserve tables
            quillEditor.root.innerHTML = html;
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
    // Load content into Quill
    if (quillEditor && post.content) {
      quillEditor.root.innerHTML = post.content;
    }
  }

  function clearEditorForm() {
    document.getElementById('editor-title').value = '';
    document.getElementById('editor-author').value = 'Gowtham';
    document.getElementById('editor-tags').value = '';
    document.getElementById('editor-excerpt').value = '';
    document.getElementById('editor-content').value = '';
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

      // Get content from Quill if available, fallback to textarea
      var content;
      if (quillEditor) {
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

      if (currentEditIndex >= 0 && currentEditIndex < posts.length) {
        // Update existing
        posts[currentEditIndex].title = title;
        posts[currentEditIndex].author = author;
        posts[currentEditIndex].tags = tags;
        posts[currentEditIndex].excerpt = excerpt || stripHTMLTags(content).substring(0, 200) + '...';
        posts[currentEditIndex].content = content;
        posts[currentEditIndex].readTime = readTime;
        // Keep original date unless it's new
      } else {
        // New post — add to beginning
        posts.unshift({
          id: generateId(),
          title: title,
          date: date,
          author: author,
          readTime: readTime,
          tags: tags,
          excerpt: excerpt || stripHTMLTags(content).substring(0, 200) + '...',
          content: content
        });
      }

      savePosts(posts);
      refreshAllViews();
      renderAdminPostList();

      // Determine saved post index for LinkedIn
      var savedPostIndex = (currentEditIndex >= 0) ? currentEditIndex : 0;
      currentEditIndex = -1;

      // After save, prompt for LinkedIn
      var doLinkedIn = confirm('Post saved!\n\nWould you like to post this to LinkedIn?\n\n(To make this blog post permanent, tell your AI assistant to update the site.)');
      if (doLinkedIn) {
        openLinkedInView(savedPostIndex);
      } else {
        showAdminView('list');
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
    posts.splice(index, 1);
    savePosts(posts);
    refreshAllViews();
    renderAdminPostList();
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
      'Read the full article \u2192 https://vidhai.co\n\n' +
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
  // INITIALIZATION
  // ========================================
  detectPage();

  loadPosts(function() {
    if (isBlogPage) {
      renderTagFilters();
      renderBlogPage();
      renderPagination();
    } else {
      renderBlogCards();
    }
  });

})();
