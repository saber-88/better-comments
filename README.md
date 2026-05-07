# 🖍️ Comment Highlighter — VSCode Extension

> **Highlights `// !` comments in red and bold so critical notes never get lost in your codebase.**

<br/>

![Version](https://img.shields.io/badge/version-0.0.1-FF4444?style=flat-square)
![VSCode](https://img.shields.io/badge/VSCode-%5E1.85.0-0078d7?style=flat-square&logo=visualstudiocode)
![License](https://img.shields.io/badge/license-MIT-f7c06a?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20Windows%20%7C%20macOS-888?style=flat-square)

---

## 📸 Preview

Write this in any file:

```js
const x = 1;
// ! this will be red and bold
const y = 2;
// this is a normal comment — untouched
// ! another critical note — also red
```

The `// !` lines instantly turn **red and bold**. Everything else stays as-is.

---

## 📚 Table of Contents

- [Features](#-features)
- [How It Works](#-how-it-works)
- [Project Structure](#-project-structure)
- [Installation](#-installation)
- [Code Walkthrough](#-code-walkthrough)
  - [The Decoration](#1-the-decoration)
  - [The Regex Pattern](#2-the-regex-pattern)
  - [Finding Matches with exec()](#3-finding-matches-with-exec)
  - [Converting Indexes to Positions](#4-converting-flat-indexes-to-positions)
  - [Applying Decorations](#5-applying-decorations)
  - [The Events](#6-the-events)
- [Building and Packaging](#-building-and-packaging)
- [Publishing to Marketplace](#-publishing-to-marketplace)

---

## ✨ Features

- 🔴 **Instant highlighting** — `// !` comments turn red and bold as you type
- ⚡ **Real-time** — updates on every keystroke, no save needed
- 🔁 **Tab aware** — re-highlights whenever you switch to a different file
- 🧹 **Auto cleanup** — decorations are removed properly on shutdown
- 🖥️ **Cross-platform** — works on Linux, Windows, macOS

---

## 🔍 How It Works

```
VSCode opens
      │
      ▼
activate() is called
      │
      ├── updateDecorations(activeEditor)  ← highlight the already-open file
      │
      ├── onDidChangeActiveTextEditor      ← user switches tabs → re-highlight
      │
      └── onDidChangeTextDocument          ← user types anything → re-highlight


updateDecorations(editor):
      │
      ▼
getText() → entire file as one flat string
      │
      ▼
regex.exec() in a while loop
  → finds every "// !" match
  → records start and end position of each match
      │
      ▼
setDecorations(decorationType, ranges)
  → VSCode applies red+bold to every matched range
  → if no matches → all highlights are cleared
```

---

## 📁 Project Structure

```
comment-highlighter/
│
├── .vscode/
│   └── launch.json        ← F5 debug config, auto-generated
│
├── extension.js            ← ALL logic lives here (~40 lines)
├── package.json            ← manifest: name, commands, activation
├── .vscodeignore
├── .gitignore
└── README.md
```

---

## 🚀 Installation

### Prerequisites

| Tool    | Version      | Download                        |
|---------|--------------|---------------------------------|
| Node.js | v18 or v20   | [nodejs.org](https://nodejs.org)|
| VSCode  | v1.85.0+     | [code.visualstudio.com](https://code.visualstudio.com) |

### Install from VSIX

**Step 1 — Clone**
```bash
git clone https://github.com/saber-88/comment-highlighter.git
cd comment-highlighter
```

**Step 2 — Install dependencies**
```bash
npm install
```

**Step 3 — Package**
```bash
npm install -g @vscode/vsce
vsce package
# produces: comment-highlighter-0.0.1.vsix
```

**Step 4 — Install in VSCode**

Option A — terminal:
```bash
code --install-extension comment-highlighter-0.0.1.vsix
```

Option B — VSCode UI:
Extensions sidebar (`Ctrl+Shift+X`) → `···` menu → **Install from VSIX** → select the file.

**Step 5 — Reload VSCode**
`Ctrl+Shift+P` → `Reload Window`

---

## 🧠 Code Walkthrough

Here is every line of `extension.js` explained in full detail.

### 1. The Decoration

```javascript
const importantDecoration = vscode.window.createTextEditorDecorationType({
  color: '#FF4444',
  fontWeight: 'bold',
  backgroundColor: '#FF444415',
  borderRadius: '3px'
});
```

`createTextEditorDecorationType` defines a **visual style** — think of it as a CSS class for the editor. You define it once at the top level, outside any function, so it's created only once for the entire lifetime of the extension.

The options object:

| Property          | Value         | What it does                              |
|-------------------|---------------|-------------------------------------------|
| `color`           | `#FF4444`     | Text color — bright red                   |
| `fontWeight`      | `'bold'`      | Makes the text bold                       |
| `backgroundColor` | `#FF444415`   | Last two digits `15` = ~8% opacity tint   |
| `borderRadius`    | `'3px'`       | Slightly rounds the background highlight  |

> **Why define it outside functions?**
> If you created it inside `updateDecorations()`, a new decoration type would be
> created on every keystroke. Old ones would pile up in memory and never be cleaned up.
> Defining it once at the top means there is exactly one decoration type for the
> entire session — clean and efficient.

---

### 2. The Regex Pattern

```javascript
const pattern = /\/\/\s*!.*/g;
```

A regex in JavaScript lives between two `/` slashes. Breaking it down character by character:

| Part   | Meaning                                                              |
|--------|----------------------------------------------------------------------|
| `\/\/` | Matches literal `//` — backslash escapes `/` inside regex            |
| `\s*`  | Matches zero or more spaces or tabs after `//`                       |
| `!`    | Matches a literal `!` character                                      |
| `.*`   | Matches everything after `!` until end of line (`.` = any char, `*` = zero or more) |
| `g`    | Global flag — find ALL matches, not just the first one               |

So the pattern matches:
```
//!          ✅  no space before !
// !         ✅  one space
//   !       ✅  multiple spaces
// ! hello   ✅  with text after
// TODO      ❌  no ! so not matched
// normal    ❌  no ! so not matched
```

> **The `g` flag makes regex stateful.**
> It remembers where it stopped searching via an internal property called `lastIndex`.
> Each call to `exec()` continues from where the last call left off.
> This is exactly what enables the `while` loop to walk through all matches one by one.

---

### 3. Finding Matches with exec()

```javascript
const text = editor.document.getText();
```

`getText()` returns the **entire file** as one flat string — every line, every character, all joined together with `\n` newline characters between lines:

```
"const x = 1;\n// ! fix this\nconst y = 2;\n// ! also this\n"
 0123456789...  14             27             41
```

Each character has a flat index starting from 0.

```javascript
while ((match = pattern.exec(text)) !== null) {
```

This while loop is doing three things at once:

1. `pattern.exec(text)` — searches for the next match, returns a match object or `null`
2. `match = ...` — assigns the result to `match`
3. `!== null` — checks if a match was found; if null, loop ends

A match object looks like this:
```javascript
{
  0: '// ! fix this',   // [0] = the full matched string
  index: 14,            // where the match starts in the flat string
  input: '...'          // the original full text (rarely used)
}
```

So `match[0]` gives you the matched text, and `match.index` gives you where it starts.

The loop walks through every `// !` in the file one at a time:

```
Iteration 1: exec() → finds "// ! fix this"  at index 14 → lastIndex moves to 27
Iteration 2: exec() → finds "// ! also this" at index 41 → lastIndex moves to 55
Iteration 3: exec() → returns null → loop ends
```

---

### 4. Converting Flat Indexes to Positions

```javascript
const startPos = editor.document.positionAt(match.index);
const endPos   = editor.document.positionAt(match.index + match[0].length);
```

VSCode doesn't think in flat character indexes — it thinks in `{ line, character }` positions. `positionAt()` converts between the two.

Example — for a file:
```
line 0: const x = 1;          (13 chars + \n = 14)
line 1: // ! fix this          starts at index 14
```

```javascript
editor.document.positionAt(14)
// → Position { line: 1, character: 0 }

editor.document.positionAt(14 + 13)   // "// ! fix this" is 13 chars
// → Position { line: 1, character: 13 }
```

`match[0].length` is the length of the matched string — so `match.index + match[0].length` is the index right after the match ends.

```javascript
ranges.push(new vscode.Range(startPos, endPos));
```

`vscode.Range` takes two positions — start and end — and represents the span between them. This is what VSCode uses to know exactly which characters to highlight.

After the loop, `ranges` is an array of all matched spans:
```javascript
[
  Range(line1:0 → line1:13),
  Range(line3:0 → line3:14),
  // ...one Range per // ! found in the file
]
```

---

### 5. Applying Decorations

```javascript
editor.setDecorations(importantDecoration, ranges);
```

This hands the entire list of ranges to VSCode at once. VSCode applies the red+bold style to every range simultaneously.

Two important behaviors:

**If `ranges` has items** → those lines get highlighted in red.

**If `ranges` is empty** → ALL decorations of this type are cleared. This is how un-highlighting works automatically. Delete a `// !` comment → next keystroke → `updateDecorations` runs → regex finds zero matches → `ranges = []` → `setDecorations` with empty array → highlight disappears.

You never have to manually track "which lines were highlighted before" — you just always pass the current full set of matches and VSCode figures out what changed.

---

### 6. The Events

```javascript
// Re-run when user switches to a different file tab
vscode.window.onDidChangeActiveTextEditor(editor => {
  updateDecorations(editor);
});
```

`onDidChangeActiveTextEditor` fires whenever the focused editor changes — switching between open files, opening a new file, clicking a different split pane. The new `editor` is passed directly to `updateDecorations` so it highlights the newly focused file.

```javascript
// Re-run on every keystroke in the current file
vscode.workspace.onDidChangeTextDocument(() => {
  updateDecorations(vscode.window.activeTextEditor);
});
```

`onDidChangeTextDocument` fires on every single character change — typing, deleting, pasting, auto-formatting. We grab `vscode.window.activeTextEditor` (the currently focused editor) and re-run highlighting. This is what makes it feel real-time.

> **Why not pass `event.document` directly?**
> `onDidChangeTextDocument` receives an event with the changed document.
> But `updateDecorations` needs an **editor** (to call `setDecorations`), not just a document.
> `vscode.window.activeTextEditor` gives us the full editor object for whatever is focused.

Both events are pushed to `context.subscriptions` so VSCode automatically removes them when the extension is disabled or VSCode closes — no manual cleanup needed.

---

## 📦 Building and Packaging

### Test in development

Press **F5** → Extension Development Host opens → open or create any `.js` file → type `// !` → see it highlight instantly.

### Package as .vsix

Add to `package.json` before packaging:
```json
{
  "publisher": "karmveer",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/saber-88/comment-highlighter"
  }
}
```

```bash
vsce package
# → comment-highlighter-0.0.1.vsix
```

### Install
```bash
code --install-extension comment-highlighter-0.0.1.vsix
```

---

## 🌐 Publishing to Marketplace

**Step 1** — Sign in at [marketplace.visualstudio.com](https://marketplace.visualstudio.com)

**Step 2** — Create a publisher at [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage). Name must match `"publisher"` in `package.json`.

**Step 3** — Get a Personal Access Token:
1. Go to [dev.azure.com](https://dev.azure.com)
2. Profile → Personal Access Tokens → New Token
3. Organization: **All accessible organizations**
4. Scopes: **Marketplace → Manage**
5. Copy token immediately — shown only once

**Step 4** — Login:
```bash
vsce login karmveer
```

**Step 5** — Publish:
```bash
vsce publish
```

Live on the Marketplace in 5–10 minutes.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|-----------|---------|
| Node.js | Runtime |
| VSCode Extension API | `createTextEditorDecorationType`, `setDecorations`, editor events |
| JavaScript Regex | Finding `// !` patterns in file text |

---

## 👤 Author

**Karmveer**
- GitHub: [@karmveer](https://github.com/saber-88)

---

