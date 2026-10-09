// The app uses one SQLite connection. Keep multi-statement replacement isolated
// from other record reads and writes on that connection.
let previousAccess = Promise.resolve();

export async function withRecordAccess(callback) {
    const waitForTurn = previousAccess;
    let release;
    previousAccess = new Promise(resolve => { release = resolve; });
    await waitForTurn;
    try {
        return await callback();
    } finally {
        release();
    }
}
