# KBL Kitchen Dashboard - Error Fixes Summary

**Date**: 11 May 2026  
**Status**: ✅ Partially Resolved

---

## Errors Addressed

### 1. ✅ FIXED: Service Worker Cache Put Error
**Error**: `Failed to execute 'put' on 'Cache': Request scheme 'chrome-extension' is unsupported`  
**Location**: `public/sw.js:55`  
**Root Cause**: Service Worker attempted to cache responses with non-HTTP(S) URL schemes (e.g., `chrome-extension://` from browser extensions)

**Fix Applied**:
```javascript
// Added protocol check before caching
if (!requestUrl.protocol.startsWith('http')) {
  return networkResponse;
}
// Added error handling
cache.put(request, responseToCache).catch((err) => {
  console.warn('Cache.put failed:', err.message);
});
```

**Files Modified**: `public/sw.js`

---

### 2. ✅ FIXED: Combos API Route Query Parameter Handling
**Error**: `/api/combos?__id=1` returning 400 Bad Request (repeated 7x)  
**Location**: `app/api/combos/route.ts:30`  
**Root Cause**: Regex pattern for removing `__id` parameter from GET requests was fragile and potentially left invalid query parameters

**Fix Applied**:
```typescript
// Replaced regex with proper URLSearchParams
const params = new URLSearchParams(searchParams)
params.delete("__id")
const queryString = params.toString()
path = queryString ? `/api/combos?${queryString}` : "/api/combos"
```

**Why This Matters**:
- Backend `/api/combos` endpoint accepts: `available_only`, `limit`, `offset`
- Backend does NOT accept: `__id` (parameter only valid for `/api/combos/{id}`)
- `__id` is a Next.js convention to pass resource IDs via query parameters, converted to REST paths

**Files Modified**: `app/api/combos/route.ts`

---

### 3. ✅ IMPROVED: Firebase Messaging Service Worker Error Handling
**Error**: `Cannot read properties of undefined (reading 'payload')` in core.js  
**Location**: `public/firebase-messaging-sw.js`  
**Root Cause**: Missing null/undefined checks and error handling for Firebase messaging payload

**Improvements Applied**:
- Added null/undefined payload validation
- Added try-catch blocks around notification handling
- Added console warns for debugging
- Improved notification click handler with URL validation
- Better error logging for Firebase initialization failures

**Files Modified**: `public/firebase-messaging-sw.js`

---

## Remaining Investigation

### `/api/combos?__id=1:1` Mystery
**Observation**: The `:1` suffix in query parameter is unusual and suggests:
- Possible parameter name collision (e.g., form field named `id:id`)
- Browser extension interfering with URLs
- Malformed query parameter encoding

**Next Steps**:
1. Check browser console for actual request being sent
2. Look for any library (React Query, SWR, Tanstack Query) adding query keys
3. Verify no form fields or state have colon-containing names
4. Clear browser cache and test again

---

## Backend Context

### Combos API Endpoints (KBLBites_backend)
- **GET /api/combos** → List all combos (no `__id` parameter)
  - Query params: `available_only`, `limit` (1-2000), `offset`
- **GET /api/combos/{id}** → Get single combo
- **POST /api/combos** → Create combo (Admin only)
- **PUT /api/combos/{id}** → Update combo (Admin only)
- **DELETE /api/combos/{id}** → Delete combo (Admin only)

### Why 400 Errors
Backend rejects unknown query parameters. The `__id` parameter is NOT valid on the backend; it's only for the dashboard's Next.js API layer.

---

## Testing Checklist

- [ ] Service Worker no longer throws cache errors
- [ ] GET /api/combos works without `__id` parameter
- [ ] PUT /api/combos with `__id` correctly updates
- [ ] DELETE /api/combos with `__id` correctly deletes
- [ ] Firebase notifications display correctly in background
- [ ] No console errors on initial page load
- [ ] Combo list loads successfully (7x 400 errors should be gone)

---

## Architecture Notes

### Next.js API Route Pattern
```typescript
// Query parameter → Path parameter transformation
/api/combos?__id=1  (frontend)
    ↓
/api/combos/1  (backend via route handler)
```

This pattern is used because Next.js App Router API routes handle query parameters differently than traditional file-based routing.

### Service Worker Strategy
- **Cache-first**: Static assets (favicons, manifests)
- **Network-first**: HTML, Next.js chunks, API calls
- **Browser extension requests**: Skipped (chrome-extension://, moz-extension://, etc.)

---

## Files Modified
1. `public/sw.js` - Service Worker caching logic
2. `app/api/combos/route.ts` - Query parameter handling
3. `public/firebase-messaging-sw.js` - Firebase messaging error handling
