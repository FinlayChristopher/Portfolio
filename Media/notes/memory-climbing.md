# Memory climbing while dragging the window

**Symptom:** while dragging the window edge, process memory rose from about 70 MB to about 180 MB, then fell back once I stopped.

**Cause:** falling back means a queue, not a leak. Direct3D frees released buffers later rather than at once, and each step of the drag made a new full-size set.

**Fix, in progress:** `Flush()` before resizing sends the queued work sooner so old buffers are freed sooner. I'm measuring how much it helps.
