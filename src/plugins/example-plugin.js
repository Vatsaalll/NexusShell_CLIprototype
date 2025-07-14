import chalk from 'chalk';

/**
 * Example Plugin - Demonstrates plugin architecture
 */
export async function loadExamplePlugin(shell) {
    const plugin = {
        name: 'example-plugin',
        version: '1.0.0',
        description: 'Example plugin demonstrating NexusShell extensibility',
        
        async initialize(shell) {
            console.log(chalk.blue('🔌 Initializing Example Plugin'));
            
            // Register plugin commands
            this.registerCommands(shell);
            
            // Setup event listeners
            this.setupEventListeners(shell);
            
            console.log(chalk.green('✅ Example Plugin initialized'));
        },
        
        registerCommands(shell) {
            // Hello command
            shell.registerCommand('hello', async ({ args }) => {
                const name = args[0] || 'World';
                return `Hello, ${name}! 👋 This is from the Example Plugin.`;
            }, {
                description: 'Say hello (from Example Plugin)',
                usage: 'hello [name]',
                category: 'example'
            });
            
            // Plugin info command
            shell.registerCommand('plugin-info', async ({ args }) => {
                const pluginName = args[0] || 'example-plugin';
                const plugin = shell.plugins.get(pluginName);
                
                if (!plugin) {
                    throw new Error(`Plugin not found: ${pluginName}`);
                }
                
                return [
                    `Plugin: ${plugin.name}`,
                    `Version: ${plugin.version}`,
                    `Description: ${plugin.description}`
                ].join('\n');
            }, {
                description: 'Show plugin information',
                usage: 'plugin-info [plugin-name]',
                category: 'example'
            });
            
            // Echo command with colors
            shell.registerCommand('echo-color', async ({ args, flags }) => {
                const text = args.join(' ');
                const color = flags.color || 'white';
                
                const colorMap = {
                    red: chalk.red,
                    green: chalk.green,
                    blue: chalk.blue,
                    yellow: chalk.yellow,
                    magenta: chalk.magenta,
                    cyan: chalk.cyan,
                    white: chalk.white
                };
                
                const colorFn = colorMap[color] || chalk.white;
                return colorFn(text);
            }, {
                description: 'Echo text with color',
                usage: 'echo-color <text> [--color red|green|blue|yellow|magenta|cyan|white]',
                flags: {
                    color: 'Text color'
                },
                category: 'example'
            });
            
            // Random number generator
            shell.registerCommand('random', async ({ args, flags }) => {
                const min = parseInt(args[0]) || 0;
                const max = parseInt(args[1]) || 100;
                const count = parseInt(flags.count) || 1;
                
                const numbers = [];
                for (let i = 0; i < count; i++) {
                    numbers.push(Math.floor(Math.random() * (max - min + 1)) + min);
                }
                
                return numbers.join(', ');
            }, {
                description: 'Generate random numbers',
                usage: 'random [min] [max] [--count number]',
                flags: {
                    count: 'Number of random numbers to generate'
                },
                category: 'example'
            });
            
            // Timer command
            shell.registerCommand('timer', async ({ args, flags }) => {
                const duration = parseInt(args[0]) || 5;
                const message = args.slice(1).join(' ') || 'Timer finished!';
                const silent = flags.s || flags.silent;
                
                if (!silent) {
                    console.log(chalk.blue(`⏱️  Timer started: ${duration} seconds`));
                }
                
                for (let i = duration; i > 0; i--) {
                    if (!silent) {
                        process.stdout.write(`\r${chalk.yellow(`⏳ ${i}s remaining...`)}`);
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                if (!silent) {
                    process.stdout.write('\r' + ' '.repeat(20) + '\r');
                    console.log(chalk.green(`🔔 ${message}`));
                }
                
                return message;
            }, {
                description: 'Countdown timer',
                usage: 'timer [seconds] [message] [-s|--silent]',
                flags: {
                    s: 'Silent mode',
                    silent: 'Silent mode'
                },
                category: 'example'
            });
        },
        
        setupEventListeners(shell) {
            // Listen for command execution
            shell.on('commandExecuted', (data) => {
                if (data.input.startsWith('hello')) {
                    console.log(chalk.gray('👋 Example Plugin: Hello command executed'));
                }
            });
            
            // Listen for errors
            shell.on('commandError', (data) => {
                console.log(chalk.red('❌ Example Plugin: Command error detected'));
            });
        }
    };
    
    await shell.registerPlugin(plugin.name, plugin);
}