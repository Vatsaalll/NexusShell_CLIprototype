#pragma once

#include <cstdint>
#include <memory>
#include <string>
#include <vector>
#include <variant>
#include <functional>

namespace Nexus {

// Forward declarations
class NexusKernel;
class ObjectBridge;
class SecurityContext;

// Core types
using ObjectId = uint64_t;
using ThreadId = uint32_t;
using ProcessId = uint32_t;

// Nexus object variant type
using NexusValue = std::variant<
    std::nullptr_t,
    bool,
    int64_t,
    double,
    std::string,
    std::vector<uint8_t>  // Binary data
>;

// Object metadata
struct ObjectMetadata {
    ObjectId id;
    std::string type;
    size_t size;
    uint64_t created_at;
    uint64_t modified_at;
    std::string permissions;
};

// Nexus object wrapper
struct NexusObject {
    ObjectMetadata metadata;
    NexusValue value;
    std::shared_ptr<void> native_handle;  // For C++ objects
    
    template<typename T>
    T* as() const {
        return static_cast<T*>(native_handle.get());
    }
};

// Command context
struct CommandContext {
    std::vector<std::string> args;
    std::unordered_map<std::string, std::string> flags;
    std::string working_directory;
    std::unordered_map<std::string, std::string> environment;
    SecurityContext* security_context;
    ObjectBridge* object_bridge;
};

// Command handler function type
using CommandHandler = std::function<NexusObject(const CommandContext&)>;

// Error types
enum class NexusErrorCode {
    SUCCESS = 0,
    INVALID_ARGUMENT,
    PERMISSION_DENIED,
    FILE_NOT_FOUND,
    MEMORY_ERROR,
    EXECUTION_ERROR,
    SECURITY_VIOLATION,
    TIMEOUT_ERROR
};

struct NexusError {
    NexusErrorCode code;
    std::string message;
    std::string stack_trace;
};

// Performance metrics
struct PerformanceMetrics {
    uint64_t commands_executed;
    uint64_t total_execution_time_us;
    uint64_t memory_usage_bytes;
    uint64_t cache_hits;
    uint64_t cache_misses;
    double cpu_usage_percent;
};

// Security capability
struct Capability {
    std::string name;
    std::string resource_pattern;
    std::vector<std::string> permissions;
    uint64_t expires_at;
};

// Transaction state
struct TransactionState {
    ObjectId transaction_id;
    std::vector<std::string> commands;
    std::vector<NexusObject> snapshots;
    std::function<void()> rollback_handler;
};

} // namespace Nexus