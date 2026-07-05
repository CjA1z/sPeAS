// Restore the persisted collapse state before first paint to avoid a flash
try {
    if (localStorage.getItem('sidebarCollapsed') === '1') {
        document.documentElement.classList.add('sidebar-collapsed');
    }
} catch (_) { /* ignore storage errors */ }

// Enable sidebar animations only after the first frame has painted, so a
// page loading in the collapsed state doesn't animate into place
requestAnimationFrame(() => requestAnimationFrame(() => {
    document.documentElement.classList.add('sidebar-anim');
}));

// Delegated listener so the toggle keeps working even when the sidebar
// markup is re-injected via innerHTML (dashboard.html loads it twice).
// Guarded so a double-included script doesn't toggle twice per click.
if (!globalThis.__sidebarToggleWired) {
    globalThis.__sidebarToggleWired = true;
document.addEventListener('click', (event) => {
    const toggle = event.target.closest('.sidebar-toggle');
    if (!toggle) return;
    const collapsed = document.documentElement.classList.toggle('sidebar-collapsed');
    try {
        localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0');
    } catch (_) { /* ignore storage errors */ }

    // Replay the jelly wobble on every toggle
    const sideBar = toggle.closest('.side-bar');
    if (sideBar) {
        sideBar.classList.remove('jelly');
        void sideBar.offsetWidth; // force reflow so the animation restarts
        sideBar.classList.add('jelly');
        const onEnd = (e) => {
            // label animations also fire animationend; wait for the panel's own
            if (e.target !== sideBar) return;
            sideBar.classList.remove('jelly');
            sideBar.removeEventListener('animationend', onEnd);
        };
        sideBar.addEventListener('animationend', onEnd);
    }
});
}

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {

    // Get the sidebar container
    const sidebarContainer = document.getElementById('sidebar-container');
    if (!sidebarContainer) {
        return;
    }
    
    // Use absolute path to fetch sidebar HTML
    fetch('/admin/Components/side_bar.html')
    .then(response => response.text())
    .then(data => {
        sidebarContainer.innerHTML = data;

        // Find the sidebar element inside the container
        const sideBar = sidebarContainer.querySelector('#side-bar') || sidebarContainer;

        // If the sidebar exists, highlight the active link
        if (sideBar) {
            highlightActiveSidebarLink(sideBar);
        }

        // Setup logout functionality AFTER sidebar is loaded
        setupLogout();

        // Populate the user profile block from the active session
        populateSidebarUser();
    })
    .catch(error => console.error('Error loading sidebar:', error));
});

/**
 * Populate the sidebar user-profile name/role/avatar from the active session.
 * Reads userInfo from sessionStorage (then localStorage as fallback),
 * then enriches with /api/user/profile?userId=... when possible to get the
 * real full name and profile picture.
 */
function populateSidebarUser() {
    const nameEl = document.getElementById('sidebar-user-name');
    const roleEl = document.getElementById('sidebar-user-role');
    const avatarEl = document.getElementById('sidebar-user-avatar');
    if (!nameEl || !roleEl) return;

    let userInfo = null;
    try {
        const raw = sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo');
        if (raw) userInfo = JSON.parse(raw);
    } catch (_) { /* ignore malformed JSON */ }

    if (!userInfo) {
        nameEl.textContent = 'Guest';
        roleEl.textContent = '';
        return;
    }

    // Immediate fill from session (username + role) so the UI is never blank
    nameEl.textContent = userInfo.username || 'User';
    roleEl.textContent = userInfo.role || '';

    // Enrich with first/last name and avatar from the profile endpoint
    if (!userInfo.id) return;
    fetch(`/api/user/profile?userId=${encodeURIComponent(userInfo.id)}`, {
        credentials: 'include'
    })
    .then(r => r.ok ? r.json() : null)
    .then(profile => {
        if (!profile) return;
        const fullName = [profile.first_name, profile.last_name]
            .filter(Boolean)
            .join(' ')
            .trim();
        if (fullName) nameEl.textContent = fullName;
        if (avatarEl && profile.profile_picture) {
            avatarEl.src = profile.profile_picture;
        }
    })
    .catch(() => { /* keep the session-derived values */ });
}

// Highlight active sidebar link
function highlightActiveSidebarLink(sideBar) {
    const currentPage = globalThis.location.pathname;
    // Find links either in the sidebar element or in the document if sidebar not provided
    const navLinks = sideBar ? 
        sideBar.querySelectorAll('a.icon-wrapper') : 
        document.querySelectorAll('#side-bar a.icon-wrapper');

    navLinks.forEach(link => {
        // Get the pathname from the link's href
        const href = new URL(link.href, globalThis.location.origin).pathname;

        // Skip highlighting for logout link
        if (href === '/logout') {
            link.classList.remove('active');
            return;
        }

        if (href === currentPage) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

/**
 * Side bar functionality
 */

// Remove duplicate DOMContentLoaded listener to avoid conflicts
// document.addEventListener('DOMContentLoaded', () => {
//   //   
//   // Setup logout functionality
//   setupLogout();
//   
//   // Initialize prevention on page load
//   preventBackNavigation();
// });

// Initialize prevention on page load - moved outside of duplicate event listener
document.addEventListener('DOMContentLoaded', () => {
    preventBackNavigation();
});

// Function to prevent back navigation
function preventBackNavigation() {
    // Clear all history entries
    globalThis.history.pushState(null, '', globalThis.location.href);
    
    // Prevent back navigation
    globalThis.addEventListener('popstate', function() {
        globalThis.history.pushState(null, '', globalThis.location.href);
    });
    
    // Disable back button
    globalThis.history.pushState(null, '', globalThis.location.href);
    globalThis.onpopstate = function() {
        globalThis.history.pushState(null, '', globalThis.location.href);
    };
}

// Additional prevention for browser back button
globalThis.addEventListener('beforeunload', function() {
    preventBackNavigation();
});

/**
 * Setup logout functionality
 */
function setupLogout() {
    
  // Try multiple selectors to find the logout button - improved selector specificity
  const logoutButton = document.querySelector('.icon-wrapper.logout-btn') || 
                       document.querySelector('a.logout-btn') ||
                       document.querySelector('a[href="/logout"].icon-wrapper.logout-btn') ||
                       document.querySelector('a[onclick*="handleLogout"]');
  
  if (logoutButton) {
    // Check if the button already has an event handler
    if (logoutButton.getAttribute('data-has-logout-handler') !== 'true') {
      // Remove any existing event listeners to prevent duplicates
      logoutButton.removeEventListener('click', handleLogout);
      
      // Add fresh event listener
      logoutButton.addEventListener('click', handleLogout);
      
      // Mark this button as having a handler to prevent duplicates
      logoutButton.setAttribute('data-has-logout-handler', 'true');
      
      // Also ensure the onclick attribute is set correctly
      logoutButton.setAttribute('onclick', 'handleLogout(event); return false;');
      
          } else {
          }
  } else {
    // Add a fallback timeout to try again after sidebar is fully loaded
    setTimeout(() => {
      // Try a more comprehensive set of selectors
      const retryLogoutButton = document.querySelector('.icon-wrapper.logout-btn') || 
                                document.querySelector('a.logout-btn') ||
                                document.querySelector('a[href="/logout"].icon-wrapper.logout-btn') ||
                                document.querySelector('a[onclick*="handleLogout"]');
                                
      if (retryLogoutButton && retryLogoutButton.getAttribute('data-has-logout-handler') !== 'true') {
        retryLogoutButton.removeEventListener('click', handleLogout);
        retryLogoutButton.addEventListener('click', handleLogout);
        retryLogoutButton.setAttribute('data-has-logout-handler', 'true');
        retryLogoutButton.setAttribute('onclick', 'handleLogout(event); return false;');
              } else if (retryLogoutButton) {
              } else {
      }
    }, 1000);
  }
}

function handleLogout(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation(); // Stop event propagation to prevent multiple handlers
  }
    
  // Prevent multiple logout attempts
  if (window.logoutInProgress) {
        return;
  }
  
  window.logoutInProgress = true;
  
  // Add visual indicator that logout is happening
  const loadingPopup = document.createElement('div');
  loadingPopup.style.position = 'fixed';
  loadingPopup.style.top = '0';
  loadingPopup.style.left = '0';
  loadingPopup.style.width = '100%';
  loadingPopup.style.height = '100%';
  loadingPopup.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  loadingPopup.style.display = 'flex';
  loadingPopup.style.justifyContent = 'center';
  loadingPopup.style.alignItems = 'center';
  loadingPopup.style.zIndex = '9999';
  
  const loadingContent = document.createElement('div');
  loadingContent.style.backgroundColor = 'white';
  loadingContent.style.padding = '20px';
  loadingContent.style.borderRadius = '10px';
  loadingContent.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
  loadingContent.style.display = 'flex';
  loadingContent.style.flexDirection = 'column';
  loadingContent.style.alignItems = 'center';
  loadingContent.style.gap = '15px';
  
  const spinner = document.createElement('div');
  spinner.style.width = '40px';
  spinner.style.height = '40px';
  spinner.style.border = '4px solid #f3f3f3';
  spinner.style.borderTop = '4px solid #006A4E';
  spinner.style.borderRadius = '50%';
  spinner.style.animation = 'spin 1s linear infinite';
  
  // Add the animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
  
  const loadingText = document.createElement('p');
  loadingText.textContent = 'Logging out...';
  loadingText.style.margin = '0';
  loadingText.style.fontFamily = 'Inter, sans-serif';
  loadingText.style.color = '#4b5563';
  
  loadingContent.appendChild(spinner);
  loadingContent.appendChild(loadingText);
  loadingPopup.appendChild(loadingContent);
  document.body.appendChild(loadingPopup);
  
  // More thorough client-side storage clearing
  try {
    // Clear localStorage - first specific keys then everything
    const localStorageKeys = ['userInfo', 'session_token', 'accessToken', 'user', 'userData', 'auth', 'role'];
    localStorageKeys.forEach(key => localStorage.removeItem(key));
    localStorage.clear(); // Clear all localStorage items
    
    // Clear sessionStorage - first specific keys then everything
    const sessionStorageKeys = ['userInfo', 'session_token', 'accessToken', 'user', 'userData', 'auth', 'role'];
    sessionStorageKeys.forEach(key => sessionStorage.removeItem(key));
    sessionStorage.clear(); // Clear all sessionStorage items
    
    // Clear specific cookies
    const cookiesToClear = ['session_token', 'accessToken', 'user', 'auth', 'role'];
    cookiesToClear.forEach(cookieName => {
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      // Also try to clear cookies with different paths
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/admin/;`;
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/api/;`;
    });
    
    // Clear all cookies (more aggressive approach)
    document.cookie.split(";").forEach(function(c) {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/admin/");
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/api/");
    });
    
    
    // Check if we're still on admin dashboard after storage clearing
    if (window.location.pathname.includes('/admin/')) {
          }
  } catch (e) {
  }
  
  // Try multiple logout endpoints to ensure we hit the right one
  Promise.any([
    fetch('/logout', {
      method: 'POST',
      credentials: 'include',
      redirect: 'follow' // Allow the server's redirect to be followed
    }),
    fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      redirect: 'follow' // Allow the server's redirect to be followed
    }),
    fetch('/auth/logout', {
      method: 'POST',
      credentials: 'include',
      redirect: 'follow' // Allow the server's redirect to be followed
    })
  ])
  .then(response => {
        
    // Check if redirect location contains the string 'dashboard'
    const hasRedirectHeader = response.headers && response.headers.get('Location');
    if (hasRedirectHeader) {
      const location = response.headers.get('Location');
            
      if (location && location.includes('dashboard')) {
                window.location.href = '/index.html?nocache=' + Date.now();
        return;
      }
    }
    
        
    if (response.redirected) {
      window.location.href = response.url;
    } else {
      // Fallback if the server didn't redirect
      window.location.href = '/index.html?nocache=' + Date.now();
    }
  })
  .catch(error => {
    // Fallback on error
    window.location.href = '/index.html?nocache=' + Date.now();
  })
  .finally(() => {
    // Small delay to show the loading animation
    setTimeout(() => {
      // Clean up loading popup
      if (document.body.contains(loadingPopup)) {
        document.body.removeChild(loadingPopup);
      }
      
      // Final safety check - if we're still on admin page after 2 seconds, force redirect
      if (window.location.pathname.includes('/admin/')) {
                window.location.href = '/index.html?forcedRedirect=true&t=' + Date.now();
      }
    }, 1000);
  });
}

// Export the function for use in other files and make it globally available
window.handleLogout = handleLogout;
window.sidebarHandleLogout = handleLogout; // Add this for dashboard.html to use
globalThis.handleLogout = handleLogout;
globalThis.sidebarHandleLogout = handleLogout;

// Make sure the function is available after the page loads too
document.addEventListener('DOMContentLoaded', () => {
  window.handleLogout = handleLogout;
  window.sidebarHandleLogout = handleLogout; // Add this for dashboard.html to use
  globalThis.handleLogout = handleLogout;
  globalThis.sidebarHandleLogout = handleLogout;
  });
