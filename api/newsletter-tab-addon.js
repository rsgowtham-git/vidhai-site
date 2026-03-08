/**
 * Newsletter Tab Addon for Vidhai Blog Admin
 * Adds Newsletter button to admin toolbar and handles view switching
 */

// Wait for admin panel to be initialized
document.addEventListener('DOMContentLoaded', function() {
  console.log('🔌 Newsletter Tab Addon loading...');

  // Add Newsletter button to admin toolbar (next to "New Post" button)
  function addNewsletterButton() {
    const toolbar = document.querySelector('.admin-toolbar');
    if (!toolbar) {
      console.log('⏳ Admin toolbar not found yet, retrying...');
      setTimeout(addNewsletterButton, 500);
      return;
    }

    // Check if button already exists
    if (document.getElementById('admin-newsletter-btn')) {
      console.log('✓ Newsletter button already exists');
      return;
    }

    const newsletterBtn = document.createElement('button');
    newsletterBtn.id = 'admin-newsletter-btn';
    newsletterBtn.className = 'admin-btn';
    newsletterBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
      Newsletter
    `;

    // Insert after "New Post" button
    const newPostBtn = document.getElementById('admin-new-post');
    if (newPostBtn) {
      newPostBtn.parentNode.insertBefore(newsletterBtn, newPostBtn.nextSibling);
      console.log('✓ Newsletter button inserted after New Post button');
    } else {
      toolbar.appendChild(newsletterBtn);
      console.log('✓ Newsletter button appended to toolbar');
    }

    // Add click handler
    newsletterBtn.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('📧 Newsletter button clicked');

      // Hide all views
      document.querySelectorAll('[data-admin-view]').forEach(view => {
        view.style.display = 'none';
      });

      // Show newsletter view
      const newsletterView = document.querySelector('[data-admin-view="newsletter"]');
      if (newsletterView) {
        newsletterView.style.display = 'block';
        console.log('✅ Newsletter view opened');
      } else {
        console.error('❌ Newsletter view not found in admin panel');
      }
    });

    console.log('✅ Newsletter button added to admin toolbar');
  }

  // Initialize when admin panel becomes visible
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.target.id === 'admin-overlay' && 
          mutation.target.classList.contains('active')) {
        console.log('👀 Admin panel opened, adding Newsletter button...');
        setTimeout(addNewsletterButton, 100);
      }
    });
  });

  const adminOverlay = document.getElementById('admin-overlay');
  if (adminOverlay) {
    observer.observe(adminOverlay, {
      attributes: true,
      attributeFilter: ['class']
    });
    console.log('✓ Observing admin panel for changes');
  } else {
    console.error('❌ Admin overlay not found');
  }

  // Also try immediately in case admin is already open
  setTimeout(addNewsletterButton, 1000);

  console.log('✅ Newsletter Tab Addon initialized');
});
