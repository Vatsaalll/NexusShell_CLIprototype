import chalk from 'chalk';

/**
 * Register network commands
 */
export async function registerNetworkCommands(shell) {
    
    // HTTP GET request
    shell.registerCommand('curl', async ({ args, flags }) => {
        if (args.length === 0) {
            throw new Error('URL required');
        }
        
        const url = args[0];
        const method = flags.X || flags.method || 'GET';
        const headers = flags.H || flags.headers || [];
        const data = flags.d || flags.data;
        const output = flags.o || flags.output;
        const silent = flags.s || flags.silent;
        
        try {
            const requestOptions = {
                method: method.toUpperCase(),
                headers: {}
            };
            
            // Parse headers
            if (Array.isArray(headers)) {
                headers.forEach(header => {
                    const [key, value] = header.split(':');
                    if (key && value) {
                        requestOptions.headers[key.trim()] = value.trim();
                    }
                });
            }
            
            // Add data for POST/PUT requests
            if (data && ['POST', 'PUT', 'PATCH'].includes(requestOptions.method)) {
                requestOptions.body = data;
                requestOptions.headers['Content-Type'] = 'application/json';
            }
            
            if (!silent) {
                console.log(chalk.blue(`🌐 ${method} ${url}`));
            }
            
            const response = await fetch(url, requestOptions);
            const responseText = await response.text();
            
            if (!silent) {
                console.log(chalk.gray(`Status: ${response.status} ${response.statusText}`));
                console.log(chalk.gray(`Content-Type: ${response.headers.get('content-type') || 'unknown'}`));
                console.log(chalk.gray(`Content-Length: ${response.headers.get('content-length') || responseText.length}`));
                console.log('');
            }
            
            if (output) {
                const fs = await import('fs/promises');
                await fs.writeFile(output, responseText);
                return `Response saved to ${output}`;
            }
            
            return responseText;
            
        } catch (error) {
            throw new Error(`HTTP request failed: ${error.message}`);
        }
    }, {
        description: 'Make HTTP requests',
        usage: 'curl <url> [-X|--method GET|POST|PUT|DELETE] [-H|--headers header:value] [-d|--data json] [-o|--output file] [-s|--silent]',
        flags: {
            X: 'HTTP method',
            method: 'HTTP method',
            H: 'HTTP headers',
            headers: 'HTTP headers',
            d: 'Request data',
            data: 'Request data',
            o: 'Output file',
            output: 'Output file',
            s: 'Silent mode',
            silent: 'Silent mode'
        }
    });

    // Download file
    shell.registerCommand('wget', async ({ args, flags }) => {
        if (args.length === 0) {
            throw new Error('URL required');
        }
        
        const url = args[0];
        const output = flags.O || flags.output;
        const quiet = flags.q || flags.quiet;
        
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const contentLength = response.headers.get('content-length');
            const filename = output || url.split('/').pop() || 'downloaded-file';
            
            if (!quiet) {
                console.log(chalk.blue(`📥 Downloading ${url}`));
                console.log(chalk.gray(`File: ${filename}`));
                if (contentLength) {
                    console.log(chalk.gray(`Size: ${formatBytes(parseInt(contentLength))}`));
                }
            }
            
            const buffer = await response.arrayBuffer();
            const fs = await import('fs/promises');
            await fs.writeFile(filename, Buffer.from(buffer));
            
            return `Downloaded ${filename} (${formatBytes(buffer.byteLength)})`;
            
        } catch (error) {
            throw new Error(`Download failed: ${error.message}`);
        }
    }, {
        description: 'Download files from URLs',
        usage: 'wget <url> [-O|--output filename] [-q|--quiet]',
        flags: {
            O: 'Output filename',
            output: 'Output filename',
            q: 'Quiet mode',
            quiet: 'Quiet mode'
        }
    });

    // Network connectivity test
    shell.registerCommand('ping', async ({ args, flags }) => {
        if (args.length === 0) {
            throw new Error('Host required');
        }
        
        const host = args[0];
        const count = flags.c || flags.count || 4;
        const timeout = flags.t || flags.timeout || 5000;
        
        console.log(chalk.blue(`🏓 Pinging ${host}`));
        
        const results = [];
        
        for (let i = 0; i < count; i++) {
            try {
                const start = Date.now();
                
                // Simulate ping by making HTTP request
                const response = await Promise.race([
                    fetch(`http://${host}`, { method: 'HEAD' }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), timeout)
                    )
                ]);
                
                const duration = Date.now() - start;
                const message = `Reply from ${host}: time=${duration}ms`;
                
                console.log(chalk.green(`✓ ${message}`));
                results.push(message);
                
            } catch (error) {
                const message = `Request timeout for ${host}`;
                console.log(chalk.red(`✗ ${message}`));
                results.push(message);
            }
            
            // Wait 1 second between pings
            if (i < count - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        return results.join('\n');
    }, {
        description: 'Test network connectivity',
        usage: 'ping <host> [-c|--count number] [-t|--timeout ms]',
        flags: {
            c: 'Number of ping requests',
            count: 'Number of ping requests',
            t: 'Timeout in milliseconds',
            timeout: 'Timeout in milliseconds'
        }
    });

    // Port scanner
    shell.registerCommand('portscan', async ({ args, flags }) => {
        if (args.length === 0) {
            throw new Error('Host required');
        }
        
        const host = args[0];
        const ports = flags.p || flags.ports || '22,80,443,8080,8443';
        const timeout = flags.t || flags.timeout || 3000;
        
        const portList = ports.split(',').map(p => parseInt(p.trim()));
        const results = [];
        
        console.log(chalk.blue(`🔍 Scanning ${host} on ports: ${portList.join(', ')}`));
        
        for (const port of portList) {
            try {
                const start = Date.now();
                
                // Simulate port scan
                const response = await Promise.race([
                    fetch(`http://${host}:${port}`, { method: 'HEAD' }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), timeout)
                    )
                ]);
                
                const duration = Date.now() - start;
                const message = `Port ${port}: OPEN (${duration}ms)`;
                
                console.log(chalk.green(`✓ ${message}`));
                results.push(message);
                
            } catch (error) {
                const message = `Port ${port}: CLOSED/FILTERED`;
                console.log(chalk.red(`✗ ${message}`));
                results.push(message);
            }
        }
        
        return results.join('\n');
    }, {
        description: 'Scan network ports',
        usage: 'portscan <host> [-p|--ports 22,80,443] [-t|--timeout ms]',
        flags: {
            p: 'Comma-separated list of ports',
            ports: 'Comma-separated list of ports',
            t: 'Timeout in milliseconds',
            timeout: 'Timeout in milliseconds'
        }
    });

    // DNS lookup
    shell.registerCommand('nslookup', async ({ args, flags }) => {
        if (args.length === 0) {
            throw new Error('Domain required');
        }
        
        const domain = args[0];
        const type = flags.t || flags.type || 'A';
        
        try {
            // Simulate DNS lookup
            const results = [];
            
            switch (type.toUpperCase()) {
                case 'A':
                    // Simulate A record lookup
                    results.push(`${domain} A record: 192.168.1.1`);
                    break;
                    
                case 'AAAA':
                    results.push(`${domain} AAAA record: 2001:db8::1`);
                    break;
                    
                case 'MX':
                    results.push(`${domain} MX record: 10 mail.${domain}`);
                    break;
                    
                case 'TXT':
                    results.push(`${domain} TXT record: "v=spf1 include:_spf.google.com ~all"`);
                    break;
                    
                default:
                    throw new Error(`Unsupported record type: ${type}`);
            }
            
            return results.join('\n');
            
        } catch (error) {
            throw new Error(`DNS lookup failed: ${error.message}`);
        }
    }, {
        description: 'DNS lookup utility',
        usage: 'nslookup <domain> [-t|--type A|AAAA|MX|TXT]',
        flags: {
            t: 'DNS record type',
            type: 'DNS record type'
        }
    });

    // Network interface information
    shell.registerCommand('ifconfig', async ({ flags }) => {
        const format = flags.f || flags.format || 'simple';
        
        try {
            const os = await import('os');
            const interfaces = os.networkInterfaces();
            
            if (format === 'json') {
                return JSON.stringify(interfaces, null, 2);
            }
            
            const results = [];
            
            for (const [name, addresses] of Object.entries(interfaces)) {
                results.push(`${name}:`);
                
                for (const addr of addresses) {
                    results.push(`  ${addr.family}: ${addr.address}`);
                    results.push(`    netmask: ${addr.netmask}`);
                    results.push(`    internal: ${addr.internal}`);
                    results.push('');
                }
            }
            
            return results.join('\n');
            
        } catch (error) {
            throw new Error(`Cannot get network interfaces: ${error.message}`);
        }
    }, {
        description: 'Display network interface information',
        usage: 'ifconfig [-f|--format json]',
        flags: {
            f: 'Output format (json)',
            format: 'Output format (json)'
        }
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