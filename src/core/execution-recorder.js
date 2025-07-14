import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';

/**
 * Execution Recorder - Time travel debugging and command recording
 */
export class ExecutionRecorder extends EventEmitter {
    constructor(shell) {
        super();
        this.shell = shell;
        this.recording = false;
        this.recordings = new Map();
        this.currentRecording = null;
        this.recordingId = 0;
        this.snapshots = [];
        this.recordingsDir = path.join(process.cwd(), '.nexus', 'recordings');
    }

    /**
     * Start recording
     */
    async startRecording(name = null) {
        if (this.recording) {
            throw new Error('Recording is already in progress');
        }

        this.recordingId++;
        const recordingName = name || `recording_${this.recordingId}_${Date.now()}`;
        
        this.currentRecording = {
            id: this.recordingId,
            name: recordingName,
            startTime: Date.now(),
            commands: [],
            snapshots: [],
            metadata: {
                shell: 'NexusShell',
                version: '1.0.0',
                platform: process.platform,
                nodeVersion: process.version
            }
        };

        this.recording = true;
        this.recordings.set(this.recordingId, this.currentRecording);

        // Create initial snapshot
        await this.createSnapshot('recording_start');

        console.log(chalk.green(`🎬 Recording started: ${recordingName}`));
        this.emit('recordingStarted', this.currentRecording);
    }

    /**
     * Stop recording
     */
    async stopRecording() {
        if (!this.recording) {
            throw new Error('No recording in progress');
        }

        this.currentRecording.endTime = Date.now();
        this.currentRecording.duration = this.currentRecording.endTime - this.currentRecording.startTime;

        // Create final snapshot
        await this.createSnapshot('recording_end');

        // Save recording to file
        await this.saveRecording(this.currentRecording);

        console.log(chalk.green(`🎬 Recording stopped: ${this.currentRecording.name}`));
        console.log(chalk.gray(`   Duration: ${this.currentRecording.duration}ms`));
        console.log(chalk.gray(`   Commands: ${this.currentRecording.commands.length}`));

        this.recording = false;
        const recording = this.currentRecording;
        this.currentRecording = null;

        this.emit('recordingStopped', recording);
        return recording;
    }

    /**
     * Record a command
     */
    recordCommand(input, context) {
        if (!this.recording) {
            return;
        }

        const commandRecord = {
            id: this.currentRecording.commands.length + 1,
            timestamp: Date.now(),
            input,
            context: { ...context },
            systemState: this.captureSystemState()
        };

        this.currentRecording.commands.push(commandRecord);
        this.emit('commandRecorded', commandRecord);
    }

    /**
     * Record command result
     */
    recordCommandResult(commandId, result, error = null) {
        if (!this.recording) {
            return;
        }

        const command = this.currentRecording.commands.find(cmd => cmd.id === commandId);
        if (command) {
            command.result = result;
            command.error = error;
            command.executionTime = Date.now() - command.timestamp;
        }
    }

    /**
     * Create snapshot
     */
    async createSnapshot(type = 'manual', description = '') {
        const snapshot = {
            id: this.snapshots.length + 1,
            timestamp: Date.now(),
            type,
            description,
            systemState: this.captureSystemState(),
            shellState: this.captureShellState()
        };

        this.snapshots.push(snapshot);

        if (this.recording) {
            this.currentRecording.snapshots.push(snapshot);
        }

        this.emit('snapshotCreated', snapshot);
        return snapshot;
    }

    /**
     * Capture system state
     */
    captureSystemState() {
        return {
            timestamp: Date.now(),
            pid: process.pid,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            cwd: process.cwd(),
            platform: process.platform,
            nodeVersion: process.version
        };
    }

    /**
     * Capture shell state
     */
    captureShellState() {
        return {
            currentDirectory: this.shell.currentDirectory,
            environment: { ...this.shell.environment },
            aliases: Array.from(this.shell.aliases.entries()),
            stats: { ...this.shell.stats },
            plugins: Array.from(this.shell.plugins.keys()),
            isRunning: this.shell.isRunning
        };
    }

    /**
     * Replay recording
     */
    async replay(recordingId, options = {}) {
        const recording = this.recordings.get(recordingId);
        if (!recording) {
            throw new Error(`Recording ${recordingId} not found`);
        }

        console.log(chalk.blue(`🔄 Replaying recording: ${recording.name}`));
        
        const replayOptions = {
            speed: options.speed || 1.0,
            breakpoints: options.breakpoints || [],
            stepMode: options.stepMode || false,
            startFrom: options.startFrom || 0,
            ...options
        };

        const replaySession = {
            id: Date.now(),
            recordingId,
            startTime: Date.now(),
            options: replayOptions,
            currentCommand: replayOptions.startFrom,
            paused: false,
            results: []
        };

        this.emit('replayStarted', replaySession);

        try {
            for (let i = replayOptions.startFrom; i < recording.commands.length; i++) {
                const command = recording.commands[i];
                
                // Check breakpoints
                if (replayOptions.breakpoints.includes(i)) {
                    console.log(chalk.yellow(`🔍 Breakpoint hit at command ${i + 1}`));
                    replaySession.paused = true;
                    await this.waitForUserInput('Press Enter to continue...');
                    replaySession.paused = false;
                }

                // Execute command
                console.log(chalk.gray(`[${i + 1}/${recording.commands.length}] ${command.input}`));
                
                const result = await this.shell.executeCommand(command.input, command.context);
                replaySession.results.push({ command, result });

                // Apply speed delay
                if (replayOptions.speed < 1.0) {
                    const delay = (1000 / replayOptions.speed) - 1000;
                    await this.sleep(delay);
                }
            }

            replaySession.endTime = Date.now();
            replaySession.duration = replaySession.endTime - replaySession.startTime;

            console.log(chalk.green(`✅ Replay completed in ${replaySession.duration}ms`));
            this.emit('replayCompleted', replaySession);

            return replaySession;

        } catch (error) {
            console.log(chalk.red(`❌ Replay failed: ${error.message}`));
            this.emit('replayFailed', { replaySession, error });
            throw error;
        }
    }

    /**
     * Save recording to file
     */
    async saveRecording(recording) {
        try {
            await fs.mkdir(this.recordingsDir, { recursive: true });
            const filePath = path.join(this.recordingsDir, `${recording.name}.json`);
            await fs.writeFile(filePath, JSON.stringify(recording, null, 2));
            console.log(chalk.gray(`💾 Recording saved: ${filePath}`));
        } catch (error) {
            console.error(chalk.red(`❌ Failed to save recording: ${error.message}`));
        }
    }

    /**
     * Load recording from file
     */
    async loadRecording(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const recording = JSON.parse(content);
            this.recordings.set(recording.id, recording);
            console.log(chalk.green(`📁 Recording loaded: ${recording.name}`));
            return recording;
        } catch (error) {
            console.error(chalk.red(`❌ Failed to load recording: ${error.message}`));
            throw error;
        }
    }

    /**
     * List recordings
     */
    listRecordings() {
        return Array.from(this.recordings.values());
    }

    /**
     * Delete recording
     */
    async deleteRecording(recordingId) {
        const recording = this.recordings.get(recordingId);
        if (!recording) {
            throw new Error(`Recording ${recordingId} not found`);
        }

        this.recordings.delete(recordingId);
        
        try {
            const filePath = path.join(this.recordingsDir, `${recording.name}.json`);
            await fs.unlink(filePath);
            console.log(chalk.yellow(`🗑️  Recording deleted: ${recording.name}`));
        } catch (error) {
            console.error(chalk.red(`❌ Failed to delete recording file: ${error.message}`));
        }
    }

    /**
     * Export recording
     */
    async exportRecording(recordingId, format = 'json') {
        const recording = this.recordings.get(recordingId);
        if (!recording) {
            throw new Error(`Recording ${recordingId} not found`);
        }

        switch (format) {
            case 'json':
                return JSON.stringify(recording, null, 2);
            
            case 'script':
                return this.generateScript(recording);
            
            case 'markdown':
                return this.generateMarkdown(recording);
            
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    /**
     * Generate script from recording
     */
    generateScript(recording) {
        const script = [
            '#!/usr/bin/env nexus',
            '# Generated from recording: ' + recording.name,
            '# Created: ' + new Date(recording.startTime).toISOString(),
            '',
            ...recording.commands.map(cmd => cmd.input)
        ];

        return script.join('\n');
    }

    /**
     * Generate markdown from recording
     */
    generateMarkdown(recording) {
        const markdown = [
            `# Recording: ${recording.name}`,
            '',
            `**Created:** ${new Date(recording.startTime).toISOString()}`,
            `**Duration:** ${recording.duration}ms`,
            `**Commands:** ${recording.commands.length}`,
            '',
            '## Commands',
            '',
            ...recording.commands.map((cmd, i) => 
                `### ${i + 1}. ${cmd.input}\n\n\`\`\`bash\n${cmd.input}\n\`\`\`\n`
            )
        ];

        return markdown.join('\n');
    }

    /**
     * Check if recording
     */
    isRecording() {
        return this.recording;
    }

    /**
     * Get current recording
     */
    getCurrentRecording() {
        return this.currentRecording;
    }

    /**
     * Wait for user input
     */
    async waitForUserInput(message) {
        return new Promise((resolve) => {
            process.stdout.write(message);
            process.stdin.once('data', () => {
                resolve();
            });
        });
    }

    /**
     * Sleep utility
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}