#pragma once

#include <cstddef>
#include <memory>
#include <atomic>
#include <mutex>
#include <unordered_map>

namespace Nexus {

/**
 * MemoryManager - High-performance memory management with bounds checking
 */
class MemoryManager {
public:
    explicit MemoryManager(size_t max_memory_bytes);
    ~MemoryManager();

    // Memory allocation
    void* allocate(size_t size, size_t alignment = alignof(std::max_align_t));
    void deallocate(void* ptr);
    
    // Memory pools for common sizes
    void* allocate_small(size_t size);  // < 256 bytes
    void* allocate_medium(size_t size); // 256 bytes - 4KB
    void* allocate_large(size_t size);  // > 4KB
    
    // Memory statistics
    size_t get_total_memory() const { return max_memory_; }
    size_t get_used_memory() const { return used_memory_.load(); }
    size_t get_free_memory() const { return max_memory_ - used_memory_.load(); }
    size_t get_allocation_count() const { return allocation_count_.load(); }
    
    // Memory management
    void garbage_collect();
    void defragment();
    bool is_memory_available(size_t size) const;
    
    // Debugging and monitoring
    void dump_memory_stats() const;
    std::vector<std::pair<void*, size_t>> get_allocations() const;

private:
    const size_t max_memory_;
    std::atomic<size_t> used_memory_{0};
    std::atomic<size_t> allocation_count_{0};
    
    // Allocation tracking
    mutable std::mutex allocations_mutex_;
    std::unordered_map<void*, size_t> allocations_;
    
    // Memory pools
    struct MemoryPool {
        void* memory;
        size_t size;
        size_t used;
        std::vector<void*> free_blocks;
    };
    
    std::unique_ptr<MemoryPool> small_pool_;
    std::unique_ptr<MemoryPool> medium_pool_;
    std::unique_ptr<MemoryPool> large_pool_;
    
    // Internal methods
    void initialize_pools();
    void cleanup_pools();
    MemoryPool* get_appropriate_pool(size_t size);
    void* allocate_from_pool(MemoryPool* pool, size_t size);
    void deallocate_to_pool(MemoryPool* pool, void* ptr);
};

} // namespace Nexus