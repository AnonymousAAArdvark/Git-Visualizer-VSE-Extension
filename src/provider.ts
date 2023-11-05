import * as vscode from "vscode";
import * as path from "path";
import { LogResult, DefaultLogFields } from "simple-git";
import { get_git_graph, Graph_Data, get_commits } from "./helper_functions";

export class GitVisualizerProvider implements vscode.WebviewViewProvider {

	public static readonly viewType = 'git-visualizer';
	private _view?: vscode.WebviewView;
    private prevCommits?: LogResult<DefaultLogFields>;
    private prev_graph_data: Graph_Data | undefined;


	constructor(
		private readonly _extensionUri: vscode.Uri,
	) {
        this.prevCommits = undefined;
        this.prev_graph_data = undefined;
        
     }

	public async resolveWebviewView(
		currentPanel: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
        this._view = currentPanel;

		currentPanel.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,

			localResourceRoots: [
				this._extensionUri
			]
		};


        // The code you place here will be executed every time your command is executed

        // makes sure that only 1 workspace is open
        if (vscode.workspace.workspaceFolders == undefined) {
            vscode.window.showInformationMessage(
            "No workspace opened! Please open only 1 workspace."
            );
            return;
        } else if (vscode.workspace.workspaceFolders.length > 1) {
            vscode.window.showInformationMessage(
            "More than 1 workspace opened! Please open only 1 workspace."
            );
            return;
        }

        // check if .git folder exists
        try {
            await vscode.workspace.fs.stat(
            vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, ".git")
            );
        } catch {
            vscode.window.showInformationMessage(
            "Workspace is not a git repository! Please run 'git init' in the terminal."
            );
            return;
        }

        // get path of workspace (first workspace)
        let ws_path = vscode.workspace.workspaceFolders[0].uri.fsPath;

        // check if commits have changed

        let currCommits: LogResult<DefaultLogFields> = await get_commits(ws_path);

        if (currCommits === this.prevCommits) {
            return;
        }

        this.prevCommits = currCommits;


        // get git graph data
        this.prev_graph_data = await get_git_graph(ws_path);

        // Get path to resource on disk
        // And get the special URI to use with the webview
        const force_graph_js = currentPanel.webview.asWebviewUri(vscode.Uri.file(
        path.join(
            this._extensionUri.path,
            "node_modules",
            "force-graph",
            "dist",
            "force-graph.js"
        )
        ));

        const resize_js = currentPanel.webview.asWebviewUri(vscode.Uri.file(
        path.join(
            this._extensionUri.path,
            "node_modules",
            "element-resize-detector",
            "dist",
            "element-resize-detector.js"
        )
        ));

        // And set its HTML content
        currentPanel.webview.html = getWebviewContent(
        force_graph_js,
        resize_js,
        this.prev_graph_data
        );

        // currentPanel.onDidDispose(
        // () => {
        //     currentPanel = undefined;
        // },
        // undefined,
        // context.subscriptions
        // );

        function getWebviewContent(
        force_graph_js: vscode.Uri,
        resize_js: vscode.Uri,
        graph_data: Graph_Data
        ) {
        return `<head>
        <style>
            html, body {
            height: 100vh;
            width: 100vw;
            margin: 0;
            padding: 0;
            }

            * {
            box-sizing: border-box;
            }

            #goalButton {
            position: absolute; 
            left: 10px; 
            bottom: 20px;
            display: inline-block;
            outline: 0;
            border: 2px solid black;
            cursor: pointer;
            font-weight: 600;
            border-radius: 4px;
            font-size: 13px;
            height: 30px;
            background-color: #0000000d;
            color: #0e0e10;
            padding: 0 20px;
            }

            #goalButton:hover {
            background-color: #0000001a;
            }

            
        </style>

        <script src="${force_graph_js}"></script>
        <script src="${resize_js}"></script>

        </head>

        <body>
        <div id="graph"></div>
        <button id="goalButton" onClick="toggleGoal()">Show Goal</button>

        <script>
            let showGoal = false;
            const Graph = ForceGraph()
                (document.getElementById('graph'))
                .nodeCanvasObject((node, ctx) => nodePaint(node, ['orange', 'darkblue', 'red', 'green', 'purple', 'maroon'][node.type], ctx))
                .nodePointerAreaPaint(nodePaint)
                .nodeLabel('hover')
                .backgroundColor('white')
                .linkDirectionalArrowLength(6)
                .linkColor(link => 'black')
                .onNodeRightClick(node => {
                    navigator.clipboard.writeText(node.rt_clk);
                })
                .graphData(${JSON.stringify(graph_data)})
                            
            // Handle the message inside the webview
            window.addEventListener('message', event => {

                let old_graph = Graph.graphData();
                let new_graph = event.data;
        
                for (let i = 0; i < new_graph.nodes.length; ++i) {
                    for (let j = 0; j < old_graph.nodes.length; ++j) {
                    if (new_graph.nodes[i].id == old_graph.nodes[j].id) {
                        new_graph.nodes[i].x = old_graph.nodes[j].x;
                        new_graph.nodes[i].y = old_graph.nodes[j].y;
                        new_graph.nodes[i].vx = old_graph.nodes[j].vx;
                        new_graph.nodes[i].vy = old_graph.nodes[j].vy;                       
                        break;
                    }
                    }
                }

                Graph.graphData(new_graph);
                Graph.zoomToFit();
            });              

            function nodePaint({ hover, type, x, y }, color, ctx) {

                // commit, branch, tag, stash, remote, head
                let identifier = ['C', 'LB', 'T', 'S', 'RB', 'H'];
                ctx.fillStyle = color;

                [
                () => { ctx.beginPath(); ctx.arc(x, y, 5, 0, 2 * Math.PI, false); ctx.fill(); }, // circle
                () => { ctx.fillRect(x - 6, y - 6, 12, 12); ctx.fillStyle = 'white'; ctx.font = '6px Sans-Serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(identifier[type], x, y);}, // text box
                ][type == 0 ? 0 : 1]();
            }
            
            elementResizeDetectorMaker().listenTo(
                document.body,
                (el) => {
                Graph.width(el.offsetWidth);
                Graph.height(el.offsetHeight);
                }
            );

            function toggleGoal() {
                showGoal = !showGoal;
                const button = document.getElementById("goalButton");

                if (showGoal) {
                button.innerHTML = 'Hide Goal';
                } else {
                    button.innerHTML = 'Show Goal';
                }
            }
        </script>
        </body>`;
        }
    }
    
    public async updateGraphData(context: vscode.ExtensionContext) {
        console.log("updated");
        // makes sure that only 1 workspace is open
        if (vscode.workspace.workspaceFolders == undefined) {
            vscode.window.showInformationMessage(
              "No workspace opened! Please open only 1 workspace."
            );
            return 0;
        } else if (vscode.workspace.workspaceFolders.length > 1) {
            vscode.window.showInformationMessage(
                "More than 1 workspace opened! Please open only 1 workspace."
            );
            return;
        }
    
        // check if .git folder exists
        try {
            await vscode.workspace.fs.stat(
                vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, ".git")
        );
        } catch {
            vscode.window.showInformationMessage(
                "Workspace is not a git repository! Please run 'git init' in the terminal."
            );
            return;
        }
        let ws_path = vscode.workspace.workspaceFolders[0].uri.fsPath;
    
        // get git graph data
        let curr_graph_data = await get_git_graph(ws_path);
    
        if (this.prev_graph_data && JSON.stringify(curr_graph_data.nodes) === JSON.stringify(this.prev_graph_data.nodes)) {
            return;
        }
    
        this.prev_graph_data = curr_graph_data;
    
        // Create and show a new webview
        
        this._view!.webview.postMessage(curr_graph_data);
    }
}