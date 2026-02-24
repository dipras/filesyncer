#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { resolve } from 'path';
import { ConfigManager } from './core/ConfigManager.js';
import { FileWatcher } from './core/FileWatcher.js';
import { SyncEngine } from './core/SyncEngine.js';
import type { FileChangeEvent } from './types.js';

const program = new Command();

program
  .name('filesyncer')
  .description('Real-time file synchronization tool for development')
  .version('1.0.0');

/**
 * Init Command - Create configuration file
 */
program
  .command('init')
  .description('Initialize FileSyncer configuration')
  .option('-c, --config <path>', 'Config file path', 'sync.json')
  .action(async (options) => {
    try {
      const configManager = new ConfigManager(options.config);

      if (configManager.exists()) {
        console.log(chalk.yellow('⚠️  Configuration file already exists!'));
        console.log(chalk.gray(`   ${resolve(options.config)}`));
        return;
      }

      const config = configManager.createDefault();
      console.log(chalk.green('✓ Configuration file created!'));
      console.log(chalk.gray(`  ${resolve(options.config)}`));
      console.log();
      console.log(chalk.cyan('📝 Please edit the configuration file with your settings:'));
      console.log(JSON.stringify(config, null, 2));
    } catch (error) {
      console.error(chalk.red('✗ Failed to initialize:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Watch Command - Start file watcher
 */
program
  .command('watch')
  .description('Watch files and sync changes automatically')
  .option('-c, --config <path>', 'Config file path', 'sync.json')
  .action(async (options) => {
    try {
      const spinner = ora('Loading configuration...').start();
      const configManager = new ConfigManager(options.config);
      const config = configManager.load();
      spinner.succeed('Configuration loaded');

      // Test connection
      spinner.start('Testing connection to remote server...');
      const syncEngine = new SyncEngine(config);
      const connected = await syncEngine.testConnection();

      if (!connected) {
        spinner.fail('Failed to connect to remote server');
        console.log(chalk.yellow('\n⚠️  Please check your SSH configuration:'));
        console.log(chalk.gray(`   Host: ${config.username}@${config.host}:${config.port || 22}`));
        console.log(chalk.gray(`   Key: ${config.privateKeyPath || 'default'}`));
        process.exit(1);
      }
      spinner.succeed('Connected to remote server');

      // Warning if deleteRemoteFiles is enabled
      if (config.deleteRemoteFiles) {
        console.log();
        console.log(chalk.yellow('⚠️  WARNING: deleteRemoteFiles is ENABLED!'));
        console.log(chalk.yellow('   Files on remote server that don\'t exist locally will be DELETED.'));
        console.log(chalk.yellow('   Make sure you have backups!'));
      }

      // Start watcher
      const baseDir = resolve(config.source);
      const watcher = new FileWatcher(config, baseDir);

      console.log();
      console.log(chalk.cyan('👀 Watching for changes...'));
      console.log(chalk.gray(`   Source: ${baseDir}`));
      console.log(chalk.gray(`   Remote: ${config.username}@${config.host}:${config.destination}`));
      console.log(chalk.gray(`   Method: ${config.syncMethod || 'rsync'}`));
      console.log();

      await watcher.start(async (events: FileChangeEvent[]) => {
        console.log(chalk.blue(`\n📦 ${events.length} file(s) changed:`));
        events.forEach(e => {
          const icon = e.type === 'add' ? '➕' : e.type === 'change' ? '📝' : '🗑️';
          console.log(chalk.gray(`   ${icon} ${e.path}`));
        });

        const syncSpinner = ora('Syncing...').start();
        const result = await syncEngine.sync(events);

        if (result.success) {
          syncSpinner.succeed(`Synced in ${result.duration}ms`);
        } else {
          syncSpinner.fail('Sync failed');
          result.errors?.forEach(err => {
            console.log(chalk.red(`   ${err}`));
          });
        }
      });

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log(chalk.yellow('\n\n⏸️  Stopping watcher...'));
        await watcher.stop();
        process.exit(0);
      });

    } catch (error) {
      console.error(chalk.red('✗ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Deploy Command - One-time sync
 */
program
  .command('deploy')
  .description('Deploy all files once (full sync)')
  .option('-c, --config <path>', 'Config file path', 'sync.json')
  .action(async (options) => {
    try {
      const spinner = ora('Loading configuration...').start();
      const configManager = new ConfigManager(options.config);
      const config = configManager.load();
      spinner.succeed('Configuration loaded');

      // Test connection
      spinner.start('Testing connection...');
      const syncEngine = new SyncEngine(config);
      const connected = await syncEngine.testConnection();

      if (!connected) {
        spinner.fail('Failed to connect to remote server');
        process.exit(1);
      }
      spinner.succeed('Connected');

      // Warning if deleteRemoteFiles is enabled
      if (config.deleteRemoteFiles) {
        console.log();
        console.log(chalk.yellow('⚠️  WARNING: deleteRemoteFiles is ENABLED!'));
        console.log(chalk.yellow('   Files on remote server that don\'t exist locally will be DELETED.'));
        console.log(chalk.yellow('   This cannot be undone!'));
        console.log();
      }

      // Sync
      spinner.start('Deploying files...');
      const result = await syncEngine.sync();

      if (result.success) {
        spinner.succeed(`Deployed successfully in ${result.duration}ms`);
        console.log(chalk.green(`\n✓ All files synced to ${config.username}@${config.host}:${config.destination}`));
      } else {
        spinner.fail('Deploy failed');
        result.errors?.forEach(err => {
          console.log(chalk.red(`   ${err}`));
        });
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('✗ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
