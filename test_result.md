# Testing Protocol

## Backend Testing Task
Test the music pagination API to ensure "Load More" button functionality works:

1. **Test initial load of "My Music" (Мои):**
   - Call `GET /api/music/my?count=30&offset=0`
   - Verify response contains `tracks` array, `has_more` boolean, and `count`
   - Verify `has_more` is `true` if there are more tracks available

2. **Test subsequent loads with pagination:**
   - Call `GET /api/music/my?count=30&offset=28` (using previous count as offset)
   - Verify new tracks are returned
   - Verify `has_more` correctly indicates if more tracks exist

3. **Test edge case - empty results:**
   - Call `GET /api/music/my?count=30&offset=500` (high offset)
   - Verify empty tracks array and `has_more: false`

## Important Notes
- Backend URL: http://localhost:8001
- All endpoints must be prefixed with /api
- ENV=test is active

## Incorporate User Feedback
- Issue: "Загрузить ещё" button not appearing in music section
- Root cause: has_more was calculated incorrectly (comparing returned count to requested count, but VK API returns variable amounts)
- Fix: Added check for next page existence to determine has_more
