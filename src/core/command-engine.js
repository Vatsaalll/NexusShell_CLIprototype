import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

/**
 * Command Engine - Handles command parsing, execution, and pipeline management
 */
export class CommandEngine extends EventEmitter {
    constructor(shell) {
        super();
        this.shell = shell;
        this.commands = new Map();
        this.aliases = new Map();
        this.commandHistory = [];
        this.pipelineCache = new Map();
    }

    /**
     * Register a command
     */
    registerCommand(name, handler, options = {}) {
        if (this.commands.has(name)) {
            throw new Error(`Command '${name}' is already registered`);
        }

        const command = {
            name,
            handler,
            description: options.description || 'No description provided',
            usage: options.usage || name,
            flags: options.flags || {},
            args: options.args || [],
            category: options.category || 'general',
            async: options.async !== false,
            permissions: options.permissions || [],
            ...options
        };

        this.commands.set(name, command);
        this.emit('commandRegistered', { name, command });
        
        return command;
    }

    /**
     * Execute a command or pipeline
     */
    async execute(input, context = {}) {
        const trimmedInput = input.trim();
        
        if (!trimmedInput) {
            return null;
        }

        // Add to history
        this.commandHistory.push({
            input: trimmedInput,
            timestamp: Date.now(),
            context
        });

        // Check if it's a pipeline
        if (trimmedInput.includes('|')) {
            return this.executePipeline(trimmedInput, context);
        }

        // Check if it's object pipeline mode (JavaScript-like syntax)
        if (this.isObjectPipelineMode(trimmedInput)) {
            return this.executeObjectPipeline(trimmedInput, context);
        }

        // Execute single command
        return this.executeSingleCommand(trimmedInput, context);
    }

    /**
     * Execute a single command
     */
    async executeSingleCommand(input, context = {}) {
        const { command, args, flags } = this.parseCommand(input);
        
        // Check for alias
        const resolvedCommand = this.aliases.get(command) || command;
        
        // Check if command exists
        if (!this.commands.has(resolvedCommand)) {
            // Try to execute as system command
            return this.executeSystemCommand(resolvedCommand, args, flags, context);
        }

        const commandDef = this.commands.get(resolvedCommand);
        
        // Check permissions
        await this.checkPermissions(commandDef, context);
        
        // Execute command
        try {
            const result = await commandDef.handler({
                command: resolvedCommand,
                args,
                flags,
                context,
                shell: this.shell
            });
            
            return result;
            
        } catch (error) {
            throw new Error(`Command '${resolvedCommand}' failed: ${error.message}`);
        }
    }

    /**
     * Execute a pipeline of commands
     */
    async executePipeline(input, context = {}) {
        const commands = input.split('|').map(cmd => cmd.trim());
        let result = null;
        
        console.log(chalk.blue(`🔗 Executing pipeline: ${commands.length} commands`));
        
        for (let i = 0; i < commands.length; i++) {
            const command = commands[i];
            const pipelineContext = {
                ...context,
                pipelineInput: result,
                pipelineIndex: i,
                pipelineLength: commands.length
            };
            
            result = await this.executeSingleCommand(command, pipelineContext);
        }
        
        return result;
    }

    /**
     * Execute object pipeline mode (JavaScript-like syntax)
     */
    async executeObjectPipeline(input, context = {}) {
        try {
            // Create a safe evaluation context
            const safeContext = this.createSafeContext(context);
            
            // Use Function constructor for safer evaluation than eval
            const func = new Function('fs', 'proc', 'net', 'utils', 'context', `
                "use strict";
                return (${input});
            `);
            
            const result = func(
                safeContext.fs,
                safeContext.proc,
                safeContext.net,
                safeContext.utils,
                context
            );
            
            // Handle promises
            if (result && typeof result.then === 'function') {
                return await result;
            }
            
            return result;
            
        } catch (error) {
            throw new Error(`Object pipeline execution failed: ${error.message}`);
        }
    }

    /**
     * Execute system command
     */
    async executeSystemCommand(command, args, flags, context = {}) {
        return new Promise((resolve, reject) => {
            const child = spawn(command, args, {
                stdio: context.capture ? 'pipe' : 'inherit',
                cwd: this.shell.currentDirectory,
                env: this.shell.environment
            });

            let stdout = '';
            let stderr = '';

            if (context.capture) {
                child.stdout.on('data', (data) => {
                    stdout += data.toString();
                });

                child.stderr.on('data', (data) => {
                    stderr += data.toString();
                });
            }

            child.on('close', (code) => {
                if (code === 0) {
                    resolve({
                        success: true,
                        code,
                        stdout: stdout.trim(),
                        stderr: stderr.trim()
                    });
                } else {
                    reject(new Error(`Command failed with code ${code}: ${stderr}`));
                }
            });

            child.on('error', reject);
        });
    }

    /**
     * Parse command string into components
     */
    parseCommand(input) {
        const parts = input.split(' ').filter(part => part.trim());
        const command = parts[0];
        const args = [];
        const flags = {};

        for (let i = 1; i < parts.length; i++) {
            const part = parts[i];
            
            if (part.startsWith('--')) {
                const [key, value] = part.slice(2).split('=');
                flags[key] = value || true;
            } else if (part.startsWith('-')) {
                flags[part.slice(1)] = true;
            } else {
                args.push(part);
            }
        }

        return { command, args, flags };
    }

    /**
     * Check if input is object pipeline mode
     */
    isObjectPipelineMode(input) {
        // Simple heuristic: contains method calls and dots
        return /\w+\.\w+\(/.test(input) || 
               input.includes('.filter(') || 
               input.includes('.map(') ||
               input.includes('.reduce(');
    }

    /**
     * Create safe evaluation context for object pipeline mode
     */
    createSafeContext(context) {
        return {
            fs: this.shell.objectBridge.getFileSystemAPI(),
            proc: this.shell.objectBridge.getProcessAPI(),
            net: this.shell.objectBridge.getNetworkAPI(),
            utils: this.shell.objectBridge.getUtilsAPI(),
            console: {
                log: (...args) => console.log(chalk.blue('[PIPE]'), ...args),
                error: (...args) => console.error(chalk.red('[PIPE]'), ...args),
                warn: (...args) => console.warn(chalk.yellow('[PIPE]'), ...args)
            }
        };
    }

    /**
     * Check command permissions
     */
    async checkPermissions(command, context) {
        for (const permission of command.permissions) {
            const hasPermission = await this.shell.securityContext.checkPermission(permission, context);
            if (!hasPermission) {
                throw new Error(`Permission denied: ${permission}`);
            }
        }
    }

    /**
     * Get command count
     */
    getCommandCount() {
        return this.commands.size;
    }

    /**
     * Get command by name
     */
    getCommand(name) {
        return this.commands.get(name);
    }

    /**
     * List all commands
     */
    listCommands() {
        return Array.from(this.commands.values());
    }

    /**
     * Get command history
     */
    getHistory() {
        return this.commandHistory;
    }

    /**
     * Clear command history
     */
    clearHistory() {
        this.commandHistory = [];
    }

    /**
     * Set alias
     */
    setAlias(alias, command) {
        this.aliases.set(alias, command);
    }

    /**
     * Remove alias
     */
    removeAlias(alias) {
        return this.aliases.delete(alias);
    }

    /**
     * List aliases
     */
    listAliases() {
        return Array.from(this.aliases.entries());
    }
}