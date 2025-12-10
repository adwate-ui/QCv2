# Accessibility Guidelines for AuthentiqC

This document outlines accessibility best practices and improvements for the AuthentiqC application.

## Current Accessibility Features

### Semantic HTML
- Using proper heading hierarchy (h1, h2, h3)
- Using semantic elements (`<button>`, `<nav>`, `<main>`, `<form>`)
- Proper label associations for form inputs

### Keyboard Navigation
- All interactive elements are keyboard accessible
- Toggle switches have proper `role="switch"` and `aria-checked` attributes
- Focus states are visible (though could be improved)

### Color Contrast
- Using sufficient color contrast for text
- Primary green (#16a34a) meets WCAG AA standards for normal text
- Error states use high-contrast red (#dc2626)

## Recommended Improvements

### 1. Focus Management
```tsx
// Add visible focus indicators
.focus-visible:focus {
  outline: 2px solid #16a34a;
  outline-offset: 2px;
}

// Skip to main content link
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
```

### 2. ARIA Labels
```tsx
// Add descriptive labels for icon buttons
<button aria-label="Delete product" onClick={handleDelete}>
  <TrashIcon />
</button>

// Add live regions for dynamic updates
<div role="status" aria-live="polite" aria-atomic="true">
  {taskStatus}
</div>
```

### 3. Loading States
```tsx
// Add loading indicators with proper ARIA
<div role="status" aria-label="Loading products">
  <LoadingSpinner />
  <span className="sr-only">Loading...</span>
</div>
```

### 4. Error Messages
```tsx
// Link error messages to form fields
<input
  aria-invalid={hasError}
  aria-describedby={hasError ? "error-message" : undefined}
/>
{hasError && (
  <div id="error-message" role="alert">
    {errorMessage}
  </div>
)}
```

### 5. Image Alternative Text
```tsx
// Provide meaningful alt text for product images
<img
  src={product.image}
  alt={`${product.name} by ${product.brand}`}
/>

// For decorative images
<img src={decorative.svg} alt="" role="presentation" />
```

### 6. Modal Dialogs
```tsx
// Trap focus within modals
// Return focus to trigger element on close
// Add proper ARIA attributes
<div
  role="dialog"
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
  aria-modal="true"
>
  <h2 id="modal-title">Confirm Action</h2>
  <p id="modal-description">Are you sure?</p>
</div>
```

### 7. Screen Reader Only Content
```css
/* Utility class for screen reader only text */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.sr-only.focus:not(.sr-only.focus-visible):focus {
  position: static;
  width: auto;
  height: auto;
  padding: inherit;
  margin: inherit;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
```

## Testing Accessibility

### Automated Testing
- Use [axe DevTools](https://www.deque.com/axe/devtools/) browser extension
- Run Lighthouse accessibility audits
- Use [WAVE](https://wave.webaim.org/) Web Accessibility Evaluation Tool

### Manual Testing
1. **Keyboard Navigation**
   - Tab through all interactive elements
   - Verify logical tab order
   - Test form submission with Enter key
   - Test ESC key to close modals

2. **Screen Reader Testing**
   - NVDA (Windows)
   - JAWS (Windows)
   - VoiceOver (macOS/iOS)
   - TalkBack (Android)

3. **Visual Testing**
   - Test with browser zoom at 200%
   - Test with high contrast mode
   - Test with dark mode
   - Verify color contrast

## WCAG 2.1 Level AA Compliance Checklist

### Perceivable
- [ ] Text alternatives for non-text content
- [ ] Captions for audio/video content (if applicable)
- [ ] Content can be presented in different ways
- [ ] Content is distinguishable (color contrast, text size)

### Operable
- [ ] All functionality available via keyboard
- [ ] Users have enough time to read content
- [ ] Content doesn't cause seizures (no flashing)
- [ ] Users can navigate and find content easily

### Understandable
- [ ] Text is readable and understandable
- [ ] Pages appear and operate predictably
- [ ] Input assistance for form errors

### Robust
- [ ] Content is compatible with assistive technologies
- [ ] Markup is valid and well-formed
- [ ] Status messages are programmatically determined

## Resources
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN Accessibility Guide](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [React Accessibility Docs](https://react.dev/learn/accessibility)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
