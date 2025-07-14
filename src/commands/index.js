import { registerFileCommands } from './file-commands.js';
import { registerProcessCommands } from './process-commands.js';
import { registerNetworkCommands } from './network-commands.js';
import { registerSystemCommands } from './system-commands.js';
import { registerDevCommands } from './dev-commands.js';
import chalk from 'chalk';

/**
 * Register all core commands
 */
export async function registerCoreCommands(shell) {
    console.log(chalk.blue('📦 Registering core commands...'));
    
    // Register command categories
    await registerFileCommands(shell);
    await registerProcessCommands(shell);
    await registerNetworkCommands(shell);
    await registerSystemCommands(shell);
    await registerDevCommands(shell);
    
    console.log(chalk.green('✅ Core commands registered'));
}