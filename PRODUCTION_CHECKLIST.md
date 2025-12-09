# Production Deployment Checklist

This checklist ensures all critical steps are completed before deploying to production.

## Pre-Deployment

### Environment Variables
- [ ] Set `GEMINI_API_KEY` in production environment
- [ ] Set `VITE_IMAGE_PROXY_URL` to deployed worker URL
- [ ] Configure Supabase URL and API key (or ensure setup flow works)
- [ ] Verify no hardcoded credentials in code
- [ ] Check `.env.example` is up to date

### Code Quality
- [ ] Run `npm run lint` - no errors
- [ ] Run `npm run format:check` - code is formatted
- [ ] Run `npm run type-check` - no TypeScript errors
- [ ] All TODO comments addressed or tracked
- [ ] Remove debug console.logs (production build removes them automatically)

### Security
- [ ] No API keys or secrets in source code
- [ ] Environment variables properly configured
- [ ] CORS settings reviewed for worker
- [ ] Security headers configured (CSP, X-Frame-Options, etc.)
- [ ] Input validation on all user inputs
- [ ] XSS protection in place

### Performance
- [ ] Images are optimized
- [ ] Lazy loading implemented for routes
- [ ] Bundle size analyzed and acceptable
- [ ] Lighthouse score > 90 for Performance
- [ ] No memory leaks in key flows

### Testing
- [ ] Core user flows tested manually
- [ ] Product identification works with real API key
- [ ] QC analysis generates reports correctly
- [ ] Image fetching works from URLs
- [ ] Supabase integration tested (if configured)
- [ ] In-memory fallback works when Supabase unavailable
- [ ] Error boundaries catch and display errors properly

### Accessibility
- [ ] Keyboard navigation works throughout app
- [ ] Screen reader tested on critical flows
- [ ] Color contrast meets WCAG AA standards
- [ ] Form labels and error messages properly associated
- [ ] Focus indicators visible

### Browser Compatibility
- [ ] Chrome (latest 2 versions)
- [ ] Firefox (latest 2 versions)
- [ ] Safari (latest 2 versions)
- [ ] Edge (latest 2 versions)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

### Documentation
- [ ] README.md is up to date
- [ ] Deployment guides are accurate
- [ ] Environment setup documented
- [ ] API key setup instructions clear
- [ ] Troubleshooting guides updated

## Build & Deploy

### Build Process
```bash
# Clean previous builds
rm -rf dist

# Install dependencies
npm ci

# Run production build
npm run build

# Test production build locally
npm run preview
```

### Cloudflare Worker
```bash
cd cloudflare-worker
npx wrangler@4 deploy index.mjs --name authentiqc-worker
# Copy worker URL for VITE_IMAGE_PROXY_URL
```

### Cloudflare Pages
- [ ] GitHub repository connected
- [ ] Build command: `npm run build`
- [ ] Output directory: `dist`
- [ ] Environment variables set
- [ ] Custom domain configured (if applicable)
- [ ] HTTPS enabled

### Verification
- [ ] Production site loads correctly
- [ ] All assets load (no 404s)
- [ ] Images fetch correctly via worker
- [ ] AI product identification works
- [ ] QC analysis generates reports
- [ ] Error tracking setup (if using service like Sentry)

## Post-Deployment

### Monitoring
- [ ] Check for JavaScript errors in console
- [ ] Monitor API rate limits
- [ ] Check Cloudflare Analytics
- [ ] Verify worker is responding correctly
- [ ] Monitor Supabase usage (if applicable)

### Performance Monitoring
- [ ] Run Lighthouse audit on production
- [ ] Check Core Web Vitals
- [ ] Monitor bundle sizes
- [ ] Check loading times from different locations

### User Acceptance
- [ ] Test key user flows in production
- [ ] Verify all features work end-to-end
- [ ] Check mobile responsiveness
- [ ] Test on different devices

## Rollback Plan

If issues are discovered post-deployment:

1. **Immediate**: Revert to previous deployment in Cloudflare Pages
2. **Quick Fix**: If issue is minor (typo, style), deploy hotfix
3. **Major Issue**: Roll back worker deployment if needed
4. **Communication**: Update users if service is impacted

## Environment-Specific Notes

### Development
- Uses `.env.local` for configuration
- Console logs enabled
- Source maps enabled
- Debug mode active

### Production
- Uses environment variables from CI/CD
- Console logs removed from build
- Source maps disabled
- Error tracking enabled
- Performance monitoring active

## Maintenance Tasks

### Regular Updates
- [ ] Update dependencies monthly: `npm outdated`
- [ ] Review security advisories: `npm audit`
- [ ] Update Cloudflare Worker runtime
- [ ] Review and optimize bundle size
- [ ] Check for deprecated API usage

### Quarterly Reviews
- [ ] Review error logs
- [ ] Analyze user feedback
- [ ] Performance audit
- [ ] Security audit
- [ ] Accessibility audit

## Emergency Contacts

- **Cloudflare Support**: https://support.cloudflare.com/
- **Google AI Studio**: https://aistudio.google.com/
- **Supabase Support**: https://supabase.com/support

## Notes

Add any deployment-specific notes or lessons learned here:

---

**Last Updated**: December 2025
**Reviewed By**: Development Team
