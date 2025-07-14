#include "nova_terminal_ui.h"
#include <iostream>
#include <sstream>
#include <algorithm>
#include <termios.h>
#include <unistd.h>
#include <sys/ioctl.h>

namespace Nexus {

NovaTerminalUI::NovaTerminalUI(NexusKernel* kernel)
    : kernel_(kernel), running_(false), history_index_(0) {
    setup_color_schemes();
}

NovaTerminalUI::~NovaTerminalUI() {
    shutdown();
}

bool NovaTerminalUI::initialize() {
    setup_terminal();
    
    // Check terminal capabilities
    supports_colors_ = isatty(STDOUT_FILENO);
    supports_unicode_ = true; // Assume modern terminal
    
    running_ = true;
    return true;
}

void NovaTerminalUI::run_interactive_shell() {
    while (running_ && kernel_->is_running()) {
        try {
            print_prompt();
            std::string input = read_line_with_completion();
            
            if (input.empty()) {
                continue;
            }
            
            // Add to history
            if (command_history_.empty() || command_history_.back() != input) {
                command_history_.push_back(input);
                if (command_history_.size() > 1000) {
                    command_history_.erase(command_history_.begin());
                }
            }
            history_index_ = command_history_.size();
            
            // Handle built-in commands
            if (input == "exit" || input == "quit") {
                running_ = false;
                break;
            }
            
            if (input == "clear") {
                std::cout << "\033[2J\033[H" << std::flush;
                continue;
            }
            
            // Execute command
            CommandContext context;
            context.working_directory = current_directory_;
            context.security_context = kernel_->security_context();
            context.object_bridge = kernel_->object_bridge();
            
            auto result = kernel_->execute_command(input, context);
            
            // Handle special result types
            if (result.metadata.type == "exit") {
                running_ = false;
                break;
            }
            
            print_result(result);
            
        } catch (const std::exception& e) {
            print_error(e.what());
        }
    }
    
    std::cout << "\n👋 Goodbye!\n";
}

void NovaTerminalUI::shutdown() {
    running_ = false;
    restore_terminal();
}

std::string NovaTerminalUI::read_line_with_completion() {
    std::string input;
    std::string line;
    
    // For now, use simple getline
    // In a full implementation, this would handle:
    // - Tab completion
    // - History navigation with arrow keys
    // - Syntax highlighting as you type
    // - Multi-line input support
    
    std::getline(std::cin, line);
    return line;
}

std::vector<std::string> NovaTerminalUI::get_completions(const std::string& partial_input, size_t cursor_pos) {
    return kernel_->parser()->get_completions(partial_input, cursor_pos);
}

void NovaTerminalUI::print_result(const NexusObject& result) {
    if (result.metadata.type == "error") {
        print_error(std::get<std::string>(result.value));
        return;
    }
    
    std::visit([this](const auto& value) {
        using T = std::decay_t<decltype(value)>;
        
        if constexpr (std::is_same_v<T, std::nullptr_t>) {
            // Don't print anything for null results
        } else if constexpr (std::is_same_v<T, bool>) {
            std::cout << (value ? "true" : "false") << std::endl;
        } else if constexpr (std::is_same_v<T, int64_t>) {
            std::cout << value << std::endl;
        } else if constexpr (std::is_same_v<T, double>) {
            std::cout << value << std::endl;
        } else if constexpr (std::is_same_v<T, std::string>) {
            std::cout << value << std::endl;
        } else if constexpr (std::is_same_v<T, std::vector<uint8_t>>) {
            std::cout << "[Binary data: " << value.size() << " bytes]" << std::endl;
        }
    }, result.value);
}

void NovaTerminalUI::print_error(const std::string& error) {
    if (supports_colors_) {
        std::cout << "\033[31m❌ " << error << "\033[0m" << std::endl;
    } else {
        std::cout << "Error: " << error << std::endl;
    }
}

void NovaTerminalUI::print_prompt() {
    std::string cwd = std::filesystem::current_path().filename().string();
    if (cwd.empty()) cwd = "/";
    
    if (supports_colors_) {
        std::cout << "\033[32mnexus\033[0m:\033[34m" << cwd << "\033[0m$ " << std::flush;
    } else {
        std::cout << "nexus:" << cwd << "$ " << std::flush;
    }
}

void NovaTerminalUI::highlight_syntax(const std::string& input) {
    if (!supports_colors_) {
        std::cout << input;
        return;
    }
    
    auto tokens = kernel_->parser()->tokenize_for_highlighting(input);
    
    size_t last_pos = 0;
    for (const auto& token : tokens) {
        // Print text before token
        if (token.start > last_pos) {
            std::cout << input.substr(last_pos, token.start - last_pos);
        }
        
        // Print token with color
        std::string color;
        if (token.type == "command") color = current_colors_.command;
        else if (token.type == "argument") color = current_colors_.argument;
        else if (token.type == "flag") color = current_colors_.flag;
        else if (token.type == "string") color = current_colors_.string;
        else if (token.type == "keyword") color = current_colors_.keyword;
        else if (token.type == "operator") color = current_colors_.operator_;
        
        if (!color.empty()) {
            std::cout << color << input.substr(token.start, token.length) << "\033[0m";
        } else {
            std::cout << input.substr(token.start, token.length);
        }
        
        last_pos = token.start + token.length;
    }
    
    // Print remaining text
    if (last_pos < input.length()) {
        std::cout << input.substr(last_pos);
    }
}

void NovaTerminalUI::setup_terminal() {
    // Setup terminal for raw input (for advanced features)
    // This would configure termios for character-by-character input
}

void NovaTerminalUI::restore_terminal() {
    // Restore original terminal settings
}

void NovaTerminalUI::setup_color_schemes() {
    // Default color scheme
    current_colors_.command = "\033[36m";     // Cyan
    current_colors_.argument = "\033[37m";    // White
    current_colors_.flag = "\033[33m";        // Yellow
    current_colors_.string = "\033[32m";      // Green
    current_colors_.keyword = "\033[35m";     // Magenta
    current_colors_.operator_ = "\033[31m";   // Red
    current_colors_.comment = "\033[90m";     // Dark gray
    current_colors_.error = "\033[91m";       // Bright red
}

std::string NovaTerminalUI::format_with_color(const std::string& text, const std::string& color) {
    if (!supports_colors_) {
        return text;
    }
    return color + text + "\033[0m";
}

} // namespace Nexus