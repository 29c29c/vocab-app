// The JWT payload is used only to partition local data. Authorization remains server-side.
export function getAccountId(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return Number.isSafeInteger(payload.id) && payload.id > 0 ? String(payload.id) : null;
    } catch {
        return null;
    }
}
