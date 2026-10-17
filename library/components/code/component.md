# Component: code, keys, screenshots

Three small pieces for slides that teach a tool.

- `pre.sa-code`: a command to type, a file, a folder tree. Mono 16 (`.is-small` 13) on `--ink-3`, framed by a 1px rule.
  Colour words with spans: `.c` comment (dim), `.k` keyword or type (white), `.s` string (light), `.r` the one thing
  to notice (red: the command to type, the value that matters). Keep it short: 4 to 12 lines that fit, never a scroll.
- `kbd`: a key of the keyboard, inline in text or in a list (`<kbd>R</kbd>`, `<kbd>⌘</kbd><kbd>S</kbd>`).
- `figure.sa-shot > img`: a screenshot, framed by a 1px rule. Images are WebP, taken at 2× the size shown.
- Don't: syntax-highlight with other colours, put more than one red span in a block, crop a screenshot to unreadable text.

Example slides: the slides of `examples/keystone/` (the guide to Keystone).
