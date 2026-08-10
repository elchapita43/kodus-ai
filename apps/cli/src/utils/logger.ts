interface CliOutputMode {
    quiet?: boolean;
    verbose?: boolean;
}

export function isCliQuietMode(): boolean {
    return process.env.CODUS_QUIET === '1';
}

export function isCliVerboseMode(): boolean {
    return (
        process.env.CODUS_VERBOSE === '1' ||
        process.env.CODUS_VERBOSE === 'true'
    );
}

export function setCliOutputMode(mode: CliOutputMode): void {
    if (mode.quiet !== undefined) {
        if (mode.quiet) {
            process.env.CODUS_QUIET = '1';
        } else {
            delete process.env.CODUS_QUIET;
        }
    }

    if (mode.verbose !== undefined) {
        if (mode.verbose) {
            process.env.CODUS_VERBOSE = '1';
        } else {
            delete process.env.CODUS_VERBOSE;
        }
    }
}

export function cliInfo(...args: unknown[]): void {
    if (isCliQuietMode()) {
        return;
    }
    console.log(...args);
}

export function cliWarn(...args: unknown[]): void {
    if (isCliQuietMode()) {
        return;
    }
    console.warn(...args);
}

export function cliError(...args: unknown[]): void {
    console.error(...args);
}

export function cliDebug(...args: unknown[]): void {
    if (isCliQuietMode() || !isCliVerboseMode()) {
        return;
    }
    // Keep stdout clean for machine-readable formats (json/markdown).
    console.error(...args);
}
