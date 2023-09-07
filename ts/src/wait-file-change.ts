import {promises as Fs} from "fs"
import Path from "path"
import watch from "node-watch"

interface CliArgs {
	readonly filePath: string
	readonly changeCountLimit: number
	readonly timeout: number
	readonly delay: number
	readonly verbose: boolean
}

const defaultChangeCountLimit = 1
// Q: why this number in particular?
// A: anything higher won't fit in 32bit signed integer
// and that will cause error in setTimeout
const defaultTimeout = Math.floor(0x7fffffff / 1000)
const defaultDelay = 0.25

function displayHelp(): never {
	const helpStr = `A command-line utility that waits for some file to change and then exits

Usage: ./node_modules/.bin/wait-file-change my_file [...options]

-c, --count:        Amount of changes required for the tool to exit. Default ${defaultChangeCountLimit}
-t, --timeout:      Time, in seconds, required for the tool to exit without waiting for changes. Fractional values are allowed. Default ${defaultTimeout}
-d, --delay:        Time, in seconds, that tool will wait for more events to come to group them into one change. Default ${defaultDelay}
-v, --verbose:      Boolean. Emit some more messages. Default false.
-h, -help, --help:  Display this text and exit.`
	console.error(helpStr)
	process.exit(1)
}

async function parseCli(): Promise<CliArgs> {
	let changeCountLimit = defaultChangeCountLimit
	let timeout = defaultTimeout
	let delay = defaultDelay
	let verbose = false

	for(let i = 3; i < process.argv.length; i++){
		const arg = process.argv[i]!
		if(arg === "-c" || arg === "--count"){
			const rawCount = process.argv[++i]!
			changeCountLimit = parseInt(rawCount)
			if(Number.isNaN(changeCountLimit) || changeCountLimit + "" !== rawCount){
				throw new Error("Weird value is passed as count: " + rawCount)
			}
			if(changeCountLimit <= 0){
				throw new Error("Expected change count to be positive integer, got " + changeCountLimit)
			}
		} else if(arg === "-t" || arg === "--timeout"){
			const rawTimeout = process.argv[++i]!
			timeout = parseFloat(rawTimeout)
			if(Number.isNaN(timeout)){
				throw new Error("Weird value is passed as timeout: " + rawTimeout)
			}
			if(timeout <= 0){
				throw new Error("Expected timeout to be positive number, got " + timeout)
			}
		} else if(arg === "-d" || arg === "--delay"){
			const rawDelay = process.argv[++i]!
			delay = parseFloat(rawDelay)
			if(Number.isNaN(delay)){
				throw new Error("Weird value is passed as delay: " + rawDelay)
			}
			if(delay <= 0){
				throw new Error("Expected delay to be positive number, got " + delay)
			}
		} else if(arg === "-v" || arg === "--verbose"){
			verbose = true
		} else if(arg === "-h" || arg === "-help" || arg === "--help"){
			displayHelp()
		} else {
			throw new Error("Unknown CLI key: " + arg)
		}
	}

	let filePath = process.argv[2]!
	if(filePath === "-h" || filePath === "-help" || filePath === "--help"){
		// ew. but I don't see a better solution right now. whatever.
		displayHelp()
	}

	if(typeof(filePath) !== "string"){
		throw new Error("File argument is not provided")
	}
	filePath = Path.resolve(filePath)
	await Fs.stat(filePath) // should throw if there's no file, that's the point

	return {changeCountLimit, filePath, timeout, delay, verbose}
}

async function main(): Promise<void> {
	const args = await parseCli()

	let changeCount = 0

	const timeout = setTimeout(() => {
		if(args.verbose){
			console.error(`Change count not reached (${changeCount} out of ${args.changeCountLimit}), exiting by timeout`)
		}
		shutdown(1)
	}, args.timeout * 1000)

	const watcher = watch(
		args.filePath,
		{recursive: false, delay: args.delay * 1000, persistent: true},
		async(evtType, filename) => {
			void filename // that parameter is only here to suppress deprecation warning
			changeCount++
			if(args.verbose){
				console.error(`Got FS event: ${evtType}; that's ${changeCount} changes out of ${args.changeCountLimit}`)
			}
			if(changeCount >= args.changeCountLimit){
				shutdown(0)
			}
		}
	)

	if(args.verbose){
		console.error(`Started watcher on file ${args.filePath}`)
	}

	function shutdown(exitCode: number): never {
		clearTimeout(timeout)
		watcher.close()
		process.exit(exitCode)
	}
}

async function wrappedMain(): Promise<void> {
	try {
		await main()
	} catch(e){
		console.error(e + "")
		process.exit(1)
	}
}

wrappedMain()