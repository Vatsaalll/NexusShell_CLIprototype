cmake_minimum_required(VERSION 3.20)
project(NexusShell VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Platform detection
if(WIN32)
    set(PLATFORM_NAME "windows")
elseif(APPLE)
    set(PLATFORM_NAME "macos")
else()
    set(PLATFORM_NAME "linux")
endif()

# Find required packages
find_package(PkgConfig REQUIRED)

# V8 JavaScript Engine
find_path(V8_INCLUDE_DIR v8.h PATHS /usr/include/v8 /usr/local/include/v8)
find_library(V8_LIBRARY NAMES v8 v8_monolith PATHS /usr/lib /usr/local/lib)

# libuv for async I/O
pkg_check_modules(LIBUV REQUIRED libuv)

# Abseil for C++ utilities
find_package(absl REQUIRED)

# SIMDJSON for fast parsing
find_package(simdjson REQUIRED)

# Include directories
include_directories(
    ${CMAKE_SOURCE_DIR}/src/cpp/include
    ${V8_INCLUDE_DIR}
    ${LIBUV_INCLUDE_DIRS}
)

# Source files
set(NEXUS_SOURCES
    src/cpp/core/nexus_kernel.cpp
    src/cpp/core/quantum_parser.cpp
    src/cpp/core/orion_execution_engine.cpp
    src/cpp/core/stellar_object_bridge.cpp
    src/cpp/core/nova_terminal_ui.cpp
    src/cpp/core/security_context.cpp
    src/cpp/core/memory_manager.cpp
    src/cpp/core/thread_pool.cpp
    src/cpp/commands/filesystem_commands.cpp
    src/cpp/commands/process_commands.cpp
    src/cpp/commands/network_commands.cpp
    src/cpp/js_runtime/v8_integration.cpp
    src/cpp/js_runtime/js_object_bridge.cpp
    src/cpp/js_runtime/js_command_registry.cpp
    src/cpp/main.cpp
)

# Create executable
add_executable(nexus ${NEXUS_SOURCES})

# Link libraries
target_link_libraries(nexus
    ${V8_LIBRARY}
    ${LIBUV_LIBRARIES}
    absl::base
    absl::strings
    absl::synchronization
    simdjson::simdjson
    pthread
)

# Compiler flags
target_compile_options(nexus PRIVATE
    -Wall -Wextra -O3 -march=native
    -fno-exceptions -fno-rtti  # For performance
    ${LIBUV_CFLAGS_OTHER}
)

# Install targets
install(TARGETS nexus DESTINATION bin)
install(DIRECTORY src/js/ DESTINATION share/nexus/js)
install(FILES config/nexus.conf DESTINATION etc/nexus)