// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { LogResult, DefaultLogFields } from "simple-git";
import { GitVisualizerProvider } from "./provider";

let prevCommits: LogResult<DefaultLogFields>;


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const provider = new GitVisualizerProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(GitVisualizerProvider.viewType, provider, { 
      webviewOptions: {
        retainContextWhenHidden: true,
      }
    })
  );

  let interval = setInterval(async () => {
    await provider.updateGraphData(context);
  }, 2000);

  context.subscriptions.push(vscode.Disposable.from({
    dispose: () => {
      if (interval) {
        clearInterval(interval);
      }
    }
  }));

  vscode.commands.executeCommand("git-visualizer.focus");
}

// this method is called when your extension is deactivated
export function deactivate() {}
