#pragma once

#include "nexus_types.h"
#include <string>
#include <vector>
#include <unordered_map>
#include <unordered_set>
#include <mutex>

namespace Nexus {

/**
 * SecurityContext - Capability-based security and permission management
 */
class SecurityContext {
public:
    SecurityContext();
    ~SecurityContext();

    bool initialize();

    // Permission checking
    bool check_permission(const std::string& permission, const std::string& resource = "");
    bool has_capability(const std::string& capability_name);
    
    // Permission management
    void grant_permission(const std::string& permission, const std::string& resource = "");
    void revoke_permission(const std::string& permission, const std::string& resource = "");
    
    // Capability management
    void add_capability(const Capability& capability);
    void remove_capability(const std::string& capability_name);
    std::vector<Capability> get_capabilities() const;
    
    // Security policies
    void apply_security_policy(const std::string& policy_name);
    void create_security_policy(const std::string& name, const std::vector<std::string>& rules);
    
    // Sandboxing
    bool create_sandbox(const std::string& sandbox_id, const std::vector<std::string>& allowed_permissions);
    bool enter_sandbox(const std::string& sandbox_id);
    bool exit_sandbox();
    std::string get_current_sandbox() const { return current_sandbox_; }
    
    // Audit logging
    void log_access_attempt(const std::string& permission, const std::string& resource, bool granted);
    std::vector<std::string> get_audit_log() const;
    void clear_audit_log();

private:
    // Permission storage
    std::unordered_set<std::string> granted_permissions_;
    std::unordered_map<std::string, std::unordered_set<std::string>> resource_permissions_;
    
    // Capabilities
    std::unordered_map<std::string, Capability> capabilities_;
    
    // Security policies
    std::unordered_map<std::string, std::vector<std::string>> security_policies_;
    
    // Sandboxing
    std::string current_sandbox_;
    std::unordered_map<std::string, std::unordered_set<std::string>> sandbox_permissions_;
    
    // Audit logging
    mutable std::mutex audit_mutex_;
    std::vector<std::string> audit_log_;
    
    // Internal methods
    bool matches_permission_pattern(const std::string& permission, const std::string& pattern);
    void setup_default_permissions();
    void setup_default_policies();
    std::string format_audit_entry(const std::string& permission, const std::string& resource, bool granted);
};

} // namespace Nexus