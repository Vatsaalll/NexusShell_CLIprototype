#pragma once

#include "nexus_kernel.h"
#include <string>
#include <vector>
#include <memory>

namespace Nexus {

/**
 * NovaTerminalUI - Advanced terminal interface with syntax highlighting
 */
class NovaTerminalUI {
public:
    explicit NovaTerminalUI(NexusKernel* kernel);
    ~NovaTerminalUI();

    bool initialize();
    void run_interactive_shell();
    void shutdown();

    // Input handling
    std::string read_line_with_completion();
    std::vector<std::string> get_completions(const std::string& partial_input, size_t cursor_pos);
    
    // Output formatting
    void print_result(const NexusObject& result);
    void print_error(const std::string& error);
    void print_prompt();
    
    // Syntax highlighting
    void highlight_syntax(const std::string& input);
    void set_color_scheme(const std::string& scheme);

private:
    NexusKernel* kernel_;
    bool running_;
    std::string current_directory_;
    std::vector<std::string> command_history_;
    size_t history_index_;
    
    // Terminal capabilities
    bool supports_colors_;
    bool supports_unicode_;
    
    // Color schemes
    struct ColorScheme {
        std::string command;
        std::string argument;
        std::string flag;
        std::string string;
        std::string keyword;
        std::string operator_;
        std::string comment;
        std::string error;
    };
    
    ColorScheme current_colors_;
    
    // Internal methods
    void setup_terminal();
    void restore_terminal();
    void setup_color_schemes();
    void handle_special_keys(int key);
    std::string format_with_color(const std::string& text, const std::string& color);
    void clear_line();
    void move_cursor(int x, int y);
};

} // namespace Nexus