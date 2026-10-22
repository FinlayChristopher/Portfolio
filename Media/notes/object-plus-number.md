# "Object", "bject", "ject"

**Symptom:** objects named with `"Object" + i` came out with letters missing, and the compiler said nothing.

**Cause:** in C++ a text literal is a pointer to its first character, so adding a number moves the pointer along instead of joining text.

**Fix:** `"Object" + std::to_string(i + 1)`, which makes one side a real string.
