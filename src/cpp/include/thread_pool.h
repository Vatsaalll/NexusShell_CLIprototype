#pragma once

#include <vector>
#include <queue>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <future>
#include <functional>
#include <atomic>

namespace Nexus {

/**
 * ThreadPool - High-performance thread pool for concurrent execution
 */
class ThreadPool {
public:
    explicit ThreadPool(size_t num_threads = std::thread::hardware_concurrency());
    ~ThreadPool();

    // Submit a task and get a future
    template<typename F, typename... Args>
    auto submit(F&& f, Args&&... args) -> std::future<typename std::result_of<F(Args...)>::type>;

    // Get thread pool statistics
    size_t get_thread_count() const { return threads_.size(); }
    size_t get_queue_size() const;
    size_t get_active_tasks() const { return active_tasks_.load(); }

    // Thread pool management
    void resize(size_t new_size);
    void shutdown();
    bool is_shutdown() const { return shutdown_.load(); }

private:
    std::vector<std::thread> threads_;
    std::queue<std::function<void()>> tasks_;
    
    mutable std::mutex queue_mutex_;
    std::condition_variable condition_;
    std::atomic<bool> shutdown_{false};
    std::atomic<size_t> active_tasks_{0};

    void worker_thread();
};

template<typename F, typename... Args>
auto ThreadPool::submit(F&& f, Args&&... args) -> std::future<typename std::result_of<F(Args...)>::type> {
    using return_type = typename std::result_of<F(Args...)>::type;

    auto task = std::make_shared<std::packaged_task<return_type()>>(
        std::bind(std::forward<F>(f), std::forward<Args>(args)...)
    );

    std::future<return_type> result = task->get_future();

    {
        std::unique_lock<std::mutex> lock(queue_mutex_);
        
        if (shutdown_.load()) {
            throw std::runtime_error("Cannot submit task to shutdown thread pool");
        }

        tasks_.emplace([task]() {
            (*task)();
        });
    }

    condition_.notify_one();
    return result;
}

} // namespace Nexus