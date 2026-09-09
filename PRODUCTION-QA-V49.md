# OFFSCRPT V49 Production QA

## Reading progress
1. Open an article while signed in and confirm the top bar is 0% near the start of the article body.
2. Scroll in 10–20% increments and confirm the top bar visibly increases.
3. Scroll backward and confirm the top bar follows the current scroll position.
4. Continue until the last actual article-content line reaches the bottom of the viewport; confirm the bar reaches 100% before reactions/comments/footer.
5. Confirm the footer can be scrolled without changing the completed 100% article endpoint.
6. Refresh and verify the cloud checkpoint is preserved.
7. Open the same article on another signed-in device/session and verify the saved checkpoint is available.

## Manual completion
8. Click MARK AS COMPLETE; confirm 100% COMPLETE persists after reload and scrolling.
9. Click RESET & RECALCULATE; confirm the completion lock disappears and automatic tracking resumes.

## Layout changes
10. Test articles with large images, embedded videos, code blocks, long headings, and changed font size.
11. Confirm progress endpoint recalculates after media/font layout changes.

## Navigation
12. Test hash/TOC navigation and confirm the progress bar updates to the destination.
