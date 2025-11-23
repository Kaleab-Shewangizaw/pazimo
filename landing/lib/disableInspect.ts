// Disable browser inspect functionality and developer tools
export const disableInspect = () => {
  if (typeof window !== 'undefined') {
    // Disable right-click context menu
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });

    // Disable F12 key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I') || 
          (e.ctrlKey && e.shiftKey && e.key === 'J') || (e.ctrlKey && e.key === 'U')) {
        e.preventDefault();
        return false;
      }
    });

    // Disable developer tools shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+I (Chrome DevTools)
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        return false;
      }
      // Ctrl+Shift+J (Chrome Console)
      if (e.ctrlKey && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        return false;
      }
      // Ctrl+U (View Source)
      if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        return false;
      }
      // Ctrl+Shift+C (Chrome Elements)
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        return false;
      }
    });

    // Disable console methods
    const noop = () => {};
    const methods = ['log', 'warn', 'error', 'info', 'debug', 'trace', 'dir', 'dirxml', 'group', 'groupCollapsed', 'groupEnd', 'time', 'timeEnd', 'timeLog', 'profile', 'profileEnd', 'count', 'countReset', 'clear', 'table', 'assert', 'markTimeline', 'timeline', 'timelineEnd'];
    
    methods.forEach(method => {
      if (console[method]) {
        console[method] = noop;
      }
    });

    // Disable debugger statement
    const originalDebugger = window.debugger;
    window.debugger = noop;

    // Monitor for devtools opening
    let devtools = { open: false, orientation: null };
    
    setInterval(() => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
      if (widthThreshold || heightThreshold) {
        if (!devtools.open) {
          devtools.open = true;
          // Redirect or show warning when devtools is detected
          window.location.href = '/';
        }
      } else {
        devtools.open = false;
      }
    }, 500);

    // Disable source view
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        return false;
      }
    });

    // Disable text selection (optional - uncomment if needed)
    /*
    document.addEventListener('selectstart', (e) => {
      e.preventDefault();
      return false;
    });
    */

    // Disable drag and drop (optional - uncomment if needed)
    /*
    document.addEventListener('dragstart', (e) => {
      e.preventDefault();
      return false;
    });
    */
  }
};

// Auto-disable on page load
if (typeof window !== 'undefined') {
  disableInspect();
}








