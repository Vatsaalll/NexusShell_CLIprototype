#!/bin/bash

# NexusShell Build Script
# Builds the C++/JavaScript hybrid shell

set -e

echo "🏗️  Building NexusShell..."

# Check for required dependencies
check_dependency() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 is required but not installed"
        exit 1
    fi
}

echo "📋 Checking dependencies..."
check_dependency cmake
check_dependency make
check_dependency pkg-config

# Check for V8
if ! pkg-config --exists v8; then
    echo "❌ V8 JavaScript engine not found"
    echo "Please install V8 development libraries:"
    echo "  Ubuntu/Debian: sudo apt-get install libv8-dev"
    echo "  macOS: brew install v8"
    echo "  Or build from source: https://v8.dev/docs/build"
    exit 1
fi

# Check for libuv
if ! pkg-config --exists libuv; then
    echo "❌ libuv not found"
    echo "Please install libuv development libraries:"
    echo "  Ubuntu/Debian: sudo apt-get install libuv1-dev"
    echo "  macOS: brew install libuv"
    exit 1
fi

# Create build directory
BUILD_DIR="build"
if [ -d "$BUILD_DIR" ]; then
    echo "🧹 Cleaning previous build..."
    rm -rf "$BUILD_DIR"
fi

mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

# Configure with CMake
echo "⚙️  Configuring build..."
cmake .. \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_CXX_STANDARD=20 \
    -DCMAKE_EXPORT_COMPILE_COMMANDS=ON

# Build
echo "🔨 Compiling..."
make -j$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

# Install
echo "📦 Installing..."
sudo make install

# Copy JavaScript runtime
echo "📄 Installing JavaScript runtime..."
sudo mkdir -p /usr/local/share/nexus/js
sudo cp -r ../src/js/* /usr/local/share/nexus/js/

# Create configuration directory
echo "⚙️  Setting up configuration..."
sudo mkdir -p /etc/nexus
if [ ! -f /etc/nexus/nexus.conf ]; then
    sudo tee /etc/nexus/nexus.conf > /dev/null << EOF
{
  "shell": {
    "maxMemory": "50MB",
    "enableJIT": true,
    "enableSandbox": true,
    "enableDebug": false
  },
  "security": {
    "defaultPolicy": "sandbox",
    "auditLogging": true
  },
  "performance": {
    "monitoring": true,
    "thresholds": {
      "memoryWarning": "40MB",
      "latencyWarning": "1000ms"
    }
  }
}
EOF
fi

cd ..

echo "✅ NexusShell build completed successfully!"
echo ""
echo "🚀 To start NexusShell:"
echo "   nexus"
echo ""
echo "📚 Documentation:"
echo "   nexus --help"
echo "   man nexus"
echo ""
echo "🔧 Configuration:"
echo "   /etc/nexus/nexus.conf"
echo ""
echo "🌟 Features:"
echo "   • Dual-mode syntax (shell + JavaScript)"
echo "   • C++ performance with V8 JavaScript runtime"
echo "   • Zero-copy pipelines and JIT compilation"
echo "   • Capability-based security model"
echo "   • Time travel debugging and recording"
echo "   • Multi-threaded execution engine"