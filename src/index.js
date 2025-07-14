#!/usr/bin/env node

import { NexusShell } from './core/shell.js';
import { registerCoreCommands } from './commands/index.js';
import { initializePlugins } from './plugins/index.js';
import chalk from 'chalk';

/**
 * NexusShell Entry Point
 * Initializes the shell with core commands and plugins
 */
async function main() {
    console.log(chalk.cyan.bold('🚀 NexusShell v1.0.0 - Next-Generation CLI'));
    console.log(chalk.gray('Built with C++ performance and JavaScript extensibility\n'));

    try {
        // Initialize the shell core
        const shell = new NexusShell({
            maxMemory: 50 * 1024 * 1024, // 50MB limit
            enableJIT: true,
            enableSandbox: true,
            enableDebug: process.env.NODE_ENV === 'development'
        });

        // Register core commands
        await registerCoreCommands(shell);
        
        // Initialize plugins
        await initializePlugins(shell);

        // Start the shell
        await shell.start();
        
    } catch (error) {
        console.error(chalk.red('❌ Failed to initialize NexusShell:'), error.message);
        process.exit(1);
    }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error(chalk.red('💥 Uncaught Exception:'), error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('🚨 Unhandled Rejection at:'), promise, 'reason:', reason);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n👋 Shutting down NexusShell...'));
    process.exit(0);
});

main();