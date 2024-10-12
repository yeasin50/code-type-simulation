// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';

let lastPosition: vscode.Position | null = null;
let storedDocument: vscode.TextDocument | null = null; // Store the last active document
let currentEditor: vscode.TextEditor | undefined; // Store the current active editor reference

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "code-type-simulation" is now active!');

	let disposable = vscode.commands.registerCommand('extension.openTypewriterPanel', () => {
		currentEditor = vscode.window.activeTextEditor; // Store the current active editor reference

		if (currentEditor) {
			lastPosition = currentEditor.selection.active; // Store the cursor position
			storedDocument = currentEditor.document; // Store the active document

			// Show the arrow at the last cursor position
			showArrowAtPosition(currentEditor, lastPosition);

			const panel = vscode.window.createWebviewPanel(
				'typewriterPanel', // Identifies the type of the webview. Used internally
				'Typewriter Effect', // Title of the panel displayed to the user
				vscode.ViewColumn.Beside, // Open the webview beside the editor
				{
					enableScripts: true // Enable scripts in the webview
				}
			);

			// Get the list of opened tab names
			const openedTabs = vscode.window.visibleTextEditors.map(editor => editor.document.fileName);
			// Set the HTML content of the webview, including the dropdown
			panel.webview.html = getWebviewContent(openedTabs);

			// Listen for messages from the webview
			panel.webview.onDidReceiveMessage(
				message => {
					switch (message.command) {
						case 'triggerTypewriter':
							triggerTypewriter(message.text, message.speed); // Pass speed along with text
							return;
						case 'handlePaste':
							handlePaste(message.text); // Handle paste text
							return;
						case 'selectTab':
							selectSpecificTab(message.tabName); // Select specific tab by name
							return;
					}
				},
				undefined,
				context.subscriptions
			);

			// Retain focus on the editor after opening the webview
			vscode.window.showTextDocument(currentEditor.document, { preview: false, preserveFocus: true });
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
		var position = currentEditor.selection.active; // Get the current cursor position
		const lines = text.split('\n'); // Split text into lines

		for (const line of lines) {
			// Insert each line at the current cursor position
			await insertTextAtPosition(currentEditor, position, line);
			// Move the cursor down by one line after pasting
			position = position.translate(1, 0);
		}
	} else {
		vscode.window.showInformationMessage('No active editor found!');
	}
}

async function insertTextAtPosition(editor: vscode.TextEditor, position: vscode.Position, text: string) {
	await editor.edit(editBuilder => {
		editBuilder.insert(position, text + '\n'); // Add a newline after the inserted text
	});
}

// Typewriter function (stub for demonstration)
async function typeWriteText(editor: vscode.TextEditor, position: vscode.Position, text: string, speed: number) {
	for (const char of text) {
		await new Promise(resolve => setTimeout(resolve, speed));
		await insertTextAtPosition(editor, position, char); // Insert each character
		position = position.translate(0, 1); // Move cursor to the right
	}
}

// Function to show an arrow at the last active position
function showArrowAtPosition(editor: vscode.TextEditor, position: vscode.Position) {
	const decorationType = vscode.window.createTextEditorDecorationType({
		after: {
			contentText: '➤', // You can customize this to any symbol or character
			color: 'orange', // Change color as needed
			margin: '0 0 0 5px',
			fontWeight: 'bold',
		},
	});

	editor.setDecorations(decorationType, [{ range: new vscode.Range(position, position) }]);
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
		} else {
			vscode.window.showInformationMessage('No matching tab found for this document!');
		}
	} else {
		vscode.window.showInformationMessage('Document not found!');
	}
}

// Function to generate the webview content with the dropdown
function getWebviewContent(openedTabs: string[]): string {
	return `<!DOCTYPE html>
    <html lang="en">
    <body>
        <h1>Typewriter Effect</h1>
        <textarea id="textInput" rows="4" cols="50" placeholder="Type your text here..."></textarea>
        <input type="number" id="speedInput" value="100" placeholder="Speed (ms)">
        <button id="typeButton">Start Typewriter</button>
        <select id="tabSelector">
            ${openedTabs.map(tab => `<option value="${tab}">${tab}</option>`).join('')}
        </select>
        <script>
            const vscode = acquireVsCodeApi();
            document.getElementById('typeButton').addEventListener('click', () => {
                const text = document.getElementById('textInput').value;
                const speed = parseInt(document.getElementById('speedInput').value) || 100; // Default speed
                vscode.postMessage({ command: 'triggerTypewriter', text: text, speed: speed });
            });
            document.getElementById('tabSelector').addEventListener('change', (event) => {
                vscode.postMessage({ command: 'selectTab', tabName: event.target.value });
            });
            document.addEventListener('paste', (event) => {
                const pastedText = event.clipboardData.getData('text/plain');
                vscode.postMessage({ command: 'handlePaste', text: pastedText });
                event.preventDefault(); // Prevent the default paste
            });
        </script>
    </body>
    </html>`;
}

// This method is called when your extension is deactivated
export function deactivate() { }
