# The window that went white

**Symptom:** after adding random object placement, the renderer opened to a white window and stopped responding.

**Cause:** a loop ran while `i < _Objects.size()` and added to `_Objects` inside the loop. Both sides grew by one each pass, so it never ended, and the window never got back to drawing.

**Fix:** loop to a count fixed before the loop starts.
