import chalk from 'chalk';

/**
 * Register development commands
 */
export async function registerDevCommands(shell) {
    
    // Package manager simulation
    shell.registerCommand('package', async ({ args, flags }) => {
        const action = args[0];
        const packageName = args[1];
        
        switch (action) {
            case 'install':
                if (!packageName) {
                    throw new Error('Package name required');
                }
                
                console.log(chalk.blue(`📦 Installing package: ${packageName}`));
                
                // Simulate package installation
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                console.log(chalk.green(`✅ Package installed: ${packageName}`));
                return `Package ${packageName} installed successfully`;
                
            case 'remove':
                if (!packageName) {
                    throw new Error('Package name required');
                }
                
                console.log(chalk.yellow(`🗑️  Removing package: ${packageName}`));
                
                // Simulate package removal
                await new Promise(resolve => setTimeout(resolve, 500));
                
                console.log(chalk.green(`✅ Package removed: ${packageName}`));
                return `Package ${packageName} removed successfully`;
                
            case 'list':
                const packages = [
                    { name: 'nexus-utils', version: '1.0.0', description: 'Utility functions for NexusShell' },
                    { name: 'nexus-git', version: '2.1.0', description: 'Git integration for NexusShell' },
                    { name: 'nexus-docker', version: '1.5.0', description: 'Docker commands for NexusShell' }
                ];
                
                if (flags.f === 'json' || flags.format === 'json') {
                    return JSON.stringify(packages, null, 2);
                }
                
                const headers = ['Name', 'Version', 'Description'];
                const rows = packages.map(p => [p.name, p.version, p.description]);
                
                return formatTable(headers, rows);
                
            case 'search':
                if (!packageName) {
                    throw new Error('Search term required');
                }
                
                console.log(chalk.blue(`🔍 Searching for: ${packageName}`));
                
                const searchResults = [
                    { name: `${packageName}-core`, version: '1.0.0', downloads: 1234 },
                    { name: `${packageName}-utils`, version: '0.9.0', downloads: 456 },
                    { name: `awesome-${packageName}`, version: '2.0.0', downloads: 789 }
                ];
                
                const searchHeaders = ['Name', 'Version', 'Downloads'];
                const searchRows = searchResults.map(p => [p.name, p.version, p.downloads.toString()]);
                
                return formatTable(searchHeaders, searchRows);
                
            default:
                throw new Error(`Unknown package action: ${action}. Use install, remove, list, or search`);
        }
    }, {
        description: 'Package manager for NexusShell',
        usage: 'package <install|remove|list|search> [package-name] [-f|--format json]',
        flags: {
            f: 'Output format (json)',
            format: 'Output format (json)'
        }
    });

    // Git simulation
    shell.registerCommand('git', async ({ args, flags }) => {
        const action = args[0];
        
        switch (action) {
            case 'status':
                const status = [
                    'On branch main',
                    'Your branch is up to date with \'origin/main\'.',
                    '',
                    'Changes to be committed:',
                    '  (use "git reset HEAD <file>..." to unstage)',
                    '',
                    '        modified:   src/index.js',
                    '        new file:   src/utils.js',
                    '',
                    'Changes not staged for commit:',
                    '  (use "git add <file>..." to update what will be committed)',
                    '  (use "git checkout -- <file>..." to discard changes in working directory)',
                    '',
                    '        modified:   README.md'
                ];
                
                return status.join('\n');
                
            case 'add':
                const files = args.slice(1);
                if (files.length === 0) {
                    throw new Error('No files specified');
                }
                
                return `Added ${files.length} file(s) to staging area`;
                
            case 'commit':
                const message = flags.m || flags.message || 'Default commit message';
                return `Committed changes: "${message}"`;
                
            case 'push':
                const remote = args[1] || 'origin';
                const branch = args[2] || 'main';
                
                console.log(chalk.blue(`📤 Pushing to ${remote}/${branch}`));
                await new Promise(resolve => setTimeout(resolve, 1000));
                console.log(chalk.green('✅ Push completed'));
                
                return `Pushed to ${remote}/${branch}`;
                
            case 'pull':
                const pullRemote = args[1] || 'origin';
                const pullBranch = args[2] || 'main';
                
                console.log(chalk.blue(`📥 Pulling from ${pullRemote}/${pullBranch}`));
                await new Promise(resolve => setTimeout(resolve, 1000));
                console.log(chalk.green('✅ Pull completed'));
                
                return `Pulled from ${pullRemote}/${pullBranch}`;
                
            case 'log':
                const limit = flags.n || flags.limit || 5;
                const commits = [];
                
                for (let i = 0; i < limit; i++) {
                    commits.push([
                        `commit ${generateCommitHash()}`,
                        `Author: Developer <dev@example.com>`,
                        `Date: ${new Date(Date.now() - i * 86400000).toISOString()}`,
                        '',
                        `    Feature: Added new functionality ${i + 1}`,
                        ''
                    ].join('\n'));
                }
                
                return commits.join('\n');
                
            default:
                throw new Error(`Unknown git action: ${action}`);
        }
    }, {
        description: 'Git version control simulation',
        usage: 'git <status|add|commit|push|pull|log> [args...] [-m|--message text] [-n|--limit number]',
        flags: {
            m: 'Commit message',
            message: 'Commit message',
            n: 'Limit number of log entries',
            limit: 'Limit number of log entries'
        }
    });

    // Docker simulation
    shell.registerCommand('docker', async ({ args, flags }) => {
        const action = args[0];
        
        switch (action) {
            case 'ps':
                const containers = [
                    { id: 'abc123', image: 'nginx:latest', command: 'nginx -g daemon off;', status: 'Up 2 hours', ports: '80/tcp -> 8080/tcp' },
                    { id: 'def456', image: 'postgres:13', command: 'postgres', status: 'Up 1 day', ports: '5432/tcp' },
                    { id: 'ghi789', image: 'redis:alpine', command: 'redis-server', status: 'Up 3 hours', ports: '6379/tcp' }
                ];
                
                if (flags.f === 'json' || flags.format === 'json') {
                    return JSON.stringify(containers, null, 2);
                }
                
                const headers = ['CONTAINER ID', 'IMAGE', 'COMMAND', 'STATUS', 'PORTS'];
                const rows = containers.map(c => [
                    c.id.slice(0, 12),
                    c.image,
                    c.command.slice(0, 20) + '...',
                    c.status,
                    c.ports
                ]);
                
                return formatTable(headers, rows);
                
            case 'images':
                const images = [
                    { repository: 'nginx', tag: 'latest', id: 'abc123def456', created: '2 days ago', size: '133MB' },
                    { repository: 'postgres', tag: '13', id: 'def456ghi789', created: '1 week ago', size: '314MB' },
                    { repository: 'redis', tag: 'alpine', id: 'ghi789jkl012', created: '3 days ago', size: '32MB' }
                ];
                
                if (flags.f === 'json' || flags.format === 'json') {
                    return JSON.stringify(images, null, 2);
                }
                
                const imgHeaders = ['REPOSITORY', 'TAG', 'IMAGE ID', 'CREATED', 'SIZE'];
                const imgRows = images.map(i => [i.repository, i.tag, i.id.slice(0, 12), i.created, i.size]);
                
                return formatTable(imgHeaders, imgRows);
                
            case 'build':
                const imageName = args[1] || 'my-app';
                const dockerfile = flags.f || flags.file || 'Dockerfile';
                
                console.log(chalk.blue(`🏗️  Building Docker image: ${imageName}`));
                console.log(chalk.gray(`Using Dockerfile: ${dockerfile}`));
                
                // Simulate build process
                const buildSteps = [
                    'Step 1/5 : FROM node:16-alpine',
                    'Step 2/5 : WORKDIR /app',
                    'Step 3/5 : COPY package*.json ./',
                    'Step 4/5 : RUN npm install',
                    'Step 5/5 : COPY . .'
                ];
                
                for (const step of buildSteps) {
                    console.log(chalk.gray(step));
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
                
                console.log(chalk.green(`✅ Successfully built ${imageName}`));
                
                return `Image built successfully: ${imageName}`;
                
            case 'run':
                const containerName = flags.name || 'container-' + Date.now();
                const image = args[1] || 'nginx:latest';
                const detached = flags.d || flags.detach;
                
                console.log(chalk.blue(`🚀 Running container: ${containerName}`));
                console.log(chalk.gray(`Image: ${image}`));
                console.log(chalk.gray(`Mode: ${detached ? 'detached' : 'interactive'}`));
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                console.log(chalk.green(`✅ Container started: ${containerName}`));
                
                return `Container ${containerName} started successfully`;
                
            default:
                throw new Error(`Unknown docker action: ${action}`);
        }
    }, {
        description: 'Docker container management simulation',
        usage: 'docker <ps|images|build|run> [args...] [-f|--format json] [-d|--detach] [--name name]',
        flags: {
            f: 'Output format (json)',
            format: 'Output format (json)',
            d: 'Run in detached mode',
            detach: 'Run in detached mode',
            name: 'Container name'
        }
    });

    // AI assistant simulation
    shell.registerCommand('ai', async ({ args, flags }) => {
        const prompt = args.join(' ');
        
        if (!prompt) {
            throw new Error('Prompt required');
        }
        
        console.log(chalk.blue(`🤖 AI Assistant: Processing "${prompt}"`));
        
        // Simulate AI processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Generate a response based on the prompt
        const responses = {
            'hello': 'Hello! I\'m your AI assistant. How can I help you today?',
            'help': 'I can help you with various tasks like explaining commands, suggesting solutions, or generating code.',
            'commands': 'Here are some useful commands: ls, cd, ps, curl, git, docker, package',
            'optimize': 'To optimize your shell performance, consider using aliases, caching frequently used commands, and monitoring with the "perf" command.',
            'security': 'For security, use the built-in permission system, avoid running untrusted scripts, and regularly update your packages.'
        };
        
        const lowerPrompt = prompt.toLowerCase();
        const response = Object.entries(responses).find(([key]) => 
            lowerPrompt.includes(key)
        )?.[1] || 'I understand you\'re asking about "' + prompt + '". Let me help you with that. Based on my analysis, I recommend checking the documentation or using the help command for more specific guidance.';
        
        console.log(chalk.green('🤖 AI Response:'));
        return response;
    }, {
        description: 'AI assistant for shell commands and tasks',
        usage: 'ai <prompt>'
    });

    // Code analyzer
    shell.registerCommand('analyze', async ({ args, flags }) => {
        const filePath = args[0];
        
        if (!filePath) {
            throw new Error('File path required');
        }
        
        try {
            const fs = await import('fs/promises');
            const content = await fs.readFile(filePath, 'utf8');
            
            // Simple code analysis
            const analysis = {
                file: filePath,
                lines: content.split('\n').length,
                characters: content.length,
                functions: (content.match(/function\s+\w+/g) || []).length,
                classes: (content.match(/class\s+\w+/g) || []).length,
                imports: (content.match(/import\s+.*from/g) || []).length,
                exports: (content.match(/export\s+/g) || []).length,
                comments: (content.match(/\/\/.*$/gm) || []).length + (content.match(/\/\*[\s\S]*?\*\//g) || []).length,
                complexity: calculateComplexity(content)
            };
            
            if (flags.f === 'json' || flags.format === 'json') {
                return JSON.stringify(analysis, null, 2);
            }
            
            const report = [
                chalk.blue(`📊 Code Analysis: ${filePath}`),
                chalk.gray('=' .repeat(40)),
                `Lines of code: ${analysis.lines}`,
                `Characters: ${analysis.characters}`,
                `Functions: ${analysis.functions}`,
                `Classes: ${analysis.classes}`,
                `Imports: ${analysis.imports}`,
                `Exports: ${analysis.exports}`,
                `Comments: ${analysis.comments}`,
                `Complexity score: ${analysis.complexity}/10`
            ];
            
            return report.join('\n');
            
        } catch (error) {
            throw new Error(`Cannot analyze file: ${error.message}`);
        }
    }, {
        description: 'Analyze code files for metrics and quality',
        usage: 'analyze <file> [-f|--format json]',
        flags: {
            f: 'Output format (json)',
            format: 'Output format (json)'
        }
    });

    // Test runner simulation
    shell.registerCommand('test', async ({ args, flags }) => {
        const testFile = args[0];
        const watch = flags.w || flags.watch;
        const coverage = flags.c || flags.coverage;
        
        console.log(chalk.blue('🧪 Running tests...'));
        
        // Simulate test execution
        const tests = [
            { name: 'should parse commands correctly', status: 'pass', duration: 23 },
            { name: 'should handle errors gracefully', status: 'pass', duration: 15 },
            { name: 'should validate permissions', status: 'pass', duration: 31 },
            { name: 'should process pipelines', status: 'fail', duration: 45, error: 'Expected 2 but got 3' },
            { name: 'should format output', status: 'pass', duration: 12 }
        ];
        
        for (const test of tests) {
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const icon = test.status === 'pass' ? '✅' : '❌';
            const color = test.status === 'pass' ? chalk.green : chalk.red;
            
            console.log(color(`${icon} ${test.name} (${test.duration}ms)`));
            
            if (test.error) {
                console.log(chalk.red(`   Error: ${test.error}`));
            }
        }
        
        const passed = tests.filter(t => t.status === 'pass').length;
        const failed = tests.filter(t => t.status === 'fail').length;
        const total = tests.length;
        
        console.log();
        console.log(chalk.blue('📊 Test Results:'));
        console.log(`${chalk.green('Passed:')} ${passed}`);
        console.log(`${chalk.red('Failed:')} ${failed}`);
        console.log(`${chalk.blue('Total:')} ${total}`);
        
        if (coverage) {
            console.log(`${chalk.yellow('Coverage:')} 85.7%`);
        }
        
        return `Tests completed: ${passed}/${total} passed`;
    }, {
        description: 'Run tests for the current project',
        usage: 'test [file] [-w|--watch] [-c|--coverage]',
        flags: {
            w: 'Watch for changes',
            watch: 'Watch for changes',
            c: 'Show coverage report',
            coverage: 'Show coverage report'
        }
    });
}

/**
 * Format data as table
 */
function formatTable(headers, rows) {
    const colWidths = headers.map((header, i) => 
        Math.max(header.length, ...rows.map(row => row[i].length))
    );
    
    const formatRow = (row) => 
        row.map((cell, i) => cell.padEnd(colWidths[i])).join(' | ');
    
    const separator = colWidths.map(w => '-'.repeat(w)).join('-+-');
    
    return [
        formatRow(headers),
        separator,
        ...rows.map(formatRow)
    ].join('\n');
}

/**
 * Generate a random commit hash
 */
function generateCommitHash() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Calculate code complexity score
 */
function calculateComplexity(code) {
    let score = 0;
    
    // Count control structures
    score += (code.match(/if\s*\(/g) || []).length * 1;
    score += (code.match(/for\s*\(/g) || []).length * 2;
    score += (code.match(/while\s*\(/g) || []).length * 2;
    score += (code.match(/switch\s*\(/g) || []).length * 2;
    score += (code.match(/catch\s*\(/g) || []).length * 1;
    
    // Count nested levels
    const braceDepth = code.split('').reduce((depth, char) => {
        if (char === '{') return depth + 1;
        if (char === '}') return depth - 1;
        return depth;
    }, 0);
    
    score += Math.abs(braceDepth);
    
    // Normalize to 0-10 scale
    return Math.min(10, Math.max(0, Math.round(score / 10)));
}