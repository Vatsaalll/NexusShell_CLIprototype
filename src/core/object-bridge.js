import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import path from 'path';
import chalk from 'chalk';

/**
 * Object Bridge - Provides JavaScript APIs for system operations
 */
export class ObjectBridge extends EventEmitter {
    constructor(shell) {
        super();
        this.shell = shell;
        this.typeConverters = new Map();
        this.objectCache = new Map();
        this.apiCache = new Map();
    }

    /**
     * Initialize object bridge
     */
    async initialize() {
        this.setupTypeConverters();
        await this.initializeAPIs();
        
        console.log(chalk.green('🌉 Object bridge initialized'));
    }

    /**
     * Setup type converters
     */
    setupTypeConverters() {
        // String converter
        this.typeConverters.set('string', {
            toJS: (value) => String(value),
            fromJS: (value) => String(value)
        });

        // Number converter
        this.typeConverters.set('number', {
            toJS: (value) => Number(value),
            fromJS: (value) => Number(value)
        });

        // Boolean converter
        this.typeConverters.set('boolean', {
            toJS: (value) => Boolean(value),
            fromJS: (value) => Boolean(value)
        });

        // Array converter
        this.typeConverters.set('array', {
            toJS: (value) => Array.isArray(value) ? value : [value],
            fromJS: (value) => Array.isArray(value) ? value : [value]
        });

        // Object converter
        this.typeConverters.set('object', {
            toJS: (value) => typeof value === 'object' ? value : { value },
            fromJS: (value) => typeof value === 'object' ? value : { value }
        });
    }

    /**
     * Initialize APIs
     */
    async initializeAPIs() {
        // Cache APIs for performance
        this.apiCache.set('fs', this.createFileSystemAPI());
        this.apiCache.set('proc', this.createProcessAPI());
        this.apiCache.set('net', this.createNetworkAPI());
        this.apiCache.set('utils', this.createUtilsAPI());
    }

    /**
     * Get File System API
     */
    getFileSystemAPI() {
        if (!this.apiCache.has('fs')) {
            this.apiCache.set('fs', this.createFileSystemAPI());
        }
        return this.apiCache.get('fs');
    }

    /**
     * Create File System API
     */
    createFileSystemAPI() {
        return {
            // Directory operations
            dir: (path = '.') => new DirectoryObject(path, this.shell),
            
            // File operations
            file: (path) => new FileObject(path, this.shell),
            
            // Read file
            readFile: async (filePath, options = {}) => {
                await this.shell.securityContext.checkPermission(`fs:read:${filePath}`);
                const content = await fs.readFile(filePath, options.encoding || 'utf8');
                return new FileContent(content, filePath);
            },
            
            // Write file
            writeFile: async (filePath, content, options = {}) => {
                await this.shell.securityContext.checkPermission(`fs:write:${filePath}`);
                await fs.writeFile(filePath, content, options);
                return new FileObject(filePath, this.shell);
            },
            
            // List directory
            listDir: async (dirPath = '.') => {
                await this.shell.securityContext.checkPermission(`fs:read:${dirPath}`);
                const entries = await fs.readdir(dirPath, { withFileTypes: true });
                return entries.map(entry => ({
                    name: entry.name,
                    isFile: entry.isFile(),
                    isDirectory: entry.isDirectory(),
                    path: path.join(dirPath, entry.name)
                }));
            },
            
            // File stats
            stat: async (filePath) => {
                await this.shell.securityContext.checkPermission(`fs:read:${filePath}`);
                const stats = await fs.stat(filePath);
                return {
                    size: stats.size,
                    isFile: stats.isFile(),
                    isDirectory: stats.isDirectory(),
                    modified: stats.mtime,
                    created: stats.birthtime
                };
            },
            
            // Watch file/directory
            watch: (filePath, callback) => {
                const watcher = fs.watch(filePath, (eventType, filename) => {
                    callback({ eventType, filename, path: filePath });
                });
                return { stop: () => watcher.close() };
            }
        };
    }

    /**
     * Get Process API
     */
    getProcessAPI() {
        if (!this.apiCache.has('proc')) {
            this.apiCache.set('proc', this.createProcessAPI());
        }
        return this.apiCache.get('proc');
    }

    /**
     * Create Process API
     */
    createProcessAPI() {
        return {
            // Execute command
            exec: async (command, options = {}) => {
                await this.shell.securityContext.checkPermission('proc:exec');
                
                return new Promise((resolve, reject) => {
                    const child = spawn(command, options.args || [], {
                        stdio: 'pipe',
                        cwd: options.cwd || this.shell.currentDirectory,
                        env: { ...this.shell.environment, ...options.env }
                    });

                    let stdout = '';
                    let stderr = '';

                    child.stdout.on('data', (data) => {
                        stdout += data.toString();
                    });

                    child.stderr.on('data', (data) => {
                        stderr += data.toString();
                    });

                    child.on('close', (code) => {
                        resolve(new ProcessResult(code, stdout, stderr, command));
                    });

                    child.on('error', reject);
                });
            },
            
            // List processes
            list: async () => {
                await this.shell.securityContext.checkPermission('proc:list');
                
                // Simulate process listing (in real implementation, this would use system APIs)
                return [
                    { pid: process.pid, name: 'nexus-shell', cpu: 0.5, memory: 25 },
                    { pid: 1234, name: 'example-app', cpu: 1.2, memory: 50 }
                ];
            },
            
            // Get process info
            info: async (pid) => {
                await this.shell.securityContext.checkPermission('proc:info');
                
                if (pid === process.pid) {
                    return {
                        pid: process.pid,
                        name: 'nexus-shell',
                        uptime: process.uptime(),
                        memory: process.memoryUsage(),
                        cpu: process.cpuUsage()
                    };
                }
                
                return null;
            },
            
            // Kill process
            kill: async (pid, signal = 'SIGTERM') => {
                await this.shell.securityContext.checkPermission(`proc:kill:${pid}`);
                process.kill(pid, signal);
            }
        };
    }

    /**
     * Get Network API
     */
    getNetworkAPI() {
        if (!this.apiCache.has('net')) {
            this.apiCache.set('net', this.createNetworkAPI());
        }
        return this.apiCache.get('net');
    }

    /**
     * Create Network API
     */
    createNetworkAPI() {
        return {
            // HTTP GET
            get: async (url, options = {}) => {
                await this.shell.securityContext.checkPermission(`net:http:${url}`);
                
                const response = await fetch(url, {
                    method: 'GET',
                    headers: options.headers || {},
                    ...options
                });
                
                return new HttpResponse(response);
            },
            
            // HTTP POST
            post: async (url, data, options = {}) => {
                await this.shell.securityContext.checkPermission(`net:http:${url}`);
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...options.headers },
                    body: JSON.stringify(data),
                    ...options
                });
                
                return new HttpResponse(response);
            },
            
            // Download file
            download: async (url, filePath, options = {}) => {
                await this.shell.securityContext.checkPermission(`net:download:${url}`);
                await this.shell.securityContext.checkPermission(`fs:write:${filePath}`);
                
                const response = await fetch(url);
                const buffer = await response.arrayBuffer();
                await fs.writeFile(filePath, Buffer.from(buffer));
                
                return new FileObject(filePath, this.shell);
            }
        };
    }

    /**
     * Get Utils API
     */
    getUtilsAPI() {
        if (!this.apiCache.has('utils')) {
            this.apiCache.set('utils', this.createUtilsAPI());
        }
        return this.apiCache.get('utils');
    }

    /**
     * Create Utils API
     */
    createUtilsAPI() {
        return {
            // Format data
            format: {
                json: (data) => JSON.stringify(data, null, 2),
                csv: (data) => {
                    if (!Array.isArray(data)) return '';
                    const headers = Object.keys(data[0] || {});
                    const rows = data.map(row => headers.map(h => row[h]).join(','));
                    return [headers.join(','), ...rows].join('\n');
                },
                table: (data) => {
                    if (!Array.isArray(data)) return String(data);
                    return data.map(row => Object.values(row).join('\t')).join('\n');
                },
                humanSize: (bytes) => {
                    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                    if (bytes === 0) return '0 B';
                    const i = Math.floor(Math.log(bytes) / Math.log(1024));
                    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
                }
            },
            
            // Utilities
            sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
            
            uuid: () => {
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                    const r = Math.random() * 16 | 0;
                    const v = c === 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            },
            
            hash: async (data) => {
                const crypto = await import('crypto');
                return crypto.createHash('sha256').update(data).digest('hex');
            },
            
            timestamp: () => Date.now(),
            
            parseArgs: (args) => {
                const parsed = { _: [] };
                for (let i = 0; i < args.length; i++) {
                    const arg = args[i];
                    if (arg.startsWith('--')) {
                        const [key, value] = arg.slice(2).split('=');
                        parsed[key] = value || true;
                    } else if (arg.startsWith('-')) {
                        parsed[arg.slice(1)] = true;
                    } else {
                        parsed._.push(arg);
                    }
                }
                return parsed;
            }
        };
    }

    /**
     * Convert type to JavaScript
     */
    toJS(value, type = 'auto') {
        if (type === 'auto') {
            type = this.detectType(value);
        }
        
        const converter = this.typeConverters.get(type);
        return converter ? converter.toJS(value) : value;
    }

    /**
     * Convert type from JavaScript
     */
    fromJS(value, type = 'auto') {
        if (type === 'auto') {
            type = this.detectType(value);
        }
        
        const converter = this.typeConverters.get(type);
        return converter ? converter.fromJS(value) : value;
    }

    /**
     * Detect value type
     */
    detectType(value) {
        if (typeof value === 'string') return 'string';
        if (typeof value === 'number') return 'number';
        if (typeof value === 'boolean') return 'boolean';
        if (Array.isArray(value)) return 'array';
        if (typeof value === 'object') return 'object';
        return 'string';
    }
}

/**
 * Directory Object
 */
class DirectoryObject {
    constructor(path, shell) {
        this.path = path;
        this.shell = shell;
    }

    async list() {
        return this.shell.objectBridge.getFileSystemAPI().listDir(this.path);
    }

    filter(predicate) {
        return new DirectoryFilter(this.path, this.shell, predicate);
    }

    find(pattern) {
        return new DirectoryFilter(this.path, this.shell, (item) => item.name.includes(pattern));
    }

    async size() {
        const items = await this.list();
        let total = 0;
        for (const item of items) {
            if (item.isFile) {
                const stats = await this.shell.objectBridge.getFileSystemAPI().stat(item.path);
                total += stats.size;
            }
        }
        return total;
    }
}

/**
 * Directory Filter
 */
class DirectoryFilter {
    constructor(path, shell, predicate) {
        this.path = path;
        this.shell = shell;
        this.predicate = predicate;
    }

    async toArray() {
        const items = await this.shell.objectBridge.getFileSystemAPI().listDir(this.path);
        return items.filter(this.predicate);
    }

    async forEach(callback) {
        const items = await this.toArray();
        items.forEach(callback);
    }

    async map(callback) {
        const items = await this.toArray();
        return items.map(callback);
    }
}

/**
 * File Object
 */
class FileObject {
    constructor(path, shell) {
        this.path = path;
        this.shell = shell;
    }

    async read(options = {}) {
        return this.shell.objectBridge.getFileSystemAPI().readFile(this.path, options);
    }

    async write(content, options = {}) {
        return this.shell.objectBridge.getFileSystemAPI().writeFile(this.path, content, options);
    }

    async stat() {
        return this.shell.objectBridge.getFileSystemAPI().stat(this.path);
    }

    watch(callback) {
        return this.shell.objectBridge.getFileSystemAPI().watch(this.path, callback);
    }
}

/**
 * File Content
 */
class FileContent {
    constructor(content, filePath) {
        this.content = content;
        this.filePath = filePath;
    }

    toString() {
        return this.content;
    }

    toJSON() {
        try {
            return JSON.parse(this.content);
        } catch (e) {
            throw new Error(`Invalid JSON in file: ${this.filePath}`);
        }
    }

    lines() {
        return this.content.split('\n');
    }

    filter(predicate) {
        return this.lines().filter(predicate);
    }

    grep(pattern) {
        const regex = new RegExp(pattern, 'i');
        return this.lines().filter(line => regex.test(line));
    }
}

/**
 * Process Result
 */
class ProcessResult {
    constructor(code, stdout, stderr, command) {
        this.code = code;
        this.stdout = stdout;
        this.stderr = stderr;
        this.command = command;
        this.success = code === 0;
    }

    toString() {
        return this.stdout;
    }

    toJSON() {
        return {
            code: this.code,
            stdout: this.stdout,
            stderr: this.stderr,
            command: this.command,
            success: this.success
        };
    }
}

/**
 * HTTP Response
 */
class HttpResponse {
    constructor(response) {
        this.response = response;
        this.status = response.status;
        this.statusText = response.statusText;
        this.headers = response.headers;
        this.ok = response.ok;
    }

    async text() {
        return await this.response.text();
    }

    async json() {
        return await this.response.json();
    }

    async blob() {
        return await this.response.blob();
    }
}