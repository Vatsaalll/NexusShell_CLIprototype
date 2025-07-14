import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';

/**
 * Register file system commands
 */
export async function registerFileCommands(shell) {
    
    // List directory contents
    shell.registerCommand('ls', async ({ args, flags }) => {
        const targetPath = args[0] || '.';
        const showHidden = flags.a || flags.all;
        const longFormat = flags.l || flags.long;
        const humanReadable = flags.h || flags.human;
        
        try {
            const entries = await fs.readdir(targetPath, { withFileTypes: true });
            const filtered = showHidden ? entries : entries.filter(e => !e.name.startsWith('.'));
            
            if (longFormat) {
                const results = [];
                for (const entry of filtered) {
                    const fullPath = path.join(targetPath, entry.name);
                    const stats = await fs.stat(fullPath);
                    
                    const size = humanReadable ? formatBytes(stats.size) : stats.size;
                    const type = entry.isDirectory() ? 'd' : '-';
                    const date = stats.mtime.toLocaleDateString();
                    
                    results.push(`${type} ${size.toString().padStart(8)} ${date} ${entry.name}`);
                }
                return results.join('\n');
            } else {
                const files = filtered.map(e => e.isDirectory() ? chalk.blue(e.name) : e.name);
                return files.join('  ');
            }
        } catch (error) {
            throw new Error(`Cannot list directory: ${error.message}`);
        }
    }, {
        description: 'List directory contents',
        usage: 'ls [path] [-a|--all] [-l|--long] [-h|--human]',
        flags: {
            a: 'Show hidden files',
            all: 'Show hidden files',
            l: 'Long format',
            long: 'Long format',
            h: 'Human readable sizes',
            human: 'Human readable sizes'
        }
    });

    // Change directory
    shell.registerCommand('cd', async ({ args, shell }) => {
        const targetPath = args[0] || process.env.HOME || process.cwd();
        
        try {
            const resolvedPath = path.resolve(shell.currentDirectory, targetPath);
            const stats = await fs.stat(resolvedPath);
            
            if (!stats.isDirectory()) {
                throw new Error(`Not a directory: ${targetPath}`);
            }
            
            shell.currentDirectory = resolvedPath;
            process.chdir(resolvedPath);
            
            return `Changed directory to: ${resolvedPath}`;
        } catch (error) {
            throw new Error(`Cannot change directory: ${error.message}`);
        }
    }, {
        description: 'Change current directory',
        usage: 'cd [path]'
    });

    // Print working directory
    shell.registerCommand('pwd', async ({ shell }) => {
        return shell.currentDirectory;
    }, {
        description: 'Print working directory',
        usage: 'pwd'
    });

    // Create directory
    shell.registerCommand('mkdir', async ({ args, flags }) => {
        const dirPath = args[0];
        if (!dirPath) {
            throw new Error('Directory path required');
        }
        
        const recursive = flags.p || flags.parents;
        
        try {
            await fs.mkdir(dirPath, { recursive });
            return `Directory created: ${dirPath}`;
        } catch (error) {
            throw new Error(`Cannot create directory: ${error.message}`);
        }
    }, {
        description: 'Create directory',
        usage: 'mkdir <path> [-p|--parents]',
        flags: {
            p: 'Create parent directories',
            parents: 'Create parent directories'
        }
    });

    // Remove files/directories
    shell.registerCommand('rm', async ({ args, flags }) => {
        if (args.length === 0) {
            throw new Error('No files specified');
        }
        
        const recursive = flags.r || flags.recursive;
        const force = flags.f || flags.force;
        const results = [];
        
        for (const filePath of args) {
            try {
                const stats = await fs.stat(filePath);
                
                if (stats.isDirectory() && !recursive) {
                    throw new Error(`Cannot remove directory without -r flag: ${filePath}`);
                }
                
                if (stats.isDirectory()) {
                    await fs.rmdir(filePath, { recursive: true });
                } else {
                    await fs.unlink(filePath);
                }
                
                results.push(`Removed: ${filePath}`);
            } catch (error) {
                if (!force) {
                    throw new Error(`Cannot remove ${filePath}: ${error.message}`);
                }
                results.push(`Failed to remove: ${filePath}`);
            }
        }
        
        return results.join('\n');
    }, {
        description: 'Remove files and directories',
        usage: 'rm <files...> [-r|--recursive] [-f|--force]',
        flags: {
            r: 'Remove directories recursively',
            recursive: 'Remove directories recursively',
            f: 'Force removal, ignore errors',
            force: 'Force removal, ignore errors'
        }
    });

    // Copy files
    shell.registerCommand('cp', async ({ args, flags }) => {
        if (args.length < 2) {
            throw new Error('Source and destination required');
        }
        
        const source = args[0];
        const destination = args[1];
        const recursive = flags.r || flags.recursive;
        
        try {
            const sourceStats = await fs.stat(source);
            
            if (sourceStats.isDirectory() && !recursive) {
                throw new Error('Cannot copy directory without -r flag');
            }
            
            if (sourceStats.isDirectory()) {
                await copyDirectory(source, destination);
            } else {
                await fs.copyFile(source, destination);
            }
            
            return `Copied ${source} to ${destination}`;
        } catch (error) {
            throw new Error(`Cannot copy: ${error.message}`);
        }
    }, {
        description: 'Copy files and directories',
        usage: 'cp <source> <destination> [-r|--recursive]',
        flags: {
            r: 'Copy directories recursively',
            recursive: 'Copy directories recursively'
        }
    });

    // Move/rename files
    shell.registerCommand('mv', async ({ args }) => {
        if (args.length < 2) {
            throw new Error('Source and destination required');
        }
        
        const source = args[0];
        const destination = args[1];
        
        try {
            await fs.rename(source, destination);
            return `Moved ${source} to ${destination}`;
        } catch (error) {
            throw new Error(`Cannot move: ${error.message}`);
        }
    }, {
        description: 'Move/rename files and directories',
        usage: 'mv <source> <destination>'
    });

    // Display file contents
    shell.registerCommand('cat', async ({ args }) => {
        if (args.length === 0) {
            throw new Error('No files specified');
        }
        
        const results = [];
        
        for (const filePath of args) {
            try {
                const content = await fs.readFile(filePath, 'utf8');
                results.push(content);
            } catch (error) {
                throw new Error(`Cannot read ${filePath}: ${error.message}`);
            }
        }
        
        return results.join('\n');
    }, {
        description: 'Display file contents',
        usage: 'cat <files...>'
    });

    // Create/update file
    shell.registerCommand('touch', async ({ args }) => {
        if (args.length === 0) {
            throw new Error('No files specified');
        }
        
        const results = [];
        
        for (const filePath of args) {
            try {
                const now = new Date();
                
                try {
                    await fs.access(filePath);
                    await fs.utimes(filePath, now, now);
                    results.push(`Updated timestamp: ${filePath}`);
                } catch {
                    await fs.writeFile(filePath, '');
                    results.push(`Created file: ${filePath}`);
                }
            } catch (error) {
                throw new Error(`Cannot touch ${filePath}: ${error.message}`);
            }
        }
        
        return results.join('\n');
    }, {
        description: 'Create empty file or update timestamp',
        usage: 'touch <files...>'
    });

    // Find files
    shell.registerCommand('find', async ({ args, flags }) => {
        const searchPath = args[0] || '.';
        const name = flags.name;
        const type = flags.type;
        const size = flags.size;
        
        try {
            const results = [];
            await findFiles(searchPath, (filePath, stats) => {
                let matches = true;
                
                if (name && !path.basename(filePath).includes(name)) {
                    matches = false;
                }
                
                if (type) {
                    if (type === 'f' && !stats.isFile()) matches = false;
                    if (type === 'd' && !stats.isDirectory()) matches = false;
                }
                
                if (size) {
                    const sizeBytes = parseSize(size);
                    if (stats.size < sizeBytes) matches = false;
                }
                
                if (matches) {
                    results.push(filePath);
                }
            });
            
            return results.join('\n');
        } catch (error) {
            throw new Error(`Find failed: ${error.message}`);
        }
    }, {
        description: 'Find files and directories',
        usage: 'find [path] [--name pattern] [--type f|d] [--size +1M]',
        flags: {
            name: 'Search by name pattern',
            type: 'Filter by type (f=file, d=directory)',
            size: 'Filter by size (+1M, -1K, etc.)'
        }
    });

    // File/directory information
    shell.registerCommand('stat', async ({ args }) => {
        if (args.length === 0) {
            throw new Error('No files specified');
        }
        
        const results = [];
        
        for (const filePath of args) {
            try {
                const stats = await fs.stat(filePath);
                const info = [
                    `File: ${filePath}`,
                    `Size: ${formatBytes(stats.size)}`,
                    `Type: ${stats.isDirectory() ? 'directory' : 'file'}`,
                    `Modified: ${stats.mtime.toISOString()}`,
                    `Created: ${stats.birthtime.toISOString()}`,
                    `Mode: ${stats.mode.toString(8)}`
                ];
                results.push(info.join('\n'));
            } catch (error) {
                throw new Error(`Cannot stat ${filePath}: ${error.message}`);
            }
        }
        
        return results.join('\n\n');
    }, {
        description: 'Display file/directory information',
        usage: 'stat <files...>'
    });
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Copy directory recursively
 */
async function copyDirectory(source, destination) {
    await fs.mkdir(destination, { recursive: true });
    const entries = await fs.readdir(source, { withFileTypes: true });
    
    for (const entry of entries) {
        const sourcePath = path.join(source, entry.name);
        const destPath = path.join(destination, entry.name);
        
        if (entry.isDirectory()) {
            await copyDirectory(sourcePath, destPath);
        } else {
            await fs.copyFile(sourcePath, destPath);
        }
    }
}

/**
 * Find files recursively
 */
async function findFiles(searchPath, callback) {
    const entries = await fs.readdir(searchPath, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(searchPath, entry.name);
        const stats = await fs.stat(fullPath);
        
        await callback(fullPath, stats);
        
        if (entry.isDirectory()) {
            await findFiles(fullPath, callback);
        }
    }
}

/**
 * Parse size string to bytes
 */
function parseSize(sizeStr) {
    const match = sizeStr.match(/^([+-]?)(\d+)([KMGT]?)$/i);
    if (!match) return 0;
    
    const [, sign, num, unit] = match;
    const multipliers = { K: 1024, M: 1024**2, G: 1024**3, T: 1024**4 };
    const bytes = parseInt(num) * (multipliers[unit.toUpperCase()] || 1);
    
    return bytes;
}