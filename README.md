# wait-file-change

A command-line utility that waits for some file to change and then exits

## Install

```bash
npm install --save-dev @nartallax/wait-file-change
```

## Use

```bash
./node_modules/.bin/wait-file-change my_file.txt --timeout 3 --delay 0.5 --count 1 --verbose
```

Full list of parameters with their descriptions is available at `--help`:

```bash
./node_modules/.bin/wait-file-change --help
```
