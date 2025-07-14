import { EventEmitter } from 'events';
import { CommandEngine } from './command-engine.js';
import { SecurityContext } from './security-context.js';
import { ObjectBridge } from './object-bridge.js';
import { ExecutionRecorder } from './execution-recorder.js';
import { REPL } from './repl.js';
import { PerformanceMonitor } from './performance-monitor.js';
import chalk from 'chalk';

/**
 * NexusShell Core Engine
 * Manages command execution, security, and shell state
 */
export class NexusShell extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            maxMemory: 50 * 1024 * 1024, // 50MB default
            enableJIT: false,
            enableSandbox: true,
            enableDebug: false,
            ...options
        };

        // Initialize core components
        this.commandEngine = new CommandEngine(this);
        this.securityContext = new SecurityContext(this);
        this.objectBridge = new ObjectBridge(this);
        this.executionRecorder = new ExecutionRecorder(this);
        this.performanceMonitor = new PerformanceMonitor(this);
        this.repl = new REPL(this);

        // Shell state
        this.isRunning = false;
        this.currentDirectory = process.cwd();
        this.environment = { ...process.env };
        this.aliases = new Map();
        this.plugins = new Map();
        this.transactionStack = [];

        // Performance metrics
        this.stats = {
            commandsExecuted: 0,
            totalExecutionTime: 0,
            memoryUsage: 0,
            cacheHits: 0,
            cacheMisses: 0
        };

        if (this.options.enableDebug) {
            this.enableDebugMode();
        }
    }

    /**
     * Start the shell
     */
    async start() {
        if (this.isRunning) {
            throw new Error('Shell is already running');
        }

        console.log(chalk.green('🌟 Initializing NexusShell components...'));
        
        // Initialize security context
        await this.securityContext.initialize();
        
        // Start performance monitoring
        this.performanceMonitor.start();
        
        // Initialize object bridge
        await this.objectBridge.initialize();
        
        this.isRunning = true;
        this.emit('started');
        
        console.log(chalk.green('✅ NexusShell ready!'));
        console.log(chalk.gray('Type "help" for commands or "exit" to quit.\n'));
        
        // Start REPL
        await this.repl.start();
    }

    /**
     * Stop the shell
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }

        console.log(chalk.yellow('🛑 Stopping NexusShell...'));
        
        // Stop components
        await this.repl.stop();
        this.performanceMonitor.stop();
        
        this.isRunning = false;
        this.emit('stopped');
        
        console.log(chalk.green('✅ NexusShell stopped'));
    }

    /**
     * Execute a command
     */
    async executeCommand(input, context = {}) {
        if (!this.isRunning) {
            throw new Error('Shell is not running');
        }

        const startTime = Date.now();
        this.stats.commandsExecuted++;

        try {
            // Check security permissions
            await this.securityContext.checkPermission('command:execute', { input });

            // Record execution if enabled
            if (this.executionRecorder.isRecording()) {
                this.executionRecorder.recordCommand(input, context);
            }

            // Execute command
            const result = await this.commandEngine.execute(input, context);
            
            // Update performance stats
            const executionTime = Date.now() - startTime;
            this.stats.totalExecutionTime += executionTime;
            this.stats.memoryUsage = process.memoryUsage().heapUsed;

            this.emit('commandExecuted', { input, result, executionTime });
            
            return result;
            
        } catch (error) {
            this.emit('commandError', { input, error });
            throw error;
        }
    }

    /**
     * Register a command
     */
    registerCommand(name, handler, options = {}) {
        return this.commandEngine.registerCommand(name, handler, options);
    }

    /**
     * Register a plugin
     */
    async registerPlugin(name, plugin) {
        if (this.plugins.has(name)) {
            throw new Error(`Plugin '${name}' is already registered`);
        }

        // Initialize plugin
        if (typeof plugin.initialize === 'function') {
            await plugin.initialize(this);
        }

        this.plugins.set(name, plugin);
        this.emit('pluginRegistered', { name, plugin });
        
        console.log(chalk.green(`🔌 Plugin '${name}' registered`));
    }

    /**
     * Execute a transaction
     */
    async executeTransaction(commands, options = {}) {
        const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const snapshot = this.createSnapshot();
        
        this.transactionStack.push({
            id: transactionId,
            snapshot,
            commands,
            options
        });

        try {
            console.log(chalk.blue(`🔄 Starting transaction ${transactionId}`));
            
            const results = [];
            for (const command of commands) {
                const result = await this.executeCommand(command);
                results.push(result);
            }
            
            this.transactionStack.pop();
            console.log(chalk.green(`✅ Transaction ${transactionId} completed`));
            
            return results;
            
        } catch (error) {
            console.log(chalk.red(`💥 Transaction ${transactionId} failed, rolling back...`));
            await this.rollbackTransaction(transactionId);
            throw error;
        }
    }

    /**
     * Rollback a transaction
     */
    async rollbackTransaction(transactionId) {
        const transaction = this.transactionStack.find(tx => tx.id === transactionId);
        if (!transaction) {
            throw new Error(`Transaction ${transactionId} not found`);
        }

        // Restore snapshot
        await this.restoreSnapshot(transaction.snapshot);
        
        // Execute rollback callback if provided
        if (transaction.options.onRollback) {
            await transaction.options.onRollback(transaction);
        }
        
        console.log(chalk.yellow(`↩️  Transaction ${transactionId} rolled back`));
    }

    /**
     * Create a system snapshot
     */
    createSnapshot() {
        return {
            timestamp: Date.now(),
            currentDirectory: this.currentDirectory,
            environment: { ...this.environment },
            aliases: new Map(this.aliases)
        };
    }

    /**
     * Restore from snapshot
     */
    async restoreSnapshot(snapshot) {
        this.currentDirectory = snapshot.currentDirectory;
        this.environment = { ...snapshot.environment };
        this.aliases = new Map(snapshot.aliases);
    }

    /**
     * Get shell statistics
     */
    getStats() {
        return {
            ...this.stats,
            uptime: this.performanceMonitor.getUptime(),
            memoryUsage: process.memoryUsage(),
            pluginCount: this.plugins.size,
            commandCount: this.commandEngine.getCommandCount()
        };
    }

    /**
     * Enable debug mode
     */
    enableDebugMode() {
        console.log(chalk.magenta('🐛 Debug mode enabled'));
        
        this.on('commandExecuted', ({ input, executionTime }) => {
            console.log(chalk.gray(`[DEBUG] Command: ${input} (${executionTime}ms)`));
        });

        this.on('commandError', ({ input, error }) => {
            console.log(chalk.red(`[DEBUG] Error in command: ${input}`), error);
        });
    }
}