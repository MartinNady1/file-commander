# file-commander

A Node.js file watcher that reads commands from a text file and executes 
file system operations in real time.

## How it works

Edit `command.txt` and save it. The watcher detects the change and runs 
the command automatically.

## Commands

| Command | Example |
|---|---|
| `create a file <path>` | `create a file ./notes.txt` |
| `delete the file <path>` | `delete the file ./notes.txt` |
| `rename the file <old> to <new>` | `rename the file ./a.txt to ./b.txt` |
| `add to the file <path> this content: <text>` | `add to the file ./notes.txt this content: hello` |
| `read the file <path>` | `read the file ./notes.txt` |
| `copy the file <src> to <dest>` | `copy the file ./a.txt to ./backup/a.txt` |
| `list the directory <path>` | `list the directory ./src` |
| `file info <path>` | `file info ./notes.txt` |

## Usage
```bash
node fileWatcher.js
```

## Requirements

Node.js 16+
