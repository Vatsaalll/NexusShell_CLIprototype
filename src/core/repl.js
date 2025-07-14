import { EventEmitter } from 'events';
import readline from 'readline';
import chalk from 'chalk';

/**
 * REPL - Interactive shell interface
 */
export class REPL extends EventEmitter {
    constructor(shell) {
        super();
        this.shell = shell;
        this.rl = null;
        this.history = [];
        this.historyIndex = -1;
        this.multilineBuffer = '';
        this.inMultilineMode = false;
        this.completionWords = [];
        this.isRunning = false;
    }

    /**
     * Start REPL
     */
    async start() {
        if (this.isRunning) {
            return;
        }

        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: this.getPrompt(),
            completer: this.completer.bind(this),
            history: this.history
        });

        this.setupEventHandlers();
        this.updateCompletionWords();
        this.isRunning = true;

        console.log(chalk.cyan('🚀 NexusShell REPL started'));
        console.log(chalk.gray('Type "help" for commands, "exit" to quit, or start typing JavaScript/shell commands\n'));

        this.prompt();
    }

    /**
     * Stop REPL
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }

        if (this.rl) {
            this.rl.close();
            this.rl = null;
        }

        this.isRunning = false;
        console.log(chalk.yellow('👋 REPL stopped'));
    }

    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        this.rl.on('line', async (input) => {
            await this.handleInput(input);
        });

        this.rl.on('close', () => {
            console.log(chalk.yellow('\nGoodbye! 👋'));
            process.exit(0);
        });

        this.rl.on('SIGINT', () => {
            if (this.inMultilineMode) {
                this.inMultilineMode = false;
                this.multilineBuffer = '';
                console.log(chalk.yellow('\nMultiline mode cancelled'));
                this.prompt();
            } else {
                console.log(chalk.yellow('\nPress Ctrl+C again to exit, or type "exit"'));
                this.prompt();
            }
        });

        // Handle history navigation
        this.rl.on('history', (history) => {
            this.history = history;
        });
    }

    /**
     * Handle input
     */
    async handleInput(input) {
        const trimmedInput = input.trim();

        // Handle empty input
        if (!trimmedInput) {
            this.prompt();
            return;
        }

        // Handle multiline mode
        if (this.inMultilineMode) {
            if (trimmedInput === '') {
                // Execute multiline command
                await this.executeInput(this.multilineBuffer);
                this.multilineBuffer = '';
                this.inMultilineMode = false;
            } else {
                this.multilineBuffer += '\n' + input;
                this.rl.setPrompt(this.getMultilinePrompt());
            }
            this.prompt();
            return;
        }

        // Check for multiline start
        if (this.isMultilineStart(trimmedInput)) {
            this.inMultilineMode = true;
            this.multilineBuffer = input;
            this.rl.setPrompt(this.getMultilinePrompt());
            this.prompt();
            return;
        }

        // Execute single line command
        await this.executeInput(trimmedInput);
        this.prompt();
    }

    /**
     * Execute input
     */
    async executeInput(input) {
        const trimmedInput = input.trim();

        // Handle built-in REPL commands
        if (await this.handleBuiltinCommand(trimmedInput)) {
            return;
        }

        // Add to history
        this.addToHistory(trimmedInput);

        try {
            const result = await this.shell.executeCommand(trimmedInput, {
                repl: true,
                capture: false
            });

            // Display result if it exists
            if (result !== null && result !== undefined) {
                this.displayResult(result);
            }

        } catch (error) {
            console.error(chalk.red('❌ Error:'), error.message);
            if (this.shell.options.enableDebug) {
                console.error(chalk.gray(error.stack));
            }
        }
    }

    /**
     * Handle built-in REPL commands
     */
    async handleBuiltinCommand(input) {
        const parts = input.split(' ');
        const command = parts[0];

        switch (command) {
            case 'exit':
            case 'quit':
                await this.shell.stop();
                return true;

            case 'clear':
                console.clear();
                return true;

            case 'history':
                this.displayHistory();
                return true;

            case 'help':
                this.displayHelp();
                return true;

            case 'stats':
                this.displayStats();
                return true;

            case 'plugins':
                this.displayPlugins();
                return true;

            case 'record':
                await this.handleRecordCommand(parts.slice(1));
                return true;

            case 'replay':
                await this.handleReplayCommand(parts.slice(1));
                return true;

            case 'multi':
                console.log(chalk.blue('🔄 Entering multiline mode. Press Enter twice to execute.'));
                this.inMultilineMode = true;
                this.multilineBuffer = '';
                this.rl.setPrompt(this.getMultilinePrompt());
                return true;

            default:
                return false;
        }
    }

    /**
     * Handle record command
     */
    async handleRecordCommand(args) {
        const subcommand = args[0];

        switch (subcommand) {
            case 'start':
                const name = args[1];
                await this.shell.executionRecorder.startRecording(name);
                break;

            case 'stop':
                await this.shell.executionRecorder.stopRecording();
                break;

            case 'list':
                const recordings = this.shell.executionRecorder.listRecordings();
                console.log(chalk.blue('📼 Recordings:'));
                recordings.forEach(r => {
                    console.log(`  ${r.id}: ${r.name} (${r.commands?.length || 0} commands)`);
                });
                break;

            default:
                console.log(chalk.yellow('Usage: record [start|stop|list] [name]'));
        }
    }

    /**
     * Handle replay command
     */
    async handleReplayCommand(args) {
        const recordingId = parseInt(args[0]);
        if (isNaN(recordingId)) {
            console.log(chalk.yellow('Usage: replay <recording-id>'));
            return;
        }

        try {
            await this.shell.executionRecorder.replay(recordingId);
        } catch (error) {
            console.error(chalk.red('❌ Replay failed:'), error.message);
        }
    }

    /**
     * Display result
     */
    displayResult(result) {
        if (typeof result === 'string') {
            console.log(result);
        } else if (typeof result === 'object' && result !== null) {
            if (result.toString && typeof result.toString === 'function' && result.toString !== Object.prototype.toString) {
                console.log(result.toString());
            } else {
                console.log(JSON.stringify(result, null, 2));
            }
        } else {
            console.log(result);
        }
    }

    /**
     * Display history
     */
    displayHistory() {
        console.log(chalk.blue('📜 Command History:'));
        this.history.forEach((cmd, i) => {
            console.log(`  ${i + 1}: ${cmd}`);
        });
    }

    /**
     * Display help
     */
    displayHelp() {
        console.log(chalk.blue('🆘 NexusShell Help:'));
        console.log();
        console.log(chalk.cyan('Built-in Commands:'));
        console.log('  help       - Show this help message');
        console.log('  exit       - Exit the shell');
        console.log('  clear      - Clear the screen');
        console.log('  history    - Show command history');
        console.log('  stats      - Show shell statistics');
        console.log('  plugins    - List loaded plugins');
        console.log('  multi      - Enter multiline mode');
        console.log('  record     - Recording commands (start|stop|list)');
        console.log('  replay     - Replay recorded session');
        console.log();
        console.log(chalk.cyan('Shell Commands:'));
        const commands = this.shell.commandEngine.listCommands();
        commands.forEach(cmd => {
            console.log(`  ${cmd.name.padEnd(10)} - ${cmd.description}`);
        });
        console.log();
        console.log(chalk.cyan('Object Pipeline Examples:'));
        console.log('  fs.dir(".").filter(f => f.size > 1024)');
        console.log('  proc.list().filter(p => p.cpu > 5)');
        console.log('  net.get("https://api.github.com/users/octocat")');
        console.log();
    }

    /**
     * Display stats
     */
    displayStats() {
        const stats = this.shell.getStats();
        console.log(chalk.blue('📊 Shell Statistics:'));
        console.log(`  Commands executed: ${stats.commandsExecuted}`);
        console.log(`  Total execution time: ${stats.totalExecutionTime}ms`);
        console.log(`  Average execution time: ${stats.commandsExecuted > 0 ? Math.round(stats.totalExecutionTime / stats.commandsExecuted) : 0}ms`);
        console.log(`  Memory usage: ${Math.round(stats.memoryUsage.heapUsed / 1024 / 1024)}MB`);
        console.log(`  Uptime: ${Math.round(stats.uptime)}s`);
        console.log(`  Plugins loaded: ${stats.pluginCount}`);
        console.log(`  Commands available: ${stats.commandCount}`);
    }

    /**
     * Display plugins
     */
    displayPlugins() {
        const plugins = Array.from(this.shell.plugins.keys());
        console.log(chalk.blue('🔌 Loaded Plugins:'));
        if (plugins.length === 0) {
            console.log('  No plugins loaded');
        } else {
            plugins.forEach(plugin => {
                console.log(`  ${plugin}`);
            });
        }
    }

    /**
     * Add to history
     */
    addToHistory(input) {
        if (input && input !== this.history[this.history.length - 1]) {
            this.history.push(input);
            if (this.history.length > 1000) {
                this.history.shift();
            }
        }
    }

    /**
     * Get prompt
     */
    getPrompt() {
        const cwd = this.shell.currentDirectory.replace(process.env.HOME || '', '~');
        return chalk.green(`nexus:${cwd}$ `);
    }

    /**
     * Get multiline prompt
     */
    getMultilinePrompt() {
        return chalk.yellow('... ');
    }

    /**
     * Check if input starts multiline mode
     */
    isMultilineStart(input) {
        return input.endsWith('{') || 
               input.endsWith('[') || 
               input.endsWith('(') ||
               input.includes('function') ||
               input.includes('if (') ||
               input.includes('for (') ||
               input.includes('while (') ||
               input.includes('try {');
    }

    /**
     * Prompt for next input
     */
    prompt() {
        if (this.rl) {
            this.rl.prompt();
        }
    }

    /**
     * Update completion words
     */
    updateCompletionWords() {
        this.completionWords = [
            // Built-in commands
            'help', 'exit', 'clear', 'history', 'stats', 'plugins', 'multi', 'record', 'replay',
            // Shell commands
            ...this.shell.commandEngine.listCommands().map(cmd => cmd.name),
            // Object pipeline starters
            'fs.', 'proc.', 'net.', 'utils.',
            // Common JavaScript keywords
            'function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'try', 'catch', 'async', 'await'
        ];
    }

    /**
     * Tab completion
     */
    completer(line) {
        const hits = this.completionWords.filter(word => word.startsWith(line));
        return [hits.length ? hits : this.completionWords, line];
    }
}