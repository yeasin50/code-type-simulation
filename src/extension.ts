import * as vscode from 'vscode';

let lastPosition: vscode.Position | null = null; // Store last cursor position
let storedDocument: vscode.TextDocument | null = null; // Store the last active document
let currentEditor: vscode.TextEditor | undefined; // Store the current active editor reference
let panel: vscode.WebviewPanel | undefined; // Webview panel  
let decorationType: vscode.TextEditorDecorationType; // To hold the decoration for the arrow
let isTyping: boolean = false; // Flag to prevent multiple typing triggers
let autoTriggerOnPaste: boolean = false; // Flag for auto-trigger on paste
let typingSpeed: number = 20; // Default typing speed

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "code-type-simulation" is now active!');

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

			if (panel) {
				panel.reveal(vscode.ViewColumn.Beside);
				panel.webview.html = getWebviewContent(vscode.window.visibleTextEditors.map(editor => editor.document.fileName));
				return;
			}

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
							// Only trigger typewriter if not already typing
							if (!isTyping) {
								isTyping = true; // Set a flag indicating typing is in progress
								triggerTypewriter(message.text, message.speed).finally(() => {
									isTyping = false; // Reset the typing flag once done
								});
							}
							return;
						case 'handlePaste':
							// Handle pasting text based on autoTriggerOnPaste flag
							if (autoTriggerOnPaste) {
								handlePaste(message.text); // Only handle paste if auto-trigger is enabled
							}
							return;
						case 'selectTab':
							selectSpecificTab(message.tabName); // Handle tab switching
							return;
						case 'focusLastActiveEditor':
							focusLastActiveEditor(); // Focus the last active editor
							return;
						case 'toggleAutoTrigger':
							autoTriggerOnPaste = message.value; // Update the auto-trigger flag
							return;
						case 'setTypingSpeed':
							typingSpeed = message.value; // Update typing speed
							return;
					}
				},
				undefined,
				context.subscriptions
			);

			// Event listener for editor changes
			vscode.window.onDidChangeActiveTextEditor(editor => {
				if (editor) {
					currentEditor = editor; // Update current editor reference
					lastPosition = currentEditor.selection.active; // Update last position when switching editors
					drawArrowAtPosition(currentEditor, lastPosition); // Draw the arrow at the new position
				}
			});

			// Retain focus on the editor after opening the webview
			vscode.window.showTextDocument(currentEditor.document, { preview: false, preserveFocus: true });
			drawArrowAtPosition(currentEditor, lastPosition);
		} else {
			vscode.window.showInformationMessage('No active editor found!');
		}
	});

	context.subscriptions.push(disposable);
}

async function triggerTypewriter(text: string, speed: number) {
	if (currentEditor) {
		let position = lastPosition || currentEditor.selection.active; // Use the last stored position
		await typeWriteText(currentEditor, position, text, speed); // Pass speed to the typewriter function
	} else {
		vscode.window.showInformationMessage('No active editor found!');
	}
}

async function handlePaste(text: string) {
	if (currentEditor) {
		const position = currentEditor.selection.active; // Get the current cursor position
		const lines = text.split('\n').filter(line => line.trim().length > 0); // Only keep non-empty lines
		let newPosition = position;

		for (const line of lines) {
			await insertTextAtPosition(currentEditor, newPosition, line);
			newPosition = newPosition.translate(1, 0); // Move cursor down for the next line
		}

		// Trigger typing if auto-trigger is enabled
		if (autoTriggerOnPaste) {
			await triggerTypewriter(text, typingSpeed); // Call typewriter with the specified speed
		}
	} else {
		vscode.window.showInformationMessage('No active editor found!');
	}
}

async function insertTextAtPosition(editor: vscode.TextEditor, position: vscode.Position, text: string) {
	// Check if editor is still valid
	if (editor) {
		await editor.edit(editBuilder => {
			// Insert text without adding an extra newline
			editBuilder.insert(position, text);
		});
	}
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
			vscode.window.showInformationMessage('Switched to the desired tab!');
			// Remember the cursor position before switching
			lastPosition = editor.selection.active;
			drawArrowAtPosition(editor, lastPosition); // Draw the arrow at the new position
		} else {
			vscode.window.showInformationMessage('No matching tab found for this document!');
		}
	} else {
		vscode.window.showInformationMessage('Document not found!');
	}
}

// Function to focus the last active editor
async function focusLastActiveEditor() {
	if (currentEditor && lastPosition) {
		// Focus the last active editor
		await vscode.window.showTextDocument(currentEditor.document, { preserveFocus: true, preview: false });

		// Check if lastPosition is valid and apply it
		if (lastPosition) {
			const selection = new vscode.Selection(lastPosition, lastPosition); // Create a selection at the lastPosition
			currentEditor.selection = selection; // Set the selection in the current editor
			drawArrowAtPosition(currentEditor, lastPosition); // Draw the arrow at the restored position
		}
	} else {
		vscode.window.showInformationMessage('No last active editor or position found!');
	}
}

// Function to draw an arrow at the last cursor position
function drawArrowAtPosition(editor: vscode.TextEditor, position: vscode.Position) {
	editor.setDecorations(decorationType, [{ range: new vscode.Range(position, position) }]);
}

// Function to generate the webview content with the dropdown
function getWebviewContent(openedTabs: string[]): string {
	return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Typewriter Effect</title>
    </head>
    <body>
        <h1>Typewriter Effect</h1>
        <textarea id="textInput" rows="10" cols="30" placeholder="Enter text here..."></textarea>
        <br>
        <input type="number" id="speedInput" placeholder="Speed (ms)" value="${typingSpeed}" min="1" />
        <button id="typeButton">Start Typewriter</button>
        <button id="clearButton">Clear</button>
        <label>
            <input type="checkbox" id="autoTriggerCheckbox"> Auto-Trigger on Paste
        </label>
        <select id="tabSelector">
            ${openedTabs.map(tab => `<option value="${tab}">${tab}</option>`).join('')}
        </select>
        <script>
            const vscode = acquireVsCodeApi();
            let pastedText = '';

            // Start typing when button is clicked
            document.getElementById('typeButton').addEventListener('click', () => {
                const text = document.getElementById('textInput').value || pastedText; // Use pastedText if empty
                const speed = parseInt(document.getElementById('speedInput').value) || 20; // Default speed
                vscode.postMessage({ command: 'triggerTypewriter', text: text, speed: speed });
                pastedText = ''; // Clear pastedText after triggering
            });

            // Clear the text area
            document.getElementById('clearButton').addEventListener('click', () => {
                document.getElementById('textInput').value = ''; // Clear text area
                pastedText = ''; // Clear stored pasted text
            });

            // Handle pasting of text
            document.addEventListener('paste', (event) => {
                const pastedData = event.clipboardData.getData('text');
                if (document.getElementById('autoTriggerCheckbox').checked) {
                    vscode.postMessage({ command: 'handlePaste', text: pastedData }); // Only handle paste if auto-trigger is enabled
                } else {
                    pastedText = pastedData; // Store pasted text for manual triggering
                }
            });

            // Handle tab selection
            document.getElementById('tabSelector').addEventListener('change', (event) => {
                const selectedTab = event.target.value;
                vscode.postMessage({ command: 'selectTab', tabName: selectedTab });
            });

            // Toggle auto-trigger on paste
            document.getElementById('autoTriggerCheckbox').addEventListener('change', (event) => {
                vscode.postMessage({ command: 'toggleAutoTrigger', value: event.target.checked });
            });

            // Update typing speed when input changes
            document.getElementById('speedInput').addEventListener('change', (event) => {
                const speed = parseInt(event.target.value) || 20;
                vscode.postMessage({ command: 'setTypingSpeed', value: speed });
            });
        </script>
    </body>
    </html>`;
}

// This method is called when your extension is deactivated
export function deactivate() {
	// Clean up when extension is deactivated
	if (panel) {
		panel.dispose();
	}
	decorationType.dispose(); // Dispose of the arrow decoration
}
