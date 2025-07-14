import { EventEmitter } from 'events';
import chalk from 'chalk';

/**
 * Security Context - Manages permissions and capability-based security
 */
export class SecurityContext extends EventEmitter {
    constructor(shell) {
        super();
        this.shell = shell;
        this.permissions = new Map();
        this.capabilities = new Set();
        this.securityPolicies = new Map();
        this.auditLog = [];
    }

    /**
     * Initialize security context
     */
    async initialize() {
        // Set default permissions
        this.setDefaultPermissions();
        
        // Load security policies
        await this.loadSecurityPolicies();
        
        console.log(chalk.green('🔒 Security context initialized'));
    }

    /**
     * Check permission for a resource
     */
    async checkPermission(permission, context = {}) {
        const hasPermission = this.hasPermission(permission);
        
        // Log access attempt
        this.auditLog.push({
            timestamp: Date.now(),
            permission,
            context,
            granted: hasPermission,
            source: context.source || 'unknown'
        });

        if (!hasPermission) {
            console.log(chalk.red(`🚫 Permission denied: ${permission}`));
            this.emit('permissionDenied', { permission, context });
        }

        return hasPermission;
    }

    /**
     * Check if permission exists
     */
    hasPermission(permission) {
        // Check exact permission
        if (this.permissions.has(permission)) {
            return this.permissions.get(permission);
        }

        // Check wildcard permissions
        for (const [perm, granted] of this.permissions) {
            if (perm.includes('*')) {
                const regex = new RegExp(perm.replace('*', '.*'));
                if (regex.test(permission)) {
                    return granted;
                }
            }
        }

        return false;
    }

    /**
     * Grant permission
     */
    grantPermission(permission, context = {}) {
        this.permissions.set(permission, true);
        this.emit('permissionGranted', { permission, context });
        
        console.log(chalk.green(`✅ Permission granted: ${permission}`));
    }

    /**
     * Revoke permission
     */
    revokePermission(permission, context = {}) {
        this.permissions.set(permission, false);
        this.emit('permissionRevoked', { permission, context });
        
        console.log(chalk.yellow(`⚠️  Permission revoked: ${permission}`));
    }

    /**
     * Add capability
     */
    addCapability(capability) {
        this.capabilities.add(capability);
        console.log(chalk.blue(`🎯 Capability added: ${capability}`));
    }

    /**
     * Remove capability
     */
    removeCapability(capability) {
        this.capabilities.delete(capability);
        console.log(chalk.yellow(`🎯 Capability removed: ${capability}`));
    }

    /**
     * Check if capability exists
     */
    hasCapability(capability) {
        return this.capabilities.has(capability);
    }

    /**
     * Set default permissions
     */
    setDefaultPermissions() {
        // Basic shell operations
        this.grantPermission('command:execute');
        this.grantPermission('command:help');
        this.grantPermission('command:exit');
        this.grantPermission('command:history');
        this.grantPermission('command:alias');
        
        // File system (restricted)
        this.grantPermission('fs:read:' + process.cwd() + '/*');
        this.grantPermission('fs:write:' + process.cwd() + '/*');
        
        // Network (restricted)
        this.grantPermission('net:connect:localhost:*');
        
        // Process management (restricted)
        this.grantPermission('proc:list');
        this.grantPermission('proc:info');
        
        // Add basic capabilities
        this.addCapability('shell:basic');
        this.addCapability('fs:user-directory');
        this.addCapability('net:local');
    }

    /**
     * Load security policies
     */
    async loadSecurityPolicies() {
        // Example security policies
        this.securityPolicies.set('sandbox', {
            name: 'Sandbox Policy',
            description: 'Restricts commands to safe operations',
            rules: [
                { type: 'deny', resource: 'fs:write:/etc/*' },
                { type: 'deny', resource: 'fs:write:/usr/*' },
                { type: 'deny', resource: 'proc:kill:*' },
                { type: 'allow', resource: 'fs:read:*' }
            ]
        });

        this.securityPolicies.set('developer', {
            name: 'Developer Policy',
            description: 'Allows most operations for development',
            rules: [
                { type: 'allow', resource: 'fs:*' },
                { type: 'allow', resource: 'proc:*' },
                { type: 'allow', resource: 'net:*' },
                { type: 'deny', resource: 'fs:write:/etc/passwd' }
            ]
        });
    }

    /**
     * Apply security policy
     */
    applyPolicy(policyName) {
        const policy = this.securityPolicies.get(policyName);
        if (!policy) {
            throw new Error(`Security policy '${policyName}' not found`);
        }

        console.log(chalk.blue(`🛡️  Applying security policy: ${policy.name}`));

        for (const rule of policy.rules) {
            if (rule.type === 'allow') {
                this.grantPermission(rule.resource);
            } else if (rule.type === 'deny') {
                this.revokePermission(rule.resource);
            }
        }
    }

    /**
     * Create sandbox context
     */
    createSandbox(permissions = []) {
        return {
            permissions: new Set(permissions),
            checkPermission: (permission) => {
                return permissions.includes(permission) || 
                       permissions.some(p => p.includes('*') && new RegExp(p.replace('*', '.*')).test(permission));
            }
        };
    }

    /**
     * Get audit log
     */
    getAuditLog() {
        return this.auditLog;
    }

    /**
     * Clear audit log
     */
    clearAuditLog() {
        this.auditLog = [];
    }

    /**
     * Export security configuration
     */
    exportConfig() {
        return {
            permissions: Array.from(this.permissions.entries()),
            capabilities: Array.from(this.capabilities),
            policies: Array.from(this.securityPolicies.entries())
        };
    }

    /**
     * Import security configuration
     */
    importConfig(config) {
        this.permissions = new Map(config.permissions);
        this.capabilities = new Set(config.capabilities);
        this.securityPolicies = new Map(config.policies);
    }
}