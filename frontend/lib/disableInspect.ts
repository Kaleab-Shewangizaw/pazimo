// Lightweight browser protection - PRODUCTION ONLY
// Note: Only applies minimal protections in production to avoid breaking debugging
export const disableInspect = () => {
  // Only run in production and only in browser
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'production') {
    return;
  }

  try {
    // Disable right-click context menu only
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    }, { passive: false });

    // Disable common keyboard shortcuts for viewing source
    document.addEventListener('keydown', (e) => {
      // Ctrl+U (View Source)
      if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        return false;
      }
    }, { passive: false });

    // Note: We DO NOT disable console or devtools in production
    // as it prevents debugging critical user-reported errors
  } catch (error) {
    // Silently fail to prevent breaking the app
    console.error('Failed to initialize browser protections:', error);
  }
};

// Only initialize in browser environment
if (typeof window !== 'undefined') {
  // Use setTimeout to ensure DOM is ready and avoid blocking initial render
  setTimeout(() => {
    disableInspect();
  }, 0);
}








