import chalk from 'chalk';

/**
 * Utils Plugin - Provides utility commands
 */
export async function loadUtilsPlugin(shell) {
    const plugin = {
        name: 'utils-plugin',
        version: '1.0.0',
        description: 'Utility commands for everyday tasks',
        
        async initialize(shell) {
            console.log(chalk.blue('🔧 Initializing Utils Plugin'));
            
            // Register utility commands
            this.registerCommands(shell);
            
            console.log(chalk.green('✅ Utils Plugin initialized'));
        },
        
        registerCommands(shell) {
            // Base64 encode/decode
            shell.registerCommand('base64', async ({ args, flags }) => {
                const text = args.join(' ');
                const decode = flags.d || flags.decode;
                
                if (!text) {
                    throw new Error('Text required');
                }
                
                try {
                    if (decode) {
                        return Buffer.from(text, 'base64').toString('utf8');
                    } else {
                        return Buffer.from(text, 'utf8').toString('base64');
                    }
                } catch (error) {
                    throw new Error(`Base64 operation failed: ${error.message}`);
                }
            }, {
                description: 'Base64 encode/decode text',
                usage: 'base64 <text> [-d|--decode]',
                flags: {
                    d: 'Decode mode',
                    decode: 'Decode mode'
                },
                category: 'utils'
            });
            
            // URL encode/decode
            shell.registerCommand('urlencode', async ({ args, flags }) => {
                const text = args.join(' ');
                const decode = flags.d || flags.decode;
                
                if (!text) {
                    throw new Error('Text required');
                }
                
                try {
                    if (decode) {
                        return decodeURIComponent(text);
                    } else {
                        return encodeURIComponent(text);
                    }
                } catch (error) {
                    throw new Error(`URL encoding operation failed: ${error.message}`);
                }
            }, {
                description: 'URL encode/decode text',
                usage: 'urlencode <text> [-d|--decode]',
                flags: {
                    d: 'Decode mode',
                    decode: 'Decode mode'
                },
                category: 'utils'
            });
            
            // Hash generator
            shell.registerCommand('hash', async ({ args, flags }) => {
                const text = args.join(' ');
                const algorithm = flags.a || flags.algorithm || 'sha256';
                
                if (!text) {
                    throw new Error('Text required');
                }
                
                try {
                    const crypto = await import('crypto');
                    const hash = crypto.createHash(algorithm);
                    hash.update(text);
                    return hash.digest('hex');
                } catch (error) {
                    throw new Error(`Hash generation failed: ${error.message}`);
                }
            }, {
                description: 'Generate hash for text',
                usage: 'hash <text> [-a|--algorithm sha256|sha1|md5]',
                flags: {
                    a: 'Hash algorithm',
                    algorithm: 'Hash algorithm'
                },
                category: 'utils'
            });
            
            // UUID generator
            shell.registerCommand('uuid', async ({ flags }) => {
                const version = flags.v || flags.version || 4;
                const count = parseInt(flags.c || flags.count) || 1;
                
                const generateUUID = () => {
                    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                        const r = Math.random() * 16 | 0;
                        const v = c === 'x' ? r : (r & 0x3 | 0x8);
                        return v.toString(16);
                    });
                };
                
                const uuids = [];
                for (let i = 0; i < count; i++) {
                    uuids.push(generateUUID());
                }
                
                return uuids.join('\n');
            }, {
                description: 'Generate UUID',
                usage: 'uuid [-v|--version 4] [-c|--count 1]',
                flags: {
                    v: 'UUID version',
                    version: 'UUID version',
                    c: 'Number of UUIDs to generate',
                    count: 'Number of UUIDs to generate'
                },
                category: 'utils'
            });
            
            // JSON formatter
            shell.registerCommand('json', async ({ args, flags }) => {
                const text = args.join(' ');
                const compact = flags.c || flags.compact;
                const validate = flags.v || flags.validate;
                
                if (!text) {
                    throw new Error('JSON text required');
                }
                
                try {
                    const parsed = JSON.parse(text);
                    
                    if (validate) {
                        return 'Valid JSON';
                    }
                    
                    return JSON.stringify(parsed, null, compact ? 0 : 2);
                } catch (error) {
                    throw new Error(`Invalid JSON: ${error.message}`);
                }
            }, {
                description: 'Format and validate JSON',
                usage: 'json <json-text> [-c|--compact] [-v|--validate]',
                flags: {
                    c: 'Compact output',
                    compact: 'Compact output',
                    v: 'Validate only',
                    validate: 'Validate only'
                },
                category: 'utils'
            });
            
            // Text transform
            shell.registerCommand('transform', async ({ args, flags }) => {
                const text = args.join(' ');
                const operation = flags.o || flags.operation || 'upper';
                
                if (!text) {
                    throw new Error('Text required');
                }
                
                switch (operation) {
                    case 'upper':
                        return text.toUpperCase();
                    case 'lower':
                        return text.toLowerCase();
                    case 'title':
                        return text.replace(/\w\S*/g, (txt) => 
                            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
                        );
                    case 'reverse':
                        return text.split('').reverse().join('');
                    case 'trim':
                        return text.trim();
                    case 'length':
                        return text.length.toString();
                    case 'words':
                        return text.split(/\s+/).length.toString();
                    case 'lines':
                        return text.split('\n').length.toString();
                    default:
                        throw new Error(`Unknown operation: ${operation}`);
                }
            }, {
                description: 'Transform text',
                usage: 'transform <text> [-o|--operation upper|lower|title|reverse|trim|length|words|lines]',
                flags: {
                    o: 'Transform operation',
                    operation: 'Transform operation'
                },
                category: 'utils'
            });
            
            // Calculator
            shell.registerCommand('calc', async ({ args }) => {
                const expression = args.join(' ');
                
                if (!expression) {
                    throw new Error('Mathematical expression required');
                }
                
                try {
                    // Simple expression evaluation (security note: in production, use a proper math parser)
                    const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
                    const result = Function('"use strict"; return (' + sanitized + ')')();
                    
                    return `${expression} = ${result}`;
                } catch (error) {
                    throw new Error(`Invalid expression: ${error.message}`);
                }
            }, {
                description: 'Simple calculator',
                usage: 'calc <expression>',
                category: 'utils'
            });
            
            // Color palette
            shell.registerCommand('colors', async ({ flags }) => {
                const demo = flags.d || flags.demo;
                
                if (demo) {
                    const colors = [
                        { name: 'red', fn: chalk.red },
                        { name: 'green', fn: chalk.green },
                        { name: 'blue', fn: chalk.blue },
                        { name: 'yellow', fn: chalk.yellow },
                        { name: 'magenta', fn: chalk.magenta },
                        { name: 'cyan', fn: chalk.cyan },
                        { name: 'white', fn: chalk.white },
                        { name: 'gray', fn: chalk.gray }
                    ];
                    
                    const demo_text = colors.map(color => 
                        color.fn(`${color.name}: The quick brown fox jumps over the lazy dog`)
                    ).join('\n');
                    
                    return demo_text;
                }
                
                return [
                    'Available colors:',
                    '  red, green, blue, yellow',
                    '  magenta, cyan, white, gray',
                    '',
                    'Use --demo to see color examples'
                ].join('\n');
            }, {
                description: 'Show available colors',
                usage: 'colors [-d|--demo]',
                flags: {
                    d: 'Show color demo',
                    demo: 'Show color demo'
                },
                category: 'utils'
            });
        }
    };
    
    await shell.registerPlugin(plugin.name, plugin);
}