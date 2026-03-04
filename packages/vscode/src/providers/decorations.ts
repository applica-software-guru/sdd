import * as vscode from 'vscode';

const pendingDecoration = vscode.window.createTextEditorDecorationType({
  borderWidth: '0 0 0 3px',
  borderStyle: 'solid',
  borderColor: new vscode.ThemeColor('charts.yellow'),
  isWholeLine: true,
});

const agentNotesDecoration = vscode.window.createTextEditorDecorationType({
  borderWidth: '0 0 0 3px',
  borderStyle: 'solid',
  borderColor: new vscode.ThemeColor('charts.red'),
  isWholeLine: true,
});

const crossRefDecoration = vscode.window.createTextEditorDecorationType({
  textDecoration: 'underline',
  color: new vscode.ThemeColor('textLink.foreground'),
});

const pendingGutterDecoration = vscode.window.createTextEditorDecorationType({
  gutterIconPath: '',
  overviewRulerColor: new vscode.ThemeColor('charts.yellow'),
});

const syncedGutterDecoration = vscode.window.createTextEditorDecorationType({
  gutterIconPath: '',
  overviewRulerColor: new vscode.ThemeColor('charts.green'),
});

export function applyDecorations(editor: vscode.TextEditor): void {
  const doc = editor.document;
  if (doc.languageId !== 'markdown') return;

  const text = doc.getText();
  const lines = text.split('\n');

  const pendingRanges: vscode.DecorationOptions[] = [];
  const agentNotesRanges: vscode.DecorationOptions[] = [];
  const crossRefRanges: vscode.DecorationOptions[] = [];

  let currentSection: 'pending' | 'agentNotes' | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('## Pending Changes')) {
      currentSection = 'pending';
      pendingRanges.push({ range: new vscode.Range(i, 0, i, line.length) });
      continue;
    }
    if (line.startsWith('## Agent Notes')) {
      currentSection = 'agentNotes';
      agentNotesRanges.push({ range: new vscode.Range(i, 0, i, line.length) });
      continue;
    }
    if (line.startsWith('## ')) {
      currentSection = null;
      continue;
    }

    if (currentSection === 'pending' && line.trim()) {
      pendingRanges.push({ range: new vscode.Range(i, 0, i, line.length) });
    }
    if (currentSection === 'agentNotes' && line.trim()) {
      agentNotesRanges.push({ range: new vscode.Range(i, 0, i, line.length) });
    }

    // Cross-references [[EntityName]]
    const refRe = /\[\[([^\]]+)\]\]/g;
    let match: RegExpExecArray | null;
    while ((match = refRe.exec(line)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      crossRefRanges.push({
        range: new vscode.Range(i, start, i, end),
        hoverMessage: `Entity reference: ${match[1]}`,
      });
    }
  }

  editor.setDecorations(pendingDecoration, pendingRanges);
  editor.setDecorations(agentNotesDecoration, agentNotesRanges);
  editor.setDecorations(crossRefDecoration, crossRefRanges);

  // Gutter decorations for frontmatter status
  const statusMatch = text.match(/^status:\s*(new|changed|deleted|synced)/m);
  if (statusMatch) {
    const lineIdx = text.substring(0, statusMatch.index).split('\n').length - 1;
    const range = new vscode.Range(lineIdx, 0, lineIdx, statusMatch[0].length);
    if (statusMatch[1] !== 'synced') {
      editor.setDecorations(pendingGutterDecoration, [{ range }]);
      editor.setDecorations(syncedGutterDecoration, []);
    } else {
      editor.setDecorations(syncedGutterDecoration, [{ range }]);
      editor.setDecorations(pendingGutterDecoration, []);
    }
  }
}

export function disposeDecorations(): void {
  pendingDecoration.dispose();
  agentNotesDecoration.dispose();
  crossRefDecoration.dispose();
  pendingGutterDecoration.dispose();
  syncedGutterDecoration.dispose();
}
