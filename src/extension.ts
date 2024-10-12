// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "code-type-simulation" is now active!');

	// Register command to get cursor position
	let disposable = vscode.commands.registerCommand('extension.getCursorPosition', async () => {
		const editor = vscode.window.activeTextEditor;

		if (editor) {
			const position = editor.selection.active; // Get the active cursor position
			const textToType = "Hello, this is a typewriter effect!";
			await typeWriteText(editor, position, textToType);

		} else {
			vscode.window.showInformationMessage('No active editor found!');
		}
	});

	context.subscriptions.push(disposable);
}

// Typewriter effect function
async function typeWriteText(editor: vscode.TextEditor, position: vscode.Position, text: string) {
	for (let i = 0; i < text.length; i++) {
		// Insert one character at a time
		await insertTextAtPosition(editor, position, text[i]);
		// Move cursor to the right
		position = position.translate(0, 1);
		// Wait for a bit before typing the next character
		await new Promise(resolve => setTimeout(resolve, 10)); // Adjust typing speed here
	}
}

// Function to insert text at a specific position
async function insertTextAtPosition(editor: vscode.TextEditor, position: vscode.Position, text: string) {
	await editor.edit(editBuilder => {
		editBuilder.insert(position, text);
	});
}
// This method is called when your extension is deactivated
export function deactivate() { }
