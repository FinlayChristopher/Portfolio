# A squashed scene after resizing

**Symptom:** after a resize, everything looked squashed sideways.

**Cause:** the aspect ratio divided two whole numbers. 1920 / 1080 is worked out as a whole number first, giving 1, and only then stored as a decimal.

**Fix:** convert to decimals before dividing.
