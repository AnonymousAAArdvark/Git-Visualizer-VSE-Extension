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
			],
		};


        // The code you place here will be executed every time your command is executed

        // makes sure that only 1 workspace is open
        if (vscode.workspace.workspaceFolders === undefined) {
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

        // get git graph data
        this.prev_graph_data = await get_git_graph(ws_path);

        // // check if commits have changed

        // let currCommits: LogResult<DefaultLogFields> = await get_commits(ws_path);

        // if (currCommits === this.prevCommits) {
        //     return;
        // }

        // this.prevCommits = currCommits;

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

        const d3_js = currentPanel.webview.asWebviewUri(vscode.Uri.file(
            path.join(
                this._extensionUri.path,
                "node_modules",
                "d3",
                "dist",
                "d3.js"
            )
        ));

        // And set its HTML content
        currentPanel.webview.html = getWebviewContent(
            force_graph_js,
            resize_js,
            d3_js,
            this.prev_graph_data,
        );

        function getWebviewContent(
            force_graph_js: vscode.Uri,
            resize_js: vscode.Uri,
            d3_js: vscode.Uri,
            graph_data: Graph_Data,
        ) {
        for (let i = 0; i < graph_data.nodes.length; i++) {
            graph_data.nodes[i].x = 0;
            graph_data.nodes[i].y = (graph_data.nodes.length - i);
        }
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
        </style>

        <script src="${force_graph_js}"></script>
        <script src="${resize_js}"></script>
        <script src="${d3_js}"></script>

        </head>

        <body>
        <div id="graph"></div>

        <script>
            let graphData = ${JSON.stringify(graph_data)};
            const Graph = ForceGraph()
                (document.getElementById('graph'))
                .nodeCanvasObject((node, ctx) => nodePaint(node, ['sandybrown', 'lightskyblue', 'hotpink', 'palegreen', 'orchid', 'lightcoral'][node.type], ctx))
                .nodePointerAreaPaint(nodePaint)
                .cooldownTicks(200)
                .nodeLabel('hover')
                .dagMode('radialIn')
                .d3Force("link", d3.forceLink().id(function(d) { return d.id; }).distance(20))
                .d3Force("charge", d3.forceManyBody().strength(-80))
                .d3Force("x", d3.forceX(.5).strength(.1))
                .backgroundColor('#1a1a1a')
                .linkDirectionalArrowLength(8)
                .linkColor(link => 'white')
                .onNodeRightClick(node => {
                    navigator.clipboard.writeText(node.rt_clk);
                })

            Graph.graphData(graphData);
            Graph.onEngineStop(() => Graph.zoomToFit(200, 50));
            // setTimeout(Graph.zoomToFit(200, 50), 500);
                            
            // Handle the message inside the webview
            window.addEventListener('message', event => {
                let old_graph = Graph.graphData();
                graphData = event.data;
        
                for (let i = 0; i < graphData.nodes.length; ++i) {
                    for (let j = 0; j < old_graph.nodes.length; ++j) {
                        if (graphData.nodes[i].id == old_graph.nodes[j].id) {
                            graphData.nodes[i].x = old_graph.nodes[j].x;
                            graphData.nodes[i].y = old_graph.nodes[j].y;
                            graphData.nodes[i].vx = old_graph.nodes[j].vx;
                            graphData.nodes[i].vy = old_graph.nodes[j].vy;                       
                            break;
                        }
                    }
                }

                Graph.graphData(graphData);
                // Graph.zoomToFit(200, 50);
            });              

            function nodePaint({ hover, type, x, y }, color, ctx) {

                // commit, branch, tag, stash, remote, head
                let identifier = ['C', 'LB', 'T', 'S', 'RB', 'H'];
                ctx.fillStyle = color;

                [
                () => { ctx.beginPath(); ctx.arc(x, y, 8, 0, 2 * Math.PI, false); ctx.fill(); }, // circle
                () => { ctx.fillRect(x - 9, y - 9, 18, 18); ctx.fillStyle = 'black'; ctx.font = 'bold 10px Sans-Serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(identifier[type], x, y);}, // text box
                ][type == 0 ? 0 : 1]();
            }
            
            elementResizeDetectorMaker().listenTo(
                document.body,
                (el) => {
                    Graph.width(el.offsetWidth);
                    Graph.height(el.offsetHeight);
                    Graph.d3ReheatSimulation();
                    // Graph.zoomToFit(200, 50);
                }
            );
        </script>
        </body>`;
        }
    }
    
    public async updateGraphData(context: vscode.ExtensionContext) {
        // makes sure that only 1 workspace is open
        if (vscode.workspace.workspaceFolders === undefined) {
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

        for (let i = 0; i < curr_graph_data.nodes.length; i++) {
            curr_graph_data.nodes[i].x = 0;
            curr_graph_data.nodes[i].y = (curr_graph_data.nodes.length - i);
        }
    
        if (this.prev_graph_data && JSON.stringify(curr_graph_data.nodes) === JSON.stringify(this.prev_graph_data.nodes)) {
            return;
        }
    
        this.prev_graph_data = curr_graph_data;
    
        // Create and show a new webview
        
        this._view!.webview.postMessage(this.prev_graph_data);
    }
}