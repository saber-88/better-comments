const vscode = require('vscode');

// One decoration type — red and bold for // ! comments
const importantDecoration = vscode.window.createTextEditorDecorationType({
  color: '#FF4444',
  fontWeight: 'bold',
  backgroundColor: '#FF444415',
  borderRadius: '3px'
});

function updateDecorations(editor) {
  if (!editor) return;

  const ranges = [];
  const pattern = /\/\/\s*!.*/g; // "// ! any comment"
  const text = editor.document.getText();
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const startPos = editor.document.positionAt(match.index);
    const endPos = editor.document.positionAt(match.index + match[0].length);
    ranges.push(new vscode.Range(startPos, endPos));
  }

  editor.setDecorations(importantDecoration, ranges);
}

function activate(context) {
  // Run on whatever file is already open when VSCode starts
  updateDecorations(vscode.window.activeTextEditor);

  // Re-run when user switches to a different file tab
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      updateDecorations(editor);
    })
  );

  // Re-run on every keystroke in the current file
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(() => {
      updateDecorations(vscode.window.activeTextEditor);
    })
  );
}

function deactivate() {}
module.exports = { activate, deactivate };