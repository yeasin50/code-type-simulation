import * as vscode from 'vscode';

let lastPosition: vscode.Position | null = null; // Store last cursor position
let storedDocument: vscode.TextDocument | null = null; // Store the last active document
let currentEditor: vscode.TextEditor | undefined; // Store the current active editor reference
let panel: vscode.WebviewPanel | undefined; // Webview panel  
let decorationType: vscode.TextEditorDecorationType; // To hold the decoration for the arrow
let showArrow = true; // Arrow visibility toggle

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "code-type-simulation" is now active!');

    // Decoration for showing the arrow where the typewriter will begin
    decorationType = vscode.window.createTextEditorDecorationType({
        after: {
            contentText: '➜',
            color: 'yellow',
            fontStyle: 'bold'
        },
        rangeBehavior: vscode.DecorationRangeBehavior.OpenOpen
    });

    let disposable = vscode.commands.registerCommand('extension.openTypewriterPanel', () => {
        currentEditor = vscode.window.activeTextEditor; // Store the current active editor reference

        if (currentEditor) {
            lastPosition = currentEditor.selection.active; // Store the cursor position
            storedDocument = currentEditor.document; // Store the active document

            // Handle existing panel case
            if (panel) {
                if (panel.visible) {
                    panel.reveal(vscode.ViewColumn.Beside);
                    panel.webview.html = getWebviewContent(vscode.window.visibleTextEditors.map(editor => editor.document.fileName));
                    return;
                } else {
                    panel.dispose();
                }
            }

            // Create a new webview panel
            panel = vscode.window.createWebviewPanel(
                'typewriterPanel', // Identifies the type of the webview
                'Typewriter Effect', // Title of the panel displayed to the user
                vscode.ViewColumn.Beside, // Open the webview beside the editor
                {
                    enableScripts: true // Enable scripts in the webview
                }
            );

            panel.webview.html = getWebviewContent(vscode.window.visibleTextEditors.map(editor => editor.document.fileName));

            // Listen for messages from the webview
            panel.webview.onDidReceiveMessage(
                message => {
                    switch (message.command) {
                        case 'triggerTypewriter':
                            triggerTypewriter(message.text, message.speed); // Pass speed along with text
                            return;
                        case 'handleClear':
                            handleClear(); // Clear text in the textarea
                            return;
                        case 'selectTab':
                            selectSpecificTab(message.tabName); // Select specific tab by name
                            return;
                        case 'toggleArrowVisibility':
                            showArrow = message.isVisible; // Update the arrow visibility based on the checkbox
                            if (currentEditor && lastPosition) {
                                drawArrowAtPosition(currentEditor, lastPosition); // Redraw the arrow with the new visibility state
                            }
                            return;
                    }
                },
                undefined,
                context.subscriptions
            );

            // Dispose of panel when closed
            panel.onDidDispose(() => {
                panel = undefined;
            }, null, context.subscriptions);

            // Event listener for cursor position change
            vscode.window.onDidChangeTextEditorSelection(event => {
                if (event.textEditor === currentEditor) {
                    lastPosition = event.selections[0].active; // Update the last position to the current active selection
                    if (showArrow) {
                        drawArrowAtPosition(currentEditor, lastPosition); // Redraw the arrow at the new position
                    }
                }
            });

            // Event listener for active editor change
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (editor) {
                    currentEditor = editor; // Update the active editor reference
                    lastPosition = editor.selection.active; // Update the cursor position
                    if (showArrow) {
                        drawArrowAtPosition(editor, lastPosition); // Draw arrow in the new active editor
                    }
                }
            });

            // Retain focus on the editor after opening the webview
            vscode.window.showTextDocument(currentEditor.document, { preview: false, preserveFocus: true });
            if (showArrow) {
                drawArrowAtPosition(currentEditor, lastPosition);
            }
        } else {
            vscode.window.showInformationMessage('No active editor found!');
        }
    });

    context.subscriptions.push(disposable);
}

// Function to trigger the typewriter effect
async function triggerTypewriter(text: string, speed: number) {
    if (currentEditor) {
        let position = lastPosition || currentEditor.selection.active; // Use the last stored position
        await typeWriteText(currentEditor, position, text, speed); // Pass speed to the typewriter function
    } else {
        vscode.window.showInformationMessage('No active editor found!');
    }
}

// Clear text area when the clear button is pressed
function handleClear() {
    if (panel) {
        panel.webview.postMessage({ command: 'clearText' });
    }
}

async function insertTextAtPosition(editor: vscode.TextEditor, position: vscode.Position, text: string) {
    await editor.edit(editBuilder => {
        editBuilder.insert(position, text); // Insert text at the given position
    });
}

// Typewriter function
async function typeWriteText(editor: vscode.TextEditor, position: vscode.Position, text: string, speed: number) {
    const lines = text.split('\n'); // Split the text by new lines

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]; // Maintain the line as-is for indentation
        const trimmedLine = line.trim(); // Get the trimmed line for inserting characters

        // If this is not the first line, insert a newline
        if (i > 0) {
            await insertTextAtPosition(editor, position, '\n');
            position = position.translate(1, 0); // Move down for the next line
        }

        // Insert leading spaces/tabs before typing the actual line
        await insertTextAtPosition(editor, position, line.substring(0, line.length - trimmedLine.length));
        position = position.translate(0, trimmedLine.length); // Move cursor to the end of leading spaces

        // Type each character with delay
        for (const char of trimmedLine) {
            await new Promise(resolve => setTimeout(resolve, speed)); // Wait for the specified speed
            await insertTextAtPosition(editor, position, char); // Insert each character one by one
            position = position.translate(0, 1); // Move cursor to the right
        }
    }
}

// Function to select a specific tab (editor)
async function selectSpecificTab(tabName: string) {
    const document = vscode.workspace.textDocuments.find(doc => doc.fileName.endsWith(tabName));
    if (document) {
        const editor = vscode.window.visibleTextEditors.find(editor => editor.document === document);
        if (editor) {
            await vscode.window.showTextDocument(document, {
                preserveFocus: true,
                preview: false, // Prevent closing the tab on switching
            });
            vscode.window.showInformationMessage(`Switched to tab: ${tabName}`);
            currentEditor = editor;
            lastPosition = editor.selection.active;
            if (showArrow) {
                drawArrowAtPosition(editor, lastPosition); // Draw the arrow at the new position
            }
        } else {
            vscode.window.showInformationMessage('No matching tab found for this document!');
        }
    } else {
        vscode.window.showInformationMessage('Document not found!');
    }
}

// Function to draw an arrow at the last cursor position
function drawArrowAtPosition(editor: vscode.TextEditor, position: vscode.Position) {
    if (!showArrow) {
        editor.setDecorations(decorationType, []); // Clear decorations if arrow is hidden
        return;
    }
    editor.setDecorations(decorationType, [{ range: new vscode.Range(position, position) }]);
}

// Function to generate the webview content with the dropdown, start, and clear button
function getWebviewContent(openedTabs: string[]): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <body>
        <h1>Typewriter Effect</h1>
        <textarea id="textInput" rows="4" cols="50" placeholder="Type your text here..."></textarea><br>
        <input type="number" id="speedInput" value="100" placeholder="Speed (ms)"><br>
        <button id="typeButton">Start Typewriter</button>
        <button id="clearButton">Clear</button>
        <label>
            <input type="checkbox" id="arrowToggle" checked> Show Arrow
        </label>
        <select id="tabSelector">
            ${openedTabs.map(tab => `<option value="${tab}">${tab}</option>`).join('')}
        </select>
        <script>
            const vscode = acquireVsCodeApi();

            // Start button event listener
            document.getElementById('typeButton').addEventListener('click', () => {
                const text = document.getElementById('textInput').value;
                const speed = parseInt(document.getElementById('speedInput').value) || 100; // Default speed
                vscode.postMessage({ command: 'triggerTypewriter', text: text, speed: speed });
            });

            // Clear button event listener
            document.getElementById('clearButton').addEventListener('click', () => {
                document.getElementById('textInput').value = ''; // Clear text input
                vscode.postMessage({ command: 'handleClear' });
            });

            // Arrow toggle event listener
            document.getElementById('arrowToggle').addEventListener('change', (event) => {
                vscode.postMessage({ command: 'toggleArrowVisibility', isVisible: event.target.checked });
            });

            // Tab selection event listener
            document.getElementById('tabSelector').addEventListener('change', (event) => {
                vscode.postMessage({ command: 'selectTab', tabName: event.target.value });
            });

            // Listen for messages to clear the textarea
            window.addEventListener('message', event => {
                const message = event.data;
                if (message.command === 'clearText') {
                    document.getElementById('textInput').value = ''; // Clear the textarea
                }
            });
        </script>
    </body>
    </html>`;
}

export function deactivate() {
    if (panel) {
        panel.dispose();
    }
}
