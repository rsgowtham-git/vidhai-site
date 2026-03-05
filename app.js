// ========================================
// VIDHAI — App JS
// ========================================

(function() {
  'use strict';

  // --- Default blog posts (seeded on first load) ---
  var defaultBlogPosts = [
    {
      id: 'post-1',
      title: "Why I Started Vidhai",
      date: "March 4, 2026",
      author: "Gowtham",
      readTime: "3 min read",
      tags: ["Personal", "AI", "Vision"],
      excerpt: "In Tamil, \u2018Vidhai\u2019 means seed. Every transformative technology starts as a seed \u2014 an idea that, given the right conditions, grows into something that reshapes the world. AI is that seed for our generation.",
      content: "In Tamil, \u2018Vidhai\u2019 means seed. Every transformative technology starts as a seed \u2014 an idea that, given the right conditions, grows into something that reshapes the world. AI is that seed for our generation.\n\nAs someone who has spent over two decades in manufacturing, engineering services, and business development, I\u2019ve watched technology waves come and go. But generative AI is different. It\u2019s not just automating tasks \u2014 it\u2019s fundamentally changing how we think, create, and solve problems.\n\nI created Vidhai to be a curated space where professionals like me can stay informed without drowning in noise. This isn\u2019t about hype. It\u2019s about understanding which AI developments actually matter, which training paths are worth your time, and how specific industries are being transformed.\n\nWhether you\u2019re an executive trying to understand AI\u2019s impact on your supply chain, an engineer exploring automation opportunities, or simply curious about the technology reshaping every industry \u2014 Vidhai is your starting point.\n\nThe seed has been planted. Let\u2019s watch it grow."
    },
    {
      id: 'post-2',
      title: "5 Free AI Courses Every Professional Should Take in 2026",
      date: "March 4, 2026",
      author: "Gowtham",
      readTime: "5 min read",
      tags: ["Training", "Career", "Free Resources"],
      excerpt: "You don\u2019t need a computer science degree to understand AI. These five free courses will give any working professional a solid foundation \u2014 from strategy to hands-on application.",
      content: "You don\u2019t need a computer science degree to understand AI. These five free courses will give any working professional a solid foundation \u2014 from strategy to hands-on application.\n\n1. Elements of AI (University of Helsinki) \u2014 The gold standard for AI literacy. 30 hours of accessible content covering AI\u2019s potential, limitations, and societal impact. Available in 25+ languages with a free certificate.\n\n2. AI For Everyone by Andrew Ng \u2014 Built specifically for non-technical professionals. Learn to spot AI opportunities in your organization, work effectively with AI teams, and build AI strategies. About 8-10 hours on Coursera.\n\n3. Generative AI for Everyone (DeepLearning.AI) \u2014 Covers prompt engineering, responsible AI, and practical applications. Perfect for understanding the current wave of AI tools like ChatGPT and Claude.\n\n4. Prompt Engineering for ChatGPT (Vanderbilt) \u2014 18 hours of hands-on training in crafting effective prompts. This is the most immediately practical skill any knowledge worker can develop today.\n\n5. Microsoft AI Fundamentals \u2014 6-8 hours on Microsoft Learn with free hands-on labs. Great for understanding enterprise AI services and optionally pursuing AI-900 certification.\n\nThe barrier to AI literacy has never been lower. Pick one and start this week."
    },
    {
      id: 'post-3',
      title: "How AI is Transforming Manufacturing \u2014 A Practitioner\u2019s View",
      date: "March 4, 2026",
      author: "Gowtham",
      readTime: "6 min read",
      tags: ["Manufacturing", "Industry 4.0", "Vision Inspection"],
      excerpt: "Having worked in industrial automation for years, I\u2019ve seen firsthand how AI is reshaping factory floors \u2014 from vision inspection systems to predictive maintenance and beyond.",
      content: "Having worked in industrial automation for years, I\u2019ve seen firsthand how AI is reshaping factory floors \u2014 from vision inspection systems to predictive maintenance and beyond.\n\nThe numbers tell a compelling story: over 60% of leading manufacturers now employ AI for quality inspections, yield improvement, and supply chain optimization. The global AI-in-manufacturing market is projected to grow at 28% CAGR through 2040.\n\nBut the real transformation isn\u2019t in the numbers \u2014 it\u2019s in what\u2019s happening on the shop floor.\n\nVision Inspection: AI-powered computer vision can now detect defects that would take human inspectors hours. Real-time quality control using AI vision allows immediate detection of cracks, contamination, and dimensional errors on production lines.\n\nPredictive Maintenance: Machine learning models analyze equipment sensor data to predict failures before they happen. This shifts maintenance from reactive to proactive, reducing downtime by 30-50% in well-implemented systems.\n\nDigital Twins: AI-driven simulations of manufacturing processes let you optimize parameters like temperature, pressure, and mixing speeds before touching the physical line. The result: less waste, better yields.\n\nSupply Chain Intelligence: The semiconductor supply crisis \u2014 where AI data centers are consuming 70% of all memory chips \u2014 shows why AI-powered supply chain visibility isn\u2019t optional anymore. Companies like Tesla are using AI to manage dual-sourcing strategies across TSMC and Samsung.\n\nThe manufacturers who thrive in the next decade won\u2019t be the ones with the biggest factories. They\u2019ll be the ones who best integrate AI into every part of their operations."
    }
  ];

  // --- Blog Data (in-memory store) ---
  var STORAGE_KEY = 'vidhai_blog_posts';
  var memoryPosts = null;

  function getPosts() {
    if (memoryPosts) return memoryPosts;
    // Seed defaults
    memoryPosts = defaultBlogPosts.slice();
    return memoryPosts;
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

  // --- Render Blog Cards ---
  function renderBlogCards() {
    var container = document.getElementById('blog-cards-container');
    if (!container) return;
    var posts = getPosts();
    
    container.innerHTML = posts.map(function(post, i) {
      var tagsHTML = (post.tags || []).map(function(t) {
        return '<span class="badge badge--tag">' + escapeHTML(t) + '</span>';
      }).join('');

      return '<article class="blog-card" data-blog="' + i + '">' +
        '<div class="blog-card__meta">' +
          '<span>' + escapeHTML(post.author || 'Gowtham') + '</span>' +
          '<span class="dot-separator">' + escapeHTML(post.date) + '</span>' +
          '<span class="dot-separator">' + escapeHTML(post.readTime) + '</span>' +
        '</div>' +
        '<h3 class="blog-card__title">' + escapeHTML(post.title) + '</h3>' +
        '<p class="blog-card__excerpt">' + escapeHTML(post.excerpt) + '</p>' +
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

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
  window.addEventListener('scroll', function() {
    if (window.scrollY > 20) {
      nav.classList.add('nav--scrolled');
    } else {
      nav.classList.remove('nav--scrolled');
    }
  }, { passive: true });

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

    var paragraphs = post.content.split('\n\n').map(function(p) {
      return '<p>' + escapeHTML(p) + '</p>';
    }).join('');

    blogPostContent.innerHTML = 
      '<button class="blog-post__close" aria-label="Close article"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
      '<div class="blog-post__meta"><span>' + escapeHTML(post.author) + '</span><span class="dot-separator">' + escapeHTML(post.date) + '</span><span class="dot-separator">' + escapeHTML(post.readTime) + '</span></div>' +
      '<h2 class="blog-post__title">' + escapeHTML(post.title) + '</h2>' +
      '<div class="blog-post__tags">' + tagsHTML + '</div>' +
      '<div class="blog-post__content">' + paragraphs + '</div>';

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

  // Initial blog render
  renderBlogCards();

  // ========================================
  // NEWSLETTER FORM
  // ========================================
  var newsletterForm = document.getElementById('newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var email = document.getElementById('newsletter-email').value;
      var freq = newsletterForm.querySelector('input[name="frequency"]:checked').value;
      // In production, this would POST to a backend
      console.log('Newsletter signup:', email, freq);
      newsletterForm.style.display = 'none';
      document.getElementById('newsletter-success').style.display = 'block';
    });
  }

  // ========================================
  // ADMIN PANEL
  // ========================================
  var ADMIN_KEY = 'vidhai_admin_auth';
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

  // Close overlay click
  if (adminOverlay) {
    adminOverlay.addEventListener('click', function(e) {
      if (e.target === adminOverlay) closeAdmin();
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
  }

  // --- New Post ---
  var newPostBtn = document.getElementById('admin-new-post');
  if (newPostBtn) {
    newPostBtn.addEventListener('click', function() {
      currentEditIndex = -1;
      clearEditorForm();
      document.getElementById('admin-editor-title-text').textContent = 'New Post';
      showAdminView('editor');
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
  }

  function clearEditorForm() {
    document.getElementById('editor-title').value = '';
    document.getElementById('editor-author').value = 'Gowtham';
    document.getElementById('editor-tags').value = '';
    document.getElementById('editor-excerpt').value = '';
    document.getElementById('editor-content').value = '';
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
      var content = document.getElementById('editor-content').value.trim();

      if (!title || !content) {
        alert('Title and content are required.');
        return;
      }

      var tags = tagsStr ? tagsStr.split(',').map(function(t) { return t.trim(); }).filter(Boolean) : [];
      var readTime = estimateReadTime(content);
      var date = formatDate(null);

      if (currentEditIndex >= 0 && currentEditIndex < posts.length) {
        // Update existing
        posts[currentEditIndex].title = title;
        posts[currentEditIndex].author = author;
        posts[currentEditIndex].tags = tags;
        posts[currentEditIndex].excerpt = excerpt || content.substring(0, 200) + '...';
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
          excerpt: excerpt || content.substring(0, 200) + '...',
          content: content
        });
      }

      savePosts(posts);
      renderBlogCards();
      renderAdminPostList();
      showAdminView('list');
      currentEditIndex = -1;
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
    renderBlogCards();
    renderAdminPostList();
  }

})();
