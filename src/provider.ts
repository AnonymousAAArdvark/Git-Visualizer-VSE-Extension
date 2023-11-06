import * as vscode from "vscode";
import * as path from "path";
import { LogResult, DefaultLogFields } from "simple-git";
import { get_git_graph, Graph_Data, get_commits } from "./helper_functions";

export class GitVisualizerProvider implements vscode.WebviewViewProvider {

	public static readonly viewType = 'git-visualizer';
	private _view?: vscode.WebviewView;
    private prevCommits?: LogResult<DefaultLogFields>;
    private prev_graph_data: Graph_Data | undefined;
    private sol_graph_data: Graph_Data | undefined;
    private completed: boolean;


	constructor(
		private readonly _extensionUri: vscode.Uri,
	) {
        this.prevCommits = undefined;
        this.prev_graph_data = undefined;
        this.sol_graph_data = undefined;
        this.completed = false;
     }

    private async renameFolder(path: string, oldFolder: string, newFolder: string) {
        const oldFolderPath = vscode.Uri.file(path + "/" + oldFolder); // Replace with the old folder path
        const newFolderPath = vscode.Uri.file(path + "/" + newFolder); // Replace with the new folder path

        try {
            const parentDirectoryContents = await vscode.workspace.fs.readDirectory(vscode.Uri.file(path));
            const oldFolderExists = parentDirectoryContents.some(([name, type]) => name === oldFolder && type === vscode.FileType.Directory);
    
            if (!oldFolderExists) {
                // vscode.window.showErrorMessage('Error renaming folder: The old folder does not exist.');
                return;
            }
    
            // Rename the folder if it exists
            await vscode.workspace.fs.rename(oldFolderPath, newFolderPath);
            // vscode.window.showInformationMessage('Folder renamed successfully.');
        } catch (error: any) {
            // vscode.window.showErrorMessage('Error renaming folder: ' + error.message);
            return;
        }
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

        // // check if commits have changed

        // let currCommits: LogResult<DefaultLogFields> = await get_commits(ws_path);

        // if (currCommits === this.prevCommits) {
        //     return;
        // }

        // this.prevCommits = currCommits;


        // get git graph data
        this.prev_graph_data = await get_git_graph(ws_path);
        await this.renameFolder(ws_path + "/.Git-Gud", ".git-gud", ".git");
        this.sol_graph_data = await get_git_graph(ws_path + "/.Git-Gud")
        await this.renameFolder(ws_path + "/.Git-Gud", ".git", ".git-gud");

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
            this.sol_graph_data,
            this.completed,
        );

        function getWebviewContent(
            force_graph_js: vscode.Uri,
            resize_js: vscode.Uri,
            d3_js: vscode.Uri,
            graph_data: Graph_Data,
            sol_graph_data: Graph_Data,
            completed: boolean,
        ) {
        for (let i = 0; i < graph_data.nodes.length; i++) {
            graph_data.nodes[i].x = 0;
            graph_data.nodes[i].y = (graph_data.nodes.length - i);
        }
        for (let i = 0; i < sol_graph_data.nodes.length; i++) {
            sol_graph_data.nodes[i].x = 0;
            sol_graph_data.nodes[i].y = (sol_graph_data.nodes.length - i);
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

            #goalButton {
            position: absolute; 
            z-index: 99;
            top: 10px;
            left: 10px;
            // left: 0; 
            // right: 0;
            // bottom: 20px;
            // margin-left: auto;
            // margin-right: auto;
            width: 120px;
            display: inline-block;
            outline: 0;
            border: 1px solid #3d3d3d;
            cursor: pointer;
            border-radius: 0;
            font-size: 15px;
            height: 35px;
            background: #212121;
            color: white;
            padding: 0 20px;
            }

            #goalButton:hover {
            background-color: #1c1c1c;
            }

            #completedText {
                position: absolute;
                text-align: center;
                z-index: 99;
                top: 35px;
                left: 0;
                right: 0;
                margin-left: auto;
                margin-right: auto;
                // padding-top: 10px;
                // padding-bottom: 10px;
                font-size: 30px;
                font-weight: bold;
                color: lightgreen;
            }
        </style>

        <script src="${force_graph_js}"></script>
        <script src="${resize_js}"></script>
        <script src="${d3_js}"></script>

        </head>

        <body>
        <button id="goalButton" onClick="toggleGoal()">Show Goal</button>
        <p id="completedText">Exercise Completed!</p>
        <div id="graph"></div>

        <script>
            let showGoal = false;
            let nodeCounter = 0;
            let graphData = ${JSON.stringify(graph_data)};
            let solGraphData = ${JSON.stringify(sol_graph_data)};
            let completed = ${JSON.stringify(completed)};
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

                // .d3VelocityDecay(.2)

            if (showGoal) {
                Graph.graphData(solGraphData);
            } else {
                Graph.graphData(graphData);
            }

            let completedText = document.getElementById("completedText");
            if (completed) {
                completedText.style.display = "block";
              booleanValue = false;
            } else {
                completedText.style.display = "none";
            }

            Graph.onEngineStop(() => Graph.zoomToFit(200, 50));
                            
            // Handle the message inside the webview
            window.addEventListener('message', event => {
                if (event.data === false || event.data === true) {
                    completed = event.data;
                    let completedText = document.getElementById("completedText");
                    if (completed) {
                        completedText.style.display = "block";
                      booleanValue = false;
                    } else {
                        completedText.style.display = "none";
                    }
                    return;
                }

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

                if (showGoal) {
                    Graph.graphData(solGraphData);
                } else {
                    Graph.graphData(graphData);
                }
                Graph.onEngineStop(() => Graph.zoomToFit(200, 50));
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
                    Graph.onEngineStop(() => Graph.zoomToFit(200, 50));
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
                if (showGoal) {
                    Graph.graphData(solGraphData);
                } else {
                    Graph.graphData(graphData);
                }
            }
        </script>
        </body>`;
        }
    }
    
    public async updateGraphData(context: vscode.ExtensionContext) {
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

        for (let i = 0; i < curr_graph_data.nodes.length; i++) {
            curr_graph_data.nodes[i].x = 0;
            curr_graph_data.nodes[i].y = (curr_graph_data.nodes.length - i);
        }

        this.completed = false;
        if (this.sol_graph_data && curr_graph_data.nodes.length === this.sol_graph_data.nodes.length) {
            this.completed = true;
            for (let i = 0; i < curr_graph_data.nodes.length; i++) {
                if (curr_graph_data.nodes[i].hover !== this.sol_graph_data.nodes[i].hover) {
                    this.completed = false;
                    break;
                }
            }
        }

        this._view!.webview.postMessage(this.completed);
    
        if (this.prev_graph_data && JSON.stringify(curr_graph_data.nodes) === JSON.stringify(this.prev_graph_data.nodes)) {
            return;
        }
    
        this.prev_graph_data = curr_graph_data;
    
        // Create and show a new webview
        
        this._view!.webview.postMessage(this.prev_graph_data);
    }
}